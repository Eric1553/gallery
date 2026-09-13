(() => {
  const DATA = window.OPS_DASHBOARD;
  const INTEL_REFRESH_API = "/api/intel/refresh";
  const INTEL_TIMEOUT_MS = 75000;
  const INTEL_CACHE_KEY = "biren-ops-loop-intel-v6ceo";

  const state = {
    panel: "home",
    externalFocus: (DATA.externalFocus || []).slice(),
    intelMode: "idle",
    intelAt: null,
    intelItems: [],
    intelErrors: [],
    intelMeta: null,
    refreshing: false,
  };

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function toast(msg) {
    const el = $("#toast");
    if (!el) return;
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.remove("show"), 2600);
  }

  function go(panel) {
    state.panel = panel;
    render();
    $(".main-scroll")?.scrollTo({ top: 0, behavior: "smooth" });
  }

  function setLiveMeta() {
    const el = $("#liveMeta");
    if (!el) return;
    const t = state.intelAt ? ` · ${esc(String(state.intelAt).slice(11, 19))}` : "";
    if (state.refreshing) {
      el.innerHTML = "情报 <strong>更新中</strong>";
      return;
    }
    if (state.intelMode === "moss_live") {
      el.innerHTML = `情报 <strong>实时</strong>${t}`;
      return;
    }
    if (state.intelMode === "moss_partial") {
      el.innerHTML = `情报 <strong>部分</strong>${t}`;
      return;
    }
    if (state.intelMode === "local_fallback") {
      el.innerHTML = `情报 <strong>本地</strong>${t}`;
      return;
    }
    el.textContent = "情报 · —";
  }

  function statusBadge(s) {
    const map = { red: "红", amber: "黄", green: "绿" };
    return `<span class="badge ${esc(s)}">${map[s] || s}</span>`;
  }

  /** SAP T-1：数据截止日按上海时区滚动到昨天 */
  function dataAsOfLabel() {
    const now = new Date();
    const sh = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Shanghai" }));
    sh.setDate(sh.getDate() - 1);
    const m = sh.getMonth() + 1;
    const d = sh.getDate();
    const yyyy = sh.getFullYear();
    const mm = String(m).padStart(2, "0");
    const dd = String(d).padStart(2, "0");
    DATA.meta.asOf = `${yyyy}-${mm}-${dd} 08:00`;
    DATA.meta.asOfLabel = `数据截至 ${m}/${d} 晨 · SAP T−1`;
    return DATA.meta.asOfLabel;
  }

  function renderHome() {
    const brief = DATA.brief;
    const decideN = DATA.decisions.length;
    const redN = DATA.frictions.filter((f) => f.status === "red").length;
    const asOf = dataAsOfLabel();
    return `
      <section class="hero-brief">
        <div class="hero-kicker">今日简报</div>
        <h1 class="hero-headline">${esc(brief.headline)}</h1>
        <div class="asof">${esc(asOf)}</div>
        <div class="cta-row">
          <button type="button" class="cta primary" data-go="decide">待决策 ${decideN} 项</button>
          <button type="button" class="cta" data-go="cash">红灯 ${redN} 处</button>
        </div>
      </section>

      <section class="section">
        <div class="section__head">
          <h2 class="section__title">经营结论</h2>
          <span class="section__hint">按优先级</span>
        </div>
        <div class="stack">
          ${brief.points
            .map(
              (p) => `
            <article class="point ${esc(p.tone)}">
              <div class="point__bar"></div>
              <div class="point__body">
                <h3 class="point__title">${esc(p.title)}</h3>
                <p class="point__detail">${esc(p.detail)}</p>
              </div>
            </article>`
            )
            .join("")}
        </div>
      </section>

      <section class="section">
        <div class="section__head">
          <h2 class="section__title">关键指标</h2>
          <span class="section__hint">SAP / MES · T-1</span>
        </div>
        <div class="pulse-grid">
          ${DATA.pulse
            .slice(0, 6)
            .map(
              (m) => `
            <article class="pulse ${esc(m.tone)}">
              <div class="pulse__name">${esc(m.name)}</div>
              <div class="pulse__value">${esc(m.value)}<span>${esc(m.unit)}</span></div>
              <div class="pulse__delta">${esc(m.delta)} · ${esc(m.vs)}</div>
            </article>`
            )
            .join("")}
        </div>
      </section>

      <section class="section">
        <div class="section__head">
          <h2 class="section__title">待决策事项</h2>
          <button type="button" class="section__hint is-link" data-go="decide">全部 ›</button>
        </div>
        <div class="stack">
          ${DATA.decisions
            .slice(0, 2)
            .map(
              (d) => `
            <article class="card amber is-tap" data-go="decide" role="button" tabindex="0">
              <div class="card__top">
                <h3 class="card__title">${esc(d.title)}</h3>
                <span class="badge amber">${esc(d.urgency)}</span>
              </div>
              <p class="card__meta">${esc(d.metricHook)}</p>
              <p class="card__why">${esc(d.stake)}</p>
              <p class="card__foot">查看方案与代价 ›</p>
            </article>`
            )
            .join("")}
        </div>
      </section>

      <section class="section">
        <div class="section__head">
          <h2 class="section__title">外部信号</h2>
          <button type="button" class="section__hint is-link" data-go="intel">情报 ›</button>
        </div>
        <div class="stack">
          ${(state.externalFocus || [])
            .map(
              (it) => `
            <article class="card intel-item is-tap" data-go="intel" role="button" tabindex="0">
              <div class="card__top">
                <span class="badge cyan">${esc(it.tag)}</span>
                <h3 class="card__title" style="flex:1">${esc(it.text)}</h3>
              </div>
              <p class="card__why">${esc(it.why || "")}</p>
            </article>`
            )
            .join("") || `<div class="empty">暂无外部信号。点右上角刷新，或先看本地精选情报。</div>`}
        </div>
      </section>
    `;
  }

  function renderDecide() {
    return `
      <section class="section" style="margin-top:4px">
        <div class="section__head">
          <h2 class="section__title">待决策</h2>
          <span class="section__hint">方案 · 代价 · 推荐</span>
        </div>
        <p class="lead">仅列需 CEO 决策的事项；催办与技术细节不进入本页。</p>
        <div class="stack">
          ${DATA.decisions
            .map(
              (d) => `
            <article class="card amber" id="decide-${esc(d.id)}">
              <div class="card__top">
                <h3 class="card__title">${esc(d.title)}</h3>
                <span class="badge amber">${esc(d.urgency)}</span>
              </div>
              <p class="card__meta">${esc(d.metricHook)}</p>
              <p class="card__why">${esc(d.stake)}</p>
              ${d.options
                .map(
                  (o) => `
                <div class="option${o.recommend ? " recommend" : ""}">
                  <p class="option__name">${o.recommend ? "推荐 · " : ""}${esc(o.label)}</p>
                  <p class="option__cost">代价：${esc(o.cost)}</p>
                </div>`
                )
                .join("")}
              <div class="kv">
                <div class="kv-row"><span class="kv-k">责任</span><span class="kv-v">${esc(d.dri)}</span></div>
                <div class="kv-row"><span class="kv-k">支撑</span><span class="kv-v">${esc(d.support)}</span></div>
              </div>
            </article>`
            )
            .join("")}
        </div>
      </section>
    `;
  }

  function renderCash() {
    return `
      <section class="section" style="margin-top:4px">
        <div class="section__head">
          <h2 class="section__title">经营阻塞</h2>
          <span class="section__hint">现金与交付</span>
        </div>
        <p class="lead">按收入→现金、库存→交付链路，列示当前阻塞、证据与责任人。</p>
        <div class="stack">
          ${DATA.frictions
            .map(
              (f) => `
            <article class="card ${esc(f.status === "red" ? "red" : f.status === "amber" ? "amber" : "green")}${f.askCeo ? " is-tap" : ""}" ${f.askCeo ? 'data-go="decide" role="button" tabindex="0"' : ""}>
              <div class="flow">
                <span>${esc(f.from)}</span><em>→</em><span>${esc(f.to)}</span>
                <span style="margin-left:auto">${statusBadge(f.status)}</span>
              </div>
              <h3 class="card__title">${esc(f.title)}</h3>
              <div class="metric-pill">
                ${esc(f.metric.name)}
                <strong>${esc(f.metric.value)}</strong>${esc(f.metric.unit)}
                <span style="color:var(--dim);margin-left:6px">${esc(f.metric.delta)}</span>
              </div>
              <p class="card__why">${esc(f.impact)}</p>
              <div class="kv">
                <div class="kv-row"><span class="kv-k">证据</span><span class="kv-v">${esc(f.evidence)}</span></div>
                <div class="kv-row"><span class="kv-k">责任</span><span class="kv-v">${esc(f.owner)} · ${esc(f.due)}</span></div>
                <div class="kv-row"><span class="kv-k">下一步</span><span class="kv-v">${esc(f.next)}</span></div>
                ${f.askCeo ? `<div class="kv-row"><span class="kv-k">升级</span><span class="kv-v">已列入待决策 · 点击查看</span></div>` : ""}
              </div>
            </article>`
            )
            .join("")}
        </div>
      </section>

      <section class="section">
        <div class="section__head">
          <h2 class="section__title">季度重点</h2>
        </div>
        <div class="stack">
          ${DATA.battles
            .map(
              (b) => `
            <article class="card ${esc(b.status === "red" ? "red" : "amber")}">
              <div class="card__top">
                <h3 class="card__title">${esc(b.name)}</h3>
                ${statusBadge(b.status)}
              </div>
              <p class="card__why">${esc(b.goal)}</p>
              <div class="progress"><i style="width:${b.progress}%"></i></div>
              <p class="card__meta">${b.progress}% · ${esc(b.owner)}</p>
              <p class="card__why"><strong>此刻：</strong>${esc(b.now)}</p>
            </article>`
            )
            .join("")}
        </div>
      </section>
    `;
  }

  function renderPromise() {
    return `
      <section class="section" style="margin-top:4px">
        <div class="section__head">
          <h2 class="section__title">待闭环事项</h2>
          <span class="section__hint">验收后关闭</span>
        </div>
        <p class="lead">会议与消息往来不计入完成；验收人确认结果后关闭。</p>
        <div class="stack">
          ${DATA.commitments
            .map(
              (c) => `
            <article class="card ${esc(c.status === "red" ? "red" : c.status === "amber" ? "amber" : "green")}">
              <div class="card__top">
                <h3 class="card__title">${esc(c.title)}</h3>
                <span class="badge ${esc(c.status)}">${esc(c.stage)}</span>
              </div>
              <p class="card__meta">验收标准：${esc(c.result)}</p>
              <div class="kv">
                <div class="kv-row"><span class="kv-k">责任人</span><span class="kv-v">${esc(c.dri)}</span></div>
                <div class="kv-row"><span class="kv-k">验收人</span><span class="kv-v">${esc(c.acceptor)}</span></div>
                <div class="kv-row"><span class="kv-k">截止</span><span class="kv-v">${esc(c.due)}</span></div>
                <div class="kv-row"><span class="kv-k">证据</span><span class="kv-v">${esc(c.evidence)}</span></div>
                <div class="kv-row"><span class="kv-k">升级</span><span class="kv-v">${esc(c.escalate)}</span></div>
              </div>
            </article>`
            )
            .join("")}
        </div>
      </section>
    `;
  }

  function isFeaturedIntel(it) {
    const score = Number(it.priority_score || 0);
    const conf = String(it.confidence || it.confidence_label || "").toLowerCase();
    const highConf = conf === "high" || conf === "高";
    const midConf = highConf || conf === "medium" || conf === "中";
    // 高质量：高置信，或高分，或高影响且非低置信；精选基线里的高影响也加精
    if (highConf) return true;
    if (score >= 85) return true;
    if (it.impact_level === "high" && midConf) return true;
    if ((it.from_baseline || it.content_stale) && score >= 70 && it.impact_level === "high") return true;
    return false;
  }

  function freshnessOf(it) {
    if (it.from_baseline || it.content_stale) {
      return { key: "hist", label: "精选基线" };
    }
    if (String(state.intelMode || "").startsWith("moss")) {
      return { key: "live", label: "实时" };
    }
    if (state.intelMode === "local_fallback") {
      return { key: "hist", label: "本地精选" };
    }
    return { key: "hist", label: "历史" };
  }

  function formatIntelTime(it) {
    const raw = it.published_at || it.collected_at || state.intelAt || "";
    const s = String(raw);
    if (s.length >= 16) return s.slice(5, 16).replace("T", " ");
    return "";
  }

  function openSheet(title, bodyHtml, footerHtml) {
    $("#sheetTitle").textContent = title || "情报详情";
    $("#sheetBody").innerHTML = bodyHtml;
    $("#sheetFooter").innerHTML =
      footerHtml ||
      `<button type="button" class="btn btn--ghost" style="flex:1" id="sheetOk">关闭</button>`;
    $("#sheetBackdrop")?.classList.remove("hidden");
    $("#detailSheet")?.classList.remove("hidden");
    $("#sheetOk")?.addEventListener("click", closeSheet, { once: true });
  }

  function closeSheet() {
    $("#sheetBackdrop")?.classList.add("hidden");
    $("#detailSheet")?.classList.add("hidden");
  }

  function showIntelDetail(it) {
    if (!it) return;
    const fresh = freshnessOf(it);
    const featured = isFeaturedIntel(it);
    const time = formatIntelTime(it);
    const tags = (it.tags || []).slice(0, 6).join("、") || "—";
    const url = it.source_url || "";
    openSheet(it.title, `
      <div class="detail-block">
        <div class="detail-label">标记</div>
        <div>
          <span class="badge ${fresh.key}">${esc(fresh.label)}</span>
          ${featured ? '<span class="badge feat" style="margin-left:4px">★ 加精</span>' : ""}
          <span class="badge cyan" style="margin-left:4px">${esc(it.tag || "外部")}</span>
        </div>
      </div>
      <div class="detail-block"><div class="detail-label">摘要</div><div>${esc(it.summary || "—")}</div></div>
      <div class="detail-block"><div class="detail-label">壁仞关联解读</div><div>${esc(it.biren_relevance || "—")}</div></div>
      <div class="detail-block"><div class="detail-label">影响判断</div><div>${esc(it.impact_label || it.impact_level || "—")}${it.impact_level ? `（${esc(it.impact_level)}）` : ""}</div></div>
      <div class="detail-block"><div class="detail-label">标签</div><div>${esc(tags)}</div></div>
      <div class="detail-block"><div class="detail-label">来源</div><div>${esc(it.source_name || "—")}${url ? ` · <a href="${esc(url)}" target="_blank" rel="noopener">原文链接</a>` : ""}</div></div>
      <div class="detail-block"><div class="detail-label">置信度</div><div>置信${esc(it.confidence_label || it.confidence || "—")}；低置信请交叉核验</div></div>
      ${time ? `<div class="detail-block"><div class="detail-label">时间</div><div>${esc(time)}</div></div>` : ""}
    `, url
      ? `<button type="button" class="btn btn--ghost" style="flex:1" id="sheetOk">关闭</button>
         <a class="btn btn--primary" style="flex:1" href="${esc(url)}" target="_blank" rel="noopener">查看原文</a>`
      : undefined);
  }

  function renderIntelCard(it, idx) {
    const fresh = freshnessOf(it);
    const featured = isFeaturedIntel(it);
    const time = formatIntelTime(it);
    return `
      <article class="card intel-item is-tap${featured ? " is-featured" : ""}" data-intel-idx="${idx}" role="button" tabindex="0">
        <div class="card__badges">
          <span class="badge ${fresh.key}">${esc(fresh.label)}</span>
          ${featured ? '<span class="badge feat">★ 加精</span>' : ""}
          <span class="badge cyan">${esc(it.tag)}</span>
          <span class="card__chev" aria-hidden="true">›</span>
        </div>
        <div class="card__top">
          <h3 class="card__title" style="flex:1">${esc(it.title)}</h3>
        </div>
        <p class="card__why">${esc(it.summary || "")}</p>
        <p class="card__meta" style="margin-top:6px">
          ${esc(it.source_name || "")}${it.confidence_label || it.confidence ? ` · 置信${esc(it.confidence_label || it.confidence)}` : ""}${time ? ` · ${esc(time)}` : ""}
        </p>
      </article>`;
  }

  function renderIntel() {
    const modeLabel =
      {
        moss_live: "实时",
        moss_partial: "部分更新",
        local_fallback: "本地精选",
        idle: "未更新",
      }[state.intelMode] || state.intelMode;
    const warn =
      state.intelErrors?.length > 0
        ? `<p class="lead" style="color:var(--warn)">${esc(
            state.intelErrors
              .slice(0, 2)
              .map((e) => String(e).replace(/\{[\s\S]{40,}\}/g, "接口限流，请稍后再试"))
              .join("；")
          )}</p>`
        : "";
    return `
      <section class="section" style="margin-top:4px">
        <div class="section__head">
          <h2 class="section__title">外部情报</h2>
          <span class="section__hint">${esc(modeLabel)}</span>
        </div>
        <p class="lead">点卡片看详情。「实时 / 精选基线」区分来源；高质量条目会标「★ 加精」并靠前。</p>
        ${warn}
        <div class="stack">
          ${
            state.intelItems.length
              ? state.intelItems.map((it, idx) => renderIntelCard(it, idx)).join("")
              : `<div class="empty">还没有情报。点右上角刷新拉取；失败时会加载本地精选。</div>`
          }
        </div>
      </section>
    `;
  }

  function bindIntelCards() {
    $$("[data-intel-idx]").forEach((el) => {
      const open = () => {
        const idx = Number(el.dataset.intelIdx);
        showIntelDetail(state.intelItems[idx]);
      };
      el.addEventListener("click", open);
      el.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          open();
        }
      });
    });
  }

  function bindNav() {
    $$("[data-go]").forEach((el) => {
      const handler = () => go(el.dataset.go);
      el.addEventListener("click", handler);
      el.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handler();
        }
      });
    });
    $$(".tab-nav__btn").forEach((btn) => {
      btn.classList.toggle("is-active", btn.dataset.panel === state.panel);
    });
    bindIntelCards();
    setLiveMeta();
  }

  function render() {
    const map = {
      home: renderHome,
      decide: renderDecide,
      cash: renderCash,
      promise: renderPromise,
      intel: renderIntel,
    };
    $("#panelRoot").innerHTML = (map[state.panel] || renderHome)();
    bindNav();
  }

  function normalizeIntelItems(packs) {
    const evening = packs?.evening || packs?.morning || {};
    const tagMap = {
      "BR-POL": "政策",
      "BR-CMP": "竞品",
      "BR-IND": "产业",
      "BR-CUS": "客户",
      "BR-SEN": "舆情",
    };
    return (evening.items || []).slice(0, 20).map((it) => ({
      item_id: it.item_id,
      tag: tagMap[it.topic_id] || "外部",
      topic_id: it.topic_id,
      title: it.title,
      summary: it.summary || it.biren_relevance || "",
      biren_relevance: it.biren_relevance || "",
      source_name: it.source_name || it.source,
      source_url: it.source_url || "",
      confidence: it.confidence,
      confidence_label: it.confidence_label || it.confidence,
      impact_level: it.impact_level,
      impact_label: it.impact_label,
      impact_type: it.impact_type,
      priority_score: it.priority_score,
      tags: it.tags || [],
      published_at: it.published_at,
      collected_at: it.collected_at,
      from_baseline: !!it.from_baseline,
      content_stale: !!it.content_stale,
    })).sort((a, b) => {
      const fa = isFeaturedIntel(a) ? 1 : 0;
      const fb = isFeaturedIntel(b) ? 1 : 0;
      if (fa !== fb) return fb - fa;
      return (b.priority_score || 0) - (a.priority_score || 0);
    });
  }

  function applyIntelBody(body) {
    const mode = String(body.mode || "");
    if (mode.includes("partial")) state.intelMode = "moss_partial";
    else if (mode.includes("moss")) state.intelMode = "moss_live";
    else state.intelMode = "local_fallback";
    state.intelAt = body.refreshed_at || new Date().toISOString();
    state.intelErrors = Array.isArray(body.errors) ? body.errors : [];
    state.intelMeta = { elapsed_ms: body.elapsed_ms, cache_hit: !!body.cache_hit };
    if (Array.isArray(body.external_focus) && body.external_focus.length) {
      state.externalFocus = body.external_focus;
    }
    state.intelItems = normalizeIntelItems(body.packs);
    try {
      sessionStorage.setItem(
        INTEL_CACHE_KEY,
        JSON.stringify({
          at: Date.now(),
          mode: state.intelMode,
          intelAt: state.intelAt,
          externalFocus: state.externalFocus,
          intelItems: state.intelItems,
          intelErrors: state.intelErrors,
        })
      );
    } catch (_) {}
  }

  function restoreIntelCache() {
    try {
      const cached = JSON.parse(sessionStorage.getItem(INTEL_CACHE_KEY) || "null");
      if (!cached || Date.now() - cached.at > 10 * 60 * 1000) return false;
      state.intelMode = cached.mode;
      state.intelAt = cached.intelAt;
      state.externalFocus = cached.externalFocus || state.externalFocus;
      state.intelItems = cached.intelItems || [];
      state.intelErrors = cached.intelErrors || [];
      return state.intelItems.length > 0;
    } catch (_) {
      return false;
    }
  }

  async function refreshIntel(opts = {}) {
    if (state.refreshing) return;
    state.refreshing = true;
    setLiveMeta();
    const btn = $("#btnRefresh");
    if (btn) btn.disabled = true;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), INTEL_TIMEOUT_MS);
    try {
      const url = opts.force ? `${INTEL_REFRESH_API}?force=1` : INTEL_REFRESH_API;
      const res = await fetch(url, { cache: "no-store", signal: ctrl.signal });
      const body = await res.json();
      if (!body.ok) throw new Error(body.error || "刷新失败");
      applyIntelBody(body);
      const n = body.item_count || state.intelItems.length;
      toast(
        state.intelMode.startsWith("moss")
          ? `情报已更新 · ${n} 条${body.cache_hit ? "（缓存）" : ""}`
          : `已加载本地精选 · ${n} 条`
      );
      render();
    } catch (err) {
      toast(err?.name === "AbortError" ? "情报刷新超时，请稍后重试" : `刷新异常：${err.message || err}`);
      setLiveMeta();
    } finally {
      clearTimeout(timer);
      state.refreshing = false;
      if (btn) btn.disabled = false;
      setLiveMeta();
    }
  }

  function boot() {
    document.documentElement.setAttribute("data-theme", "biren-light");
    const themeMeta = document.querySelector('meta[name="theme-color"]');
    if (themeMeta) themeMeta.setAttribute("content", "#f4f7fb");

    $$(".tab-nav__btn").forEach((btn) => {
      btn.addEventListener("click", () => go(btn.dataset.panel));
    });
    $("#btnRefresh")?.addEventListener("click", () => refreshIntel({ force: true }));
    $("#sheetBackdrop")?.addEventListener("click", closeSheet);
    $("#sheetClose")?.addEventListener("click", closeSheet);
    $("#fullscreenToggle")?.addEventListener("click", () => {
      $("#previewShell")?.classList.toggle("is-full");
    });
    const had = restoreIntelCache();
    render();
    refreshIntel({ force: !had });
  }

  document.addEventListener("DOMContentLoaded", boot);
})();
