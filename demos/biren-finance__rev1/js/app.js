(function () {
  const D = window.BIREN_DATA;
  const charts = new Map();
  const palette = ["#3399ff", "#33bbff", "#66ccff", "#99ddff", "#3a63b8", "#27cc7c", "#f5a31f", "#e62c3c"];

  const ICONS = {
    overview: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 13h6V4H4v9zm10 7h6V4h-6v16zM4 20h6v-5H4v5z"/></svg>',
    budget: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 19V5m0 14h16M8 15V9m5 6V7m5 8v-4"/></svg>',
    order: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M7 7h13l-1.5 8.5H8.2L7 7zm0 0L6 4H3m5 16a1.2 1.2 0 100-2.4A1.2 1.2 0 008 20zm10 0a1.2 1.2 0 100-2.4A1.2 1.2 0 0018 20z"/></svg>',
    sales: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 19V5m0 14h16M7 14l3.5-3.5 2.5 2.5L17 8"/><circle cx="17" cy="8" r="1.2" fill="currentColor" stroke="none"/></svg>',
    ar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3.5" y="5" width="17" height="14" rx="2"/><path d="M3.5 9h17M8 13h4m-4 3h7"/></svg>',
    kpi: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="8" r="3.2"/><path d="M5.5 19c1.4-3 3.7-4.5 6.5-4.5S17.1 16 18.5 19"/></svg>',
    inventory: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 8l8-4 8 4v8l-8 4-8-4V8z"/><path d="M12 12l8-4M12 12v8M12 12L4 8"/></svg>',
    rd: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M9 3h6v5l3 5v6a2 2 0 01-2 2H8a2 2 0 01-2-2v-6l3-5V3z"/><path d="M9 3v5h6"/></svg>',
    forms: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M8 4h8a2 2 0 012 2v14l-3-2-3 2-3-2-3 2V6a2 2 0 012-2z"/><path d="M9 9h6M9 13h6M9 17h3"/></svg>',
    details: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M5 5h14v14H5V5z"/><path d="M8 9h8M8 12h8M8 15h5"/></svg>',
  };

  const routes = [
    { id: "overview", group: "高层视角", name: "CEO看板", icon: "overview" },
    { id: "budget", group: "预算", name: "年度预算预实", icon: "budget" },
    { id: "order", group: "销售", name: "订单总览", icon: "order" },
    { id: "sales", group: "销售", name: "销售经营看板", icon: "sales" },
    { id: "ar", group: "销售", name: "销售达成应收", icon: "ar" },
    { id: "kpi", group: "销售", name: "个人 KPI 看板", icon: "kpi" },
    { id: "inventory", group: "研财存货", name: "存货分析看板", icon: "inventory" },
    { id: "rd", group: "研财存货", name: "研发项目预实", icon: "rd" },
    { id: "forms", group: "公共支撑", name: "填报与上传", icon: "forms" },
    { id: "details", group: "公共支撑", name: "分析明细表", icon: "details" },
  ];

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return [...(root || document).querySelectorAll(sel)]; }

  function toast(msg) {
    const el = $("#toast");
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.remove("show"), 2200);
  }

  function tagHtml(tag, text) {
    return `<span class="tag ${tag || ""}">${text || ""}</span>`;
  }

  function kpiHtml(k) {
    const tone = k.tone ? ` ${k.tone}` : "";
    const tip = k.tip ? ` data-tip="${k.tip}"` : "";
    const clickable = k.tip ? " clickable" : "";
    return `<div class="kpi${tone}${clickable}"${tip}>
      <div class="label"><span>${k.label}</span>${tagHtml(k.tag, k.tagText)}</div>
      <div class="value">${k.value}${k.unit ? `<small>${k.unit}</small>` : ""}</div>
      <div class="meta"><span class="${k.deltaClass || "flat"}">${k.delta || ""}</span></div>
    </div>`;
  }

  function tableHtml(rows, opts) {
    if (!rows || !rows.length) return "";
    const head = rows[0];
    const body = rows.slice(1);
    const alertIdx = opts && opts.alertOn ? opts.alertOn : null;
    return `<div class="table-wrap"><table class="data"><thead><tr>${
      head.map((h) => `<th>${h}</th>`).join("")
    }</tr></thead><tbody>${
      body.map((r) => {
        let cls = "";
        if (alertIdx != null) {
          const raw = String(r[alertIdx] || "");
          const n = parseFloat(raw);
          if (!Number.isNaN(n) && n > 20) cls = "critical";
          else if (!Number.isNaN(n) && n > 10) cls = "alert";
        }
        if (opts && opts.overdueDaysIdx != null) {
          const days = parseInt(r[opts.overdueDaysIdx], 10);
          if (days >= 90) cls = "critical";
          else if (days >= 60) cls = "alert";
        }
        return `<tr class="${cls}">${r.map((c, i) => {
          const isNum = i > 0 && /^-?[\d,.]+%?$/.test(String(c).replace(/,/g, ""));
          let cellCls = isNum ? "num" : "";
          if (String(c).startsWith("-") && String(c).includes("%")) cellCls += " pos";
          if (!String(c).startsWith("-") && String(c).endsWith("%") && parseFloat(c) > 10 && alertIdx === i) cellCls += " neg";
          return `<td class="${cellCls}">${c}</td>`;
        }).join("")}</tr>`;
      }).join("")
    }</tbody></table></div>`;
  }

  function disposeCharts(prefix) {
    [...charts.keys()].forEach((k) => {
      if (!prefix || k.startsWith(prefix)) {
        try { charts.get(k).dispose(); } catch (e) { /* ignore */ }
        charts.delete(k);
      }
    });
  }

  function resizeAllCharts() {
    charts.forEach((inst, id) => {
      try {
        const el = document.getElementById(id);
        if (!el || !document.body.contains(el)) return;
        const w = el.clientWidth || el.offsetWidth;
        const h = el.clientHeight || el.offsetHeight;
        if (w > 0 && h > 0) inst.resize({ width: w, height: h });
        else inst.resize();
      } catch (e) { /* ignore */ }
    });
  }

  function ensureChartHeight(el) {
    if (!el) return 240;
    const h = el.clientHeight || el.offsetHeight;
    if (h >= 80) return h;
    // 容器高度塌陷时给保底，避免 canvas 画在 0 高上
    el.style.minHeight = el.style.minHeight || "240px";
    return el.clientHeight || 240;
  }

  function chart(id, option) {
    const el = document.getElementById(id);
    if (!el || !window.echarts) return;
    // 禁止在表单控件上 init（重复 id / 误绑时会把筛选框画成细条）
    const tag = (el.tagName || "").toUpperCase();
    if (tag === "SELECT" || tag === "INPUT" || tag === "BUTTON" || tag === "TEXTAREA" || tag === "LABEL") return;

    const paint = () => {
      let inst = charts.get(id);
      if (inst) {
        const dom = typeof inst.getDom === "function" ? inst.getDom() : null;
        if (!dom || dom !== el || !document.body.contains(dom)) {
          try { inst.dispose(); } catch (e) { /* ignore */ }
          charts.delete(id);
          inst = null;
        }
      }
      const w = el.clientWidth || el.offsetWidth || el.parentElement?.clientWidth || 0;
      const h = ensureChartHeight(el);
      if (!inst) {
        inst = echarts.init(el, null, {
          renderer: "canvas",
          width: w > 0 ? w : undefined,
          height: h > 0 ? h : 240,
        });
        charts.set(id, inst);
      }
      inst.setOption(option, true);
      try {
        if (w > 0) inst.resize({ width: w, height: h });
        else inst.resize();
      } catch (e) { /* ignore */ }
    };

    // 切页时 display:none→block 后首帧宽高常为 0，轮询到有宽度再画
    let tries = 0;
    const tryPaint = () => {
      const w = el.clientWidth || el.offsetWidth || el.parentElement?.clientWidth || 0;
      if (w > 0 || tries >= 20) {
        paint();
        return;
      }
      tries += 1;
      setTimeout(tryPaint, 40);
    };
    requestAnimationFrame(tryPaint);
  }

  function afterLayout(fn) {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        fn();
        setTimeout(resizeAllCharts, 60);
        setTimeout(resizeAllCharts, 200);
        setTimeout(resizeAllCharts, 480);
      });
    });
  }

  function baseTooltip() {
    return { trigger: "axis", backgroundColor: "#fff", borderColor: "#e2e8f2", textStyle: { color: "#17346e", fontSize: 12 } };
  }

  function go(id) {
    if (!routes.find((r) => r.id === id)) id = "overview";
    $all(".nav-item").forEach((b) => b.classList.toggle("active", b.dataset.route === id));
    $all(".view").forEach((v) => v.classList.toggle("active", v.id === `view-${id}`));
    history.replaceState(null, "", `#${id}`);
    // 等 active 视图完成布局后再渲染图表
    afterLayout(() => render(id));
  }

  function renderNav() {
    const nav = $("#nav-menu");
    let html = "";
    let last = "";
    routes.forEach((r) => {
      if (r.group !== last) {
        html += `<div class="nav-sec">${r.group}</div>`;
        last = r.group;
      }
      html += `<button class="nav-item" data-route="${r.id}"><span class="nav-ico">${ICONS[r.icon] || ""}</span><span>${r.name}</span></button>`;
    });
    nav.innerHTML = html;
    nav.addEventListener("click", (e) => {
      const btn = e.target.closest(".nav-item");
      if (btn) go(btn.dataset.route);
    });
  }

  function render(id) {
    disposeCharts();
    const map = {
      overview: renderOverview,
      budget: renderBudget,
      order: renderOrder,
      sales: renderSales,
      ar: renderAr,
      kpi: renderKpi,
      inventory: renderInventory,
      rd: renderRd,
      forms: renderForms,
      details: renderDetails,
    };
    (map[id] || renderOverview)();
    setTimeout(resizeAllCharts, 60);
    setTimeout(resizeAllCharts, 220);
    setTimeout(resizeAllCharts, 500);
  }

  function bindKpiTips(root) {
    $all(".kpi.clickable", root).forEach((el) => {
      el.onclick = () => go(el.dataset.tip);
    });
  }

  function renderOverview() {
    const root = $("#view-overview");
    const o = D.overview;
    $("#ov-kpis").innerHTML = o.kpis.map(kpiHtml).join("");
    bindKpiTips(root);

    const riskHtml = o.risks.map((r) => `
      <div class="risk-item">
        <span class="bulb ${r.level}"></span>
        <div>
          <div class="t">${r.title}</div>
          <div class="d">${r.desc}</div>
        </div>
        <span class="a" data-tip="${r.tip}">${r.action}</span>
      </div>`).join("");
    $("#ov-risks").innerHTML = riskHtml;
    $("#ov-risks").onclick = (e) => {
      const a = e.target.closest(".a");
      if (a) go(a.dataset.tip);
    };

    const f = o.forecast;
    chart("ov-forecast", pieOpt(f.labels, f.values));
    $("#ov-forecast-note").textContent = f.note;

    chart("ov-trend", {
      color: ["#3399ff", "#27cc7c", "#f5a31f"],
      tooltip: baseTooltip(),
      legend: { top: 0, textStyle: { color: "#566280", fontSize: 11 } },
      grid: { left: 48, right: 18, top: 36, bottom: 28 },
      xAxis: { type: "category", data: o.trend.months, axisLabel: { color: "#8a93a6" }, axisLine: { lineStyle: { color: "#e2e8f2" } } },
      yAxis: { type: "value", axisLabel: { color: "#8a93a6" }, splitLine: { lineStyle: { color: "#eef2f8" } } },
      series: [
        { name: "新签订单", type: "line", smooth: true, data: o.trend.order, areaStyle: { color: "rgba(51,153,255,.08)" } },
        { name: "确认收入", type: "line", smooth: true, data: o.trend.revenue },
        { name: "在手订单", type: "line", smooth: true, data: o.trend.backlog },
      ],
    });

    chart("ov-budget", {
      color: ["#99ddff", "#3399ff"],
      tooltip: baseTooltip(),
      legend: { top: 0, textStyle: { color: "#566280", fontSize: 11 } },
      grid: { left: 70, right: 18, top: 36, bottom: 28 },
      xAxis: { type: "value", axisLabel: { color: "#8a93a6" }, splitLine: { lineStyle: { color: "#eef2f8" } } },
      yAxis: { type: "category", data: o.budgetByDept.labels, axisLabel: { color: "#566280" } },
      series: [
        { name: "预算", type: "bar", data: o.budgetByDept.budget, barWidth: 10 },
        { name: "实际", type: "bar", data: o.budgetByDept.actual, barWidth: 10 },
      ],
    });
  }

  function renderBudget() {
    $("#bd-kpis").innerHTML = D.budget.kpis.map(kpiHtml).join("");
    const b = D.budget;
    chart("bd-dept", {
      color: ["#99ddff", "#3399ff"],
      tooltip: baseTooltip(),
      legend: { top: 0, textStyle: { fontSize: 11, color: "#566280" } },
      grid: { left: 70, right: 16, top: 36, bottom: 28 },
      xAxis: { type: "value", axisLabel: { color: "#8a93a6" }, splitLine: { lineStyle: { color: "#eef2f8" } } },
      yAxis: { type: "category", data: b.byDept.labels, axisLabel: { color: "#566280" } },
      series: [
        { name: "预算", type: "bar", data: b.byDept.budget, barWidth: 11 },
        { name: "实际", type: "bar", data: b.byDept.actual, barWidth: 11 },
      ],
    });
    chart("bd-project", {
      color: ["#99ddff", "#3399ff"],
      tooltip: baseTooltip(),
      legend: { top: 0, textStyle: { fontSize: 11, color: "#566280" } },
      grid: { left: 78, right: 16, top: 36, bottom: 28 },
      xAxis: { type: "value", axisLabel: { color: "#8a93a6" }, splitLine: { lineStyle: { color: "#eef2f8" } } },
      yAxis: { type: "category", data: b.byProject.labels, axisLabel: { color: "#566280" } },
      series: [
        { name: "预算", type: "bar", data: b.byProject.budget, barWidth: 11 },
        { name: "实际", type: "bar", data: b.byProject.actual, barWidth: 11 },
      ],
    });
    chart("bd-month", {
      color: ["#66ccff", "#035dcf"],
      tooltip: baseTooltip(),
      legend: { top: 0, textStyle: { fontSize: 11, color: "#566280" } },
      grid: { left: 48, right: 16, top: 36, bottom: 28 },
      xAxis: { type: "category", data: b.monthly.months, axisLabel: { color: "#8a93a6", interval: 0 } },
      yAxis: { type: "value", name: "万元", nameTextStyle: { color: "#8a93a6", fontSize: 11 }, axisLabel: { color: "#8a93a6" }, splitLine: { lineStyle: { color: "#eef2f8" } } },
      series: [
        { name: "预算累计", type: "line", smooth: true, data: b.monthly.budgetCum },
        { name: "实际累计", type: "line", smooth: true, data: b.monthly.actualCum },
      ],
    });
    $("#bd-attr").innerHTML = tableHtml(b.byAttr);
    $("#bd-detail").innerHTML = tableHtml(b.detail, { alertOn: 7 });
  }

  const OD_PERIODS = {
    year: ["2026", "2025"],
    quarter: ["2026 Q1", "2026 Q2", "2026 Q3", "2026 YTD"],
    month: ["2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06", "2026-07"],
    day: ["选定日期"],
  };
  const OD_DIM_LABEL = { year: "按年", quarter: "按季", month: "按月", day: "按日" };

  function syncOrderDateFilters() {
    const dimEl = $("#od-dim");
    const periodEl = $("#od-period");
    const dayWrap = $("#od-day-wrap");
    const hint = $("#od-dim-hint");
    if (!dimEl || !periodEl) return;
    const dim = dimEl.value || "quarter";
    const prev = periodEl.value;
    const opts = OD_PERIODS[dim] || OD_PERIODS.quarter;
    periodEl.innerHTML = opts.map((x) => `<option value="${x}">${x}</option>`).join("");
    if (opts.includes(prev)) periodEl.value = prev;
    else periodEl.value = opts[opts.length - 1] || opts[0];
    if (dayWrap) dayWrap.hidden = dim !== "day";
    periodEl.disabled = dim === "day";
    const periodText =
      dim === "day" ? ($("#od-day") && $("#od-day").value) || "—" : periodEl.value;
    if (hint) {
      hint.textContent = ` · 当前：${OD_DIM_LABEL[dim] || dim} / ${periodText}`;
    }
  }

  function orderScaleByDim() {
    const dim = ($("#od-dim") && $("#od-dim").value) || "quarter";
    // DEMO 示意：粒度越细，展示金额略收敛，便于感知筛选生效
    if (dim === "year") return 1;
    if (dim === "quarter") return 0.72;
    if (dim === "month") return 0.28;
    return 0.05;
  }

  function renderOrder() {
    syncOrderDateFilters();
    const scale = orderScaleByDim();
    const o = D.order;
    const kpis = o.kpis.map((k) => {
      const n = Number(String(k.value).replace(/,/g, ""));
      if (!Number.isFinite(n)) return k;
      const scaled = Math.max(1, Math.round(n * scale));
      return { ...k, value: scaled.toLocaleString(), delta: k.delta || `日期维度示意 ×${scale}` };
    });
    $("#od-kpis").innerHTML = kpis.map(kpiHtml).join("");
    const scaleArr = (arr) => arr.map((v) => Math.max(1, Math.round(Number(v) * scale)));
    chart(
      "od-top-order",
      barOpt("订单维度 TOP5", o.topCustomersOrder.labels, scaleArr(o.topCustomersOrder.values), "#3399ff")
    );
    chart(
      "od-top-rev",
      barOpt("收入维度 TOP5", o.topCustomersRev.labels, scaleArr(o.topCustomersRev.values), "#27cc7c")
    );
    chart("od-pline", pieOpt(o.productLine.labels, scaleArr(o.productLine.values)));
    chart("od-form", pieOpt(o.form.labels, scaleArr(o.form.values)));
    chart("od-ind", pieOpt(o.industry.labels, scaleArr(o.industry.values)));
  }

  function barOpt(name, labels, values, color, opts) {
    const o = opts || {};
    const rotate = o.rotate != null ? o.rotate : (labels.some((x) => String(x).length > 4) ? 30 : 0);
    return {
      color: [color],
      tooltip: {
        trigger: "axis",
        backgroundColor: "#fff",
        borderColor: "#e2e8f2",
        textStyle: { color: "#17346e", fontSize: 12 },
        confine: true,
        extraCssText: "z-index:20;box-shadow:0 8px 20px rgba(18,40,79,.12);",
      },
      grid: { left: 52, right: 16, top: 28, bottom: rotate ? 52 : 36, containLabel: false },
      xAxis: {
        type: "category",
        data: labels,
        axisTick: { alignWithLabel: true },
        axisLabel: {
          color: "#8a93a6",
          fontSize: 11,
          interval: 0, // 必须显示全部分类名称
          rotate,
          hideOverlap: false,
        },
      },
      yAxis: {
        type: "value",
        name: o.yName || "",
        nameTextStyle: { color: "#8a93a6", fontSize: 11 },
        axisLabel: { color: "#8a93a6" },
        splitLine: { lineStyle: { color: "#eef2f8" } },
      },
      series: [{
        name,
        type: "bar",
        data: values,
        barWidth: o.barWidth || 18,
        itemStyle: { borderRadius: [6, 6, 0, 0] },
        label: o.showLabel ? { show: true, position: "top", color: "#5a6780", fontSize: 11 } : undefined,
      }],
    };
  }

  function pieOpt(labels, values, opts) {
    const o = opts || {};
    const unit = o.unit || "万";
    return {
      color: palette,
      tooltip: {
        trigger: "item",
        backgroundColor: "#fff",
        borderColor: "#e2e8f2",
        textStyle: { color: "#17346e", fontSize: 12 },
        confine: true,
        formatter: (p) => `${p.name}<br/>${p.marker}${p.value.toLocaleString()} ${unit}（${p.percent}%）`,
        extraCssText: "z-index:20;box-shadow:0 8px 20px rgba(18,40,79,.12);",
      },
      // 图例与扇区标签分离，避免重叠
      legend: {
        type: "scroll",
        orient: "vertical",
        right: 4,
        top: "middle",
        itemWidth: 10,
        itemHeight: 10,
        textStyle: { fontSize: 11, color: "#566280" },
        formatter: (name) => {
          const i = labels.indexOf(name);
          if (i < 0) return name;
          return `${name}  ${Number(values[i]).toLocaleString()}`;
        },
      },
      series: [{
        type: "pie",
        radius: ["42%", "68%"],
        center: ["38%", "50%"],
        avoidLabelOverlap: true,
        label: { show: false },
        labelLine: { show: false },
        emphasis: {
          label: { show: true, formatter: "{d}%", fontSize: 13, fontWeight: 700, color: "#12284f" },
          scale: true,
          scaleSize: 4,
        },
        data: labels.map((n, i) => ({ name: n, value: values[i] })),
      }],
    };
  }

  function renderSales() {
    const s = D.sales;
    const personSel = $("#sl-person");
    const periodSel = $("#sl-period");
    if (personSel && !personSel.dataset.bound) {
      personSel.dataset.bound = "1";
      personSel.onchange = () => afterLayout(() => renderSales());
      if (periodSel) periodSel.onchange = () => afterLayout(() => renderSales());
    }
    const person = personSel?.value || "";
    const period = periodSel?.value || "2026 YTD";
    const periodKey = period.includes("Q2") ? "q2" : period.includes("3") ? "m3" : "ytd";
    const months = sliceByPeriod(s.trend.months, periodKey);
    const newSign = sliceByPeriod(s.trend.newSign, periodKey);
    const confirm = sliceByPeriod(s.trend.confirm, periodKey);
    const backlog = sliceByPeriod(s.trend.backlog, periodKey);

    $("#sl-kpis").innerHTML = s.kpis.map(kpiHtml).join("");
    chart("sl-rank", {
      color: ["#3399ff", "#27cc7c"],
      tooltip: { ...baseTooltip(), confine: true },
      legend: { top: 0, textStyle: { fontSize: 11, color: "#566280" } },
      grid: { left: 48, right: 16, top: 36, bottom: 40 },
      xAxis: { type: "category", data: s.rankCust.labels, axisLabel: { color: "#8a93a6", interval: 0, rotate: 20 } },
      yAxis: { type: "value", name: "万元", nameTextStyle: { color: "#8a93a6", fontSize: 11 }, axisLabel: { color: "#8a93a6" }, splitLine: { lineStyle: { color: "#eef2f8" } } },
      series: [
        { name: "订单", type: "bar", data: s.rankCust.order, barWidth: 12 },
        { name: "收入", type: "bar", data: s.rankCust.rev, barWidth: 12 },
      ],
    });
    chart("sl-line", {
      color: ["#3399ff", "#27cc7c"],
      tooltip: { ...baseTooltip(), confine: true },
      legend: { top: 0, textStyle: { fontSize: 11, color: "#566280" } },
      grid: { left: 48, right: 16, top: 36, bottom: 36 },
      xAxis: { type: "category", data: s.rankLine.labels, axisLabel: { color: "#8a93a6", interval: 0 } },
      yAxis: { type: "value", name: "万元", nameTextStyle: { color: "#8a93a6", fontSize: 11 }, axisLabel: { color: "#8a93a6" }, splitLine: { lineStyle: { color: "#eef2f8" } } },
      series: [
        { name: "订单", type: "bar", data: s.rankLine.order, barWidth: 14 },
        { name: "收入", type: "bar", data: s.rankLine.rev, barWidth: 14 },
      ],
    });
    chart("sl-trend", {
      color: ["#3399ff", "#27cc7c", "#f5a31f"],
      tooltip: { ...baseTooltip(), confine: true },
      legend: { top: 0, textStyle: { fontSize: 11, color: "#566280" } },
      grid: { left: 48, right: 16, top: 36, bottom: 32 },
      xAxis: { type: "category", data: months, axisLabel: { color: "#8a93a6", interval: 0 } },
      yAxis: { type: "value", name: "万元", nameTextStyle: { color: "#8a93a6", fontSize: 11 }, axisLabel: { color: "#8a93a6" }, splitLine: { lineStyle: { color: "#eef2f8" } } },
      series: [
        { name: "新签", type: "line", smooth: true, data: newSign },
        { name: "确认", type: "line", smooth: true, data: confirm },
        { name: "在手", type: "line", smooth: true, data: backlog },
      ],
    });
    // 人员筛选：订单明细按责任人字段示意过滤（无责任人列时按客户轮询对应）
    let orders = s.orders;
    if (person) {
      const map = { 张明: "客户A", 李华: "客户B", 王芳: "客户C", 赵强: "客户D", 陈晨: "客户E", 周凯: "客户F" };
      const cust = map[person];
      if (cust) {
        const head = orders[0];
        const ci = head.indexOf("客户");
        orders = [head, ...orders.slice(1).filter((r) => r[ci] === cust)];
      }
    }
    $("#sl-orders").innerHTML = tableHtml(orders);
  }

  function renderAr() {
    disposeCharts("ar-");
    const a = D.ar;
    const personSel = $("#ar-person");
    const agingSel = $("#ar-f-aging");
    if (personSel && !personSel.dataset.bound) {
      personSel.dataset.bound = "1";
      personSel.onchange = () => afterLayout(() => renderAr());
      if (agingSel) agingSel.onchange = () => afterLayout(() => renderAr());
    }
    const person = personSel?.value || "";
    const agingPick = agingSel?.value || "";

    let detailRows = a.detail;
    if (person) {
      const hdr = a.detail[0];
      const pi = hdr.indexOf("责任销售");
      detailRows = [hdr, ...a.detail.slice(1).filter((r) => r[pi] === person)];
    }

    const aging = agingPick
      ? (() => {
          const i = a.aging.labels.indexOf(agingPick);
          return i < 0 ? a.aging : { labels: [a.aging.labels[i]], values: [a.aging.values[i]] };
        })()
      : a.aging;

    // 人员筛选时三项达成取该人 KPI（示意）
    let achieve = a.achieve;
    if (person && D.kpi.cards[person]) {
      const c = D.kpi.cards[person];
      achieve = {
        labels: [person],
        order: [c.orderRate],
        collect: [c.collectRate],
        revenue: [c.revRate],
      };
    }

    $("#ar-kpis").innerHTML = a.kpis.map(kpiHtml).join("");
    chart("ar-achieve", {
      color: ["#3399ff", "#27cc7c", "#f5a31f"],
      tooltip: { ...baseTooltip(), confine: true },
      legend: { top: 0, textStyle: { fontSize: 11, color: "#566280" } },
      grid: { left: 48, right: 16, top: 36, bottom: 36 },
      xAxis: { type: "category", data: achieve.labels, axisLabel: { color: "#8a93a6", interval: 0, rotate: achieve.labels.length > 4 ? 20 : 0 } },
      yAxis: { type: "value", max: 100, name: "%", nameTextStyle: { color: "#8a93a6", fontSize: 11 }, axisLabel: { formatter: "{value}%", color: "#8a93a6" }, splitLine: { lineStyle: { color: "#eef2f8" } } },
      series: [
        { name: "订单达成", type: "bar", data: achieve.order, barWidth: 10 },
        { name: "回款达成", type: "bar", data: achieve.collect, barWidth: 10 },
        { name: "收入达成", type: "bar", data: achieve.revenue, barWidth: 10 },
      ],
    });
    chart("ar-aging-chart", pieOpt(aging.labels, aging.values));
    chart("ar-overdue", barOpt("逾期金额", a.overdueTop.labels, a.overdueTop.values, "#e62c3c", { rotate: 20, showLabel: true }));
    $("#ar-detail").innerHTML = tableHtml(detailRows, { overdueDaysIdx: 4 });
  }

  function rateGauge(id, value, name, color) {
    chart(id, {
      series: [{
        type: "gauge", startAngle: 220, endAngle: -40, min: 0, max: 100,
        center: ["50%", "55%"], radius: "88%",
        progress: { show: true, width: 12, itemStyle: { color } },
        axisLine: { lineStyle: { width: 12, color: [[1, "#e8eef6"]] } },
        pointer: { show: false },
        axisTick: { show: false }, splitLine: { show: false }, axisLabel: { show: false },
        detail: {
          valueAnimation: true, formatter: "{value}%",
          fontSize: 24, fontWeight: 800, color: "#12284f", offsetCenter: [0, "0%"],
        },
        title: { offsetCenter: [0, "32%"], color: "#8b95a8", fontSize: 12, fontWeight: 700 },
        data: [{ value: Number(value) || 0, name }],
      }],
    });
  }

  function sliceByPeriod(arr, period) {
    if (!arr || !arr.length) return [];
    if (period === "q2") return arr.slice(2, 5); // 4-6月（示意：2月起的第3-5段）
    if (period === "m3") return arr.slice(-3);
    if (period === "m7") return arr.slice(-1); // 最近一月（示意 7 月）
    return arr.slice(); // ytd
  }

  function renderKpi() {
    disposeCharts("kpi-");
    const people = D.kpi.people;
    const selPerson = $("#kpi-person");
    const selPeriod = $("#kpi-period");
    if (!selPerson || !selPeriod) return;

    if (!selPerson.dataset.ready) {
      selPerson.innerHTML = people.map((p) => `<option value="${p}">${p}</option>`).join("");
      selPerson.dataset.ready = "1";
      selPerson.onchange = () => afterLayout(() => renderKpi());
      selPeriod.onchange = () => afterLayout(() => renderKpi());
    }

    const name = selPerson.value || D.kpi.selected;
    selPerson.value = name;
    const period = selPeriod.value || "ytd";
    const c = D.kpi.cards[name];
    const m = D.kpi.monthly;
    if (!c || !m) return;

    const months = sliceByPeriod(m.months, period);
    const orderM = sliceByPeriod(m.order, period);
    const revM = sliceByPeriod(m.rev, period);
    const collectM = sliceByPeriod(m.collect, period);
    const orderRateM = sliceByPeriod(m.orderRate, period);
    const revRateM = sliceByPeriod(m.revRate, period);
    const collectRateM = sliceByPeriod(m.collectRate, period);

    // 期间筛选时，金额按月度汇总；达成率取期末
    const order = period === "ytd" ? c.order : orderM.reduce((a, b) => a + b, 0);
    const rev = period === "ytd" ? c.rev : revM.reduce((a, b) => a + b, 0);
    const collect = period === "ytd" ? c.collect : collectM.reduce((a, b) => a + b, 0);
    const orderRate = period === "ytd" ? c.orderRate : (orderRateM[orderRateM.length - 1] || c.orderRate);
    const revRate = period === "ytd" ? c.revRate : (revRateM[revRateM.length - 1] || c.revRate);
    const collectRate = period === "ytd" ? c.collectRate : (collectRateM[collectRateM.length - 1] || c.collectRate);

    const orderTarget = Math.round(order / ((orderRate || 1) / 100));
    const revTarget = Math.round(rev / ((revRate || 1) / 100));
    const collectTarget = Math.round(collect / ((collectRate || 1) / 100));

    $("#kpi-kpis").innerHTML = [
      { label: "新签订单额", value: order.toLocaleString(), unit: "万", delta: `目标 ${orderTarget.toLocaleString()}`, tag: "sys", tagText: "SAP" },
      { label: "确认收入", value: rev.toLocaleString(), unit: "万", delta: `目标 ${revTarget.toLocaleString()}`, tag: "sys", tagText: "SAP" },
      { label: "回款额", value: collect.toLocaleString(), unit: "万", delta: `目标 ${collectTarget.toLocaleString()}`, tag: "sys", tagText: "SAP" },
      { label: "订单达成率", value: String(orderRate), unit: "%", delta: "对照 KPI 目标", tag: "upload", tagText: "KPI目标" },
      { label: "收入达成率", value: String(revRate), unit: "%", delta: "对照 KPI 目标", tag: "upload", tagText: "KPI目标" },
      { label: "回款达成率", value: String(collectRate), unit: "%", delta: "对照 KPI 目标", tag: "upload", tagText: "KPI目标" },
    ].map(kpiHtml).join("");

    const vsItems = [
      { title: "新签订单额", actual: order, target: orderTarget, rate: orderRate },
      { title: "确认收入", actual: rev, target: revTarget, rate: revRate },
      { title: "回款额", actual: collect, target: collectTarget, rate: collectRate },
    ];
    $("#kpi-vs").innerHTML = vsItems.map((v) => {
      const max = Math.max(v.actual, v.target) || 1;
      return `<div class="vs-card">
        <div class="l">${v.title}</div>
        <div class="vs-row"><span class="n">实绩</span><div class="bar"><i style="width:${(v.actual / max * 100).toFixed(1)}%"></i></div><span class="a">${v.actual.toLocaleString()}</span></div>
        <div class="vs-row"><span class="n">目标</span><div class="bar"><i class="tgt" style="width:${(v.target / max * 100).toFixed(1)}%"></i></div><span class="a">${v.target.toLocaleString()}</span></div>
        <div class="vs-row"><span class="n">达成</span><div class="bar"><i style="width:${Math.min(100, v.rate)}%;background:linear-gradient(90deg,#66ccff,#0b4fb8)"></i></div><span class="a">${v.rate}%</span></div>
      </div>`;
    }).join("");

    rateGauge("kpi-rate-order", orderRate, "订单达成率", "#2f8fff");
    rateGauge("kpi-rate-rev", revRate, "收入达成率", "#22c57a");
    rateGauge("kpi-rate-collect", collectRate, "回款达成率", "#f0a020");

    chart("kpi-trend", {
      color: ["#3399ff", "#27cc7c", "#f5a31f"],
      tooltip: { ...baseTooltip(), confine: true },
      legend: { top: 0, textStyle: { fontSize: 11, color: "#566280" } },
      grid: { left: 48, right: 16, top: 36, bottom: 32 },
      xAxis: { type: "category", data: months, axisLabel: { color: "#8a93a6", interval: 0 } },
      yAxis: { type: "value", name: "万元", nameTextStyle: { color: "#8a93a6", fontSize: 11 }, axisLabel: { color: "#8a93a6" }, splitLine: { lineStyle: { color: "#eef2f8" } } },
      series: [
        { name: "新签订单额", type: "bar", data: orderM, barWidth: 16, itemStyle: { borderRadius: [5, 5, 0, 0] } },
        { name: "确认收入", type: "line", smooth: true, data: revM, symbolSize: 7 },
        { name: "回款额", type: "line", smooth: true, data: collectM, symbolSize: 7 },
      ],
    });

    chart("kpi-rate-trend", {
      color: ["#3399ff", "#27cc7c", "#f5a31f"],
      tooltip: { ...baseTooltip(), confine: true },
      legend: { top: 0, textStyle: { fontSize: 11, color: "#566280" } },
      grid: { left: 48, right: 16, top: 36, bottom: 32 },
      xAxis: { type: "category", data: months, axisLabel: { color: "#8a93a6", interval: 0 } },
      yAxis: { type: "value", max: 100, name: "%", nameTextStyle: { color: "#8a93a6", fontSize: 11 }, axisLabel: { formatter: "{value}%", color: "#8a93a6" }, splitLine: { lineStyle: { color: "#eef2f8" } } },
      series: [
        { name: "订单达成率", type: "line", smooth: true, data: orderRateM, areaStyle: { color: "rgba(47,143,255,.10)" }, symbolSize: 7 },
        { name: "收入达成率", type: "line", smooth: true, data: revRateM, symbolSize: 7 },
        { name: "回款达成率", type: "line", smooth: true, data: collectRateM, symbolSize: 7 },
      ],
    });
  }

  function pickDim(dim, selected) {
    if (!selected || !dim) return dim;
    const i = dim.labels.indexOf(selected);
    if (i < 0) return dim;
    return { labels: [dim.labels[i]], values: [dim.values[i]] };
  }

  function sumVals(dim) {
    return (dim?.values || []).reduce((a, b) => a + Number(b || 0), 0);
  }

  function renderInventory() {
    disposeCharts("inv-");
    const inv = D.inventory;
    const ids = ["inv-period", "inv-f-cat", "inv-f-aging", "inv-f-proj", "inv-f-loc", "inv-f-status"];
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el && !el.dataset.bound) {
        el.dataset.bound = "1";
        el.onchange = () => afterLayout(() => renderInventory());
      }
    });

    const period = $("#inv-period")?.value || "ytd";
    const cat = pickDim(inv.category, $("#inv-f-cat")?.value || "");
    const aging = pickDim(inv.aging, $("#inv-f-aging")?.value || "");
    const proj = pickDim(inv.project, $("#inv-f-proj")?.value || "");
    const loc = pickDim(inv.location, $("#inv-f-loc")?.value || "");
    const status = pickDim(inv.salesStatus, $("#inv-f-status")?.value || "");

    // 有维度筛选时，用筛选后金额占比缩放 KPI（示意联动）
    const baseTotal = sumVals(inv.category) || 1;
    const focusTotal = Math.min(
      sumVals(cat),
      sumVals(aging) || Infinity,
      sumVals(proj) || Infinity,
      sumVals(loc) || Infinity,
      sumVals(status) || Infinity
    );
    const ratio = (focusTotal === Infinity ? sumVals(cat) : focusTotal) / baseTotal;
    const scale = Number.isFinite(ratio) && ratio > 0 && ratio < 1.0001 ? ratio : 1;

    const kpis = inv.kpis.map((k, idx) => {
      if (idx >= 3 || scale === 1) return k; // 周转类不随金额筛缩放
      const raw = Number(String(k.value).replace(/,/g, ""));
      if (!Number.isFinite(raw)) return k;
      return { ...k, value: Math.round(raw * scale).toLocaleString() };
    });

    const months = sliceByPeriod(inv.turnTrend.months, period);
    const days = sliceByPeriod(inv.turnTrend.days, period);

    $("#inv-kpis").innerHTML = kpis.map(kpiHtml).join("");
    $("#inv-flow").innerHTML = inv.flow.map((m) =>
      `<div class="m"><div class="l">${m.l}</div><div class="v">${m.v}</div><div class="s">${m.s}</div></div>`
    ).join("");

    chart("inv-cat", pieOpt(cat.labels, cat.values));
    chart("inv-aging", {
      tooltip: { ...baseTooltip(), confine: true },
      grid: { left: 48, right: 12, top: 22, bottom: 48 },
      xAxis: {
        type: "category",
        data: aging.labels,
        axisTick: { alignWithLabel: true },
        axisLabel: { color: "#8a93a6", fontSize: 10, interval: 0, rotate: 28 },
      },
      yAxis: {
        type: "value",
        name: "万元",
        nameTextStyle: { color: "#8a93a6", fontSize: 11 },
        axisLabel: { color: "#8a93a6" },
        splitLine: { lineStyle: { color: "#eef2f8" } },
      },
      series: [{
        name: "库龄金额",
        type: "bar",
        barWidth: 18,
        data: aging.values.map((v, i) => ({
          value: v,
          itemStyle: {
            color: ["#66ccff", "#3399ff", "#3a63b8", "#f5a31f", "#e8855a", "#e62c3c"][i % 6],
            borderRadius: [6, 6, 0, 0],
          },
        })),
        label: { show: aging.labels.length <= 3, position: "top", color: "#5a6780", fontSize: 10 },
      }],
    });
    chart("inv-proj", barOpt("项目存货", proj.labels, proj.values, "#3399ff", { rotate: 20, yName: "万元" }));
    chart("inv-loc", pieOpt(loc.labels, loc.values));
    chart("inv-status", pieOpt(status.labels, status.values));
    chart("inv-slow", {
      color: ["#e62c3c", "#f5a31f"],
      tooltip: { ...baseTooltip(), confine: true },
      legend: { top: 0, textStyle: { fontSize: 11, color: "#566280" } },
      grid: { left: 48, right: 40, top: 36, bottom: 36 },
      xAxis: { type: "category", data: inv.slowTop.labels, axisLabel: { color: "#8a93a6", interval: 0 } },
      yAxis: [
        { type: "value", name: "万元", nameTextStyle: { color: "#8a93a6", fontSize: 11 }, axisLabel: { color: "#8a93a6" }, splitLine: { lineStyle: { color: "#eef2f8" } } },
        { type: "value", name: "pcs", nameTextStyle: { color: "#8a93a6", fontSize: 11 }, axisLabel: { color: "#8a93a6" }, splitLine: { show: false } },
      ],
      series: [
        { name: "呆滞金额", type: "bar", data: inv.slowTop.values, barWidth: 14, itemStyle: { borderRadius: [5, 5, 0, 0] } },
        { name: "呆滞数量", type: "line", yAxisIndex: 1, smooth: true, data: inv.slowQty.values },
      ],
    });
    chart("inv-turn", {
      color: ["#035dcf"],
      tooltip: { ...baseTooltip(), confine: true },
      grid: { left: 48, right: 16, top: 22, bottom: 32 },
      xAxis: { type: "category", data: months, axisLabel: { color: "#8a93a6", interval: 0 } },
      yAxis: { type: "value", name: "天", nameTextStyle: { color: "#8a93a6", fontSize: 11 }, axisLabel: { color: "#8a93a6" }, splitLine: { lineStyle: { color: "#eef2f8" } } },
      series: [{ name: "周转天数", type: "line", smooth: true, data: days, areaStyle: { color: "rgba(3,93,207,.08)" }, symbolSize: 7 }],
    });
  }

  function renderRd() {
    $("#rd-kpis").innerHTML = D.rd.kpis.map(kpiHtml).join("");
    const funnel = D.rd.funnel.map((f) => `
      <div class="funnel-row">
        <div class="name">${f.name}</div>
        <div class="bar-wrap"><div class="bar" style="width:${f.pct}%">${f.pct}%</div></div>
        <div class="amt">${f.value.toLocaleString()} 万</div>
      </div>`).join("");
    $("#rd-funnel").innerHTML = funnel;

    chart("rd-proj", {
      color: ["#99ddff", "#3399ff"],
      tooltip: baseTooltip(),
      legend: { top: 0, textStyle: { fontSize: 11, color: "#566280" } },
      grid: { left: 70, right: 12, top: 28, bottom: 20 },
      xAxis: { type: "value", axisLabel: { color: "#8a93a6", fontSize: 10 }, splitLine: { lineStyle: { color: "#eef2f8" } } },
      yAxis: { type: "category", data: D.rd.projects.labels, axisLabel: { color: "#566280", fontSize: 10 } },
      series: [
        { name: "项目预算", type: "bar", data: D.rd.projects.budget, barWidth: 8 },
        { name: "验收投入", type: "bar", data: D.rd.projects.actual, barWidth: 8 },
      ],
    });
    chart("rd-mix", pieOpt(D.rd.costMix.labels, D.rd.costMix.values));
    chart("rd-subject", barOpt("预算科目", D.rd.subjects.labels, D.rd.subjects.values, "#2f8fff"));
    chart("rd-dept", barOpt("部门投入", D.rd.byDept.labels, D.rd.byDept.values, "#27cc7c"));
    $("#rd-detail").innerHTML = tableHtml(D.rd.detail);
  }

  function renderForms() {
    $("#forms-grid").innerHTML = D.forms.map((f) => `
      <div class="form-card">
        <h4>${f.name}</h4>
        <p>${f.desc}</p>
        <div class="row">
          <span>${f.owner} · ${f.freq}</span>
          <span class="pill ${f.status === "Buffer" ? "info" : "ok"}">${f.status}</span>
        </div>
        <div class="row" style="border:0;padding-top:8px;margin-top:0">
          <span>模板上传 / 在线填报</span>
          <button type="button" data-form="${f.name}">打开</button>
        </div>
      </div>`).join("");
    $("#forms-grid").onclick = (e) => {
      const btn = e.target.closest("button[data-form]");
      if (btn) toast(`已打开「${btn.dataset.form}」填报入口（原型示意）`);
    };
  }

  function renderDetails() {
    const tabs = $("#dt-tabs");
    if (!tabs.dataset.ready) {
      tabs.innerHTML = D.details.tabs.map((t, i) =>
        `<button class="tab${i === 0 ? " active" : ""}" data-tab="${t.id}">${t.name}</button>`
      ).join("");
      tabs.dataset.ready = "1";
      tabs.onclick = (e) => {
        const t = e.target.closest(".tab");
        if (!t) return;
        $all(".tab", tabs).forEach((x) => x.classList.toggle("active", x === t));
        afterLayout(() => showDetailTab(t.dataset.tab));
      };
    }
    const active = $(".tab.active", tabs)?.dataset.tab || "budgetDiff";
    showDetailTab(active);
  }

  function showDetailTab(id) {
    const box = $("#dt-body");
    // 切换明细 Tab 时先释放本区图表，避免实例绑在已删除节点上
    disposeCharts("dt-");
    if (id === "rdTimeline") {
      const t = D.details.rdTimeline;
      const amounts = t.stages.map((s) => Number(String(s.amt).replace(/[^\d.]/g, "")) || 0);
      box.innerHTML = `
        <div class="note">对应明细报表「单项目全周期卡片/时间轴」：以「${t.project}」示意立项预算后 PR→PO→验收→付款金额递进（数据示意）。</div>
        <div class="grid grid-21">
          <div class="panel">
            <div class="ph"><h3>${t.project} · 全周期时间轴</h3><span class="sub">示意</span></div>
            <div class="funnel">${t.stages.map((s) => `
              <div class="risk-item">
                <span class="bulb i"></span>
                <div>
                  <div class="t">${s.name} · ${s.date}</div>
                  <div class="d">${s.note}</div>
                </div>
                <span class="a" style="cursor:default;text-decoration:none">${s.amt}</span>
              </div>`).join("")}
            </div>
          </div>
          <div class="panel">
            <div class="ph"><h3>各阶段累计金额</h3><span class="sub">万元 · 立项→付款</span></div>
            <div id="dt-timeline-chart" class="chart"></div>
          </div>
        </div>`;
      chart("dt-timeline-chart", {
        color: ["#2f8fff"],
        tooltip: {
          ...baseTooltip(),
          confine: true,
          appendToBody: true,
          extraCssText: "z-index:40;box-shadow:0 8px 20px rgba(18,40,79,.12);",
        },
        grid: { left: 56, right: 20, top: 36, bottom: 56 },
        xAxis: {
          type: "category",
          data: t.stages.map((s) => s.name),
          axisTick: { alignWithLabel: true },
          axisLabel: {
            color: "#566280",
            fontSize: 11,
            interval: 0, // 显示全部阶段名称（此前 interval:25 导致只剩「立项预算」）
            rotate: 18,
            hideOverlap: false,
          },
          axisLine: { lineStyle: { color: "#e2e8f2" } },
        },
        yAxis: {
          type: "value",
          name: "万元",
          nameTextStyle: { color: "#8a93a6", fontSize: 11 },
          axisLabel: { color: "#8a93a6" },
          splitLine: { lineStyle: { color: "#eef2f8" } },
        },
        series: [{
          name: "累计金额",
          type: "bar",
          data: amounts,
          barWidth: 26,
          itemStyle: {
            borderRadius: [6, 6, 0, 0],
            color: {
              type: "linear", x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: "#66ccff" },
                { offset: 1, color: "#2f8fff" },
              ],
            },
          },
          label: { show: true, position: "top", color: "#5a6780", fontSize: 11 },
          markLine: {
            silent: true,
            symbol: "none",
            lineStyle: { type: "dashed", color: "#c5d0e0" },
            data: [{ xAxis: "PO 累计" }],
            label: { show: false },
          },
        }],
      });
      return;
    }
    const rows = D.details[id];
    const opts = id === "budgetDiff" ? { alertOn: 7 } : id === "arDetail" ? { overdueDaysIdx: 4 } : {};
    box.innerHTML = tableHtml(rows, opts);
  }

  function assertUniqueIds() {
    const seen = new Map();
    const dups = [];
    document.querySelectorAll("[id]").forEach((el) => {
      const id = el.id;
      if (!id) return;
      if (seen.has(id)) dups.push(id);
      else seen.set(id, el);
    });
    if (dups.length) console.warn("[biren-finance] 重复 id:", [...new Set(dups)].join(", "));
  }

  function boot() {
    assertUniqueIds();
    renderNav();
    $("#meta-asof").textContent = `数据截至 ${D.meta.asOf} · ${D.meta.period} · 示意数据`;
    window.addEventListener("resize", resizeAllCharts);
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) resizeAllCharts();
    });
    // 展馆 iframe 初次展示时补一次 resize
    if (typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver(() => resizeAllCharts());
      const main = $(".main");
      if (main) ro.observe(main);
    }
    ["od-dim", "od-period", "od-day"].forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener("change", () => {
        if (id === "od-dim") syncOrderDateFilters();
        renderOrder();
        if (typeof toast === "function") {
          const dim = ($("#od-dim") && $("#od-dim").value) || "quarter";
          toast(`已按「${OD_DIM_LABEL[dim] || dim}」刷新订单总览`);
        }
      });
    });
    const hash = (location.hash || "#overview").slice(1);
    go(hash);
    window.addEventListener("hashchange", () => {
      go((location.hash || "#overview").slice(1));
    });
  }

  document.addEventListener("DOMContentLoaded", boot);
})();
