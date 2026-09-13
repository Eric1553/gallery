#!/bin/bash
cd "$(dirname "$0")/.."
echo "启动 FICO 财务弹药库本地服务..."
node scripts/fico-proxy.mjs
