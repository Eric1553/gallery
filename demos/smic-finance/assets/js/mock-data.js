/** Mock 数据 — 财经驾驶舱原型 */
const MockData = {
  months: ['2025-01','2025-02','2025-03','2025-04','2025-05','2025-06','2025-07','2025-08','2025-09','2025-10','2025-11','2025-12'],
  bus: ['SMIC','SMIC-N','SMIC-S','Others'],
  fabs: ['Fab1','Fab2','Fab3','Fab4','Fab5','Fab6','Fab7','Fab8','Fab9','Fab10','Fab11','Fab12'],

  overview: {
    revenue: { value: 385.6, yoy: 12.3, mom: 3.2, rate: 94.8 },
    wafer: { value: 312.4, yoy: 14.1, mom: 2.8, rate: 96.2 },
    cost: { value: 198.5, yoy: 8.6, mom: 1.5, rate: 97.1 },
    profit: { value: 89.2, yoy: 18.5, mom: 4.1, rate: 92.3, margin: 23.1 },
    dupont: { roe: 8.42, yoy: 1.2, mom: 0.3 }
  },

  revenueKpis: [
    { label: '年累计销售收入', value: '385.6', unit: '亿元', yoy: '+12.3%', rate: '94.8%', highlight: true },
    { label: '销售收入', value: '32.8', unit: '亿元', yoy: '+8.5%', mom: '+2.1%' },
    { label: '晶圆销售收入', value: '26.5', unit: '亿元', yoy: '+10.2%', mom: '+1.8%' },
    { label: '光罩销售收入', value: '2.1', unit: '亿元', yoy: '+5.3%', mom: '-0.5%' },
    { label: '多元化收入', value: '1.8', unit: '亿元', yoy: '+15.6%', mom: '+3.2%' },
    { label: 'MPW 收入', value: '1.4', unit: '亿元', yoy: '+22.1%', mom: '+4.5%' },
    { label: '其他销售收入', value: '1.0', unit: '亿元', yoy: '-2.1%', mom: '+0.8%' }
  ],

  waferKpis: [
    { label: '年累计晶圆收入', value: '312.4', unit: '亿元', yoy: '+14.1%', rate: '96.2%', highlight: true },
    { label: '晶圆销售收入', value: '26.5', unit: '亿元', yoy: '+10.2%', mom: '+1.8%', target: '27.2' },
    { label: '出货量', value: '185.2', unit: '万片', yoy: '+8.6%', mom: '+2.3%' },
    { label: '平均销售单价', value: '1,431', unit: '元/片', yoy: '+1.5%', mom: '-0.4%' }
  ],

  revenueByBusiness: [
    { name: '晶圆', value: 26.5 },
    { name: '光罩', value: 2.1 },
    { name: '多元化', value: 1.8 },
    { name: 'MPW', value: 1.4 },
    { name: '其他', value: 1.0 }
  ],

  revenueByApp: [
    { name: '智能手机', value: 9.8 },
    { name: '物联网', value: 6.2 },
    { name: '汽车电子', value: 5.5 },
    { name: '消费电子', value: 4.8 },
    { name: '工业控制', value: 3.2 },
    { name: '其他', value: 3.3 }
  ],

  revenueByRegion: [
    { name: '中国大陆', value: 14.2 },
    { name: '北美', value: 8.5 },
    { name: '亚太', value: 5.8 },
    { name: '欧洲', value: 2.6 },
    { name: '其他', value: 1.7 }
  ],

  topCustomers: [
    { rank: 1, name: '客户 A', value: 4.82, prev: 4.56, ratio: 14.7 },
    { rank: 2, name: '客户 B', value: 3.65, prev: 3.42, ratio: 11.1 },
    { rank: 3, name: '客户 C', value: 2.98, prev: 2.85, ratio: 9.1 },
    { rank: 4, name: '客户 D', value: 2.45, prev: 2.12, ratio: 7.5 },
    { rank: 5, name: '客户 E', value: 2.12, prev: 1.98, ratio: 6.5 },
    { rank: 6, name: '客户 F', value: 1.88, prev: 1.75, ratio: 5.7 },
    { rank: 7, name: '客户 G', value: 1.65, prev: 1.52, ratio: 5.0 },
    { rank: 8, name: '客户 H', value: 1.42, prev: 1.38, ratio: 4.3 }
  ],

  trendActual: [28.2, 27.8, 29.1, 28.5, 30.2, 29.8, 31.5, 30.1, 31.8, 32.2, 31.6, 32.8],
  trendTarget: [29.0, 28.5, 29.5, 29.0, 30.5, 30.0, 31.8, 30.8, 32.0, 32.5, 32.0, 33.0],
  trendForecast: [null, null, null, null, null, null, null, null, null, null, 31.6, 32.8, 33.5, 34.2, 34.8],

  waferByProcess: [
    { name: 'FinFET', value: 12.5 },
    { name: '28nm', value: 6.8 },
    { name: '40nm', value: 3.2 },
    { name: '55nm', value: 2.1 },
    { name: '其他', value: 1.9 }
  ],

  waferByPlatform: [
    { name: 'Platform-A', value: 8.2 },
    { name: 'Platform-B', value: 6.5 },
    { name: 'Platform-C', value: 5.1 },
    { name: 'Platform-D', value: 4.2 },
    { name: '其他', value: 2.5 }
  ],

  costKpis: [
    { label: '现金制造费用', value: '18.6', unit: '亿元', yoy: '+6.2%', mom: '+1.2%' },
    { label: '折旧费用', value: '12.4', unit: '亿元', yoy: '+4.8%', mom: '+0.5%' },
    { label: '现金成本', value: '31.0', unit: '亿元', yoy: '+5.5%', mom: '+0.9%' },
    { label: '单层现金成本', value: '2,850', unit: '元/Layer', yoy: '-2.1%', mom: '-0.8%' },
    { label: '等效光刻层数', value: '10.9', unit: '层', yoy: '+3.2%', mom: '+0.3%' }
  ],

  costByOrg: {
    total: 29.0,
    tree: [
      {
        name: 'SMIC', value: 12.5,
        children: [
          { name: 'Fab1', value: 3.2 }, { name: 'Fab2', value: 2.8 },
          { name: 'Fab3', value: 2.5 }, { name: 'Fab4', value: 2.1 }
        ]
      },
      {
        name: 'SMIC-N', value: 8.2,
        children: [
          { name: 'Fab5', value: 1.9 }, { name: 'Fab6', value: 1.8 }, { name: 'Fab7', value: 1.6 }
        ]
      },
      {
        name: 'SMIC-S', value: 6.8,
        children: [
          { name: 'Fab8', value: 1.5 }, { name: 'Fab9', value: 1.4 }, { name: 'Fab10', value: 1.2 }
        ]
      },
      {
        name: 'Others', value: 1.5,
        children: [
          { name: 'Fab11', value: 1.0 }, { name: 'Fab12', value: 0.5 }
        ]
      }
    ],
    inner: [
      { name: 'SMIC', value: 12.5 },
      { name: 'SMIC-N', value: 8.2 },
      { name: 'SMIC-S', value: 6.8 },
      { name: 'Others', value: 1.5 }
    ],
    outer: [
      { name: 'Fab1', value: 3.2, bu: 'SMIC' }, { name: 'Fab2', value: 2.8, bu: 'SMIC' },
      { name: 'Fab3', value: 2.5, bu: 'SMIC' }, { name: 'Fab4', value: 2.1, bu: 'SMIC' },
      { name: 'Fab5', value: 1.9, bu: 'SMIC-N' }, { name: 'Fab6', value: 1.8, bu: 'SMIC-N' },
      { name: 'Fab7', value: 1.6, bu: 'SMIC-N' }, { name: 'Fab8', value: 1.5, bu: 'SMIC-S' },
      { name: 'Fab9', value: 1.4, bu: 'SMIC-S' }, { name: 'Fab10', value: 1.2, bu: 'SMIC-S' },
      { name: 'Fab11', value: 1.0, bu: 'Others' }, { name: 'Fab12', value: 0.5, bu: 'Others' }
    ]
  },

  costStructure: [
    { name: '折旧费用', value: 12.4, level: 1 },
    { name: '先进制造费用', value: 6.2, level: 1 },
    { name: '直接人工', value: 4.8, level: 2 },
    { name: '间接人工', value: 3.2, level: 2 },
    { name: '物料消耗', value: 2.6, level: 3 },
    { name: '能源动力', value: 2.1, level: 3 }
  ],

  profitKpis: [
    { label: '标准毛利', value: '92.5', unit: '亿元', yoy: '+16.2%', mom: '+3.8%' },
    { label: 'Variance', value: '-3.3', unit: '亿元', yoy: '-', mom: '+0.5' },
    { label: '毛利', value: '89.2', unit: '亿元', yoy: '+18.5%', mom: '+4.1%', target: '96.6' },
    { label: '毛利率', value: '23.1', unit: '%', yoy: '+1.2pp', mom: '+0.4pp' }
  ],

  profitByOrg: [
    { bu: 'SMIC', fabs: [
      { name: 'Fab1', value: 12.5 }, { name: 'Fab2', value: 10.2 },
      { name: 'Fab3', value: 8.6 }, { name: 'Fab4', value: 6.8 }
    ]},
    { bu: 'SMIC-N', fabs: [
      { name: 'Fab5', value: 9.2 }, { name: 'Fab6', value: 7.5 },
      { name: 'Fab7', value: 5.8 }
    ]},
    { bu: 'SMIC-S', fabs: [
      { name: 'Fab8', value: 8.1 }, { name: 'Fab9', value: 6.4 },
      { name: 'Fab10', value: 4.2 }
    ]}
  ],

  dupontSite: {
    roe: 8.42,
    nodes: [
      { name: '净资产收益率 ROE', value: '8.42%', yoy: '+1.2', mom: '+0.3', level: 0 },
      { name: '销售净利率', value: '18.5%', yoy: '+0.8', mom: '+0.2', level: 1, link: true },
      { name: '总资产周转率', value: '0.52', yoy: '+0.03', mom: '+0.01', level: 1, link: true },
      { name: '权益乘数', value: '1.87', yoy: '-0.02', mom: '0', level: 1, link: true },
      { name: '净利润', value: '71.2亿', level: 2, link: true },
      { name: '营业收入', value: '385.6亿', level: 2, link: true },
      { name: '总资产', value: '1,482亿', level: 2, link: true },
      { name: '所有者权益', value: '792亿', level: 2, link: true }
    ]
  },

  dupontIndicators: [
    { name: '净资产收益率', current: 8.42, prev: 8.12, yoyPrev: 7.22, ytd: 8.35, yoyYtd: 7.18 },
    { name: '销售净利率', current: 18.5, prev: 17.8, yoyPrev: 16.2, ytd: 18.2, yoyYtd: 16.5 },
    { name: '总资产周转率', current: 0.52, prev: 0.51, yoyPrev: 0.48, ytd: 0.51, yoyYtd: 0.47 },
    { name: '权益乘数', current: 1.87, prev: 1.89, yoyPrev: 1.92, ytd: 1.88, yoyYtd: 1.91 }
  ]
};

window.MockData = MockData;
