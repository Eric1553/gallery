#!/usr/bin/env python3
"""Build search_index.json for DEMO gallery (Phase 1: thicken local index).

Usage:
  python3 scripts/build_search_index.py
  python3 scripts/build_search_index.py --demos-dir /opt/demos
  python3 scripts/build_search_index.py --out search_index.json
"""

from __future__ import annotations

import argparse
import json
import re
import time
from html import unescape
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DOCS = Path.home() / "Documents"
TAG_RE = re.compile(r"<[^>]+>")
SCRIPT_RE = re.compile(r"<script\b[^>]*>.*?</script>", re.I | re.S)
STYLE_RE = re.compile(r"<style\b[^>]*>.*?</style>", re.I | re.S)
HEADING_RE = re.compile(r"<h([1-3])\b[^>]*>(.*?)</h\1>", re.I | re.S)
TITLE_RE = re.compile(r"<title\b[^>]*>(.*?)</title>", re.I | re.S)
ATTR_LABEL_RE = re.compile(
    r"""(?:aria-label|data-label|data-title|title|placeholder)\s*=\s*["']([^"']{2,40})["']""",
    re.I,
)
NAV_TEXT_RE = re.compile(
    r"<(?:button|a|nav|label|span|div)\b[^>]{0,200}>([^<]{2,24})</(?:button|a|nav|label|span|div)>",
    re.I,
)
WS_RE = re.compile(r"\s+")
# UI chrome — indexing these causes over-broad hits like「关闭/刷新」
NOISE_LABELS = {
    "关闭",
    "详情",
    "刷新",
    "主导航",
    "确定",
    "取消",
    "保存",
    "删除",
    "编辑",
    "更多",
    "菜单",
    "全屏",
    "返回",
    "下一步",
    "上一步",
    "加载中",
    "请稍候",
    "button",
    "close",
    "menu",
    "icon",
    "image",
    "pc 预览 · 经营简报",
}


def clean_text(s: str) -> str:
    s = unescape(TAG_RE.sub(" ", s or ""))
    s = WS_RE.sub(" ", s).strip()
    return s


def is_noise_label(t: str) -> bool:
    s = (t or "").strip()
    if not s or len(s) <= 1:
        return True
    if s.lower() in NOISE_LABELS or s in NOISE_LABELS:
        return True
    if s.startswith("PC 预览"):
        return True
    if re.fullmatch(r"[\d\s%.,/：:\-—]+", s):
        return True
    return False


def extract_from_html(html: str) -> dict:
    html = SCRIPT_RE.sub(" ", html)
    html = STYLE_RE.sub(" ", html)
    title = ""
    m = TITLE_RE.search(html)
    if m:
        title = clean_text(m.group(1))

    headings: list[str] = []
    for hm in HEADING_RE.finditer(html):
        t = clean_text(hm.group(2))
        if t and t not in headings and len(t) <= 40 and not is_noise_label(t):
            headings.append(t)

    labels: list[str] = []
    for am in ATTR_LABEL_RE.finditer(html):
        t = clean_text(am.group(1))
        if is_noise_label(t) or t in labels:
            continue
        labels.append(t)

    # short UI strings (nav-ish)
    for nm in NAV_TEXT_RE.finditer(html):
        t = clean_text(nm.group(1))
        if is_noise_label(t) or len(t) > 16 or t in labels or t in headings:
            continue
        if t in {"✕", "×", "→", "···"}:
            continue
        labels.append(t)
        if len(labels) >= 40:
            break

    modules = []
    seen = set()
    for t in headings + labels:
        if is_noise_label(t):
            continue
        key = t.lower()
        if key in seen:
            continue
        seen.add(key)
        modules.append({"label": t})
        if len(modules) >= 36:
            break

    keywords = []
    for t in [title, *headings, *[m["label"] for m in modules[:20]]]:
        if t and t not in keywords and not is_noise_label(t):
            keywords.append(t)

    return {
        "page_title": title,
        "modules": modules,
        "keywords": keywords,
    }


def resolve_demo_dir(demo: dict, demos_dir: Path | None) -> Path | None:
    did = demo.get("id") or ""
    if demos_dir:
        p = demos_dir / did
        if p.is_dir():
            return p
    source = demo.get("source") or ""
    if source:
        p = DOCS / source
        if p.is_dir():
            return p
        if p.is_file():
            return p.parent
    return None


def collect_html_files(demo_dir: Path, entry: str) -> list[Path]:
    files: list[Path] = []
    entry_path = demo_dir / entry.lstrip("/")
    if entry_path.is_file():
        files.append(entry_path)
    # a few sibling html pages (cap)
    for p in sorted(demo_dir.rglob("*.html")):
        if p in files:
            continue
        # skip huge vendor/node trees
        parts = {x.lower() for x in p.parts}
        if parts & {"node_modules", ".git", "vendor", "dist", "build"}:
            continue
        files.append(p)
        if len(files) >= 8:
            break
    return files


def build_one(demo: dict, demos_dir: Path | None) -> dict:
    did = demo["id"]
    base = {
        "id": did,
        "title": demo.get("title") or "",
        "client": demo.get("client") or "",
        "aliases": list(
            dict.fromkeys(
                [
                    did,
                    demo.get("client") or "",
                    *(demo.get("tags") or []),
                    demo.get("industry") or "",
                    demo.get("hall") or "",
                ]
            )
        ),
        "summary": demo.get("summary") or "",
        "modules": [],
        "keywords": [],
        "page_titles": [],
        "source_paths": [],
    }
    demo_dir = resolve_demo_dir(demo, demos_dir)
    if not demo_dir:
        # metadata-only fallback
        base["keywords"] = [
            x
            for x in [
                demo.get("title"),
                demo.get("client"),
                demo.get("summary"),
                *(demo.get("tags") or []),
            ]
            if x
        ]
        return base

    entry = demo.get("entry") or "index.html"
    for fp in collect_html_files(demo_dir, entry):
        try:
            html = fp.read_text(encoding="utf-8", errors="ignore")
        except OSError:
            continue
        extracted = extract_from_html(html)
        rel = str(fp.relative_to(demo_dir))
        base["source_paths"].append(rel)
        if extracted["page_title"]:
            base["page_titles"].append(extracted["page_title"])
        for m in extracted["modules"]:
            if m["label"] not in {x["label"] for x in base["modules"]}:
                base["modules"].append(m)
        for k in extracted["keywords"]:
            if k not in base["keywords"]:
                base["keywords"].append(k)

    # keep catalog fields in keyword pool
    for k in [
        demo.get("title"),
        demo.get("client"),
        demo.get("industry"),
        demo.get("type"),
        demo.get("summary"),
        *(demo.get("tags") or []),
        did,
    ]:
        if k and k not in base["keywords"]:
            base["keywords"].append(k)

    base["modules"] = base["modules"][:40]
    base["keywords"] = base["keywords"][:80]
    return base


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--catalog", type=Path, default=ROOT / "catalog.json")
    parser.add_argument("--demos-dir", type=Path, default=None)
    parser.add_argument("--out", type=Path, default=ROOT / "search_index.json")
    args = parser.parse_args()

    catalog = json.loads(args.catalog.read_text(encoding="utf-8"))
    demos = catalog.get("demos") or []
    demos_dir = args.demos_dir
    if demos_dir is None:
        env = Path("/opt/demos")
        demos_dir = env if env.is_dir() else None

    items = []
    missing = []
    for demo in demos:
        if demo.get("archived"):
            continue
        item = build_one(demo, demos_dir)
        items.append(item)
        if not item["source_paths"]:
            missing.append(demo.get("id"))

    payload = {
        "meta": {
            "version": "1",
            "built_at": int(time.time()),
            "demo_count": len(items),
            "missing_html": missing,
            "note": "Phase1 local DEMO body/module index for gallery search",
        },
        "demos": {d["id"]: d for d in items},
    }
    args.out.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(f"wrote {args.out} demos={len(items)} missing_html={len(missing)}")
    if missing[:8]:
        print("missing sample:", ", ".join(missing[:8]))


if __name__ == "__main__":
    main()
