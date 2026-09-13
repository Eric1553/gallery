#!/usr/bin/env python3
"""从 cover.png 生成流量友好的 WebP：
  cover.webp  1600x1000  详情预览
  thumb.webp   800x500   列表/精选卡片（默认加载）
"""

from __future__ import annotations

import argparse
import json
import subprocess
import tempfile
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
CATALOG = ROOT / "catalog.json"
COVERS = ROOT / "covers"
SSH_KEY = Path("/Users/lorin/Documents/ECS服务器/eric.pem")
ECS_HOST = "120.55.184.234"
ECS_USER = "root"

THUMB_W, THUMB_H = 800, 500
COVER_W, COVER_H = 1600, 1000


def sources() -> list[tuple[str, Path]]:
    items = []
    if COVERS.is_dir():
        for p in sorted(COVERS.glob("*.png")):
            items.append((p.stem, p))
    stage = ROOT / ".stage" / "demos"
    if stage.is_dir():
        for p in sorted(stage.glob("*/cover.png")):
            demo_id = p.parent.name
            if not any(d == demo_id for d, _ in items):
                items.append((demo_id, p))
    return items


def to_webp(src: Path, dest: Path, size: tuple[int, int], quality: int) -> int:
    img = Image.open(src).convert("RGB")
    img = img.resize(size, Image.Resampling.LANCZOS)
    dest.parent.mkdir(parents=True, exist_ok=True)
    img.save(dest, format="WEBP", quality=quality, method=6)
    return dest.stat().st_size


def stamp_catalog(ids: set[str]) -> None:
    data = json.loads(CATALOG.read_text(encoding="utf-8"))
    for d in data.get("demos") or []:
        if d["id"] in ids:
            d["cover"] = "cover.webp"
            d["thumb"] = "thumb.webp"
    meta = data.setdefault("meta", {})
    meta["cover_policy"] = "webp_thumb_800 + cover_1600"
    meta["traffic"] = "cards use thumb.webp; long-cache on static assets"
    CATALOG.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def upload(pack_dir: Path) -> None:
    remote_cmd = (
        "tmpdir=$(mktemp -d); tar -C \"$tmpdir\" -xf -; "
        "for d in \"$tmpdir\"/*; do "
        "  id=$(basename \"$d\"); mkdir -p \"/opt/demos/$id\"; "
        "  cp -f \"$d\"/* \"/opt/demos/$id/\"; "
        "  echo \"optimized -> /opt/demos/$id/\"; "
        "done; rm -rf \"$tmpdir\""
    )
    tar = subprocess.Popen(["tar", "-C", str(pack_dir), "-cf", "-", "."], stdout=subprocess.PIPE)
    ssh = subprocess.run(
        [
            "ssh",
            "-i",
            str(SSH_KEY),
            "-o",
            "IdentitiesOnly=yes",
            f"{ECS_USER}@{ECS_HOST}",
            remote_cmd,
        ],
        stdin=tar.stdout,
        capture_output=True,
        text=True,
        timeout=180,
    )
    tar.wait()
    print(ssh.stdout)
    if ssh.returncode != 0:
        raise SystemExit(ssh.stderr or f"upload failed: {ssh.returncode}")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--upload", action="store_true")
    ap.add_argument("--only", default="")
    args = ap.parse_args()
    only = {x.strip() for x in args.only.split(",") if x.strip()} or None

    out_root = ROOT / "covers" / "webp"
    pack = Path(tempfile.mkdtemp(prefix="cover-opt-"))
    done: set[str] = set()
    total_png = 0
    total_thumb = 0

    for demo_id, src in sources():
        if only and demo_id not in only:
            continue
        png_kb = src.stat().st_size
        total_png += png_kb
        cover_path = out_root / demo_id / "cover.webp"
        thumb_path = out_root / demo_id / "thumb.webp"
        csz = to_webp(src, cover_path, (COVER_W, COVER_H), quality=78)
        tsz = to_webp(src, thumb_path, (THUMB_W, THUMB_H), quality=70)
        total_thumb += tsz
        dest = pack / demo_id
        dest.mkdir(parents=True)
        (dest / "cover.webp").write_bytes(cover_path.read_bytes())
        (dest / "thumb.webp").write_bytes(thumb_path.read_bytes())
        # keep png as archival master on server too (optional small traffic if unused)
        done.add(demo_id)
        print(
            f"✓ {demo_id}: png {png_kb // 1024}KB → "
            f"cover.webp {csz // 1024}KB · thumb.webp {tsz // 1024}KB"
        )

    stamp_catalog(done)
    print(
        f"summary: {len(done)} demos · card traffic ~{total_thumb // 1024}KB "
        f"(was png ~{total_png // 1024}KB if loaded full)"
    )

    if args.upload and done:
        print("upload webp ...")
        upload(pack)
        # also push catalog
        subprocess.run(
            [
                "scp",
                "-i",
                str(SSH_KEY),
                "-o",
                "IdentitiesOnly=yes",
                str(CATALOG),
                f"{ECS_USER}@{ECS_HOST}:/opt/demo-gallery/catalog.json",
            ],
            check=True,
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
