# DEMO 改动协作规范（一页）

面向：Lorin 提「改 / 新增 DEMO」→ demo-craft 澄清 → GB 派 gallery-ops 落地。  
本页只管需求、口径、验收。catalog 校验、封面压缩、search_index、ECS 由 gallery-ops / release-ops 做。demo-craft 不替代入库指令，不推 ECS。是否进仓库 docs/ 由 GB / gallery-ops 定。

## 角色

| 谁 | 做什么 | 不做什么 |
|---|---|---|
| Lorin | 丢模糊需求或当场拍板 | — |
| demo-craft | 复述假设、对照馆藏、出改动清单与验收 | 不开 PR、不改 catalog 工程、不推 ECS |
| GB | 方案确认后派 Cloud Agent；合并上线等 Lorin | 不把帆软产品包装成客户案例 |
| gallery-ops | 改 catalog.json / demos/<id>/、封面、校验 | 不改需求口径、不动 MaxKB |

## 1. Lorin 提需求 → demo-craft 澄清

先复述再改，缺一不派工。五个必答：

1. 场景：谁看（职务）、拜访还是内部复盘、要投屏哪一页 / 哪几个指标。
2. 客户 vs 内部：具名客户交付 = audience=client；内部弹药、横向产品、方法页 = internal。帆软 / FDE / 简道云一律内部，不写进客户 DEMO 标题、摘要、tags。
3. 馆区 hall：ceo 一把手 / 财经；ops 研发运营、销售、人效、IPD；poc 行业验证现场；platform Agentic / 弹药 / 检索；misc 方法与素材。
4. 去 AI 化：短句、可落地、带客户语境。禁「赋能 / 抓手 / 闭环堆砌 / 综上所述」。指标和故事优先于形容词。
5. 视觉 token（跟 gallery.css，不另起皮肤）：背景 #f3f6f9 · 正文 #15202b · 次要 #667687 · 主色 #0f766e · 辅色 #1d4e89 · 圆角 20px · 字体 Plus Jakarta Sans + Noto Sans SC。骨架：stage-bg + 毛玻璃顶栏 + 青绿渐变胶囊主按钮 + scene-chip。

对照馆内相近 DEMO：写清可复用的结构 / 文案，和必须避开的。

## 2. 方案确认 → gallery-ops 改 catalog / demos

demo-craft 交清单，GB 确认后只派 gallery-ops Cloud Agent 开 PR。清单字段一次给齐：id（已有则不改）、title、client、summary、type；audience、hall、featured（仅客户）、industry；tags 恰好 4 个 [行业, 业务域, 核心内容, 补充]；多条才挂 family + archived / is_latest（family 是系列号，不是客户名）；封面 thumb.webp ~800×500、cover.webp 1600×1000，不改就写「封面不动」；范围写死「只改 catalog」或列出 demos/<id>/ 文件；默认不动 MaxKB、search_index 密钥、部署脚本；meta.version 由你们按现网递增。  
合并 ≠ 上线。上线等 Lorin，GB / release-ops 切。

## 3. 验收标准模板

对象：<id>　范围：catalog only / catalog + 页内　馆区 / 受众：<hall> / client|internal

- [ ] Diff 不超出清单范围（无 MaxKB、无无关 demos）
- [ ] audience / hall / featured 符合；featured 仅 client
- [ ] tags 恰好 4 个，顺序 = 行业 / 业务域 / 核心内容 / 补充；客户 DEMO 不含 帆软 / FDE / 简道云
- [ ] 标题、摘要、卡片可见文案无套话，无产品名误包装
- [ ] 单条无 family；系列则 is_latest 仅一条，旧条 archived
- [ ] 视觉未另起皮肤；若改页，token 与骨架仍是 gallery 那套
- [ ] 封面：改则尺寸对；不改则文件未动
- [ ] 页内范围外的交互 / 文案未误伤
- [ ] PR 打开即可审；未私自推 ECS

## 示例 · 江原 jiangyuan-rd-pm（2026-09-13）

假设：客户拜访投屏，ops，audience=client，featured 不动。Lorin：第 4 tag 改成江原科技。  
对照：盛美 / 合见 — 客户名在 title 与 client。本单补充 = 江原科技。页内「对齐简道云」本轮不动。  
清单（只改 catalog，不挂 family）：tags 半导体 / 研发运营 / 项目管理 / 江原科技；title 江原科技 · 研发项目管理；summary 覆盖立项、计划、任务验收、Signoff、Exit、结项/中止，以及工时、费用与待办闭环。  
验收：PR #7 → catalog 1.6.3 已上线；标题 / 摘要无简道云；第 4 tag = 江原科技；demos/jiangyuan-rd-pm/** 未动。
