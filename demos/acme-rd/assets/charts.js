/* High-fidelity SVG chart engine v4.3 — vivid ops palette, tight canvas, motion */
(function () {
  // 高对比运营色：蓝 / 青 / 琥珀 / 红，避免灰蓝「廉价模板感」
  const COLORS = ['#0057d9', '#00a8a8', '#e85d04', '#d62828', '#023e8a', '#48cae4', '#fb8500', '#1d3557'];
  let uidCounter = 0;

  // 旧色映射到 v4.3 醒目色，不再压成灰蓝
  const COLOR_MAP = {
    '#0ea5e9': '#00a8a8', '#10b981': '#00a8a8', '#8b5cf6': '#023e8a',
    '#f59e0b': '#e85d04', '#ef4444': '#d62828', '#3b82f6': '#0057d9',
    '#60a5fa': '#48cae4', '#a78bfa': '#023e8a', '#2563eb': '#0057d9',
    '#0891b2': '#00a8a8', '#059669': '#00a8a8', '#0f766e': '#00a8a8',
    '#7c3aed': '#023e8a', '#0d9488': '#00a8a8', '#d97706': '#e85d04',
    '#1d4e89': '#0057d9', '#3b6ea5': '#0057d9', '#5b7c99': '#00a8a8',
    '#b45309': '#e85d04', '#b42318': '#d62828'
  };

  let tooltipEl = null;
  const observers = new WeakMap();

  function normColor(c) {
    if (!c) return c;
    const lc = c.toLowerCase().trim();
    return COLOR_MAP[lc] || c;
  }

  function lighten(hex, pct) {
    if (!hex || hex.startsWith('rgb')) return hex || '#1d4e89';
    const n = parseInt(hex.slice(1), 16);
    const r = Math.min(255, (n >> 16) + pct);
    const g = Math.min(255, ((n >> 8) & 0xff) + pct);
    const b = Math.min(255, (n & 0xff) + pct);
    return `rgb(${r},${g},${b})`;
  }

  function parseColor(raw) {
    if (!raw) return null;
    const m = raw.match(/#[0-9a-fA-F]{3,8}|rgb\([^)]+\)/);
    return m ? normColor(m[0]) : null;
  }

  function formatVal(v, unit, asPercent) {
    const n = typeof v === 'number' ? v : parseFloat(v);
    if (Number.isNaN(n)) return '';
    if (unit) return `${Math.round(n)}${unit}`;
    if (asPercent) return `${Math.round(n)}%`;
    return Math.round(n).toLocaleString('zh-CN');
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function measureWidth(el) {
    el.style.width = '100%';
    const rect = el.getBoundingClientRect();
    if (rect.width > 40) return Math.floor(rect.width);
    const parent = el.closest('.panel-body') || el.parentElement;
    const pw = parent ? parent.getBoundingClientRect().width : 0;
    return Math.max(Math.floor(pw - 40), 480);
  }

  function svgEl(tag, attrs) {
    const e = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  }

  function ensureDefs(svg) {
    const uid = 'g' + (uidCounter++);
    let defs = svg.querySelector('defs');
    if (!defs) { defs = svgEl('defs', {}); svg.insertBefore(defs, svg.firstChild); }
    COLORS.forEach((c, i) => {
      const lg = svgEl('linearGradient', { id: `${uid}-${i}`, x1: '0', y1: '0', x2: '0', y2: '1' });
      lg.appendChild(svgEl('stop', { offset: '0%', 'stop-color': lighten(c, 28) }));
      lg.appendChild(svgEl('stop', { offset: '100%', 'stop-color': c }));
      defs.appendChild(lg);
    });
    return uid;
  }
  const gradRef = (uid, i) => `url(#${uid}-${i % COLORS.length})`;

  function getTooltip() {
    if (!tooltipEl) {
      tooltipEl = document.createElement('div');
      tooltipEl.className = 'chart-tooltip';
      document.body.appendChild(tooltipEl);
    }
    return tooltipEl;
  }
  function showTip(e, text) {
    const t = getTooltip();
    t.textContent = text;
    t.style.whiteSpace = 'pre-line';
    t.classList.add('show');
    t.style.left = Math.min(e.clientX + 14, window.innerWidth - 180) + 'px';
    t.style.top = (e.clientY - 40) + 'px';
  }
  function hideTip() { if (tooltipEl) tooltipEl.classList.remove('show'); }

  /** Click bar/donut → open the preset details for that exact selection. */
  function openChartDetails(label, extraCols) {
    const title = `${label} · 原始明细`;
    const cols = extraCols || '项目号,Site,产品类别,状态,数值,负责人';
    if (typeof openDrillModal === 'function') {
      const fake = document.createElement('a');
      fake.dataset.title = title;
      fake.dataset.sub = `演示数据 · ${label}`;
      fake.dataset.cols = cols;
      const presets = {
        TSMC: [['P-2026-0142','TSMC','WET-CMP','进行中','91%','张**'],['P-2026-0188','TSMC','ECP','已归档','86%','李**']],
        SMIC: [['P-2025-0887','SMIC','Track','已归档','94%','刘**']],
        'IC1 组': [['RD-2026-061','IC1 组','新工艺开发','进行中','42天','张**']],
        'IC2 组': [['RD-2026-058','IC2 组','工艺优化','已关闭','36天','李**']]
      };
      const key = Object.keys(presets).find(k => label.includes(k));
      fake.dataset.rows = JSON.stringify(presets[key] || [['DEMO-001', label, '演示数据', '待数据接入', '—', '—']]);
      openDrillModal(fake);
    } else if (window.showToast) {
      showToast('查看原始明细：' + label);
    }
  }

  function bindBarClick(rect, label) {
    rect.style.cursor = 'pointer';
    rect.addEventListener('click', e => {
      e.stopPropagation();
      hideTip();
      openChartDetails(label);
    });
  }

  function drawAxes(svg, w, pad, chartH, max, unit, asPercent) {
    [0, 0.25, 0.5, 0.75, 1].forEach(ratio => {
      const y = pad.t + chartH * (1 - ratio);
      svg.appendChild(svgEl('line', {
        x1: pad.l, x2: w - pad.r, y1: y, y2: y,
        class: ratio === 0 ? 'axis-line' : 'grid-line',
        'stroke-dasharray': ratio === 0 ? 'none' : '0'
      }));
      if (ratio === 0) return;
      const lbl = svgEl('text', { x: pad.l - 8, y: y + 3.5, 'text-anchor': 'end', class: 'axis-label' });
      lbl.textContent = formatVal(max * ratio, unit, asPercent);
      svg.appendChild(lbl);
    });
    const zero = svgEl('text', { x: pad.l - 8, y: pad.t + chartH + 3.5, 'text-anchor': 'end', class: 'axis-label' });
    zero.textContent = '0';
    svg.appendChild(zero);
  }

  function newSvg(w, height) {
    const svg = svgEl('svg', {
      class: 'chart-svg', viewBox: `0 0 ${w} ${height}`,
      width: '100%', height: String(height), preserveAspectRatio: 'xMidYMid meet'
    });
    svg._uid = ensureDefs(svg);
    return svg;
  }

  /** Truncate long category labels; full text stays in title attribute. */
  function shortenLabel(text, maxChars) {
    const s = String(text == null ? '' : text);
    if (s.length <= maxChars) return s;
    return s.slice(0, Math.max(1, maxChars - 1)) + '…';
  }

  /**
   * Decide X-axis label strategy from category count + available slot width.
   * Returns { mode: 'flat'|'stagger'|'rotate', maxChars, bottomPad }
   */
  function xLabelStrategy(n, slotW) {
    if (n >= 8 || slotW < 52) {
      return { mode: 'rotate', maxChars: slotW < 40 ? 4 : 6, bottomPad: 52 };
    }
    if (n >= 6 || slotW < 72) {
      return { mode: 'stagger', maxChars: Math.max(4, Math.floor(slotW / 9)), bottomPad: 40 };
    }
    return { mode: 'flat', maxChars: Math.max(5, Math.floor(slotW / 8)), bottomPad: 28 };
  }

  function appendXLabel(svg, fullLabel, x, baseY, strategy, index) {
    const short = shortenLabel(fullLabel, strategy.maxChars);
    const attrs = {
      x,
      class: 'axis-label axis-label-x',
      'text-anchor': strategy.mode === 'rotate' ? 'end' : 'middle'
    };
    let y = baseY + 16;
    if (strategy.mode === 'stagger' && index % 2 === 1) y += 12;
    if (strategy.mode === 'rotate') {
      attrs.transform = `rotate(-32 ${x} ${baseY + 10})`;
      y = baseY + 12;
    }
    attrs.y = y;
    const lbl = svgEl('text', attrs);
    lbl.textContent = short;
    if (short !== String(fullLabel)) {
      lbl.setAttribute('title', fullLabel);
      const tip = document.createElementNS('http://www.w3.org/2000/svg', 'title');
      tip.textContent = fullLabel;
      lbl.appendChild(tip);
    }
    svg.appendChild(lbl);
  }

  /** External HTML legend — never drawn inside SVG (avoids stacking on X labels). */
  function buildExternalLegend(items, kind) {
    if (!items || !items.length) return null;
    const wrap = document.createElement('div');
    wrap.className = 'chart-legend-external';
    wrap.setAttribute('role', 'list');
    items.forEach((it, i) => {
      const row = document.createElement('div');
      row.className = 'chart-legend-external-item';
      row.setAttribute('role', 'listitem');
      row.title = it.name || '';
      const swatch = document.createElement('span');
      swatch.className = kind === 'line' ? 'chart-legend-swatch line' : 'chart-legend-swatch';
      swatch.style.background = it.color || COLORS[i % COLORS.length];
      if (kind === 'line' && it.dashed) swatch.classList.add('dashed');
      const text = document.createElement('span');
      text.className = 'chart-legend-text';
      text.textContent = it.name || ('系列' + (i + 1));
      row.appendChild(swatch);
      row.appendChild(text);
      wrap.appendChild(row);
    });
    return wrap;
  }

  // ── Single bar chart ──
  function renderSvgBarChart(el, data, height) {
    const n = data.length;
    const w = measureWidth(el);
    const probePad = { t: 12, r: 10, b: 28, l: 40 };
    const slotProbe = (w - probePad.l - probePad.r) / Math.max(n, 1);
    const strat = xLabelStrategy(n, slotProbe);
    const pad = { t: 12, r: 10, b: strat.bottomPad, l: 40 };
    const chartW = w - pad.l - pad.r;
    const chartH = height - pad.t - pad.b;
    const max = niceMax(Math.max(...data.map(d => d.v), 1));
    const slotW = chartW / n;
    // 少类目时加宽柱体，避免「细柱 + 两侧大空白」显得廉价
    const barW = Math.max(34, Math.min(slotW * (n <= 5 ? 0.88 : 0.70), n <= 5 ? 110 : 64));
    const asPercent = el.dataset.percent === 'true' || (data[0] && data[0].unit === '%');
    const svg = newSvg(w, height);
    drawAxes(svg, w, pad, chartH, max, data[0] && data[0].unit, asPercent);

    data.forEach((d, i) => {
      const bh = Math.max(4, (d.v / max) * chartH);
      const x = pad.l + slotW * i + (slotW - barW) / 2;
      const y = pad.t + chartH - bh;
      const barFill = (d.c && String(d.c).startsWith('#')) ? normColor(d.c) : gradRef(svg._uid, i);
      const rect = svgEl('rect', { x, y, width: barW, height: bh, rx: 3, ry: 3, fill: barFill, class: 'bar-rect' });
      if (el.dataset.chartAnimated !== '1') rect.style.setProperty('--bar-delay', `${i * 45}ms`);
      else rect.style.animation = 'none';
      const tip = `${d.l}\n${formatVal(d.v, d.unit, asPercent)}`;
      rect.addEventListener('mouseenter', e => showTip(e, tip));
      rect.addEventListener('mousemove', e => showTip(e, tip));
      rect.addEventListener('mouseleave', hideTip);
      bindBarClick(rect, d.l);
      svg.appendChild(rect);
      const val = svgEl('text', { x: x + barW / 2, y: Math.max(y - 8, pad.t + 10), 'text-anchor': 'middle', class: 'bar-value-label' });
      val.textContent = formatVal(d.v, d.unit, asPercent);
      svg.appendChild(val);
      appendXLabel(svg, d.l, pad.l + slotW * i + slotW / 2, pad.t + chartH, strat, i);
    });
    mount(el, svg, height, null);
  }

  // ── Grouped bar chart ──
  function renderGroupedBar(el, groups, series, height) {
    const n = groups.length;
    const w = measureWidth(el);
    const probePad = { t: 12, r: 10, b: 28, l: 40 };
    const slotProbe = (w - probePad.l - probePad.r) / Math.max(n, 1);
    const strat = xLabelStrategy(n, slotProbe);
    const pad = { t: 12, r: 10, b: strat.bottomPad, l: 40 };
    const chartW = w - pad.l - pad.r;
    const chartH = height - pad.t - pad.b;
    let max = 1;
    groups.forEach(g => g.values.forEach(v => { if (v > max) max = v; }));
    max = niceMax(max);
    const asPercent = el.dataset.percent === 'true';
    const slotW = chartW / n;
    const sCount = series.length;
    const groupW = Math.min(slotW * (n <= 4 ? 0.88 : 0.78), sCount * 42 + (sCount - 1) * 5);
    const barW = Math.max(16, (groupW - (sCount - 1) * 5) / sCount);
    const svg = newSvg(w, height);
    drawAxes(svg, w, pad, chartH, max, null, asPercent);

    groups.forEach((g, gi) => {
      const gx = pad.l + slotW * gi + (slotW - groupW) / 2;
      g.values.forEach((v, si) => {
        const bh = Math.max(3, (v / max) * chartH);
        const x = gx + si * (barW + 5);
        const y = pad.t + chartH - bh;
        const fill = gradRef(svg._uid, si);
        const rect = svgEl('rect', { x, y, width: barW, height: bh, rx: 3, ry: 3, fill, class: 'bar-rect' });
        if (el.dataset.chartAnimated !== '1') rect.style.setProperty('--bar-delay', `${(gi * sCount + si) * 35}ms`);
        else rect.style.animation = 'none';
        const tip = `${g.label}\n${series[si]}: ${formatVal(v, null, asPercent)}`;
        rect.addEventListener('mouseenter', e => showTip(e, tip));
        rect.addEventListener('mousemove', e => showTip(e, tip));
        rect.addEventListener('mouseleave', hideTip);
        bindBarClick(rect, `${g.label} · ${series[si]}`);
        svg.appendChild(rect);
        if (el.dataset.showValues === 'true') {
          const valueLabel = svgEl('text', {
            x: x + barW / 2,
            y: Math.max(y - 5, pad.t + 10),
            'text-anchor': 'middle',
            class: 'bar-value-label'
          });
          valueLabel.textContent = formatVal(v, null, asPercent);
          svg.appendChild(valueLabel);
        }
      });
      appendXLabel(svg, g.label, pad.l + slotW * gi + slotW / 2, pad.t + chartH, strat, gi);
    });

    const legendItems = series.map((s, si) => ({
      name: s,
      color: COLORS[si % COLORS.length]
    }));
    mount(el, svg, height, buildExternalLegend(legendItems, 'bar'));
  }

  // ── Line / area chart ──
  /** Catmull-Rom → cubic Bezier smooth path */
  function smoothLinePath(pts) {
    if (!pts.length) return '';
    if (pts.length === 1) return `M${pts[0][0]},${pts[0][1]}`;
    let d = `M${pts[0][0]},${pts[0][1]}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] || pts[i];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[i + 2] || p2;
      const c1x = p1[0] + (p2[0] - p0[0]) / 6;
      const c1y = p1[1] + (p2[1] - p0[1]) / 6;
      const c2x = p2[0] - (p3[0] - p1[0]) / 6;
      const c2y = p2[1] - (p3[1] - p1[1]) / 6;
      d += ` C${c1x},${c1y} ${c2x},${c2y} ${p2[0]},${p2[1]}`;
    }
    return d;
  }

  function renderLineChart(el, labels, series, height) {
    const n = labels.length;
    const w = measureWidth(el);
    const probePad = { t: 10, r: 28, b: 28, l: 40 };
    const slotProbe = n > 1 ? (w - probePad.l - probePad.r) / (n - 1) : (w - probePad.l - probePad.r);
    const strat = xLabelStrategy(n, slotProbe);
    // Legend is external — do not reserve SVG bottom for it
    const pad = { t: 10, r: 28, b: strat.bottomPad, l: 40 };
    const chartW = w - pad.l - pad.r;
    const chartH = height - pad.t - pad.b;
    let max = 1;
    series.forEach(s => s.data.forEach(v => { if (v > max) max = v; }));
    max = niceMax(max);
    const asPercent = el.dataset.percent === 'true';
    const stepX = n > 1 ? chartW / (n - 1) : chartW;
    const svg = newSvg(w, height);
    drawAxes(svg, w, pad, chartH, max, null, asPercent);

    const xAt = i => pad.l + stepX * i;
    const yAt = v => pad.t + chartH - (v / max) * chartH;
    const baseY = pad.t + chartH;

    const hoverG = svgEl('g', { class: 'line-hover-layer', style: 'pointer-events:none;opacity:0' });
    const vLine = svgEl('line', {
      x1: 0, x2: 0, y1: pad.t, y2: baseY,
      stroke: '#94a3b8', 'stroke-width': '1', 'stroke-dasharray': '3 3'
    });
    hoverG.appendChild(vLine);
    svg.appendChild(hoverG);

    series.forEach((s, si) => {
      const color = normColor(s.c) || COLORS[si % COLORS.length];
      const pts = s.data.map((v, i) => [xAt(i), yAt(v)]);
      const lineD = smoothLinePath(pts);
      const dashed = s.dashed === true || (si === series.length - 1 && series.length > 2 && /变更|风险|率/.test(s.name || ''));
      const showArea = s.area === true || (s.area !== false && si === 0);

      if (showArea && pts.length) {
        const uid = 'ln' + (uidCounter++);
        const grad = svgEl('linearGradient', { id: uid, x1: '0', y1: '0', x2: '0', y2: '1' });
        grad.appendChild(svgEl('stop', { offset: '0%', 'stop-color': color, 'stop-opacity': '.18' }));
        grad.appendChild(svgEl('stop', { offset: '100%', 'stop-color': color, 'stop-opacity': '0' }));
        svg.querySelector('defs').appendChild(grad);
        const areaD = `${lineD} L${pts[pts.length - 1][0]},${baseY} L${pts[0][0]},${baseY} Z`;
        svg.appendChild(svgEl('path', { d: areaD, fill: `url(#${uid})`, stroke: 'none' }));
      }

      const pathAttrs = {
        d: lineD, fill: 'none', stroke: color, 'stroke-width': si === 0 ? '2.4' : '1.8',
        'stroke-linecap': 'round', 'stroke-linejoin': 'round', class: 'line-path'
      };
      if (dashed) pathAttrs['stroke-dasharray'] = '5 4';
      const path = svgEl('path', pathAttrs);
      svg.appendChild(path);

      s.data.forEach((v, i) => {
        const isEnd = i === s.data.length - 1;
        const dot = svgEl('circle', {
          cx: xAt(i), cy: yAt(v),
          r: isEnd ? 3.5 : 2.5,
          fill: '#fff', stroke: color, 'stroke-width': isEnd ? '2.2' : '1.6',
          class: 'line-dot'
        });
        svg.appendChild(dot);
        if (isEnd) {
          const endLbl = svgEl('text', {
            x: xAt(i) + 6, y: yAt(v) + 3,
            class: 'bar-value-label', fill: color
          });
          endLbl.textContent = formatVal(v, null, asPercent);
          svg.appendChild(endLbl);
        }
      });
    });

    labels.forEach((l, i) => {
      appendXLabel(svg, l, xAt(i), baseY, strat, i);
    });

    const hit = svgEl('rect', {
      x: pad.l, y: pad.t, width: chartW, height: chartH,
      fill: 'transparent', style: 'cursor:crosshair'
    });
    hit.addEventListener('mousemove', e => {
      const rect = svg.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * w;
      let best = 0, bestD = Infinity;
      for (let i = 0; i < n; i++) {
        const d = Math.abs(xAt(i) - x);
        if (d < bestD) { bestD = d; best = i; }
      }
      hoverG.setAttribute('style', 'pointer-events:none;opacity:1');
      vLine.setAttribute('x1', xAt(best));
      vLine.setAttribute('x2', xAt(best));
      const rows = series.map(s => `${s.name}: ${formatVal(s.data[best], null, asPercent)}`).join('\n');
      showTip(e, `${labels[best]}\n${rows}`);
    });
    hit.addEventListener('mouseleave', () => {
      hoverG.setAttribute('style', 'pointer-events:none;opacity:0');
      hideTip();
    });
    hit.addEventListener('click', () => openChartDetails('运营趋势'));
    svg.appendChild(hit);

    const legendItems = series.length > 1
      ? series.map((s, si) => ({
          name: s.name,
          color: normColor(s.c) || COLORS[si % COLORS.length],
          dashed: s.dashed === true || (si === series.length - 1 && series.length > 2 && /变更|风险|率/.test(s.name || ''))
        }))
      : null;
    mount(el, svg, height, buildExternalLegend(legendItems, 'line'));
  }

  function niceMax(v) {
    // 收紧上沿，减少柱顶大空白
    if (v <= 0) return 1;
    const padded = v * 1.08;
    if (padded <= 5) return 5;
    if (padded <= 10) return 10;
    const pow = Math.pow(10, Math.floor(Math.log10(padded)));
    const step = pow / 2;
    return Math.ceil(padded / step) * step;
  }

  function mount(el, svg, height, legendEl) {
    el.replaceChildren();
    const frame = document.createElement('div');
    frame.className = 'chart-frame';
    frame.appendChild(svg);
    el.appendChild(frame);
    if (legendEl) el.appendChild(legendEl);
    el.classList.add('chart-rendered');
    el.style.width = '100%';
    el.style.height = 'auto';
    el.style.minHeight = '0';
    el.style.maxHeight = 'none';
    el.style.flex = '0 0 auto';
    frame.style.height = height + 'px';
    frame.style.minHeight = height + 'px';
    frame.style.maxHeight = height + 'px';
    svg.setAttribute('height', String(height));
    svg.style.height = height + 'px';
    // 记录本次绘制宽度，供 ResizeObserver 去重，避免「首屏二次刷新」
    const w = Math.floor(el.getBoundingClientRect().width);
    if (w > 40) el.dataset.chartW = String(w);
    el._chartQuietUntil = performance.now() + 520;
    el.dataset.chartAnimated = '1';
  }

  function renderDonut(el) {
    let slices;
    try { slices = JSON.parse(el.dataset.donut); } catch (e) { return; }
    const total = el.dataset.total || slices.reduce((a, s) => a + (s.n || 0), 0);
    const label = el.dataset.label || '合计';
    let acc = 0;
    const parts = slices.map((s, i) => {
      const start = acc; acc += s.v;
      return `${normColor(s.c) || COLORS[i % COLORS.length]} ${start}% ${acc}%`;
    });
    el.innerHTML = `
      <div class="donut-wrap">
        <div class="donut-box">
          <div class="donut-ring" style="background:conic-gradient(${parts.join(', ')});cursor:pointer"></div>
          <div class="donut-center"><strong>${escapeHtml(total)}</strong><span>${escapeHtml(label)}</span></div>
        </div>
        <div class="legend legend-grid">
          ${slices.map((s, i) => `
            <div class="legend-item" style="cursor:pointer" data-slice="${escapeHtml(s.l)}">
              <span class="legend-dot" style="background:${normColor(s.c) || COLORS[i % COLORS.length]}"></span>
              <span class="legend-text">${escapeHtml(s.l)}</span>
              <strong class="legend-val">${escapeHtml(s.v)}%</strong>
            </div>`).join('')}
        </div>
      </div>`;
    el.classList.add('chart-rendered');
    el.style.height = 'auto';
    el.style.minHeight = '0';
    el.style.maxHeight = 'none';
    const w = Math.floor(el.getBoundingClientRect().width);
    if (w > 40) el.dataset.chartW = String(w);
    el._chartQuietUntil = performance.now() + 520;
    const ring = el.querySelector('.donut-ring');
    if (ring) ring.addEventListener('click', () => openChartDetails(label || '合计'));
    el.querySelectorAll('.legend-item').forEach(item => {
      item.addEventListener('click', () => openChartDetails(item.dataset.slice || label || '切片'));
    });
  }

  function renderSparkline(el) {
    let pts;
    try { pts = JSON.parse(el.dataset.sparkline); } catch (e) { return; }
    const w = 140, h = 40;
    const max = Math.max(...pts), min = Math.min(...pts);
    const range = max - min || 1;
    const coords = pts.map((v, i) => `${(i / (pts.length - 1)) * w},${h - 6 - ((v - min) / range) * (h - 12)}`).join(' ');
    const color = normColor(el.dataset.color) || '#0057d9';
    const uid = 'sp' + Math.random().toString(36).slice(2, 8);
    el.innerHTML = `<svg class="sparkline-svg" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
      <defs><linearGradient id="${uid}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${color}" stop-opacity=".3"/>
        <stop offset="100%" stop-color="${color}" stop-opacity="0"/>
      </linearGradient></defs>
      <polygon points="0,${h} ${coords} ${w},${h}" fill="url(#${uid})"/>
      <polyline points="${coords}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;
  }

  function renderHbarChart(el) {
    let data;
    try { data = JSON.parse(el.dataset.hbars); } catch (e) { return; }
    const max = Math.max(...data.map(d => d.v), 1);
    el.innerHTML = `<div class="hbar-chart">${data.map((d, i) => {
      const pct = Math.round(d.v / max * 100);
      const c = normColor(d.c) || COLORS[i % COLORS.length];
      return `<div class="hbar-row">
        <span class="hbar-label" title="${escapeHtml(d.l)}">${escapeHtml(d.l)}</span>
        <div class="hbar-track">
          <div class="hbar-fill" style="width:${pct}%;background:${c}"><span>${escapeHtml(d.v)}${escapeHtml(d.unit || '')}</span></div>
        </div></div>`;
    }).join('')}</div>`;
    el.classList.add('chart-rendered');
    el.style.height = 'auto';
    el.style.minHeight = '0';
    el.style.maxHeight = 'none';
  }

  // ── Dispatchers ──
  function renderBarChart(el) {
    let data;
    try { data = JSON.parse(el.dataset.bars); } catch (e) { return; }
    if (!data) return;
    el.classList.remove('chart-rendered');
    renderSvgBarChart(el, data, heightOf(el));
  }
  function renderGrouped(el) {
    let cfg;
    try { cfg = JSON.parse(el.dataset.groupBars); } catch (e) { return; }
    if (!cfg) return;
    el.classList.remove('chart-rendered');
    renderGroupedBar(el, cfg.groups, cfg.series, heightOf(el));
  }
  function renderLine(el) {
    let cfg;
    try { cfg = JSON.parse(el.dataset.line); } catch (e) { return; }
    if (!cfg) return;
    el.classList.remove('chart-rendered');
    renderLineChart(el, cfg.labels, cfg.series, heightOf(el));
  }
  function heightOf(el) {
    // 固定画布高度（禁止随 panel 拉伸）；默认更紧凑以减少留白
    if (el.dataset.tall === 'true') return 280;
    if (el.dataset.short === 'true') return 176;
    try {
      if (el.dataset.bars) {
        const n = JSON.parse(el.dataset.bars).length;
        if (n <= 5) return 196;
      }
      if (el.dataset.groupBars) {
        const g = JSON.parse(el.dataset.groupBars).groups || [];
        if (g.length <= 4) return 210;
      }
    } catch (e) { /* ignore */ }
    return 228;
  }

  // ── Legacy migration (handles single + grouped bars) ──
  function migrateLegacyBarChart(ph) {
    const cols = ph.querySelectorAll(':scope > .chart-col, :scope > div');
    const groups = [];
    let maxBars = 0;
    cols.forEach(col => {
      const bars = col.querySelectorAll('.bar');
      const label = col.querySelector('.bar-label');
      if (!bars.length || !label) return;
      maxBars = Math.max(maxBars, bars.length);
      const values = [], colors = [];
      bars.forEach(bar => {
        const hRaw = bar.style.height || '';
        const v = hRaw.includes('%') ? Math.round(parseFloat(hRaw)) : (parseFloat(hRaw) || 0);
        values.push(Math.max(v, 1));
        colors.push(parseColor(bar.style.background || bar.style.backgroundColor));
      });
      groups.push({ label: label.textContent.trim(), values, colors });
    });
    if (!groups.length) return false;

    const wrap = document.createElement('div');
    wrap.className = 'chart-wrap chart-wrap-bar';
    if (ph.classList.contains('tall')) wrap.dataset.tall = 'true';
    if (ph.classList.contains('short')) wrap.dataset.short = 'true';

    if (maxBars > 1) {
      const legend = ph.parentElement ? ph.parentElement.querySelector('.chart-legend') : null;
      let series = [];
      if (legend) series = Array.from(legend.querySelectorAll('span')).map(s => s.textContent.trim());
      if (series.length < maxBars) {
        for (let i = series.length; i < maxBars; i++) series.push('系列' + (i + 1));
      }
      wrap.dataset.groupBars = JSON.stringify({
        groups: groups.map(g => ({ label: g.label, values: g.values })),
        series: series.slice(0, maxBars)
      });
      if (legend) legend.remove();
      ph.replaceWith(wrap);
      renderGrouped(wrap);
      observeChart(wrap, () => renderGrouped(wrap));
    } else {
      const data = groups.map(g => ({ l: g.label, v: g.values[0], c: g.colors[0] }));
      if (data.every(d => d.v <= 100)) wrap.dataset.percent = 'true';
      wrap.dataset.bars = JSON.stringify(data);
      ph.replaceWith(wrap);
      renderBarChart(wrap);
      observeChart(wrap, () => renderBarChart(wrap));
    }
    return true;
  }

  function migrateLegacyDonut(dw) {
    if (dw.closest('[data-donut]')) return false;
    const ring = dw.querySelector('.donut, .donut-ring');
    const items = dw.querySelectorAll('.legend-item');
    if (!ring || !items.length) return false;
    const center = ring.getAttribute('data-center') || '';
    const slices = [];
    items.forEach((item, i) => {
      const dot = item.querySelector('.legend-dot');
      const text = item.textContent.trim();
      const m = text.match(/(\d+(?:\.\d+)?)\s*%/);
      const v = m ? Math.round(parseFloat(m[1])) : 0;
      const l = text.replace(/\d+(?:\.\d+)?\s*%/, '').trim();
      slices.push({ l, v, c: dot ? parseColor(dot.style.background) : COLORS[i] });
    });
    const wrap = document.createElement('div');
    wrap.className = 'chart-wrap chart-wrap-donut';
    wrap.dataset.donut = JSON.stringify(slices);
    wrap.dataset.total = center || '100%';
    wrap.dataset.label = center ? '总计' : '占比';
    dw.replaceWith(wrap);
    renderDonut(wrap);
    return true;
  }

  function isChartVisible(el) {
    if (!el || !el.isConnected) return false;
    const r = el.getBoundingClientRect();
    if (r.width < 8 || r.height < 0) return false;
    let n = el;
    while (n && n !== document.body) {
      const st = getComputedStyle(n);
      if (st.display === 'none' || st.visibility === 'hidden') return false;
      n = n.parentElement;
    }
    return true;
  }

  function needsRender(el, force) {
    if (force) return true;
    if (!el.classList.contains('chart-rendered')) return true;
    if (!el.querySelector('svg, .donut-wrap, .hbar-chart, .chart-frame')) return true;
    if (!isChartVisible(el)) return false;
    const w = Math.floor(el.getBoundingClientRect().width);
    const last = parseInt(el.dataset.chartW || '0', 10);
    // 隐藏 Tab 首次露出时宽度从 0→真实值，需要补绘；已稳定则跳过
    if (w >= 40 && last >= 40 && Math.abs(w - last) < 8) return false;
    if (w < 40) return false;
    return last < 40 || Math.abs(w - last) >= 8;
  }

  function observeChart(el, fn) {
    if (observers.has(el) || typeof ResizeObserver === 'undefined') return;
    let lastW = parseInt(el.dataset.chartW || '0', 10) || Math.floor(el.getBoundingClientRect().width) || 0;
    const ro = new ResizeObserver(debounce(() => {
      const w = Math.floor(el.getBoundingClientRect().width);
      if (w < 40) return;
      // mount / 首屏布局抖动：只同步基线，不重绘（避免柱图动效播两遍）
      if (el._chartQuietUntil && performance.now() < el._chartQuietUntil) {
        lastW = w;
        el.dataset.chartW = String(w);
        return;
      }
      if (Math.abs(w - lastW) < 8) return;
      lastW = w;
      el.dataset.chartW = String(w);
      fn();
    }, 140));
    ro.observe(el);
    observers.set(el, ro);
  }

  let initGen = 0;
  function init(force) {
    const gen = ++initGen;
    const run = (sel, render, observe) => {
      document.querySelectorAll(sel).forEach(el => {
        if (gen !== initGen) return;
        if (!needsRender(el, !!force)) {
          if (observe) observeChart(el, () => render(el));
          return;
        }
        // 不可见容器先跳过绘制，待 Tab 显示后再 init(false) 补绘
        if (!force && !isChartVisible(el) && el.classList.contains('chart-rendered')) {
          if (observe) observeChart(el, () => render(el));
          return;
        }
        if (!force && !isChartVisible(el) && !el.classList.contains('chart-rendered')) {
          // 仍 observe，宽度就绪后由 RO 或后续 init(false) 触发
          if (observe) observeChart(el, () => { if (isChartVisible(el)) render(el); });
          return;
        }
        render(el);
        if (observe) observeChart(el, () => render(el));
      });
    };
    // force=true 仅用于明确要求全量重绘；首屏 boot 用 force=false + 可见性判断
    run('[data-bars]', renderBarChart, true);
    run('[data-group-bars]', renderGrouped, true);
    run('[data-line]', renderLine, true);
    run('[data-donut]', renderDonut, false);
    run('[data-hbars]', renderHbarChart, false);
    document.querySelectorAll('[data-sparkline]').forEach(el => {
      if (!force && el.querySelector('svg')) return;
      if (!force && !isChartVisible(el)) return;
      renderSparkline(el);
    });
    document.querySelectorAll('.chart-placeholder:not(.chart-rendered)').forEach(migrateLegacyBarChart);
    document.querySelectorAll('.donut-wrap:not(.chart-rendered)').forEach(migrateLegacyDonut);
  }

  function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }

  let booted = false;
  let booting = false;
  window.DashboardCharts = {
    init,
    renderBarChart,
    renderGrouped,
    renderLine,
    renderDonut,
    renderSparkline,
    COLORS,
    get ready() { return booted; }
  };

  function boot() {
    if (booted || booting) return;
    booting = true;
    // 等字体 + 双 rAF，保证首测宽度即最终宽度，避免冷启动二次刷新
    const go = () => requestAnimationFrame(() => requestAnimationFrame(() => {
      init(false);
      booted = true;
      booting = false;
      window.dispatchEvent(new Event('dashboard-charts-ready'));
    }));
    const fontsReady = (document.fonts && document.fonts.ready)
      ? Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 160))])
      : Promise.resolve();
    fontsReady.then(go).catch(go);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
