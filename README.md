# Gallery · DEMO 展览馆

帆软售前 DEMO 案例库：Python 后端 + 静态前端 + 全量 Demo 静态资源。  
源码镜像自 ECS PROD（`/opt/demo-gallery` + `/opt/demos`），供 Cursor Cloud Agent / Grok Bot 读取与协作。

## 仓库结构

```
gallery/
├── server.py              # 展览馆 HTTP 服务（catalog API、门禁、联邦检索）
├── catalog.json           # Demo 目录元数据（客户/内部、标签、入口）
├── search_index.json      # 本地检索索引
├── search_federation.py   # MaxKB / KMS / KH 联邦检索
├── gallery_brief.py       # 会前 brief 生成（meeting-card + v1 dual-write）
├── presales_brief.py      # Presales Brief v1：校验 / 联邦投影 / Ammo·Knowledge 适配
├── schemas/               # JSON Schema（presales_brief.v1.json）
├── docs/PRESALES-BRIEF.md # 字段与 Gallery / Knowledge / Ammo 投影
├── docs/DEMO-CHANGE-FLOW.md # DEMO 改动协作规范（demo-craft 一页；合并≠上线）
├── web/                   # 主馆 UI（gallery.css / gallery.js / gate.js）
├── scripts/               # 运维脚本（封面、索引、ECS 同步）
├── tests/                 # pytest
├── static-demos/          # pointer only — canonical HTML is demos/
├── covers/                # 卡片 thumb / 详情 cover（WebP）
├── data/                  # 运行时数据目录（auth/token 不入库，见 .gitignore）
└── demos/                 # 全部 Demo 静态包（对应 ECS /opt/demos/<id>/）
    ├── biren-ceo/
    ├── smic-finance/
    └── …
```

## 线上部署（ECS）

| 项 | 路径 |
|---|---|
| 展览馆模块 | `/opt/demo-gallery/` |
| Demo 静态资源 | `/opt/demos/<id>/` |
| 公网入口 | `http://120.55.184.234/gallery/` |
| Demo 直连 | `http://120.55.184.234/demos/<id>/` |

环境变量（生产在 systemd / 服务器配置，**勿提交密钥**）：

- `GALLERY_PASSWORD` — 门禁密码（**必填**，或写在 `data/auth.json` 的 `password`；无配置则拒绝启动，代码无默认口令）
- `GALLERY_COOKIE_SECURE` — 设为 `1` 时会话 Cookie 带 `Secure`；HTTPS / `X-Forwarded-Proto=https` 时也会自动带，纯 HTTP 不带（避免 ECS http 登录失败）

Nginx `auth_request` 探活：`GET /api/auth/gate`（挂在 `/gallery/` 且未剥前缀时也认 `/gallery/api/auth/gate`）— 有效会话 **204**，未登录 **401**。不要用 `/api/auth/status` 做 auth_request（它在未登录时仍返回 200 JSON `{ok:false}`，nginx 会当成放行）。
- `GALLERY_MAXKB_TOKEN` / `GALLERY_MAXKB_TOKEN_FILE` — MaxKB 联邦检索
- `GALLERY_MAXKB_KNOWLEDGE_IDS` / `GALLERY_MAXKB_MODE` / `GALLERY_MAXKB_SIMILARITY` / `GALLERY_MAXKB_TOP` — 知识库 hit_test 入参（默认 blend / 0.3 / 8）
- `GALLERY_MAXKB_EXPAND` — 知识通道查询扩展，默认开；`0` 只打原始问句
- `GALLERY_MAXKB_VARIANTS` — 扩展变体上限（默认 4）
- `GALLERY_MAXKB_RRF_K` — RRF 常数（默认 60）
- `GALLERY_MAXKB_PER_DOC` — 同一文档最多保留段落数（默认 3）
- `GALLERY_MAXKB_SYNONYMS` — 可选 JSON，覆盖/追加内存同义词表
- `GALLERY_KMS_BASE` + `GALLERY_KMS_TOKEN` — KMS 检索
- `FEEDBACK_PUBLIC_BASE` 或 `GALLERY_FEEDBACK_BASE` — 反馈台对外基址（默认 `http://120.55.184.234:8787`，联邦检索里的 admin / shot URL 用它）
- `GALLERY_FED_TIMEOUT` — 联邦检索每路超时秒数（默认 `10`）
- `GALLERY_FED_TIMEOUT_DEMOS` / `_FEEDBACK` / `_KNOWLEDGE` / `_FEISHU` — 单路覆盖

知识通道排序（只改 `search_maxkb`，不改四路 UI）：扩展 2–4 条问句 → 各 KB `hit_test` → 按段落 id 做 RRF → `售前武器/` 等路径加权 → 每文档最多 3 段。详见 `CHANGE-SUMMARY.md`。

## 本地 / CI

```bash
python3 scripts/validate_catalog.py
python3 scripts/build_search_index.py --demos-dir demos
python3 -m pytest tests/
python3 server.py   # 默认 :8788
```

## Grok Bot / Cloud Agent 用法

1. Cursor Dashboard → Integrations → GitHub → 授权本仓库
2. **先读** [`docs/GB-HANDOFF.md`](docs/GB-HANDOFF.md)（账户、规范、Demo 梗概、硬约束）
3. 对 GB 说：`读 Eric1553/gallery 的 main 与 docs/GB-HANDOFF.md，按手册执行，不要重问背景`

## 归属约定

- **客户 DEMO**：`audience: "client"` 或具名客户
- **内部 DEMO**：`audience: "internal"` 或 client 为「内部 / 帆软…」

详细入库与上线交接见 [`docs/DEMO-CHANGE-FLOW.md`](docs/DEMO-CHANGE-FLOW.md)。**合并 ≠ 上线。**

## Presales Brief v1

跨 Gallery / Knowledge / Ammo 的会前 brief 规范。本仓库是 schema 源；`/api/search` 的 `briefing` 仍是前端 meeting-card，并附加 `briefing.presales_brief`。只读接口（需门禁）：

```
GET /api/brief?q=壁仞怎么讲
GET /api/brief?customer=壁仞
```

字段与投影见 [`docs/PRESALES-BRIEF.md`](docs/PRESALES-BRIEF.md)。上线由 GB / release-ops 另走，本变更只开 PR。
