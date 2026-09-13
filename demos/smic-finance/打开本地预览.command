#!/bin/bash
cd "$(dirname "$0")"
echo "启动本地预览服务: http://127.0.0.1:8765/index.html"
echo "按 Ctrl+C 停止"
open "http://127.0.0.1:8765/index.html" 2>/dev/null || true
python3 -m http.server 8765
