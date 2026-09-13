/* ==========================================================================
   唯捷创芯 · 销售BI看板原型 — 共享脚本（导航 / 布局 / 筛选 / ECharts主题）
   ========================================================================== */

/* ----------------------------- 导航与看板元数据 ----------------------------- */
const CHAPTERS = [
  { key: "c1", title: "第一章 · 看经营结果", q: "看清销售规模、预测达成与结构", color: "#2468f2",
    items: ["d01", "d02"] },
  { key: "c2", title: "第二章 · 拆经营结构", q: "从客户 / 产品 / 渠道拆解增长来源", color: "#12b39a",
    items: ["d03", "d04", "d05"] },
  { key: "c3", title: "第三章 · 管库存与供需", q: "库存与预测/订单/出货三方平衡", color: "#7a6ff0",
    items: ["d06"] },
  { key: "c4", title: "第四章 · 保交付与促销", q: "Lead Time / Pull-Push 与促销方案执行", color: "#f07a1d",
    items: ["d07", "d08"] },
  { key: "c5", title: "第五章 · 促样品转化", q: "送样及时性与订单转化", color: "#16b8c8",
    items: ["d09"] },
  { key: "c6", title: "第六章 · 控异常", q: "退货异常持续监控", color: "#e2544a",
    items: ["d10"] },
  { key: "cs", title: "支撑层 · 底表与对账", q: "统一下钻 / 对账 / 留痕", color: "#46586c",
    items: ["d00"] },
];

const DASH = {
  d01: { id: "D-01", name: "销售经营驾驶舱", icon: "📊", color: "#2468f2",
    q: "月度经营会入口：销售规模、预测达成、大客户结构与销售组BP。",
    batch: ["一期 P0", "一期 P1"], file: "d01-sales-cockpit.html" },
  d02: { id: "D-02", name: "销售预测全链路管理", icon: "🎯", color: "#1f5be0",
    q: "预测填报→版本修订→价格对比→预测达成闭环（SAP预测）。",
    batch: ["一期 P0"], file: "d02-forecast.html" },
  d03: { id: "D-03", name: "客户经营分析", icon: "👥", color: "#12b39a",
    q: "大客户销售额、年度满意度、客户Lead Time（客户×销售组）。",
    batch: ["一期 P1"], file: "d03-customer.html" },
  d04: { id: "D-04", name: "产品经营分析", icon: "📦", color: "#25a36c",
    q: "产品销量销售额、占比、增长率与新品表现（价格分析移至库存页）。",
    batch: ["一期 P1"], file: "d04-product.html" },
  d05: { id: "D-05", name: "渠道经营分析", icon: "🔀", color: "#5bb318",
    q: "直供 vs 经销规模与占比，支持年/季/月趋势切换。",
    batch: ["一期 P1"], file: "d05-channel.html" },
  d06: { id: "D-06", name: "库存与供需平衡监控", icon: "📥", color: "#7a6ff0",
    q: "VMI/自有/经销商库存周转与 POP/POS/rebate 价格对照。",
    batch: ["二期 P1"], file: "d06-inventory.html" },
  d07: { id: "D-07", name: "订单履约与交付监控", icon: "🚚", color: "#f07a1d",
    q: "Lead Time 分布、Pull-in/Push-out 与预测-订单差异异常。",
    batch: ["二期 P1"], file: "d07-delivery.html" },
  d08: { id: "D-08", name: "促销方案执行分析", icon: "🎁", color: "#e0a106",
    q: "促销方案执行呈现（销售上传表单），关注方案数与覆盖客户。",
    batch: ["二期 P2"], file: "d08-promotion.html" },
  d09: { id: "D-09", name: "送样管理与转化追踪", icon: "🧪", color: "#16b8c8",
    q: "送样总量、及时率、延迟与转化率追踪。",
    batch: ["二期 P2"], file: "d09-sample.html" },
  d10: { id: "D-10", name: "销售异常与退货监控", icon: "⚠️", color: "#e2544a",
    q: "退货率、退货金额持续监控（需退货原因标记）。",
    batch: ["一期 P1"], file: "d10-return.html" },
  d00: { id: "D-00", name: "统一明细底表", icon: "🗂️", color: "#46586c",
    q: "各看板可下钻、对账、留痕的明细底表。",
    batch: ["一期 P0"], file: "d00-detail.html" },
};

/* ----------------------------- 通用筛选器 ----------------------------- */
const FILTERS = [
  { k: "时间", v: "2026年 · 6月" },
  { k: "销售组", v: "全部销售组" },
  { k: "渠道", v: "全部渠道" },
  { k: "产品大类", v: "全部大类" },
  { k: "客户", v: "全部客户" },
];

/* ----------------------------- 布局渲染 ----------------------------- */
function renderLayout(activeId, opts) {
  opts = opts || {};
  const inPages = location.pathname.includes("/pages/");
  const home = inPages ? "../index.html" : "index.html";
  const toPage = (f) => (inPages ? f : "pages/" + f);

  // 侧边栏
  let nav = "";
  CHAPTERS.forEach((ch) => {
    nav += `<div class="nav-group"><div class="gt">${ch.title}</div>`;
    ch.items.forEach((k) => {
      const d = DASH[k];
      const on = k === activeId ? " active" : "";
      nav += `<a class="nav-item${on}" href="${toPage(d.file)}">
        <span class="ic">${d.icon}</span><span>${d.name}</span>
        <span class="code">${d.id}</span></a>`;
    });
    nav += `</div>`;
  });

  const sidebar = `<aside class="sidebar">
    <a class="brand" href="${home}">
      <div class="logo">唯</div>
      <div class="bt"><b>唯捷创芯</b><span>销售BI看板 · 原型 V5</span></div>
    </a>
    <nav class="nav">
      <div class="nav-group"><div class="gt">总览</div>
        <a class="nav-item${activeId === "home" ? " active" : ""}" href="${home}">
          <span class="ic">🏠</span><span>看板门户首页</span></a>
      </div>
      ${nav}
    </nav>
    <div class="sb-foot">数据更新：2026-06-24<br>说明：原型示意数据，非真实业务值</div>
  </aside>`;

  // 顶栏
  const d = DASH[activeId];
  const crumb = opts.crumb || (d ? `<b>${opts.chapter || ""}</b> ／ ${d.name}` : "看板门户");
  const title = opts.title || (d ? d.name : "看板门户首页");
  const pid = d ? `<span class="pid">${d.id}</span>` : "";
  const sub = opts.sub || (d ? d.q : "");

  let filtersHtml = "";
  if (opts.filters !== false) {
    filtersHtml = `<div class="filters">` +
      FILTERS.map((f) => `<div class="filter"><span class="fk">${f.k}</span><span class="fv">${f.v}</span></div>`).join("") +
      `<button class="btn-primary" style="margin-left:auto">查询</button>
       <button class="btn-ghost">重置</button>
       <button class="btn-ghost">导出</button></div>`;
  }

  const actions = opts.actions || `<span class="tag tag-gold">示例数据 · 仅用于需求评审演示</span>`;

  const topbar = `<header class="topbar">
    <div class="crumb">唯捷创芯 · 销售BI看板　／　${crumb}</div>
    <div class="page-head">
      <div>
        <div class="page-title"><h1>${title}</h1>${pid}${opts.batchTags || ""}</div>
        <div class="page-sub">${sub}</div>
      </div>
      <div class="page-actions">${actions}</div>
    </div>
    ${filtersHtml}
  </header>`;

  const app = document.createElement("div");
  app.className = "app";
  app.innerHTML = sidebar + `<main class="main">${topbar}<div class="content" id="content"></div></main>`;

  // 把已有 #content 内容迁移进去
  const existing = document.getElementById("content");
  const inner = existing ? existing.innerHTML : "";
  document.body.insertBefore(app, document.body.firstChild);
  if (existing && existing !== app.querySelector("#content")) existing.remove();
  app.querySelector("#content").innerHTML = inner;
}

/* ----------------------------- ECharts 主题 ----------------------------- */
const PALETTE = ["#2468f2", "#16b8c8", "#25a36c", "#f07a1d", "#7a6ff0", "#e0a106", "#e15a9b", "#12b39a", "#5bb318", "#e2544a"];
const AXIS_COLOR = "#9aa9bc";
const SPLIT_COLOR = "#eef2f8";
const TEXT_COLOR = "#46586c";

function baseGrid(o) { return Object.assign({ top: 30, left: 8, right: 16, bottom: 6, containLabel: true }, o || {}); }
function tip(extra) {
  return Object.assign({
    trigger: "axis",
    backgroundColor: "rgba(255,255,255,.97)",
    borderColor: "#e4ecf5", borderWidth: 1,
    textStyle: { color: "#1f2d3d", fontSize: 12 },
    extraCssText: "box-shadow:0 8px 24px rgba(28,60,105,.14);border-radius:10px;padding:8px 12px;",
    axisPointer: { type: "shadow", shadowStyle: { color: "rgba(36,104,242,.06)" } },
  }, extra || {});
}
function legend(o) {
  return Object.assign({ top: 0, right: 0, icon: "roundRect", itemWidth: 10, itemHeight: 10,
    itemGap: 14, textStyle: { color: TEXT_COLOR, fontSize: 11.5 } }, o || {});
}
function catAxis(data, o) {
  return Object.assign({
    type: "category", data: data, boundaryGap: true,
    axisLine: { lineStyle: { color: "#dde6f0" } },
    axisTick: { show: false },
    axisLabel: { color: AXIS_COLOR, fontSize: 11 },
  }, o || {});
}
function valAxis(o) {
  return Object.assign({
    type: "value",
    axisLine: { show: false }, axisTick: { show: false },
    axisLabel: { color: AXIS_COLOR, fontSize: 11 },
    splitLine: { lineStyle: { color: SPLIT_COLOR } },
  }, o || {});
}
function gradient(c1, c2) {
  return new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: c1 }, { offset: 1, color: c2 }]);
}
function areaGrad(c, a1, a2) {
  return new echarts.graphic.LinearGradient(0, 0, 0, 1, [
    { offset: 0, color: "rgba(" + c + "," + a1 + ")" },
    { offset: 1, color: "rgba(" + c + "," + a2 + ")" }]);
}

const _charts = [];
function mk(id, option) {
  const el = document.getElementById(id);
  if (!el) return null;
  const c = echarts.init(el, null, { renderer: "canvas" });
  c.setOption(Object.assign({ color: PALETTE, textStyle: { fontFamily: "PingFang SC, Microsoft YaHei, sans-serif" } }, option));
  _charts.push(c);
  return c;
}
window.addEventListener("resize", () => _charts.forEach((c) => c.resize()));

/* 迷你 sparkline */
function spark(id, data, color) {
  const el = document.getElementById(id);
  if (!el) return;
  const c = echarts.init(el);
  c.setOption({
    grid: { top: 2, bottom: 2, left: 2, right: 2 },
    xAxis: { type: "category", show: false, data: data.map((_, i) => i), boundaryGap: false },
    yAxis: { type: "value", show: false, min: Math.min(...data) * 0.9 },
    series: [{ type: "line", data: data, smooth: true, symbol: "none",
      lineStyle: { width: 2, color: color }, areaStyle: { color: areaGrad(hexToRgb(color), .28, .02) } }],
  });
  _charts.push(c);
}
function hexToRgb(hex) {
  hex = hex.replace("#", "");
  const n = parseInt(hex, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].join(",");
}

/* gauge 通用 */
function gaugeOpt(value, color, opt) {
  opt = opt || {};
  return {
    series: [{
      type: "gauge", radius: "92%", center: ["50%", "58%"],
      startAngle: 210, endAngle: -30, min: 0, max: opt.max || 100,
      progress: { show: true, width: 14, roundCap: true, itemStyle: { color: color } },
      axisLine: { lineStyle: { width: 14, color: [[1, "#eef2f8"]] } },
      pointer: { show: false },
      axisTick: { show: false }, splitLine: { show: false }, axisLabel: { show: false },
      anchor: { show: false },
      title: { offsetCenter: [0, "34%"], color: TEXT_COLOR, fontSize: 12 },
      detail: { offsetCenter: [0, "2%"], fontSize: 26, fontWeight: 800, color: "#142a48",
        formatter: opt.fmt || ((v) => v + "%") },
      data: [{ value: value, name: opt.name || "" }],
    }],
  };
}
