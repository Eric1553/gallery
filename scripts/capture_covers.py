#!/usr/bin/env python3
"""为 DEMO 案例库生成统一尺寸主页高清封面（由 Agent 执行，不必使用者手动截）。

统一规格：
  输出 canvas = 1600 x 1000 @2x 等效（最终 PNG 3200x2000 或按 scale）
  桌面 DEMO：整页视口 1600x1000 直出
  移动 DEMO：390x844 截取后居中合成到同一 1600x1000 画布

入库文件：
  /opt/demos/<id>/cover.png
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
import tempfile
from pathlib import Path
from urllib.parse import quote

from PIL import Image, ImageDraw, ImageFilter, ImageEnhance

ROOT = Path(__file__).resolve().parents[1]
CATALOG = ROOT / "catalog.json"
LOCAL_DEMOS = ROOT / ".stage" / "demos"
COVERS = ROOT / "covers"
CHROME = Path("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")
SSH_KEY = Path("/Users/lorin/Documents/ECS服务器/eric.pem")
ECS_HOST = "120.55.184.234"
ECS_USER = "root"

# 所有封面统一画布（展示对齐的关键）
CANVAS_W, CANVAS_H = 1600, 1000
SCALE = 2  # retina
OUT_W, OUT_H = CANVAS_W * SCALE, CANVAS_H * SCALE
DESKTOP_VIEW = (CANVAS_W, CANVAS_H)
MOBILE_VIEW = (390, 844)


def load_demos(only: set[str] | None, include_archived: bool) -> list[dict]:
    data = json.loads(CATALOG.read_text(encoding="utf-8"))
    demos = data.get("demos") or []
    if only:
        demos = [d for d in demos if d["id"] in only]
    if not include_archived:
        demos = [d for d in demos if not (d.get("archived") or d.get("is_latest") is False)]
    return demos


def entry_url(base: str, demo: dict) -> str:
    entry = (demo.get("entry") or "index.html").lstrip("/")
    parts = [quote(p) for p in entry.split("/")]
    return f"{base.rstrip('/')}/demos/{demo['id']}/{'/'.join(parts)}"


def chrome_shot(url: str, out: Path, width: int, height: int, scale: int = SCALE) -> None:
    if not CHROME.is_file():
        raise SystemExit(f"Chrome not found: {CHROME}")
    out.parent.mkdir(parents=True, exist_ok=True)
    if out.exists():
        out.unlink()
    cmd = [
        str(CHROME),
        "--headless=new",
        "--disable-gpu",
        "--hide-scrollbars",
        "--no-first-run",
        "--no-default-browser-check",
        "--run-all-compositor-stages-before-draw",
        "--virtual-time-budget=12000",
        f"--force-device-scale-factor={scale}",
        f"--window-size={width},{height}",
        f"--screenshot={out}",
        url,
    ]
    proc = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
    if not out.is_file() or out.stat().st_size < 2000:
        raise RuntimeError(f"screenshot failed: {url}\n{(proc.stderr or '')[-600:]}")


def rounded_paste(canvas: Image.Image, shot: Image.Image, box: tuple[int, int, int, int], radius: int) -> None:
    x0, y0, x1, y1 = box
    tw, th = x1 - x0, y1 - y0
    phone = shot.convert("RGBA").resize((tw, th), Image.Resampling.LANCZOS)
    mask = Image.new("L", (tw, th), 0)
    draw = ImageDraw.Draw(mask)
    draw.rounded_rectangle((0, 0, tw, th), radius=radius, fill=255)
    canvas.paste(phone, (x0, y0), mask)


def compose_uniform(raw: Path, mobile: bool) -> Image.Image:
    """把任意截图规范到统一 OUT_W x OUT_H。"""
    img = Image.open(raw).convert("RGB")
    canvas = Image.new("RGB", (OUT_W, OUT_H), (236, 241, 246))

    if not mobile:
        # 桌面：cover 铺满，顶部对齐（避免裁掉标题）
        fitted = Image.new("RGB", (OUT_W, OUT_H), (236, 241, 246))
        # 先按宽度缩放
        ratio = OUT_W / img.width
        nh = int(img.height * ratio)
        scaled = img.resize((OUT_W, nh), Image.Resampling.LANCZOS)
        if nh >= OUT_H:
            fitted.paste(scaled.crop((0, 0, OUT_W, OUT_H)), (0, 0))
        else:
            # 不足高度则居中补边
            y = (OUT_H - nh) // 2
            fitted.paste(scaled, (0, y))
        return fitted

    # 移动：模糊铺满背景 + 大号手机居中，避免灰边「不对齐」
    ratio = max(OUT_W / img.width, OUT_H / img.height)
    bw, bh = int(img.width * ratio), int(img.height * ratio)
    bg = img.resize((bw, bh), Image.Resampling.LANCZOS)
    bx, by = (bw - OUT_W) // 2, (bh - OUT_H) // 2
    bg = bg.crop((bx, by, bx + OUT_W, by + OUT_H))
    bg = bg.filter(ImageFilter.GaussianBlur(28))
    bg = ImageEnhance.Brightness(bg).enhance(0.72)
    canvas.paste(bg, (0, 0))

    max_h = int(OUT_H * 0.9)
    max_w = int(OUT_W * 0.4)
    aspect = img.width / img.height
    ph = max_h
    pw = int(ph * aspect)
    if pw > max_w:
        pw = max_w
        ph = int(pw / aspect)
    x0 = (OUT_W - pw) // 2
    y0 = (OUT_H - ph) // 2
    plate = Image.new("RGBA", (OUT_W, OUT_H), (0, 0, 0, 0))
    pdraw = ImageDraw.Draw(plate)
    pad = 18
    pdraw.rounded_rectangle(
        (x0 - pad, y0 - pad, x0 + pw + pad, y0 + ph + pad),
        radius=44,
        fill=(255, 255, 255, 36),
    )
    canvas = canvas.convert("RGBA")
    canvas.alpha_composite(plate)
    rounded_paste(canvas, img, (x0, y0, x0 + pw, y0 + ph), radius=40)
    return canvas.convert("RGB")


def export_webp(png: Path, demo_id: str) -> tuple[Path, Path]:
    img = Image.open(png).convert("RGB")
    cover = png.with_name("cover.webp")
    thumb = png.with_name("thumb.webp")
    img.resize((1600, 1000), Image.Resampling.LANCZOS).save(cover, "WEBP", quality=78, method=6)
    img.resize((800, 500), Image.Resampling.LANCZOS).save(thumb, "WEBP", quality=70, method=6)
    COVERS.mkdir(parents=True, exist_ok=True)
    img.save(COVERS / f"{demo_id}.png", format="PNG", optimize=True)
    return cover, thumb


def upload_covers(saved: dict[str, Path]) -> None:
    with tempfile.TemporaryDirectory() as td:
        pack = Path(td)
        for demo_id, path in saved.items():
            dest = pack / demo_id
            dest.mkdir(parents=True)
            (dest / "cover.png").write_bytes(path.read_bytes())
            cover_w, thumb_w = export_webp(path, demo_id)
            (dest / "cover.webp").write_bytes(cover_w.read_bytes())
            (dest / "thumb.webp").write_bytes(thumb_w.read_bytes())
        remote_cmd = (
            "tmpdir=$(mktemp -d); tar -C \"$tmpdir\" -xf -; "
            "for d in \"$tmpdir\"/*; do "
            "  id=$(basename \"$d\"); mkdir -p \"/opt/demos/$id\"; "
            "  cp -f \"$d\"/* \"/opt/demos/$id/\"; "
            "  echo \"cover -> /opt/demos/$id/\"; "
            "done; rm -rf \"$tmpdir\""
        )
        tar = subprocess.Popen(["tar", "-C", str(pack), "-cf", "-", "."], stdout=subprocess.PIPE)
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
            print(ssh.stderr, file=sys.stderr)
            raise SystemExit(ssh.returncode)


def stamp_catalog(saved_ids: set[str]) -> None:
    data = json.loads(CATALOG.read_text(encoding="utf-8"))
    for d in data.get("demos") or []:
        if d["id"] in saved_ids:
            d["cover"] = "cover.webp"
            d["thumb"] = "thumb.webp"
    meta = data.setdefault("meta", {})
    meta["version"] = "1.4.0"
    meta["cover_policy"] = "webp_thumb_800 + cover_1600"
    meta["cover_size"] = f"{OUT_W}x{OUT_H}"
    CATALOG.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def upload_gallery_files() -> None:
    files = ["catalog.json", "server.py", "README.md"]
    for name in files:
        src = ROOT / name
        if not src.is_file():
            continue
        subprocess.run(
            [
                "scp",
                "-i",
                str(SSH_KEY),
                "-o",
                "IdentitiesOnly=yes",
                str(src),
                f"{ECS_USER}@{ECS_HOST}:/opt/demo-gallery/{name}",
            ],
            check=True,
        )
    # web assets
    subprocess.run(
        [
            "bash",
            "-lc",
            f'export COPYFILE_DISABLE=1; tar -C "{ROOT}" -cf - web | '
            f'ssh -i "{SSH_KEY}" -o IdentitiesOnly=yes {ECS_USER}@{ECS_HOST} '
            f'"tar -C /opt/demo-gallery -xf -; systemctl restart demo-gallery"',
        ],
        check=True,
    )


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default=f"http://{ECS_HOST}")
    ap.add_argument("--only", default="")
    ap.add_argument("--upload", action="store_true")
    ap.add_argument("--include-archived", action="store_true")
    ap.add_argument("--deploy-ui", action="store_true", help="同时上传案例库前端")
    args = ap.parse_args()

    only = {x.strip() for x in args.only.split(",") if x.strip()} or None
    demos = load_demos(only, args.include_archived)
    saved: dict[str, Path] = {}
    failed: list[str] = []

    with tempfile.TemporaryDirectory() as td:
        raw_dir = Path(td)
        for demo in demos:
            demo_id = demo["id"]
            mobile = demo.get("form_factor") == "mobile"
            url = entry_url(args.base, demo)
            vw, vh = MOBILE_VIEW if mobile else DESKTOP_VIEW
            raw = raw_dir / f"{demo_id}-raw.png"
            out = LOCAL_DEMOS / demo_id / "cover.png"
            print(f"→ {demo_id}  {'mobile' if mobile else 'desktop'}  {url}")
            try:
                chrome_shot(url, raw, vw, vh, scale=SCALE)
                uniform = compose_uniform(raw, mobile=mobile)
                out.parent.mkdir(parents=True, exist_ok=True)
                uniform.save(out, format="PNG", optimize=True)
                COVERS.mkdir(parents=True, exist_ok=True)
                uniform.save(COVERS / f"{demo_id}.png", format="PNG", optimize=True)
                # verify size
                w, h = uniform.size
                assert (w, h) == (OUT_W, OUT_H), (w, h)
                saved[demo_id] = out
                print(f"  ✓ {w}x{h}  {out.stat().st_size // 1024} KB")
            except Exception as exc:  # noqa: BLE001
                failed.append(demo_id)
                print(f"  ✗ {exc}", file=sys.stderr)

    stamp_catalog(set(saved))
    print(f"catalog stamped ({len(saved)})")

    if args.upload and saved:
        print("upload covers ...")
        upload_covers(saved)
    if args.deploy_ui:
        print("deploy gallery ui ...")
        upload_gallery_files()

    if failed:
        print(f"failed: {', '.join(failed)}", file=sys.stderr)
        return 1
    print(f"done: {len(saved)} uniform covers")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
