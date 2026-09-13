# 弹药工作台 v10 — 开发进度

> 最后更新: 2026-07-16  
> 项目路径: `/Users/lorin/Documents/造弹药专项/统一检索/`

---

## 一、项目概述

为帆软上海售前团队（徐文浩/Lorin）构建的智能检索工作台，整合三大数据源：

| 数据源 | 说明 | 接入方式 |
|--------|------|----------|
| **本地弹药库** | 249条（半导体156 + 财务93） | 嵌入 HTML，TF-IDF 检索引擎 |
| **FICO MCP** | 财务知识库，同事开发的 MCP 应用 | `localhost:8748` Node.js 代理 → 远程 `47.116.68.38:8747` |
| **Knowhow API** | 帆软内部案例/方案/材料库 | 直连 `digitchat.fanruan.com/dataset/api/v1/retrieve` |

---

## 二、当前版本 v10

### 文件
- **主文件**: `统一检索/v10.html` (776KB，单文件，file:// 直接打开)
- **FICO 代理**: `财务专项/scripts/fico-proxy.mjs` (Node.js, 端口 8748)
- **FICO 启动脚本**: `start-fico.command`
- **构建脚本**: `/tmp/build_v10_final3.py` (Python)
- **引擎模板**: `/tmp/v10_engine.js`
- **数据**: `/tmp/v10_data.json` (从 v9 提取的 249 条数据)

### 架构
```
v10.html (file:// 打开)
├── 本地检索引擎 (TF-IDF, 249条内嵌数据)
│   ├── 搜索框 + 搜索运算符 (domain:/type:/tag:/-排除)
│   ├── 域Tab (全部/半导体/财务) + 快捷筛选
│   ├── 搜索结果卡片 → 点击打开详情面板
│   └── 详情面板 (要点总结/关键数据/完整描述/产品匹配/相关内容)
├── FICO 按钮 → 右侧抽屉
│   └── 调用 localhost:8748/api/fico-search
├── Knowhow 按钮 → 右侧抽屉
│   └── 直连 digitchat.fanruan.com/dataset/api/v1/retrieve
├── 对话检索模式 (中文 bigram 语义匹配)
├── 一键弹药包 (22个预设客户)
├── 竞品对标矩阵
├── 搜索历史 (localStorage)
├── 复制简报 / 导出MD
├── 亮/暗主题切换
└── 键盘快捷键 (Ctrl+K 搜索, Ctrl+T 主题, Esc 关闭面板)
```

### 已实现功能
- [x] TF-IDF 全文检索引擎 + 模糊匹配
- [x] 搜索运算符 (domain:semi, type:case, tag:SPC, -排除)
- [x] 域Tab + 快捷筛选 Chip
- [x] 智能标签推荐
- [x] 关键数据提取 (Insights Banner)
- [x] 领域分布条形图
- [x] 搜索结果分页
- [x] 详情面板 (要点总结/关键数据/完整描述/产品匹配/相关内容)
- [x] FICO MCP 检索 (右侧抽屉)
- [x] Knowhow 案例检索 (右侧抽屉, 直连API)
- [x] 对话检索 (中文 bigram 语义匹配)
- [x] 一键弹药包 (22个预设客户, PPT大纲生成)
- [x] 竞品对标矩阵 (帆软 vs SAP/PowerBI/永洪)
- [x] 搜索历史 (localStorage)
- [x] 复制简报 (格式化Markdown, 可粘贴微信/邮件)
- [x] 导出 Markdown
- [x] 亮/暗主题 (自动检测 + 手动切换)
- [x] 键盘快捷键
- [x] 默认展示推荐弹药 (12条高重要度条目)

---

## 三、待办事项

### 高优先级
- [ ] FICO/Knowhow 抽屉按钮的 onclick 引号转义问题 (可能仍存在, 需要验证)
- [ ] FICO 搜索结果格式优化 (目前只返回1条"预算", 内容解析需改善)
- [ ] Knowhow 搜索结果点击跳转链接验证
- [ ] 整体 UI 精简 (减少不必要的元素)

### 中优先级
- [ ] 搜索准确度持续优化 (税务/财务类关键词匹配)
- [ ] FICO 代理自动检测 + 一键启动
- [ ] 对话检索准确度提升
- [ ] 结果排序增加按日期/类型排序
- [ ] 多选对比功能完善

### 低优先级
- [ ] 打印友好样式
- [ ] 移动端适配优化
- [ ] SkillOpt 集成 (已安装, 需配置Benchmark)
- [ ] 数据自动更新 (当前静态嵌入, 需改为动态加载)

---

## 四、如何运行

### 启动 FICO MCP 代理
```bash
cd ~/Documents/造弹药专项/财务专项
node scripts/fico-proxy.mjs
# 代理运行在 localhost:8748
```

### 打开弹药工作台
```bash
open ~/Documents/造弹药专项/统一检索/v10.html
```
或通过代理: `http://localhost:8748/` (如果 FICO 代理启动了静态服务)

### 注意
- 旧的 `unified_search_proxy.py` (端口8765) **已废弃**, 不再使用
- 旧的 `通用检索工作台.html` **已废弃**, 不再使用
- FICO 仅指 `localhost:8748` 的 MCP 代理, 不是任何旧页面

---

## 五、关键决策记录

1. **FICO 不是通用检索工作台** — FICO 是同事开发的 MCP 应用 (远程 47.116.68.38:8747), 通过本地 Node.js 代理 (8748) 桥接
2. **Knowhow 直连 API** — 绕过代理, 直接 HTTPS 调用 digitchat.fanruan.com, API key 硬编码在 v10 中
3. **单文件架构** — v10 是单个 HTML 文件, 数据内嵌, 可用 file:// 直接打开
4. **file:// CORS 限制** — 从 file:// 无法发 fetch 到 http://, 所以 FICO 检测用 iframe, Knowhow 用 fetch (从 http:// 打开时可用)
5. **SkillOpt 已安装** — Python 3.12 venv 在 `~/.skillopt-venv/`, 已训练一轮优化 pi profile (+0.067 提升)

---

## 六、已知问题

1. **FICO 搜索结果少** — MCP 返回的 `fico_search` 结果 content 长度大但解析为1条, 需优化 parseFicoHits
2. **onclick 引号转义** — 使用 `&apos;` 替代单引号, 需验证浏览器兼容性
3. **file:// 下的 FICO 检测** — iframe 方式不可靠, 建议始终显示按钮并在抽屉内处理错误
4. **数据静态嵌入** — 更新知识库需重新构建 v10.html

---

## 七、迭代规则

1. 每次 pi 会话结束后更新此文档
2. 新会话开始时先读此文档了解进度
3. 版本号: v10 → v11 → v12 ...
4. 每个新版本保存为独立文件: `v11.html`, `v12.html` ...
5. 构建脚本和引擎模板路径固定: `/tmp/build_v10_final3.py`, `/tmp/v10_engine.js`, `/tmp/v10_data.json`
