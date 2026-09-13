/** 财经驾驶舱 · 五层穿透体系 */
const CockpitLevels = {
  l1: { code: 'L1', name: '公司总览', desc: '决策层一屏掌握经营全貌' },
  l2: { code: 'L2', name: '经营成效', desc: 'ROE / 盈利 / 收入 / 成本成效' },
  l3: { code: 'L3', name: '业务结果', desc: '分业务 · 分组织 · 分产品结果' },
  l4: { code: 'L4', name: '专题分析', desc: '结构 · 趋势 · 杜邦深度分解' },
  l5: { code: 'L5', name: '下钻穿透', desc: '明细钻取 · 联动 · 填报' },

  /** 页面 → 层级 */
  pageLevel: {
    wall: 'l1', l1: 'l1',
    'dupont-site': 'l2', profit: 'l2', revenue: 'l2', cost: 'l2', dupont: 'l2',
    'rev-overview': 'l3', 'rev-wafer': 'l3', 'rev-top20': 'l3',
    'cost-total': 'l3', 'cost-layer': 'l3', 'cost-org': 'l3',
    'profit-detail': 'l3', 'dupont-site-result': 'l3',
    'rev-kpi': 'l4', 'cost-struct': 'l4', 'profit-trend': 'l4',
    'dupont-tree': 'l4',
    'rev-drill': 'l5', 'cost-link': 'l5',
    'dupont-table': 'l5'
  },

  label(code) {
    const c = String(code).toUpperCase();
    const key = c.toLowerCase();
    return this[key] ? `${this[key].code} ${this[key].name}` : c;
  },

  nav: [
    {
      level: 'l1', label: 'L1 公司总览',
      items: [
        { href: 'index.html', page: 'wall', icon: '▦', label: '原型总览墙' },
        { href: 'l1-cockpit.html', page: 'l1', icon: '◉', label: '财经驾驶舱总览' }
      ]
    },
    {
      level: 'l2', label: 'L2 经营成效',
      items: [
        { href: 'dupont-site.html', page: 'dupont-site', icon: '▣', label: '杜邦 · ROE分解' },
        { href: 'profit.html', page: 'profit', icon: '▣', label: '盈利效率分析' },
        { href: 'revenue.html', page: 'revenue', icon: '▣', label: '收入达成分析' },
        { href: 'cost.html', page: 'cost', icon: '▣', label: '成本管控分析' }
      ]
    },
    {
      level: 'l3', label: 'L3 业务结果',
      items: [
        { href: 'revenue.html#overview', page: 'rev-overview', icon: '▹', label: '收入总览' },
        { href: 'revenue.html#wafer', page: 'rev-wafer', icon: '▹', label: '晶圆收入' },
        { href: 'cost.html#total', page: 'cost-total', icon: '▹', label: '总成本分析' },
        { href: 'cost.html#layer', page: 'cost-layer', icon: '▹', label: '总成本 / Layer' },
        { href: 'profit.html', page: 'profit-detail', icon: '▹', label: '盈利结构看板' },
        { href: 'dupont-site.html', page: 'dupont-site-result', icon: '▹', label: '杜邦 · Site 结果' },
        { href: 'revenue.html#wafer', page: 'rev-top20', icon: '▹', label: 'TOP20 · 客户结果' },
        { href: 'cost.html#total', page: 'cost-org', icon: '▹', label: '制造费用 · 组织' }
      ]
    },
    {
      level: 'l4', label: 'L4 专题分析',
      items: [
        { href: 'dupont-tree.html', page: 'dupont-tree', icon: '▸', label: '杜邦 · 九层分解树' },
        { href: 'revenue.html', page: 'rev-kpi', icon: '▸', label: 'KPI · 同比环比' },
        { href: 'cost.html', page: 'cost-struct', icon: '▸', label: '结构 · BU/FAB 圆环' },
        { href: 'profit.html', page: 'profit-trend', icon: '▸', label: '趋势 · 组织堆积' }
      ]
    },
    {
      level: 'l5', label: 'L5 下钻穿透',
      items: [
        { href: 'revenue.html#wafer', page: 'rev-drill', icon: '▸', label: '弹窗明细钻取' },
        { href: 'cost.html', page: 'cost-link', icon: '▸', label: '组织 · 科目联动' },
        { href: 'dupont-table.html', page: 'dupont-table', icon: '▸', label: '杜邦 · 108项填报' }
      ]
    }
  ]
};

window.CockpitLevels = CockpitLevels;
