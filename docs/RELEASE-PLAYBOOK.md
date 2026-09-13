# Private Atelier · Gallery 发版剧本（checklist）

> **受众**：Gallery管家 / GB / release-ops / portal-ops  
> **性质**：文档与检查清单 ONLY — **不执行** deploy、**不** git push、**不**改 PROD  
> **基线**：2026-09-13 · 依据 `docs/GB-HANDOFF.md`、`PORTAL-GALLERY-ROADMAP.md`、`CHANGE-SUMMARY.md`、`scripts/sync_to_ecs.sh`、门户 changelog 2.0.0 拓扑叙述  
> **线上参考**：`http://120.55.184.234` · modules / releases.meta.current ≈ **3.3.7**

---

## 0. 一句话

**改码 → PR →（可选）合 main → 得 Lorin/GB 明确「可以上线/推送」→ release-ops 推 ECS（写 release 目录 + 切 runtime `current` + systemctl）→ 门户版本戳对齐 → 冒烟 → 出问题切回 previous runtime。**

合并到 `main` **不等于**上线。

---

## 1. 硬规则（违反即停）

| # | 规则 |
|---|---|
| 1 | **合并 ≠ 上线**。须 Lorin 或 GB **口头/书面明确**「可以上线」或「可以推送」后，release-ops 才可动 ECS。 |
| 2 | Gallery **线上真源**是 runtime 指针 `/opt/demo-runtime/demo-gallery/current`，**不是**只写 `/opt/demo-gallery/`。 |
| 3 | `scripts/sync_to_ecs.sh` **仅**单 DEMO → `/opt/demos/<id>/`；默认 dry-run；**不**动 gallery 模块 / systemd / Nginx。模块发版另走 release-ops（`push_dev_to_prod` 或等价流程）。 |
| 4 | 禁止 `capture_covers.py --deploy-ui` 等脚本直 `systemctl restart` 冒充发版；正式路径：staging/release → 切指针 → 批准后 restart。 |
| 5 | 回滚优先：**切换 runtime `current` 到 previous stamp**，再 restart；避免手改生产树拼凑。 |
| 6 | PROD 为运行真源；GitHub `Eric1553/gallery` 为协作真源 — 上线后应日级回推对齐（由 release-ops / 约定流程执行，本剧本不代跑）。 |
| 7 | 未批准：不写 `/opt`、不 `systemctl`、不推 PROD、不公开复述口令。 |

---

## 2. 角色与衔接

| 角色 | 本剧本中的职责 |
|---|---|
| **gallery-ops** | DEMO 入库、封面、`catalog.json`、索引；开/跟 PR；完成「PR 验收」后移交发版门 |
| **Cloud Agent / 开发** | 在 `Eric1553/gallery` 开 PR；不直接上线 |
| **GB / Gallery管家** | 读 PR、对验收标准；协调；**确认可以上线后**才派 release-ops |
| **release-ops** | DEV→PROD、写 `/opt/demo-deploy/releases/gallery/<stamp>/`、切 runtime 指针、`systemctl` |
| **portal-ops** | `modules.json` + `changelog/releases.json`（含 **`meta.current` / `updated_at`**） |
| **verifier** | 冒烟闸门；失败则阻断宣布成功 |

**与 gallery-ops PR 验收衔接（交接条）：**

1. PR 目标与验收标准已写清（改了什么、怎么验）。  
2. CI / `pytest`（至少 `tests/test_release_baseline.py` 等相关）通过或已注明豁免。  
3. `catalog.json` 契约：必填字段、tags×4、客户/内部归类正确；若动 DEMO：`search_index.json` 已重建。  
4. 封面策略：列表用 `thumb.webp`；无巨型视频/zip/`node_modules` 入仓待 sync。  
5. **明确标注**：本 PR「仅合并」还是「合并后待上线」；待上线则列出 stamp 建议名与影响面（gallery only / +portal）。  
6. gallery-ops **不**自行推 ECS；勾完本节 → 请 Lorin/GB 批「可以上线」→ 交 release-ops 按 §4 执行。

---

## 3. 路径与拓扑（ECS）

| 角色 | 路径 |
|---|---|
| DEV（Lorin 本机） | `/Users/lorin/Documents/ECS服务器/dev/demo-gallery/`（及 `dev/demo-portal/`） |
| 模块工作树 / 常见 scp 目标 | `/opt/demo-gallery/` |
| **线上读取指针** | `/opt/demo-runtime/demo-gallery/current` |
| release 历史 | `/opt/demo-deploy/releases/gallery/<stamp>/` |
| Demo 静态 | `/opt/demos/<id>/` |
| 门户 | `/opt/demo-portal/`（changelog、modules） |
| systemd | `demo-gallery` → `systemctl restart demo-gallery` |
| 公网 | 门户 `/` · 展览馆 `/gallery/` · Demo `/demos/<id>/` · IP `120.55.184.234` |

**发布拓扑（changelog 2.0.0 叙述，沿用）：**

```text
DEV / snapshot → releases/gallery/<stamp>/ → (可选 canary) →
  切换 runtime current 指针 → systemctl restart demo-gallery →
  门户版本戳 → 冒烟 gates → 失败则指针回滚
```

**易踩坑：** 只更新 `/opt/demo-gallery/` 而不同步 **runtime current** 的 `catalog.json` + `search_index.json` → 主页「目录更新」日期不变、线上仍读旧树。

---

## 4. 标准发版检查清单（Gallery 模块）

> 以下为 **人工/release-ops 勾选清单**，本文档本身不执行任何一步。

### 4.1 上线前门

- [ ] 代码已在约定分支 / 已合 `main`（或明确用 DEV 树某 commit）  
- [ ] **Lorin 或 GB 已明确说「可以上线」或「可以推送」**（记下时间与原文）  
- [ ] 影响面确认：仅 gallery / 含 portal 戳 / 是否触及 `/opt/demos`  
- [ ] 单 DEMO 静态变更走 `sync_to_ecs.sh --demo-id … --source …`（先 dry-run 再 `--apply`）；**frozen** id（biren-*）禁止进该脚本删除域  
- [ ] 模块级变更 **不用** `sync_to_ecs.sh`，用 `push_dev_to_prod`（或 release-ops 等价：拷入 `releases/gallery/<stamp>/`）

### 4.2 ECS 发布（release-ops）

- [ ] 从 DEV（或已审 release 产物）生成/写入：`/opt/demo-deploy/releases/gallery/<stamp>/`  
- [ ] 需要时同步模块树到 `/opt/demo-gallery/`（工作树），但 **必须**保证 runtime 将指向新 stamp  
- [ ] **切换指针**：`/opt/demo-runtime/demo-gallery/current` → 新 `<stamp>`（保留 previous 可回滚）  
- [ ] 确认 current 内含本次 `catalog.json`、`search_index.json`、server/web 等关键文件  
- [ ] `systemctl restart demo-gallery` → `systemctl is-active demo-gallery`  
- [ ] （可选）记录 stamp、操作者、批准人到 heartbeat / 运维笔记

### 4.3 门户版本戳（凡 Gallery **可见**更新）

路径在 DEV：`…/dev/demo-portal/web/changelog/releases.json` 与 `modules.json`；确认后由 release-ops 推 `/opt/demo-portal`。

- [ ] `modules.json` → `meta.version`（及 `updated_at`）升到目标版  
- [ ] `releases.json` → **数组顶部**追加条目（`version/date/kind/title/summary/highlights…`）  
- [ ] **必须**同步：`releases.meta.current` = 头条版本，且 `meta.updated_at` 更新  
  - 首页 pill/banner 读的是 **`meta.current`**，不是 `releases[0]`；漏改会显示旧版（曾出现 3.3.7 头条 vs meta 仍 3.3.6）  
- [ ] kind：`major` 重构 | `minor` 小迭代 | `patch` 修复  
- [ ] 相关前端缓存戳（`gallery.js?v=…` 等）按需 bump  
- [ ] 用户/GB 确认文案后，release-ops 推门户

### 4.4 上线后对齐

- [ ] 公网冒烟 §5 全绿（或已知豁免已记录）  
- [ ] 计划回推 GitHub `Eric1553/gallery`（避免 PROD ≫ Git 漂移）  
- [ ] 通知 gallery-ops / GB：stamp、版本号、回滚点（previous stamp）

---

## 5. 冒烟清单（gates）

公网基址：`http://120.55.184.234`（只读验收；勿在剧本执行中改配置）。

### 5.1 门禁 / gate

- [ ] `/` 门户门禁页 200  
- [ ] `/gallery/` 门禁；未登录 `/gallery/api/auth/status` → 未登录态  
- [ ] 登录后 session / device token 可用（与门户共用叙事）  
- [ ] 未登录 `/gallery/api/catalog.json` → 401；登录后 → 200

### 5.2 Catalog

- [ ] 登录后 catalog `meta.version` / `updated_at` 符合本次发版叙述  
- [ ] 新/改 demo id 出现在列表；侧栏馆区、客户/内部归属正确  
- [ ] 卡片可点；`thumb.webp` 200（若本次动封面）

### 5.3 Search（联邦）

- [ ] `/gallery/api/search?q=…`（或 UI 搜索）有 demos 命中  
- [ ] 记录各通道状态（demos / feedback / feishu / knowledge）；knowledge 若 `not_configured` 须在发版说明中已知情，勿假装已通  
- [ ] 进度/失败不静默卡死（回归关注点）

### 5.4 关键模块衔接（抽检）

- [ ] 门户 `/portal-api/modules.json` 版本 = 目标版  
- [ ] `/changelog/releases.json`：**`meta.current` == `releases[0].version` == modules 版本**  
- [ ] 首页 pill/banner 显示新版本号  
- [ ] 兄弟模块壳/API 抽检（按本次影响面）：如 `/ammo/`、`/knowledge/` 等；API 仍依赖门户 cookie 属预期

### 5.5 服务健康

- [ ] `systemctl is-active demo-gallery` = active  
- [ ] `/gallery/` 与关键 API 无 5xx

---

## 6. 回滚（优先指针切换）

1. 确认 **previous** stamp：`/opt/demo-deploy/releases/gallery/<previous>/` 仍完整。  
2. 将 `/opt/demo-runtime/demo-gallery/current` **改回** previous。  
3. `systemctl restart demo-gallery` → 确认 active。  
4. 门户若已推新版本戳：按需回滚 `modules.json` / `releases.json`（或发 patch 说明回滚），保持 **`meta.current`** 与真实运行一致。  
5. 冒烟 §5 再跑一轮；通知批准人与 gallery-ops。  
6. **避免**：在 `/opt/demo-gallery` 上手改半套文件「急救」而不动指针。

---

## 7. 脚本边界速查

| 脚本 / 动作 | 可以 | 不可以 |
|---|---|---|
| `sync_to_ecs.sh` | 单 demo rsync → `/opt/demos/<id>` | 部署 gallery 模块、restart、改 Nginx |
| `push_to_github.sh` | 仓库协作推送（另批） | 代替 ECS 发版 |
| `build_search_index.py` | 重建索引 | 自己上线 |
| `capture_covers.py --upload` | 封面上传到 demo 目录 | 用 `--deploy-ui` 绕过本剧本 |
| `push_dev_to_prod` / release-ops 等价 | 模块 release + 指针 | 无「可以上线」时执行 |
| 单 demo 捷径（如某原型 `push_gallery.sh`） | 历史/特例双写 catalog+runtime | **不**作为平台标准发版；正式走 §4 |

---

## 8. 禁区（本剧本明确不覆盖）

以下主题 **不要**塞进本发版清单或本次 Gallery管家执行范围：

- **MaxKB** 内容运营 / 入库 / 改 admin / mint 流程细节（有独立权威文档与 pi-dispatcher 链路）  
- **CLEANUP** 大清理（孤儿 `__rev*`、重资产、static-demos 双源等）— 另立 CLEANUP 工单  
- **DEMO 文案 / 话术 / 售前 copywriting**（demo-delivery 域）

本剧本只服务：**Gallery（+必要门户戳）安全上线与回滚。**

---

## 9. 缺口与未知（运维机/box 上未能核对）

| 项 | 状态 |
|---|---|
| `/Users/lorin/Documents/ECS服务器/docs/DEV_PROD.md` | 权威 DEV/PROD 文档在 Mac/ECS 侧；冲突时以 Lorin 裁定 |
| `push_dev_to_prod` 可执行文件 | **未出现在** gallery 仓库内；视为 Mac/运维机上的 release-ops 工具或等价手操；执行前由 release-ops 确认真实命令名与参数 |
| ECS 上 `current` 真实 symlink/目录形态、canary 是否仍强制 | 来自 HANDOFF + changelog 2.0.0 叙述；执行前在目标机核实 |
| 门户文案/截图目录 `media/<version>/` | releases.meta.howto 有要求；按 portal-ops 习惯补 |
| GitHub ↔ PROD 日级对齐的具体脚本 | 原则已写；自动化是否存在未在 gallery 仓内确认 |

---

## 10. 最小口令卡（给 Gallery管家）

```text
1. gallery-ops PR 验收勾完 §2
2. 等待 Lorin/GB：「可以上线」/「可以推送」
3. release-ops：stamp → 切 /opt/demo-runtime/demo-gallery/current → systemctl restart demo-gallery
4. portal-ops：modules + releases 头条 + **releases.meta.current**
5. §5 冒烟；失败 → §6 指针回滚
6. 不做 MaxKB / CLEANUP / DEMO 文案
```

---

*文档路径：`docs/RELEASE-PLAYBOOK.md` · 经 GB/Lorin 审阅后作为 Gallery 发版权威 checklist。*
