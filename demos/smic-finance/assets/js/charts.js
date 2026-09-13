/** 图表初始化 — 浅色主题 + 安全渲染 */
const Charts = {
  _instances: [],
  _pending: [],

  /** 浅色驾驶舱统一 tooltip，避免白底白字 / 撑满图表 */
  _tooltipBase(extra = {}) {
    return {
      className: 'cockpit-chart-tooltip',
      appendToBody: true,
      renderMode: 'richText',
      backgroundColor: 'rgba(255,255,255,0.98)',
      borderColor: '#d9dfe8',
      borderWidth: 1,
      padding: [8, 12],
      textStyle: { color: '#1f2d3d', fontSize: 12 },
      extraCssText: 'box-shadow:0 4px 14px rgba(15,39,64,0.12);color:#1f2d3d!important;width:auto!important;height:auto!important;',
      confine: true,
      ...extra,
      textStyle: { color: '#1f2d3d', fontSize: 12, ...(extra.textStyle || {}) }
    };
  },

  _itemTipFormatter(params) {
    const p = Array.isArray(params) ? params[0] : params;
    if (!p) return '';
    const pct = p.percent != null ? ` (${p.percent}%)` : '';
    return `${p.name}\n${p.value} 亿元${pct}`;
  },

  _withTooltip(option) {
    if (option.tooltip === false) return option;
    const tip = option.tooltip || {};
    const base = this._tooltipBase();
    return {
      ...option,
      tooltip: {
        ...base,
        ...tip,
        textStyle: { ...base.textStyle, ...(tip.textStyle || {}) },
        ...(tip.trigger === 'axis' || (!tip.trigger && option.xAxis)
          ? { axisPointer: { type: 'shadow', shadowStyle: { color: 'rgba(0,82,147,0.06)' }, label: { backgroundColor: '#fff', color: '#1f2d3d', borderColor: '#d9dfe8' }, ...(tip.axisPointer || {}) } }
          : {})
      }
    };
  },

  init(el, option) {
    if (!el) return null;
    if (typeof echarts === 'undefined') {
      el.innerHTML = '<div class="chart-empty">图表库未加载，请确认 assets/js/echarts.min.js 存在</div>';
      return null;
    }

    const applySize = () => {
      el.style.width = '100%';
      el.style.minWidth = '1px';
      const h = el.classList.contains('lg') ? '380px' : el.classList.contains('sm') ? '240px' : '280px';
      if (!el.style.height || el.offsetHeight < 20) el.style.height = h;
      el.style.minHeight = el.classList.contains('lg') ? '320px' : el.classList.contains('sm') ? '200px' : '220px';
    };

    const hasSize = () => el.offsetWidth >= 20 && el.offsetHeight >= 20;

    const render = () => {
      applySize();
      if (!hasSize()) return null;
      let chart = echarts.getInstanceByDom(el);
      if (chart) chart.dispose();
      try {
        chart = echarts.init(el, null, { renderer: 'canvas' });
      } catch (e) {
        el.innerHTML = `<div class="chart-empty">图表初始化失败：${e.message}</div>`;
        return null;
      }

      const axisStyle = {
        xAxis: {
          axisLine: { lineStyle: { color: '#d9dfe8' } },
          axisLabel: { color: '#5a6b7d', fontSize: 10 },
          splitLine: { show: false }
        },
        yAxis: {
          axisLine: { show: false },
          axisLabel: { color: '#5a6b7d', fontSize: 10 },
          splitLine: { lineStyle: { color: '#eef1f6', type: 'dashed' } }
        }
      };

      const theme = (typeof Cockpit !== 'undefined' && Cockpit.chartTheme) ? Cockpit.chartTheme : {};
      const merged = this._withTooltip({ ...theme, ...option });
      if (option.xAxis) {
        merged.xAxis = Array.isArray(option.xAxis)
          ? option.xAxis
          : { ...axisStyle.xAxis, ...option.xAxis, type: option.xAxis.type || 'category' };
      }
      if (option.yAxis) {
        merged.yAxis = Array.isArray(option.yAxis)
          ? option.yAxis.map(y => ({ ...axisStyle.yAxis, ...y, type: y.type || 'value' }))
          : { ...axisStyle.yAxis, ...option.yAxis, type: option.yAxis.type || 'value' };
      }

      try {
        chart.setOption(merged, true);
      } catch (e) {
        console.error('[Charts.setOption]', e);
        el.innerHTML = `<div class="chart-empty">图表配置错误：${e.message}</div>`;
        return null;
      }

      this._instances.push(chart);
      this._pending = this._pending.filter(p => p.el !== el);
      requestAnimationFrame(() => { try { chart.resize(); } catch (_) {} });
      return chart;
    };

    const tryRender = (attempt = 0) => {
      applySize();
      if (hasSize()) return render();
      if (attempt >= 48) {
        this._pending.push({ el, option });
        return null;
      }
      const delay = attempt < 16 ? 0 : 50;
      setTimeout(() => tryRender(attempt + 1), delay);
      return null;
    };

    return tryRender();
  },

  /** 根据容器尺寸与数据量计算饼图布局，避免标签与图例重叠 */
  _pieLayout(el, data, opts = {}) {
    const isSm = el?.classList?.contains('sm');
    const isLg = el?.classList?.contains('lg');
    const count = data.length;
    const donut = !!opts.donut;
    const hideLabel = !!opts.hideLabel;
    const legendPos = opts.legend || 'auto';

    const legendBase = {
      itemWidth: 10,
      itemHeight: 10,
      textStyle: { fontSize: isSm ? 10 : 11, color: '#5a6b7d' }
    };

    if (donut) {
      return {
        legend: {
          ...legendBase,
          orient: 'vertical',
          right: isSm ? 2 : 8,
          top: 'middle',
          itemGap: isSm ? 6 : 8
        },
        center: [isSm ? '34%' : '36%', '50%'],
        radius: isSm ? ['36%', '54%'] : ['40%', '60%'],
        label: {
          show: !hideLabel,
          fontSize: 10,
          color: '#5a6b7d',
          formatter: '{b}'
        },
        labelLine: { show: false }
      };
    }

    const useRightLegend = legendPos === 'right' || legendPos === 'auto' && (isSm || count >= 5);
    if (useRightLegend) {
      return {
        legend: {
          ...legendBase,
          orient: 'vertical',
          right: 0,
          top: 'middle',
          itemGap: 5,
          formatter: name => (name.length > 6 ? name.slice(0, 5) + '…' : name)
        },
        center: [isSm ? '36%' : '40%', '50%'],
        radius: isSm ? '46%' : '52%',
        label: {
          show: !hideLabel,
          fontSize: 10,
          color: '#5a6b7d',
          formatter: '{d}%',
          position: 'outside',
          alignTo: 'edge',
          edgeDistance: 6,
          bleedMargin: 4
        },
        labelLine: {
          length: 6,
          length2: 4,
          smooth: 0.2,
          lineStyle: { color: '#d9dfe8' }
        }
      };
    }

    const legendRows = Math.ceil(count / 4);
    const centerY = isLg ? 46 : Math.max(36, 44 - legendRows * 3);
    const radiusPct = isLg ? 58 : Math.max(34, 48 - legendRows * 4);

    return {
      legend: {
        ...legendBase,
        orient: 'horizontal',
        bottom: 4,
        left: 'center',
        itemGap: isSm ? 8 : 12,
        padding: [2, 4, 0, 4]
      },
      center: ['50%', `${centerY}%`],
      radius: `${radiusPct}%`,
      label: {
        show: !hideLabel,
        fontSize: 10,
        color: '#5a6b7d',
        formatter: '{b}\n{d}%',
        position: 'outside',
        alignTo: 'labelLine',
        edgeDistance: 8,
        bleedMargin: 6
      },
      labelLine: {
        length: 8,
        length2: 6,
        smooth: 0.2,
        lineStyle: { color: '#d9dfe8' }
      }
    };
  },

  pie(el, data, opts = {}) {
    const palette = ['#005293', '#1a6cb3', '#4a9fd4', '#6bb8e0', '#8cadc8', '#b0c9de'];
    const colored = data.map((d, i) => ({
      name: d.name, value: d.value,
      itemStyle: { color: d.color || palette[i % palette.length] }
    }));
    const layout = this._pieLayout(el, data, opts);

    return this.init(el, {
      color: palette,
      tooltip: {
        trigger: 'item',
        formatter: params => this._itemTipFormatter(params)
      },
      legend: layout.legend,
      series: [{
        type: 'pie',
        radius: layout.radius,
        center: layout.center,
        data: colored,
        avoidLabelOverlap: true,
        minShowLabelAngle: 12,
        labelLayout: { hideOverlap: true },
        label: layout.label,
        labelLine: layout.labelLine,
        itemStyle: { borderColor: 'rgba(255,255,255,0.85)', borderWidth: 1 },
        emphasis: {
          scale: false,
          focus: 'self',
          itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,82,147,0.18)' }
        }
      }]
    });
  },

  bar(el, categories, series, opts = {}) {
    const hasLegend = series.length > 1;
    const chart = this.init(el, {
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      legend: hasLegend ? { data: series.map(s => s.name), top: 4, left: 'center', itemGap: 14, textStyle: { fontSize: 11 } } : undefined,
      grid: { left: 48, right: 16, top: hasLegend ? 40 : 24, bottom: categories.length > 6 ? 36 : 28 },
      xAxis: { type: 'category', data: categories, axisLabel: { fontSize: 10, interval: 0, rotate: categories.length > 6 ? 20 : 0 } },
      yAxis: { type: 'value', name: opts.yName || '亿元', nameTextStyle: { fontSize: 10 } },
      series: series.map(s => ({
        type: 'bar', name: s.name, data: s.data, stack: s.stack,
        itemStyle: { color: s.color, borderRadius: s.stack ? 0 : [3, 3, 0, 0] },
        barMaxWidth: 32
      }))
    });
    if (opts.onClick && chart) chart.on('click', opts.onClick);
    return chart;
  },

  line(el, categories, series, opts = {}) {
    const hasLegend = series.length > 1;
    const chart = this.init(el, {
      tooltip: { trigger: 'axis' },
      legend: hasLegend ? { data: series.map(s => s.name), top: 4, left: 'center', itemGap: 14, textStyle: { fontSize: 11 } } : undefined,
      grid: { left: 48, right: series.some(s => s.yAxisIndex) ? 48 : 16, top: hasLegend ? 40 : 28, bottom: 28 },
      xAxis: { type: 'category', data: categories, boundaryGap: opts.boundaryGap !== false },
      yAxis: { type: 'value', name: opts.yName || '' },
      series: series.map(s => ({
        type: s.type || 'line', name: s.name, data: s.data, smooth: true, yAxisIndex: s.yAxisIndex || 0,
        lineStyle: { type: s.dashed ? 'dashed' : 'solid', width: 2 },
        itemStyle: { color: s.color },
        areaStyle: s.area ? { color: s.color, opacity: 0.12 } : undefined,
        barMaxWidth: s.type === 'bar' ? 18 : undefined
      }))
    });
    return chart;
  },

  comboTrend(el, monthLabels, actualEndIndex) {
    const actual = MockData.trendActual;
    const target = MockData.trendTarget;
    const end = actualEndIndex ?? 9;
    const n = monthLabels.length;

    const actualData = monthLabels.map((_, i) => (i <= end ? (actual[i] ?? actual[actual.length - 1]) : null));
    const targetData = monthLabels.map((_, i) => target[i] ?? target[target.length - 1]);
    const lastActual = actual[Math.min(end, actual.length - 1)];
    const forecastData = monthLabels.map((_, i) => {
      if (i <= end) return null;
      return +(lastActual + (i - end) * 0.55 + Math.sin(i) * 0.3).toFixed(1);
    });

    return this.init(el, {
      tooltip: { trigger: 'axis' },
      legend: { data: ['实际', '目标', '预测'], top: 4, left: 'center', itemGap: 14 },
      grid: { left: 48, right: 16, top: 42, bottom: 32 },
      xAxis: { type: 'category', data: monthLabels, axisLabel: { fontSize: 10, rotate: monthLabels.length > 12 ? 30 : 0 } },
      yAxis: { type: 'value', name: '亿元' },
      series: [
        { type: 'bar', name: '实际', data: actualData, itemStyle: { color: '#1890ff', borderRadius: [3,3,0,0] }, barMaxWidth: 16 },
        { type: 'bar', name: '目标', data: targetData, itemStyle: { color: '#91caff', borderRadius: [3,3,0,0] }, barMaxWidth: 16 },
        { type: 'line', name: '预测', data: forecastData, lineStyle: { type: 'dashed', color: '#fa8c16', width: 2 }, itemStyle: { color: '#fa8c16' }, symbol: 'circle', symbolSize: 6 }
      ]
    });
  },

  /** BU→FAB 双层圆环：同色系层级、外层无标签、图例仅 BU */
  orgNestedRing(el, orgTree, opts = {}) {
    const buPalette = {
      'SMIC':    { base: '#005293', shades: ['#005293', '#1a6a9e', '#3378a8', '#4d86b2'] },
      'SMIC-N':  { base: '#1a6cb3', shades: ['#1a6cb3', '#3d82c0', '#5f98cd', '#81aeda'] },
      'SMIC-S':  { base: '#4a9fd4', shades: ['#4a9fd4', '#6bb0dc', '#8cc1e4', '#add2ec'] },
      'Others':  { base: '#8cadc8', shades: ['#8cadc8', '#a3bdd4', '#bacee0'] }
    };

    const inner = orgTree.map(bu => ({
      name: bu.name,
      value: bu.value,
      itemStyle: { color: buPalette[bu.name]?.base || '#8cadc8' }
    }));

    const outer = [];
    orgTree.forEach(bu => {
      const pal = buPalette[bu.name] || buPalette.Others;
      (bu.children || []).forEach((fab, i) => {
        outer.push({
          name: fab.name,
          value: fab.value,
          bu: bu.name,
          itemStyle: { color: pal.shades[i % pal.shades.length] }
        });
      });
    });

    const total = orgTree.reduce((s, b) => s + b.value, 0);

    const chart = this.init(el, {
      tooltip: {
        trigger: 'item',
        formatter(p) {
          if (p.seriesIndex === 0) {
            return `${p.name}\n制造费用：${p.value} 亿元\n占比：${p.percent}%`;
          }
          const bu = p.data.bu || '';
          return `${p.name}${bu ? ' · ' + bu : ''}\n制造费用：${p.value} 亿元\n占比：${p.percent}%`;
        }
      },
      legend: {
        orient: 'horizontal',
        bottom: 8,
        left: 'center',
        data: inner.map(d => d.name),
        itemWidth: 10,
        itemHeight: 10,
        itemGap: 14,
        textStyle: { color: '#5a6b7d', fontSize: 11 }
      },
      graphic: [{
        type: 'group', left: 'center', top: '38%',
        children: [
          { type: 'text', style: { text: total.toFixed(1), fill: '#005293', font: '600 20px PingFang SC, Microsoft YaHei', textAlign: 'center' }, top: -14, left: 'center' },
          { type: 'text', style: { text: '亿元', fill: '#8c98a8', font: '12px PingFang SC, Microsoft YaHei', textAlign: 'center' }, top: 10, left: 'center' }
        ]
      }],
      series: [
        {
          type: 'pie', name: 'BU', radius: ['26%', '38%'], center: ['50%', '40%'],
          data: inner,
          label: {
            show: true, position: 'inside', fontSize: 11, color: '#fff', fontWeight: 500,
            formatter: '{b}\n{d}%'
          },
          labelLine: { show: false },
          itemStyle: { borderColor: 'rgba(255,255,255,0.85)', borderWidth: 1.5 },
          emphasis: { scale: false, focus: 'self', itemStyle: { shadowBlur: 8, shadowColor: 'rgba(0,82,147,0.15)' } }
        },
        {
          type: 'pie', name: 'FAB', radius: ['42%', '56%'], center: ['50%', '40%'],
          data: outer,
          label: { show: false },
          labelLine: { show: false },
          itemStyle: { borderColor: 'rgba(255,255,255,0.85)', borderWidth: 1 },
          emphasis: { scale: false, label: {
            show: true, fontSize: 11, fontWeight: 500, color: '#1f2d3d',
            formatter: '{b}'
          }}
        }
      ]
    });

    if (chart) {
      chart.on('click', p => {
        const label = document.getElementById(opts.labelId || 'org-drill-label');
        const bu = p.data.bu || p.name;
        if (label) label.textContent = `当前选中：${p.name}${p.data.bu ? ' · ' + p.data.bu : ''}（${p.value} 亿元，${p.percent}%）`;
        document.dispatchEvent(new CustomEvent('cockpit:orgSelect', {
          detail: { name: p.name, bu, series: p.seriesName, value: p.value }
        }));
      });
      chart.on('mouseover', p => {
        if (p.seriesIndex !== 1 || !p.data.bu) return;
        chart.dispatchAction({ type: 'highlight', seriesIndex: 0, name: p.data.bu });
      });
      chart.on('mouseout', () => {
        chart.dispatchAction({ type: 'downplay', seriesIndex: 0 });
      });
    }
    return chart;
  },

  /** 对比型双层圆环（当期/对比期），两色系 */
  nestedRing(el, inner, outer, opts = {}) {
    const colorsA = ['#005293', '#1a6cb3', '#4a9fd4', '#8cadc8'];
    const colorsB = ['#b8cfe0', '#c9daea', '#dbe7f3', '#eef3f8'];

    const innerData = inner.map((d, i) => ({
      ...d, itemStyle: { color: colorsA[i % colorsA.length] }
    }));
    const outerData = outer.map((d, i) => ({
      ...d, itemStyle: { color: colorsB[i % colorsB.length] }
    }));

    return this.init(el, {
      tooltip: {
        trigger: 'item',
        formatter: params => this._itemTipFormatter(params)
      },
      legend: {
        bottom: 8, left: 'center', itemWidth: 10, itemHeight: 10, itemGap: 12,
        textStyle: { fontSize: 11, color: '#5a6b7d' }
      },
      series: [
        {
          type: 'pie', radius: ['24%', '36%'], center: ['50%', '42%'],
          data: innerData, label: { show: true, fontSize: 10, color: '#fff', position: 'inside' },
          itemStyle: { borderColor: 'rgba(255,255,255,0.85)', borderWidth: 1 },
          emphasis: { scale: false, itemStyle: { shadowBlur: 8, shadowColor: 'rgba(0,82,147,0.15)' } }
        },
        {
          type: 'pie', radius: ['40%', '52%'], center: ['50%', '42%'],
          data: outerData, label: { show: false },
          itemStyle: { borderColor: 'rgba(255,255,255,0.85)', borderWidth: 1 },
          emphasis: { scale: false, label: { show: true, fontSize: 10, color: '#1f2d3d' } }
        }
      ]
    });
  },

  stackedBar(el, categories, seriesData) {
    return this.init(el, {
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      legend: { top: 4, left: 'center', itemGap: 12, textStyle: { fontSize: 10 } },
      grid: { left: 48, right: 16, top: 44, bottom: 28 },
      xAxis: { type: 'category', data: categories },
      yAxis: { type: 'value', name: '亿元' },
      series: seriesData.map((s, i) => ({
        type: 'bar', name: s.name, stack: 'total', data: s.data,
        itemStyle: { color: ['#005293', '#1a6cb3', '#4a9fd4', '#6bb8e0', '#8cadc8'][i % 5] },
        barMaxWidth: 36
      }))
    });
  },

  tree(el, data) {
    return this.init(el, {
      tooltip: { trigger: 'item' },
      series: [{
        type: 'tree', data: [data], top: 24, bottom: 24, left: 60, right: 100,
        symbolSize: 10, orient: 'TB',
        label: { color: '#1f2d3d', fontSize: 11, backgroundColor: '#fff', padding: [4, 8], borderRadius: 4, borderColor: '#e4e8ef', borderWidth: 1 },
        lineStyle: { color: '#91caff', width: 1.5, curveness: 0.4 },
        itemStyle: { color: '#1890ff', borderColor: '#005293' },
        expandAndCollapse: true, initialTreeDepth: 3,
        emphasis: { focus: 'descendant' }
      }]
    });
  },

  resizeAll() {
    this._instances.forEach(c => { try { c.resize(); } catch(e) {} });
    document.querySelectorAll('.chart-box').forEach(el => {
      const inst = typeof echarts !== 'undefined' ? echarts.getInstanceByDom(el) : null;
      if (inst) inst.resize();
    });
    if (this._pending.length) {
      const queue = [...this._pending];
      this._pending = [];
      queue.forEach(({ el, option }) => {
        if (el && el.isConnected && !echarts.getInstanceByDom(el)) this.init(el, option);
      });
    }
  }
};

document.addEventListener('DOMContentLoaded', () => setTimeout(() => Charts.resizeAll(), 300));
window.addEventListener('resize', () => Charts.resizeAll());
window.Charts = Charts;
