/** 杜邦分析 · 结构化 Mock 数据 */
const DupontData = {
  sites: [
    { id: 'group', name: '集团合并' },
    { id: 'smic', name: 'SMIC' },
    { id: 'smic-n', name: 'SMIC-N' },
    { id: 'smic-s', name: 'SMIC-S' }
  ],

  coreKpis: {
    roe: { value: 8.42, unit: '%', yoy: 1.2, mom: 0.3 },
    npm: { value: 18.5, unit: '%', yoy: 0.8, mom: 0.2 },
    tat: { value: 0.52, unit: '', yoy: 0.03, mom: 0.01 },
    em: { value: 1.87, unit: '', yoy: -0.02, mom: 0 }
  },

  pyramid: [
    { id: 'roe', name: '净资产收益率 ROE', value: '8.42%', yoy: '+1.2pp', mom: '+0.3pp', level: 0, highlight: true },
    { id: 'npm', name: '销售净利率', value: '18.5%', yoy: '+0.8pp', mom: '+0.2pp', level: 1, link: true, anchor: 'detail-npm' },
    { id: 'tat', name: '总资产周转率', value: '0.52', yoy: '+0.03', mom: '+0.01', level: 1, link: true, anchor: 'detail-tat' },
    { id: 'em', name: '权益乘数', value: '1.87', yoy: '-0.02', mom: '0', level: 1, link: true, anchor: 'detail-em' },
    { id: 'profit', name: '净利润', value: '71.2 亿', level: 2, link: true, anchor: 'detail-profit' },
    { id: 'revenue', name: '营业收入', value: '385.6 亿', level: 2, link: true, anchor: 'detail-revenue' },
    { id: 'cost', name: '营业成本', value: '296.4 亿', level: 2, link: true },
    { id: 'assets', name: '总资产', value: '1,482 亿', level: 2, link: true, anchor: 'detail-assets' },
    { id: 'equity', name: '所有者权益', value: '792 亿', level: 2, link: true, anchor: 'detail-equity' },
    { id: 'tax', name: '所得税费用', value: '8.6 亿', level: 3, link: false },
    { id: 'finance', name: '财务费用', value: '12.3 亿', level: 3, link: false }
  ],

  /** Site 视图 · 四层杜邦架构（三柱分解） */
  architecture: {
    root: {
      id: 'roe', name: '净资产收益率', abbr: 'ROE', value: '8.42%', unit: '',
      yoy: '+1.2pp', mom: '+0.3pp', level: 'L0'
    },
    branches: [
      {
        id: 'profit', label: '盈利能力', theme: 'profit',
        factor: {
          id: 'npm', name: '销售净利率', value: '18.5%', yoy: '+0.8pp', mom: '+0.2pp',
          formula: '净利润 ÷ 营业收入', level: 'L1', link: true
        },
        ratio: [
          { id: 'netprofit', name: '净利润', value: '71.2 亿', level: 'L2', link: true },
          { id: 'revenue1', name: '营业收入', value: '385.6 亿', level: 'L2', link: true }
        ],
        detail: [
          { id: 'cost', name: '营业成本', value: '296.4 亿', level: 'L3' },
          { id: 'expense', name: '期间费用', value: '36.2 亿', level: 'L3' },
          { id: 'tax', name: '所得税费用', value: '8.6 亿', level: 'L3' }
        ]
      },
      {
        id: 'turnover', label: '运营效率', theme: 'turn',
        factor: {
          id: 'tat', name: '总资产周转率', value: '0.52 次', yoy: '+0.03', mom: '+0.01',
          formula: '营业收入 ÷ 总资产', level: 'L1', link: true
        },
        ratio: [
          { id: 'revenue2', name: '营业收入', value: '385.6 亿', level: 'L2', link: true },
          { id: 'assets1', name: '总资产', value: '1,482 亿', level: 'L2', link: true }
        ],
        detail: [
          { id: 'ca', name: '流动资产', value: '425.6 亿', level: 'L3' },
          { id: 'lta', name: '长期经营资产', value: '1,206 亿', level: 'L3' },
          { id: 'inv', name: '存货净额', value: '124.4 亿', level: 'L3', link: true }
        ]
      },
      {
        id: 'leverage', label: '财务杠杆', theme: 'lev',
        factor: {
          id: 'em', name: '权益乘数', value: '1.87', yoy: '-0.02', mom: '0',
          formula: '总资产 ÷ 所有者权益', level: 'L1', link: true
        },
        ratio: [
          { id: 'assets2', name: '总资产', value: '1,482 亿', level: 'L2', link: true },
          { id: 'equity', name: '所有者权益', value: '792 亿', level: 'L2', link: true }
        ],
        detail: [
          { id: 'liab', name: '总负债', value: '690 亿', level: 'L3' },
          { id: 'debt', name: '有息债务', value: '285.6 亿', level: 'L3' },
          { id: 'oci', name: '其他综合收益', value: '12.5 亿', level: 'L3', link: true, fill: true }
        ]
      }
    ]
  },

  roeTrend: {
    months: ['08', '09', '10', '11', '12', '01', '02', '03', '04', '05', '06', '07'],
    roe: [7.1, 7.3, 7.5, 7.6, 7.8, 7.9, 8.0, 8.1, 8.2, 8.3, 8.35, 8.42],
    npm: [16.8, 17.0, 17.2, 17.5, 17.8, 18.0, 18.1, 18.2, 18.3, 18.4, 18.45, 18.5],
    tat: [0.46, 0.47, 0.48, 0.48, 0.49, 0.50, 0.50, 0.51, 0.51, 0.52, 0.52, 0.52]
  },

  siteCompare: [
    { site: '集团合并', roe: 8.42, npm: 18.5, tat: 0.52, em: 1.87 },
    { site: 'SMIC', roe: 9.12, npm: 19.2, tat: 0.55, em: 1.82 },
    { site: 'SMIC-N', roe: 7.85, npm: 17.8, tat: 0.48, em: 1.92 },
    { site: 'SMIC-S', roe: 7.28, npm: 16.5, tat: 0.51, em: 1.88 }
  ],

  indicatorRows: [
    { name: '净资产收益率 ROE', cat: 'core', src: 'formula', current: 8.42, prev: 8.12, yoyPrev: 7.22, ytd: 8.35, yoyYtd: 7.18, fill: false },
    { name: '销售净利率', cat: 'core', src: 'formula', current: 18.5, prev: 17.8, yoyPrev: 16.2, ytd: 18.2, yoyYtd: 16.5, fill: false },
    { name: '总资产周转率', cat: 'core', src: 'formula', current: 0.52, prev: 0.51, yoyPrev: 0.48, ytd: 0.51, yoyYtd: 0.47, fill: false },
    { name: '权益乘数', cat: 'core', src: 'formula', current: 1.87, prev: 1.89, yoyPrev: 1.92, ytd: 1.88, yoyYtd: 1.91, fill: false },
    { name: '净利润', cat: 'profit', src: 'sys', current: 71.2, prev: 68.5, yoyPrev: 62.8, ytd: 485.6, yoyYtd: 428.2, fill: false },
    { name: '营业收入', cat: 'profit', src: 'sys', current: 385.6, prev: 372.1, yoyPrev: 348.5, ytd: 2580, yoyYtd: 2380, fill: false },
    { name: '营业成本', cat: 'profit', src: 'sys', current: 296.4, prev: 288.2, yoyPrev: 275.6, ytd: 1985, yoyYtd: 1852, fill: false },
    { name: '毛利', cat: 'profit', src: 'formula', current: 89.2, prev: 83.9, yoyPrev: 72.9, ytd: 595, yoyYtd: 528, fill: false },
    { name: '毛利率', cat: 'profit', src: 'formula', current: 23.1, prev: 22.5, yoyPrev: 20.9, ytd: 23.1, yoyYtd: 22.2, fill: false },
    { name: '销售费用', cat: 'profit', src: 'sys', current: 2.8, prev: 2.6, yoyPrev: 2.4, ytd: 18.5, yoyYtd: 16.8, fill: false },
    { name: '管理费用', cat: 'profit', src: 'sys', current: 8.5, prev: 8.2, yoyPrev: 7.8, ytd: 58.2, yoyYtd: 54.5, fill: false },
    { name: '研发费用', cat: 'profit', src: 'sys', current: 12.6, prev: 11.8, yoyPrev: 10.5, ytd: 85.2, yoyYtd: 78.6, fill: false },
    { name: '财务费用', cat: 'profit', src: 'sys', current: 12.3, prev: 11.5, yoyPrev: 10.2, ytd: 82.5, yoyYtd: 75.8, fill: false },
    { name: '所得税费用', cat: 'profit', src: 'sys', current: 8.6, prev: 8.2, yoyPrev: 7.5, ytd: 58.5, yoyYtd: 52.2, fill: false },
    { name: '总资产', cat: 'asset', src: 'sys', current: 1482, prev: 1458, yoyPrev: 1385, ytd: 1482, yoyYtd: 1385, fill: false },
    { name: '流动资产合计', cat: 'asset', src: 'sys', current: 425.6, prev: 412.3, yoyPrev: 398.5, ytd: 425.6, yoyYtd: 398.5, fill: false },
    { name: '货币资金', cat: 'asset', src: 'sys', current: 156.8, prev: 148.2, yoyPrev: 142.5, ytd: 156.8, yoyYtd: 142.5, fill: false },
    { name: '应收账款净额', cat: 'asset', src: 'sys', current: 68.5, prev: 65.2, yoyPrev: 58.8, ytd: 68.5, yoyYtd: 58.8, fill: false },
    { name: '存货净额', cat: 'asset', src: 'sys', current: 124.4, prev: 118.6, yoyPrev: 115.2, ytd: 124.4, yoyYtd: 115.2, fill: false },
    { name: '存货周转天数', cat: 'asset', src: 'formula', current: 86, prev: 88, yoyPrev: 92, ytd: 87, yoyYtd: 91, fill: false },
    { name: '长期经营资产净额', cat: 'asset', src: 'mix', current: 1206, prev: 1185, yoyPrev: 1128, ytd: 1206, yoyYtd: 1128, fill: false },
    { name: '固定资产净额', cat: 'asset', src: 'sys', current: 882.4, prev: 856.2, yoyPrev: 812.5, ytd: 882.4, yoyYtd: 812.5, fill: false },
    { name: '在建工程', cat: 'asset', src: 'sys', current: 279.7, prev: 245.8, yoyPrev: 198.6, ytd: 279.7, yoyYtd: 198.6, fill: false },
    { name: '无形资产', cat: 'asset', src: 'sys', current: 43.9, prev: 42.5, yoyPrev: 40.2, ytd: 43.9, yoyYtd: 40.2, fill: false },
    { name: '12英寸生产机净额占比', cat: 'asset', src: 'formula', current: 48.2, prev: 46.5, yoyPrev: 42.8, ytd: 47.5, yoyYtd: 43.2, fill: false },
    { name: '总负债', cat: 'liability', src: 'sys', current: 690, prev: 682, yoyPrev: 658, ytd: 690, yoyYtd: 658, fill: false },
    { name: '有息债务', cat: 'liability', src: 'sys', current: 285.6, prev: 278.2, yoyPrev: 265.8, ytd: 285.6, yoyYtd: 265.8, fill: false },
    { name: '应付款项', cat: 'liability', src: 'sys', current: 82.5, prev: 78.6, yoyPrev: 72.3, ytd: 82.5, yoyYtd: 72.3, fill: false },
    { name: '合同负债', cat: 'liability', src: 'sys', current: 45.8, prev: 42.5, yoyPrev: 38.6, ytd: 45.8, yoyYtd: 38.6, fill: false },
    { name: '所有者权益', cat: 'equity', src: 'sys', current: 792, prev: 776, yoyPrev: 727, ytd: 792, yoyYtd: 727, fill: false },
    { name: '股本', cat: 'equity', src: 'sys', current: 79.2, prev: 79.2, yoyPrev: 79.2, ytd: 79.2, yoyYtd: 79.2, fill: false },
    { name: '资本公积', cat: 'equity', src: 'sys', current: 285.6, prev: 282.1, yoyPrev: 278.5, ytd: 285.6, yoyYtd: 278.5, fill: false },
    { name: '其他综合收益', cat: 'equity', src: 'manual', current: 12.5, prev: 8.2, yoyPrev: 5.6, ytd: 12.5, yoyYtd: 5.6, fill: true },
    { name: '少数股东权益', cat: 'equity', src: 'sys', current: 118.5, prev: 115.2, yoyPrev: 108.6, ytd: 118.5, yoyYtd: 108.6, fill: false },
    { name: '少数股东权益变动', cat: 'equity', src: 'manual', current: 2.8, prev: 2.5, yoyPrev: 2.1, ytd: 18.5, yoyYtd: 15.2, fill: true },
    { name: '冗余评估调整', cat: 'equity', src: 'manual', current: -1.2, prev: -0.8, yoyPrev: -0.5, ytd: -1.2, yoyYtd: -0.5, fill: true },
    { name: '净债务余额', cat: 'fund', src: 'formula', current: 42.5, prev: 45.2, yoyPrev: 52.8, ytd: 42.5, yoyYtd: 52.8, fill: false },
    { name: 'EBITDA', cat: 'fund', src: 'formula', current: 128.6, prev: 122.5, yoyPrev: 108.2, ytd: 865, yoyYtd: 785, fill: false },
    { name: '利息及汇兑收益', cat: 'fund', src: 'sys', current: 3.2, prev: 2.8, yoyPrev: 2.5, ytd: 21.5, yoyYtd: 18.2, fill: false }
  ],

  categories: [
    { id: 'core', name: '一、杜邦核心指标' },
    { id: 'profit', name: '二、利润表相关' },
    { id: 'asset', name: '三、资产与周转' },
    { id: 'liability', name: '四、负债相关' },
    { id: 'equity', name: '五、所有者权益' },
    { id: 'fund', name: '六、资金与债务' }
  ],

  treeFull: {
    name: 'ROE 8.42%', children: [
      { name: '销售净利率 18.5%', children: [
        { name: '净利润 71.2亿', children: [
          { name: '营业收入 385.6亿' }, { name: '营业成本 296.4亿' },
          { name: '期间费用 36.2亿', children: [
            { name: '销售费用 2.8亿' }, { name: '管理费用 8.5亿' }, { name: '研发费用 12.6亿' }, { name: '财务费用 12.3亿' }
          ]}, { name: '所得税 8.6亿' }
        ]}
      ]},
      { name: '总资产周转率 0.52', children: [
        { name: '营业收入 385.6亿', children: [
          { name: '总资产 1,482亿', children: [
            { name: '流动资产 425.6亿', children: [{ name: '存货 124.4亿' }, { name: '应收 68.5亿' }, { name: '货币资金 156.8亿' }] },
            { name: '长期经营资产 1,206亿', children: [{ name: '固定资产 882.4亿' }, { name: '在建工程 279.7亿' }, { name: '无形资产 43.9亿' }] }
          ]}
        ]}
      ]},
      { name: '权益乘数 1.87', children: [
        { name: '总资产 1,482亿', children: [
          { name: '所有者权益 792亿', children: [{ name: '股本 79.2亿' }, { name: '资本公积 285.6亿' }, { name: '其他综合收益 12.5亿' }] },
          { name: '总负债 690亿', children: [{ name: '有息债务 285.6亿' }, { name: '应付款项 82.5亿' }, { name: '合同负债 45.8亿' }] }
        ]}
      ]}
    ]
  },

  longTermAssets: [
    { type: '固定资产', avg: 856.2, cmp: 812.5, add: 68.5, transfer: 52.3, dep: -45.2, disp: -2.1, current: 882.4 },
    { type: '在建工程', avg: 245.8, cmp: 198.6, add: 86.2, transfer: -52.3, dep: 0, disp: 0, current: 279.7 },
    { type: '无形资产', avg: 42.5, cmp: 40.2, add: 3.2, transfer: 0, dep: -1.8, disp: 0, current: 43.9 },
    { type: '使用权资产', avg: 28.6, cmp: 26.8, add: 2.5, transfer: 0, dep: -1.2, disp: 0, current: 29.8 }
  ],

  inventory: [
    { type: '原材料', avg: 52.3, current: 55.8, cmp: 48.2, diff: 7.6, pct: 15.8 },
    { type: '在产品', avg: 38.5, current: 42.1, cmp: 36.8, diff: 5.3, pct: 14.4 },
    { type: '产成品', avg: 28.2, current: 26.5, cmp: 30.1, diff: -3.6, pct: -12.0 },
    { type: '备品备件', avg: 5.4, current: 5.8, cmp: 5.2, diff: 0.6, pct: 11.5 }
  ],

  equityItems: [
    { type: '股本', current: 79.2, cmp: 79.2, src: '系统' },
    { type: '资本公积', current: 285.6, cmp: 282.1, src: '系统' },
    { type: '盈余公积', current: 156.8, cmp: 148.5, src: '系统' },
    { type: '未分配利润', current: 245.2, cmp: 228.6, src: '系统' },
    { type: '其他综合收益', current: 12.5, cmp: 8.2, src: '填报' },
    { type: '少数股东权益', current: 118.5, cmp: 115.2, src: '系统' }
  ],

  payablesTop: [
    { name: '供应商 A', balance: 8.52, ratio: 22.5 },
    { name: '供应商 B', balance: 6.28, ratio: 16.6 },
    { name: '供应商 C', balance: 5.15, ratio: 13.6 },
    { name: '供应商 D', balance: 4.82, ratio: 12.7 },
    { name: '供应商 E', balance: 3.65, ratio: 9.6 }
  ],

  fundKpis: [
    { label: '库存资金余额', value: 156.8, unit: '亿' },
    { label: '净债务余额', value: 42.5, unit: '亿' },
    { label: 'EBITDA', value: 128.6, unit: '亿' },
    { label: '利息及汇兑收益', value: 3.2, unit: '亿' },
    { label: '有息债务/EBITDA', value: 2.22, unit: 'x' },
    { label: '净债务/EBITDA', value: 0.33, unit: 'x' }
  ]
};

window.DupontData = DupontData;
