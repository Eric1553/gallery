#!/usr/bin/env python3
"""精选情报基线策略：所有演示包共用的唯一实现。

单一事实来源在 scripts/intel_baseline.py，由 scripts/sync_baseline_policy.py
分发到每个演示包目录（与 server.py 同级）。请勿在演示包内单独修改本文件。

要解决的事故：
1. MOSS 只回来 3 条时，旧逻辑把 demo-packs.json 直接覆盖，客户内网断网演示
   看到的就是这 3 条，精选基线被永久毁掉；
2. 实时结果稀疏时首页「今日关注」为空，看板像坏了。

策略：
- demo-packs.json 是**精选基线，运行时只读**，任何刷新都不再改写它；
- MOSS 刷新成功时，实时条目排在前面，若某时段条数少于基线则用基线补齐，
  补进来的条目带 from_baseline 标记，前端可据此标注「基线」；
- 实时结果原样另存 last-moss-refresh.json，仅用于排查，不参与回退。
"""

from __future__ import annotations

import copy
import json
import re
from datetime import datetime, timedelta, timezone
from pathlib import Path

BASELINE_POLICY_VERSION = "baseline-v1-20260729"

SLOT_KEYS = ("morning", "noon", "evening")
BASELINE_FILENAME = "demo-packs.json"
SNAPSHOT_FILENAME = "last-moss-refresh.json"
TZ_SH = timezone(timedelta(hours=8))

_SEP_RE = re.compile(r"[\s\u3000·・…．.。、,，\-—_~*|/\\]+")


def now_iso() -> str:
    return datetime.now(TZ_SH).isoformat(timespec="seconds")


def title_key(item: dict) -> str:
    """标题归一化，用于跨基线/实时结果去重。"""
    return _SEP_RE.sub("", str(item.get("title") or ""))[:40]


def read_baseline(root: Path) -> dict:
    """读取精选基线；缺 demo-packs.json 时退回 dashboard-data.js 内联数据。"""
    path = Path(root) / BASELINE_FILENAME
    if path.exists():
        raw = json.loads(path.read_text(encoding="utf-8"))
        return {k: raw[k] for k in SLOT_KEYS if k in raw}

    data_js = Path(root) / "js" / "dashboard-data.js"
    if not data_js.exists():
        raise FileNotFoundError(f"缺少 {BASELINE_FILENAME} 与 js/dashboard-data.js")
    text = data_js.read_text(encoding="utf-8")
    m = re.search(r"window\.DASHBOARD_DATA\s*=\s*", text)
    if not m:
        raise ValueError("dashboard-data.js 里找不到 window.DASHBOARD_DATA")
    body = text[m.end():].strip()
    if body.endswith(";"):
        body = body[:-1]
    data = json.loads(body)
    return {k: data[k] for k in SLOT_KEYS if k in data}


def as_fallback(baseline: dict) -> dict:
    """回退用：只标记「尝试刷新时间」，不改写 generated_at，避免伪装实时。"""
    refreshed = now_iso()
    packs: dict = {}
    for key, pack in baseline.items():
        item = copy.deepcopy(pack)
        item["client_refreshed_at"] = refreshed
        item["content_stale"] = True
        item["source"] = "local_fallback"
        packs[key] = item
    return packs


def slot_counts(packs: dict) -> dict:
    return {k: len(((packs.get(k) or {}).get("items") or [])) for k in SLOT_KEYS}


def merge_live_with_baseline(packs: dict, baseline: dict) -> int:
    """实时条目在前，条数不足基线时用基线补齐。返回补入条数。

    以基线条数为下限，保证刷新后看板不会比断网时更空。
    """
    filled = 0
    for slot in SLOT_KEYS:
        live_pack = packs.get(slot)
        if not isinstance(live_pack, dict):
            continue
        base_items = ((baseline.get(slot) or {}).get("items") or [])
        items = list(live_pack.get("items") or [])
        if len(items) >= len(base_items):
            continue
        seen = {title_key(i) for i in items}
        for base_item in base_items:
            if len(items) >= len(base_items):
                break
            key = title_key(base_item)
            if not key or key in seen:
                continue
            item = copy.deepcopy(base_item)
            item["from_baseline"] = True
            item["content_stale"] = True
            items.append(item)
            seen.add(key)
            filled += 1
        live_pack["items"] = items
        if "item_count" in live_pack:
            live_pack["item_count"] = len(items)
    return filled


def total_items(packs: dict) -> int:
    return sum(len(((packs.get(k) or {}).get("items") or [])) for k in SLOT_KEYS)


def snapshot_live(root: Path, body: dict) -> None:
    """实时结果另存，只用于排查；绝不触碰 demo-packs.json。"""
    try:
        out = {
            "saved_at": now_iso(),
            "mode": body.get("mode"),
            "item_count": body.get("item_count"),
            "errors": body.get("errors") or [],
            "packs": {k: body["packs"][k] for k in SLOT_KEYS if k in (body.get("packs") or {})},
        }
        (Path(root) / SNAPSHOT_FILENAME).write_text(
            json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8"
        )
    except Exception as exc:  # noqa: BLE001
        print(f"[baseline] 实时快照写入失败（不影响演示）：{exc}", flush=True)


def apply_live_policy(root: Path, body: dict) -> dict:
    """MOSS 成功后统一收口：补齐稀疏时段 + 另存快照 + 写清 note。"""
    packs = body.get("packs") or {}
    baseline = read_baseline(root)
    before = slot_counts(packs)
    filled = merge_live_with_baseline(packs, baseline)
    body["item_count"] = total_items(packs)
    body["baseline_filled"] = filled
    body["baseline_policy"] = BASELINE_POLICY_VERSION

    live_note = (
        "MOSS 部分成功。" if body.get("mode") == "moss_partial" else "MOSS 实时检索成功。"
    )
    if filled:
        after = slot_counts(packs)
        detail = " ".join(f"{k}:{before[k]}→{after[k]}" for k in SLOT_KEYS)
        body["note"] = f"{live_note}实时条目偏少，已用精选基线补齐（{detail}）。基线未被改写。"
        print(f"[baseline] 实时补齐 {filled} 条 · {detail} · {now_iso()}", flush=True)
    else:
        body["note"] = f"{live_note}精选基线保持只读。"

    snapshot_live(root, body)
    return body
