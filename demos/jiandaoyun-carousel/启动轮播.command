#!/bin/bash
# 简道云 AI 动图轮播 — 适用于 macOS Apple Silicon (M 系列)
cd "$(dirname "$0")"

find_python() {
  for cmd in python3 /usr/bin/python3 /opt/homebrew/bin/python3 /usr/local/bin/python3; do
    if [ -x "$cmd" ] 2>/dev/null && "$cmd" -c "import sys; exit(0 if sys.version_info >= (3, 8) else 1)" 2>/dev/null; then
      echo "$cmd"
      return 0
    fi
  done
  return 1
}

PYTHON=$(find_python)
if [ -z "$PYTHON" ]; then
  osascript -e 'display alert "未找到 Python 3" message "请先安装 Xcode 命令行工具（终端执行 xcode-select --install）或从 python.org 安装 Python 3。" buttons {"好"} default button 1'
  exit 1
fi

exec "$PYTHON" server.py
