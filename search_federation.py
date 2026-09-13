"""Phase2 federated search helpers for demo-gallery."""

from __future__ import annotations

import json
import re
import os
import sqlite3
import threading
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

ROOT = Path(__file__).resolve().parent
CATALOG = ROOT / "catalog.json"
SEARCH_INDEX = ROOT / "search_index.json"
FEEDBACK_DB = Path(
    os.environ.get(
        "FEEDBACK_DB",
        "/opt/demo-feedback/data/feedback.sqlite",
    )
)
_DEFAULT_FEEDBACK_BASE = "http://120.55.184.234:8787"
_DEFAULT_FED_TIMEOUT = 10.0
_FED_CHANNELS = ("demos", "feedback", "knowledge", "feishu")


def feedback_public_base() -> str:
    """Public feedback admin/embed origin. Env overrides keep ECS IP as default."""
    raw = (
        os.environ.get("FEEDBACK_PUBLIC_BASE")
        or os.environ.get("GALLERY_FEEDBACK_BASE")
        or _DEFAULT_FEEDBACK_BASE
    )
    return str(raw).rstrip("/")


def federation_timeout(channel: str | None = None) -> float:
    """Per-source deadline (seconds). Default 10s; override with GALLERY_FED_TIMEOUT[_CHANNEL]."""
    if channel:
        specific = os.environ.get(f"GALLERY_FED_TIMEOUT_{channel.upper()}")
        if specific not in (None, ""):
            try:
                return max(0.05, float(specific))
            except ValueError:
                pass
    raw = os.environ.get("GALLERY_FED_TIMEOUT", str(_DEFAULT_FED_TIMEOUT))
    try:
        return max(0.05, float(raw or _DEFAULT_FED_TIMEOUT))
    except ValueError:
        return _DEFAULT_FED_TIMEOUT

# MaxKB (primary knowledge channel)
MAXKB_BASE = os.environ.get("GALLERY_MAXKB_BASE", "").rstrip("/")
MAXKB_PUBLIC = os.environ.get("GALLERY_MAXKB_PUBLIC", MAXKB_BASE).rstrip("/")
MAXKB_TOKEN = os.environ.get("GALLERY_MAXKB_TOKEN", "").strip()
MAXKB_TOKEN_FILE = Path(
    os.environ.get(
        "GALLERY_MAXKB_TOKEN_FILE",
        str(ROOT / "data" / "maxkb_token"),
    )
)
MAXKB_WORKSPACE = os.environ.get("GALLERY_MAXKB_WORKSPACE", "default").strip() or "default"
MAXKB_KNOWLEDGE_IDS = [
    x.strip()
    for x in os.environ.get("GALLERY_MAXKB_KNOWLEDGE_IDS", "").split(",")
    if x.strip()
]
MAXKB_TOP = int(os.environ.get("GALLERY_MAXKB_TOP", "8") or "8")
MAXKB_SIMILARITY = float(os.environ.get("GALLERY_MAXKB_SIMILARITY", "0.3") or "0.3")
MAXKB_MODE = os.environ.get("GALLERY_MAXKB_MODE", "blend").strip() or "blend"

# Legacy Confluence/KMS fallback
KMS_BASE = os.environ.get("GALLERY_KMS_BASE", "").rstrip("/")
KMS_TOKEN = os.environ.get("GALLERY_KMS_TOKEN", "").strip()
KMS_SPACE = os.environ.get("GALLERY_KMS_SPACE", "").strip()


def _load_json(path: Path) -> dict:
    if not path.is_file():
        return {}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return {}


def _maxkb_token() -> str:
    if MAXKB_TOKEN:
        return MAXKB_TOKEN
    if MAXKB_TOKEN_FILE.is_file():
        try:
            return MAXKB_TOKEN_FILE.read_text(encoding="utf-8").strip()
        except Exception:
            return ""
    return ""


def _http_json(method: str, url: str, body=None, headers=None, timeout: float = 12):
    data = None
    hdrs = {"Accept": "application/json", **(headers or {})}
    if body is not None:
        data = json.dumps(body, ensure_ascii=False).encode("utf-8")
        hdrs["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=data, headers=hdrs, method=method)
    with urllib.request.urlopen(req, timeout=timeout) as res:
        raw = res.read().decode("utf-8") or "null"
        return res.status, json.loads(raw)


_QUESTION_TAILS = (
    "怎么讲",
    "怎么比",
    "怎么说",
    "如何讲",
    "怎样讲",
    "如何说",
    "怎样说",
    "怎么介绍",
)

# Small in-file synonym / intent map. Optional JSON override: GALLERY_MAXKB_SYNONYMS
_DEFAULT_SYNONYMS: dict[str, tuple[str, ...]] = {
    "稽核": ("迎检", "驻厂", "审计包", "追溯"),
    "迎检": ("稽核", "驻厂", "审计包"),
    "稼动": ("OEE", "WIP", "良率"),
    "稼动率": ("OEE", "WIP", "良率"),
    "OEE": ("稼动", "稼动率", "WIP"),
    "园区": ("填报", "月报"),
    "套表": ("审计包", "检查表", "追溯"),
}

_AMMO_PATH_TOKENS = ("售前武器/", "作战卡", "开场", "反对意见", "Playbook", "检索卡")
_WIKI_STUB_RE = re.compile(
    r"(百科|词条|维基|未命名|Untitled|知识库首页|新建文档|空白页)",
    re.I,
)
_OBJECTION_CUES = (
    "怎么讲",
    "怎么说",
    "怎么比",
    "反对",
    "异议",
    "客户说",
    "为什么不用",
    "如何讲",
)
_PROCESS_NOUNS = ("流程", "工序", "SOP", "工艺", "制程", "节点", "规范")


def _strip_question_tail(q: str) -> str:
    text = (q or "").strip()
    for tail in _QUESTION_TAILS:
        if text.endswith(tail):
            return text[: -len(tail)].strip()
    return text


def _account_needles(q: str) -> list[str]:
    try:
        from gallery_brief import _load_knowledge

        account_mod, _briefing = _load_knowledge()
        if account_mod:
            acc = account_mod.resolve_account(q)
            if acc.resolved:
                names = [acc.canonical, *acc.aliases, *acc.peers]
                return [n for n in names if n and len(n) >= 2]
    except Exception:
        pass
    qn = _strip_question_tail(q)
    return [qn] if len(qn) >= 2 else []


def retrieve_query(q: str) -> str:
    """Drop 怎么讲 tails; use subject + industry when resolved."""
    try:
        from gallery_brief import _load_knowledge

        account_mod, _briefing = _load_knowledge()
        if account_mod:
            acc = account_mod.resolve_account(q)
            if acc.resolved:
                if acc.peers:
                    return " ".join(acc.peers)
                return (acc.retrieval_query or acc.canonical or q).strip()
    except Exception:
        pass
    return _strip_question_tail(q) or (q or "").strip()


def demo_public_url(demo: dict) -> str:
    did = str(demo.get("id") or "").strip()
    if not did:
        return ""
    return f"/demos/{did}/"


def search_demos(q: str, limit: int = 20) -> list[dict]:
    needles = _account_needles(q)
    if not needles:
        return []
    catalog = _load_json(CATALOG)
    index = _load_json(SEARCH_INDEX)
    idx_demos = index.get("demos") or {}
    scored: list[tuple[int, dict]] = []
    for demo in catalog.get("demos") or []:
        if demo.get("archived"):
            continue
        did = demo.get("id") or ""
        idx = idx_demos.get(did) or {}
        modules = [m.get("label") or "" for m in (idx.get("modules") or [])]
        blob_parts = [
            demo.get("title") or "",
            demo.get("client") or "",
            demo.get("industry") or "",
            demo.get("type") or "",
            demo.get("summary") or "",
            " ".join(demo.get("tags") or []),
            " ".join(idx.get("keywords") or []),
            " ".join(idx.get("aliases") or []),
            " ".join(modules),
        ]
        blob = " ".join(blob_parts)
        blob_l = blob.lower()
        hit_n = next((n for n in needles if n.lower() in blob_l), "")
        if not hit_n:
            continue
        score = 0
        reason = "相关命中"
        if hit_n.lower() in (demo.get("client") or "").lower():
            score, reason = 50, f"客户 · {demo.get('client')}"
        elif hit_n.lower() in (demo.get("title") or "").lower():
            score, reason = 40, "标题命中"
        else:
            tag = next(
                (t for t in (demo.get("tags") or []) if hit_n.lower() in str(t).lower()),
                None,
            )
            if tag:
                score, reason = 30, f"标签 · {tag}"
            else:
                mod = next((m for m in modules if hit_n.lower() in m.lower()), None)
                if mod:
                    score, reason = 25, f"模块 · {mod}"
                else:
                    score, reason = 15, "正文命中"
        if demo.get("featured"):
            score += 5
        scored.append(
            (
                score,
                {
                    "id": did,
                    "title": demo.get("title") or did,
                    "client": demo.get("client") or "",
                    "summary": demo.get("summary") or "",
                    "reason": reason,
                    "score": score,
                    "url": demo_public_url(demo),
                    "channel": "demo",
                },
            )
        )
    scored.sort(key=lambda x: (-x[0], x[1]["title"]))
    return [x[1] for x in scored[:limit]]


def search_feedback(q: str, limit: int = 20) -> list[dict]:
    qn = (q or "").strip().lower()
    if len(qn) < 2 or not FEEDBACK_DB.is_file():
        return []
    try:
        conn = sqlite3.connect(str(FEEDBACK_DB))
        conn.row_factory = sqlite3.Row
        rows = conn.execute(
            """
            SELECT c.id, c.demo_id, c.nickname, c.body, c.status, c.created_at,
                   c.annotation_json, c.shot_path
            FROM comments c
            WHERE lower(c.body) LIKE ?
               OR lower(c.nickname) LIKE ?
               OR lower(c.demo_id) LIKE ?
               OR lower(coalesce(c.annotation_json,'')) LIKE ?
               OR c.id IN (
                    SELECT comment_id FROM replies
                    WHERE lower(body) LIKE ? OR lower(nickname) LIKE ?
               )
            ORDER BY c.updated_at DESC
            LIMIT ?
            """,
            (
                f"%{qn}%",
                f"%{qn}%",
                f"%{qn}%",
                f"%{qn}%",
                f"%{qn}%",
                f"%{qn}%",
                limit,
            ),
        ).fetchall()
        out = []
        for r in rows:
            snip = ""
            raw = r["annotation_json"]
            if raw:
                try:
                    ann = json.loads(raw)
                    snip = ann.get("text_snippet") or ann.get("selector") or ""
                except Exception:
                    pass
            out.append(
                {
                    "id": r["id"],
                    "demo_id": r["demo_id"],
                    "nickname": r["nickname"],
                    "body": r["body"],
                    "status": r["status"],
                    "snippet": snip,
                    "shot_url": f"{feedback_public_base()}/{r['shot_path']}"
                    if r["shot_path"]
                    else None,
                    "url": f"{feedback_public_base()}/admin/",
                    "demo_url": f"/demos/{r['demo_id']}/",
                    "channel": "feedback",
                    "created_at": r["created_at"],
                }
            )
        conn.close()
        return out
    except Exception as e:
        return [{"error": f"feedback search failed: {e}", "channel": "feedback"}]


def _list_maxkb_knowledge_ids(token: str) -> list[str]:
    url = f"{MAXKB_BASE}/admin/api/workspace/{MAXKB_WORKSPACE}/knowledge"
    _, pl = _http_json("GET", url, headers={"Authorization": f"Bearer {token}"})
    data = pl.get("data") if isinstance(pl, dict) else pl
    rows = data
    if isinstance(data, dict):
        rows = data.get("records") or data.get("list") or data.get("items") or []
    out = []
    for row in rows or []:
        if isinstance(row, dict) and row.get("id"):
            out.append(str(row["id"]))
    return out


def _maxkb_doc_url(knowledge_id: str, document_id: str) -> str:
    base = MAXKB_PUBLIC or MAXKB_BASE
    if not base:
        return "#"
    # MaxKB admin SPA — open knowledge; deep doc routes vary by version
    if document_id:
        return f"{base}/ui/knowledge/{knowledge_id}?documentId={document_id}"
    return f"{base}/ui/knowledge/{knowledge_id}"


def _env_int(name: str, default: int, *, lo: int | None = None, hi: int | None = None) -> int:
    raw = os.environ.get(name)
    try:
        val = int(raw) if raw not in (None, "") else default
    except ValueError:
        val = default
    if lo is not None:
        val = max(lo, val)
    if hi is not None:
        val = min(hi, val)
    return val


def _expand_enabled() -> bool:
    raw = os.environ.get("GALLERY_MAXKB_EXPAND", "1").strip().lower()
    return raw not in {"0", "false", "off", "no"}


def synonym_map() -> dict[str, list[str]]:
    """In-file synonyms, optionally merged with GALLERY_MAXKB_SYNONYMS JSON."""
    out: dict[str, list[str]] = {k: list(v) for k, v in _DEFAULT_SYNONYMS.items()}
    raw = os.environ.get("GALLERY_MAXKB_SYNONYMS", "").strip()
    if not raw:
        return out
    try:
        extra = json.loads(raw)
    except Exception:
        return out
    if not isinstance(extra, dict):
        return out
    for key, val in extra.items():
        if not key or not isinstance(val, list):
            continue
        out[str(key)] = [str(x) for x in val if str(x).strip()]
    return out


def classify_knowledge_intent(q: str) -> str:
    """Light intent: objection / process / neutral. Demos channel is unchanged."""
    text = q or ""
    if any(cue in text for cue in _OBJECTION_CUES):
        return "objection"
    if any(noun in text for noun in _PROCESS_NOUNS):
        return "process"
    return "neutral"


def _synonym_variants(text: str) -> list[str]:
    blob = (text or "").strip()
    if not blob:
        return []
    mapping = synonym_map()
    seeds = sorted(mapping.keys(), key=len, reverse=True)
    blob_l = blob.lower()
    extras: list[str] = []
    for seed in seeds:
        idx = blob_l.find(seed.lower())
        if idx < 0:
            continue
        syns = [s for s in mapping[seed] if s and s.lower() not in blob_l]
        if not syns:
            continue
        extras.append(f"{blob} {' '.join(syns[:3])}".strip())
        replaced = blob[:idx] + syns[0] + blob[idx + len(seed) :]
        if replaced.strip() and replaced != blob:
            extras.append(replaced.strip())
        break
    return extras


def expand_maxkb_queries(q: str, max_variants: int | None = None) -> list[str]:
    """Build 2–4 query variants: original, stripped tail, synonym/intent, retrieve."""
    if max_variants is None:
        max_variants = _env_int("GALLERY_MAXKB_VARIANTS", 4, lo=1, hi=6)
    original = (q or "").strip()
    out: list[str] = []

    def add(text: str) -> None:
        item = (text or "").strip()
        if len(item) >= 2 and item not in out:
            out.append(item)

    add(original)
    if not _expand_enabled():
        return out[:1] or out
    stripped = _strip_question_tail(original)
    add(stripped)
    for extra in _synonym_variants(stripped or original):
        add(extra)
    try:
        add(retrieve_query(original))
    except Exception:
        pass
    return out[: max(1, max_variants)]


def _paragraph_key(item: dict) -> str:
    pid = str(item.get("paragraph_id") or item.get("id") or "").strip()
    if pid:
        return f"p:{pid}"
    kid = str(item.get("knowledge_id") or "")
    did = str(item.get("document_id") or "")
    snip = str(item.get("snippet") or "")[:80]
    if did or snip:
        return f"d:{kid}:{did}:{snip}"
    return f"t:{item.get('title') or ''}:{item.get('document_name') or ''}"


def rrf_fuse(
    ranked_lists: list[list[dict]],
    *,
    k: int = 60,
    key_fn=None,
) -> list[dict]:
    """Reciprocal rank fusion across (kb × query_variant) lists. Identity = paragraph id."""
    key_fn = key_fn or _paragraph_key
    rrf_k = k if k > 0 else 60
    scores: dict[str, float] = {}
    best: dict[str, dict] = {}
    for lst in ranked_lists:
        for rank, item in enumerate(lst, start=1):
            if not isinstance(item, dict):
                continue
            key = key_fn(item)
            if not key:
                continue
            scores[key] = scores.get(key, 0.0) + 1.0 / (rrf_k + rank)
            prev = best.get(key)
            raw = float(item.get("raw_score") or item.get("score") or 0)
            prev_raw = float((prev or {}).get("raw_score") or (prev or {}).get("score") or 0)
            if prev is None or raw > prev_raw:
                best[key] = dict(item)
    fused = []
    for key, item in best.items():
        row = dict(item)
        row["rrf"] = round(scores[key], 6)
        fused.append(row)
    fused.sort(key=lambda x: (-float(x.get("rrf") or 0), x.get("title") or ""))
    return fused


def _has_ammo_path(path: str) -> bool:
    blob = path or ""
    low = blob.lower()
    return any(tok.lower() in low for tok in _AMMO_PATH_TOKENS)


def path_title_boost_factor(item: dict, intent: str = "neutral") -> float:
    path = f"{item.get('document_name') or ''} {item.get('title') or ''}"
    ammo = _has_ammo_path(path)
    stub = bool(_WIKI_STUB_RE.search(path)) and not ammo
    factor = 1.0
    if ammo:
        if intent == "objection":
            factor *= 1.35
        elif intent == "process":
            factor *= 1.08
        else:
            factor *= 1.22
    if stub:
        factor *= 0.82
    return factor


def apply_path_title_boosts(items: list[dict], intent: str = "neutral") -> list[dict]:
    """Multiply RRF by path/title boosts. Ammo paths up; wiki-stub patterns down."""
    out: list[dict] = []
    for item in items:
        row = dict(item)
        factor = path_title_boost_factor(row, intent)
        rrf = float(row.get("rrf") or 0)
        row["boost"] = round(factor, 4)
        row["rank_score"] = rrf * factor
        row["score"] = round(row["rank_score"], 6)
        if _has_ammo_path(f"{row.get('document_name') or ''} {row.get('title') or ''}"):
            row["reason"] = "MaxKB · 售前武器"
        else:
            row["reason"] = "MaxKB · RRF"
        out.append(row)
    out.sort(key=lambda x: (-float(x.get("rank_score") or 0), x.get("title") or ""))
    return out


def cap_paragraphs_per_document(items: list[dict], cap: int = 3) -> list[dict]:
    """Keep paragraph-id identity; allow up to `cap` paragraphs per document_name."""
    limit = cap if cap > 0 else 3
    seen_para: set[str] = set()
    counts: dict[str, int] = {}
    out: list[dict] = []
    for item in items:
        para = _paragraph_key(item)
        if para in seen_para:
            continue
        seen_para.add(para)
        doc = (
            item.get("document_name")
            or item.get("document_id")
            or item.get("title")
            or ""
        )
        n = counts.get(doc, 0)
        if n >= limit:
            continue
        counts[doc] = n + 1
        out.append(item)
    return out


def _maxkb_item_from_row(row: dict, kid: str, query_variant: str = "") -> dict:
    score = float(row.get("comprehensive_score") or row.get("similarity") or 0)
    title = row.get("title") or row.get("document_name") or "知识段落"
    doc_name = row.get("document_name") or ""
    content = (row.get("content") or "").strip().replace("\n", " ")
    kid_id = str(row.get("knowledge_id") or kid)
    doc_id = str(row.get("document_id") or "")
    para_id = str(row.get("id") or row.get("paragraph_id") or "").strip()
    if not para_id:
        para_id = f"{doc_id}:{hash(content) & 0xFFFFFFFF:08x}"
    return {
        "id": para_id,
        "paragraph_id": para_id,
        "title": str(title).strip() or doc_name,
        "snippet": content[:160],
        "document_name": doc_name,
        "document_id": doc_id,
        "knowledge_id": kid_id,
        "knowledge_name": row.get("knowledge_name") or "",
        "score": round(score, 4),
        "raw_score": score,
        "url": _maxkb_doc_url(kid_id, doc_id),
        "channel": "knowledge",
        "reason": f"MaxKB · {round(score * 100):.0f}%",
        "query_variant": query_variant,
    }


def _maxkb_hit_test(
    knowledge_id: str,
    query_text: str,
    *,
    token: str,
    top_number: int,
    timeout: float = 20,
) -> list[dict]:
    url = (
        f"{MAXKB_BASE}/admin/api/workspace/{MAXKB_WORKSPACE}"
        f"/knowledge/{knowledge_id}/hit_test"
    )
    _, pl = _http_json(
        "POST",
        url,
        body={
            "query_text": query_text,
            "top_number": top_number,
            "similarity": MAXKB_SIMILARITY,
            "search_mode": MAXKB_MODE,
        },
        headers={"Authorization": f"Bearer {token}"},
        timeout=timeout,
    )
    rows = pl.get("data") if isinstance(pl, dict) else pl
    if not isinstance(rows, list):
        return []
    return [r for r in rows if isinstance(r, dict)]


def search_maxkb(q: str, limit: int = 10) -> dict:
    """MaxKB hit_test with query expansion, RRF across (kb × variant), path boosts."""
    qn = (q or "").strip()
    if len(qn) < 2:
        return {"items": [], "status": "empty_query"}
    if not MAXKB_BASE:
        return {"items": [], "status": "not_configured", "hint": "Set GALLERY_MAXKB_BASE"}
    token = _maxkb_token()
    if not token:
        return {
            "items": [],
            "status": "not_configured",
            "hint": "Set GALLERY_MAXKB_TOKEN or GALLERY_MAXKB_TOKEN_FILE",
        }
    try:
        kids = MAXKB_KNOWLEDGE_IDS or _list_maxkb_knowledge_ids(token)
        if not kids:
            return {"items": [], "status": "empty", "hint": "MaxKB 无知识库"}
        variants = expand_maxkb_queries(qn)
        intent = classify_knowledge_intent(qn)
        per_kb = max(3, min(limit, MAXKB_TOP))
        rrf_k = _env_int("GALLERY_MAXKB_RRF_K", 60, lo=1, hi=200)
        per_doc = _env_int("GALLERY_MAXKB_PER_DOC", 3, lo=1, hi=5)
        jobs = [(kid, variant) for kid in kids for variant in variants]
        ranked_lists: list[list[dict]] = []
        last_http: urllib.error.HTTPError | None = None
        last_err: Exception | None = None

        def _one(kid: str, variant: str) -> list[dict]:
            rows = _maxkb_hit_test(
                kid,
                variant,
                token=token,
                top_number=per_kb,
            )
            return [_maxkb_item_from_row(row, kid, variant) for row in rows]

        workers = min(8, max(1, len(jobs)))
        with ThreadPoolExecutor(max_workers=workers) as pool:
            future_map = {pool.submit(_one, kid, variant): (kid, variant) for kid, variant in jobs}
            for fut in as_completed(future_map):
                try:
                    ranked_lists.append(fut.result())
                except urllib.error.HTTPError as exc:
                    last_http = exc
                except Exception as exc:  # noqa: BLE001 — one (kb, variant) must not drop the lane
                    last_err = exc
        if not ranked_lists:
            if last_http is not None:
                hint = last_http.read().decode("utf-8", errors="replace")[:240]
                return {"items": [], "status": "http_error", "hint": f"{last_http.code} {hint}"}
            if last_err is not None:
                return {"items": [], "status": "error", "hint": str(last_err)}
            return {"items": [], "status": "ok"}
        fused = rrf_fuse(ranked_lists, k=rrf_k)
        boosted = apply_path_title_boosts(fused, intent)
        capped = cap_paragraphs_per_document(boosted, cap=per_doc)
        return {"items": capped[:limit], "status": "ok"}
    except urllib.error.HTTPError as e:
        hint = e.read().decode("utf-8", errors="replace")[:240]
        return {"items": [], "status": "http_error", "hint": f"{e.code} {hint}"}
    except Exception as e:
        return {"items": [], "status": "error", "hint": str(e)}


def search_confluence(q: str, limit: int = 10) -> dict:
    """Legacy Confluence/KMS. Returns {items, status}."""
    qn = (q or "").strip()
    if len(qn) < 2:
        return {"items": [], "status": "empty_query"}
    if not KMS_BASE or not KMS_TOKEN:
        return {
            "items": [],
            "status": "not_configured",
            "hint": "Set GALLERY_KMS_BASE + GALLERY_KMS_TOKEN on demo-gallery to enable",
        }
    try:
        cql = f'text~"{qn}"'
        if KMS_SPACE:
            cql = f'space="{KMS_SPACE}" AND {cql}'
        params = urllib.parse.urlencode(
            {"cql": cql, "limit": str(limit), "expand": "content.space"}
        )
        url = f"{KMS_BASE}/rest/api/content/search?{params}"
        req = urllib.request.Request(
            url,
            headers={
                "Authorization": f"Bearer {KMS_TOKEN}",
                "Accept": "application/json",
            },
        )
        with urllib.request.urlopen(req, timeout=8) as res:
            data = json.loads(res.read().decode("utf-8"))
        items = []
        for row in data.get("results") or []:
            content = row.get("content") or row
            cid = content.get("id")
            title = content.get("title") or ""
            links = content.get("_links") or {}
            webui = links.get("webui") or ""
            base = links.get("base") or KMS_BASE
            items.append(
                {
                    "id": cid,
                    "title": title,
                    "url": f"{base}{webui}" if webui else KMS_BASE,
                    "channel": "knowledge",
                    "reason": "KMS 正文命中",
                }
            )
        return {"items": items, "status": "ok"}
    except urllib.error.HTTPError as e:
        return {"items": [], "status": "http_error", "hint": str(e)}
    except Exception as e:
        return {"items": [], "status": "error", "hint": str(e)}


def search_knowledge(q: str, limit: int = 10) -> dict:
    """Prefer MaxKB; fall back to Confluence only when MaxKB is absent."""
    if MAXKB_BASE or _maxkb_token():
        return search_maxkb(q, limit=limit)
    return search_confluence(retrieve_query(q) or q, limit=limit)



# KnowHow / Feishu wiki (synced pages only)
KH_MCP_URL = os.environ.get("GALLERY_KH_MCP", "").rstrip("/")
KH_MCP_TOKEN = os.environ.get("GALLERY_KH_TOKEN", "").strip()
KH_MCP_FILE = Path(
    os.environ.get("GALLERY_KH_MCP_FILE", "/root/.pi/agent/mcp.json")
)
KH_TOP = int(os.environ.get("GALLERY_KH_TOP", "8") or "8")
_WIKI_TOKEN_RE = re.compile(
    r"(?:feishu\.cn|larksuite\.com|knowhow\.fanruan\.com)/wiki/([A-Za-z0-9]+)",
    re.I,
)


def _strip_html(s: str) -> str:
    text = re.sub(r"<[^>]+>", "", s or "")
    text = (
        text.replace("&nbsp;", " ")
        .replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", '"')
        .replace("&#39;", "'")
    )
    while True:
        nxt = re.sub(r"([\u4e00-\u9fff])\s+([\u4e00-\u9fff])", r"\1\2", text)
        if nxt == text:
            break
        text = nxt
    return re.sub(r"\s+", " ", text).strip()


def _kh_config() -> tuple[str, dict]:
    url = KH_MCP_URL
    headers: dict[str, str] = {}
    if KH_MCP_TOKEN:
        headers["Authorization"] = (
            KH_MCP_TOKEN
            if KH_MCP_TOKEN.lower().startswith("bearer ")
            else f"Bearer {KH_MCP_TOKEN}"
        )
    if url:
        return url, headers
    if KH_MCP_FILE.is_file():
        try:
            cfg = json.loads(KH_MCP_FILE.read_text(encoding="utf-8"))
            kh = (cfg.get("mcpServers") or {}).get("kh") or {}
            url = str(kh.get("url") or "").rstrip("/")
            raw = kh.get("headers") or {}
            if isinstance(raw, dict):
                headers = {str(k): str(v) for k, v in raw.items() if v}
        except Exception:
            return "", {}
    return url, headers


def _parse_mcp_payload(raw: str):
    text = (raw or "").strip()
    if not text:
        return None
    if text.startswith("{"):
        return json.loads(text)
    last = None
    for line in text.splitlines():
        if not line.startswith("data:"):
            continue
        payload = line[5:].strip()
        if not payload or payload == "[DONE]":
            continue
        try:
            obj = json.loads(payload)
        except Exception:
            continue
        if obj and (
            obj.get("result") is not None
            or obj.get("error") is not None
            or obj.get("jsonrpc")
        ):
            last = obj
        elif last is None:
            last = obj
    if last is None:
        raise RuntimeError("empty MCP SSE payload")
    return last


class _KhMcpClient:
    def __init__(self, url: str, headers: dict):
        self.url = url
        self.headers = headers or {}
        self.session_id = None
        self.msg_id = 1

    def _post(self, body: dict, timeout: float = 20):
        hdrs = {
            "Content-Type": "application/json",
            "Accept": "application/json, text/event-stream",
            **self.headers,
        }
        if self.session_id:
            hdrs["Mcp-Session-Id"] = self.session_id
        req = urllib.request.Request(
            self.url,
            data=json.dumps(body).encode("utf-8"),
            headers=hdrs,
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=timeout) as res:
            sid = res.headers.get("mcp-session-id") or res.headers.get("Mcp-Session-Id")
            if sid:
                self.session_id = sid
            raw = res.read().decode("utf-8", errors="replace")
        if body.get("id") is None:
            return None
        return _parse_mcp_payload(raw)

    def _ensure(self) -> None:
        if self.session_id:
            return
        init = self._post(
            {
                "jsonrpc": "2.0",
                "id": self.msg_id,
                "method": "initialize",
                "params": {
                    "protocolVersion": "2024-11-05",
                    "capabilities": {},
                    "clientInfo": {"name": "demo-gallery-feishu", "version": "1.0.0"},
                },
            },
            timeout=15,
        )
        self.msg_id += 1
        if isinstance(init, dict) and init.get("error"):
            raise RuntimeError(init["error"].get("message") or "KH initialize failed")
        self._post({"jsonrpc": "2.0", "method": "notifications/initialized"}, timeout=8)

    def call(self, name: str, args: dict, timeout: float = 20):
        last_err = None
        for _ in range(2):
            try:
                self._ensure()
                res = self._post(
                    {
                        "jsonrpc": "2.0",
                        "id": self.msg_id,
                        "method": "tools/call",
                        "params": {"name": name, "arguments": args or {}},
                    },
                    timeout=timeout,
                )
                self.msg_id += 1
                if isinstance(res, dict) and res.get("error"):
                    raise RuntimeError(res["error"].get("message") or "tools/call error")
                return (res or {}).get("result") if isinstance(res, dict) else res
            except Exception as e:
                last_err = e
                self.session_id = None
        raise last_err  # type: ignore[misc]


def _mcp_structured(result) -> dict:
    if not isinstance(result, dict):
        return {}
    if isinstance(result.get("structuredContent"), dict):
        return result["structuredContent"]
    for block in result.get("content") or []:
        if not isinstance(block, dict) or block.get("type") != "text":
            continue
        text = block.get("text") or ""
        try:
            parsed = json.loads(text)
            return parsed if isinstance(parsed, dict) else {"data": parsed}
        except Exception:
            return {"text": text}
    return result


def _wiki_url(file_url: str, fallback_id: str = "") -> str:
    raw = str(file_url or "")
    match = _WIKI_TOKEN_RE.search(raw)
    if match:
        return f"https://knowhow.fanruan.com/wiki/{match.group(1)}"
    if raw.startswith("http"):
        return raw
    if fallback_id:
        return f"https://knowhow.fanruan.com/wiki/{fallback_id}"
    return "#"


def _is_feishu_row(row: dict) -> bool:
    if row.get("fromFeishu") is True:
        return True
    url = str(row.get("fileUrl") or row.get("url") or "")
    if "feishu.cn/wiki/" in url or "larksuite.com/wiki/" in url:
        return True
    if row.get("type") == 20 and "/wiki/" in url:
        return True
    return False


_TERM_RE = re.compile(r"[A-Za-z]{2,}|\d{2,}|[一-龥]{2,}")
_STOP = {"什么", "怎么", "如何", "怎样", "相关", "一下", "这个", "文档"}


def _query_terms(q: str) -> list[str]:
    terms: list[str] = []
    seen: set[str] = set()
    for token in _TERM_RE.findall(q or ""):
        key = token.lower()
        if token in _STOP or key in _STOP or key in seen:
            continue
        seen.add(key)
        terms.append(token)
    return terms


def _split_chunks(text: str, max_len: int = 220) -> list[str]:
    raw = re.sub(r"[ \t]+", " ", text or "").strip()
    if not raw:
        return []
    parts = [p.strip() for p in re.split(r"\n+|。|！|？", raw) if len(p.strip()) >= 8]
    chunks: list[str] = []
    buf = ""
    for part in parts:
        cand = f"{buf}{part}。" if buf else part
        if len(cand) <= max_len:
            buf = cand
            continue
        if buf:
            chunks.append(buf[:max_len])
        if len(part) <= max_len:
            buf = part
        else:
            step = max(max_len - 30, 80)
            for i in range(0, len(part), step):
                chunks.append(part[i : i + max_len])
            buf = ""
    if buf:
        chunks.append(buf[:max_len])
    return chunks or [raw[:max_len]]


def _best_chunk(query: str, text: str, max_len: int = 220) -> tuple[str, float]:
    chunks = _split_chunks(text, max_len)
    if not chunks:
        return "", 0.0
    qn = re.sub(r"\s+", "", (query or "").lower())
    terms = _query_terms(query)
    best, best_score = chunks[0], -1.0
    for chunk in chunks:
        low = chunk.lower()
        compact = re.sub(r"\s+", "", low)
        score = 0.0
        if qn and qn in compact:
            score += 8.0
        for term in terms:
            if term.lower() in low:
                score += min(len(term), 6) * 0.35
        if score > best_score:
            best, best_score = chunk, score
    return best, best_score


def _file_details(client: _KhMcpClient, file_id: str) -> str:
    result = client.call("get_file_details", {"file_id": file_id}, timeout=15)
    payload = _mcp_structured(result)
    data = payload.get("data") if isinstance(payload.get("data"), dict) else payload
    if not isinstance(data, dict):
        return ""
    return _strip_html(str(data.get("details") or data.get("content") or ""))


def search_feishu(q: str, limit: int = 8) -> dict:
    """KnowHow search_files → Feishu wiki, then local semantic chunks from details."""
    qn = (q or "").strip()
    if len(qn) < 2:
        return {"items": [], "status": "empty_query"}
    url, headers = _kh_config()
    if not url:
        return {
            "items": [],
            "status": "not_configured",
            "hint": "Set GALLERY_KH_MCP or /root/.pi/agent/mcp.json kh",
        }
    try:
        client = _KhMcpClient(url, headers)
        scan = max(limit * 5, KH_TOP, 40)
        result = client.call(
            "search_files",
            {"key": qn, "size": scan, "current": 1},
            timeout=25,
        )
        payload = _mcp_structured(result)
        data = payload.get("data") if isinstance(payload.get("data"), dict) else payload
        rows = []
        if isinstance(data, dict):
            rows = data.get("files") or data.get("records") or data.get("items") or []
        feishu_rows = [row for row in rows if isinstance(row, dict) and _is_feishu_row(row)]
        filled = 0
        for row in feishu_rows:
            body = _strip_html(str(row.get("details") or row.get("snippet") or ""))
            if len(body) >= 16:
                continue
            file_id = str(row.get("id") or "").strip()
            if not file_id:
                continue
            try:
                extra = _file_details(client, file_id)
            except Exception:
                extra = ""
            if extra:
                row["details"] = extra
            filled += 1
            if filled >= 4:
                break
        items = []
        for row in feishu_rows:
            title = _strip_html(str(row.get("name") or row.get("title") or "飞书文档"))
            details = _strip_html(str(row.get("details") or row.get("snippet") or ""))
            snippet, chunk_score = _best_chunk(qn, details or title)
            file_url = str(row.get("fileUrl") or row.get("url") or "")
            space = _strip_html(str(row.get("companyName") or ""))
            creator = _strip_html(str(row.get("creator") or ""))
            reason_bits = ["飞书 · KnowHow"]
            if chunk_score > 0:
                reason_bits.append("语义分片")
            if space:
                reason_bits.append(space)
            items.append(
                {
                    "id": str(row.get("id") or ""),
                    "title": title or "飞书文档",
                    "snippet": (snippet or details)[:220],
                    "url": _wiki_url(file_url, str(row.get("id") or "")),
                    "space": space,
                    "creator": creator,
                    "channel": "feishu",
                    "reason": " · ".join(reason_bits),
                    "internal": True,
                    "chunk_score": chunk_score,
                }
            )
        items.sort(key=lambda it: float(it.get("chunk_score") or 0), reverse=True)
        return {"items": items[:limit], "status": "ok"}
    except urllib.error.HTTPError as e:
        hint = e.read().decode("utf-8", errors="replace")[:240]
        return {"items": [], "status": "http_error", "hint": f"{e.code} {hint}"}
    except Exception as e:
        return {"items": [], "status": "error", "hint": str(e)}


def _emit_fed(on_progress, step: str, status: str, **extra) -> None:
    if not callable(on_progress):
        return
    labels = {
        "demos": "展览馆案例",
        "feedback": "会后反馈",
        "knowledge": "知识库",
        "feishu": "飞书 / KnowHow",
    }
    payload = {
        "step": step,
        "channel": extra.pop("channel", None) or step,
        "label": extra.pop("label", None) or labels.get(step, step),
        "status": status,
    }
    payload.update(extra)
    try:
        on_progress(payload)
    except Exception:
        pass


def _call_with_timeout(fn, timeout: float):
    """Run fn() on a daemon thread; raise TimeoutError if it exceeds `timeout`."""
    box: dict = {}

    def target() -> None:
        try:
            box["value"] = fn()
        except Exception as exc:  # noqa: BLE001 — isolate channel failures
            box["error"] = exc

    worker = threading.Thread(target=target, daemon=True)
    worker.start()
    worker.join(timeout)
    if "value" in box:
        return box["value"]
    if "error" in box:
        raise box["error"]
    raise TimeoutError(f"exceeded {timeout:g}s")


def _normalize_feedback(raw) -> tuple[list, str | None]:
    if raw is None:
        return [], None
    if isinstance(raw, dict) and raw.get("error"):
        return [], str(raw.get("error"))
    if not isinstance(raw, list):
        return [], f"unexpected feedback payload: {type(raw).__name__}"
    items = [x for x in raw if isinstance(x, dict) and "error" not in x]
    err = next((x.get("error") for x in raw if isinstance(x, dict) and "error" in x), None)
    return items, err


def _normalize_knowledge_like(raw, *, empty_status: str = "empty") -> dict:
    if isinstance(raw, dict):
        items = raw.get("items") if isinstance(raw.get("items"), list) else []
        status = raw.get("status") or (empty_status if not items else "ok")
        return {"items": items, "status": status, "hint": raw.get("hint")}
    if isinstance(raw, list):
        return {"items": raw, "status": "ok" if raw else empty_status, "hint": None}
    return {"items": [], "status": "error", "hint": f"unexpected payload: {type(raw).__name__}"}


def _finish_channel(on_progress, name: str, status: str, hits: int, hint: str | None = None) -> None:
    extra = {"hits": hits, "channel": name}
    if hint:
        extra["hint"] = hint
    _emit_fed(on_progress, name, status, **extra)


def federated_search(q: str, on_progress=None) -> dict:
    retrieve = retrieve_query(q) or (q or "").strip()

    def run_demos():
        return search_demos(q)

    def run_feedback():
        return search_feedback(q)

    def run_knowledge():
        # Pass the raw user query so MaxKB expansion / intent see tails like 怎么讲.
        return search_knowledge(q)

    def run_feishu():
        return search_feishu(retrieve)

    runners = {
        "demos": run_demos,
        "feedback": run_feedback,
        "knowledge": run_knowledge,
        "feishu": run_feishu,
    }

    raw: dict[str, object] = {}
    channel_errors: dict[str, str] = {}
    demos: list = []
    feedback_items: list = []
    feedback_error: str | None = None
    knowledge = {"items": [], "status": "empty", "hint": None}
    feishu = {"items": [], "status": "empty", "hint": None}

    def accept(name: str, value, err: str | None) -> None:
        nonlocal demos, feedback_items, feedback_error, knowledge, feishu
        raw[name] = value
        if err:
            channel_errors[name] = err
        if name == "demos":
            demos = value if isinstance(value, list) else []
            if err:
                _finish_channel(on_progress, "demos", "error", len(demos), err)
            else:
                _finish_channel(on_progress, "demos", "done" if demos else "empty", len(demos))
            return
        if name == "feedback":
            feedback_items, parsed_err = _normalize_feedback(value)
            feedback_error = err or parsed_err
            if feedback_error:
                _finish_channel(
                    on_progress, "feedback", "error", len(feedback_items), str(feedback_error)
                )
            else:
                _finish_channel(
                    on_progress,
                    "feedback",
                    "done" if feedback_items else "empty",
                    len(feedback_items),
                )
            return
        packed = (
            {
                "items": [],
                "status": "timeout" if err.startswith("timeout") else "error",
                "hint": err,
            }
            if err
            else _normalize_knowledge_like(value)
        )
        items = packed.get("items") or []
        status = packed.get("status")
        if name == "knowledge":
            knowledge = packed
        else:
            feishu = packed
        if status and status not in {"ok", "empty"}:
            _finish_channel(on_progress, name, "error", len(items), str(packed.get("hint") or status))
        else:
            _finish_channel(on_progress, name, "done" if items else "empty", len(items))

    for name in _FED_CHANNELS:
        _emit_fed(on_progress, name, "run", channel=name)

    max_workers = min(len(runners), 4)
    with ThreadPoolExecutor(max_workers=max_workers) as pool:
        future_map = {
            pool.submit(_call_with_timeout, fn, federation_timeout(name)): name
            for name, fn in runners.items()
        }
        for fut in as_completed(future_map):
            name = future_map[fut]
            try:
                accept(name, fut.result(), None)
            except TimeoutError as exc:
                accept(name, None, f"timeout: {exc}")
            except Exception as exc:  # noqa: BLE001 — keep other channels
                accept(name, None, str(exc))

    from gallery_brief import build_gallery_brief

    payload = {
        "ok": True,
        "query": q,
        "demos": demos,
        "feedback": feedback_items,
        "knowledge": knowledge.get("items") or [],
        "feishu": feishu.get("items") or [],
        "meta": {
            "feedback_db": str(FEEDBACK_DB),
            "feedback_available": FEEDBACK_DB.is_file(),
            "feedback_error": feedback_error,
            "knowledge_status": knowledge.get("status"),
            "knowledge_hint": knowledge.get("hint"),
            "knowledge_backend": "maxkb"
            if (MAXKB_BASE or _maxkb_token())
            else ("confluence" if KMS_BASE else "none"),
            "feishu_status": feishu.get("status"),
            "feishu_hint": feishu.get("hint"),
            "feishu_backend": "knowhow_search_files+local_chunks",
        },
    }
    try:
        payload["briefing"] = build_gallery_brief(q, payload)
    except Exception as exc:
        payload["briefing"] = {
            "stance": f"「{q}」全库已查完",
            "talk": [],
            "demos": [],
            "coverage": [],
            "share": [],
            "internal": [],
            "redlines": [str(exc.__class__.__name__)],
        }
    return payload
