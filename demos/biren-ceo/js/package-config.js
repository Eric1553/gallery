/** 客户演示包配置（ceo-dashboard-客户演示包） */
window.DASHBOARD_PACKAGE = {
  id: 'demo',
  demo: true,
  titleSuffix: '（客户演示包）',
  brandSub: 'CEO 决策看板 · 演示版',
  cacheKey: 'biren-ceo-intel-cache-demo-v3gate',
  refreshSteps: [
    { pct: 10, text: '连接 MOSS 情报服务…', eta: '约 15 秒' },
    { pct: 35, text: '检索政策 / 竞品 / 产业舆情…', eta: '约 12 秒' },
    { pct: 60, text: '检索客户 / 品牌舆情…', eta: '约 8 秒' },
    { pct: 82, text: '过滤噪声并组装情报包…', eta: '约 3 秒' },
    { pct: 100, text: '刷新完成', eta: '' },
  ],
  successToast: (count, warn) => `MOSS 实时刷新完成 · ${count} 条${warn || ''}`,
  fallbackToast: (count, errors) => {
    const hint = errors?.[0] ? `（${errors[0]}）` : '';
    return `非实时：已加载本地基线 · ${count} 条${hint}`;
  },
};
