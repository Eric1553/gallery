#!/usr/bin/env python3
"""Validate catalog.json contract: fields, audience, family, covers, search index.

Usage:
  python3 scripts/validate_catalog.py
  python3 scripts/validate_catalog.py --root /path/to/gallery

Exit 0 if there are no errors (warnings are allowed). Exit 1 on contract errors.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

REQUIRED_FIELDS = (
    "id",
    "title",
    "client",
    "industry",
    "hall",
    "type",
    "summary",
    "tags",
    "entry",
    "source",
)
AUDIENCES = {"client", "internal"}
HALLS = {"ceo", "ops", "poc", "platform", "misc"}
TAG_COUNT = 4

# Frontend isInternal() fallback: client === 内部 / 帆软 / 横向, plus known ids.
INTERNAL_IDS = {
    "fde-carousel",
    "jiandaoyun-carousel",
    "ammo-finance",
    "ammo-unified-v10",
    "ammo-search",
    "poc-mindmap",
    "visit-board",
    "finance-qc-arch",
    "kms-semi",
}
# Customer demos that happen to use 简道云 / 帆软 shells — stay client.
CLIENT_OVERRIDE_IDS = {
    "jiangyuan-rd-pm",
}

# Intentionally uncatalogued demo dirs (warn-only). Empty: biren-finance__rev1/2/3
# are archived catalog stubs (family=biren-finance, archived=true, is_latest=false).
KNOWN_ORPHAN_DIRS: set[str] = set()


def infer_audience(demo: dict) -> str:
    """Mirror gallery.js isInternal() plus known internal ids."""
    did = str(demo.get("id") or "").strip()
    if did in CLIENT_OVERRIDE_IDS:
        return "client"
    explicit = demo.get("audience")
    if explicit in AUDIENCES:
        return explicit
    if did in INTERNAL_IDS:
        return "internal"
    client = str(demo.get("client") or "")
    if client == "内部" or client == "帆软 / 横向" or client.startswith("帆软"):
        return "internal"
    return "client"


def is_latest_pool(demo: dict) -> bool:
    return demo.get("archived") is not True and demo.get("is_latest") is not False


def _looks_historical(demo_id: str) -> bool:
    if demo_id.endswith("__baseline"):
        return True
    if "__rev" in demo_id:
        return True
    return False


def validate(root: Path | None = None) -> tuple[list[str], list[str]]:
    root = (root or Path(__file__).resolve().parents[1]).resolve()
    catalog_path = root / "catalog.json"
    index_path = root / "search_index.json"
    demos_root = root / "demos"

    errors: list[str] = []
    warnings: list[str] = []

    try:
        catalog = json.loads(catalog_path.read_text(encoding="utf-8"))
    except Exception as exc:
        return [f"catalog.json is not valid JSON: {exc}"], []

    demos = catalog.get("demos")
    if not isinstance(demos, list) or not demos:
        return ["catalog.json missing non-empty demos list"], []

    seen_ids: set[str] = set()
    families: dict[str, list[dict]] = {}

    for i, demo in enumerate(demos):
        loc = f"demos[{i}]"
        if not isinstance(demo, dict):
            errors.append(f"{loc}: not an object")
            continue
        did = str(demo.get("id") or "").strip()
        loc = f"{did or loc}"

        missing = [f for f in REQUIRED_FIELDS if not str(demo.get(f) or "").strip() and demo.get(f) != 0]
        if demo.get("tags") is None:
            missing.append("tags")
        if missing:
            errors.append(f"{loc}: missing required fields: {', '.join(missing)}")

        if not did:
            continue
        if did in seen_ids:
            errors.append(f"{loc}: duplicate catalog id")
        seen_ids.add(did)

        tags = demo.get("tags")
        if not isinstance(tags, list) or len(tags) != TAG_COUNT:
            errors.append(f"{loc}: tags length must be exactly {TAG_COUNT}, got {tags!r}")
        elif any(not str(t).strip() for t in tags):
            errors.append(f"{loc}: tags must be four non-empty strings")

        audience = demo.get("audience")
        if audience not in AUDIENCES:
            errors.append(
                f"{loc}: audience must be explicit client|internal, got {audience!r}"
            )
        else:
            expected = infer_audience({**demo, "audience": None})
            if audience != expected:
                errors.append(
                    f"{loc}: audience={audience!r} disagrees with heuristic ({expected})"
                )

        hall = demo.get("hall")
        if hall and hall not in HALLS:
            errors.append(f"{loc}: unknown hall {hall!r}")

        fam = demo.get("family")
        if fam:
            families.setdefault(str(fam), []).append(demo)
            if demo.get("archived") is True and demo.get("is_latest") is True:
                errors.append(
                    f"{loc}: family={fam}: archived=true cannot combine with is_latest=true"
                )

        if _looks_historical(did) and is_latest_pool(demo):
            errors.append(
                f"{loc}: historical id must be archived or is_latest=false "
                "(keep out of default latest pool)"
            )

        archived = demo.get("archived") is True or demo.get("is_latest") is False
        demo_dir = demos_root / did
        entry = str(demo.get("entry") or "index.html").lstrip("/")
        thumb = str(demo.get("thumb") or "thumb.webp").lstrip("/")

        if archived:
            if not (demo_dir / entry).is_file():
                warnings.append(f"{loc}: archived demo missing entry {entry}")
            if not (demo_dir / thumb).is_file():
                warnings.append(f"{loc}: archived demo missing thumb {thumb}")
            continue

        if not demo_dir.is_dir():
            errors.append(f"{loc}: demos/{did}/ directory missing")
            continue
        if not (demo_dir / entry).is_file():
            errors.append(f"{loc}: entry file missing: demos/{did}/{entry}")
        if not (demo_dir / thumb).is_file():
            errors.append(f"{loc}: thumb missing for non-archived demo: demos/{did}/{thumb}")

        if audience == "internal" and demo.get("featured") is True:
            errors.append(
                f"{loc}: internal demo must not be featured as a customer card"
            )

    for fam, members in families.items():
        latest = [d["id"] for d in members if is_latest_pool(d)]
        if not latest:
            warnings.append(f"family {fam}: no member in the default latest pool")

    if index_path.is_file():
        try:
            index = json.loads(index_path.read_text(encoding="utf-8"))
        except Exception as exc:
            errors.append(f"search_index.json is not valid JSON: {exc}")
            index = {}
        indexed = set((index.get("demos") or {}).keys())
        live_ids = {d["id"] for d in demos if isinstance(d, dict) and d.get("id") and is_latest_pool(d)}
        missing_idx = sorted(live_ids - indexed)
        if missing_idx:
            errors.append(
                "search_index.json missing non-archived catalog ids: "
                + ", ".join(missing_idx)
                + " (rebuild with python3 scripts/build_search_index.py --demos-dir demos)"
            )
        extra = sorted(indexed - {d["id"] for d in demos if isinstance(d, dict) and d.get("id")})
        if extra:
            warnings.append("search_index.json has ids not in catalog: " + ", ".join(extra))
    else:
        errors.append("search_index.json missing")

    if demos_root.is_dir():
        on_disk = {p.name for p in demos_root.iterdir() if p.is_dir() and not p.name.startswith(".")}
        orphans = sorted(on_disk - seen_ids)
        for name in orphans:
            if name in KNOWN_ORPHAN_DIRS:
                warnings.append(
                    f"uncatalogued orphan demos/{name}/ "
                    "(known historical tree; warn-only, not in latest pool)"
                )
            else:
                warnings.append(f"uncatalogued directory demos/{name}/")

    return errors, warnings


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=None, help="Gallery repo root")
    args = parser.parse_args(argv)
    errors, warnings = validate(args.root)
    for w in warnings:
        print(f"WARN  {w}")
    for e in errors:
        print(f"ERROR {e}")
    if errors:
        print(f"validate_catalog: {len(errors)} error(s), {len(warnings)} warning(s)")
        return 1
    print(f"validate_catalog: ok ({len(warnings)} warning(s))")
    return 0


if __name__ == "__main__":
    sys.exit(main())
