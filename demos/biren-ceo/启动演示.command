#!/bin/bash
cd "$(dirname "$0")"
echo "正在启动 CEO 决策看板（客户演示包）…"
if ! command -v python3 >/dev/null 2>&1; then
  echo "未检测到 python3，请先安装 Python 3 后再试。"
  read -r -p "按回车键退出…"
  exit 1
fi
python3 server.py
