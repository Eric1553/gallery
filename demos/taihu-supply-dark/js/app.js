(() => {
  const D = window.TAIHU_DATA;
  if (!D) return;

  const MODULES = [
    { id: "overview", label: "总览", idx: "01" },
    { id: "approval", label: "审批时效", idx: "02" },
    { id: "chain", label: "采购执行", idx: "03" },
    { id: "quality", label: "来料质量", idx: "04" },
    { id: "warehouse", label: "仓储", idx: "05" },
    { id: "project", label: "项目交期", idx: "06" },
    { id: "internal", label: "内部交易", idx: "07" },
    { id: "loop", label: "经营闭环", idx: "08" },
  ];

  const state = {
    module: "overview",
    flowId: "urgent",
    filters: {
      book: "all",
      time: "30d",
      std: "all",
      rd: "all",
      excludeInternal: true,
    },
  };

  let qualityChart = null;

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  function buildNav() {
    const side = $("#sideNav");
    side.innerHTML = "";
    MODULES.forEach((m) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.dataset.module = m.id;
      btn.className = m.id === state.module ? "is-active" : "";
      btn.innerHTML = `<span class="nav-idx">${m.idx}</span><span>${m.label}</span>`;
      btn.addEventListener("click", () => go(m.id));
      side.appendChild(btn);
    });
  }

  function go(id) {
    if (!MODULES.some((m) => m.id === id)) return;
    state.module = id;
    $$(".module").forEach((el) => el.classList.toggle("is-active", el.dataset.module === id));
    $$("#sideNav button").forEach((el) => el.classList.toggle("is-active", el.dataset.module === id));
    if (id === "quality") renderQualityChart();
  }

  function nextModule(dir) {
    const idx = MODULES.findIndex((m) => m.id === state.module);
    const next = MODULES[idx + dir];
    if (next) go(next.id);
  }

  function initFilters() {
    const book = $("#filterBook");
    book.innerHTML = D.books.map((b) => `<option value="${b.id}">${b.label}</option>`).join("");
    book.addEventListener("change", (e) => {
      state.filters.book = e.target.value;
      applyFilters();
    });
    $("#filterTime").addEventListener("change", (e) => {
      state.filters.time = e.target.value;
      applyFilters();
    });
    $("#filterStd").addEventListener("change", (e) => {
      state.filters.std = e.target.value;
      applyFilters();
    });
    $("#filterRd").addEventListener("change", (e) => {
      state.filters.rd = e.target.value;
      applyFilters();
    });
    $("#filterInternal").addEventListener("change", (e) => {
      state.filters.excludeInternal = e.target.checked;
      applyFilters();
    });
  }

  function applyFilters() {
    const badge = $("#internalBadge");
    if (badge) badge.textContent = state.filters.excludeInternal ? "剔除：开" : "剔除：关";
    const hint = $("#funnelFilterHint");
    if (hint) hint.textContent = state.filters.excludeInternal ? "已剔除内部" : "含内部交易";
    const pBadge = $("#projectFilterBadge");
    if (pBadge) {
      pBadge.textContent = [
        state.filters.std === "all" ? "全部类型" : state.filters.std,
        state.filters.rd === "all" ? "全部属性" : state.filters.rd,
      ].join(" · ");
    }
    renderProjects();
    renderFunnel();
  }

  function openDrawer(title, html) {
    $("#drawerTitle").textContent = title;
    $("#drawerBody").innerHTML = html;
    $("#drawer").classList.add("is-open");
    $("#drawerScrim").classList.add("is-open");
    $("#drawer").setAttribute("aria-hidden", "false");
  }

  function closeDrawer() {
    $("#drawer").classList.remove("is-open");
    $("#drawerScrim").classList.remove("is-open");
    $("#drawer").setAttribute("aria-hidden", "true");
  }

  function tableFromRows(headers, rows) {
    const head = headers.map((h) => `<th>${h}</th>`).join("");
    const body = rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("");
    return `<table class="data-table"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
  }

  function ringSvg(pct, tone) {
    const p = Math.max(0, Math.min(100, pct));
    const r = 26;
    const c = 2 * Math.PI * r;
    const offset = c * (1 - p / 100);
    return `<svg class="ring-gauge ring-gauge--${tone || "neutral"}" viewBox="0 0 64 64" aria-hidden="true">
      <circle class="ring-gauge__track" cx="32" cy="32" r="${r}" />
      <circle class="ring-gauge__val" cx="32" cy="32" r="${r}"
        stroke-dasharray="${c.toFixed(2)}" stroke-dashoffset="${offset.toFixed(2)}" />
    </svg>`;
  }

  function sparkSvg(values) {
    const vals = values.length ? values : [3, 5, 4, 7, 6, 8, 5];
    const max = Math.max(...vals, 1);
    const min = Math.min(...vals, 0);
    const span = max - min || 1;
    const pts = vals
      .map((v, i) => {
        const x = (i / Math.max(vals.length - 1, 1)) * 64;
        const y = 22 - ((v - min) / span) * 18;
        return `${x},${y}`;
      })
      .join(" ");
    return `<svg class="kpi-spark" viewBox="0 0 64 24" preserveAspectRatio="none" aria-hidden="true">
      <polyline points="${pts}" />
    </svg>`;
  }

  function renderPulse() {
    const grid = $("#pulseGrid");
    grid.innerHTML = "";
    D.pulse.forEach((k, i) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `kpi kpi--viz kpi--${k.tone}`;
      btn.style.setProperty("--i", String(i));
      const val =
        Number.isInteger(k.value) ? String(k.value) : k.value.toFixed(1);
      const cmpClass = (dir) =>
        dir === "up" ? "is-up" : dir === "down" ? "is-down" : dir === "warn" ? "is-warn" : "";
      const mom = k.mom || { label: "环比", value: "—", dir: "" };
      const yoy = k.yoy || { label: "同比", value: "—", dir: "" };
      const isPct = k.unit === "%";
      const sparkSrc =
        k.id === "iqc-rate"
          ? k.drill.map((d) => parseFloat(d.rate))
          : k.id === "in-transit"
            ? [98, 105, 112, 118, 122, 128, 128]
            : k.id === "approval-overdue"
              ? [2, 3, 4, 5, 4, 6, 7]
              : k.id === "inv-risk"
                ? [10, 11, 12, 13, 12, 14, 14]
                : [86, 88, 89, 90, 90.5, 91, 91.2];
      const viz = isPct
        ? `<div class="kpi__viz">${ringSvg(Number(k.value), k.tone)}</div>`
        : `<div class="kpi__viz kpi__viz--spark">${sparkSvg(sparkSrc)}</div>`;
      btn.innerHTML = `
        <div class="kpi__top">
          <div>
            <div class="kpi__label">${k.label}</div>
            <div class="kpi__value"><span data-val>${val}</span><small>${k.unit}</small></div>
          </div>
          ${viz}
        </div>
        <div class="kpi__compare">
          <div class="kpi__cmp">
            <span class="kpi__cmp-label">${mom.label}</span>
            <span class="kpi__cmp-val ${cmpClass(mom.dir)}">${mom.value}</span>
          </div>
          <div class="kpi__cmp">
            <span class="kpi__cmp-label">${yoy.label}</span>
            <span class="kpi__cmp-val ${cmpClass(yoy.dir)}">${yoy.value}</span>
          </div>
        </div>
        <div class="kpi__meta">
          <span class="kpi__delta">较上期 ${k.delta}</span>
          <span class="kpi__sub">${k.sub || ""}</span>
        </div>`;
      btn.addEventListener("click", () => {
        let html = "";
        if (k.id === "approval-overdue") {
          html = tableFromRows(
            ["单号", "类型", "节点", "停留", "SLA"],
            k.drill.map((r) => [r.no, r.type, r.node, r.stay, r.sla])
          );
        } else if (k.id === "iqc-rate") {
          html = tableFromRows(
            ["日期", "合格", "不合格", "合格率"],
            k.drill.map((r) => [r.date, r.pass, r.fail, r.rate])
          );
        } else if (k.id === "otd") {
          html = tableFromRows(
            ["PO", "供应商", "承诺", "实到", "偏差"],
            k.drill.map((r) => [r.no, r.supplier, r.due, r.actual, r.late])
          );
        } else if (k.id === "inv-risk") {
          html = tableFromRows(
            ["SKU", "名称", "库龄", "数量", "标记"],
            k.drill.map((r) => [r.sku, r.name, r.age, r.qty, r.flag])
          );
        } else {
          html = tableFromRows(
            ["单号", "供应商", "金额", "ETA", "状态"],
            k.drill.map((r) => [r.no, r.supplier, r.amount, r.eta, r.status])
          );
        }
        openDrawer(k.label, html);
      });
      grid.appendChild(btn);
    });
  }

  function renderOverviewExtras() {
    const hud = $("#hudStrip");
    if (hud) {
      const chips = [
        { label: "飞书审批", val: "在线", tone: "good" },
        { label: "金蝶星空", val: "同步中", tone: "good" },
        { label: "来料合格", val: `${D.pulse.find((p) => p.id === "iqc-rate")?.value ?? "—"}%`, tone: "good" },
        { label: "交货及时", val: `${D.pulse.find((p) => p.id === "otd")?.value ?? "—"}%`, tone: "good" },
        { label: "审批超时", val: `${D.pulse.find((p) => p.id === "approval-overdue")?.value ?? 0} 单`, tone: "warn" },
        { label: "跨系统断点", val: `${(D.loopKpis || []).find((x) => x.label.includes("断点"))?.value || 3} 单`, tone: "warn" },
      ];
      hud.innerHTML = chips
        .map(
          (c) => `<div class="hud-chip hud-chip--${c.tone}">
            <span class="hud-chip__pulse"></span>
            <span class="hud-chip__label">${c.label}</span>
            <strong>${c.val}</strong>
          </div>`
        )
        .join("");
    }

    const chain = $("#overviewChain");
    if (chain) {
      const links = [
        { id: "approval", label: "审批时效", sys: "飞书", signal: 92 },
        { id: "chain", label: "采购执行", sys: "金蝶", signal: 88 },
        { id: "quality", label: "来料质量", sys: "检验", signal: 96 },
        { id: "warehouse", label: "仓储", sys: "出入库", signal: 84 },
        { id: "project", label: "项目交期", sys: "PO", signal: 79 },
        { id: "internal", label: "内部交易", sys: "多账套", signal: 90 },
        { id: "loop", label: "经营闭环", sys: "CRM×ERP", signal: 86 },
      ];
      chain.innerHTML = `
        <div class="mission-beam" aria-hidden="true"></div>
        ${links
          .map(
            (l, i) => `
          <button type="button" class="mission-node" data-jump="${l.id}" style="--i:${i}">
            <span class="mission-node__idx">${String(i + 1).padStart(2, "0")}</span>
            <span class="mission-node__dot"><i></i></span>
            <strong>${l.label}</strong>
            <span>${l.sys}</span>
            <div class="mission-node__bar"><b style="width:${l.signal}%"></b></div>
          </button>`
          )
          .join("")}`;
      chain.querySelectorAll("[data-jump]").forEach((btn) => {
        btn.addEventListener("click", () => go(btn.dataset.jump));
      });
    }

    const sla = $("#overviewSla");
    if (sla) {
      sla.innerHTML = D.approvalFlows
        .filter((f) => !f.optional)
        .map((f) => {
          const over = f.avgHours > f.sla;
          const load = Math.min(140, Math.round((f.avgHours / f.sla) * 100));
          const r = 34;
          const c = 2 * Math.PI * r;
          const offset = c * (1 - Math.min(load, 100) / 100);
          return `<div class="sla-dial ${over ? "is-warn" : ""}">
            <svg viewBox="0 0 88 88" aria-hidden="true">
              <circle class="sla-dial__track" cx="44" cy="44" r="${r}" />
              <circle class="sla-dial__val" cx="44" cy="44" r="${r}"
                stroke-dasharray="${c.toFixed(2)}" stroke-dashoffset="${offset.toFixed(2)}" />
            </svg>
            <div class="sla-dial__core">
              <strong>${f.avgHours}<small>h</small></strong>
              <span>SLA ${f.sla}h</span>
            </div>
            <div class="sla-dial__name">${f.name}</div>
            <div class="sla-dial__sub">超时 ${f.overdue} · 负荷 ${load}%</div>
          </div>`;
        })
        .join("");
    }

    const of = $("#overviewFunnel");
    if (of) {
      const max = D.chainFunnel[0].count;
      of.innerHTML = D.chainFunnel
        .map((r, i) => {
          const w = Math.max(38, (r.count / max) * 100);
          const prev = i ? D.chainFunnel[i - 1].count : r.count;
          const rate = prev ? ((r.count / prev) * 100).toFixed(0) : "100";
          return `<div class="vfunnel__row" style="--w:${w}%; --i:${i}">
            ${
              i
                ? `<div class="vfunnel__bridge" aria-hidden="true">
                    <span class="vfunnel__rate">${rate}%</span>
                  </div>`
                : ""
            }
            <div class="vfunnel__band">
              <span>${r.stage}</span>
              <strong>${r.count}</strong>
            </div>
          </div>`;
        })
        .join("");
    }

    const rank = $("#overviewRank");
    if (rank) {
      const maxOd = Math.max(...D.approvalRank.map((r) => r.overdue), 1);
      rank.innerHTML = D.approvalRank
        .slice(0, 5)
        .map((r, i) => {
          const w = (r.overdue / maxOd) * 100;
          return `<div class="rank-meter" style="--i:${i}">
            <div class="rank-meter__head">
              <span>${r.name}<small>${r.flow || ""}</small></span>
              <strong>${r.overdue} · ${r.avgStay}</strong>
            </div>
            <div class="rank-meter__track"><b style="width:${w}%"></b></div>
          </div>`;
        })
        .join("");
    }
  }

  function renderFlows() {
    const wrap = $("#flowCards");
    wrap.innerHTML = "";
    D.approvalFlows.forEach((f) => {
      const card = document.createElement("button");
      card.type = "button";
      card.className =
        "flow-card" +
        (f.id === state.flowId ? " is-selected" : "") +
        (f.optional ? " is-optional" : "");
      if (f.optional) {
        card.innerHTML = `
          <div class="flow-card__name">${f.name}</div>
          <div class="flow-card__metric">—</div>
          <div class="flow-card__sub">${f.note}</div>`;
        card.disabled = true;
      } else {
        const overSla = f.avgHours > f.sla;
        card.innerHTML = `
          <div class="flow-card__name">${f.name}</div>
          <div class="flow-card__metric" style="color:${overSla ? "var(--warn)" : "inherit"}">${f.avgHours}<small> h</small></div>
          <div class="flow-card__sub">${f.volume} 单 · 超时 ${f.overdue} · SLA ${f.sla}h</div>`;
        card.addEventListener("click", () => {
          state.flowId = f.id;
          renderFlows();
          renderFlowDetail();
        });
      }
      wrap.appendChild(card);
    });
    renderFlowDetail();
  }

  function renderFlowDetail() {
    const f = D.approvalFlows.find((x) => x.id === state.flowId) || D.approvalFlows[0];
    $("#nodeTitle").textContent = `${f.name} · 节点停留`;
    $("#flowSlaBadge").textContent = `SLA ${f.sla}h`;
    const max = Math.max(...f.nodes.map((n) => n.avg), 1);
    $("#nodeBars").innerHTML = f.nodes
      .map(
        (n) => `
      <div class="node-bar">
        <span>${n.name}</span>
        <div class="node-bar__track"><div class="node-bar__fill" style="width:${(n.avg / max) * 100}%"></div></div>
        <span class="node-bar__val">${n.avg}h</span>
      </div>`
      )
      .join("");

    const hmax = Math.max(...f.heat, 1);
    $("#heatRow").innerHTML = f.heat
      .map(
        (v) =>
          `<div class="heat-cell" style="height:${Math.max(12, (v / hmax) * 100)}%;opacity:${0.35 + (v / hmax) * 0.65}"></div>`
      )
      .join("");

    $("#rankList").innerHTML = D.approvalRank
      .map(
        (r) =>
          `<li><span>${r.name}<small class="rank-flow">${r.flow || ""}</small></span><span class="warn">${r.overdue} · ${r.avgStay}</span></li>`
      )
      .join("");

    const hl = $("#heatLabels");
    if (hl) {
      hl.innerHTML = (D.heatLabels || []).map((lab) => `<span>${lab}</span>`).join("");
    }

    const ot = $("#approvalOverdueTable");
    if (ot) {
      const rows = D.approvalOverdueList || [];
      const badge = $("#overdueCountBadge");
      if (badge) badge.textContent = `${rows.length} 单`;
      ot.innerHTML = `
        <thead><tr><th>单号</th><th>类型</th><th>节点</th><th>停留</th><th>SLA</th><th>责任人</th><th>账套</th></tr></thead>
        <tbody>${rows
          .map((r) => {
            const over = r.stay > r.sla;
            return `<tr class="${over ? "row-warn" : ""}">
              <td>${r.no}</td><td>${r.type}</td><td>${r.node}</td>
              <td class="num ${over ? "text-warn" : ""}">${r.stay}h</td>
              <td class="num">${r.sla}h</td><td>${r.owner}</td><td>${r.book}</td>
            </tr>`;
          })
          .join("")}</tbody>`;
    }
  }

  function openSampleTimeline() {
    const t = D.sampleTimeline;
    const html = `
      <p class="drawer-sub">${t.title}</p>
      <div class="timeline">
        ${t.steps
          .map(
            (s) => `
          <div class="tl-step is-${s.status}">
            <div class="tl-dot"></div>
            <div class="tl-body">
              <h4><span class="sys-tag">${s.sys}</span> ${s.name}</h4>
              <p>${s.detail}</p>
              <div class="tl-meta"><span>${s.time}</span><span>${s.stay}</span></div>
            </div>
          </div>`
          )
          .join("")}
      </div>`;
    openDrawer("样例时间轴", html);
  }

  function renderFunnel() {
    const max = D.chainFunnel[0].count;
    const factor = state.filters.excludeInternal ? 0.94 : 1;
    $("#funnel").innerHTML = D.chainFunnel
      .map((r) => {
        const count = Math.round(r.count * factor * (state.filters.book === "all" ? 1 : 0.62));
        const w = (count / max) * 100;
        return `
        <div class="funnel-row">
          <span>${r.stage}</span>
          <div class="funnel-row__bar"><div class="funnel-row__fill" style="width:${w}%"></div></div>
          <span class="funnel-row__n">${count}</span>
        </div>`;
      })
      .join("");
    renderOpenPos();
  }

  function renderOpenPos() {
    const el = $("#openPoTable");
    if (!el) return;
    let rows = (D.openPos || []).slice();
    if (state.filters.std !== "all") rows = rows.filter((r) => r.type === state.filters.std);
    if (state.filters.rd !== "all") rows = rows.filter((r) => r.rd === state.filters.rd);
    const riskClass = (r) =>
      r === "加急" || r === "关注" ? "risk-tag--warn" : "risk-tag--ok";
    el.innerHTML = `
      <thead><tr>
        <th>PO</th><th>供应商</th><th>金额</th><th>标准/非标</th><th>研发</th><th>状态</th><th>ETA</th><th>交期</th>
      </tr></thead>
      <tbody>${
        rows.length
          ? rows
              .map(
                (r) => `<tr>
          <td>${r.no}</td><td>${r.supplier}</td><td class="num">${r.amount}</td>
          <td>${r.type}</td><td>${r.rd}</td><td>${r.status}</td><td>${r.eta}</td>
          <td><span class="risk-tag ${riskClass(r.otdRisk)}">${r.otdRisk}</span></td>
        </tr>`
              )
              .join("")
          : `<tr><td colspan="8" class="empty">无匹配</td></tr>`
      }</tbody>`;
  }

  function renderTimeline() {
    const t = D.sampleTimeline;
    $("#timeline").innerHTML = t.steps
      .map(
        (s) => `
      <div class="tl-step is-${s.status}">
        <div class="tl-dot"></div>
        <div class="tl-body">
          <h4><span class="sys-tag">${s.sys}</span> ${s.name}</h4>
          <p>${s.detail}</p>
          <div class="tl-meta"><span>${s.time}</span><span>${s.stay}</span></div>
        </div>
      </div>`
      )
      .join("");
  }

  function renderQuality() {
    const q = D.quality;
    $("#qualityStats").innerHTML = `
      <div class="stat-card"><div class="stat-card__label">检验批次</div><div class="stat-card__value">${q.batches || q.pass + q.fail}</div></div>
      <div class="stat-card"><div class="stat-card__label">合格</div><div class="stat-card__value is-good">${q.pass}</div></div>
      <div class="stat-card"><div class="stat-card__label">不合格</div><div class="stat-card__value is-bad">${q.fail}</div></div>
      <div class="stat-card"><div class="stat-card__label">合格率</div><div class="stat-card__value">${q.rate}<small>%</small></div></div>`;

    const st = $("#qualitySupplierTable");
    if (st) {
      st.innerHTML = `
        <thead><tr><th>供应商</th><th>合格</th><th>不合格</th><th>合格率</th></tr></thead>
        <tbody>${(q.bySupplier || [])
          .map(
            (r) => `<tr class="${r.focus ? "row-warn" : ""}">
              <td>${r.supplier}${r.focus ? ' <span class="risk-tag risk-tag--warn">重点</span>' : ""}</td>
              <td class="num">${r.pass}</td><td class="num">${r.fail}</td>
              <td class="num ${r.rate < 95 ? "text-warn" : ""}">${r.rate}%</td>
            </tr>`
          )
          .join("")}</tbody>`;
    }
    const ft = $("#qualityFailTable");
    if (ft) {
      ft.innerHTML = `
        <thead><tr><th>日期</th><th>SKU</th><th>供应商</th><th>数量</th><th>原因</th></tr></thead>
        <tbody>${(q.recentFail || [])
          .map(
            (r) => `<tr>
              <td>${r.date}</td><td>${r.sku}</td><td>${r.supplier}</td>
              <td class="num">${r.qty}</td><td>${r.reason}</td>
            </tr>`
          )
          .join("")}</tbody>`;
    }
  }

  function cssVar(name, fallback) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
  }

  function renderQualityChart() {
    const box = $("#qualityChart");
    const q = D.quality;
    if (window.Chart) {
      if (qualityChart) qualityChart.destroy();
      box.innerHTML = '<canvas id="qCanvas"></canvas>';
      const ctx = $("#qCanvas").getContext("2d");
      const accent = cssVar("--accent", "#22d3ee");
      const muted = cssVar("--text-dim", "#6b778c");
      const grid = cssVar("--chart-grid", "rgba(255,255,255,.06)");
      qualityChart = new Chart(ctx, {
        type: "line",
        data: {
          labels: q.labels,
          datasets: [
            {
              label: "合格率 %",
              data: q.trend,
              borderColor: accent,
              backgroundColor: accent + "22",
              fill: true,
              tension: 0.35,
              pointRadius: 3.5,
              pointBackgroundColor: accent,
              borderWidth: 2.2,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { ticks: { color: muted, font: { family: "Outfit" } }, grid: { color: grid } },
            y: {
              min: 90,
              max: 100,
              ticks: { color: muted, callback: (v) => v + "%", font: { family: "Outfit" } },
              grid: { color: grid },
            },
          },
        },
      });
    } else {
      const w = 560,
        h = 200,
        pad = 28;
      const min = 90,
        max = 100;
      const pts = q.trend.map((v, i) => {
        const x = pad + (i / (q.trend.length - 1)) * (w - pad * 2);
        const y = pad + (1 - (v - min) / (max - min)) * (h - pad * 2);
        return `${x},${y}`;
      });
      box.innerHTML = `
        <svg class="chart-fallback" viewBox="0 0 ${w} ${h}" role="img">
          <polyline fill="none" stroke="var(--accent)" stroke-width="2.5" points="${pts.join(" ")}" />
          ${q.trend
            .map((v, i) => {
              const x = pad + (i / (q.trend.length - 1)) * (w - pad * 2);
              const y = pad + (1 - (v - min) / (max - min)) * (h - pad * 2);
              return `<circle cx="${x}" cy="${y}" r="3.5" fill="var(--accent)" />`;
            })
            .join("")}
          ${q.labels
            .map((lab, i) => {
              const x = pad + (i / (q.labels.length - 1)) * (w - pad * 2);
              return `<text x="${x}" y="${h - 6}" text-anchor="middle" fill="var(--text-dim)" font-size="11">${lab}</text>`;
            })
            .join("")}
        </svg>`;
    }
  }

  function renderWarehouse() {
    const w = D.warehouse;
    $("#moveTable").innerHTML = `
      <thead><tr><th>类型</th><th>入库</th><th>出库</th><th>金额</th></tr></thead>
      <tbody>${w.moves
        .map(
          (m) =>
            `<tr><td>${m.type}</td><td class="num">${m.in}</td><td class="num">${m.out}</td><td class="num">${m.amount || "—"}</td></tr>`
        )
        .join("")}</tbody>`;
    $("#ageBars").innerHTML = w.ageBuckets
      .map(
        (b) => `
      <div class="age-row ${b.pct >= 10 && b.label.includes("180") ? "is-warn" : ""}">
        <span>${b.label}</span>
        <div class="age-row__track"><div class="age-row__fill" style="width:${b.pct}%"></div></div>
        <span>${b.pct}% · ${b.amount || ""}</span>
      </div>`
      )
      .join("");
    const s = w.stockSummary;
    $("#stockStrip").innerHTML = `
      <div><span>期初</span><strong>${s.begin}</strong></div>
      <div><span>入库</span><strong>${s.in}</strong></div>
      <div><span>出库</span><strong>${s.out}</strong></div>
      <div><span>期末</span><strong>${s.end}</strong></div>`;

    const rt = $("#warehouseRiskTable");
    if (rt) {
      rt.innerHTML = `
        <thead><tr><th>SKU</th><th>名称</th><th>库龄</th><th>数量</th><th>金额</th><th>标记</th></tr></thead>
        <tbody>${(w.riskSkus || [])
          .map((r) => {
            const tag =
              r.flag === "高库龄"
                ? "risk-tag--bad"
                : r.flag === "呆滞候选"
                  ? "risk-tag--warn"
                  : "risk-tag--ok";
            return `<tr>
              <td>${r.sku}</td><td>${r.name}</td>
              <td class="num">${r.age}天</td><td class="num">${r.qty}</td>
              <td class="num">${r.amount}</td>
              <td><span class="risk-tag ${tag}">${r.flag}</span></td>
            </tr>`;
          })
          .join("")}</tbody>`;
    }
  }

  function renderProjects() {
    const ps = $("#projectSummary");
    if (ps && D.projectSummary) {
      ps.innerHTML = D.projectSummary
        .map(
          (s) =>
            `<div class="stat-card"><div class="stat-card__label">${s.label}</div><div class="stat-card__value ${s.tone === "warn" ? "is-bad" : ""}">${s.value}</div></div>`
        )
        .join("");
    }
    let rows = D.projects.slice();
    if (state.filters.std !== "all") rows = rows.filter((r) => r.type === state.filters.std);
    if (state.filters.rd !== "all") rows = rows.filter((r) => r.rd === state.filters.rd);
    const riskClass = (r) =>
      r === "正常" ? "risk-tag--ok" : r === "交期紧" ? "risk-tag--warn" : "risk-tag--bad";
    $("#projectTable").innerHTML = `
      <thead><tr>
        <th>项目</th><th>标准/非标</th><th>研发</th><th>金额</th><th>交货及时率</th><th>付款计划</th><th>下一交期</th><th>风险</th>
      </tr></thead>
      <tbody>${
        rows.length
          ? rows
              .map(
                (r) => `<tr class="${r.risk !== "正常" ? "row-warn" : ""}">
          <td>${r.code}</td><td>${r.type}</td><td>${r.rd}</td>
          <td class="num">${r.amount || "—"}</td>
          <td class="num ${r.otd < 85 ? "text-warn" : ""}">${r.otd}%</td>
          <td>${r.payPlan}</td><td>${r.nextDue}</td>
          <td><span class="risk-tag ${riskClass(r.risk)}">${r.risk}</span></td>
        </tr>`
              )
              .join("")
          : `<tr><td colspan="8" class="empty">无匹配</td></tr>`
      }</tbody>`;
  }

  function renderInternal() {
    const is = $("#internalSummary");
    if (is && D.internalTrade.summary) {
      is.innerHTML = D.internalTrade.summary
        .map(
          (s) =>
            `<div class="stat-card"><div class="stat-card__label">${s.label}</div><div class="stat-card__value">${s.value}</div></div>`
        )
        .join("");
    }
    const b = D.internalTrade.bridge[0];
    $("#bridge").innerHTML = `
      <div class="bridge-card"><strong>${b.from}</strong><span>账套 A</span></div>
      <div class="bridge-arrow" aria-hidden="true">
        <svg width="28" height="12" viewBox="0 0 28 12"><path d="M0 6h22M18 1l5 5-5 5" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>
      </div>
      <div class="bridge-card bridge-card--mid"><strong>${b.mid}</strong><span>跨公司</span></div>
      <div class="bridge-arrow" aria-hidden="true">
        <svg width="28" height="12" viewBox="0 0 28 12"><path d="M0 6h22M18 1l5 5-5 5" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>
      </div>
      <div class="bridge-card"><strong>${b.to}</strong><span>账套 B</span></div>`;
    $("#bridgeTable").innerHTML = `
      <thead><tr><th>A-PO</th><th>B-SO</th><th>物料</th><th>金额</th><th>状态</th></tr></thead>
      <tbody>${D.internalTrade.samples
        .map(
          (s) =>
            `<tr><td>${s.po}</td><td>${s.so}</td><td>${s.material || "—"}</td><td class="num">${s.amount}</td><td>${s.status}</td></tr>`
        )
        .join("")}</tbody>`;
  }

  function renderLoop() {
    const kpiHost = $("#loopKpis");
    if (kpiHost) {
      kpiHost.innerHTML = (D.loopKpis || [])
        .map((k, i) => {
          const unit = k.unit ? `<small>${k.unit}</small>` : "";
          return `<div class="loop-kpi loop-kpi--${k.tone || "neutral"}" style="--i:${i}">
            <div class="loop-kpi__label">${k.label}</div>
            <div class="loop-kpi__value">${k.value}${unit}</div>
            <div class="loop-kpi__sub">${k.sub || ""}</div>
          </div>`;
        })
        .join("");
    }

    const loopHost = $("#loopRail");
    if (loopHost) {
      const n = D.closedLoop.length;
      const step = 360 / n;
      loopHost.innerHTML = `
        <div class="orbit__ring" aria-hidden="true"></div>
        <div class="orbit__ring orbit__ring--inner" aria-hidden="true"></div>
        <div class="orbit__hub">
          <strong>经营闭环</strong>
          <span>线索 → 应收</span>
          <em>${D.closedLoop.reduce((s, x) => s + (x.count || 0), 0)}</em>
          <small>链路节点量</small>
        </div>
        <div class="orbit__nodes">
          ${D.closedLoop
            .map((node, i) => {
              const a = -90 + i * step;
              return `<div class="orbit__node" style="--a:${a}deg; --i:${i}">
                <button type="button" class="orbit__card">
                  <strong>${node.name}</strong>
                  <span>${node.sys}</span>
                  <em>${node.count}</em>
                  ${node.conv ? `<b>${node.conv}</b>` : "<b>START</b>"}
                </button>
              </div>`;
            })
            .join("")}
        </div>`;
    }

    const conv = $("#loopConvTable");
    if (conv) {
      conv.innerHTML = `
        <thead><tr><th>阶段</th><th>转化率</th><th>漏损</th><th>周期</th><th>责任</th></tr></thead>
        <tbody>${(D.loopConversions || [])
          .map(
            (r) =>
              `<tr><td>${r.stage}</td><td class="num">${r.rate}</td><td class="num">${r.drop}</td><td class="num">${r.cycle}</td><td>${r.owner}</td></tr>`
          )
          .join("")}</tbody>`;
    }

    const bn = $("#loopBottleneckTable");
    if (bn) {
      bn.innerHTML = `
        <thead><tr><th>编号</th><th>阶段</th><th>问题</th><th>单数</th><th>责任人</th><th>停留</th></tr></thead>
        <tbody>${(D.loopBottlenecks || [])
          .map((r) => {
            const cls = r.tone === "danger" || r.tone === "warn" ? "row-warn" : "";
            return `<tr class="${cls}"><td>${r.id}</td><td>${r.stage}</td><td>${r.issue}</td><td class="num">${r.count}</td><td>${r.owner}</td><td class="num text-warn">${r.age}</td></tr>`;
          })
          .join("")}</tbody>`;
    }

    (D.loopSystems || []).forEach((sys, i) => {
      const el = $(`#loopSys${i}`);
      if (!el) return;
      const healthClass =
        sys.health === "关注" ? "badge--warn" : sys.health === "异常" ? "badge--warn" : "badge--good";
      const metrics = (sys.metrics || [])
        .map((m) => {
          if (typeof m === "string") return `<div class="loop-metric">${m}</div>`;
          return `<div class="loop-metric loop-metric--rich">
            <span class="loop-metric__label">${m.label}</span>
            <strong class="loop-metric__value">${m.value}</strong>
            <span class="loop-metric__hint">${m.hint || ""}</span>
          </div>`;
        })
        .join("");
      el.innerHTML = `
        <div class="panel__head">
          <h3>${sys.sys}</h3>
          <div class="tag-row">
            <span class="badge ${healthClass}">${sys.health || "正常"}</span>
            <span class="badge badge--muted">${sys.focus}</span>
          </div>
        </div>
        <div class="loop-sync">同步 ${sys.sync || "—"}</div>
        <div class="loop-metrics">${metrics}</div>`;
    });

    const deals = $("#loopDealTable");
    if (deals) {
      deals.innerHTML = `
        <thead><tr><th>商机</th><th>阶段</th><th>金额</th><th>负责人</th><th>下一步</th><th>节点</th><th>风险</th></tr></thead>
        <tbody>${(D.loopDeals || [])
          .map((r) => {
            const riskCls = r.risk === "断点" || r.risk === "交期紧" ? "text-warn" : "";
            return `<tr><td>${r.name}</td><td>${r.stage}</td><td class="num">${r.amount}</td><td>${r.owner}</td><td>${r.next}</td><td class="num">${r.eta}</td><td class="${riskCls}">${r.risk}</td></tr>`;
          })
          .join("")}</tbody>`;
    }

    const ar = $("#loopArTable");
    if (ar) {
      ar.innerHTML = `
        <thead><tr><th>应收单</th><th>客户</th><th>金额</th><th>到期</th><th>账龄</th><th>状态</th><th>跟进</th></tr></thead>
        <tbody>${(D.loopReceivables || [])
          .map((r) => {
            const warn = r.status === "逾期" || r.status === "催收中" || r.status === "法务跟进";
            return `<tr class="${warn ? "row-warn" : ""}"><td>${r.no}</td><td>${r.customer}</td><td class="num">${r.amount}</td><td class="num">${r.due}</td><td class="num">${r.aging}</td><td class="${warn ? "text-warn" : ""}">${r.status}</td><td>${r.owner}</td></tr>`;
          })
          .join("")}</tbody>`;
    }
  }

  function bind() {
    $("#prevBtn")?.addEventListener("click", () => nextModule(-1));
    $("#nextBtn")?.addEventListener("click", () => nextModule(1));
    $("#openSampleTimeline")?.addEventListener("click", openSampleTimeline);
    $("#expandTimeline")?.addEventListener("click", openSampleTimeline);
    $("#drawerClose").addEventListener("click", closeDrawer);
    $("#drawerScrim").addEventListener("click", closeDrawer);
    document.addEventListener("keydown", (e) => {
      if (e.key === "ArrowRight") nextModule(1);
      if (e.key === "ArrowLeft") nextModule(-1);
      if (e.key === "Escape") closeDrawer();
    });
  }

  function init() {
    $("#footerText").textContent = D.meta.footer;
    buildNav();
    initFilters();
    renderPulse();
    renderOverviewExtras();
    renderFlows();
    renderFunnel();
    renderTimeline();
    renderQuality();
    renderWarehouse();
    renderProjects();
    renderInternal();
    renderLoop();
    bind();
    go("overview");
    applyFilters();
  }

  init();
})();
