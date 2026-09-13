#!/bin/bash
# 本地预览：避免 file:// 缓存/路径问题，推荐用此方式打开原型
cd "$(dirname "$0")"
PORT=${1:-8080}
echo "财经驾驶舱原型 · http://127.0.0.1:${PORT}/index.html"
echo "按 Ctrl+C 停止"
python3 -m http.server "$PORT"
