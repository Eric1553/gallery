"""Turn federated gallery hits into the same meeting-card shape as /knowledge/."""

from __future__ import annotations

import os
import sys
from pathlib import Path


def _knowledge_roots() -> list[Path]:
    env = os.environ.get("KNOWLEDGE_ROOT")
    return [
        p
        for p in (
            Path(env) if env else None,
            Path("/opt/demo-runtime/demo-knowledge/current"),
            Path(__file__).resolve().parents[1] / "demo-knowledge",
        )
        if p is not None
    ]


def _load_knowledge():
    for root in _knowledge_roots():
        if not (root / "account.py").is_file() or not (root / "briefing.py").is_file():
            continue
        path = str(root)
        if path not in sys.path:
            sys.path.insert(0, path)
        import account
        import briefing

        return account, briefing
    return None, None


def _item_source(item: dict, *, domain: str, audience: str = "", scope: str = "", path: str = "") -> dict:
    return {
        "title": item.get("title") or item.get("nickname") or "",
        "snippet": item.get("snippet") or item.get("summary") or item.get("body") or item.get("reason") or "",
        "content": item.get("content") or item.get("body") or "",
        "url": item.get("url") or item.get("demo_url") or "",
        "path": path or item.get("path") or item.get("document_name") or "",
        "domain": domain,
        "scope": scope,
        "audience": audience,
        "score": item.get("score") or item.get("chunk_score") or 0,
    }


def _cell(cell_id: str, label: str, items: list, *, empty_note: str) -> dict:
    n = len(items)
    if n >= 2:
        status, note = "have", f"{n} 条"
    elif n == 1:
        status, note = "thin", "仅 1 条，材料偏薄"
    else:
        status, note = "missing", empty_note
    return {"id": cell_id, "label": label, "status": status, "count": n, "note": note}


def build_gallery_brief(query: str, payload: dict) -> dict:
    account_mod, briefing_mod = _load_knowledge()
    demos = list(payload.get("demos") or [])
    feedback = list(payload.get("feedback") or [])
    knowledge = list(payload.get("knowledge") or [])
    feishu = list(payload.get("feishu") or [])

    sources = []
    for item in knowledge:
        sources.append(_item_source(item, domain="semi"))
    for item in feishu:
        sources.append(
            _item_source(
                item,
                domain="kh",
                audience="internal",
                scope="knowhow_feishu_chunk",
                path="飞书/" + str(item.get("title") or ""),
            )
        )
    for item in feedback:
        sources.append(_item_source(item, domain="kms", audience="internal"))

    if account_mod and briefing_mod:
        account = account_mod.resolve_account(query)
        brief = briefing_mod.build_briefing(
            query=query,
            account=account,
            sources=sources,
        )
    else:
        brief = {
            "account": {"name": query, "resolved": False, "peers": []},
            "stance": f"「{query}」全库检索",
            "talk": [],
            "demos": [],
            "coverage": [],
            "share": [],
            "internal": [],
            "redlines": [],
        }

    if demos:
        brief["demos"] = [
            {
                "title": d.get("title") or d.get("id") or "",
                "href": d.get("url") or "",
                "client": d.get("client") or "",
                "audience": "internal" if "内部" in str(d.get("client") or "") else "share",
            }
            for d in demos[:4]
        ]

    coverage = list(brief.get("coverage") or [])
    coverage = [c for c in coverage if c.get("id") != "kms"]
    coverage.insert(
        2,
        _cell("feedback", "会后反馈", feedback, empty_note="这场还没有会后批注"),
    )
    brief["coverage"] = coverage
    brief["feedback_count"] = len(feedback)
    return brief
