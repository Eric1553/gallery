#!/bin/bash
cd "$(dirname "$0")"
echo "正在重新截取各页面缩略图…"
node scripts/capture-thumbnails.mjs
echo "完成。请刷新 index.html 查看总览墙。"
