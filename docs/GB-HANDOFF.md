# Grok Bot 交接手册 · Gallery / Private Atelier

> **机密等级：高** — 含账号与口令。仓库须保持 **Private**；勿转发、勿写入门户 changelog、勿在公开渠道复述明文口令。  
> **GB 读法**：本文件即权威上下文；与 GitHub `Eric1553/gallery` 代码库、`catalog.json` 一致。有新决策以本文件 + 仓库为准，勿依赖 Cursor IDE 历史聊天。

---

## 0. 你是谁、为谁工作

| 项 | 值 |
|---|---|
| 用户 | **Lorin**（帆软上海售前） |
| 你的代号 | **GB**（Grok Bot） |
| 组织目标 | 维护 **Private Atelier**：售前 DEMO 展览馆 + 弹药库 + 知识问答 + 门户，支撑客户拜访与交付 |
| 你的边界 | 跨工具编排、调研、草稿、跟进 Cloud Agent；**未经 Lorin 明确批准** 不对外发消息、不改 PROD、不推 GitHub `main` 直接上线 |

---

## 1. GitHub 与 Cursor（必读连接）

| 项 | 值 |
|---|---|
| GitHub 账号 | `Eric1553`（登录邮箱 `xwh44_507@126.com`） |
| **本仓库** | https://github.com/Eric1553/gallery |
| 默认分支 | `main` |
| 内容来源 | ECS PROD 镜像（`/opt/demo-gallery` + `/opt/demos`），非 Lorin 本机 DEV |
| Cursor ↔ GitHub | https://cursor.com/dashboard → **Integrations → GitHub** → 授权 `Eric1553/gallery`（须与 GB 同一 Cursor 账号） |
| 写代码路径 | 让 GB 派发 **Cursor Cloud Agent** 在本仓库开分支/PR；GB 自身不索引本地 Cursor 工作区 |
| GB GitHub 插件 | 可选；只读 PAT（Contents/Issues/PRs Read）加速浏览 |

**第一条指令模板：**

> 读 `Eric1553/gallery` 的 `main` 与 `docs/GB-HANDOFF.md`。工程根目录是展览馆服务，`demos/` 是全部 Demo 静态包。按本手册约束工作，不要重问背景。

---

## 2. 账户与凭证

### 2.1 展览馆主馆（Gallery 门禁）

| 项 | 值 |
|---|---|
| 用途 | 主馆 `/gallery/` 登录；**仅 Lorin 私人使用**，不对客户开放 |
| 默认密码 | `FanRuan@Demo` |
| 环境变量 | `GALLERY_PASSWORD`（ECS systemd 可覆盖） |
| 会话 | 密码成功后本机 `gallery_device_token`；Cookie `gallery_session` |
| 数据目录 | `GALLERY_AUTH_DIR=/opt/demo-gallery/data`（`auth.json` **不入 Git**） |

### 2.2 MaxKB（半导体等领域知识库）

| 项 | 值 |
|---|---|
| Admin 账号 | `admin` |
| Admin 密码 | `Xwh@4518677`（**固化，禁止改密**） |
| HTTP | `http://120.55.184.234:8080` |
| HTTPS 备用 | `https://120.55.184.234:8444` |
| Hosts | `120.55.184.234 maxkb.local` → `https://maxkb.local/` |
| 密码 enforce | `/opt/maxkb/bin/enforce_admin_password.sh` + timer 每 5 分钟 |
| Gallery 用 Bearer | `GALLERY_MAXKB_TOKEN` 或文件 `data/maxkb_token`（ECS 上 mint，**不入 Git**） |
| 重签 token | `bash /opt/demo-gallery/scripts/mint_maxkb_token.sh` |
| **禁止** | `User.set_password`、改回 `MaxKB@123..` / `Temp@*`、Master 直 curl Admin 入库 |

### 2.3 客户反馈台（独立服务）

| 项 | 值 |
|---|---|
| Admin URL | http://120.55.184.234:8787/admin/ |
| 默认密码 | `Feedback@Admin` |
| 环境变量 | `FEEDBACK_ADMIN_PASSWORD` |
| 服务 | `demo-feedback`（**不要**并进 `demo-gallery/server.py`） |
| Embed | `<script src="http://120.55.184.234:8787/embed.js" data-demo-id="…" defer>` |

### 2.4 ECS SSH（运维 / Pi 排障）

| 项 | 值 |
|---|---|
| 主机 | `120.55.184.234` |
| 用户 | `root` |
| 密钥路径（Lorin 本机） | `/Users/lorin/Documents/ECS服务器/eric.pem` |
| 命令 | `ssh -i "/Users/lorin/Documents/ECS服务器/eric.pem" -o IdentitiesOnly=yes root@120.55.184.234` |

> GB 云端计算机**默认没有** `eric.pem`。SSH 上 ECS 须 Lorin 通过 Secure Secret 提供密钥，或改派 **pi-dispatcher / release-ops** 且经明确批准。

### 2.5 联邦检索（Gallery 搜索，运行时注入）

以下在 ECS systemd / 环境配置，**勿提交 Git**：

| 变量 | 用途 |
|---|---|
| `GALLERY_MAXKB_BASE` / `GALLERY_MAXKB_PUBLIC` | MaxKB API 基址 |
| `GALLERY_MAXKB_TOKEN` / `GALLERY_MAXKB_TOKEN_FILE` | MaxKB Bearer |
| `GALLERY_KMS_BASE` + `GALLERY_KMS_TOKEN` | KMS 检索 |
| `GALLERY_KH_TOKEN` | FineRAG / KH MCP Bearer |
| `FEEDBACK_DB` | 反馈 SQLite 路径（可选搜反馈） |

---

## 3. 基础设施与路径

### 3.1 ECS 一览

| 项 | 值 |
|---|---|
| 公网 IP | `120.55.184.234` |
| 门户入口 | http://120.55.184.234/ |
| 展览馆 | http://120.55.184.234/gallery/ |
| Gallery 内网端口 | `:8788` |
| Demo 静态 | http://120.55.184.234/demos/`<id>`/ |

### 3.2 DEV vs PROD

| 环境 | 路径 | 规则 |
|---|---|---|
| **DEV（本机）** | `/Users/lorin/Documents/ECS服务器/dev/<module>/` | 新功能先在这里做 |
| **PROD（线上）** | `120.55.184.234:/opt/<module>/` | **须 Lorin 确认** 后再推；禁止擅自重组 `/opt` |
| **本仓库** | GitHub `gallery` | GB / Cloud Agent 改代码；上线仍走 release-ops |

### 3.3 Gallery 在 ECS 上的关键路径

| 路径 | 说明 |
|---|---|
| `/opt/demo-gallery/` | 模块源码（push 目标之一） |
| `/opt/demos/<id>/` | 各 Demo 静态包 |
| `/opt/demo-runtime/demo-gallery/current` | **线上实际读取的 release 指针** |
| `/opt/demo-deploy/releases/gallery/<stamp>/` | release 历史 |
| `systemctl restart demo-gallery` | 改 catalog/UI/server 后重启 |

**易踩坑**：只改 `/opt/demo-gallery/` 不够 — 须同步 `catalog.json` + `search_index.json` 到 **runtime current**，否则主页「目录更新」日期不变。

### 3.4 兄弟模块（`/opt/`）

| 模块 | 路径 | 入口 |
|---|---|---|
| demo-portal | `/opt/demo-portal/` | `/` 门户 |
| demo-presales | `/opt/demo-presales/` | `/presales/`（hidden） |
| demo-ammo | `/opt/demo-ammo/` | `/ammo/` |
| demo-knowledge | `/opt/demo-knowledge/` | `/knowledge/` |
| demo-feedback | `/opt/demo-feedback/` | `:8787` |
| pi-agent | `/opt/pi-agent/` | ECS Pi 长任务 |

---

## 4. 本仓库结构

```
gallery/                          # GitHub 根
├── docs/GB-HANDOFF.md              # ← 本文件
├── server.py                       # HTTP 服务：主馆 + /demos 代理 + 门禁 + API
├── catalog.json                    # Demo 目录（29 条登记）
├── search_index.json               # 本地检索索引
├── search_federation.py            # MaxKB/KMS/KH/反馈 联邦搜
├── gallery_brief.py                # 会前 brief
├── web/                            # 主馆 UI（gallery.css 为视觉基准）
├── scripts/                        # capture_covers, sync_to_ecs, build_search_index…
├── tests/
├── static-demos/                   # 内嵌在主馆内的静态 Demo
├── covers/                         # thumb.webp / cover.webp
├── data/                           # 运行时（auth/token 不入库）
└── demos/                          # 32 个静态包目录（含历史 rev 文件夹）
```

---

## 5. Private Atelier 平台梗概

**品牌**：Private Atelier · 私人工作台  
**门户版本**：见 `demo-portal/modules.json`（当前约 v3.3.x）

| 模块 | 状态 | 一句话 |
|---|---|---|
| DEMO 展览馆 | live | 客户/内部 DEMO 档案、封面、检索 |
| 客户弹药库 | live | MOSS/CRM 定性 + KnowHow/KMS 检索 → HTML 弹药包 |
| 知识问答 | live | 半导体/FICO/KMS 会前卡 |
| 模板解析台 | live | CPT/FVS → ECS Pi 解析 |
| 客户反馈台 | live | 演示批注 embed |
| 售前工作台 | hidden | DEMO 交付包（内部） |
| Changelog | live | `/changelog/` 版本公告 |

---

## 6. Gallery 业务规范（硬规则）

### 6.1 客户 DEMO vs 内部 DEMO

| 类型 | 判定 | 示例 |
|---|---|---|
| **客户 DEMO** | 具名客户交付/售前/POC | 壁仞、中芯、联影、隐冠、唯捷… |
| **内部 DEMO** | `audience: "internal"` 或 client 为「内部」「帆软…」 | FDE 轮播、简道云、造弹药、POC 脑图 |

- 帆软横向 / FDE / 简道云 → **一律内部**，不是客户  
- `featured: true` **仅客户 DEMO**  
- 前端 `isInternal()`：`audience === "internal"` 或 client 匹配内部/帆软

### 6.2 catalog.json 登记

- **必填**：`id, title, client, industry, hall, type, summary, tags, entry, source`  
- **hall**：`ceo` | `ops` | `poc` | `platform` | `misc`  
- **tags 恰好 4 个**，顺序：`[行业, 业务域, 核心内容, 补充]`（词表见 `meta.tag_policy`）  
- **id**：小写短横线；路径 `demos/<id>/` 与 `/opt/demos/<id>/` 一致  
- 同系列历史版：`family` + `archived` / `is_latest`

### 6.3 封面与流量

- 列表 **只用** `thumb.webp`（~800×500）；详情 `cover.webp`（1600×1000）  
- 截图：`scripts/capture_covers.py --only <id> --upload`  
- 静态资源长缓存；**catalog.json 不缓存**  
- 禁止同步：视频、巨型 gif、zip、`node_modules` 到 ECS

### 6.4 UI 视觉（全平台统一）

跟 `web/assets/gallery.css`，禁止另起纸质暖色/深色主题：

| Token | 值 |
|---|---|
| 背景 | `#f3f6f9` |
| 正文 | `#15202b` |
| 次要 | `#667687` |
| 主色 | `#0f766e` |
| 辅色 | `#1d4e89` |
| 圆角 | `20px`（芯片 `999px`） |
| 字体 | Plus Jakarta Sans + Noto Sans SC |

骨架：`stage-bg` + 毛玻璃顶栏 + 青绿渐变胶囊主按钮 + `scene-chip` 筛选。

### 6.5 新 DEMO 入库流程（摘要）

1. 定 id → 静态文件进 `demos/<id>/`（本仓库）及 ECS `/opt/demos/<id>/`  
2. 改 `catalog.json` → `python3 scripts/build_search_index.py`  
3. ECS 跑封面脚本 → sync runtime current → `systemctl restart demo-gallery`  
4. 验收：侧栏归属、卡片可点、thumb 200、登录后 `/api/catalog.json` 含新 id  

---

## 7. Demo 目录梗概（catalog 登记 29 条）

### 7.1 客户 DEMO（20）

| id | 客户 | 标题 | 馆区 |
|---|---|---|---|
| jingxin-helmsman | 旌芯半导体 | 掌舵者OS（桌面） | ceo |
| jingxin-helmsman-mobile | 旌芯半导体 | 掌舵者OS（手机） | ceo |
| taihu-supply-dark / light | 钛虎机器人 | 供应链看板 深/浅 | ceo |
| biren-ceo | 壁仞科技 | CEO 决策看板 | ceo |
| biren-ops-loop | 壁仞科技 | 经营闭环 | ops |
| biren-finance | 壁仞科技 | 财务数字化一期 | ceo |
| biren-finance__baseline | 壁仞科技 | 财务数字化（批注基线） | ceo |
| smic-finance | 中芯国际 | 财经驾驶舱 | ceo |
| sigenergy-ceo | 思格新能源 | 一把手看板 | ceo |
| acme-rd | 盛美半导体 | 研发运营看板 | ops |
| hejian-wall | 合见工软 | 咨询原型墙 | ops |
| weijie-sales / lite | 唯捷创芯 | 销售 BI / 驾驶舱单页 | ops |
| yinguang-efficiency / hours / ipd | 隐冠半导体 | 人效 / 工时 / IPD | ops |
| jiangyuan-rd-pm | 江原科技 | 研发项目管理（简道云） | ops |
| uih-poc | 联影医疗 | PoC 工作台 | poc |
| luomu-extractor | 洛阳钼业 | 标杆报告提取台 | poc |

### 7.2 内部 DEMO（9）

| id | 说明 | 馆区 |
|---|---|---|
| fde-carousel | FDE Agentic 轮播 | platform |
| jiandaoyun-carousel | 简道云 AI 动图轮播 | platform |
| ammo-finance / unified-v10 / search | 造弹药系列 | platform |
| poc-mindmap | POC 脑图 | misc |
| visit-board | 销售拜访分析看板 | misc |
| finance-qc-arch | 财经数据质检 AI 一页版 | misc |
| kms-semi | 半导体知识库站点 | misc |

### 7.3 仓库 `demos/` 额外目录（未全部入 catalog）

含壁仞财务历史 rev 文件夹等，供对比/归档；以 `catalog.json` 为展示权威。

---

## 8. Agent 编排（Lorin 在 Cursor 侧的 Subagent）

GB **不替代** 下列专职 Agent；涉及对应域时，应建议 Lorin 派发或自行只读：

| Agent | 场景 |
|---|---|
| gallery-ops | DEMO 入库、封面、catalog |
| demo-delivery | 会前交付包、话术 |
| ammo-ops | 客户弹药包 HTML |
| knowledge-router | `/knowledge/` 模块、MaxKB 工程 |
| portal-ops | 门户 modules.json、changelog |
| release-ops | DEV→PROD、systemctl（**须 Lorin 确认**） |
| pi-dispatcher | 用 pi、MaxKB 入库、ECS 长编码 |
| verifier | 验收 / 子代理失败闸门 |

**MaxKB 入库强制链路**：`Master → pi-dispatcher → ECS Pi → MaxKB MCP`（禁止 docker exec / 手改 Document.status）。

**Pi 派发**：`/Users/lorin/Documents/ECS服务器/dispatch_pi_ecs.sh -n <name> "任务"`

---

## 9. GB 常用操作指引

### 9.1 只读调研（优先）

- GitHub 读 `catalog.json`、PR、Issue  
- 浏览器打开公网页面验收截图  
- 插件：Gmail/Calendar/Notion/Slack（若 Lorin 已连接）

### 9.2 改 Gallery 代码

1. 说明目标 + 验收标准  
2. 派 **Cursor Cloud Agent** 在 `Eric1553/gallery` 开 PR  
3. GB 读 PR diff / CI / 截图，不符合则 queue follow-up  
4. **合并 ≠ 上线**；上线须 Lorin 确认 → release-ops 推 ECS

### 9.3 改 catalog / 新 Demo

- 改 `catalog.json` + `demos/<id>/` + 重建 `search_index.json`  
- 封面与 ECS 同步通常需 **gallery-ops** 或 Lorin 批准 SSH

### 9.4 禁止事项（违反即停）

- 未批准推 PROD / `systemctl restart` / 写 `/opt`  
- 改 MaxKB admin 密码  
- 把帆软/FDE/简道云标成客户 DEMO  
- 在 changelog/公开页复述口令  
- 用 FICO MCP 冒充 Pi 跑长任务  

---

## 10. 门户 Changelog 同步（功能上线时）

凡 Gallery 可见更新上线，须同步：

1. `/Users/lorin/Documents/ECS服务器/dev/demo-portal/web/changelog/releases.json`（顶部插条目）  
2. `modules.json` 的 `meta.version`  
3. 用户确认后 release-ops 推 `/opt/demo-portal`

kind：`major` 重构 | `minor` 小迭代 | `patch` 修复

---

## 11. 技术栈摘要

| 层 | 技术 |
|---|---|
| Gallery 后端 | Python 3 `ThreadingHTTPServer`，`server.py` |
| 前端 | 原生 HTML/CSS/JS（`web/assets/gallery.js`） |
| 测试 | pytest under `tests/` |
| 搜索 | 本地 index + `search_federation.py` 联邦 |
| 部署 | systemd `demo-gallery`，Nginx/portal 反代 |

---

## 12. 凭证轮换与事故

- 本文件或 Git 历史**泄露** → 立即改 `GALLERY_PASSWORD`、轮换 MaxKB token、撤销 GitHub PAT  
- MaxKB 登不进 → `mint_maxkb_token.sh`，**不要**改 admin 密码  
- Gallery 目录不更新 → 查 runtime current 是否同步  

---

## 13. 文档索引

| 文档 | 位置 |
|---|---|
| 本手册 | `docs/GB-HANDOFF.md` |
| GitHub 连接 | `docs/GITHUB-GB-SETUP.md` |
| README | `README.md` |
| MaxKB 权威（ECS） | `/Users/lorin/Documents/ECS服务器/docs/MAXKB.md` |
| DEV/PROD | `/Users/lorin/Documents/ECS服务器/docs/DEV_PROD.md` |
| Agent 路由 | `/Users/lorin/Documents/ECS服务器/docs/agent-fleet/REGISTRY.md` |

---

*最后更新：2026-09-13 · 镜像自 ECS PROD · GitHub `Eric1553/gallery@main`*
