(() => {
  const state = {
    catalog: null,
    searchIndex: null, // { demos: { id: {...} } }
    catalogIndex: null, // Map id -> catalog order
    scope: "client", // client | internal
    scene: "all",
    industry: "all",
    business: "all",
    client: "all",
    demoId: null,
    query: "",
    sort: "time-asc", // time-asc | time-desc；仅作用于主列表，不影响精选
    list: false,
    openArchives: new Set(),
    openFolders: new Set(),
    suggestIndex: -1,
    searchTimer: null,
    fedTimer: null,
    fedAbort: null,
  };

  const SCENE_META = {
    all: { name: "全部", blurb: "按客户档案浏览" },
    ceo: { name: "一把手", blurb: "CEO / 经营 / 财经" },
    ops: { name: "运营销售", blurb: "研发运营、销售、人效" },
    poc: { name: "行业POC", blurb: "客户验证现场" },
    platform: { name: "平台能力", blurb: "产品与横向演示" },
    misc: { name: "方法素材", blurb: "方法论与内部看板" },
  };


  const $ = (id) => document.getElementById(id);

  function escapeHtml(s) {
    return String(s)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  /** HTTP 非安全上下文没有 clipboard API，回退到 execCommand */
  async function copyText(text) {
    const value = String(text || "");
    if (!value) throw new Error("empty");
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(value);
      return;
    }
    const ta = document.createElement("textarea");
    ta.value = value;
    ta.setAttribute("readonly", "");
    ta.style.cssText = "position:fixed;left:-9999px;top:0;opacity:0";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    ta.setSelectionRange(0, value.length);
    let ok = false;
    try {
      ok = document.execCommand("copy");
    } finally {
      ta.remove();
    }
    if (!ok) throw new Error("execCommand copy failed");
  }

  function isInternal(demo) {
    if (demo.audience === "internal") return true;
    if (demo.audience === "client") return false;
    const client = demo.client || "";
    // 内部归属：明确标「内部」，或帆软横向产品（非客户交付）
    return client === "内部" || client === "帆软 / 横向" || client.startsWith("帆软");
  }

  function demoUrl(demo) {
    const entry = (demo.entry || "index.html").replace(/^\//, "");
    return `/demos/${demo.id}/${entry}`;
  }

  function thumbUrl(demo) {
    return `/demos/${demo.id}/${demo.thumb || "thumb.webp"}`;
  }

  function coverUrl(demo) {
    return `/demos/${demo.id}/${demo.cover || "cover.webp"}`;
  }

  function coverHtml(demo) {
    // 列表用小图 thumb；失败回退 cover.webp → cover.png
    return `
      <div class="cover">
        <img src="${thumbUrl(demo)}" alt="${escapeHtml(demo.title)} 封面"
             loading="lazy" decoding="async"
             onerror="if(!this.dataset.fb){this.dataset.fb=1;this.src='${coverUrl(demo)}';}else if(this.dataset.fb==1){this.dataset.fb=2;this.src='/demos/${demo.id}/cover.png';}else{this.closest('.cover').classList.add('missing');this.remove();}" />
        <div class="cover-fallback">暂无封面</div>
      </div>
    `;
  }

  function allDemos() {
    return state.catalog?.demos || [];
  }

  function isArchived(demo) {
    return demo.archived === true || demo.is_latest === false;
  }

  function latestDemos() {
    return allDemos().filter((d) => !isArchived(d));
  }

  function clientDemos() {
    return latestDemos().filter((d) => !isInternal(d));
  }

  function internalDemos() {
    return latestDemos().filter((d) => isInternal(d));
  }

  function scopePool() {
    return state.scope === "internal" ? internalDemos() : clientDemos();
  }

  function archivesFor(demo) {
    const fam = demo.family || null;
    if (!fam) return [];
    return allDemos().filter((d) => d.family === fam && d.id !== demo.id && isArchived(d));
  }

  function clientGroups() {
    const map = new Map();
    for (const d of scopePool()) {
      const key = d.client || "未命名客户";
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(d);
    }
    return [...map.entries()]
      .map(([client, demos]) => ({
        client,
        demos: demos.sort((a, b) => Number(b.featured) - Number(a.featured)),
        industry: demos[0]?.industry || "",
        internal: demos.every(isInternal),
      }))
      .sort((a, b) => b.demos.length - a.demos.length || a.client.localeCompare(b.client, "zh"));
  }

  function demoIndustry(demo) {
    return (demo.tags && demo.tags[0]) || demo.industry || "";
  }

  function demoBusiness(demo) {
    return (demo.tags && demo.tags[1]) || "";
  }

  function passesFacet(demo, skip = null) {
    if (skip !== "scene" && state.scene !== "all" && demo.hall !== state.scene) return false;
    if (skip !== "industry" && state.industry !== "all" && demoIndustry(demo) !== state.industry) {
      return false;
    }
    if (skip !== "business" && state.business !== "all" && demoBusiness(demo) !== state.business) {
      return false;
    }
    return true;
  }

  function facetIsAll() {
    return state.scene === "all" && state.industry === "all" && state.business === "all";
  }

  function facetLabel() {
    const parts = [];
    if (state.scene !== "all") parts.push((SCENE_META[state.scene] || {}).name || state.scene);
    if (state.industry !== "all") parts.push(state.industry);
    if (state.business !== "all") parts.push(state.business);
    return parts.join(" · ");
  }

  function hasActiveFilters() {
    return !facetIsAll() || state.client !== "all" || !!state.demoId || !!state.query.trim();
  }

  function clearFilters() {
    state.scene = "all";
    state.industry = "all";
    state.business = "all";
    state.client = "all";
    state.demoId = null;
    state.query = "";
    const q = $("q");
    if (q) q.value = "";
    hideSuggest();
    hideFed();
    render({ mode: "full", animate: true });
  }

  function syncFilterClear() {
    const panel = $("filter-panel");
    const btn = $("filter-clear");
    const summary = $("filter-summary");
    if (!panel || !btn || !summary) return;
    const active = hasActiveFilters();
    panel.classList.toggle("is-filtered", active);
    btn.disabled = !active;
    btn.setAttribute("aria-disabled", active ? "false" : "true");
    if (!active) {
      summary.textContent = "未筛选";
      return;
    }
    const parts = [];
    const facet = facetLabel();
    if (facet) parts.push(facet);
    if (state.client !== "all") parts.push(state.client);
    if (state.demoId) {
      const demo = latestDemos().find((d) => d.id === state.demoId);
      if (demo) parts.push(shortTitle(demo));
    }
    if (state.query.trim()) parts.push(`搜索「${state.query.trim()}」`);
    summary.textContent = parts.join(" · ") || "已筛选";
  }

  function indexFor(demo) {
    return state.searchIndex?.demos?.[demo.id] || null;
  }

  function hitReason(demo, q) {
    const query = q.trim().toLowerCase();
    if (!query) return "";
    const idx = indexFor(demo);
    if (idx) {
      for (const m of idx.modules || []) {
        if (String(m.label || "").toLowerCase().includes(query)) {
          return `模块 · ${m.label}`;
        }
      }
      for (const k of idx.keywords || []) {
        if (String(k).toLowerCase().includes(query)) {
          return `正文 · ${k}`;
        }
      }
      for (const a of idx.aliases || []) {
        if (String(a).toLowerCase().includes(query)) {
          return `别名 · ${a}`;
        }
      }
    }
    if ((demo.client || "").toLowerCase().includes(query)) return `客户 · ${demo.client}`;
    if ((demo.title || "").toLowerCase().includes(query)) return "标题命中";
    const tag = (demo.tags || []).find((t) => String(t).toLowerCase().includes(query));
    if (tag) return `标签 · ${tag}`;
    if ((demo.summary || "").toLowerCase().includes(query)) return "摘要命中";
    return "相关命中";
  }

  function matches(demo) {
    if (state.scope === "client" && isInternal(demo)) return false;
    if (state.scope === "internal" && !isInternal(demo)) return false;
    if (!passesFacet(demo)) return false;
    if (state.client !== "all" && demo.client !== state.client) return false;
    if (state.demoId && demo.id !== state.demoId) return false;
    const q = state.query.trim().toLowerCase();
    if (!q) return true;
    // 单字/过短查询噪声大，仅匹配标题/客户/标签
    const short = q.length < 2;
    const related = archivesFor(demo)
      .map((d) => [d.title, d.version_label, ...(d.tags || [])].join(" "))
      .join(" ");
    const idx = indexFor(demo);
    const metaBlob = [
      demo.title,
      demo.client,
      demo.industry,
      demo.type,
      demo.summary,
      demo.version_label,
      ...(demo.tags || []),
      related,
    ]
      .join(" ")
      .toLowerCase();
    if (metaBlob.includes(q)) return true;
    if (short) return false;
    const indexBlob = idx
      ? [
          ...(idx.keywords || []),
          ...(idx.aliases || []),
          ...(idx.page_titles || []),
          ...((idx.modules || []).map((m) => m.label) || []),
        ]
          .join(" ")
          .toLowerCase()
      : "";
    return indexBlob.includes(q);
  }

  function visibleDemos() {
    // 保持 catalog / scopePool 原序，供精选区使用；主列表另做时间排序
    return scopePool().filter(matches);
  }

  function rebuildCatalogIndex() {
    const map = new Map();
    (state.catalog?.demos || []).forEach((d, i) => map.set(d.id, i));
    state.catalogIndex = map;
  }

  function catalogPos(demo) {
    return state.catalogIndex?.get(demo.id) ?? 0;
  }

  function demoTimeKey(demo) {
    return String(demo.added_at || demo.updated_at || "").trim();
  }

  function compareByTime(a, b, dir) {
    const ta = demoTimeKey(a);
    const tb = demoTimeKey(b);
    const aMiss = !ta;
    const bMiss = !tb;
    if (aMiss && bMiss) return catalogPos(a) - catalogPos(b);
    if (aMiss) return 1;
    if (bMiss) return -1;
    if (ta !== tb) {
      if (dir === "time-desc") return ta < tb ? 1 : -1;
      return ta < tb ? -1 : 1;
    }
    return catalogPos(a) - catalogPos(b);
  }

  function relevanceScore(demo, query) {
    const q = String(query || "").trim().toLowerCase();
    if (!q) return 0;
    const idx = indexFor(demo);
    let score = 0;
    if ((demo.client || "").toLowerCase().includes(q)) score += 50;
    if ((demo.title || "").toLowerCase().includes(q)) score += 40;
    if ((demo.tags || []).some((t) => String(t).toLowerCase().includes(q))) score += 30;
    if ((idx?.modules || []).some((m) => String(m.label || "").toLowerCase().includes(q))) score += 25;
    if ((idx?.keywords || []).some((k) => String(k).toLowerCase().includes(q))) score += 15;
    if (demo.featured) score += 5;
    return score;
  }

  /** 主列表排序：默认时间升序；有搜索时相关度优先，时间作次级键。精选勿用此函数。 */
  function orderedGridDemos(demos) {
    const list = [...demos];
    const q = state.query.trim();
    const dir = state.sort === "time-desc" ? "time-desc" : "time-asc";
    if (q) {
      list.sort((a, b) => {
        const ds = relevanceScore(b, q) - relevanceScore(a, q);
        if (ds) return ds;
        return compareByTime(a, b, dir);
      });
      return list;
    }
    list.sort((a, b) => compareByTime(a, b, dir));
    return list;
  }

  function featuredDemos(demos) {
    // 精选保持可见列表的 catalog 原序，不受排序控件影响
    return demos.filter((d) => d.featured && !isInternal(d));
  }

  function cardHtml(demo, delay = 0) {
    const tags = (demo.tags || [])
      .slice(0, 4)
      .map((t) => `<span class="tag">${escapeHtml(t)}</span>`)
      .join("");
    const archives = archivesFor(demo);
    const archiveOpen = state.openArchives.has(demo.id);
    const internal = isInternal(demo);
    const archiveBtn = archives.length
      ? `<button type="button" class="btn ghost tiny archive-toggle" data-archive-toggle="${demo.id}" aria-expanded="${archiveOpen}">
           Archive · ${archives.length}
         </button>`
      : `<span></span>`;
    const archivePanel = archives.length
      ? `<div class="archive-panel ${archiveOpen ? "open" : ""}" data-archive-panel="${demo.id}">
           <div class="archive-list">
             ${archives
               .map(
                 (a) => `
               <a class="archive-item" href="${demoUrl(a)}" target="_blank" rel="noopener" data-stop>
                 <div>
                   <strong>${escapeHtml(a.version_label || a.title)}</strong>
                   <div><span>${escapeHtml(a.title)}</span></div>
                 </div>
                 <span>打开 →</span>
               </a>`
               )
               .join("")}
           </div>
         </div>`
      : "";

    return `
      <article class="card reveal ${demo.featured ? "featured-card" : ""} ${internal ? "internal-card" : "client-card"}" data-id="${demo.id}" style="--delay:${delay}ms">
        ${coverHtml(demo)}
        <div class="card-body">
          <div class="card-top">
            <span class="pill ${internal ? "pill-internal" : "pill-client"}">${internal ? "内部" : escapeHtml(demo.client || "客户")}</span>
            <span class="tag">${escapeHtml(demo.type || "")}</span>
          </div>
          <h4>${escapeHtml(demo.title)}</h4>
          <p>${escapeHtml(demo.summary || "")}</p>
          ${
            state.query.trim()
              ? `<p class="hit-reason">${escapeHtml(hitReason(demo, state.query))}</p>`
              : ""
          }
          <div class="card-meta">${tags}</div>
          <div class="card-foot">
            <span class="version-badge">${escapeHtml(demo.version_label || "最新")}</span>
            ${archiveBtn}
          </div>
          <button type="button" class="btn tiny card-enter">查看详情</button>
          ${archivePanel}
        </div>
      </article>
    `;
  }

  function sceneCounts() {
    const pool = scopePool();
    const counts = { all: pool.length };
    for (const d of pool) counts[d.hall] = (counts[d.hall] || 0) + 1;
    return counts;
  }

  function renderScope() {
    const items = [
      { id: "client", name: "客户 DEMO", n: clientDemos().length, tip: "给客户做的材料" },
      { id: "internal", name: "内部 DEMO", n: internalDemos().length, tip: "内部产品与素材" },
    ];
    $("scope-filters").innerHTML = items
      .map(
        (it) => `
      <button type="button" class="scope-chip ${state.scope === it.id ? "active" : ""}" data-scope="${it.id}" title="${it.tip}">
        <span class="scope-name">${it.name}</span>
        <span class="n">${it.n}</span>
      </button>`
      )
      .join("");

    $("scope-filters").onclick = (e) => {
      const btn = e.target.closest("[data-scope]");
      if (!btn) return;
      state.scope = btn.dataset.scope;
      state.client = "all";
      state.demoId = null;
      state.scene = "all";
      state.industry = "all";
      state.business = "all";
      document.body.dataset.scope = state.scope;
      hideSuggest();
      render({ mode: "full", animate: true });
    };
  }

  function dimCounts(dim, picker) {
    const pool = scopePool().filter((d) => passesFacet(d, dim));
    const counts = { all: pool.length };
    for (const d of pool) {
      const key = picker(d);
      if (!key) continue;
      counts[key] = (counts[key] || 0) + 1;
    }
    return counts;
  }

  function chipHtml(chips, dim) {
    return chips
      .map(
        (c) => `<button type="button" class="scene-chip ${c.active ? "active" : ""}" data-dim="${dim}" data-chip="${escapeHtml(c.id)}">
          ${escapeHtml(c.name)}<span class="n">${c.n}</span>
        </button>`
      )
      .join("");
  }

  function orderedKeys(counts, preferred = []) {
    const rest = Object.keys(counts).filter((k) => k !== "all" && !preferred.includes(k));
    return ["all", ...preferred.filter((k) => counts[k]), ...rest];
  }

  function bindFilterPanel() {
    const root = $("filter-panel");
    if (!root || root.dataset.bound) return;
    root.dataset.bound = "1";
    root.addEventListener("click", (e) => {
      if (e.target.closest("#filter-clear")) {
        clearFilters();
        return;
      }
      const btn = e.target.closest("[data-chip][data-dim]");
      if (!btn || !root.contains(btn)) return;
      const dim = btn.dataset.dim;
      const value = btn.dataset.chip;
      if (dim === "sort") {
        if (value === state.sort) return;
        state.sort = value === "time-desc" ? "time-desc" : "time-asc";
        renderSortChips();
        // 仅刷新结果区；精选顺序不依赖 sort
        render({ mode: "results", animate: false, instantCards: true });
        return;
      }
      const current =
        dim === "industry" ? state.industry : dim === "business" ? state.business : state.scene;
      // 再点一次已选标签 → 回到该维「全部」
      const next = value === current && value !== "all" ? "all" : value;
      if (next === current && state.client === "all" && !state.demoId) return;
      if (dim === "industry") state.industry = next;
      else if (dim === "business") state.business = next;
      else state.scene = next;
      state.client = "all";
      state.demoId = null;
      hideSuggest();
      render({ mode: "full", animate: true });
    });
  }

  function renderSortChips() {
    const host = $("sort-filters");
    if (!host) return;
    const chips = [
      { id: "time-asc", name: "时间升序" },
      { id: "time-desc", name: "时间降序" },
    ];
    host.innerHTML = chips
      .map(
        (c) => `<button type="button" class="scene-chip ${state.sort === c.id ? "active" : ""}" data-dim="sort" data-chip="${c.id}">
          ${escapeHtml(c.name)}
        </button>`
      )
      .join("");
  }

  function renderScenes() {
    const sceneCountsMap = dimCounts("scene", (d) => d.hall);
    const sceneOrder =
      state.scope === "internal"
        ? ["ceo", "ops", "poc", "platform", "misc"]
        : ["ceo", "ops", "poc", "platform"];
    const sceneChips = orderedKeys(sceneCountsMap, sceneOrder)
      .filter((id) => id === "all" || sceneCountsMap[id])
      .map((id) => ({
        id,
        name: id === "all" ? "全部" : SCENE_META[id]?.name || id,
        n: sceneCountsMap[id] || 0,
        active: state.scene === id,
      }));

    const industryOrder = state.catalog?.meta?.tag_policy?.industry || [];
    const industryCountsMap = dimCounts("industry", demoIndustry);
    const industryChips = orderedKeys(industryCountsMap, industryOrder)
      .filter((id) => id === "all" || industryCountsMap[id])
      .map((id) => ({
        id,
        name: id === "all" ? "全部" : id,
        n: industryCountsMap[id] || 0,
        active: state.industry === id,
      }));

    const businessOrder = state.catalog?.meta?.tag_policy?.business || [];
    const businessCountsMap = dimCounts("business", demoBusiness);
    const businessChips = orderedKeys(businessCountsMap, businessOrder)
      .filter((id) => id === "all" || businessCountsMap[id])
      .map((id) => ({
        id,
        name: id === "all" ? "全部" : id,
        n: businessCountsMap[id] || 0,
        active: state.business === id,
      }));

    $("scene-filters").innerHTML = chipHtml(sceneChips, "scene");
    $("industry-filters").innerHTML = chipHtml(industryChips, "industry");
    $("business-filters").innerHTML = chipHtml(businessChips, "business");
    renderSortChips();
    bindFilterPanel();
    syncFilterClear();
  }

  function shortTitle(d) {
    const t = d.title || "";
    if (t.includes("·")) return t.split("·").slice(1).join("·").trim() || t;
    return t;
  }

  function syncTreeActive() {
    const tree = $("client-tree");
    if (!tree) return;
    tree.querySelectorAll(".folder").forEach((el) => {
      const folder = el.dataset.folder;
      const isAll = el.classList.contains("leaf") && el.querySelector("[data-client-all]");
      if (isAll) {
        el.classList.toggle("active", state.client === "all" && !state.demoId);
        return;
      }
      el.classList.toggle("active", state.client === folder);
      el.classList.toggle("open", state.openFolders.has(folder));
      el.querySelectorAll(".folder-child").forEach((child) => {
        child.classList.toggle("active", state.demoId === child.dataset.demoId);
      });
    });
  }

  function renderClientTree() {
    const groups = clientGroups().filter((g) => g.demos.some(passesFacet));

    const allLabel = state.scope === "internal" ? "全部内部" : "全部客户";
    const allSub = state.scope === "internal" ? "内部产品与方法素材" : "查看全部客户 DEMO";
    const allCount = scopePool().filter(passesFacet).length;

    $("tree-title").textContent = state.scope === "internal" ? "内部素材" : "客户档案";
    $("tree-hint").textContent = state.scope === "internal" ? "按主题浏览" : "多 DEMO 可展开";

    $("client-tree").innerHTML = [
      `<div class="folder ${state.client === "all" && !state.demoId ? "active" : ""} leaf">
        <button type="button" class="folder-btn" data-client-all>
          <span class="folder-ico">◈</span>
          <span>
            <span class="folder-name">${allLabel}</span>
            <span class="folder-sub">${allSub}</span>
          </span>
          <span class="folder-count">${allCount}</span>
          <span class="folder-chevron">›</span>
        </button>
      </div>`,
      ...groups.map((g) => {
        const multi = g.demos.length > 1;
        const open = multi && state.openFolders.has(g.client);
        const active = state.client === g.client ? "active" : "";
        const visibleInScene = g.demos.filter(passesFacet);
        const children = multi
          ? `<div class="folder-panel"><div class="folder-panel-inner"><div class="folder-children">
              ${visibleInScene
                .map(
                  (d) => `
                <button type="button" class="folder-child ${state.demoId === d.id ? "active" : ""}" data-demo-id="${d.id}" data-client="${escapeHtml(g.client)}">
                  <span>${escapeHtml(shortTitle(d))}</span>
                  <em>查看</em>
                </button>`
                )
                .join("")}
            </div></div></div>`
          : "";

        return `
          <div class="folder ${multi ? "" : "leaf"} ${open ? "open" : ""} ${active} ${g.internal ? "folder-internal" : "folder-client"}" data-folder="${escapeHtml(g.client)}">
            <button type="button" class="folder-btn" data-client="${escapeHtml(g.client)}" data-multi="${multi ? "1" : "0"}">
              <span class="folder-ico">${multi ? "▣" : "◇"}</span>
              <span>
                <span class="folder-name">${escapeHtml(g.client)}</span>
                <span class="folder-sub">${escapeHtml(g.industry || (g.internal ? "内部素材" : "客户档案"))} · ${visibleInScene.length} 个</span>
              </span>
              <span class="folder-count">${visibleInScene.length}</span>
              <span class="folder-chevron">›</span>
            </button>
            ${children}
          </div>
        `;
      }),
    ].join("");

    $("client-tree").onclick = (e) => {
      const allBtn = e.target.closest("[data-client-all]");
      if (allBtn) {
        state.client = "all";
        state.demoId = null;
        syncTreeActive();
        render({ mode: "results", animate: true });
        return;
      }

      const child = e.target.closest("[data-demo-id]");
      if (child) {
        state.client = child.dataset.client;
        state.demoId = child.dataset.demoId;
        state.openFolders.add(state.client);
        syncTreeActive();
        render({ mode: "results", animate: false });
        openDrawer(state.demoId);
        return;
      }

      const btn = e.target.closest("[data-client]");
      if (!btn) return;
      const client = btn.dataset.client;
      const multi = btn.dataset.multi === "1";
      if (multi) {
        const wasOpen = state.openFolders.has(client);
        if (wasOpen && state.client === client && !state.demoId) {
          state.openFolders.delete(client);
        } else {
          state.openFolders.add(client);
        }
        state.client = client;
        state.demoId = null;
        // 仅切换 class，保留展开动画，不重建 DOM
        syncTreeActive();
        render({ mode: "results", animate: false });
      } else {
        state.client = client;
        state.demoId = null;
        syncTreeActive();
        render({ mode: "results", animate: true });
      }
    };
  }

  function buildSuggestions(q) {
    const query = q.trim().toLowerCase();
    if (!query) return [];
    const scored = [];
    const seen = new Set();
    for (const d of scopePool()) {
      if (state.scope === "client" && isInternal(d)) continue;
      if (state.scope === "internal" && !isInternal(d)) continue;
      if (!passesFacet(d)) continue;
      if (seen.has(d.id)) continue;
      const idx = indexFor(d);
      const blob = [
        d.title,
        d.client,
        d.industry,
        d.type,
        d.summary,
        ...(d.tags || []),
        ...(idx?.keywords || []),
        ...(idx?.aliases || []),
        ...((idx?.modules || []).map((m) => m.label) || []),
      ]
        .join(" ")
        .toLowerCase();
      if (!blob.includes(query)) continue;
      let score = 0;
      if ((d.client || "").toLowerCase().includes(query)) score += 50;
      if ((d.title || "").toLowerCase().includes(query)) score += 40;
      if ((d.tags || []).some((t) => String(t).toLowerCase().includes(query))) score += 30;
      if ((idx?.modules || []).some((m) => String(m.label || "").toLowerCase().includes(query)))
        score += 25;
      if ((idx?.keywords || []).some((k) => String(k).toLowerCase().includes(query))) score += 15;
      if (d.featured) score += 5;
      scored.push({ demo: d, reason: hitReason(d, query), score });
      seen.add(d.id);
    }
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, 8);
  }

  function hideSuggest() {
    const box = $("suggest");
    const input = $("q");
    if (!box) return;
    box.hidden = true;
    box.innerHTML = "";
    state.suggestIndex = -1;
    if (input) input.setAttribute("aria-expanded", "false");
  }

  function renderSuggest() {
    const box = $("suggest");
    const input = $("q");
    if (!box || !input) return;
    const q = input.value.trim();
    if (!q) {
      hideSuggest();
      return;
    }
    const items = buildSuggestions(q);
    if (!items.length) {
      box.hidden = false;
      box.innerHTML = `<div class="suggest-empty">无匹配案例，试试客户名、模块名或标签</div>`;
      input.setAttribute("aria-expanded", "true");
      state.suggestIndex = -1;
      return;
    }
    box.hidden = false;
    input.setAttribute("aria-expanded", "true");
    box.innerHTML = items
      .map(
        (item, i) => {
          const d = item.demo;
          const reason = item.reason || "";
          return `
      <button type="button" class="suggest-item ${i === state.suggestIndex ? "active" : ""}" role="option" data-suggest-id="${d.id}" data-idx="${i}">
        <span>
          <strong>${escapeHtml(d.title)}</strong>
          <span>${escapeHtml(d.client || "")} · ${escapeHtml(reason || d.type || "")}</span>
        </span>
        <em>进入</em>
      </button>`;
        }
      )
      .join("");
    box.querySelectorAll("[data-suggest-id]").forEach((el) => {
      el.addEventListener("mousedown", (e) => {
        e.preventDefault();
        applySuggestion(el.dataset.suggestId);
      });
    });
  }

  function applySuggestion(id) {
    const demo = latestDemos().find((d) => d.id === id);
    if (!demo) return;
    // 保留用户原查询词，避免「搜模块名」被标题覆盖后丢失意图
    const typed = ($("q")?.value || state.query || "").trim();
    state.query = typed;
    state.client = "all";
    state.demoId = null;
    if (isInternal(demo) && state.scope !== "internal") {
      state.scope = "internal";
      document.body.dataset.scope = state.scope;
      render({ mode: "full", animate: false });
    } else if (!isInternal(demo) && state.scope !== "client") {
      state.scope = "client";
      document.body.dataset.scope = state.scope;
      render({ mode: "full", animate: false });
    } else {
      render({ mode: "results", animate: false });
    }
    hideSuggest();
    if (typed) scheduleFederated(typed);
    openDrawer(id);
  }

  function bindCardEvents(root) {
    root.querySelectorAll(".card").forEach((el) => {
      el.addEventListener("click", (e) => {
        if (e.target.closest("[data-stop], [data-archive-toggle]")) return;
        openDrawer(el.dataset.id);
      });
    });
    root.querySelectorAll("[data-archive-toggle]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const id = btn.dataset.archiveToggle;
        if (state.openArchives.has(id)) state.openArchives.delete(id);
        else state.openArchives.add(id);
        const panel = root.querySelector(`[data-archive-panel="${id}"]`);
        const open = state.openArchives.has(id);
        if (panel) panel.classList.toggle("open", open);
        btn.setAttribute("aria-expanded", String(open));
      });
    });
  }

  function observeReveals(root) {
    const nodes = root.querySelectorAll(".reveal");
    if (!("IntersectionObserver" in window)) {
      nodes.forEach((n) => n.classList.add("in"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("in");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );
    nodes.forEach((n) => io.observe(n));
  }

  function renderResults({ animate = false, instantCards = false } = {}) {
    const shownBase = visibleDemos();
    const shown = orderedGridDemos(shownBase);
    const activeFacetLabel = facetLabel();
    const isClientScope = state.scope === "client";

    $("stat-shown").textContent = String(shown.length);

    const focus =
      state.demoId
        ? latestDemos().find((d) => d.id === state.demoId)?.title || state.client
        : state.client === "all"
          ? activeFacetLabel || (isClientScope ? "客户 DEMO" : "内部 DEMO")
          : state.client;
    $("focus-label").textContent = focus;

    $("section-title").textContent =
      state.query.trim()
        ? `搜索「${state.query.trim()}」`
        : state.client === "all"
          ? activeFacetLabel || (isClientScope ? "客户 DEMO" : "内部 DEMO")
          : state.client;
    $("section-blurb").textContent = state.query.trim()
      ? `${shown.length} 个匹配结果`
      : state.demoId
        ? "已定位到单个 DEMO"
        : state.client === "all"
          ? activeFacetLabel
            ? `筛选 · ${activeFacetLabel}`
            : isClientScope
              ? "面向客户交付与售前演示"
              : "内部产品与方法素材"
          : `${isClientScope ? "客户档案" : "内部素材"} · ${shown.length} 个可见`;

    if (animate) {
      const stage = $("grid").closest(".stage");
      stage?.classList.remove("stage-swap");
      void stage?.offsetWidth;
      stage?.classList.add("stage-swap");
    }

    // 精选：基于未时间排序的 shownBase，顺序不受排序控件影响
    const featured = featuredDemos(shownBase);
    const featuredWrap = $("featured-wrap");
    const showFeatured =
      featured.length &&
      isClientScope &&
      state.client === "all" &&
      facetIsAll() &&
      !state.query &&
      !state.demoId;

    if (showFeatured) {
      featuredWrap.hidden = false;
      $("featured").innerHTML = featured
        .map((d, i) => cardHtml(d, instantCards ? 0 : i * 60))
        .join("");
      if (instantCards) $("featured").querySelectorAll(".reveal").forEach((n) => n.classList.add("in"));
      bindCardEvents($("featured"));
      if (!instantCards) observeReveals($("featured"));
    } else {
      featuredWrap.hidden = true;
      $("featured").innerHTML = "";
    }

    $("grid").innerHTML = shown
      .map((d, i) => cardHtml(d, instantCards ? 0 : Math.min(i, 14) * 45))
      .join("");
    if (instantCards) $("grid").querySelectorAll(".reveal").forEach((n) => n.classList.add("in"));
    $("empty").hidden = shown.length > 0;
    bindCardEvents($("grid"));
    if (!instantCards) observeReveals($("grid"));
    syncFilterClear();
  }

  function render(opts = {}) {
    const mode = opts.mode || "full";
    const animate = opts.animate !== false && mode === "full";
    const instantCards = opts.instantCards === true || mode === "results";

    document.body.dataset.scope = state.scope;

    if (mode === "full") {
      $("stat-client").textContent = String(clientDemos().length);
      $("stat-internal").textContent = String(internalDemos().length);
      $("updated").textContent = `目录更新 ${state.catalog.meta?.updated_at || "—"}`;

      renderScope();
      renderScenes();
      renderClientTree();
    }

    renderResults({
      animate: mode === "full" ? animate : !!opts.animate,
      instantCards: mode === "full" ? false : instantCards,
    });
  }

  function openDrawer(id) {
    const demo = allDemos().find((d) => d.id === id);
    if (!demo) return;
    const url = demoUrl(demo);
    const tags = (demo.tags || [])
      .slice(0, 4)
      .map((t) => `<span class="tag">${escapeHtml(t)}</span>`)
      .join("");
    const archives = archivesFor(demo);
    const isMobile = demo.form_factor === "mobile";
    const internal = isInternal(demo);
    const archiveHtml = archives.length
      ? `<div class="drawer-archive">
           <h3>Archive 历史版本</h3>
           <div class="archive-list">
             ${archives
               .map(
                 (a) => `
               <a class="archive-item" href="${demoUrl(a)}" target="_blank" rel="noopener">
                 <div>
                   <strong>${escapeHtml(a.version_label || a.title)}</strong>
                   <div><span>${escapeHtml(a.title)}</span></div>
                 </div>
                 <span>打开 →</span>
               </a>`
               )
               .join("")}
           </div>
         </div>`
      : "";

    $("drawer-body").innerHTML = `
      <p class="eyebrow">${internal ? "内部 DEMO" : "客户 DEMO"} · ${escapeHtml(demo.type || "demo")}</p>
      <h2>${escapeHtml(demo.title)}</h2>
      <p class="summary">${escapeHtml(demo.summary || "")}</p>
      <div class="kv">
        <div><span>归属</span><strong>${internal ? "内部素材" : "客户交付"}</strong></div>
        <div><span>客户</span><strong>${escapeHtml(demo.client || "—")}</strong></div>
        <div><span>行业</span><strong>${escapeHtml(demo.industry || "—")}</strong></div>
        <div><span>版本</span><strong>${escapeHtml(demo.version_label || "最新")}</strong></div>
        <div><span>形态</span><strong>${isMobile ? "移动端" : "桌面端"}</strong></div>
        <div><span>路径</span><strong>/demos/${escapeHtml(demo.id)}/</strong></div>
      </div>
      <div class="card-meta">${tags}</div>
      <div class="drawer-actions">
        <a class="btn" href="${url}" target="_blank" rel="noopener">打开完整 Demo</a>
        <button type="button" class="btn ghost" id="copy-link">复制链接</button>
      </div>
      <div class="preview-wrap">
        <p class="preview-label">统一封面 1600×1000</p>
        <div class="preview-frame cover-preview">
          <img src="${coverUrl(demo)}" alt="${escapeHtml(demo.title)} 封面"
               onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'cover-fallback',textContent:'暂无封面'}))" />
        </div>
      </div>
      ${archiveHtml}
    `;
    $("drawer").classList.add("open");
    $("drawer").setAttribute("aria-hidden", "false");
    $("backdrop").hidden = false;
    const copyBtn = $("copy-link");
    if (copyBtn) {
      copyBtn.onclick = async () => {
        const full = location.origin + url;
        try {
          await copyText(full);
          copyBtn.textContent = "已复制";
          setTimeout(() => (copyBtn.textContent = "复制链接"), 1200);
        } catch {
          copyBtn.textContent = "复制失败";
          setTimeout(() => (copyBtn.textContent = "复制链接"), 1600);
        }
      };
    }
  }

  function closeDrawer() {
    $("drawer").classList.remove("open");
    $("drawer").setAttribute("aria-hidden", "true");
    $("backdrop").hidden = true;
    $("drawer-body").innerHTML = "";
  }

  const FED_PLAN = [
    { step: "demos", label: "展览馆案例" },
    { step: "feedback", label: "会后反馈" },
    { step: "knowledge", label: "知识库" },
    { step: "feishu", label: "飞书 / KnowHow" },
  ];
  const FED_MARK = {
    wait: "等待",
    run: "进行中",
    done: "完成",
    empty: "无命中",
    error: "失败",
  };

  function resetFedSteps() {
    return FED_PLAN.map((s) => ({ ...s, status: "wait", hits: null, hint: "" }));
  }

  function paintFedProgress() {
    const box = $("fed-progress");
    const list = $("fed-steps");
    const fill = $("fed-fill");
    const now = $("fed-now");
    if (!box || !list) return;
    let steps = [];
    try {
      steps = JSON.parse(box.dataset.steps || "[]");
    } catch {
      steps = resetFedSteps();
    }
    const doneN = steps.filter((s) => ["done", "empty", "error"].includes(s.status)).length;
    const running = steps.find((s) => s.status === "run");
    const pct = steps.length
      ? Math.round(((doneN + (running ? 0.45 : 0)) / steps.length) * 100)
      : 0;
    if (fill) fill.style.width = `${Math.min(100, pct)}%`;
    if (now) {
      now.textContent = running
        ? `正在${running.label}…`
        : doneN >= steps.length && steps.length
          ? "正在出卡…"
          : "正在检索全库…";
    }
    list.innerHTML = steps
      .map((s) => {
        const extra =
          typeof s.hits === "number"
            ? `<span class="fed-status">${s.hits} 条</span>`
            : s.hint
              ? `<span class="fed-status">${escapeHtml(s.hint)}</span>`
              : "";
        return `<li class="${escapeHtml(s.status)}"><span class="mark">${
          FED_MARK[s.status] || s.status
        }</span><span>${escapeHtml(s.label)}</span>${extra}</li>`;
      })
      .join("");
  }

  function applyFedStep(evt) {
    const box = $("fed-progress");
    if (!box) return;
    let steps = [];
    try {
      steps = JSON.parse(box.dataset.steps || "[]");
    } catch {
      steps = resetFedSteps();
    }
    const step = String(evt?.step || "");
    if (!step) return;
    let row = steps.find((s) => s.step === step);
    if (!row) {
      row = { step, label: evt.label || step, status: "wait", hits: null, hint: "" };
      steps.push(row);
    }
    row.status = evt.status || "run";
    if (evt.label) row.label = evt.label;
    if (typeof evt.hits === "number") row.hits = evt.hits;
    if (evt.hint) row.hint = evt.hint;
    box.dataset.steps = JSON.stringify(steps);
    paintFedProgress();
  }

  function fedItemHtml(it) {
    const title = escapeHtml(it.title || it.nickname || "条目");
    const url = String(it.url || it.demo_url || "").trim();
    const snip = escapeHtml(it.snippet || it.summary || it.body || it.reason || "");
    const meta = escapeHtml(it.client || it.document_name || it.demo_id || "");
    const inner = `<div class="fed-item-top"><strong>${title}</strong></div>
      ${snip ? `<p class="fed-snip">${snip}</p>` : ""}
      ${meta ? `<span class="fed-meta">${meta}</span>` : ""}`;
    if (/^https?:\/\//i.test(url) || url.startsWith("/")) {
      return `<a class="fed-item" href="${escapeHtml(url)}" target="_blank" rel="noopener">${inner}</a>`;
    }
    return `<div class="fed-item">${inner}</div>`;
  }

  function renderFedBrief(brief) {
    const box = $("fed-brief");
    if (!box) return;
    if (!brief) {
      box.hidden = true;
      box.innerHTML = "";
      return;
    }
    const acc = brief.account || {};
    const who = (acc.peers && acc.peers.length)
      ? acc.peers.join(" / ")
      : (acc.legal || acc.name || "未识别客户");
    const retrievals = (acc.peer_queries && acc.peer_queries.length)
      ? acc.peer_queries.join(" · ")
      : acc.retrieval_query || "";
    const sub = [acc.industry && !(acc.peers && acc.peers.length) ? acc.industry : "", retrievals ? `检索 ${retrievals}` : ""]
      .filter(Boolean)
      .join(" · ");
    const chipItems = [];
    const seenChip = new Set();
    for (const t of [...(brief.tags || []), ...(brief.keywords || [])]) {
      const s = String(t || "").trim();
      if (!s || seenChip.has(s)) continue;
      seenChip.add(s);
      chipItems.push(s);
    }
    const chips = chipItems.length
      ? `<div class="brief-chips">${chipItems
          .map((t) => `<span class="scene-chip">${escapeHtml(t)}</span>`)
          .join("")}</div>`
      : "";
    const summary = (brief.summary || [])
      .map((line) => `<li>${escapeHtml(line)}</li>`)
      .join("");
    const talk = (brief.talk || [])
      .map((p) => {
        const whoLine = p.account_name ? `${escapeHtml(p.account_name)} · ` : "";
        const kind = p.kind ? `${escapeHtml(p.kind)} · ` : "";
        return `<li>${kind}${whoLine}${escapeHtml(p.text || "")}</li>`;
      })
      .join("");
    const demos = (brief.demos || [])
      .map(
        (d) => `<a class="demo-chip" href="${escapeHtml(d.href || "#")}" target="_blank" rel="noopener">${escapeHtml(d.title || "")}</a>`
      )
      .join("");
    const lane = (title, items) => {
      const list = (items || []).filter((s) => s && (s.title || s.snippet));
      if (!list.length) return "";
      const body = list
        .slice(0, 8)
        .map((s) => `<p class="lane-item">${escapeHtml(s.title || "")}</p>`)
        .join("");
      return `<section><p class="sec-label">${title} · ${list.length}</p>${body}</section>`;
    };
    const shareLane = lane("外发", brief.share);
    const internalLane = lane("内部", brief.internal);
    box.innerHTML = `
      <p class="who">${escapeHtml(who)}</p>
      ${sub ? `<p class="sub">${escapeHtml(sub)}</p>` : ""}
      <p class="stance">${escapeHtml(brief.stance || "")}</p>
      ${chips}
      ${summary ? `<ul class="brief-sum">${summary}</ul>` : ""}
      ${talk ? `<ol class="talk">${talk}</ol>` : ""}
      ${demos ? `<div class="demo-row">${demos}</div>` : ""}
      ${shareLane || internalLane ? `<div class="lanes">${shareLane}${internalLane}</div>` : ""}
    `;
    box.hidden = false;
  }

  function renderFedResults(data) {
    const cols = $("fed-cols");
    if (!cols) return;
    const groups = [
      { key: "feedback", title: "会后反馈", items: data.feedback || [] },
      { key: "knowledge", title: "知识库", items: data.knowledge || [] },
      { key: "feishu", title: "飞书 / KnowHow", items: data.feishu || [] },
    ];
    const html = groups
      .filter((g) => g.items.length)
      .map((g) => {
        const body = g.items.slice(0, 8).map(fedItemHtml).join("");
        return `<div class="fed-col"><h4>${g.title} <span>${g.items.length}</span></h4><div class="fed-list">${body}</div></div>`;
      })
      .join("");
    cols.innerHTML = html;
    cols.hidden = !html;
  }

  async function readFedStream(res, signal, onStep) {
    const ctype = (res.headers.get("content-type") || "").toLowerCase();
    if (!ctype.includes("text/event-stream")) return res.json();
    if (!res.body || !res.body.getReader) throw new Error("当前浏览器不支持流式进度");
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    let result = null;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (signal?.aborted) {
        try {
          reader.cancel();
        } catch (_) {
          /* ignore */
        }
        throw new DOMException("Aborted", "AbortError");
      }
      buf += decoder.decode(value, { stream: true });
      let idx;
      while ((idx = buf.indexOf("\n\n")) >= 0) {
        const raw = buf.slice(0, idx);
        buf = buf.slice(idx + 2);
        let event = "message";
        const dataLines = [];
        for (const line of raw.split("\n")) {
          if (line.startsWith("event:")) event = line.slice(6).trim();
          else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
        }
        if (!dataLines.length) continue;
        let data;
        try {
          data = JSON.parse(dataLines.join("\n"));
        } catch {
          continue;
        }
        if (event === "step") onStep(data);
        else if (event === "done" || event === "error") {
          result = data;
          try {
            reader.cancel();
          } catch (_) {
            /* ignore */
          }
          return result;
        }
      }
    }
    return result;
  }

  function hideFed() {
    if (state.fedAbort) {
      try {
        state.fedAbort.abort();
      } catch (_) {
        /* ignore */
      }
      state.fedAbort = null;
    }
    const panel = $("fed-panel");
    if (panel) panel.hidden = true;
    if ($("fed-progress")) $("fed-progress").hidden = true;
    if ($("fed-cols")) $("fed-cols").hidden = true;
    if ($("fed-brief")) {
      $("fed-brief").hidden = true;
      $("fed-brief").innerHTML = "";
    }
  }

  function promptUnlock(message) {
    window.dispatchEvent(
      new CustomEvent("gallery-lock", {
        detail: { message: message || "请先解锁展览馆" },
      })
    );
  }

  function showStageError(message) {
    const el = $("stage-error");
    const msg = $("stage-error-msg");
    if (msg) msg.textContent = message || "目录加载失败";
    if (el) el.hidden = false;
  }

  function hideStageError() {
    const el = $("stage-error");
    if (el) el.hidden = true;
  }

  function showFedUnlock(query, message) {
    const box = $("fed-progress");
    if (box) box.hidden = true;
    $("fed-blurb").textContent = message || "需要解锁后才能检索全库";
    const cols = $("fed-cols");
    if (cols) {
      cols.hidden = false;
      cols.innerHTML = `
        <div class="fed-col">
          <p class="fed-empty">会话无效或已过期。请先解锁展览馆，再检索「${escapeHtml(query)}」。</p>
          <p class="fed-unlock-row">
            <button type="button" class="btn" id="fed-unlock">解锁展览馆</button>
          </p>
        </div>`;
    }
    $("fed-unlock")?.addEventListener("click", () => {
      promptUnlock("检索需要有效会话，请先解锁展览馆");
    });
  }

  async function runFederated(q) {
    const query = String(q || "").trim();
    const panel = $("fed-panel");
    if (!panel) return;
    if (query.length < 2) {
      hideFed();
      return;
    }
    if (state.fedAbort) {
      try {
        state.fedAbort.abort();
      } catch (_) {
        /* ignore */
      }
    }
    state.fedAbort = new AbortController();
    const { signal } = state.fedAbort;
    panel.hidden = false;
    $("fed-blurb").textContent = `正在查「${query}」的反馈、知识库与飞书`;
    const box = $("fed-progress");
    box.hidden = false;
    box.dataset.steps = JSON.stringify(resetFedSteps());
    if ($("fed-fill")) $("fed-fill").style.width = "0%";
    if ($("fed-cols")) {
      $("fed-cols").hidden = true;
      $("fed-cols").innerHTML = "";
    }
    if ($("fed-brief")) {
      $("fed-brief").hidden = true;
      $("fed-brief").innerHTML = "";
    }
    paintFedProgress();
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}&stream=1`, {
        credentials: "same-origin",
        signal,
      });
      if (res.status === 401) {
        showFedUnlock(query, "需要解锁后才能检索全库");
        return;
      }
      const data = await readFedStream(res, signal, applyFedStep);
      if (signal.aborted) return;
      box.hidden = true;
      if (data && data.ok !== false) {
        $("fed-blurb").textContent = `「${query}」会前卡`;
        renderFedBrief(data.briefing);
        renderFedResults(data);
      } else {
        $("fed-blurb").textContent = data?.error || "全库检索失败";
      }
    } catch (e) {
      if (e?.name === "AbortError" || signal.aborted) return;
      box.hidden = true;
      $("fed-blurb").textContent = e.message || "全库检索失败";
    }
  }

  function scheduleFederated(q) {
    clearTimeout(state.fedTimer);
    const query = String(q || "").trim();
    if (query.length < 2) {
      hideFed();
      return;
    }
    state.fedTimer = setTimeout(() => runFederated(query), 600);
  }

  async function loadSearchIndex() {
    try {
      const res = await fetch("/api/search_index.json", {
        cache: "no-store",
        credentials: "same-origin",
      });
      if (!res.ok) return;
      state.searchIndex = await res.json();
    } catch {
      state.searchIndex = null;
    }
  }

  async function loadCatalog() {
    hideStageError();
    try {
      const res = await fetch("/api/catalog.json", { cache: "no-store", credentials: "same-origin" });
      if (res.status === 401) {
        promptUnlock("会话无效或已过期，请解锁后再进入展览馆");
        return false;
      }
      if (!res.ok) {
        throw new Error(`目录接口 HTTP ${res.status}`);
      }
      state.catalog = await res.json();
      rebuildCatalogIndex();
      if (state.catalog?.meta?.sort_policy?.default === "time-desc") {
        state.sort = "time-desc";
      } else {
        state.sort = "time-asc";
      }
      document.title = state.catalog.meta?.title || "DEMO案例库";
      document.body.dataset.scope = state.scope;
      await loadSearchIndex();
      for (const g of clientGroups()) {
        if (g.demos.length > 1 && g.demos.some((d) => d.featured)) state.openFolders.add(g.client);
      }
      render({ mode: "full", animate: true });
      return true;
    } catch (err) {
      showStageError(err.message || "目录加载失败");
      return false;
    }
  }

  async function boot() {
    $("stage-error-retry")?.addEventListener("click", () => {
      loadCatalog();
    });
    const ready = await loadCatalog();
    if (!ready) {
      window.addEventListener(
        "gallery-unlocked",
        () => {
          loadCatalog();
        },
        { once: true }
      );
    }

    const qInput = $("q");
    qInput.addEventListener("input", (e) => {
      state.query = e.target.value;
      state.demoId = null;
      state.suggestIndex = -1;
      renderSuggest();
      clearTimeout(state.searchTimer);
      state.searchTimer = setTimeout(() => {
        // 仅刷新结果区，避免整页换场动画导致抖动
        render({ mode: "results", animate: false, instantCards: true });
        scheduleFederated(state.query);
      }, 160);
    });
    qInput.addEventListener("focus", () => {
      if (qInput.value.trim()) renderSuggest();
    });
    qInput.addEventListener("blur", () => {
      setTimeout(hideSuggest, 120);
    });
    qInput.addEventListener("keydown", (e) => {
      const box = $("suggest");
      const items = box ? [...box.querySelectorAll("[data-suggest-id]")] : [];
      if (e.key === "Escape") {
        hideSuggest();
        if (state.query.trim() || hasActiveFilters()) {
          e.preventDefault();
          clearFilters();
          qInput.blur();
        }
        return;
      }
      if (e.key === "ArrowDown" && items.length) {
        e.preventDefault();
        state.suggestIndex = Math.min(items.length - 1, state.suggestIndex + 1);
        items.forEach((el, i) => el.classList.toggle("active", i === state.suggestIndex));
        return;
      }
      if (e.key === "ArrowUp" && items.length) {
        e.preventDefault();
        state.suggestIndex = Math.max(0, state.suggestIndex - 1);
        items.forEach((el, i) => el.classList.toggle("active", i === state.suggestIndex));
        return;
      }
      if (e.key === "Enter" && state.suggestIndex >= 0 && items[state.suggestIndex]) {
        e.preventDefault();
        applySuggestion(items[state.suggestIndex].dataset.suggestId);
        return;
      }
      if (e.key === "Enter") {
        hideSuggest();
        clearTimeout(state.fedTimer);
        runFederated(qInput.value);
      }
    });

    $("btn-view").addEventListener("click", () => {
      state.list = !state.list;
      document.body.classList.toggle("list-view", state.list);
      $("btn-view").setAttribute("aria-pressed", String(state.list));
      $("btn-view").textContent = state.list ? "网格" : "列表";
    });
    $("backdrop").addEventListener("click", closeDrawer);
    $("drawer-close").addEventListener("click", closeDrawer);
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        const drawerOpen = $("drawer")?.classList.contains("open");
        hideSuggest();
        if (drawerOpen) {
          closeDrawer();
          return;
        }
        if (document.activeElement === qInput) return;
        if (hasActiveFilters()) clearFilters();
      }
      if (e.key === "/" && document.activeElement !== qInput) {
        e.preventDefault();
        qInput.focus();
      }
    });
  }

  boot().catch((err) => {
    showStageError(err.message || "目录加载失败");
  });
})();
