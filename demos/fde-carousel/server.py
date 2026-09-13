#!/usr/bin/env python3
"""本地 HTTP 服务：提供 FDE 视频轮播页面与视频列表 API。"""

from __future__ import annotations

import json
import mimetypes
import os
import re
import subprocess
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote

ROOT = Path(__file__).resolve().parent
VIDEO_EXT = {".mp4", ".webm", ".mov", ".mkv", ".avi", ".m4v"}
VIDEO_DIRS = (ROOT / "DEMO",)
PORT = 8765
PID_FILE = ROOT / ".fde-server.pid"
LOG_FILE = ROOT / ".fde-server.log"


def collect_videos() -> list[dict[str, str]]:
    items: list[tuple[str, str]] = []
    for base in VIDEO_DIRS:
        if not base.is_dir():
            continue
        for path in sorted(base.rglob("*")):
            if not path.is_file():
                continue
            if path.suffix.lower() not in VIDEO_EXT:
                continue
            rel = path.relative_to(ROOT).as_posix()
            items.append((rel, path.name))

    items.sort(key=lambda x: x[0].lower())
    return [{"name": name, "url": rel} for rel, name in items]


class Handler(SimpleHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def log_message(self, format: str, *args) -> None:
        sys.stderr.write("%s - - [%s] %s\n" % (self.address_string(), self.log_date_time_string(), format % args))

    def handle_one_request(self) -> None:
        try:
            super().handle_one_request()
        except (BrokenPipeError, ConnectionResetError):
            pass
        except Exception:
            self.log_error("Unhandled request error")
            try:
                self.send_error(500, "Internal Server Error")
            except Exception:
                pass

    def end_headers(self) -> None:
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()

    def send_head(self):
        path = self.translate_path(self.path)
        if os.path.isdir(path) or not os.path.isfile(path):
            return super().send_head()

        ctype = self.guess_type(path)
        try:
            f = open(path, "rb")
        except OSError:
            self.send_error(404, self.responses[404][0])
            return None

        fs = os.fstat(f.fileno())
        size = fs.st_size
        range_header = self.headers.get("Range")

        if range_header:
            match = re.fullmatch(r"bytes=(\d*)-(\d*)", range_header.strip())
            if match:
                start_s, end_s = match.groups()
                start = int(start_s) if start_s else 0
                end = int(end_s) if end_s else size - 1
                end = min(end, size - 1)
                if start >= size or start > end:
                    self.send_error(416, "Requested Range Not Satisfiable")
                    self.send_header("Content-Range", f"bytes */{size}")
                    self.end_headers()
                    f.close()
                    return None
                length = end - start + 1
                self.send_response(206)
                self.send_header("Content-type", ctype)
                self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
                self.send_header("Content-Length", str(length))
                self.send_header("Accept-Ranges", "bytes")
                self.send_header("Last-Modified", self.date_time_string(fs.st_mtime))
                self.end_headers()
                if self.command == "GET":
                    f.seek(start)
                    return f
                f.close()
                return None

        self.send_response(200)
        self.send_header("Content-type", ctype)
        self.send_header("Content-Length", str(size))
        self.send_header("Accept-Ranges", "bytes")
        self.send_header("Last-Modified", self.date_time_string(fs.st_mtime))
        self.end_headers()
        return f

    def do_GET(self) -> None:
        route = self.path.split("?", 1)[0]

        if route == "/api/health":
            body = json.dumps({"ok": True, "videos": len(collect_videos())}).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return

        if route == "/api/videos":
            body = json.dumps(collect_videos(), ensure_ascii=False).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return

        if self.path in ("/", ""):
            self.path = "/index.html"

        return super().do_GET()

    def guess_type(self, path: str) -> str:
        path = unquote(path)
        ctype, _ = mimetypes.guess_type(path)
        if ctype:
            return ctype
        if path.lower().endswith(".mov"):
            return "video/quicktime"
        return "application/octet-stream"


def write_pid(port: int) -> None:
    PID_FILE.write_text(f"{os.getpid()}\n{port}\n", encoding="utf-8")


def remove_pid() -> None:
    try:
        PID_FILE.unlink(missing_ok=True)
    except OSError:
        pass


def main() -> None:
    os.chdir(ROOT)
    videos = collect_videos()
    httpd = None
    port = PORT
    ThreadingHTTPServer.allow_reuse_address = True
    for attempt in range(10):
        try:
            httpd = ThreadingHTTPServer(("127.0.0.1", port), Handler)
            httpd.daemon_threads = True
            break
        except OSError as e:
            if e.errno != 48 or attempt == 9:
                raise
            port += 1
    write_pid(port)
    url = f"http://127.0.0.1:{port}/"
    print("FDE 视频轮播服务已启动")
    print(f"  打开: {url}")
    print(f"  健康检查: {url}api/health")
    print(f"  视频: {len(videos)} 个（扫描 DEMO 目录）")
    print(f"  PID: {os.getpid()}  端口: {port}")
    print("  按 Ctrl+C 停止")
    if "--no-open" not in sys.argv:
        subprocess.Popen(["open", url], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        httpd.serve_forever()
    finally:
        remove_pid()


if __name__ == "__main__":
    main()
