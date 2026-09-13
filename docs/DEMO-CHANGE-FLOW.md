# DEMO 变更流程

Gallery 一条 DEMO 从想法到可讲，按下面五步交接。  
**合并 PR ≠ 上线。** 本文件不写门户 changelog、MaxKB 入库、Nginx、SSH / `/opt` 操作步骤。

demo-craft 侧「需求澄清 / 风格去 AI」清单以该 Agent **现行 checklist** 为准；下列为占位要点，可随后与其共同修订。

---

## 1. 需求澄清 — demo-craft

先定归属与目标，再动手改页面。

| 问清 | 要点 |
|---|---|
| 客户 vs 内部 | 具名客户交付 / 售前 / POC → `audience: client`。帆软横向、FDE、简道云产品秀 → **一律内部**，不是客户案例 |
| 演示目标 | 一把手看板 / 经营闭环 / 运营销售 / PoC / 平台能力；对应 `hall` |
| 必须保留的事实 | 客户名、产品名、关键数字、红线（不能编、不能换成别的客户故事） |
| 形态 | 桌面 / 手机；是否已有 `family` 历史版要归档 |

例外：客户交付但壳是简道云（如 `jiangyuan-rd-pm`）仍标 **client**，由 catalog `audience` + `CLIENT_OVERRIDE_IDS` 裁定，不因壳子改成内部。

---

## 2. 风格 / 去 AI — demo-craft

投影可讲，且不要看起来像生成物。

- 字号与对比够投屏；少装饰、少水印、少「智能助手正在为您…」腔
- 视觉跟主馆 `web/assets/gallery.css` 色板即可，不要另起暖色/深色皮肤
- **禁止**把简道云 / FDE / 帆软横向误写成客户案例标题或精选卡
- 清单细项（字号、色板、禁用词）留给 demo-craft 现行 checklist；此处不另立合同

---

## 3. 入库 — gallery-ops

静态包进仓库，并登记目录。

1. 文件落 `demos/<id>/`（`id` 小写短横线；历史修订用 `family__revN` / `__baseline`）
2. 改 `catalog.json`，**必填**：`id, title, client, industry, hall, type, summary, tags, entry, source`
3. `audience`：`client` \| `internal`
4. `tags` **恰好 4 个**，顺序：`[行业, 业务域, 核心内容, 补充]`（词表见 `meta.tag_policy`）
5. 封面：列表 `thumb.webp`（约 800×500）、详情 `cover.webp`（1600×1000）。归档 stub 缺封面可为 warn-only，不要造假图
6. 同系列：`family` + 现行 `is_latest: true`；历史版 `archived: true` 且 `is_latest: false`（见 `demos/CLEANUP.md` 壁仞财务 rev）
7. `featured: true` **仅客户 DEMO**。帆软 / FDE / 简道云内部永不精选
8. 重建索引：`python3 scripts/build_search_index.py --demos-dir demos`
9. 校验：`python3 scripts/validate_catalog.py`  
   catalog 有改动则 `meta.version` 补丁 +1，并更新 `updated_at`

归档修订**不进**默认 latest 池，只出现在该 `family` 现行卡的 Archive 面板。

---

## 4. 验收 — gallery-ops

| 检查 | 通过标准 |
|---|---|
| 卡片 | 标题、客户、4 标签与 catalog 一致 |
| 封面 | 列表 thumb 能 200；缺图走已有回退，不发明封面 |
| 精选 | `featured` 只有 client；内部卡不进精选区 |
| 归属 | 侧栏 / 筛选：客户 vs 内部不串馆 |
| 归档 | `__rev*` / `__baseline` 不在主列表 latest；Archive 可打开历史包 |
| 入口 | 登录后 `/api/catalog.json` 含该 `id`，卡片可点进 `entry` |

---

## 5. 上线 — GB 编排 + Lorin 批准 + release-ops

1. Cloud Agent 开 PR；GB 读 diff / 校验输出
2. **Lorin 明确批准**后才进入 release-ops
3. release-ops 推 ECS，并同步 **runtime current**（只改模块目录不够：`catalog.json` + `search_index.json` 必须落到线上实际读取的 release 指针）
4. 本步不包含门户公告、MaxKB、Nginx 改法——那些走各自既有通道，不在本流程展开

**合并 ≠ 上线。** 未同步 runtime current 时，主页「目录更新」日期不会变。
