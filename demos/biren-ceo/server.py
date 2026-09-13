#!/usr/bin/env python3
"""客户演示包：优先 MOSS 实时刷新；成功结果写入 demo-packs.json 作为当日基线；失败回退本地包。"""

from __future__ import annotations

import copy
import json
import os
import re
import socket
import traceback
from datetime import datetime, timedelta, timezone
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from intel_baseline import apply_live_policy

ROOT = Path(__file__).resolve().parent
PACKS_PATH = ROOT / "demo-packs.json"
DATA_JS = ROOT / "js" / "dashboard-data.js"
TZ_SH = timezone(timedelta(hours=8))
DEFAULT_HOST = "0.0.0.0"
DEFAULT_PORT = 8765


def now_iso() -> str:
    return datetime.now(TZ_SH).isoformat(timespec="seconds")


def load_fallback_packs() -> dict:
    if PACKS_PATH.exists():
        raw = json.loads(PACKS_PATH.read_text(encoding="utf-8"))
    elif DATA_JS.exists():
        text = DATA_JS.read_text(encoding="utf-8")
        m = re.search(r"window\.DASHBOARD_DATA\s*=\s*", text)
        body = text[m.end() :].strip()
        if body.endswith(";"):
            body = body[:-1]
        data = json.loads(body)
        raw = {k: data[k] for k in ("morning", "noon", "evening") if k in data}
    else:
        raise FileNotFoundError("缺少 demo-packs.json 与 dashboard-data.js")

    refreshed = now_iso()
    packs = {}
    for key, pack in raw.items():
        item = copy.deepcopy(pack)
        # 回退只标记尝试刷新时间，不改写 generated_at，避免「假实时」
        item["client_refreshed_at"] = refreshed
        item["content_stale"] = True
        item["source"] = "local_fallback"
        packs[key] = item
    return packs


def build_external_focus(packs: dict) -> list[dict]:
    from moss_live import build_external_focus as moss_build_focus

    items: list[dict] = []
    for key in ("evening", "noon", "morning"):
        items.extend((packs.get(key) or {}).get("items") or [])
    return moss_build_focus(items)


def refresh_with_fallback() -> dict:
    try:
        from moss_live import refresh_intel_from_moss

        body = refresh_intel_from_moss()
        if not body.get("ok"):
            raise RuntimeError(body.get("error") or "MOSS 返回无效")
        if not body.get("packs") or not int(body.get("item_count") or 0):
            raise RuntimeError(body.get("error") or "MOSS 返回空情报包")
        # 精选基线只读：实时条目偏少时用基线补齐，另存快照，不改写 demo-packs.json
        apply_live_policy(ROOT, body)
        if not body.get("external_focus"):
            body["external_focus"] = build_external_focus(body["packs"])
        return body
    except Exception as exc:  # noqa: BLE001
        packs = load_fallback_packs()
        return {
            "ok": True,
            "mode": "local_fallback",
            "degraded": True,
            "content_stale": True,
            "refreshed_at": now_iso(),
            "item_count": sum(len((p.get("items") or [])) for p in packs.values()),
            "errors": [str(exc)],
            "external_focus": build_external_focus(packs),
            "packs": packs,
            "note": "MOSS 不可用或为空，已回退本地情报基线（内容时间未改写）。",
        }


class DemoHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self) -> None:
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_GET(self) -> None:
        if self.path.split("?", 1)[0] == "/api/intel/refresh":
            self.handle_intel_refresh()
            return
        super().do_GET()

    def handle_intel_refresh(self) -> None:
        try:
            body = refresh_with_fallback()
            payload = json.dumps(body, ensure_ascii=False).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)
        except Exception as exc:  # noqa: BLE001
            err = {
                "ok": False,
                "mode": "error",
                "error": str(exc),
                "trace": traceback.format_exc(limit=3),
            }
            payload = json.dumps(err, ensure_ascii=False).encode("utf-8")
            self.send_response(500)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)

    def log_message(self, fmt: str, *args) -> None:
        client = self.client_address[0] if self.client_address else "-"
        print(f"[{self.log_date_time_string()}] {client} {fmt % args}")


def pick_port(host: str, start: int = DEFAULT_PORT, tries: int = 20) -> int:
    for port in range(start, start + tries):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            try:
                sock.bind((host, port))
                return port
            except OSError:
                continue
    raise SystemExit(f"端口 {start}-{start + tries - 1} 均被占用，请先关闭旧服务。")


def lan_urls(port: int) -> list[str]:
    urls = [f"http://127.0.0.1:{port}"]
    seen = {"127.0.0.1"}
    try:
        hostname = socket.gethostname()
        for info in socket.getaddrinfo(hostname, None, socket.AF_INET):
            ip = info[4][0]
            if ip in seen or ip.startswith("169.254."):
                continue
            seen.add(ip)
            urls.append(f"http://{ip}:{port}")
    except OSError:
        pass
    # 再扫一遍常见网卡，补上热点场景下的地址
    for iface_hint in ("en0", "en1", "bridge0"):
        try:
            import subprocess

            ip = subprocess.check_output(
                ["ipconfig", "getifaddr", iface_hint],
                stderr=subprocess.DEVNULL,
                text=True,
            ).strip()
            if ip and ip not in seen:
                seen.add(ip)
                urls.append(f"http://{ip}:{port}")
        except Exception:  # noqa: BLE001
            continue
    return urls


def main() -> None:
    host = (os.environ.get("HOST") or DEFAULT_HOST).strip() or DEFAULT_HOST
    start_port = int(os.environ.get("PORT") or DEFAULT_PORT)
    port = pick_port(host, start_port)
    server = ThreadingHTTPServer((host, port), DemoHandler)
    print("=" * 56)
    print("  壁仞科技 CEO 决策看板 · 客户演示包")
    print(f"  监听：{host}:{port}")
    for url in lan_urls(port):
        print(f"  打开：{url}")
    print("  手机请用「本机局域网 IP」那一行，不要用 localhost")
    print("  情报刷新：优先 MOSS 实时检索（需本机 MOSS 凭证）")
    print("  精选基线 demo-packs.json 只读；实时条目偏少时自动补齐")
    print("  按 Ctrl+C 结束")
    print("=" * 56)
    server.serve_forever()


if __name__ == "__main__":
    main()
