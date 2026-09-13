"""Canonical Presales Brief v1 — load, validate, and project.

Gallery / Knowledge / Ammo map into this shape. See docs/PRESALES-BRIEF.md.
Knowledge and ammo packages are optional; adapters never import them at
module level (same KNOWLEDGE_ROOT tolerance as gallery_brief.py).
"""

from __future__ import annotations

import json
import re
import unicodedata
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parent
SCHEMA_PATH = ROOT / "schemas" / "presales_brief.v1.json"
CATALOG_PATH = ROOT / "catalog.json"
SCHEMA_VERSION = "1"
STATUSES = frozenset({"draft", "ready", "archived"})
QUESTION_TAILS = ("怎么讲", "怎么比", "怎么说", "如何讲", "怎样讲", "怎么演示")

_DEMO_URL_RE = re.compile(r"/demos/([^/]+)/?")


class PresalesBriefError(ValueError):
    """Raised when a brief fails validation."""

    def __init__(self, errors: list[str]):
        self.errors = list(errors)
        super().__init__("; ".join(self.errors) if self.errors else "invalid brief")


def utc_now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def load_schema() -> dict:
    return json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))


def load_catalog(path: Path | None = None) -> dict:
    target = path or CATALOG_PATH
    if not target.is_file():
        return {}
    try:
        data = json.loads(target.read_text(encoding="utf-8"))
    except Exception:
        return {}
    return data if isinstance(data, dict) else {}


def catalog_demos_by_id(catalog: dict | None = None) -> dict[str, dict]:
    data = catalog if isinstance(catalog, dict) else load_catalog()
    out: dict[str, dict] = {}
    for row in data.get("demos") or []:
        if isinstance(row, dict) and row.get("id"):
            out[str(row["id"])] = row
    return out


def strip_question_tail(query: str) -> str:
    text = (query or "").strip()
    for tail in QUESTION_TAILS:
        if text.endswith(tail):
            return text[: -len(tail)].strip(" 　,，")
    return text


def slugify_brief_id(text: str) -> str:
    raw = strip_question_tail(text) or (text or "").strip() or "untitled"
    folded = []
    for ch in raw:
        cat = unicodedata.category(ch)
        if ch.isalnum() or ("\u4e00" <= ch <= "\u9fff") or ch in "-_":
            folded.append(ch.lower() if ch.isascii() else ch)
        elif cat.startswith("Z") or ch in "·/&+":
            folded.append("-")
    slug = re.sub(r"-{2,}", "-", "".join(folded)).strip("-")
    return (slug[:64] or "untitled")


def _as_dict(value: Any) -> dict:
    return dict(value) if isinstance(value, dict) else {}


def _as_str(value: Any) -> str:
    if value is None:
        return ""
    return str(value).strip()


def _as_bool(value: Any, default: bool = False) -> bool:
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return bool(value)
    text = str(value).strip().lower()
    if text in {"1", "true", "yes", "y", "on"}:
        return True
    if text in {"0", "false", "no", "n", "off", ""}:
        return False
    return default


def _as_list(value: Any) -> list:
    if value is None:
        return []
    if isinstance(value, list):
        return list(value)
    return [value]


def empty_brief(*, query: str = "", owner: str = "") -> dict:
    subject = strip_question_tail(query)
    return {
        "meta": {
            "schema_version": SCHEMA_VERSION,
            "brief_id": f"psb-{slugify_brief_id(subject or 'untitled')}",
            "updated_at": utc_now(),
            "owner": owner,
            "status": "draft",
        },
        "customer": {
            "name": subject,
            "short_name": "",
            "industry": "",
            "audience_notes": "",
        },
        "visit": {
            "date": None,
            "goal": "",
            "narrative": f"「{subject}」全库检索" if subject else "",
            "red_lines": [],
            "shareability": {"external": [], "internal_only": []},
        },
        "demos": [],
        "talking_points": [],
        "materials": {"knowledge": [], "ammo_pack_ids": [], "links": []},
        "gaps": [],
        "provenance": {"sources": []},
        "extensions": {},
    }


def _normalize_share_item(item: Any) -> dict:
    if isinstance(item, str):
        return {"title": item.strip(), "snippet": "", "url": ""}
    data = _as_dict(item)
    title = _as_str(data.get("title") or data.get("name") or data.get("text"))
    snippet = _as_str(
        data.get("snippet") or data.get("summary") or data.get("body") or data.get("note")
    )
    url = _as_str(data.get("url") or data.get("href"))
    out = {"title": title, "snippet": snippet, "url": url}
    for key, value in data.items():
        if key not in out:
            out[key] = value
    return out


def _normalize_material(item: Any) -> dict:
    if isinstance(item, str):
        text = item.strip()
        if text.startswith(("http://", "https://", "/")):
            return {"title": text, "url": text, "snippet": "", "ref": ""}
        return {"title": text, "url": "", "snippet": "", "ref": ""}
    data = _as_dict(item)
    out = {
        "title": _as_str(data.get("title") or data.get("name") or data.get("path")),
        "url": _as_str(data.get("url") or data.get("href")),
        "snippet": _as_str(data.get("snippet") or data.get("summary") or data.get("body")),
        "ref": _as_str(data.get("ref") or data.get("id") or data.get("path")),
    }
    for key, value in data.items():
        if key not in out:
            out[key] = value
    return out


def _normalize_gap(item: Any) -> dict:
    if isinstance(item, str):
        return {"id": "", "note": item.strip(), "area": ""}
    data = _as_dict(item)
    return {
        "id": _as_str(data.get("id")),
        "note": _as_str(data.get("note") or data.get("text") or data.get("label")),
        "area": _as_str(data.get("area") or data.get("label")),
    }


def _normalize_red_line(item: Any) -> str:
    if isinstance(item, str):
        return item.strip()
    data = _as_dict(item)
    return _as_str(data.get("text") or data.get("note") or data.get("title"))


def _normalize_talking_point(item: Any) -> dict:
    if isinstance(item, str):
        return {"title": "", "body": item.strip(), "source": ""}
    data = _as_dict(item)
    title = _as_str(data.get("title") or data.get("kind") or data.get("account_name"))
    body = _as_str(data.get("body") or data.get("text") or data.get("snippet"))
    source = _as_str(data.get("source") or data.get("ref"))
    return {"title": title, "body": body, "source": source}


def _demo_id_from_item(item: dict) -> str:
    did = _as_str(item.get("id"))
    if did:
        return did
    href = _as_str(item.get("url") or item.get("href") or item.get("demo_url"))
    match = _DEMO_URL_RE.search(href)
    return match.group(1) if match else ""


def _normalize_demo(item: Any, catalog_by_id: dict[str, dict] | None = None) -> dict:
    data = _as_dict(item)
    did = _demo_id_from_item(data)
    cat = (catalog_by_id or {}).get(did) or {}
    featured_raw = data.get("featured")
    if featured_raw is None:
        featured_raw = cat.get("featured")
    out = {
        "id": did,
        "title": _as_str(data.get("title") or cat.get("title") or did),
        "hall": _as_str(data.get("hall") or cat.get("hall")),
        "why": _as_str(
            data.get("why")
            or data.get("reason")
            or data.get("summary")
            or data.get("client")
            or cat.get("summary")
        ),
        "featured": _as_bool(featured_raw, False),
    }
    href = _as_str(data.get("url") or data.get("href"))
    if href:
        out["href"] = href
    return out


def _normalize_source(item: Any) -> dict:
    data = _as_dict(item)
    return {"module": _as_str(data.get("module")), "ref": _as_str(data.get("ref"))}


def normalize(data: dict | None, *, query: str = "", owner: str = "") -> dict:
    """Fill defaults, coerce types, keep unknown keys in extensions / extras."""
    raw = _as_dict(data)
    base = empty_brief(query=query or _as_str((_as_dict(raw.get("customer"))).get("name")), owner=owner)
    meta_in = _as_dict(raw.get("meta"))
    customer_in = _as_dict(raw.get("customer"))
    visit_in = _as_dict(raw.get("visit"))
    share_in = _as_dict(visit_in.get("shareability") or raw.get("shareability"))
    materials_in = _as_dict(raw.get("materials"))
    provenance_in = _as_dict(raw.get("provenance"))

    schema_version = meta_in.get("schema_version", SCHEMA_VERSION)
    if schema_version in (1, "1", "v1", "presales_brief.v1", None, ""):
        schema_version = SCHEMA_VERSION
    else:
        schema_version = _as_str(schema_version)

    status = _as_str(meta_in.get("status") or base["meta"]["status"]).lower()
    brief_id = _as_str(meta_in.get("brief_id")) or base["meta"]["brief_id"]
    updated_at = _as_str(meta_in.get("updated_at")) or base["meta"]["updated_at"]

    customer_name = _as_str(customer_in.get("name")) or base["customer"]["name"]
    if isinstance(raw.get("customer"), str):
        customer_name = _as_str(raw.get("customer")) or customer_name

    date_val = visit_in.get("date", raw.get("date"))
    if date_val in ("", False):
        date_val = None
    elif date_val is not None:
        date_val = _as_str(date_val) or None

    catalog_by_id = catalog_demos_by_id()
    demos = [_normalize_demo(d, catalog_by_id) for d in _as_list(raw.get("demos"))]
    demos = [d for d in demos if d.get("id") or d.get("title")]

    out = {
        "meta": {
            "schema_version": schema_version,
            "brief_id": brief_id,
            "updated_at": updated_at,
            "owner": _as_str(meta_in.get("owner") or owner or base["meta"]["owner"]),
            "status": status or "draft",
        },
        "customer": {
            "name": customer_name,
            "short_name": _as_str(customer_in.get("short_name") or raw.get("short_name")),
            "industry": _as_str(customer_in.get("industry") or raw.get("industry")),
            "audience_notes": _as_str(
                customer_in.get("audience_notes")
                or customer_in.get("audience")
                or raw.get("audience_notes")
            ),
        },
        "visit": {
            "date": date_val,
            "goal": _as_str(visit_in.get("goal") or raw.get("goal")),
            "narrative": _as_str(visit_in.get("narrative") or raw.get("narrative") or raw.get("stance")),
            "red_lines": [
                line
                for line in (
                    _normalize_red_line(x)
                    for x in _as_list(visit_in.get("red_lines") or raw.get("red_lines") or raw.get("redlines"))
                )
                if line
            ],
            "shareability": {
                "external": [
                    _normalize_share_item(x)
                    for x in _as_list(share_in.get("external") or raw.get("share"))
                ],
                "internal_only": [
                    _normalize_share_item(x)
                    for x in _as_list(share_in.get("internal_only") or raw.get("internal"))
                ],
            },
        },
        "demos": demos,
        "talking_points": [
            _normalize_talking_point(x)
            for x in _as_list(raw.get("talking_points") or raw.get("talk"))
            if _as_dict(x) or isinstance(x, str)
        ],
        "materials": {
            "knowledge": [
                _normalize_material(x)
                for x in _as_list(materials_in.get("knowledge") or raw.get("knowledge"))
            ],
            "ammo_pack_ids": [
                _as_str(x)
                for x in _as_list(materials_in.get("ammo_pack_ids") or raw.get("ammo_pack_ids"))
                if _as_str(x)
            ],
            "links": [_normalize_material(x) for x in _as_list(materials_in.get("links") or raw.get("links"))],
        },
        "gaps": [_normalize_gap(x) for x in _as_list(raw.get("gaps"))],
        "provenance": {
            "sources": [
                src
                for src in (_normalize_source(x) for x in _as_list(provenance_in.get("sources")))
                if src.get("module")
            ]
        },
        "extensions": _as_dict(raw.get("extensions")),
    }

    reserved = set(out)
    extras = {k: v for k, v in raw.items() if k not in reserved and k not in {"talk", "share", "internal", "redlines", "stance"}}
    if extras:
        out["extensions"].setdefault("passthrough", {}).update(extras)
    return out


def validate(data: dict | None) -> tuple[bool, list[str]]:
    """Stdlib validator (jsonschema is optional and unused)."""
    errors: list[str] = []
    if not isinstance(data, dict):
        return False, ["brief must be an object"]
    brief = normalize(data)
    meta = brief["meta"]
    if meta["schema_version"] != SCHEMA_VERSION:
        errors.append(f"meta.schema_version must be '{SCHEMA_VERSION}'")
    if not meta["brief_id"]:
        errors.append("meta.brief_id is required")
    if meta["status"] not in STATUSES:
        errors.append("meta.status must be draft|ready|archived")
    if not brief["customer"]["name"] and not any(brief["demos"]) and not brief["talking_points"]:
        # empty draft is allowed (API short-query); only flag if status claims ready
        if meta["status"] == "ready":
            errors.append("ready brief needs customer.name or demos or talking_points")
    for i, demo in enumerate(brief["demos"]):
        if not demo.get("title") and not demo.get("id"):
            errors.append(f"demos[{i}] needs id or title")
    for i, point in enumerate(brief["talking_points"]):
        if not point.get("body") and not point.get("title"):
            errors.append(f"talking_points[{i}] needs title or body")
    for i, src in enumerate(brief["provenance"]["sources"]):
        if not src.get("module"):
            errors.append(f"provenance.sources[{i}].module is required")
    return (not errors), errors


def load(source: str | Path | dict) -> dict:
    if isinstance(source, dict):
        data = source
    else:
        data = json.loads(Path(source).read_text(encoding="utf-8"))
        if not isinstance(data, dict):
            raise PresalesBriefError(["file must contain a JSON object"])
    brief = normalize(data)
    ok, errors = validate(brief)
    if not ok:
        raise PresalesBriefError(errors)
    return brief


def _account_to_customer(account: Any) -> dict:
    if account is None:
        return {}
    if not isinstance(account, dict):
        # demo-knowledge Account dataclass (import-tolerant)
        return {
            "name": _as_str(getattr(account, "canonical", None) or getattr(account, "name", None)),
            "short_name": _as_str(getattr(account, "short_name", None) or getattr(account, "legal", None)),
            "industry": _as_str(getattr(account, "industry", None)),
            "resolved": bool(getattr(account, "resolved", False)),
            "peers": list(getattr(account, "peers", None) or []),
            "peer_queries": list(getattr(account, "peer_queries", None) or []),
            "retrieval_query": _as_str(getattr(account, "retrieval_query", None)),
            "legal": _as_str(getattr(account, "legal", None)),
        }
    return {
        "name": _as_str(account.get("name") or account.get("canonical") or account.get("legal")),
        "short_name": _as_str(account.get("short_name") or account.get("legal")),
        "industry": _as_str(account.get("industry")),
        "resolved": bool(account.get("resolved")),
        "peers": list(account.get("peers") or []),
        "peer_queries": list(account.get("peer_queries") or []),
        "retrieval_query": _as_str(account.get("retrieval_query")),
        "legal": _as_str(account.get("legal")),
    }


def from_knowledge_card(card: dict | None) -> dict:
    """Adapter stub: /knowledge/ meeting-card → v1. Safe if knowledge pack is absent."""
    if not card:
        return normalize({})
    inner = card.get("presales_brief")
    if isinstance(inner, dict) and (inner.get("meta") or inner.get("customer") or inner.get("visit")):
        return normalize(inner)
    meta_in = _as_dict(card.get("meta"))
    if _as_str(meta_in.get("schema_version")) in {SCHEMA_VERSION, "v1", "presales_brief.v1"} and "customer" in card:
        return normalize(card)

    account = _account_to_customer(card.get("account"))
    share = [_normalize_share_item(x) for x in _as_list(card.get("share"))]
    internal = [_normalize_share_item(x) for x in _as_list(card.get("internal"))]
    red_lines = [_normalize_red_line(x) for x in _as_list(card.get("redlines") or card.get("red_lines"))]
    talking = []
    for item in _as_list(card.get("talk") or card.get("talking_points")):
        talking.append(_normalize_talking_point(item))
    summary_lines = [_as_str(x) for x in _as_list(card.get("summary")) if _as_str(x)]
    tags = [_as_str(t) for t in _as_list(card.get("tags") or card.get("keywords")) if _as_str(t)]
    gaps = []
    for cell in _as_list(card.get("coverage")):
        cell_d = _as_dict(cell)
        if cell_d.get("status") in {"missing", "thin"}:
            note = _as_str(cell_d.get("note") or cell_d.get("label"))
            if note:
                gaps.append({"id": _as_str(cell_d.get("id")), "note": note, "area": _as_str(cell_d.get("label"))})

    meeting_ext = {
        "account": card.get("account") if isinstance(card.get("account"), dict) else account,
        "tags": tags,
        "keywords": [_as_str(t) for t in _as_list(card.get("keywords")) if _as_str(t)],
        "summary": summary_lines,
        "coverage": list(card.get("coverage") or []),
        "feedback_count": card.get("feedback_count"),
    }

    return normalize(
        {
            "meta": {
                "schema_version": SCHEMA_VERSION,
                "brief_id": _as_str(meta_in.get("brief_id")) or f"psb-{slugify_brief_id(account.get('name') or 'knowledge')}",
                "updated_at": _as_str(meta_in.get("updated_at")) or utc_now(),
                "owner": _as_str(meta_in.get("owner")) or "knowledge",
                "status": _as_str(meta_in.get("status")) or "draft",
            },
            "customer": {
                "name": account.get("name") or "",
                "short_name": account.get("short_name") or account.get("legal") or "",
                "industry": account.get("industry") or "",
                "audience_notes": " · ".join(tags),
            },
            "visit": {
                "narrative": _as_str(card.get("stance") or card.get("narrative")),
                "goal": " ".join(summary_lines),
                "red_lines": [x for x in red_lines if x],
                "shareability": {"external": share, "internal_only": internal},
            },
            "demos": list(card.get("demos") or []),
            "talking_points": talking,
            "materials": {"knowledge": list(card.get("knowledge") or [])},
            "gaps": gaps,
            "provenance": {"sources": [{"module": "knowledge", "ref": "meeting-card"}]},
            "extensions": {"meeting_card": meeting_ext},
        }
    )


def _coverage_gap(cell_id: str, label: str, items: list, empty_note: str) -> dict | None:
    if items:
        if len(items) == 1:
            return {"id": cell_id, "note": "仅 1 条，材料偏薄", "area": label}
        return None
    return {"id": cell_id, "note": empty_note, "area": label}


def from_gallery_federation(
    query: str,
    payload: dict | None,
    *,
    knowledge_card: dict | None = None,
    catalog: dict | None = None,
) -> dict:
    """Build v1 from Gallery federated search (+ optional knowledge meeting-card)."""
    payload = payload if isinstance(payload, dict) else {}
    card = knowledge_card if isinstance(knowledge_card, dict) else None
    if card and card.get("presales_brief") is card:
        card = None
    brief = from_knowledge_card(card) if card else normalize({}, query=query, owner="gallery")

    subject = strip_question_tail(query)
    if not brief["customer"]["name"] and subject:
        brief["customer"]["name"] = subject
    if not brief["meta"].get("owner"):
        brief["meta"]["owner"] = "gallery"
    if brief["meta"]["brief_id"] in {"psb-untitled", "psb-knowledge"} and subject:
        brief["meta"]["brief_id"] = f"psb-{slugify_brief_id(subject)}"

    if not brief["visit"]["narrative"] and query:
        brief["visit"]["narrative"] = f"「{subject or query}」全库检索"

    catalog_by_id = catalog_demos_by_id(catalog)
    fed_demos = [_normalize_demo(d, catalog_by_id) for d in _as_list(payload.get("demos"))]
    fed_demos = [d for d in fed_demos if d.get("id") or d.get("title")]
    if fed_demos:
        brief["demos"] = fed_demos

    knowledge_hits = [_normalize_material(x) for x in _as_list(payload.get("knowledge"))]
    if knowledge_hits:
        seen = {json.dumps(x, ensure_ascii=False, sort_keys=True) for x in brief["materials"]["knowledge"]}
        for hit in knowledge_hits:
            key = json.dumps(hit, ensure_ascii=False, sort_keys=True)
            if key not in seen:
                brief["materials"]["knowledge"].append(hit)
                seen.add(key)
        if not brief["visit"]["shareability"]["external"]:
            brief["visit"]["shareability"]["external"] = [
                {"title": h.get("title") or "", "snippet": h.get("snippet") or "", "url": h.get("url") or ""}
                for h in knowledge_hits
            ]

    internal_items = []
    for item in _as_list(payload.get("feishu")):
        internal_items.append(_normalize_share_item(item))
    for item in _as_list(payload.get("feedback")):
        internal_items.append(_normalize_share_item(item))
    if internal_items and not brief["visit"]["shareability"]["internal_only"]:
        brief["visit"]["shareability"]["internal_only"] = internal_items

    gaps = list(brief.get("gaps") or [])
    for gap in (
        _coverage_gap("knowledge", "知识库", list(payload.get("knowledge") or []), "知识库无命中"),
        _coverage_gap("feishu", "飞书 / KnowHow", list(payload.get("feishu") or []), "这场还没有飞书记要"),
        _coverage_gap("feedback", "会后反馈", list(payload.get("feedback") or []), "这场还没有会后批注"),
        _coverage_gap("demos", "展览馆 DEMO", fed_demos or list(brief.get("demos") or []), "展览馆暂无匹配 DEMO"),
    ):
        if gap and not any(g.get("id") == gap["id"] for g in gaps if isinstance(g, dict)):
            gaps.append(gap)
    brief["gaps"] = gaps

    sources = list(brief["provenance"]["sources"])
    def _add_src(module: str, ref: str) -> None:
        if not any(s.get("module") == module and s.get("ref") == ref for s in sources):
            sources.append({"module": module, "ref": ref})

    _add_src("gallery", "federated_search")
    if catalog_by_id:
        _add_src("catalog", "catalog.json")
    if payload.get("knowledge"):
        _add_src("knowledge", "maxkb-or-kms")
    if payload.get("feishu"):
        _add_src("feishu", "knowhow")
    if payload.get("feedback"):
        _add_src("feedback", "feedback.sqlite")
    if card:
        _add_src("knowledge", "meeting-card")
    brief["provenance"]["sources"] = sources
    return brief


def to_meeting_card(brief: dict | None) -> dict:
    """Project v1 back to the Gallery / Knowledge meeting-card the frontend reads."""
    v1 = normalize(brief)
    ext = _as_dict((_as_dict(v1.get("extensions"))).get("meeting_card"))
    account = _as_dict(ext.get("account"))
    name = v1["customer"]["name"]
    if not account:
        account = {
            "name": name,
            "legal": v1["customer"]["short_name"] or name,
            "industry": v1["customer"]["industry"],
            "resolved": False,
            "peers": [],
        }
    else:
        account.setdefault("name", name)
        account.setdefault("industry", v1["customer"]["industry"])
        account.setdefault("legal", v1["customer"]["short_name"] or name)

    talk = []
    for point in v1["talking_points"]:
        talk.append(
            {
                "kind": point.get("title") or "",
                "text": point.get("body") or "",
                "account_name": name if name else "",
            }
        )

    demos = []
    for demo in v1["demos"]:
        href = _as_str(demo.get("href")) or (f"/demos/{demo['id']}/" if demo.get("id") else "")
        demos.append(
            {
                "title": demo.get("title") or demo.get("id") or "",
                "href": href,
                "client": demo.get("why") or "",
                "audience": "share",
                "id": demo.get("id") or "",
                "hall": demo.get("hall") or "",
            }
        )

    coverage = list(ext.get("coverage") or [])
    if not coverage:
        for gap in v1["gaps"]:
            gap_d = _as_dict(gap) if not isinstance(gap, str) else {"note": gap}
            coverage.append(
                {
                    "id": gap_d.get("id") or "",
                    "label": gap_d.get("area") or gap_d.get("id") or "缺口",
                    "status": "missing" if "无" in (gap_d.get("note") or "") or "还没有" in (gap_d.get("note") or "") else "thin",
                    "count": 0,
                    "note": gap_d.get("note") or "",
                }
            )

    return {
        "account": account,
        "stance": v1["visit"]["narrative"],
        "talk": talk,
        "demos": demos,
        "coverage": coverage,
        "share": v1["visit"]["shareability"]["external"],
        "internal": v1["visit"]["shareability"]["internal_only"],
        "redlines": list(v1["visit"]["red_lines"]),
        "summary": list(ext.get("summary") or ([v1["visit"]["goal"]] if v1["visit"]["goal"] else [])),
        "tags": list(ext.get("tags") or []),
        "keywords": list(ext.get("keywords") or []),
        "feedback_count": ext.get("feedback_count") if ext.get("feedback_count") is not None else 0,
        "presales_brief": v1,
    }


def from_ammo_brief(ammo: dict | None) -> dict:
    """Map data/packs/*/brief.json → v1. Leftover keys go to extensions.ammo."""
    raw = _as_dict(ammo)
    known = {
        "id",
        "brief_id",
        "schema_version",
        "customer",
        "short_name",
        "industry",
        "audience_notes",
        "audience",
        "date",
        "goal",
        "narrative",
        "stance",
        "red_lines",
        "redlines",
        "shareability",
        "share",
        "internal",
        "talking_points",
        "talk",
        "demos",
        "knowledge",
        "ammo_pack_ids",
        "links",
        "materials",
        "gaps",
        "status",
        "owner",
        "updated_at",
        "meta",
        "visit",
        "provenance",
        "extensions",
        "title",
        "pack_id",
    }
    extras = {k: v for k, v in raw.items() if k not in known}

    customer_val = raw.get("customer")
    if isinstance(customer_val, str):
        customer = {
            "name": customer_val,
            "short_name": _as_str(raw.get("short_name")),
            "industry": _as_str(raw.get("industry")),
            "audience_notes": _as_str(raw.get("audience_notes") or raw.get("audience")),
        }
    else:
        customer = _as_dict(customer_val)
        customer.setdefault("short_name", _as_str(raw.get("short_name")))
        customer.setdefault("industry", _as_str(raw.get("industry")))
        customer.setdefault("audience_notes", _as_str(raw.get("audience_notes")))

    materials = _as_dict(raw.get("materials"))
    if raw.get("knowledge") and not materials.get("knowledge"):
        materials["knowledge"] = raw.get("knowledge")
    if raw.get("links") and not materials.get("links"):
        materials["links"] = raw.get("links")
    if raw.get("ammo_pack_ids") and not materials.get("ammo_pack_ids"):
        materials["ammo_pack_ids"] = raw.get("ammo_pack_ids")

    pack_id = _as_str(raw.get("pack_id") or raw.get("id") or raw.get("brief_id"))
    if pack_id and pack_id not in _as_list(materials.get("ammo_pack_ids")):
        materials.setdefault("ammo_pack_ids", [])
        if isinstance(materials["ammo_pack_ids"], list):
            materials["ammo_pack_ids"] = list(materials["ammo_pack_ids"]) + [pack_id]

    if extras:
        extras = dict(extras)
        if raw.get("title") and "title" not in extras:
            extras["title"] = raw.get("title")

    brief = normalize(
        {
            "meta": {
                "schema_version": SCHEMA_VERSION,
                "brief_id": pack_id or f"psb-{slugify_brief_id(customer.get('name') or 'ammo')}",
                "updated_at": _as_str(raw.get("updated_at")) or utc_now(),
                "owner": _as_str(raw.get("owner")) or "ammo",
                "status": _as_str(raw.get("status")) or "draft",
            },
            "customer": customer,
            "visit": {
                "date": raw.get("date"),
                "goal": raw.get("goal"),
                "narrative": raw.get("narrative") or raw.get("stance"),
                "red_lines": raw.get("red_lines") or raw.get("redlines"),
                "shareability": raw.get("shareability")
                or {"external": raw.get("share") or [], "internal_only": raw.get("internal") or []},
            },
            "demos": raw.get("demos") or [],
            "talking_points": raw.get("talking_points") or raw.get("talk") or [],
            "materials": materials,
            "gaps": raw.get("gaps") or [],
            "provenance": {
                "sources": list(_as_dict(raw.get("provenance")).get("sources") or [])
                + [{"module": "ammo", "ref": f"data/packs/{pack_id or 'unknown'}/brief.json"}]
            },
            "extensions": {
                **_as_dict(raw.get("extensions")),
                "ammo": extras,
            },
        }
    )
    return brief


def to_ammo_brief(brief: dict | None) -> dict:
    """Project v1 → ammo pack brief.json. Restores extensions.ammo leftovers."""
    v1 = normalize(brief)
    ammo = {
        "id": v1["meta"]["brief_id"],
        "schema_version": v1["meta"]["schema_version"],
        "status": v1["meta"]["status"],
        "owner": v1["meta"]["owner"],
        "updated_at": v1["meta"]["updated_at"],
        "customer": v1["customer"]["name"],
        "short_name": v1["customer"]["short_name"],
        "industry": v1["customer"]["industry"],
        "audience_notes": v1["customer"]["audience_notes"],
        "date": v1["visit"].get("date"),
        "goal": v1["visit"]["goal"],
        "narrative": v1["visit"]["narrative"],
        "red_lines": list(v1["visit"]["red_lines"]),
        "shareability": {
            "external": list(v1["visit"]["shareability"]["external"]),
            "internal_only": list(v1["visit"]["shareability"]["internal_only"]),
        },
        "talking_points": list(v1["talking_points"]),
        "demos": list(v1["demos"]),
        "knowledge": list(v1["materials"]["knowledge"]),
        "ammo_pack_ids": list(v1["materials"]["ammo_pack_ids"]),
        "links": list(v1["materials"]["links"]),
        "gaps": list(v1["gaps"]),
    }
    extras = _as_dict((_as_dict(v1.get("extensions"))).get("ammo"))
    for key, value in extras.items():
        if key not in ammo:
            ammo[key] = value
    return ammo


def project_gallery(query: str, payload: dict | None, knowledge_card: dict | None = None) -> tuple[dict, dict]:
    """One place for dual-write: meeting-card keys + nested v1."""
    v1 = from_gallery_federation(query, payload, knowledge_card=knowledge_card)
    if knowledge_card:
        card = dict(knowledge_card)
        card.pop("presales_brief", None)
    else:
        card = to_meeting_card(v1)
        card.pop("presales_brief", None)
    card["presales_brief"] = v1
    return card, v1
