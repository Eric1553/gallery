# 盛美研发运营看板 · v4.6

依据：客户 Excel 未覆盖项（R21 / R34 / R40–R43）· DEMO id：`acme-rd`

## v4.6 本轮

- **临港外部需求（R21）**：部门从扁平列表改为演示组织树。湿法产品部可展开下一级（湿法-CMP / Clean / ECP / Bevel）；柱图随展开切到下级。月度趋势仍为申请数量。完成率脚注：演示按申请月归属。标明非生产组织主数据。
- **机台状态（R34）**：在 Pre Setup→RLS 之外增加 CRM 运行态：运行中 / 维护中 / 停机（KPI + 按产品柱图 + Site×产品表）。顶栏 Site / 产品类型筛选同步这块演示切片。保留腔体开启率 / uptime 卡片与脚注。不下钻空腔体表。
- **Layer RLS vendor（R40）**：汇总表改为 POR机台数 | ACM机台数 | ACM / TEL / DNS / LAM 分列台数（演示，未接生产 CRM）。
- **ACM未涉及（R41）**：Layer RLS 下增加演示清单 + 填报（Site / 产品型号 / vendor / Count / Remark）。脚注：生产走 CRM Tool application 或填报。
- **Step 明细（R42）**：下钻列/KV 补全 验证进度、LOOP、STAGE、STEP_DESC、Recipe、Recipe Detail、Group分类、POR品牌、Remark；保留 CSV 下载。
- **By Site 对标字段（R43）**：Site 行展开后增加第二块表：基准机台 / 配置 / 技术节点 / Released / 验证成功(未量产) / 验证失败 / 验证中 / Capacity / No capa / Total / 量产占比 / Capacity Ratio。标 演示 · 未接生产 CRM。
- 版本芯片 v4.5 → v4.6。浅色主题未改。

## 未纳入

- 自动生成 PPT / AI 报告。
- 生产 CRM API / 真实组织主数据 / 真实 vendor 数量。
- 未改 catalog.json / 封面 / 其他 DEMO / 不推 ECS。

## v4.5 仍有效

- 各模块顶栏年 / 季 / 月；Wet-RD 表可切换维度；知识库学习人次多维度；人力技能等级与 IC 交叉筛选；Site 默认演示全集；腔体开启率 / uptime；出机计划独立页签。
