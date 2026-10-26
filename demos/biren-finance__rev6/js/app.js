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
    const drill = k.drill ? ` data-drill="${k.drill}"` : "";
    const clickable = (k.tip || k.drill) ? " clickable" : "";
    const mark = k.tipLabel
      ? `<span class="foot-mark" title="${String(k.tipLabel).replace(/"/g, "&quot;")}">¹</span>`
      : "";
    const drillHint = k.drill ? `<span class="drill-badge kpi-drill">可下钻</span>` : "";
    return `<div class="kpi${tone}${clickable}"${tip}${drill}>
      <div class="label"><span>${k.label}${mark}</span>${drillHint}${tagHtml(k.tag, k.tagText)}</div>
      <div class="value">${k.value}${k.unit ? `<small>${k.unit}</small>` : ""}</div>
      <div class="meta"><span class="${k.deltaClass || "flat"}">${k.delta || ""}</span></div>
    </div>`;
  }

  function tableHtml(rows, opts) {
    if (!rows || !rows.length) return '<div class="note">当前筛选无明细</div>';
    const head = rows[0];
    const body = rows.slice(1);
    const alertIdx = opts && opts.alertOn ? opts.alertOn : null;
    return `<div class="table-caption">共 ${body.length} 条记录${head.length > 8 ? " · 左右滚动查看全部字段" : ""}</div><div class="table-wrap"><table class="data"><thead><tr>${
      head.map((h) => `<th>${esc(h)}</th>`).join("")
    }</tr></thead><tbody>${
      (body.length ? body : [["当前筛选无记录", ...head.slice(1).map(()=>"—")]]).map((r) => {
        let cls = "";
        if (alertIdx != null) {
          const raw = String(r[alertIdx] || "");
          const n = parseFloat(raw);
          if (opts && opts.alertOver != null) {
            if (!Number.isNaN(n) && n > opts.alertOver) cls = "critical";
          } else if (!Number.isNaN(n) && n > 20) cls = "critical";
          else if (!Number.isNaN(n) && n > 10) cls = "alert";
        }
        if (opts && opts.overdueDaysIdx != null) {
          const days = parseInt(r[opts.overdueDaysIdx], 10);
          if (days >= 90) cls = "critical";
          else if (days > 0) cls = "alert";
        }
        return `<tr class="${cls}">${r.map((c, i) => {
          const isNum = i > 0 && /^-?[\d,.]+%?$/.test(String(c).replace(/,/g, ""));
          let cellCls = isNum ? "num" : "";
          if (String(c).startsWith("-") && String(c).includes("%")) cellCls += " pos";
          const hotPct = opts && opts.alertOver != null ? parseFloat(c) > opts.alertOver : parseFloat(c) > 10;
          if (!String(c).startsWith("-") && String(c).endsWith("%") && hotPct && alertIdx === i) cellCls += " neg";
          const bar = opts && opts.barColumn === i;
          const numeric = Number(String(c).replace(/,/g,''));
          const content = bar ? `<div class="cell-bar"><i style="width:${Math.min(100,Math.max(0,numeric/(opts.barMax||1)*100))}%"></i><span>${esc(c)}</span></div>` : esc(c);
          return `<td class="${cellCls}">${content}</td>`;
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
    if (id === "order") id = "sales";
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

  function ceoRiskHtml(list) {
    return (list || []).map((r) => `
      <div class="risk-item">
        <span class="bulb ${r.level}"></span>
        <div>
          <div class="t">${r.title}</div>
          <div class="d">${r.desc}</div>
        </div>
        <span class="a" data-tip="${r.tip}">${r.action} →</span>
      </div>`).join("");
  }

  function bindCeoRiskRail(el) {
    if (!el) return;
    el.onclick = (e) => {
      const a = e.target.closest(".a");
      if (a && a.dataset.tip) go(a.dataset.tip);
    };
  }

  function renderOverview() {
    const root = $("#view-overview");
    const o = D.overview;
    const a=M.receivables,over=a.filter(r=>M.age(r.due)>0),balance=M.sum(a,'amount'),overAmount=M.sum(over,'amount');
    o.hero[0].value=money(M.sum(M.sales,'revenue'));o.hero[0].pct=M.sum(M.sales,'revenue')/58000*100;
    o.hero[1].value=(100*(M.sum(M.sales,'revenue')-M.sum(M.sales,'cost'))/M.sum(M.sales,'revenue')).toFixed(2);
    o.hero[1].pct=Number(o.hero[1].value)/38*100;
    o.coreKpis[0].value=money(M.sum(M.sales,'backlog'));o.coreKpis[3].value=money(M.sum(M.forecast,'value'));
    o.salesKpis[0].value=money(balance);o.salesKpis[1].value=money(overAmount);o.salesKpis[1].delta='占应收 '+rate(overAmount,balance);
    o.salesKpis[3].value=money(M.sum(M.sales.filter(r=>r.month===7),'collect'));o.salesKpis[3].delta='YTD 回款 '+money(M.sum(M.sales,'collect'));
    o.arStruct.values=['1-30天','31-60天','61-90天','90天+'].map(b=>M.sum(over.filter(r=>M.ageBand(r)===b),'amount'));
    o.lights[0].desc='YTD 营收达成 '+rate(M.sum(M.sales,'revenue'),58000);
    o.lights[1].desc='标准成本毛利率 '+o.hero[1].value+'%，目标38%';
    o.lights[2].desc='逾期 '+money(overAmount)+' 万，占应收 '+rate(overAmount,balance);
    const rdNear=M.rd.filter(r=>r.used/r.budget>.95).length,rdOver=M.rd.some(r=>r.used/r.budget>1);
    o.lights[5].level=rdOver?'danger':rdNear?'warn':'ok';o.lights[5].desc=rdNear+' 个项目执行率超过95%';
    o.rdVs={labels:M.rd.map(r=>r.project),budget:M.rd.map(r=>r.budget),actual:M.rd.map(r=>r.used),rate:M.rd.map(r=>Math.round(r.used/r.budget*100))};
    o.rdBudgetStruct.labels=['变更前预算','已批准变更','当前预算'];
    o.rdRisks[2].title='已批准研发预算变更';o.rdRisks[2].desc='累计变更 '+money(M.sum(M.rd,'change'))+' 万，当前预算已包含该金额。';
    o.rdBudgetStruct.values=[M.sum(M.rd,'budget')-M.sum(M.rd,'change'),M.sum(M.rd,'change'),M.sum(M.rd,'budget')];
    o.rdMix={labels:M.rd.map(r=>r.project),values:M.rd.map(r=>r.used)};
    o.invMix={labels:D.inventory.category.labels,values:D.inventory.category.values};
    o.nonRd={labels:['管理','销售','量产'],budget:['管理','销售','量产'].map(f=>M.sum(M.budget.filter(r=>r.fee===f),'annual')),actual:['管理','销售','量产'].map(f=>M.sum(M.budget.filter(r=>r.fee===f),r=>M.sum(r.monthlyActual.map(v=>({v})),'v')))};
    o.finKpis[3].value=(M.sum(o.nonRd.actual.map(v=>({v})),'v')/M.sum(o.nonRd.budget.map(v=>({v})),'v')*100).toFixed(2);
    o.invRisks[0].desc='长库龄存货 '+money(M.sum(M.inventory.filter(r=>!['90天内','90-180'].includes(r.aging)),'amount'))+' 万，需评审处置。';
    o.invRisks[1].desc='呆滞占用 '+money(M.sum(M.inventory.filter(r=>r.status==='呆滞观察'),'amount'))+' 万';
    o.salesRisks[1].desc='逾期明细可按客户、合同和天数查看';
    o.salesRisks[2].desc='Top3 客户占应收 '+rate(group(a,'customer','amount').sort((a,b)=>b.value-a.value).slice(0,3).reduce((n,r)=>n+r.value,0),balance);
    o.coreKpis.forEach(k=>{if(k.tip==='order')k.tip='sales';});

    $("#ov-hero").innerHTML = o.hero.map((h) => `
      <div class="ceo-hero-card ${h.tone}${h.tip ? " clickable" : ""}"${h.tip ? ` data-tip="${h.tip}"` : ""}>
        <div class="l"><span>${h.label}</span>${tagHtml(h.tag, h.tagText)}</div>
        <div class="v">${h.value}${h.unit ? `<small>${h.unit}</small>` : ""}</div>
        <div class="m">${h.target}</div>
        <div class="prog"><i style="width:${h.pct}%"></i></div>
        <div class="ring" style="--p:${h.pct}"><span>${Math.round(h.pct)}%</span></div>
      </div>`).join("");

    $("#ov-core-kpis").innerHTML = o.coreKpis.map(kpiHtml).join("");
    $("#ov-lights").innerHTML = o.lights.map((l) => `
      <div class="ceo-light ${l.level}">
        <span class="dot"></span>
        <div><div class="t">${l.title}</div><div class="d">${l.desc}</div></div>
      </div>`).join("");

    $("#ov-rd-risks").innerHTML = ceoRiskHtml(o.rdRisks);
    $("#ov-inv-risks").innerHTML = ceoRiskHtml(o.invRisks);
    $("#ov-sales-kpis").innerHTML = o.salesKpis.map(kpiHtml).join("");
    $("#ov-sales-risks").innerHTML = ceoRiskHtml(o.salesRisks);
    $("#ov-fin-kpis").innerHTML = o.finKpis.slice(2).map(kpiHtml).join("");

    $all('[data-section]',root).forEach(b=>b.onclick=()=>document.getElementById(b.dataset.section).scrollIntoView({behavior:'auto',block:'start'}));
    bindKpiTips(root);
    $all(".ceo-hero-card.clickable", root).forEach((el) => {
      el.onclick = () => go(el.dataset.tip);
    });
    $all(".ceo-link", root).forEach((el) => {
      el.onclick = () => go(el.dataset.tip);
    });
    bindCeoRiskRail($("#ov-rd-risks"));
    bindCeoRiskRail($("#ov-inv-risks"));
    bindCeoRiskRail($("#ov-sales-risks"));

    chart("ov-rd-mix", pieOpt(o.rdMix.labels, o.rdMix.values, { radius: ["42%", "68%"] }));

    chart("ov-rd-vs", {
      color: ["#99ddff", "#3399ff"],
      tooltip: {
        ...baseTooltip(),
        trigger: "axis",
        axisPointer: { type: "shadow" },
        formatter: (params) => {
          const arr = Array.isArray(params) ? params : [params];
          const i = arr[0] && arr[0].dataIndex;
          const rate = o.rdVs.rate[i];
          const lines = arr.map((p) => `${p.marker}${p.seriesName}：${p.value} 万`);
          return `${o.rdVs.labels[i]}<br/>${lines.join("<br/>")}<br/>执行率：${rate}%`;
        },
      },
      legend: { top: 0, textStyle: { color: "#566280", fontSize: 11 } },
      grid: { left: 78, right: 18, top: 34, bottom: 24 },
      xAxis: { type: "value", axisLabel: { color: "#8a93a6" }, splitLine: { lineStyle: { color: "#eef2f8" } } },
      yAxis: { type: "category", data: o.rdVs.labels, axisLabel: { color: "#566280", fontSize: 11 } },
      series: [
        { name: "预算", type: "bar", data: o.rdVs.budget, barWidth: 9 },
        { name: "累计投入", type: "bar", data: o.rdVs.actual, barWidth: 9 },
      ],
    });

    chart("ov-rd-budget", {
      color: ["#66ccff", "#2f8fff", "#0b4fb8"],
      tooltip: baseTooltip(),
      grid: { left: 48, right: 16, top: 24, bottom: 28 },
      xAxis: { type: "category", data: o.rdBudgetStruct.labels, axisLabel: { color: "#8a93a6", fontSize: 11 } },
      yAxis: { type: "value", name: "万元", nameTextStyle: { color: "#8a93a6", fontSize: 10 }, axisLabel: { color: "#8a93a6" }, splitLine: { lineStyle: { color: "#eef2f8" } } },
      series: [{
        type: "bar",
        data: o.rdBudgetStruct.values.map((v, i) => ({
          value: v,
          itemStyle: { color: ["#99ddff", "#66ccff", "#2f8fff"][i], borderRadius: [8, 8, 0, 0] },
        })),
        barWidth: 28,
        label: { show: true, position: "top", color: "#566280", fontSize: 11 },
      }],
    });

    const gap = o.skuGap.labels.map((_, i) =>
      (o.skuGap.onHand[i] + o.skuGap.wip[i] + o.skuGap.expected[i]) - o.skuGap.forecast[i]
    );
    chart("ov-sku-gap", {
      color: ["#99ddff", "#66ccff", "#2f8fff", "#f0a020", "#e44552"],
      tooltip: baseTooltip(),
      legend: { top: 0, textStyle: { color: "#566280", fontSize: 11 } },
      grid: { left: 44, right: 16, top: 36, bottom: 28 },
      xAxis: { type: "category", data: o.skuGap.labels, axisLabel: { color: "#8a93a6" } },
      yAxis: { type: "value", axisLabel: { color: "#8a93a6" }, splitLine: { lineStyle: { color: "#eef2f8" } } },
      series: [
        { name: "在手库存", type: "bar", stack: "supply", data: o.skuGap.onHand, barWidth: 18 },
        { name: "在生产量", type: "bar", stack: "supply", data: o.skuGap.wip },
        { name: "预期供应", type: "bar", stack: "supply", data: o.skuGap.expected },
        { name: "销售预测", type: "line", smooth: true, data: o.skuGap.forecast, symbolSize: 7, lineStyle: { width: 2.5 } },
        {
          name: "供需 Gap",
          type: "bar",
          data: gap.map((v) => ({
            value: v,
            itemStyle: { color: v >= 0 ? "rgba(34,197,122,.35)" : "rgba(228,69,82,.45)", borderRadius: 4 },
          })),
          barWidth: 8,
          barGap: "60%",
        },
      ],
    });

    chart("ov-inv-mix", pieOpt(o.invMix.labels, o.invMix.values, { radius: ["40%", "68%"] }));

    chart("ov-nextgen", {
      color: ["#66ccff", "#0b4fb8"],
      tooltip: baseTooltip(),
      legend: { top: 0, textStyle: { color: "#566280", fontSize: 11 } },
      grid: { left: 88, right: 48, top: 34, bottom: 20 },
      xAxis: [
        { type: "value", name: "数量", nameTextStyle: { color: "#8a93a6", fontSize: 10 }, axisLabel: { color: "#8a93a6" }, splitLine: { show: false } },
        { type: "value", name: "金额(万)", nameTextStyle: { color: "#8a93a6", fontSize: 10 }, axisLabel: { color: "#8a93a6" }, splitLine: { lineStyle: { color: "#eef2f8" } } },
      ],
      yAxis: { type: "category", data: o.nextGen.labels, axisLabel: { color: "#566280", fontSize: 11 } },
      series: [
        { name: "备货数量", type: "bar", data: o.nextGen.qty, barWidth: 9, xAxisIndex: 0 },
        { name: "备货金额", type: "bar", data: o.nextGen.amt, barWidth: 9, xAxisIndex: 1 },
      ],
    });

    chart("ov-ar-struct", {
      color: ["#66ccff", "#99ddff", "#f0a020", "#e44552"],
      tooltip: baseTooltip(),
      grid: { left: 44, right: 16, top: 20, bottom: 28 },
      xAxis: { type: "category", data: o.arStruct.labels, axisLabel: { color: "#8a93a6", fontSize: 11 } },
      yAxis: { type: "value", axisLabel: { color: "#8a93a6" }, splitLine: { lineStyle: { color: "#eef2f8" } } },
      series: [{
        type: "bar",
        data: o.arStruct.values.map((v, i) => ({
          value: v,
          itemStyle: {
            color: ["#66ccff", "#99ddff", "#f0a020", "#e44552"][i],
            borderRadius: [8, 8, 0, 0],
          },
        })),
        barWidth: 26,
        label: { show: true, position: "top", color: "#566280", fontSize: 10 },
      }],
    });

    chart("ov-nonrd", {
      color: ["#99ddff", "#3399ff"],
      tooltip: baseTooltip(),
      legend: { top: 0, textStyle: { color: "#566280", fontSize: 11 } },
      grid: { left: 78, right: 18, top: 36, bottom: 28 },
      xAxis: { type: "value", axisLabel: { color: "#8a93a6" }, splitLine: { lineStyle: { color: "#eef2f8" } } },
      yAxis: { type: "category", data: o.nonRd.labels, axisLabel: { color: "#566280" } },
      series: [
        { name: "预算", type: "bar", data: o.nonRd.budget, barWidth: 11 },
        { name: "实际", type: "bar", data: o.nonRd.actual, barWidth: 11 },
      ],
    });
  }

  const MONTH_LABELS = ["1月","2月","3月","4月","5月","6月","7月","8月","9月","10月","11月","12月"];

  function bindMonthMulti(rootId, onChange) {
    const root = document.getElementById(rootId);
    if (!root || root.dataset.bound) return;
    root.dataset.bound = "1";
    const btn = root.querySelector(".month-dd-btn");
    const panel = root.querySelector(".month-dd-panel");
    panel.innerHTML = MONTH_LABELS.map((name, i) => {
      const m = i + 1;
      return `<label><input type="checkbox" value="${m}"${m <= 7 ? " checked" : ""}>${name}</label>`;
    }).join("");
    const syncLabel = () => {
      btn.textContent = monthSelectionLabel(selectedMonths(root));
    };
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const willOpen = panel.hidden;
      document.querySelectorAll(".month-dd-panel").forEach((p) => { p.hidden = true; });
      panel.hidden = !willOpen;
      btn.setAttribute("aria-expanded", willOpen ? "true" : "false");
    });
    panel.addEventListener("click", (e) => e.stopPropagation());
    panel.addEventListener("change", (e) => {
      const box = e.target;
      if (!selectedMonths(root).length && box) box.checked = true;
      syncLabel();
      onChange();
    });
    if (!window.__monthDdDoc) {
      window.__monthDdDoc = true;
      document.addEventListener("click", () => {
        document.querySelectorAll(".month-dd-panel").forEach((p) => { p.hidden = true; });
        document.querySelectorAll(".month-dd-btn").forEach((b) => b.setAttribute("aria-expanded", "false"));
      });
    }
    syncLabel();
  }

  function selectedMonths(root) {
    if (!root) return [1, 2, 3, 4, 5, 6, 7];
    return [...root.querySelectorAll('input[type="checkbox"]:checked')].map((el) => Number(el.value)).sort((a, b) => a - b);
  }

  function monthSelectionLabel(nums) {
    if (!nums.length) return "请选择月份";
    if (nums.length === 1) return `${nums[0]}月`;
    const contig = nums.every((n, i) => i === 0 || n === nums[i - 1] + 1);
    if (contig) return `${nums[0]}–${nums[nums.length - 1]}月 YTD`;
    return `${nums.map((n) => n + "月").join("、")} YTD`;
  }

  function bindDeptCascade(l1Id, l2Id, tree, onChange) {
    const l1 = document.getElementById(l1Id);
    const l2 = document.getElementById(l2Id);
    if (!l1 || !l2 || l1.dataset.bound) return;
    l1.dataset.bound = "1";
    const fill = () => {
      const node = tree[l1.value];
      const children = node ? Object.keys(node.children || {}) : [];
      const prev = l2.value;
      l2.innerHTML = `<option value="">全部二级部门</option>${children.map((c) => `<option value="${c}">${c}</option>`).join("")}`;
      l2.value = children.includes(prev) ? prev : "";
    };
    l1.addEventListener("change", () => { fill(); onChange(); });
    l2.addEventListener("change", () => onChange());
    fill();
  }

  function bindSimple(id, onChange) {
    const el = document.getElementById(id);
    if (!el || el.dataset.bound) return;
    el.dataset.bound = "1";
    el.addEventListener("change", onChange);
  }

  function fmtWan(n) {
    return Math.round(n).toLocaleString("zh-CN");
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
        formatter: (p) => `${p.name}<br/>${p.marker}${p.value.toLocaleString()} ${unit}（${Number(p.percent).toFixed(2)}%）`,
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
          label: { show: true, formatter: p => Number(p.percent).toFixed(2) + "%", fontSize: 13, fontWeight: 700, color: "#12284f" },
          scale: true,
          scaleSize: 4,
        },
        data: labels.map((n, i) => ({ name: n, value: values[i] })),
      }],
    };
  }

  function sliceByPeriod(arr, period) {
    if (!arr || !arr.length) return [];
    if (period === "q2") return arr.slice(2, 5); // 4-6月（示意：2月起的第3-5段）
    if (period === "m3") return arr.slice(-3);
    if (period === "m7") return arr.slice(-1); // 最近一月（示意 7 月）
    return arr.slice(); // ytd
  }

  function renderDetails() {
    $("#dt-reset").onclick = () => { detailContext = null; renderDetails(); };
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
    const active = detailContext ? detailContext.id : ($('.tab.active', tabs)?.dataset.tab || 'budgetDiff');
    $all('.tab', tabs).forEach(t=>t.classList.toggle('active',t.dataset.tab===active));
    showDetailTab(active);
  }

  function showDetailTab(id) {
    const box = $("#dt-body");
    $('#dt-scope').textContent = detailContext && detailContext.id === id ? ' 当前：' + detailContext.label : ' 当前：全部示例';
    if (detailContext && detailContext.id === id) { box.innerHTML=tableHtml(detailContext.rows, id==='arDetail'?{overdueDaysIdx:4}:{}); $all('#dt-tabs .tab').forEach(t=>t.classList.toggle('active',t.dataset.tab===id)); return; }
    if (id==='personal'||id==='salesForecast') { box.innerHTML='<div class="note">请从对应看板进入明细。</div>'; return; }
    if (id==='budgetDiff'&&!detailContext) D.details.budgetDiff=[['一级部门','二级部门','项目','科目','年度预算','YTD实际','预算差异率'],...M.budget.map(r=>[r.l1,r.l2,r.project,r.subject,money(r.annual),money(r.monthlyActual.reduce((a,b)=>a+b,0)),rate(r.monthlyActual.reduce((a,b)=>a+b,0),r.annual)])];
    if (id==='rdDetail'&&!detailContext) D.details.rdDetail=[['项目','一级部门','二级部门','科目','全周期预算','全周期累计','预算使用率'],...M.rd.map(r=>[r.project,r.l1,r.l2,r.subject,money(r.budget),money(r.used),rate(r.used,r.budget)])];
    if (id==='salesOrder') D.details.salesOrder=salesRows(M.sales);
    if (id==='arDetail') D.details.arDetail=arRows(M.receivables);
    // 切换明细 Tab 时先释放本区图表，避免实例绑在已删除节点上
    disposeCharts("dt-");
    if (id === "rdTimeline") {
      const project = val('dt-project') || val('rd-proj') || M.rd[1].project;
      const record = M.rd.find(r=>r.project===project) || M.rd[1];
      const t = {project:record.project,stages:[{name:'立项预算',date:'2025-11-08',amt:money(record.budget-record.change)+' 万',note:'初始全周期预算'},{name:'当前批准预算',date:'2026-07-31',amt:money(record.budget)+' 万',note:'含已批准预算变更'},{name:'PR 累计',date:'2026-07-31',amt:money(record.used*1.16)+' 万',note:'全周期请购累计'},{name:'PO 累计',date:'2026-07-31',amt:money(record.used*1.08)+' 万',note:'全周期下单累计'},{name:'验收累计',date:'2026-07-31',amt:money(record.used)+' 万',note:'含以前年度投入'},{name:'付款累计',date:'2026-07-31',amt:money(record.used*.86)+' 万',note:'全周期付款累计'}]};
      const amounts = t.stages.map((s) => Number(String(s.amt).replace(/[^\d.]/g, "")) || 0);
      box.innerHTML = `
        <div class="filter-bar"><label>项目 <select id="dt-project">${M.rd.map(r=>`<option ${r.project===project?'selected':''}>${esc(r.project)}</option>`).join('')}</select></label></div><div class="note">对应明细报表「单项目全周期卡片/时间轴」：以「${t.project}」示意立项预算后 PR→PO→验收→付款金额递进（数据示意）。</div>
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
      $("#dt-project").onchange=()=>showDetailTab("rdTimeline");
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
    const opts = id === "budgetDiff" ? {} : id === "arDetail" ? { overdueDaysIdx: 4 } : {};
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

  const M = window.BIREN_MODEL;
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const val = id => document.getElementById(id)?.value || '';
  const money = n => Number(n).toLocaleString('zh-CN',{maximumFractionDigits:2});
  const rate = (a,b) => b ? (a/b*100).toFixed(2)+'%' : '—';
  const card = (label,value,unit='万',delta='',extra={}) => ({label,value:typeof value==='number'?money(value):value,unit,delta,...extra});
  function group(rows,key,metric) { const out=new Map();rows.forEach(r=>out.set(r[key],(out.get(r[key])||0)+(typeof metric==='function'?metric(r):Number(r[metric]||0)))); return [...out].map(([label,value])=>({label,value})); }
  function groupedChart(id,rows,key,metric,name='金额',color='#3399ff',top=0) {let data=group(rows,key,metric).sort((a,b)=>b.value-a.value);if(top)data=data.slice(0,top);chart(id,barOpt(name,data.map(d=>d.label),data.map(d=>Math.round(d.value*100)/100),color,{showLabel:true,rotate:20}));}
  function horizontalChart(id,labels,series,unit='万元') {
    chart(id,{color:['#99ddff','#2f8fff','#0b4fb8'],tooltip:{...baseTooltip(),axisPointer:{type:'shadow'},valueFormatter:v=>money(v)+' '+unit},legend:{show:series.length>1,top:0,textStyle:{fontSize:11}},grid:{left:['sl-pline','sl-form','sl-ind'].includes(id)?78:110,right:48,top:series.length>1?34:15,bottom:24},xAxis:{type:'value',name:unit,splitNumber:3,axisLabel:{color:'#8a93a6',fontSize:10,hideOverlap:true,formatter:v=>money(v)},splitLine:{lineStyle:{color:'#eef2f8'}}},yAxis:{type:'category',inverse:true,data:labels,axisLabel:{fontSize:11,color:'#5a6780'}},series:series.map((r,i)=>({...r,type:'bar',barMaxWidth:16,itemStyle:{color:series.length===1?'#3399ff':i?'#2f8fff':'#99ddff',borderRadius:[0,4,4,0]},label:series.length===1?{show:true,position:'right',fontSize:10,formatter:p=>money(p.value)}:{show:false}}))});
  }
  function dualChart(id,labels,a,b,names=['订单','收入']) {chart(id,{color:['#99ddff','#3399ff'],tooltip:baseTooltip(),legend:{top:0},grid:{left:60,right:20,top:38,bottom:45},xAxis:{type:'category',data:labels,axisLabel:{interval:0,rotate:15}},yAxis:{type:'value',name:'万元'},series:[{name:names[0],type:'bar',data:a,barMaxWidth:18},{name:names[1],type:'bar',data:b,barMaxWidth:18}]});}
  function lineChart(id,labels,series,unit='万元') {chart(id,{color:palette,tooltip:{...baseTooltip(),valueFormatter:v=>unit==='%'?Number(v).toFixed(2)+'%':money(v)},legend:{top:0},grid:{left:55,right:20,top:38,bottom:32},xAxis:{type:'category',data:labels},yAxis:{type:'value',name:unit,...(unit==='%'?{min:0,max:value=>Math.max(100,Math.ceil(value.max/20)*20)}:{})},series:series.map((s,i)=>({...s,type:'line',smooth:false,lineStyle:{type:s.name.includes('目标')?'dashed':'solid',width:2},symbolSize:5,...(unit==='%'&&i===0?{markLine:{silent:true,symbol:'none',lineStyle:{type:'dashed',color:'#9baac1'},label:{formatter:'目标 100%',position:'insideEndTop'},data:[{yAxis:100}]}}:{})}))});}
  const salesRows = rows => [['合同','客户','产品线','物料','销售员','新签含税','确认收入不含税','已交货数量','开票号','收入确认日'],...rows.map(r=>[r.id,r.customer,r.line,r.material,r.person,money(r.order),money(r.revenue),r.delivered,r.invoice,r.date])];
  const arRows = rows => [['客户','合同','应收金额','到期日','逾期天数','催收记录','责任销售','账龄'],...rows.map(r=>[r.customer,r.contract,money(r.amount),r.due,Math.max(0,M.age(r.due)),r.note,r.person,M.ageBand(r)])];
  const personalRows = (rows,name) => [['合同','客户','月份','分配比例','本人订单','本人收入','本人回款'],...rows.map(r=>{const share=r.allocations.find(a=>a.person===name).share;return [r.id,r.customer,r.month+'月',rate(share,1),money(r.order*share),money(r.revenue*share),money(r.collect*share)];})];
  let detailContext = null;
  function openDetail(id,rows,label) {detailContext={id,rows,label};go('details');}
  function renderSales() {
    ['sl-period','sl-date-mode','sl-month','sl-day','sl-customer','sl-line-filter','sl-person','sl-rank-metric'].forEach(id=>bindSimple(id,renderSales));
    const mode=val('sl-date-mode');$('#sl-month-wrap').hidden=mode!=='month';$('#sl-day-wrap').hidden=mode!=='day';$('#sl-period').closest('label').hidden=mode!=='period';
    const date=mode==='day'?val('sl-day'):val('sl-month');
    const months=mode==='period'?M.periodMonths(val('sl-period')):[Number(date.slice(5,7))];
    const rows=M.salesFilter({months,customer:val('sl-customer'),line:val('sl-line-filter'),person:val('sl-person')}).filter(r=>mode==='period'||(date.startsWith('2026-')&&(mode!=='day'||r.date===date)));
    const order=M.sum(rows,'order'),rev=M.sum(rows,'revenue'),backlog=M.sum(rows,'backlog');
    const totalForecast=M.sum(M.forecast,'value');
    $('#sl-kpis').innerHTML=[card('新签订单额',order,'万','所选期间 · 含税'),card(mode==='period'&&val('sl-period')==='ytd'?'确认收入 YTD':'所选期间确认收入',rev,'万','所选期间 · 不含税'),card('在手订单',backlog,'万','所选订单未交余额 · 含税'),card('订单毛利率 · 预测',rate(order-M.sum(rows,'forecastCost'),order),'','预计成本'),card('订单毛利率 · 标准成本',rate(rev-M.sum(rows,'cost'),rev),'','已确认收入对应标准成本'),card('预计全年收入',totalForecast,'万','全年口径 · 含填报')].map(kpiHtml).join('');
    $('#sl-kpis .kpi:last-child').classList.add('clickable');$('#sl-kpis .kpi:last-child').onclick=()=>openDetail('salesForecast',[['构成','金额','口径'],...M.forecast.map(r=>[r.name,money(r.value),r.name==='在手订单'?'预计转收入，不直接使用含税合同金额':'销售填报，不与其他构成重复'])],'全年预测');
    $('#sl-forecast').innerHTML=`<div class="forecast-total">${money(totalForecast)}<small>万元 · 全年预测</small></div><div class="forecast-stack">${M.forecast.map((r,i)=>`<i class="segment segment-${i}" style="width:${totalForecast?r.value/totalForecast*100:0}%" title="${esc(r.name)} ${money(r.value)} 万元"></i>`).join('')}</div><div class="forecast-legend">${M.forecast.map((r,i)=>`<div><span class="legend-dot segment-${i}"></span><span>${esc(r.name)}</span><strong>${money(r.value)}</strong></div>`).join('')}</div><div class="chart-footnote">在手订单按预计转收入金额测算；未签单预测、在谈商机分别维护。</div>`;
    $('#sl-scope').textContent=` 当前 ${rows.length} 笔订单。`;
    const metric=val('sl-rank-metric')||'order';
    const rank=group(rows,'customer',metric).sort((a,b)=>b.value-a.value).slice(0,5);
    horizontalChart('sl-rank',rank.map(r=>r.label),[{name:metric==='order'?'订单金额':'确认收入',data:rank.map(r=>r.value)}]);
    const lines=[...new Set(rows.map(r=>r.line))];horizontalChart('sl-line',lines,['order','revenue'].map((key,i)=>({name:['订单','收入'][i],data:lines.map(k=>M.sum(rows.filter(r=>r.line===k),key))})));
    lineChart('sl-trend',months.map(m=>m+'月'),['order','revenue','backlog'].map((key,i)=>({name:['新签','确认','在手'][i],data:months.map(m=>M.sum(rows.filter(r=>r.month===m),key))})));
    for(const [id,key] of [['sl-pline','line'],['sl-form','form'],['sl-ind','industry']]){const data=group(rows,key,'revenue').sort((a,b)=>b.value-a.value);horizontalChart(id,data.map(d=>d.label),[{name:'确认收入',data:data.map(d=>d.value)}]);}
    const table=salesRows(rows);$('#sl-orders').innerHTML=tableHtml(table);$('#sl-drill').onclick=()=>openDetail('salesOrder',table,'销售经营当前筛选');
  }
  function renderAr() {
    ['ar-team','ar-period','ar-person','ar-f-aging'].forEach(id=>bindSimple(id,renderAr));
    const f={person:val('ar-person'),team:val('ar-team'),aging:val('ar-f-aging')};const months=M.periodMonths(val('ar-period'));
    const rows=M.arFilter(f),overdue=rows.filter(r=>M.age(r.due)>0),due=rows.filter(r=>M.age(r.due)>=0);
    const actual=M.salesFilter({months,person:f.person,team:f.team});const targets=M.targets.filter(r=>months.includes(r.month)&&(!f.person||r.person===f.person)&&(!f.team||r.team===f.team));
    const achievement=['order','revenue','collect'].map((key,i)=>card(['订单达成率','收入达成率','回款达成率'][i],rate(M.sum(actual,key),M.sum(targets,key)),'',`实绩 ${money(M.sum(actual,key))} / 目标 ${money(M.sum(targets,key))}`));
    const risk=[card('应收余额',M.sum(rows,'amount'),'万','含未到期应收'),card('到期金额',M.sum(due,'amount'),'万','含逾期及当日到期'),card('逾期总额',M.sum(overdue,'amount'),'万','合同到期日已过',{tone:overdue.length?'warn':''})];
    $('#ar-kpis').innerHTML=`<div class="metric-group"><div class="group-label">经营达成 <span>所选期间</span></div><div class="kpis cols-3">${achievement.map(kpiHtml).join('')}</div></div><div class="metric-group"><div class="group-label">应收风险 <span>截至 ${M.asOf}</span></div><div class="kpis cols-3">${risk.map(kpiHtml).join('')}</div></div>`;
    const teams=f.team?[f.team]:['华东团队','华北团队'];chart('ar-achieve',{color:palette,tooltip:{...baseTooltip(),valueFormatter:v=>Number(v).toFixed(2)+'%'},legend:{top:0},grid:{left:40,right:15,top:40,bottom:28},xAxis:{type:'category',data:teams},yAxis:{type:'value',name:'%'},series:['order','revenue','collect'].map((key,i)=>({name:['订单','收入','回款'][i],type:'bar',data:teams.map(t=>{const a=actual.filter(r=>r.team===t),b=targets.filter(r=>r.team===t);return M.pct(M.sum(a,key),M.sum(b,key));}),barMaxWidth:22}))});
    const bands=['1-30天','31-60天','61-90天','90天+'];chart('ar-aging-chart',pieOpt(bands,bands.map(b=>M.sum(rows.filter(r=>M.ageBand(r)===b),'amount'))));
    const top=group(overdue,'customer','amount').sort((a,b)=>b.value-a.value).slice(0,5);$('#ar-top-table').innerHTML=tableHtml([['客户','逾期金额','最长逾期天数'],...top.map(t=>[t.label,money(t.value),Math.max(...overdue.filter(r=>r.customer===t.label).map(r=>M.age(r.due)))])],{barColumn:1,barMax:Math.max(1,...top.map(t=>t.value))});
    lineChart('ar-collect-trend',months.map(m=>m+'月'),[{name:'回款实绩',data:months.map(m=>M.sum(actual.filter(r=>r.month===m),'collect'))},{name:'回款目标',data:months.map(m=>M.sum(targets.filter(r=>r.month===m),'collect'))}]);
    $('#ar-detail').innerHTML='<button class="detail-open" type="button">查看当前筛选明细 →</button>'+tableHtml(arRows(rows),{overdueDaysIdx:4});$('#ar-detail').onclick=()=>openDetail('arDetail',arRows(rows),'应收当前团队 / 销售员 / 账龄');
  }
  function renderKpi() {
    bindSimple('kpi-period',renderKpi);const months=M.periodMonths(val('kpi-period')),name='张明',p=M.personal(name,months);
    $('#kpi-self-name').textContent=name;
    const keys=['order','revenue','collect'];
    $('#kpi-kpis').innerHTML=keys.map((key,i)=>{
      const achieved=M.pct(p[key],p[key+'Target'])||0, gap=p[key+'Target']-p[key];
      return `<article class="metric-summary"><div class="summary-label">${['订单','收入','回款'][i]}达成</div><div class="summary-main"><strong>${rate(p[key],p[key+'Target'])}</strong><span>实绩 ${money(p[key])} 万</span></div><div class="finance-progress"><i style="width:${Math.min(100,Math.max(0,achieved))}%"></i></div><div class="summary-foot"><span>目标 ${money(p[key+'Target'])} 万</span><span>${gap>=0?'距目标':'超目标'} ${money(Math.abs(gap))} 万</span></div></article>`;
    }).join('');
    lineChart('kpi-trend',months.map(m=>m+'月'),keys.map((key,i)=>({name:['新签','收入','回款'][i],data:months.map(m=>M.personal(name,[m])[key])})));
    lineChart('kpi-rate-trend',months.map(m=>m+'月'),keys.map((key,i)=>({name:['订单','收入','回款'][i],data:months.map(m=>{const a=M.personal(name,[m]);return M.pct(a[key],a[key+'Target']);})})),'%');
    const rows=personalRows(p.rows,name);$('#kpi-own-detail').innerHTML=tableHtml(rows);$('#kpi-drill').onclick=()=>openDetail('personal',rows,'张明 / 本人分配后的订单与回款');
  }
  function renderBudget() {
    bindDeptCascade('bd-dept-l1','bd-dept-l2',D.budget.deptTree,renderBudget);bindMonthMulti('bd-month-dd',renderBudget);['bd-fee','bd-project-filter','bd-attribute'].forEach(id=>bindSimple(id,renderBudget));
    const months=selectedMonths($('#bd-month-dd'));const rows=M.budget.filter(r=>(!val('bd-dept-l1')||r.l1===val('bd-dept-l1'))&&(!val('bd-dept-l2')||r.l2===val('bd-dept-l2'))&&(!val('bd-fee')||r.fee===val('bd-fee'))&&(!val('bd-project-filter')||r.project===val('bd-project-filter'))&&(!val('bd-attribute')||r.attribute===val('bd-attribute')));
    const expanded=rows.map(r=>({...r,actual:months.reduce((n,m)=>n+r.monthlyActual[m-1],0),periodBudget:months.reduce((n,m)=>n+r.monthlyBudget[m-1],0)}));const annual=M.sum(rows,'annual'),actual=M.sum(expanded,'actual');
    $('#bd-scope').textContent=` 当前 ${monthSelectionLabel(months)}，${rows.length} 条预算科目记录；8–12月尚无实际发生数据。`;
    $('#bd-kpis').innerHTML=[card('年度预算总额',annual,'万','当前部门 / 项目 / 科目范围'),card('实际费用发生额',actual,'万','所选月份合计'),card('预算差异率',rate(actual,annual),'','实际费用 / 年度预算'),card('预算结余',annual-actual,'万','年度预算 − 所选期间实际'),card('超预算科目',expanded.filter(r=>r.actual>r.annual).length,'项','所选期间实际超过年度预算')].map(kpiHtml).join('');
    for(const [id,key] of [['bd-dept',val('bd-dept-l1')?'l2':'l1'],['bd-project','project'],['bd-subject','subject']]){const labels=[...new Set(rows.map(r=>r[key]))];horizontalChart(id,labels,[{name:'期间预算',data:labels.map(k=>M.sum(expanded.filter(r=>r[key]===k),'periodBudget'))},{name:'期间实际',data:labels.map(k=>M.sum(expanded.filter(r=>r[key]===k),'actual'))}]);}
    const mb=months.map(m=>M.sum(rows,r=>r.monthlyBudget[m-1])),ma=months.map(m=>M.sum(rows,r=>r.monthlyActual[m-1]));dualChart('bd-month',months.map(m=>m+'月'),mb,ma,['当月预算','当月实际']);let rb=0,ra=0;lineChart('bd-month-cum',months.map(m=>m+'月'),[{name:'所选月份预算累计',data:mb.map(v=>rb+=v)},{name:'所选月份实际累计',data:ma.map(v=>ra+=v)}]);
    const fees=[...new Set(rows.map(r=>r.fee))];$('#bd-attr').innerHTML=tableHtml([['费用类型','年度预算','所选期间预算','实际发生','期间差额','预算差异率'],...fees.map(f=>{const x=expanded.filter(r=>r.fee===f),b=M.sum(x,'annual'),a=M.sum(x,'actual'),pb=M.sum(x,'periodBudget');return [f,money(b),money(pb),money(a),money(a-pb),rate(a,b)];})]);
    const detail=[['费用类型','一级部门','二级部门','项目','预算科目','年度预算','期间预算','期间实际','期间差额','预算差异率'],...expanded.map(r=>[r.fee,r.l1,r.l2,r.project,r.subject,money(r.annual),money(r.periodBudget),money(r.actual),money(r.actual-r.periodBudget),rate(r.actual,r.annual)])];$('#bd-detail').innerHTML='<button class="detail-open" type="button">查看当前筛选明细 →</button>'+tableHtml(detail,{alertOn:9,alertOver:100});D.details.budgetDiff=detail;
    $('#bd-detail').onclick=()=>openDetail('budgetDiff',detail,'年度预算当前部门 / 项目 / 月份');
  }
  function renderRd() {
    bindDeptCascade('rd-dept-l1','rd-dept-l2',D.rd.deptTree,renderRd);bindMonthMulti('rd-month-dd',renderRd);bindSimple('rd-proj',renderRd);
    const months=selectedMonths($('#rd-month-dd'));const rows=M.rd.filter(r=>(!val('rd-proj')||r.project===val('rd-proj'))&&(!val('rd-dept-l1')||r.l1===val('rd-dept-l1'))&&(!val('rd-dept-l2')||r.l2===val('rd-dept-l2'))).map(r=>({...r,periodUsed:months.reduce((n,m)=>n+r.monthly[m-1],0),periodChange:months.reduce((n,m)=>n+r.changes[m-1],0)}));
    const budget=M.sum(rows,'budget'),used=M.sum(rows,'periodUsed');$('#rd-kpis').innerHTML=[card('项目总预算',budget,'万','全周期批准预算（含变更）'),card('累计使用预算',used,'万','所选月份合计'),card('预算使用率',rate(used,budget),'','所选期间使用 / 全周期预算'),card('预算变更',M.sum(rows,'periodChange'),'万','所选月份已批准变更')].map(kpiHtml).join('');
    $('#rd-scope').textContent=` 当前 ${monthSelectionLabel(months)}，${rows.length} 个项目；8–12月暂无实际发生。`;
    const funnel=[['PR',1.16],['PO',1.08],['验收',1],['付款',.86]];$('#rd-funnel').innerHTML=funnel.map(([n,f])=>`<div class="funnel-row"><div class="name">${n}</div><div class="bar-wrap"><div class="bar" style="width:${f/1.16*100}%">${(f/1.16*100).toFixed(0)}%</div></div><div class="amt">${money(used*f)} 万</div></div>`).join('');
    const subjects=[...new Set(rows.map(r=>r.subject))];horizontalChart('rd-usage',subjects,[{name:'全周期预算',data:subjects.map(k=>M.sum(rows.filter(r=>r.subject===k),'budget'))},{name:'期间使用',data:subjects.map(k=>M.sum(rows.filter(r=>r.subject===k),'periodUsed'))}]);const departments=group(rows,val('rd-dept-l1')?'l2':'l1','periodUsed');horizontalChart('rd-dept',departments.map(r=>r.label),[{name:'期间投入',data:departments.map(r=>r.value)}]);const human=M.sum(rows,r=>r.used?r.human*r.periodUsed/r.used:0);horizontalChart('rd-cost',['人力成本','非人力成本'],[{name:'期间投入',data:[human,used-human]}]);
    const detail=[['项目','一级部门','二级部门','预算科目','PR','PO','验收','付款','期间人力成本','项目预算','期间使用','全周期累计（含以前年度）','预算使用率','审批状态'],...rows.map(r=>[r.project,r.l1,r.l2,r.subject,...[1.16,1.08,1,.86].map(f=>money(r.periodUsed*f)),money(r.used?r.human*r.periodUsed/r.used:0),money(r.budget),money(r.periodUsed),money(r.used),rate(r.periodUsed,r.budget),r.status])];$('#rd-detail').innerHTML='<button class="detail-open" type="button">查看当前筛选明细 →</button>'+tableHtml(detail);D.details.rdDetail=detail;
    $('#rd-detail').onclick=()=>openDetail('rdDetail',detail,'研发当前项目 / 部门 / 月份');

    setTimeout(()=>{const instance=charts.get('rd-usage');if(instance){instance.off('click');instance.on('click',e=>openDetail('rdDetail',[detail[0],...detail.slice(1).filter(r=>r[3]===e.name)],'预算科目：'+e.name));}},150);
  }
  function renderInventory() {
    const ids=['inv-period','inv-time-mode','inv-metric','inv-f-cat','inv-f-aging','inv-f-proj','inv-f-loc','inv-f-status'];ids.forEach(id=>bindSimple(id,renderInventory));
    const rows=M.inventoryFilter({category:val('inv-f-cat'),aging:val('inv-f-aging'),project:val('inv-f-proj'),location:val('inv-f-loc'),status:val('inv-f-status')});
    const qty=val('inv-metric')==='qty',key=qty?'qty':'amount',unit=qty?'万 pcs':'万',period=val('inv-period'),factor=period==='q2'?.92:1;
    const scoped=rows.map(r=>({...r,amount:r.amount*factor,qty:r.qty*factor,provision:r.provision*factor}));const total=M.sum(scoped,key),available=M.sum(scoped.filter(r=>r.status==='可售'),key),slow=M.sum(scoped.filter(r=>r.status==='呆滞观察'),key);
    $('#inv-kpis').innerHTML=[card('存货总额',total,unit,'所选期末结存'),card('可用物料',available,unit,'销售状态为可售'),card('呆料呆滞',slow,unit,'销售状态为呆滞观察'),card('整体存货周转天数',scoped.length?96:'—',scoped.length?'天':'','示例周转口径'),card('呆料呆滞周转率',scoped.length?'0.42':'—',scoped.length?'次':'','示例周转口径')].map(kpiHtml).join('');
    const provision=M.sum(scoped,'provision');$('#inv-provision').innerHTML=[card('存货跌价准备金额',provision,'万','示例计提口径，待财务确认'),card('变动影响',provision*.145,'万','本期净增加 · 示意'),card('毛利影响',scoped.length?'-1.8':'—',scoped.length?'pct':'','示意影响，待确认计提与结转规则')].map(kpiHtml).join('');
    const end=period==='q2'?'2026-06-30':'2026-07-31';const flowFactor=period==='q2'?3/7:period==='m7'?1/7:1;
    $('#inv-flow').hidden=val('inv-time-mode')!=='period';
    $('#inv-flow').innerHTML=(val('inv-time-mode')==='period'?[card('采购入库',total*.36*flowFactor,unit,'所选时段发生额 · 示意'),card('生产结转',total*.27*flowFactor,unit,'所选时段发生额 · 示意'),card('销售出库',total*.26*flowFactor,unit,'所选时段发生额 · 示意')]:[]).map(kpiHtml).join('');
    for(const [id,dimension] of [['inv-aging','aging'],['inv-proj','project'],['inv-loc','location'],['inv-status','status']]){
      let data=group(scoped,dimension,key);
      if(dimension==='aging')data.sort((a,b)=>D.inventory.aging.labels.indexOf(a.label)-D.inventory.aging.labels.indexOf(b.label));
      else data.sort((a,b)=>b.value-a.value);
      horizontalChart(id,data.map(r=>r.label),[{name:'结存',data:data.map(r=>r.value)}],qty?'万 pcs':'万元');
    }
    $('#inv-proj-title').textContent=qty?'项目存货数量':'项目存货金额';
    // Existing inventory chart uses inv-cat-chart for its main pie.
    const categories=group(scoped,'category',key);chart('inv-cat-chart',pieOpt(categories.map(r=>r.label),categories.map(r=>r.value)));
    groupedChart('inv-slow',scoped.filter(r=>r.status==='呆滞观察'),'material',key,'呆滞结存','#f0a020',5);
    lineChart('inv-turn',period==='q2'?['4月','5月','6月']:['2月','3月','4月','5月','6月','7月'],[{name:'周转天数',data:scoped.length?(period==='q2'?[104,101,98]:[112,108,104,101,98,96]):[]}],'天');
    const catPick=val('inv-f-cat');const groups=group(scoped,catPick?'level2':'category',key);const catId=document.getElementById('inv-cat-chart')?'inv-cat-chart':'inv-cat';chart(catId,pieOpt(groups.map(g=>g.label),groups.map(g=>g.value)));
    const leafRows=[['一级类别','二级类别','三级类别','项目','物料','库位','销售状态','库龄','结存金额','结存数量','占当前金额比例'],...scoped.map(r=>[r.category,r.level2,r.level3,r.project,r.material,r.location,r.status,r.aging,money(r.amount),money(r.qty),rate(r.amount,M.sum(scoped,'amount'))])];
    let drill=$('#inv-leaf-detail');if(!drill){const panel=document.createElement('div');panel.className='panel';panel.innerHTML='<div class="ph"><h3>存货三级类别与物料明细</h3><button id="inv-drill-detail" type="button">查看分析明细 →</button></div><div id="inv-leaf-detail"></div>';$('#view-inventory').append(panel);drill=$('#inv-leaf-detail');}drill.innerHTML=tableHtml(leafRows);$('#inv-drill-detail').onclick=()=>openDetail('invDetail',leafRows,'存货当前类别 / 库龄 / 项目 / 库位 / 状态');D.details.invDetail=leafRows;
    $('#inv-fg-balance').innerHTML=tableHtml(qty?D.inventory.fgBalanceQty:D.inventory.fgBalance);
    const months=M.periodMonths(period),labels=months.map(m=>m+'月');dualChart('inv-fg-month',labels,months.map(m=>780+m*40),months.map(m=>720+m*55),['当月预算','当月实际']);
    ['inv-cat-unit','inv-aging-unit','inv-proj-unit','inv-loc-unit','inv-status-unit'].forEach(id=>{if($('#'+id))$('#'+id).textContent=qty?'万 pcs':'万元';});
    setTimeout(()=>{const inst=charts.get(catId);if(inst){inst.off('click');inst.on('click',e=>openDetail('invDetail',[leafRows[0],...leafRows.slice(1).filter(r=>r[catPick?1:0]===e.name)],'存货类别：'+e.name));}},150);
  }
  let activeForm=null;
  const formCache=new Map();
  function parseCsv(text) {const rows=[];let row=[],field='',quoted=false;const input=text.replace(/^\uFEFF/,'');for(let i=0;i<input.length;i++){const c=input[i];if(c==='"'){if(quoted&&input[i+1]==='"'){field+='"';i++;}else quoted=!quoted;}else if(c===','&&!quoted){row.push(field);field='';}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&input[i+1]==='\n')i++;row.push(field);if(row.some(Boolean))rows.push(row);row=[];field='';}else field+=c;}if(quoted)throw Error('CSV 引号未闭合');row.push(field);if(row.some(Boolean))rows.push(row);return rows;}
  function csvCell(v){const s=String(v??'');return /[",\n\r]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s;}
  function formStorage(name){try{return JSON.parse(localStorage.getItem('biren-finance-form-'+name)||'null');}catch{return formCache.get(name)||null;}}
  function openForm(form){activeForm=form;$('#form-title').textContent=form.name;$('#form-status').textContent='';const saved=formStorage(form.name),sample=saved?.rows?.[0]||form.sample;$('#form-fields').innerHTML=form.fields.map((f,i)=>`<label>${esc(f)}<input data-field="${i}" value="${esc(sample[i])}" /></label>`).join('');$('#form-preview').innerHTML=saved?tableHtml([form.fields,...saved.rows]):'';$('#form-modal').hidden=false;$('#form-modal input')?.focus();}
  function validateForm(form,rows){for(const row of rows){if(row.length!==form.fields.length||row.some(v=>String(v).trim()===''))throw Error('请填齐全部字段并核对列数');form.fields.forEach((f,i)=>{if(/金额|目标|成本|预算$|分配比例|现有库存|待生产|已下订单|预计订单/.test(f)){const n=Number(row[i]);if(!Number.isFinite(n)||(!/变更金额/.test(f)&&n<0))throw Error(f+'须为有效数值');if(f.includes('比例')&&(n<0||n>100))throw Error('分配比例须在 0–100 之间');}if(/月份|生效月|签约月|月度/.test(f)){const n=Number(row[i]);if(!Number.isInteger(n)||n<1||n>12)throw Error('月份须为1–12的整数');}});}}
  function saveFormRows(rows){if(!rows.length)throw Error("请至少填写一行数据");validateForm(activeForm,rows);const saved={rows,updatedAt:new Date().toISOString()};formCache.set(activeForm.name,saved);let stored=true;try{localStorage.setItem('biren-finance-form-'+activeForm.name,JSON.stringify(saved));}catch{stored=false;}$('#form-status').textContent=stored?`已保存 ${rows.length} 行示例，仅存本浏览器。`:'浏览器禁止持久存储，已暂存在本页；关闭页面后不保留。';$('#form-preview').innerHTML=tableHtml([activeForm.fields,...rows]);}
  function renderForms() {
    const groups=[{title:'预算与研发',indices:[0,1,2]},{title:'销售目标与商机',indices:[3,4,5,7]},{title:'成本与组织映射',indices:[6,8]},{title:'供应链',indices:[9]}];
    $('#forms-grid').innerHTML=groups.map(g=>`<section class="form-group"><div class="ph"><h3>${g.title}</h3><span class="sub">${g.indices.length} 张业务表</span></div>${g.indices.map(i=>{const f=M.forms[i],saved=formStorage(f.name);return `<div class="form-list-row"><div><h4>${esc(f.name)}</h4><p>${f.fields.map(esc).join(' / ')}</p></div><span>${esc(f.owner)}</span><span class="form-state">${saved?'已存示例':'待填写'}</span><button type="button" data-form-index="${i}">打开</button></div>`;}).join('')}</section>`).join('')+'<div class="reserved-note">预留填报 1 / 2 / 3：字段在需求确认后补充。</div>';
    $('#forms-grid').onclick=e=>{const btn=e.target.closest('[data-form-index]');if(btn)openForm(M.forms[+btn.dataset.formIndex]);};
    document.querySelectorAll('[data-close-form]').forEach(b=>b.onclick=()=>{$('#form-modal').hidden=true;});
    $('#form-save').onclick=()=>{try{saveFormRows([Array.from($('#form-fields').querySelectorAll('input'),i=>i.value)]);}catch(e){$('#form-status').textContent=e.message;}};
    $('#form-download').onclick=()=>{const content='\uFEFF'+[activeForm.fields,activeForm.sample].map(row=>row.map(csvCell).join(',')).join('\r\n');const url=URL.createObjectURL(new Blob([content],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=activeForm.name+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
    $('#form-upload').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>1024*1024)throw Error('示例文件请小于1MB');const rows=parseCsv(await file.text());if(JSON.stringify(rows[0])!==JSON.stringify(activeForm.fields))throw Error('表头与模板不一致，请下载对应模板');if(rows.length<2)throw Error('请至少填写一行数据');saveFormRows(rows.slice(1));}catch(err){$('#form-status').textContent=err.message;}e.target.value='';};
  }

  function boot() {
    $("#view-overview .filter-bar").innerHTML='<div class="note compact">集团 · 2026 YTD · 截至2026-07-31；专题页可按部门、项目和期间筛选。</div>';
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
    const hash = (location.hash || "#overview").slice(1);
    go(hash);
    window.addEventListener("hashchange", () => {
      go((location.hash || "#overview").slice(1));
    });
  }

  document.addEventListener("DOMContentLoaded", boot);
})();
