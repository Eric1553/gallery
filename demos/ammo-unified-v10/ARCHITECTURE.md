# 统一检索引擎 v1 — 架构设计方案

> 造弹药专项 · 帆软上海售前团队  
> 设计日期: 2026-07-15  
> 设计师: 徐文浩 (Lorin)

---

## 1. 产品目标

为帆软售前顾问（以徐文浩为代表）构建一个**统一检索引擎**，整合**半导体知识库（112篇笔记）**和**FICO财务知识库（72项索引/273+篇文档）**两个知识域，在见客户前快速检索行业信息+财务弹药+产品方案。

### 核心指标
| 指标 | 目标值 | 测量方式 |
|------|--------|----------|
| 检索响应时间 | <100ms (本地) | 输入→结果渲染时长 |
| 首次命中率 | >90% (高频场景) | 预设弹药包关键词覆盖 |
| 域切换感知延迟 | <50ms | Tab切换→结果更新 |
| 零结果率 | <5% (合理输入) | 关键词词库覆盖 |

---

## 2. 用户画像与旅程

### 用户: 帆软售前顾问 (徐文浩)

**典型使用场景:**
1. **会前准备** (频率: 每天2-3次) — 输入客户行业+痛点，检索行业框架+标杆案例+产品方案
2. **方案撰写** (频率: 每周3-5次) — 检索Board Deck模板、交付物规范、方法论
3. **问答举证** (频率: 每天1-2次) — 客户问到专业概念时快速查找弹药
4. **日常学习** (频率: 每天1-2次) — 浏览新入库笔记、追踪行业动态

### 核心任务流
```
[打开页面] → [⌘K聚焦搜索] → [输入关键词] → [浏览结果卡片] → [点击跳转源页面]
                                      ↓
                              [切换域Tab过滤] → [细化关键词]
```

---

## 3. 技术架构

### 3.1 整体模式: 纯前端嵌入式搜索引擎

```
┌─────────────────────────────────────────────┐
│                 v1.html                      │
│  ┌───────────────────────────────────────┐  │
│  │          UI Layer (HTML+CSS)          │  │
│  │  SearchBar / DomainTabs / ResultCards │  │
│  ├───────────────────────────────────────┤  │
│  │       Search Engine (JavaScript)      │  │
│  │  Tokenizer → Matcher → Ranker → Render│  │
│  ├───────────────────────────────────────┤  │
│  │       Data Layer (Embedded JSON)      │  │
│  │    semiIndex[112] + finIndex[72]      │  │
│  └───────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
```

### 3.2 选型理由

| 方案 | 优点 | 缺点 | 决策 |
|------|------|------|------|
| **纯前端嵌入 (v1采用)** | 零依赖、本地秒开、无网络要求 | 数据量受限(<500条)、不支持语义搜索 | ✅ v1采用 |
| 本地代理+API (通用检索工作台) | 支持远程KMS、支持语义搜索 | 需运行proxy、依赖网络 | v2考虑 |
| 服务端索引 (Elasticsearch-like) | 大规模、全文检索、高可用 | 部署复杂、过度工程化 | 暂不采用 |

### 3.3 搜索算法

**v1: 多字段关键词匹配**

```
输入: "半导体 良率 SPC"
  ↓ 分词: ["半导体", "良率", "SPC"]
  ↓ 每项在每个item的searchText中做AND匹配
  ↓ searchText = title + desc + category + tags.join() + keywords
  ↓ 域过滤器: 根据当前Tab (all/semi/fin) 进一步筛选
  ↓ 结果: 最多40条, 按匹配字段优先级隐式排序
```

**搜索字段优先级 (隐式排序):**
1. title (精确命中权重最高)
2. keywords/tags (领域术语命中)
3. category/moduleName (域归属匹配)
4. desc (描述文本匹配)

### 3.4 数据流

```
用户输入 "合并报表"
  → searchInput.onInput
    → currentQuery = "合并报表"
    → doSearch()
      → 过滤: domainFilter(semi|fin|all)
      → 过滤: quickFilter(如果激活)
      → 匹配: 每个item.searchText.includes(每个word)
      → 渲染: buildCard() × min(40, hits.length)
        → 高亮: highlightText(title|desc, query词)
        → 赋值: domainBadge(semi|fin) + typeBadge + tagChips
      → 统计: resultMeta 更新命中数
```

---

## 4. UI设计系统

### 4.1 设计语言: "工程产品感" (Enterprise Engineering Aesthetic)

参考: Google Search + Linear + Vercel

| 属性 | 值 | 说明 |
|------|-----|------|
| 主字体 | PingFang SC / system-ui | 中文优先 |
| 背景 | #f7f8fc + 渐变光晕 | 轻量工程感 |
| 卡片 | #fff + 1px #e4e7f0 border + shadow | 清晰边界 |
| 圆角 | 14px (卡片) / 999px (标签) | 现代工程产品 |
| 域色 | 半导体=#4F46E5(indigo) / 财务=#059669(emerald) | 高区分度 |
| 搜索框 | 2px border + focus glow | Google式focus反馈 |

### 4.2 组件树

```
app
├── header (logo-row + header-stats)
├── search-section
│   ├── search-box (icon + input + clear + ⌘K hint)
│   ├── domain-tabs (全部 | 半导体 | 财务)
│   └── quick-filters (11个高频关键词chips)
├── result-meta (命中数统计)
├── results-container
│   ├── empty-state (初始引导 + 6个建议关键词)
│   ├── no-results (空结果提示)
│   └── result-card[] (动态生成, 最多40条)
│       ├── card-top-row (title + typeBadge + domainBadge)
│       ├── card-desc (描述 + 搜索词高亮)
│       └── card-footer (category chip + tag chips + @fico chip + link hint)
└── footer (3个源页面链接 + 版权)
```

### 4.3 交互规范

| 交互 | 触发方式 | 反馈 | 实现 |
|------|----------|------|------|
| 聚焦搜索 | ⌘K / 点击搜索框 | 2px brand边框 + glow阴影 | CSS :focus-within |
| 输入搜索 | 键盘输入 | 即时过滤 + 结果数更新 | oninput → doSearch() |
| 清除搜索 | ✕按钮 / Escape | 清空输入 + 重置初始态 | onclick / onkeydown |
| 切换域 | 点击Tab | Tab高亮 + 结果过滤 | onclick → currentDomain |
| 快速过滤 | 点击chip | chip高亮 + 填入输入框 + 过滤 | onclick → activeFilter |
| 跳转源页 | 点击卡片 | 新窗口打开源页面 | window.open(item.src) |
| 键盘导航 | ↑↓ Enter | (v2) 结果列表键盘选择 | v1未实现 |

---

## 5. 数据结构

### 5.1 半导体条目 (semiIndex)

```json
{
  "id": "s001",
  "domain": "semi",
  "title": "SPC与良率管理",
  "category": "晶圆制造",
  "tags": ["晶圆制造", "SPC", "良率管理"],
  "desc": "SPC统计过程控制...",
  "importance": "high",
  "src": "半导体知识库全景图.html"
}
```

**来源:** 半导体知识库全景图.html 中的 notesIndex 数组  
**条数:** 112条 (精选自86篇核心笔记 + 26篇MOC/模板/日报)  
**分类覆盖:** 晶圆制造(22) / 半导体设备(19) / IC设计(15) / 封装测试(15) / 帆软售前引擎(17) / 其他(24)

### 5.2 财务条目 (finIndex)

```json
{
  "id": "f001",
  "domain": "fin",
  "title": "半导体行业拜访弹药",
  "module": "02",
  "moduleName": "财务分析",
  "submodule": "行业研究",
  "desc": "IDM/Fabless/Foundry模式...",
  "tags": ["半导体", "行业框架", "拜访"],
  "keywords": "半导体 IDM Fabless Foundry 毛利率",
  "type": "query",
  "queryText": "@fico 半导体行业财务分析框架 核心指标",
  "src": "财务专项/index.html"
}
```

**来源:** 财务专项/data/search-index.json  
**条数:** 72条 (7条检索弹药 + 40条知识文档 + 10条标杆案例 + 4条业务场景 + 11条详细版)  
**模块覆盖:** 基础财务(25) / 财务分析(14) / 财务咨询(13) / 实战案例(20)

---

## 6. 性能预算

| 指标 | v1 目标 | 实际表现 |
|------|---------|----------|
| 首屏渲染 | <500ms | ~200ms (纯静态HTML) |
| 搜索过滤 | <50ms (184条) | ~5ms (内存数组过滤) |
| DOM渲染 | <100ms (40条卡片) | ~20ms (innerHTML批量) |
| 内存占用 | <5MB | ~2MB (数据+DOM) |
| 页面大小 | <80KB (HTML) | ~66KB |

---

## 7. v1 → v2 演进路线

| 能力 | v1 | v2 计划 |
|------|-----|---------|
| 搜索方式 | 关键词匹配 | + 模糊搜索 (Levenshtein) |
| 结果排序 | 隐式字段优先级 | + 显式TF-IDF相关度评分 |
| 键盘导航 | ⌘K only | + ↑↓Enter 选择结果 |
| 远程检索 | 无 | + @fico MCP 远程搜索集成 |
| 搜索结果 | 最多40条卡片 | + 无限滚动/分页 |
| 搜索历史 | 无 | localStorage 存储最近10条 |
| 数据更新 | 手动重新嵌入 | + JSON fetch 动态加载 |
| 移动适配 | 基础响应式 | + 移动端优化布局 |

---

## 8. 文件清单

| 文件 | 路径 | 说明 |
|------|------|------|
| v1.html | `/统一检索/v1.html` | 统一检索引擎主页 |
| 半导体知识库全景图.html | `/造弹药专项/../半导体知识库全景图.html` | 半导体域源页面 |
| FICO index.html | `/造弹药专项/财务专项/index.html` | 财务域源页面 |
| search-index.json | `/造弹药专项/财务专项/data/search-index.json` | 财务数据源 |
| 通用检索工作台.html | `/造弹药专项/通用检索工作台.html` | KMS+Knowhow远程检索引擎 |
