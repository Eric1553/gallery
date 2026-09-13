# 财务专项 · FICO 知识库弹药库

> 造弹药专项下的财务知识子库，索引来源为 FICO MCP 远程知识库（KB + Stages）。

## 目录结构

```text
造弹药专项/
└── 财务专项/
    ├── index.html                         # 首页（主入口）
    ├── FICO财务知识体系总览.html           # 跳转至 index.html
    ├── assets/css/home.css                # 首页样式
    ├── assets/css/search-sidebar.css      # 检索引擎侧边栏
    ├── assets/js/home.js                  # 首页交互
    ├── assets/js/fico-mcp-client.js         # FICO MCP 浏览器客户端
    ├── assets/js/search-engine.js         # 远程检索引擎 UI
    ├── assets/js/bg-fx.js                 # 背景动效
    ├── pages/
    │   ├── 01-基础财务.html
    │   ├── 02-财务分析.html
    │   ├── 03-财务咨询.html
    │   ├── 04-实战案例.html
    │   └── 检索指引.html
    └── data/
        ├── search-index.json              # 检索引擎倒排索引源
        └── fico-knowledge-index.json      # 结构化知识索引
```

## 知识库概览

| 模块 | 文档量 | 核心用途 |
|------|--------|----------|
| 01_基础财务 | 45篇 | SAP、税务、管理会计、合并报表 |
| 02_财务分析 | 38篇 | 行业对标、指标体系、专题分析 |
| 03_财务咨询 | 152篇 | 交付模板、项目管理、方法论 |
| 04_实战案例 | 38篇+ | 标杆案例（制造业60/零售37/能源19/金融15） |

## 使用方式

1. **浏览首页**：打开 `index.html`，一页预览全库结构
2. **FICO MCP 远程检索**：按 `⌘K` 打开检索引擎，输入问题即调用 FICO MCP 查全库
3. **Cursor 追问**：复制 `@fico` 指令到 Cursor 对话继续深挖
4. **结构化索引**：`data/fico-knowledge-index.json` 供地图浏览与自动化消费

## 检索引擎（必读）

**FICO 服务本身在线**（Cursor 里 `@fico` 可用），但浏览器**不能直接打开本地 HTML 文件**去连 MCP——会被跨域安全策略拦截，所以会出现「MCP 连接超时」。

### 正确打开方式

```bash
cd 造弹药专项/财务专项
node scripts/fico-proxy.mjs
# 或: bash scripts/start.sh
```

然后访问：**http://localhost:8748/index.html**

代理会在本机 `8748` 端口转发 FICO MCP 请求，检索侧边栏即可正常使用。

| 方式 | 结果 |
|------|------|
| 直接双击 `index.html`（file://） | ❌ 连不上 MCP |
| `http://localhost:8748/index.html` | ✅ 远程检索正常 |
| Cursor 里 `@fico` | ✅ 始终可用 |

快捷键：`⌘K` / `Ctrl+K` 打开 · `↑↓` 选择 · `Enter` 跳转 · `Esc` 关闭

## 同步说明

- 索引同步时间：2026-07-09
- 数据源：FICO MCP `fico_search`（`http://47.116.68.38:8747/mcp`）
- 后续更新：重跑 FICO 检索后更新 JSON 与 HTML 中的统计数字

## 与造弹药工作台的关系

财务专项作为造弹药体系中的**垂直弹药库**，与通用检索工作台互补：

- 通用工作台 → 跨行业检索编排、案例解析、材料推荐
- 财务专项 → FICO 财务知识体系的结构化地图与检索指引
