#!/usr/bin/env python3
"""本地 HTTP 服务：提供简道云 AI 动图轮播页面与媒体列表 API。"""

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
ASSETS = ROOT / "assets"
PORT = 8766


def collect_slides() -> list[dict[str, str | list[str]]]:
    slides: list[dict[str, str | list[str]]] = []

    gifs = sorted((ASSETS / "gifs").glob("*.gif"), key=lambda p: p.name.lower())
    gif_titles = {
        "assistant-fill-demo.gif": "AI 智能填报",
        "assistant-qa-demo.gif": "AI 知识库问答",
    }
    for path in gifs:
        rel = path.relative_to(ROOT).as_posix()
        slides.append(
            {
                "type": "gif",
                "name": gif_titles.get(path.name, path.stem),
                "url": rel,
            }
        )

    videos = sorted((ASSETS / "video").glob("*"))
    video_titles = {
        "ai-build-demo.mp4": "AI 智能搭建演示",
    }
    for path in videos:
        if path.suffix.lower() not in {".mp4", ".webm", ".mov"}:
            continue
        rel = path.relative_to(ROOT).as_posix()
        slides.append(
            {
                "type": "video",
                "name": video_titles.get(path.name, path.stem),
                "url": rel,
            }
        )

    return slides


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

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
        if self.path.split("?", 1)[0] == "/api/slides":
            body = json.dumps(collect_slides(), ensure_ascii=False).encode("utf-8")
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


def main() -> None:
    os.chdir(ROOT)
    slides = collect_slides()
    httpd = None
    port = PORT
    for attempt in range(10):
        try:
            httpd = ThreadingHTTPServer(("127.0.0.1", port), Handler)
            break
        except OSError as e:
            if e.errno != 48 or attempt == 9:
                raise
            port += 1
    url = f"http://127.0.0.1:{port}/"
    print("简道云 AI 动图轮播服务已启动")
    print(f"  打开: {url}")
    print(f"  幻灯片: {len(slides)} 项")
    print("  按 Ctrl+C 停止")
    if "--no-open" not in sys.argv:
        subprocess.Popen(["open", url], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    httpd.serve_forever()


if __name__ == "__main__":
    main()
