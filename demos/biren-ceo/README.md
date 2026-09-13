# 壁仞科技 CEO 决策看板 · 客户演示包

本目录为**可交付客户演示版本**，与本地开发目录 `ceo-dashboard-h5` 共享 UI/逻辑。

| 对比项 | 客户演示包（本目录） | 本地开发版 `ceo-dashboard-h5` |
| --- | --- | --- |
| 情报刷新 | **MOSS 实时检索**（与内部版相同） | MOSS 实时检索 |
| 凭证 | 需本机 MOSS Token（`~/.cursor/mcp.json` 或环境变量） | 同上 |
| 当日基线 | 刷新成功写入 `demo-packs.json` | 回退用 `demo-packs.json` |
| 用途 | 客户演示 / 评审 | 内部联调开发 |

## 快速启动

### 方式一（推荐，macOS）

双击 `启动演示.command`，浏览器打开终端打印的地址（默认 `http://127.0.0.1:8765`）。

### 方式二（命令行）

```bash
cd ceo-dashboard-客户演示包
python3 server.py
```

## MOSS 凭证

刷新前请确保本机已配置 MOSS MCP（与 Cursor 内一致）：

- 环境变量 `MOSS_MCP_URL` / `MOSS_MCP_TOKEN`，或
- `~/.cursor/mcp.json` 中 `mcpServers.moss` 的 URL 与 Authorization

## 说明

1. 需安装 **Python 3**。
2. 「情报 → 刷新」会**直连 MOSS** 实时检索；成功后将结果写入 `demo-packs.json` 作为当日基线。
3. MOSS 不可用时回退本地 `demo-packs.json`，**不会伪装轮换或假更新**。
4. 详细步骤见：`壁仞科技_CEO决策看板_客户演示操作说明.docx`

## 目录结构

- `index.html` / `css/` / `js/` / `assets/`：前端页面
- `moss_live.py`：MOSS 检索与情报组装
- `demo-packs.json`：当日情报基线（刷新成功后自动更新）
- `server.py`：本地服务 + `/api/intel/refresh`
- `启动演示.command`：一键启动

## 双端同步

```bash
python3 scripts/sync_demo_package.py
```

会同步 `css/app.js/dashboard-data/assets/index.html/moss_live.py`，并刷新 `demo-packs.json`。  
**不覆盖**：`js/package-config.js`、`server.py`、启动脚本、Word 说明。
