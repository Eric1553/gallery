# 经营闭环 v2 · MOSS 实时迭代记录

## 第一性原理

情报刷新链路只有四段，任一段不稳都会表现为「假实时」：

1. **鉴权**：`.env` / 环境变量 / `~/.cursor/mcp.json`
2. **MCP 调用**：`tools/call` → `moss_public_opinion_search`（5 topic 并行）
3. **组装**：过滤噪声 → 主题均衡 → morning/noon/evening packs
4. **呈现**：前端超时、模式标注、失败回退

## 对抗审查发现 → 已修（本轮）

| 攻击面 | 现象 | 修复 |
| --- | --- | --- |
| 空结果仍标 live | 全 topic 失败仍 `ok/moss_live` | `moss_empty` + 服务端强制回退 |
| MCP `isError` 未识别 | 错误 JSON 当成功 | `_unwrap_mcp_result` 显式抛错 |
| 无超时预算 | 单调用 90s 可拖死页面 | `MOSS_TIMEOUT` 默认 45s + 前端 75s Abort |
| 连点打爆 MOSS | 双开刷新各跑一轮 | 服务端单飞 + 45s 缓存 |
| 主题挤兑 | evening 常缺 BR-SEN | `select_balanced_rows` + `diversify` 分包 |
| 客户机无 Cursor | 只有 mcp.json 能鉴权 | 包内 `.env` 加载 |
| 探活缺失 | 只能整包刷新才知道挂没挂 | `/api/moss/status` + `/api/health` |
| 前端无记忆 | 刷新失败白板 | sessionStorage 10 分钟缓存 |

## 回归

```bash
python3 server.py   # :8770
python3 scripts/moss_smoke_test.py
```

期望：health / moss_status / force refresh / cache hit / concurrent single-flight / unit 全 PASS。

## 刻意不改

旧版 `ceo-dashboard-h5` 成熟决策看板本轮不动；Linux 交付包可用构建脚本从本目录重打 v2。
