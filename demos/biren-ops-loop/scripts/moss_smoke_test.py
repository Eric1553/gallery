#!/usr/bin/env python3
"""经营闭环 v2 · MOSS 实时链路多轮对抗回归。"""

from __future__ import annotations

import json
import sys
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

BASE = "http://127.0.0.1:8770"


def get_json(path: str, timeout: float = 90) -> dict:
    with urllib.request.urlopen(BASE + path, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))


def ok(name: str, cond: bool, detail: str = "") -> None:
    mark = "PASS" if cond else "FAIL"
    print(f"[{mark}] {name}" + (f" · {detail}" if detail else ""))
    if not cond:
        raise SystemExit(1)


def main() -> None:
    print("=== Round A: health / moss status ===")
    h = get_json("/api/health", timeout=5)
    ok("health", h.get("ok") is True, json.dumps(h, ensure_ascii=False))

    st = get_json("/api/moss/status", timeout=20)
    ok("moss_status", st.get("ok") is True and st.get("has_public_opinion_search") is True, json.dumps(st, ensure_ascii=False))

    print("=== Round B: live refresh ===")
    t0 = time.time()
    body = get_json("/api/intel/refresh?force=1", timeout=120)
    ms = int((time.time() - t0) * 1000)
    ok("refresh_ok", body.get("ok") is True, f"mode={body.get('mode')} items={body.get('item_count')} ms={ms}")
    ok("mode_moss", "moss" in str(body.get("mode")), str(body.get("mode")))
    ok("has_items", int(body.get("item_count") or 0) > 0)
    ok("has_focus", len(body.get("external_focus") or []) > 0)
    packs = body.get("packs") or {}
    evening = (packs.get("evening") or {}).get("items") or []
    topics = sorted({i.get("topic_id") for i in evening if i.get("topic_id")})
    ok("topic_diversity", len(topics) >= 4, f"topics={topics}")
    ok("includes_BR-SEN_or_enough", "BR-SEN" in topics or len(topics) >= 4, f"topics={topics}")

    print("=== Round C: cache hit ===")
    t1 = time.time()
    body2 = get_json("/api/intel/refresh", timeout=30)
    ms2 = int((time.time() - t1) * 1000)
    ok("cache_fast", ms2 < 2000, f"ms={ms2}")
    ok("cache_flag", body2.get("cache_hit") is True, f"cache_hit={body2.get('cache_hit')}")

    print("=== Round D: concurrent single-flight ===")
    def one():
        t = time.time()
        b = get_json("/api/intel/refresh?force=1", timeout=120)
        return int((time.time() - t) * 1000), b.get("mode"), b.get("item_count"), b.get("joined_inflight"), b.get("cache_hit")

    # force two overlapping force refreshes — second should join inflight or both succeed
    with ThreadPoolExecutor(2) as ex:
        futs = [ex.submit(one), ex.submit(one)]
        results = [f.result() for f in as_completed(futs)]
    print(" concurrent:", results)
    ok("concurrent_both_ok", all(r[2] and r[2] > 0 for r in results), str(results))

    print("=== Round E: direct moss_live unit ===")
    import moss_live as m

    r = m.refresh_intel_from_moss()
    ok("unit_ok", r.get("ok") is True, f"mode={r.get('mode')} items={r.get('item_count')} errors={r.get('errors')}")
    stats = r.get("topic_stats") or {}
    ok("all_topics_tried", len(stats) == 5, str(stats))
    ok("elapsed_present", isinstance(r.get("elapsed_ms"), int), str(r.get("elapsed_ms")))

    print("\nALL ROUNDS PASSED")


if __name__ == "__main__":
    main()
