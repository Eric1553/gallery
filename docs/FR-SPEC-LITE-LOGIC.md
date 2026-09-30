# FR 模板解析台 · 资产网关逻辑复现笔记（fr-spec-lite）

> 状态：设计冻结 / 实现暂停（2026-09-13，Lorin）  
> 目标：在 ECS `/fr-parse` **轻量复现**资产网关确定性解析链路，**不**安装大内存 Gateway Docker，**不**整包复用解析器代码。  
> 参考交付包：`asset-gateway-v8.4.1-x86-cpt-frm-fvs-delivery-r1`；PPT：`资产网关V8.0版本介绍材料.pptx`。

## 1. 产品逻辑（来自 PPT / 交付包）

资产网关把「物理报表文件」蒸馏成 Agent 可消费的结构化资产，而不是让大模型直接读原始 CPT/FVS。

分层（L0→L6，精简）：

| 层 | 角色 | 输入 → 输出 |
|---|---|---|
| L0 扫描探针 | 确定对象 | 目录/元信息 → 候选文件+指纹 |
| L1 物理资产 | 保留源 | `.cpt`/`.frm`/`.fvs` → 原文缓存 |
| L2 解析插件 | **确定性抽取** | XML/ZIP → 元数据字典（数据集/SQL/参数/组件） |
| L3 Spec | 单资产描述 | 元数据 → **BI-Spec**（core + extensions） |
| L4 Registry | 全局目录 | Spec → 扁平注册卡（检索/路由） |
| L5 应用服务 | API/MCP/控制台 | Registry+Spec → 业务接口 |
| L6 交互 | 人/Agent | 控制台 / MCP / Agent |

核心原则：

- 解析、校验、注册、路由 **不依赖 LLM**（规则 + Schema + 文件索引）。
- Agent 看到的是「已校验并注册的资产目录」，不是脏目录里的散文件。
- 生产南向读 FR 平台资源靠 **FR 插件 + protocol v4**；本解析台场景是 **本地上传文件**，只需复现 L2→L3（及结果投影），不必上完整 Gateway。

## 2. BI-Spec 目标形态（v2.2）

交付镜像内 schema：`bi-spec-v2.2.json`。

- **`core`**（跨工具稳定）：`asset_id`, `name`, `source_tool`, `asset_type`, `version`, `parser_version`, `description`, `business_domain`, `tags`, `tables[]`, `relationships[]`, 时间戳…
- **`extensions.<tool>`**（工具私有）：FineReport 下含 datasets/sql、parameters、cells/bindings、layout、FVS 专有块、warnings 等。

蒸馏价值：上层统一看「报表 / 数据集 / 参数 / 指标 / 血缘」，而不是各厂商私有文件格式。

## 3. 现网 `/fr-parse`（暂停前基线）

| 项 | 现状 |
|---|---|
| 入口 | 门户 `/fr-parse/`（nginx `auth_request` → Gallery gate） |
| 编排 | `demo-portal` → `scripts/fr_parse_api.py` |
| 解析 | **Pi Skill** `fr-template-parse`（Agent 启发式解压/读 XML），明确禁止维护型 `parse_fr_*.py` |
| 产物 | `asset` + `model` + 可选 bridge-pack（FBN） |
| 缺口 | 非确定性；无 BI-Spec；API 未接 `.frm`；无资产网关 |

## 4. 拟定复现方案：`fr-spec-lite`（未完成实现）

默认引擎 `FR_PARSE_ENGINE=fr-spec-lite`，可切回 `pi-skill`。

### 4.1 CPT / FRM（XML）

确定性抽取目标（对齐网关 MetadataExtractor 思路，自行重写）：

- `TableData` → 数据集名 / class / connection / `Query` SQL / 列
- 参数与参数面板控件；字典集（`DatabaseDictionary` 等）
- 单元格：`DSColumn` / Formula / 文本 / 图；Expand 父子格
- SQL → 物理表血缘（优先 AST，否则正则）；字段级血缘与过滤条件（能抽则抽）
- fail-soft：单步失败记 `warnings`，不阻断

### 4.2 FVS（ZIP）

- 解包 `editor.tpl`（内嵌 TableDataMap + store JSON）、`*.chart` / `*.ec`
- 数据集规则同 CPT；组件/图表优先 `configFile`→`.chart` 绑定
- `asset_type=dashboard`；extensions.finereport.fvs 记录覆盖与诊断摘要

### 4.3 输出契约

每个文件：

```json
{
  "ok": true,
  "engine": "fr-spec-lite",
  "bi_spec": { "core": {}, "extensions": { "finereport": {} } },
  "asset": { "...": "投影，兼容现 UI / KMS 资产卡" },
  "model": { "...": "投影，兼容 bridge-pack" },
  "warnings": []
}
```

Job 级仍写 `progress.json` / `result.json`；Pi 仅作可选润色，不再当主解析器。

## 5. 明确不做（本阶段）

- 不在 ECS 安装/启动 `bi-asset-gateway` Docker（内存约 3.5G，默认限额 4G；包标注 Not Ready for Production）
- 不整包拷贝 `bi-asset-pipeline` / FVS M2 入口
- 不改 MaxKB 密码；不上 FR 平台插件扫 reportlets（除非后续单独立项）

## 6. ECS 残留

曾尝试安装的半截目录：`/opt/asset-gateway/`（含 `NOTE-ABORTED.txt`）。**保持停用**，后续若清理可整目录删除。

## 7. 参考路径（运维侧，非本仓库）

- 交付包与 PPT（本机）
- 现网 skill：ECS `/opt/pi-agent/skills/fr-template-parse/`
- 门户 fr-parse：ECS `/opt/demo-portal/web/fr-parse` + `scripts/fr_parse_api.py`

## 8. 恢复实现时检查清单

1. 落地 `scripts/fr_spec_lite/`（bi_spec / cpt_xml / fvs_zip / project / engine）于门户侧
2. `fr_parse_api.py` 默认 `fr-spec-lite`，接受 `.frm`
3. UI 展示 `bi_spec.core` 摘要
4. 用样本 CPT 冒烟：无 Pi、无 Gateway 容器出 Spec
5. 将本文状态更新为「已上线」
