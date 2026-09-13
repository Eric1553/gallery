(function () {
  const D = window.APP_DATA;
  const F = window.FlowEngine;

  const state = {
    route: "dash-home",
    navQ: "",
    openGroups: {
      dash: true,
      master: false,
      start: true,
      exec: true,
      close: false,
      weak: false,
    },
    taskView: "wbs",
    taskProjectId: "all",
    taskQ: "",
    wbsCollapse: {},
    initView: "detail",
    initQ: "",
    planView: "detail",
    soProjectId: "",
    soMode: "Owner",
    soDomain: "全部",
    projView: "list",
    projId: "",
    projTab: "全部",
    projQ: "",
    masterView: "types",
    closeView: "close",
    budgetView: "budget",
    riskView: "risk",
    orgView: "org",
    masterEdit: false,
    focusTodo: null,
  };

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));

  function toast(msg) {
    const el = $("#toast");
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.remove("show"), 2800);
  }

  /** 提交流程后留在当前表单，不硬跳待办（对齐简道云数据管理心智） */
  function stayAfterSubmit(msg) {
    const n = D.todos.filter((t) => t.status === "待办").length;
    toast((msg || "已提交") + (n ? ` · 待办 ${n} 条（侧栏可处理）` : ""));
    persist();
    renderShell();
  }

  function project(id) {
    return D.projects.find((p) => p.id === id);
  }

  function today() {
    return new Date().toISOString().slice(0, 10);
  }

  function pillStatus(s) {
    return `<span class="pill st-${s}">${s}</span>`;
  }
  function pillType(t) {
    return `<span class="pill type-${t}">${t}</span>`;
  }

  function writable(rec) {
    return rec && !rec.sample;
  }

  function applyResult(r, stay) {
    if (!r) return;
    toast(r.msg || (r.ok ? "完成" : "失败"));
    if (stay) renderShell();
    else renderShell();
  }

  function go(route) {
    state.route = route;
    if (route === "form-signoff" && !state.soProjectId) {
      const first = D.projects[0];
      state.soProjectId = first?.id || "";
    }
    renderShell();
  }

  function setTop(title, extra = "") {
    $("#top-title").textContent = title;
    $("#top-extra").innerHTML = extra;
  }

  /* ========== Shell ========== */
  function renderShell() {
    const todoN = D.todos.filter((t) => t.status === "待办").length;
    ["#todo-count", "#todo-count-mini"].forEach((sel) => {
      const el = $(sel);
      if (!el) return;
      el.textContent = String(todoN);
      el.style.display = todoN ? "" : "none";
    });
    renderNav();
    renderPage();
  }

  function renderNav() {
    const q = state.navQ.trim();
    const groups = [
      {
        key: "dash",
        title: "统计分析看板",
        color: "#00b899",
        items: [
          { id: "dash-home", label: "项目综合看板" },
          { id: "dash-signoff", label: "Signoff 统计" },
        ],
      },
      {
        key: "master",
        title: "主数据维护",
        color: "#8a94a6",
        items: [{ id: "form-master", label: "类型 / 阶段 / 科目 / Domain" }],
      },
      {
        key: "start",
        title: "项目启动",
        color: "#36cfc9",
        items: [
          { id: "form-init", label: "项目立项" },
          { id: "form-plan", label: "项目计划" },
          { id: "form-budget", label: "预算 / 工时 / 费用" },
        ],
      },
      {
        key: "exec",
        title: "项目执行",
        color: "#14b8a6",
        items: [
          { id: "form-projects", label: "⭐项目总览" },
          { id: "form-tasks", label: "任务管理" },
          { id: "form-signoff", label: "Signoff Checklist" },
          { id: "form-risk", label: "问题风险 / DACI" },
          { id: "form-org", label: "组织与公告" },
        ],
      },
      {
        key: "close",
        title: "项目结项",
        color: "#0d9488",
        items: [{ id: "form-close", label: "结项 / 中止申请" }],
      },
      {
        key: "weak",
        title: "合同收支（弱化）",
        color: "#c9cdd4",
        items: [{ id: "form-contract", label: "收入合同" }],
      },
    ];

    $("#nav-scroll").innerHTML = `
      <button class="nav-item ${state.route === "todo" ? "active" : ""}" data-route="todo">⭐员工待办事项</button>
      ${groups
        .map((g) => {
          const items = g.items.filter((i) => !q || i.label.includes(q));
          if (q && !items.length && !g.title.includes(q)) return "";
          const open = state.openGroups[g.key];
          return `<div class="nav-group">
            <button type="button" class="nav-group-title" data-group="${g.key}">
              <span class="ico" style="background:${g.color}">■</span>${g.title}
              <span class="caret">${open ? "▾" : "▸"}</span>
            </button>
            <div class="nav-children ${open ? "" : "collapsed"}">
              ${items
                .map(
                  (i) =>
                    `<button type="button" class="nav-item ${state.route === i.id ? "active" : ""}" data-route="${i.id}">${
                      i.id === "form-tasks" ? '<span class="dot"></span>' : ""
                    }${i.label}</button>`
                )
                .join("")}
            </div>
          </div>`;
        })
        .join("")}`;

    $$("[data-group]").forEach((b) =>
      b.addEventListener("click", () => {
        state.openGroups[b.dataset.group] = !state.openGroups[b.dataset.group];
        renderNav();
      })
    );
    $$("[data-route]").forEach((b) =>
      b.addEventListener("click", () => go(b.dataset.route))
    );
  }

  function renderPage() {
    const map = {
      todo: renderTodo,
      "dash-home": renderDashHome,
      "dash-signoff": renderDashSignoff,
      "form-master": renderMaster,
      "form-init": renderInit,
      "form-plan": renderPlan,
      "form-budget": renderBudget,
      "form-projects": renderProjects,
      "form-tasks": renderTasks,
      "form-signoff": renderSignoff,
      "form-risk": renderRisk,
      "form-org": renderOrg,
      "form-close": renderClose,
      "form-contract": renderContract,
    };
    (map[state.route] || renderDashHome)();
  }

  /** 统一工具栏：左操作 → 筛选 → 说明 → 右搜索（对齐简道云列表页） */
  function stdToolbar({
    addId = "btn-add",
    addLabel = "+ 添加",
    showAdd = true,
    addDisabled = false,
    secondary = "",
    filters = "",
    hint = "",
    search = true,
    searchId = "q-search",
    searchPlaceholder = "搜索数据",
    searchValue = "",
  } = {}) {
    const addBtn = showAdd
      ? `<button type="button" class="btn btn-primary" id="${addId}" ${addDisabled ? "disabled" : ""}>${addLabel}</button>`
      : "";
    const searchHtml =
      search === false
        ? ""
        : typeof search === "string"
          ? search
          : `<input class="search" id="${searchId}" placeholder="${searchPlaceholder}" value="${String(searchValue || "").replace(/"/g, "&quot;")}" />`;
    return `
      <div class="tb-actions">${addBtn}${secondary}</div>
      ${filters ? `<div class="tb-filters">${filters}</div>` : ""}
      ${hint ? `<span class="muted tb-hint" title="${String(hint).replace(/"/g, "&quot;")}">${hint}</span>` : ""}
      <div class="spacer"></div>
      ${searchHtml ? `<div class="tb-search">${searchHtml}</div>` : ""}`;
  }


  function openFlowAnalysis(formTitle) {
    const maps = {
      "项目立项": ["填写立项信息", "提交审批", "审批通过", "回写执行中 / 生成计划草稿"],
      "项目计划": ["填写里程碑节点", "提交计划审批", "审批通过", "同步任务管理 WBS"],
      "任务管理": ["开始执行", "交付验收审批", "阶段 Exit Review", "进度回写"],
      "结项 / 中止申请": ["发起结项或中止", "待办审批", "回写已结项 / 已中止"],
      "Signoff Checklist": ["Owner 勾选 Check", "Approver 审批", "完成率达标", "允许发起 Exit"],
      "预算 / 工时 / 费用": ["预算对照", "工时/费用填报", "待办审批", "回写实际与执行率"],
      "主数据维护": ["维护选项字典", "保存生效", "被立项/计划/任务表单引用"],
    };
    const steps = maps[formTitle] || ["填报", "提交", "审批", "回写业务表"];
    openModal({
      title: `流程分析 · ${formTitle}`,
      body: `<div class="flow-ana">
        <p class="muted" style="margin:0 0 14px">对齐简道云「流程分析」：展示本表单主链路节点（演示）。</p>
        <ol class="flow-ana-steps">
          ${steps.map((s, i) => `<li><em>${i + 1}</em><span>${s}</span></li>`).join("")}
        </ol>
      </div>`,
      footer: `<button type="button" class="btn btn-primary" data-modal-close>知道了</button>`,
    });
  }


  function formChrome({ title, views, activeView, onView, toolbar = "", body, showFlow = true, onAdd }) {
    setTop(title, "");
    // 不展示右侧「编辑 / 数据管理 / 流程分析」（与工具栏、行内操作重复）
    $("#view").innerHTML = `
      <div class="form-page form-page--jdy">
        <div class="form-head">
          <div class="form-head-left">
            ${showFlow ? `<button type="button" class="flow-link" id="btn-manage-flow">▾ 管理全部流程</button>` : `<span class="flow-link-placeholder"></span>`}
          </div>
          <div class="view-tabs">
            ${views
              .map(
                (v) =>
                  `<button type="button" data-view="${v.id}" class="${activeView === v.id ? "active" : ""}">${v.label}</button>`
              )
              .join("")}
            <button type="button" class="add-view" title="新建视图" id="btn-add-view">+</button>
          </div>
        </div>
        ${toolbar ? `<div class="toolbar">${toolbar}</div>` : ""}
        <div class="form-body"><div class="form-sheet">${body}</div></div>
      </div>`;
    $$(".view-tabs [data-view]").forEach((b) =>
      b.addEventListener("click", () => {
        if (state.masterEdit && state.route === "form-master") {
          state.masterEdit = false;
          state._masterSnap = null;
        }
        onView(b.dataset.view);
      })
    );
    $("#btn-manage-flow")?.addEventListener("click", () => openFlowAnalysis(title));
    $("#btn-add-view")?.addEventListener("click", () =>
      toast("新建视图（演示）：可按角色另存筛选条件与列配置")
    );
    $("#empty-cta")?.addEventListener("click", (e) => {
      const goRoute = $("#empty-cta").dataset.go;
      if (goRoute) {
        go(goRoute);
        return;
      }
      if (typeof onAdd === "function") {
        e.preventDefault();
        onAdd();
      }
    });
  }

  function emptyForm(text, ctaLabel, ctaRoute) {
    return `<div class="empty">
      <p>${text}</p>
      ${
        ctaLabel
          ? `<button type="button" class="btn btn-primary" id="empty-cta" data-go="${ctaRoute || ""}" style="margin-top:12px">${ctaLabel}</button>`
          : ""
      }
    </div>`;
  }

  function bindEmptyCta(fallback = "form-init") {
    $("#empty-cta")?.addEventListener("click", () => {
      const r = $("#empty-cta").dataset.go || fallback;
      if (r) go(r);
    });
  }

  /* ========== 仪表盘 ========== */
  function dashIcon(name) {
    const icons = {
      list: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M8 6h12M8 12h12M8 18h12"/><circle cx="4" cy="6" r="1.2" fill="currentColor"/><circle cx="4" cy="12" r="1.2" fill="currentColor"/><circle cx="4" cy="18" r="1.2" fill="currentColor"/></svg>`,
      file: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5z"/><path d="M14 3v5h5M9 13h6M9 17h4"/></svg>`,
      plan: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4M8 14h4M8 18h8"/></svg>`,
      task: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>`,
      check: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="9"/></svg>`,
      todo: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 6h12M4 12h16M4 18h10"/><path d="M18 15l2 2 3-4"/></svg>`,
    };
    return icons[name] || icons.list;
  }

  function renderDashHome() {
    setTop("项目综合看板", "");
    const counts = {
      total: D.projects.length,
      prep: D.projects.filter((p) => p.status === "立项准备中").length,
      run: D.projects.filter((p) => ["执行中", "阶段评审中"].includes(p.status)).length,
      done: D.projects.filter((p) => p.status === "已结项").length,
    };
    const openMs = D.tasks.filter(
      (t) => t.critical && !["已完成", "已验收", "已取消"].includes(t.status)
    );
    const pendingN = D.todos.filter((t) => t.status === "待办").length;

    $("#view").innerHTML = `
      <div class="dash">
        <div class="dash-banner">
          <div>
            <div class="banner-title">项目综合看板</div>
            <div class="banner-sub">江原研发项目管理 · 数据来自表单与流程回写</div>
          </div>
        </div>
        <div class="quick-panel">
          <div class="quick-row">
            ${[
              ["form-projects", "项目总览", "list"],
              ["form-init", "项目立项", "file"],
              ["form-plan", "项目计划", "plan"],
              ["form-tasks", "任务管理", "task"],
              ["form-signoff", "Signoff", "check"],
              ["todo", pendingN ? `我的待办(${pendingN})` : "我的待办", "todo"],
            ]
              .map(
                ([r, lab, icon]) =>
                  `<button type="button" class="quick" data-go="${r}"><span class="qi">${dashIcon(icon)}</span><span class="ql">${lab}</span></button>`
              )
              .join("")}
          </div>
        </div>
        <div class="kpi-grid">
          <div class="kpi o"><div class="lab">项目总数</div><div class="val">${counts.total}</div></div>
          <div class="kpi p"><div class="lab">立项准备中</div><div class="val">${counts.prep}</div></div>
          <div class="kpi b"><div class="lab">执行中</div><div class="val">${counts.run}</div></div>
          <div class="kpi g"><div class="lab">已结项</div><div class="val">${counts.done}</div></div>
        </div>
        ${
          !D.projects.length
            ? `<div class="panel"><div class="panel-b">${emptyForm(
                "暂无项目数据。请先在「项目立项」添加并提交。",
                "去项目立项",
                null
              )}</div></div>`
            : `<div class="grid-2">
            <div class="panel">
              <div class="panel-h">项目清单</div>
              <div class="table-wrap"><table class="data"><thead><tr><th>名称</th><th>状态</th><th>阶段</th><th>PM</th></tr></thead>
              <tbody>${D.projects
                .slice(0, 8)
                .map(
                  (p) =>
                    `<tr><td>${p.name}${p.sample ? ' <span class="pill">样例</span>' : ""}</td><td>${pillStatus(p.status)}</td><td>${p.stage || "—"}</td><td>${p.pm}</td></tr>`
                )
                .join("")}</tbody></table></div>
            </div>
            <div class="panel">
              <div class="panel-h">开放关键里程碑</div>
              <div class="table-wrap"><table class="data"><thead><tr><th>项目</th><th>里程碑</th><th>状态</th><th>进度</th></tr></thead>
              <tbody>${
                openMs.length
                  ? openMs
                      .slice(0, 8)
                      .map((t) => {
                        const p = project(t.projectId);
                        return `<tr><td>${p?.name || "—"}</td><td>${t.name}</td><td>${pillStatus(t.status)}</td><td>${t.progress}%</td></tr>`;
                      })
                      .join("")
                  : `<tr><td colspan="4" class="muted" style="padding:24px;text-align:center">暂无开放里程碑</td></tr>`
              }</tbody></table></div>
            </div>
          </div>
          <div class="panel">
            <div class="panel-h">任务甘特
              <button type="button" class="btn" data-go="form-tasks">打开任务管理</button>
            </div>
            <div class="panel-b" style="padding:0">${
              D.tasks.length ? ganttHtml(D.tasks.slice(0, 12)) : `<div class="empty">确认项目计划后生成任务</div>`
            }</div>
          </div>`
        }
      </div>`;

    $$("[data-go]").forEach((el) => el.addEventListener("click", () => go(el.dataset.go)));
    $("#empty-cta")?.addEventListener("click", () => go("form-init"));
  }

  function renderDashSignoff() {
    setTop("Signoff 统计", "");
    const items = D.signoffItems;
    const appr = items.filter((s) => s.approval === "Approved").length;
    $("#view").innerHTML = `
      <div class="dash">
        <div class="kpi-grid">
          <div class="kpi"><div class="lab">检查条目</div><div class="val">${items.length}</div></div>
          <div class="kpi b"><div class="lab">Approved</div><div class="val">${appr}</div></div>
          <div class="kpi o"><div class="lab">Approve 率</div><div class="val">${items.length ? Math.round((appr / items.length) * 100) : 0}%</div></div>
        </div>
        <div class="panel">
          <div class="panel-h">明细 <button type="button" class="btn" data-go="form-signoff">打开表单</button></div>
          <div class="table-wrap"><table class="data"><thead><tr><th>项目</th><th>Domain</th><th>Description</th><th>Check</th><th>Approval</th></tr></thead>
          <tbody>${
            items.length
              ? items
                  .map((s) => {
                    const p = project(s.projectId);
                    return `<tr><td>${p?.name || "—"}</td><td>${s.domain}</td><td>${s.description}</td><td>${s.check}</td><td>${s.approval || "—"}</td></tr>`;
                  })
                  .join("")
              : `<tr><td colspan="5"><div class="empty">暂无 Signoff 数据（任务验收后自动生成，或在表单中生成）</div></td></tr>`
          }</tbody></table></div>
        </div>
      </div>`;
    $$("[data-go]").forEach((el) => el.addEventListener("click", () => go(el.dataset.go)));
  }

  /* ========== 待办 ========== */
  function renderTodo() {
    setTop("员工待办事项", "");
    const pending = D.todos.filter((t) => t.status === "待办");
    const done = D.todos.filter((t) => t.status !== "待办");
    const tab = state.todoTab || "pending";
    const list = (tab === "pending" ? pending : done).slice().sort((a, b) => {
      if (a.status === "待办" && b.status !== "待办") return -1;
      if (a.status !== "待办" && b.status === "待办") return 1;
      return 0;
    });

    $("#view").innerHTML = `
      <div class="todo-page">
        <div class="todo-tabs">
          <button type="button" data-ttab="pending" class="${tab === "pending" ? "active" : ""}">我的待办（${pending.length}）</button>
          <button type="button" data-ttab="done" class="${tab === "done" ? "active" : ""}">我处理的（${done.length}）</button>
          <button type="button" class="muted" title="演示">抄送我的（0）</button>
        </div>
        <div class="todo-body">
          <div class="toolbar">
            <span class="muted">流程待办 · 通过后回写业务表单</span>
            <div class="spacer"></div>
            <input class="search" placeholder="搜索待办" id="todo-q" />
          </div>
          <div class="table-wrap"><table class="data">
            <thead><tr><th style="width:40px"></th><th>状态</th><th>标题</th><th>类型</th><th>发起人</th><th>关联项目</th><th>到达时间</th><th>操作</th></tr></thead>
            <tbody>${
              list.length
                ? list
                    .map((t) => {
                      const p = project(t.projectId);
                      return `<tr class="${state.focusTodo === t.id ? "focus-row" : ""}">
                        <td><input type="checkbox" /></td>
                        <td><span class="pill ${t.status === "待办" ? "st-进行中" : "st-已完成"}">${t.status}</span></td>
                        <td><a data-handle="${t.id}">${t.title}</a></td>
                        <td>${t.type}</td><td>${t.from}</td><td>${p?.name || "—"}</td>
                        <td class="muted">${t.createdAt || "—"}</td>
                        <td class="ops">${
                          t.status === "待办"
                            ? `<button type="button" class="btn-sm" data-handle="${t.id}">处理</button>`
                            : `<span class="muted">已办</span>`
                        }</td>
                      </tr>`;
                    })
                    .join("")
                : `<tr><td colspan="8"><div class="empty">当前分类暂无待办</div></td></tr>`
            }</tbody></table></div>
        </div>
      </div>`;

    $$("[data-ttab]").forEach((b) =>
      b.addEventListener("click", () => {
        state.todoTab = b.dataset.ttab;
        renderTodo();
      })
    );
    $$("[data-handle]").forEach((b) =>
      b.addEventListener("click", () => openTodoModal(b.dataset.handle))
    );
    if (state.focusTodo) {
      const id = state.focusTodo;
      state.focusTodo = null;
      if (D.todos.find((t) => t.id === id && t.status === "待办")) openTodoModal(id);
    }
  }

  function openTodoModal(todoId) {
    const t = D.todos.find((x) => x.id === todoId);
    if (!t) return;
    const p = project(t.projectId);
    openModal({
      title: "处理待办",
      body: `
      <div class="form-grid">
        <div class="form-row full"><label>标题</label><input value="${t.title}" readonly /></div>
        <div class="form-row"><label>类型</label><input value="${t.type}" readonly /></div>
        <div class="form-row"><label>发起人</label><input value="${t.from}" readonly /></div>
        <div class="form-row full"><label>关联项目</label><input value="${p?.name || "—"}（${p?.status || ""}）" readonly /></div>
        ${
          t.payload
            ? `<div class="form-row full"><label>申请内容</label><pre class="pre">${JSON.stringify(t.payload, null, 2)}</pre></div>`
            : ""
        }
        <div class="form-row full"><label>审批意见</label><textarea id="todo-note" rows="2">同意</textarea></div>
      </div>`,
      foot: `
        <button type="button" class="btn" data-modal-close>取消</button>
        <button type="button" class="btn" id="todo-no">驳回</button>
        <button type="button" class="btn btn-primary" id="todo-ok">通过</button>`,
      ready: () => {
        if (t.action === "fill_plan") {
          $("#todo-ok").textContent = "去填写计划";
          if ($("#todo-no")) $("#todo-no").style.display = "none";
          $("#todo-ok").onclick = () => {
            closeModal();
            go("form-plan");
            setTimeout(() => openPlanModal(t.refId), 0);
          };
          return;
        }
        $("#todo-ok").onclick = () => {
          const r = F.processTodo(todoId, "approve");
          closeModal();
          persist();
          toast(r.msg);
          if (r.navigate === "form-plan") {
            go("form-plan");
            if (r.planId) setTimeout(() => openPlanModal(r.planId), 0);
          } else renderShell();
        };
        $("#todo-no").onclick = () => {
          const r = F.processTodo(todoId, "reject");
          closeModal();
          persist();
          toast(r.msg);
          renderShell();
        };
      },
    });
  }

  /* ========== 立项 ========== */
  function renderInit() {
    let list = D.projects.slice();
    if (state.initQ) {
      const q = state.initQ;
      list = list.filter(
        (p) => p.name.includes(q) || p.code.includes(q) || p.owner.includes(q)
      );
    }

    const views = [
      { id: "detail", label: "项目立项详情" },
      { id: "gallery", label: "画廊视图" },
      { id: "board", label: "看板视图" },
    ];

    let body = "";
    if (!list.length) {
      body = emptyForm("暂无数据，点击「+ 添加」创建立项记录。", "+ 添加", null);
    } else if (state.initView === "gallery") {
      body = `<div class="gallery">${list
        .map(
          (p) => `<div class="g-card">
            <h4>${p.name}${p.sample ? ' <span class="pill">样例</span>' : ""}</h4>
            <p>${p.code}</p>
            <p>${pillStatus(p.status)} · ${p.type}</p>
            <p>负责人 ${p.owner} · PM ${p.pm}</p>
            <p class="muted">流程状态：${p.flowStatus}</p>
            ${
              writable(p) && p.status === "立项准备中"
                ? `<button type="button" class="btn btn-primary" data-submit="${p.id}">提交</button>`
                : ""
            }
          </div>`
        )
        .join("")}</div>`;
    } else if (state.initView === "board") {
      const cols = ["立项准备中", "立项审批中", "执行中", "已结项", "已中止"];
      body = `<div class="kanban">${cols
        .map((st) => {
          const cards = list.filter((p) => p.status === st);
          return `<div class="kanban-col"><div class="kanban-head">${st}<span class="n">${cards.length}</span></div>
            <div class="kanban-body">${cards
              .map(
                (p) => `<div class="k-card"><h4>${p.name}</h4>
                <div class="k-field"><span class="lab">类型</span>${p.type}</div>
                <div class="k-field"><span class="lab">PM</span>${p.pm}</div>
                <div class="k-foot">${
                  writable(p) && p.status === "立项准备中"
                    ? `<button type="button" class="btn-sm" data-submit="${p.id}">提交</button>`
                    : `<span class="muted">${p.code}</span>`
                }</div></div>`
              )
              .join("")}</div></div>`;
        })
        .join("")}</div>`;
    } else {
      body = `<div class="table-wrap"><table class="data">
        <thead><tr><th>项目编号</th><th>项目名称</th><th>状态</th><th>类型</th><th>负责人</th><th>PM</th><th>流程状态</th><th>操作</th></tr></thead>
        <tbody>${list
          .map((p) => {
            let ops = "—";
            if (writable(p) && p.status === "立项准备中") {
              ops = `<button type="button" class="btn-sm" data-submit="${p.id}">提交</button>`;
            } else if (writable(p) && p.status === "立项审批中") {
              ops = `<button type="button" class="btn-sm" data-go="todo">去待办</button>`;
            }
            return `<tr>
              <td>${p.code}</td>
              <td>${p.name}${p.sample ? ' <span class="pill">样例</span>' : ""}</td>
              <td>${pillStatus(p.status)}</td><td>${p.type}</td><td>${p.owner}</td><td>${p.pm}</td>
              <td>${p.flowStatus}</td><td class="ops">${ops}</td></tr>`;
          })
          .join("")}</tbody></table></div>`;
    }

    formChrome({
      title: "项目立项",
      views,
      activeView: state.initView,
      onView: (v) => {
        state.initView = v;
        renderInit();
      },
      toolbar: stdToolbar({
        addId: "btn-add",
        secondary: `<button type="button" class="btn" id="btn-export-init">导出</button>`,
        searchId: "init-q",
        searchValue: state.initQ,
      }),
      body,
      onAdd: () => openCreateProject(),
    });
    $("#btn-export-init")?.addEventListener("click", () => toast("导出（演示）"));

    $("#btn-add").onclick = () => openCreateProject();
    $("#init-q").oninput = (e) => {
      state.initQ = e.target.value;
      renderInit();
    };
    $$("[data-submit]").forEach((b) =>
      b.addEventListener("click", () => openSubmitExisting(b.dataset.submit))
    );
    $$("[data-go]").forEach((b) => b.addEventListener("click", () => go(b.dataset.go)));
  }

  function readInitFields() {
    return {
      code: $("#f-code").value.trim(),
      name: $("#f-name").value.trim(),
      type: $("#f-type").value,
      owner: $("#f-owner").value,
      coleader: $("#f-co").value,
      pm: $("#f-pm").value,
      planStart: $("#f-ps").value,
      planEnd: $("#f-pe").value,
      remark: $("#f-remark").value,
    };
  }

  function initFormBody(values) {
    const v = values || {};
    const code = v.code || `JY-RD-2026-${String(D.projects.length + 1).padStart(4, "0")}`;
    const name =
      v.name ||
      `项目代号-${String(D.projects.filter((p) => !p.sample).length + 1).padStart(2, "0")}`;
    return `
      <div class="form-grid">
        <div class="form-row"><label><span class="req">*</span>项目编号</label><input id="f-code" value="${code}" ${v.readonly ? "readonly" : ""} /></div>
        <div class="form-row"><label><span class="req">*</span>项目名称</label><input id="f-name" value="${name}" ${v.readonly ? "readonly" : ""} /></div>
        <div class="form-row"><label><span class="req">*</span>项目类型</label>
          <select id="f-type" ${v.readonly ? "disabled" : ""}>${D.projectTypes.map((t) => `<option ${t === (v.type || D.projectTypes[0]) ? "selected" : ""}>${t}</option>`).join("")}</select>
        </div>
        <div class="form-row"><label><span class="req">*</span>项目负责人</label>
          <select id="f-owner" ${v.readonly ? "disabled" : ""}>${D.members.map((m) => `<option ${m.name === (v.owner || "成员代号-PL") ? "selected" : ""}>${m.name}</option>`).join("")}</select>
        </div>
        <div class="form-row"><label>Co-Leader</label>
          <select id="f-co" ${v.readonly ? "disabled" : ""}><option value="">（空）</option>${D.members.map((m) => `<option ${m.name === (v.coleader || "") ? "selected" : ""}>${m.name}</option>`).join("")}</select>
        </div>
        <div class="form-row"><label><span class="req">*</span>PM</label>
          <select id="f-pm" ${v.readonly ? "disabled" : ""}>${D.members.map((m) => `<option ${m.name === (v.pm || "成员代号-PM") ? "selected" : ""}>${m.name}</option>`).join("")}</select>
        </div>
        <div class="form-row"><label><span class="req">*</span>计划开始</label><input type="date" id="f-ps" value="${v.planStart || today()}" ${v.readonly ? "readonly" : ""} /></div>
        <div class="form-row"><label><span class="req">*</span>计划结束</label><input type="date" id="f-pe" value="${v.planEnd || today()}" ${v.readonly ? "readonly" : ""} /></div>
        <div class="form-row full"><label>备注</label><textarea id="f-remark" rows="3" ${v.readonly ? "readonly" : ""}>${v.remark || ""}</textarea></div>
      </div>`;
  }

  /** 简道云流程表单：弹窗填写 → 暂存 / 提交 */
  function openCreateProject() {
    openModal({
      title: "项目立项",
      body: initFormBody(),
      footer: `
        <button type="button" class="btn" id="f-cancel">取消</button>
        <button type="button" class="btn" id="f-draft">暂存</button>
        <button type="button" class="btn btn-primary" id="f-submit">提交</button>`,
      onReady: () => {
        $("#f-cancel").onclick = closeModal;
        $("#f-draft").onclick = () => {
          const fields = readInitFields();
          if (!fields.name) return toast("请填写项目名称");
          const r = F.createProject(fields);
          closeModal();
          toast(r.msg);
          renderInit();
        };
        $("#f-submit").onclick = () => {
          const fields = readInitFields();
          if (!fields.name) return toast("请填写项目名称");
          const r = F.submitInitForm(fields);
          closeModal();
          if (!r.ok) return toast(r.msg);
          stayAfterSubmit(r.msg);
        };
      },
    });
  }

  /** 对已暂存记录：弹窗确认后提交流程 */
  function openSubmitExisting(projectId) {
    const p = project(projectId);
    if (!p) return;
    openModal({
      title: "提交立项",
      body: initFormBody({ ...p, readonly: true }),
      footer: `
        <button type="button" class="btn" id="f-cancel">取消</button>
        <button type="button" class="btn btn-primary" id="f-submit">提交</button>`,
      onReady: () => {
        $("#f-cancel").onclick = closeModal;
        $("#f-submit").onclick = () => {
          const r = F.submitInit(projectId);
          closeModal();
          if (!r.ok) {
            toast(r.msg);
            renderInit();
            return;
          }
          stayAfterSubmit(r.msg);
        };
      },
    });
  }

  /* ========== 计划（手填里程碑节点 → 审批 → 同步任务） ========== */
  function renderPlan() {
    const views = [
      { id: "detail", label: "项目计划详情" },
      { id: "reject", label: "审批未通过项目总览" },
    ];
    const plans =
      state.planView === "reject"
        ? D.plans.filter((pl) => pl.status === "已驳回")
        : D.plans.slice();

    // 按状态分组（对齐简道云计划列表）
    const groups = {};
    plans.forEach((pl) => {
      const st = pl.status || "进行中";
      (groups[st] = groups[st] || []).push(pl);
    });
    const order = ["进行中", "审批中", "已完成", "已驳回"];

    let body = "";
    if (!plans.length) {
      body = emptyForm(
        "暂无计划数据。立项通过后会生成计划草稿；也可点「+ 添加」选择项目并填写里程碑节点。",
        "+ 添加",
        null
      );
    } else {
      const rowsHtml = order
        .filter((st) => groups[st]?.length)
        .map((st) => {
          const rows = groups[st];
          return `<tr class="group-row"><td colspan="7"><span class="group-label">${pillStatus(st)}</span><span class="muted"> ${rows.length} 条</span></td></tr>
            ${rows
              .map((pl) => {
                const p = project(pl.projectId);
                const n = (pl.nodes || []).length;
                let ops = "—";
                if (writable(pl) && ["进行中", "已驳回"].includes(pl.status)) {
                  ops = `<button type="button" class="link-op" data-edit-plan="${pl.id}">填写节点</button>
                         <button type="button" class="link-op" data-submit-plan="${pl.id}">提交</button>`;
                } else if (writable(pl) && pl.status === "审批中") {
                  ops = `<button type="button" class="link-op" data-go="todo">去待办</button>`;
                } else if (pl.status === "已完成") {
                  ops = `<button type="button" class="link-op" data-go-tasks="${pl.projectId}">查看任务</button>
                         <button type="button" class="link-op" data-view-plan="${pl.id}">查看计划</button>`;
                }
                return `<tr data-plan-row>
                  <td><input type="checkbox" class="row-ck" data-id="${pl.id}" /></td>
                  <td><a data-edit-plan="${pl.id}">${pl.name}</a></td>
                  <td>${p?.name || "—"}</td>
                  <td>${pl.template || "—"}</td>
                  <td>${n}</td>
                  <td>${pillStatus(pl.status)}</td>
                  <td class="ops">${ops}</td>
                </tr>`;
              })
              .join("")}`;
        })
        .join("");
      body = `<div class="table-wrap"><table class="data data-grouped">
        <thead><tr>
          <th style="width:44px"><input type="checkbox" id="ck-all" /></th>
          <th>计划名称</th><th>关联项目</th><th>计划模板</th><th style="width:72px">节点数</th><th style="width:100px">状态</th><th style="width:160px">操作</th>
        </tr></thead>
        <tbody>${rowsHtml}</tbody>
      </table></div>`;
    }

    formChrome({
      title: "项目计划",
      views,
      activeView: state.planView,
      onView: (v) => {
        state.planView = v;
        renderPlan();
      },
      toolbar: stdToolbar({
        addId: "btn-add-plan",
        secondary: `<button type="button" class="btn" id="btn-export-plan">导出</button>
          <button type="button" class="btn" id="btn-del-plan">删除</button>`,
        searchId: "plan-q",
        searchPlaceholder: "搜索数据",
      }),
      body,
      onAdd: () => openPlanModal(),
    });

    $("#btn-add-plan").onclick = () => openPlanModal();
    $("#btn-export-plan")?.addEventListener("click", () => toast(`导出（演示）：${D.plans.length} 条计划`));
    $("#btn-del-plan")?.addEventListener("click", () => {
      const ids = $$(".row-ck:checked").map((c) => c.dataset.id);
      if (!ids.length) return toast("请先勾选要删除的计划");
      toast(`删除（演示）：已选 ${ids.length} 条，正式环境走回收站`);
    });
    $("#ck-all")?.addEventListener("change", (e) => {
      $$(".row-ck").forEach((c) => {
        c.checked = e.target.checked;
      });
    });
    $("#plan-q")?.addEventListener("input", (e) => {
      const q = e.target.value.trim();
      $$("[data-plan-row]").forEach((tr) => {
        tr.style.display = !q || tr.textContent.includes(q) ? "" : "none";
      });
    });
    $$("[data-edit-plan], [data-view-plan]").forEach((b) =>
      b.addEventListener("click", () => openPlanModal(b.dataset.editPlan || b.dataset.viewPlan))
    );
    $$("[data-submit-plan]").forEach((b) =>
      b.addEventListener("click", () => {
        const pl = D.plans.find((x) => x.id === b.dataset.submitPlan);
        if (!pl) return;
        const r = F.submitPlan(pl);
        if (!r.ok) {
          toast(r.msg);
          renderPlan();
          return;
        }
        stayAfterSubmit(r.msg);
      })
    );
    $$("[data-go]").forEach((b) => b.addEventListener("click", () => go(b.dataset.go)));
    $$("[data-go-tasks]").forEach((b) =>
      b.addEventListener("click", () => {
        state.taskProjectId = b.dataset.goTasks;
        go("form-tasks");
      })
    );
  }

  function planNodesTableHtml(nodes, readonly) {
    const rows = nodes.length
      ? nodes
      : [{ wbs: "1", type: "里程碑任务", name: "", owner: "成员代号-PL", planStart: today(), planEnd: today(), path: "HWG", stage: "需求调研", exitType: "" }];
    return `
      <div class="subtable-wrap">
        <div class="subtable-head">
          <strong>项目计划（里程碑节点）</strong>
          ${readonly ? "" : `<button type="button" class="btn btn-primary" id="node-add">+ 添加节点</button>`}
        </div>
        <div class="table-wrap">
          <table class="data subtable" id="plan-nodes">
            <thead><tr>
              <th style="width:56px">WBS</th>
              <th style="width:110px">任务类型</th>
              <th>任务名称</th>
              <th style="width:120px">负责人</th>
              <th style="width:120px">计划开始</th>
              <th style="width:120px">计划结束</th>
              <th style="width:90px">路径</th>
              ${readonly ? "" : "<th style=\"width:52px\">操作</th>"}
            </tr></thead>
            <tbody>
              ${rows
                .map(
                  (n, i) => `<tr data-idx="${i}">
                  <td><input class="n-wbs" value="${n.wbs || i + 1}" ${readonly ? "readonly" : ""} /></td>
                  <td><select class="n-type" ${readonly ? "disabled" : ""}>${D.taskTypes.map((t) => `<option ${t === (n.type || "里程碑任务") ? "selected" : ""}>${t}</option>`).join("")}</select></td>
                  <td><input class="n-name" value="${n.name || ""}" placeholder="如：里程碑-BTO-SO" ${readonly ? "readonly" : ""} /></td>
                  <td><select class="n-owner" ${readonly ? "disabled" : ""}>${D.members.map((m) => `<option ${m.name === (n.owner || "成员代号-PL") ? "selected" : ""}>${m.name}</option>`).join("")}</select></td>
                  <td><input type="date" class="n-ps" value="${n.planStart || today()}" ${readonly ? "readonly" : ""} /></td>
                  <td><input type="date" class="n-pe" value="${n.planEnd || today()}" ${readonly ? "readonly" : ""} /></td>
                  <td><select class="n-path" ${readonly ? "disabled" : ""}>${D.domains.map((d) => `<option ${d === (n.path || "HWG") ? "selected" : ""}>${d}</option>`).join("")}</select></td>
                  ${readonly ? "" : `<td><button type="button" class="btn-sm node-del">删</button></td>`}
                </tr>`
                )
                .join("")}
            </tbody>
          </table>
        </div>
        <p class="muted" style="margin:8px 0 0">对齐简道云：计划子表手填节点 → 审批通过后同步为「任务管理」中的里程碑；子任务再在任务管理中拆解。</p>
      </div>`;
  }

  function readPlanNodesFromDom() {
    return $$("#plan-nodes tbody tr").map((tr, i) => ({
      wbs: tr.querySelector(".n-wbs")?.value || String(i + 1),
      type: tr.querySelector(".n-type")?.value || "里程碑任务",
      name: tr.querySelector(".n-name")?.value || "",
      owner: tr.querySelector(".n-owner")?.value || "成员代号-PL",
      planStart: tr.querySelector(".n-ps")?.value || today(),
      planEnd: tr.querySelector(".n-pe")?.value || today(),
      path: tr.querySelector(".n-path")?.value || "HWG",
      stage: "执行规划",
      exitType: "",
    }));
  }

  function bindPlanNodeTable() {
    $("#node-add")?.addEventListener("click", () => {
      const tbody = $("#plan-nodes tbody");
      const i = tbody.children.length;
      const tr = document.createElement("tr");
      tr.dataset.idx = String(i);
      tr.innerHTML = `
        <td><input class="n-wbs" value="${i + 1}" /></td>
        <td><select class="n-type">${D.taskTypes.map((t) => `<option ${t === "里程碑任务" ? "selected" : ""}>${t}</option>`).join("")}</select></td>
        <td><input class="n-name" value="" placeholder="里程碑名称" /></td>
        <td><select class="n-owner">${D.members.map((m) => `<option>${m.name}</option>`).join("")}</select></td>
        <td><input type="date" class="n-ps" value="${today()}" /></td>
        <td><input type="date" class="n-pe" value="${today()}" /></td>
        <td><select class="n-path">${D.domains.map((d) => `<option>${d}</option>`).join("")}</select></td>
        <td><button type="button" class="btn-sm node-del">删</button></td>`;
      tbody.appendChild(tr);
      tr.querySelector(".node-del").onclick = () => tr.remove();
    });
    $$(".node-del").forEach((b) =>
      b.addEventListener("click", () => b.closest("tr")?.remove())
    );
  }

  function openPlanModal(planId) {
    const plan = planId ? D.plans.find((x) => x.id === planId) : null;
    const readonly = plan && plan.status === "已完成";
    const execProjects = D.projects.filter(
      (p) => writable(p) && ["执行中", "阶段评审中", "立项审批中"].includes(p.status)
    );
    const defaultPid = plan?.projectId || execProjects.find((p) => p.status === "执行中")?.id || execProjects[0]?.id || "";
    const p0 = project(defaultPid);

    openModal({
      title: plan ? `【项目计划】${project(plan.projectId)?.name || ""}` : "项目计划",
      body: `
        <div class="form-section-title">项目信息</div>
        <div class="form-grid">
          <div class="form-row full"><label><span class="req">*</span>关联项目（选择数据）</label>
            <select id="pl-project" ${plan || readonly ? "disabled" : ""}>
              <option value="">请选择</option>
              ${D.projects
                .filter((p) => !p.sample)
                .map(
                  (p) =>
                    `<option value="${p.id}" ${p.id === defaultPid ? "selected" : ""}>${p.name}（${p.status}）</option>`
                )
                .join("")}
            </select>
          </div>
          <div class="form-row"><label>计划名称</label><input id="pl-name" value="${plan?.name || (p0 ? "计划-" + p0.name : "")}" ${readonly ? "readonly" : ""} /></div>
          <div class="form-row"><label>计划模板</label>
            <div style="display:flex;gap:8px">
              <select id="pl-tpl" ${readonly ? "disabled" : ""} style="flex:1">
                <option value="">（空，手工填写）</option>
                ${D.planTemplates.map((t) => `<option ${t === (plan?.template || "") ? "selected" : ""}>${t}</option>`).join("")}
              </select>
              ${readonly ? "" : `<button type="button" class="btn" id="pl-apply-tpl">带入节点</button>`}
            </div>
          </div>
        </div>
        <div class="form-section-title">项目里程碑计划</div>
        ${planNodesTableHtml(plan?.nodes || [], readonly)}`,
      footer: readonly
        ? `<button type="button" class="btn" data-modal-close>关闭</button>
           <button type="button" class="btn btn-primary" id="pl-to-tasks">打开任务管理</button>`
        : `<button type="button" class="btn" data-modal-close>取消</button>
           <button type="button" class="btn" id="pl-draft">暂存</button>
           <button type="button" class="btn btn-primary" id="pl-submit">提交</button>`,
      onReady: () => {
        bindPlanNodeTable();
        const syncName = () => {
          const p = project($("#pl-project").value);
          if (p && !$("#pl-name").dataset.touched) $("#pl-name").value = "计划-" + p.name;
        };
        $("#pl-project")?.addEventListener("change", syncName);
        $("#pl-name")?.addEventListener("input", () => {
          $("#pl-name").dataset.touched = "1";
        });
        $("#pl-apply-tpl")?.addEventListener("click", () => {
          const pid = $("#pl-project").value;
          const tpl = $("#pl-tpl").value;
          if (!pid) return toast("请先选择项目");
          if (!tpl) return toast("请选择计划模板");
          const nodes = F.templateNodes(tpl, project(pid));
          const old = $("#modal-body")?.querySelector(".subtable-wrap");
          if (old) {
            old.outerHTML = planNodesTableHtml(nodes, false);
            bindPlanNodeTable();
          }
          toast("已带入模板节点，可继续修改");
        });
        const pack = () => ({
          id: plan?.id,
          projectId: $("#pl-project")?.value || plan?.projectId,
          name: $("#pl-name").value,
          template: $("#pl-tpl").value,
          nodes: readPlanNodesFromDom(),
        });
        $("#pl-draft")?.addEventListener("click", () => {
          const r = F.savePlan(pack());
          closeModal();
          persist();
          toast(r.msg);
          renderPlan();
        });
        $("#pl-submit")?.addEventListener("click", () => {
          const r = F.submitPlan(pack());
          if (!r.ok) return toast(r.msg);
          closeModal();
          stayAfterSubmit(r.msg);
        });
        $("#pl-to-tasks")?.addEventListener("click", () => {
          closeModal();
          state.taskProjectId = plan.projectId;
          go("form-tasks");
        });
      },
    });
  }

  function renderBudget() {
    const views = [
      { id: "budget", label: "预算明细" },
      { id: "time", label: "工时填报" },
      { id: "fee", label: "费用登记" },
    ];
    if (!views.some((v) => v.id === state.budgetView)) state.budgetView = "budget";
    const keys = Object.keys(D.budgets);
    const editable = D.projects.filter((p) => !p.sample);

    let body = "";
    let addId = "btn-add";
    let addLabel = "+ 添加";
    let hint = "预算对照 · 实际数经待办审批后回写执行率";

    if (state.budgetView === "budget") {
      addId = "btn-init-budget";
      addLabel = "+ 添加";
      hint = "查看科目预算与执行率；无预算时点「+ 添加」补建骨架";
      body = !keys.length
        ? emptyForm("暂无预算数据。点击「+ 添加」为项目建立预算骨架。", "+ 添加", null)
        : keys
            .map((pid) => {
              const p = project(pid);
              const b = D.budgets[pid];
              const mmRate = b.manMonthPlan ? Math.round((b.manMonthActual / b.manMonthPlan) * 100) : 0;
              const feeRate = b.feePlan ? Math.round((b.feeActual / b.feePlan) * 100) : 0;
              return `<div class="panel" style="margin:12px;border:1px solid var(--line);border-radius:8px">
                <div class="panel-h">${p?.name || pid} · 人月 ${b.manMonthActual}/${b.manMonthPlan}（${mmRate}%） · 费用 ${b.feeActual}/${b.feePlan}万（${feeRate}%）</div>
                <div class="table-wrap"><table class="data"><thead><tr><th>科目</th><th>预算（万）</th><th>实际（万）</th><th>结余</th><th>执行率</th></tr></thead>
                <tbody>${b.subjects
                  .map((s) => {
                    const rate = s.plan ? Math.round((s.actual / s.plan) * 100) : 0;
                    const bal = Math.round((Number(s.plan) - Number(s.actual)) * 100) / 100;
                    return `<tr><td>${s.name}</td><td>${s.plan}</td><td>${s.actual}</td><td style="color:${bal < 0 ? "#c0392b" : "inherit"}">${bal}</td><td>${rate}%</td></tr>`;
                  })
                  .join("")}</tbody></table></div>
              </div>`;
            })
            .join("");
    } else if (state.budgetView === "time") {
      addId = "btn-time";
      addLabel = "+ 添加";
      hint = "工时填报提交后进入待办，通过后回写实际人月";
      const list = D.timeEntries || [];
      body = !list.length
        ? emptyForm("暂无工时填报。点击「+ 添加」提交，审批通过后回写实际人月。", "+ 添加", null)
        : `<div class="table-wrap"><table class="data"><thead><tr><th>项目</th><th>填报人</th><th>人天</th><th>人月</th><th>方向</th><th>说明</th><th>状态</th><th>时间</th></tr></thead>
          <tbody>${list
            .map((e) => {
              const p = project(e.projectId);
              return `<tr><td>${p?.name || "—"}</td><td>${e.person}</td><td>${e.days}</td><td>${e.manMonth}</td><td>${e.domain}</td><td style="white-space:normal">${e.note || "—"}</td><td>${e.status}</td><td>${e.createdAt}</td></tr>`;
            })
            .join("")}</tbody></table></div>`;
    } else {
      addId = "btn-fee";
      addLabel = "+ 添加";
      hint = "费用登记提交后进入待办，通过后回写科目实际与执行率";
      const list = D.feeEntries || [];
      body = !list.length
        ? emptyForm("暂无费用登记。点击「+ 添加」提交，审批通过后回写执行率。", "+ 添加", null)
        : `<div class="table-wrap"><table class="data"><thead><tr><th>项目</th><th>科目</th><th>金额（万）</th><th>说明</th><th>登记人</th><th>状态</th><th>时间</th></tr></thead>
          <tbody>${list
            .map((e) => {
              const p = project(e.projectId);
              return `<tr><td>${p?.name || "—"}</td><td>${e.subject}</td><td>${e.amount}</td><td style="white-space:normal">${e.note || "—"}</td><td>${e.by}</td><td>${e.status}</td><td>${e.createdAt}</td></tr>`;
            })
            .join("")}</tbody></table></div>`;
    }

    formChrome({
      title: "预算 / 工时 / 费用",
      views,
      activeView: state.budgetView,
      onView: (v) => {
        state.budgetView = v;
        renderBudget();
      },
      toolbar: stdToolbar({
        addId,
        addLabel,
        hint,
        searchId: "budget-q",
        searchPlaceholder: "搜索项目/科目",
      }),
      body,
      onAdd: () => {
        if (state.budgetView === "budget") $("#btn-init-budget")?.click();
        else if (state.budgetView === "time") $("#btn-time")?.click();
        else $("#btn-fee")?.click();
      },
    });

    $("#budget-q")?.addEventListener("input", (e) => {
      const q = e.target.value.trim();
      $$(".form-sheet .panel, .form-sheet tbody tr").forEach((el) => {
        el.style.display = !q || el.textContent.includes(q) ? "" : "none";
      });
    });

    const initBudget = () => {
      let n = 0;
      editable.forEach((p) => {
        if (!D.budgets[p.id]) {
          F.ensureBudget(p.id);
          n++;
        }
      });
      persist();
      toast(n ? `已为 ${n} 个项目补建预算骨架` : "可编辑项目均已有预算");
      renderBudget();
    };
    $("#btn-init-budget")?.addEventListener("click", initBudget);
    $("#btn-time")?.addEventListener("click", () => {
      if (!editable.length) return toast("无可用项目");
      openModal({
        title: "工时填报（F07）",
        body: `<div class="form-grid">
          <div class="form-row"><label>项目</label><select id="te-p">${editable.map((p) => `<option value="${p.id}">${p.name}</option>`).join("")}</select></div>
          <div class="form-row"><label>填报人</label><select id="te-who">${D.members.map((m) => `<option>${m.name}</option>`).join("")}</select></div>
          <div class="form-row"><label><span class="req">*</span>人天</label><input id="te-days" type="number" min="0.5" step="0.5" value="5" /></div>
          <div class="form-row"><label>方向</label><select id="te-dom">${D.domains.map((d) => `<option>${d}</option>`).join("")}</select></div>
          <div class="form-row full"><label>任务说明</label><textarea id="te-note" rows="2" placeholder="本周期工作说明…"></textarea></div>
        </div>`,
        footer: `<button type="button" class="btn" data-modal-close>取消</button>
          <button type="button" class="btn btn-primary" id="te-save">提交</button>`,
        onReady: () => {
          $("#te-save").onclick = () => {
            const r = F.submitTimeEntry({
              projectId: $("#te-p").value,
              person: $("#te-who").value,
              days: $("#te-days").value,
              domain: $("#te-dom").value,
              note: $("#te-note").value,
            });
            closeModal();
            if (!r.ok) return toast(r.msg);
            stayAfterSubmit(r.msg);
          };
        },
      });
    });
    $("#btn-fee")?.addEventListener("click", () => {
      if (!editable.length) return toast("无可用项目");
      openModal({
        title: "费用登记（F08）",
        body: `<div class="form-grid">
          <div class="form-row"><label>项目</label><select id="fe-p">${editable.map((p) => `<option value="${p.id}">${p.name}</option>`).join("")}</select></div>
          <div class="form-row"><label>科目</label><select id="fe-s">${D.feeSubjects.map((s) => `<option>${s}</option>`).join("")}</select></div>
          <div class="form-row"><label><span class="req">*</span>金额（万）</label><input id="fe-amt" type="number" min="0.1" step="0.1" value="5" /></div>
          <div class="form-row"><label>登记人</label><select id="fe-by">${D.members.map((m) => `<option ${m.name === "成员代号-FIN" ? "selected" : ""}>${m.name}</option>`).join("")}</select></div>
          <div class="form-row full"><label>说明</label><textarea id="fe-note" rows="2"></textarea></div>
        </div>`,
        footer: `<button type="button" class="btn" data-modal-close>取消</button>
          <button type="button" class="btn btn-primary" id="fe-save">提交</button>`,
        onReady: () => {
          $("#fe-save").onclick = () => {
            const r = F.submitFeeEntry({
              projectId: $("#fe-p").value,
              subject: $("#fe-s").value,
              amount: $("#fe-amt").value,
              by: $("#fe-by").value,
              note: $("#fe-note").value,
            });
            closeModal();
            if (!r.ok) return toast(r.msg);
            stayAfterSubmit(r.msg);
          };
        },
      });
    });
  }

  /* ========== 项目总览（主档：多 Tab 录入 / 结果视图） ========== */
  function ensureProjId() {
    if (!state.projId || !project(state.projId)) {
      const prefer =
        D.projects.find((p) => p.name === "项目代号-01") ||
        D.projects.find((p) => D.tasks.some((t) => t.projectId === p.id)) ||
        D.projects[0];
      state.projId = prefer?.id || "";
    }
    return project(state.projId);
  }

  function projSelectHtml() {
    return `<select class="select" id="proj-sel">${D.projects
      .map((p) => `<option value="${p.id}" ${p.id === state.projId ? "selected" : ""}>${p.name} · ${p.status}</option>`)
      .join("")}</select>`;
  }

  function renderProjects() {
    const views = [
      { id: "list", label: "项目清单" },
      { id: "info", label: "项目信息" },
      { id: "plan", label: "里程碑计划" },
      { id: "tasks", label: "任务结果" },
      { id: "signoff", label: "Signoff" },
      { id: "budget", label: "预算人月" },
      { id: "risk", label: "问题风险" },
    ];
    if (!views.some((v) => v.id === state.projView)) state.projView = "list";
    const p = ensureProjId();

    let toolbar = "";
    let body = "";

    if (state.projView === "list") {
      let list = D.projects.slice();
      if (state.projTab !== "全部") list = list.filter((x) => x.status === state.projTab);
      if (state.projQ) {
        const q = state.projQ;
        list = list.filter(
          (x) =>
            x.name.includes(q) ||
            x.pm.includes(q) ||
            x.owner.includes(q) ||
            (x.coleader || "").includes(q) ||
            (x.code || "").includes(q)
        );
      }
      const tabs = ["全部", ...D.projectStatuses];
      toolbar = stdToolbar({
        addId: "np",
        filters: `<div class="filter-tabs">${tabs
          .map((t) => `<button type="button" data-ptab="${t}" class="${state.projTab === t ? "active" : ""}">${t}</button>`)
          .join("")}</div>`,
        hint: "清单查看；点名称或「主档」进入详情",
        searchId: "pq",
        searchPlaceholder: "搜索项目名称、编号、负责人",
        searchValue: state.projQ,
      });
      body = !list.length
        ? emptyForm("暂无项目。请先在「项目立项」按规则填写并提交。", "去项目立项", "form-init")
        : `<div class="table-wrap"><table class="data">
          <thead><tr><th>序号</th><th>项目名称</th><th>状态</th><th>类型</th><th>阶段</th><th>负责人</th><th>Co-Leader</th><th>PM</th><th>下一节点</th><th>操作</th></tr></thead>
          <tbody>${list
            .map(
              (x, i) => `<tr>
              <td>${i + 1}</td>
              <td><a data-open-info="${x.id}">${x.name}</a><div class="muted">${x.code}</div></td>
              <td>${pillStatus(x.status)}</td><td>${x.type}</td><td>${x.stage || "—"}</td>
              <td>${x.owner}</td><td>${x.coleader || "—"}</td><td>${x.pm}</td>
              <td>${x.nextNode || "—"}</td>
              <td class="ops">
                <button type="button" class="link-op" data-open-info="${x.id}">主档</button>
                <button type="button" class="link-op" data-open-task="${x.id}">任务</button>
              </td>
            </tr>`
            )
            .join("")}</tbody></table></div>`;
    } else if (!p) {
      toolbar = stdToolbar({
        addId: "np",
        hint: "暂无项目主档，请先立项",
        search: false,
      });
      body = emptyForm("暂无项目主档。请先立项。", "去项目立项", "form-init");
    } else {
      toolbar = stdToolbar({
        addId: "np",
        secondary:
          state.projView === "info" && writable(p)
            ? `<button type="button" class="btn" id="btn-proj-change">主档变更</button>`
            : `<button type="button" class="btn" id="goto-form">去填报</button>`,
        filters: projSelectHtml(),
        hint: "详情只读汇总；变更走流程，填报进对应表单",
        search: false,
      });
      if (state.projView === "info") body = projectInfoBody(p);
      else if (state.projView === "plan") body = projectPlanBody(p);
      else if (state.projView === "tasks") body = projectTasksBody(p);
      else if (state.projView === "signoff") body = projectSignoffBody(p);
      else if (state.projView === "budget") body = projectBudgetBody(p);
      else if (state.projView === "risk") body = projectRiskBody(p);
    }

    formChrome({
      title: "项目总览",
      views,
      activeView: state.projView,
      onView: (v) => {
        state.projView = v;
        renderProjects();
      },
      toolbar,
      body,
      onAdd: () => {
        go("form-init");
        setTimeout(() => openCreateProject(), 0);
      },
    });

    $("#np")?.addEventListener("click", () => {
      go("form-init");
      setTimeout(() => openCreateProject(), 0);
    });
    $("#proj-sel")?.addEventListener("change", (e) => {
      state.projId = e.target.value;
      state.soProjectId = e.target.value;
      renderProjects();
    });
    $("#pq")?.addEventListener("input", (e) => {
      state.projQ = e.target.value;
      renderProjects();
    });
    $$("[data-ptab]").forEach((b) =>
      b.addEventListener("click", () => {
        state.projTab = b.dataset.ptab;
        renderProjects();
      })
    );
    $$("[data-open-info]").forEach((a) =>
      a.addEventListener("click", () => {
        state.projId = a.dataset.openInfo;
        state.projView = "info";
        renderProjects();
      })
    );
    $$("[data-open-task]").forEach((a) =>
      a.addEventListener("click", () => {
        state.taskProjectId = a.dataset.openTask;
        go("form-tasks");
      })
    );
    $("#btn-proj-change")?.addEventListener("click", () => openProjectChange(p));
    $("#goto-form")?.addEventListener("click", () => {
      const map = {
        info: "form-init",
        plan: "form-plan",
        tasks: "form-tasks",
        signoff: "form-signoff",
        budget: "form-budget",
        risk: "form-risk",
      };
      if (state.projView === "tasks") state.taskProjectId = state.projId;
      if (state.projView === "signoff") state.soProjectId = state.projId;
      go(map[state.projView] || "form-init");
    });
  }

  function projectInfoBody(p) {
    const taskN = D.tasks.filter((t) => t.projectId === p.id).length;
    const soN = D.signoffItems.filter((s) => s.projectId === p.id).length;
    const done = D.tasks.filter((t) => t.projectId === p.id && ["已完成", "已验收"].includes(t.status)).length;
    const pct = taskN ? Math.round((done / taskN) * 100) : 0;
    return `<div class="master-form">
      <div class="hint">项目级汇总主档：字段由立项/计划/任务/审批回写；修改请走「主档变更」或对应流程表单。</div>
      <div class="form-section-title">项目信息</div>
      <div class="jdy-fields">
        <div class="form-row"><label>项目编号</label><div class="master-ro">${p.code}</div></div>
        <div class="form-row"><label>项目名称</label><div class="master-ro">${p.name}</div></div>
        <div class="form-row"><label>项目状态</label><div class="master-ro">${pillStatus(p.status)}</div></div>
        <div class="form-row"><label>项目类型</label><div class="master-ro">${p.type}</div></div>
        <div class="form-row"><label>当前阶段</label><div class="master-ro">${p.stage || "—"}</div></div>
        <div class="form-row"><label>健康度</label><div class="master-ro">${p.health || "—"}</div></div>
        <div class="form-row"><label>负责人</label><div class="master-ro">${p.owner}</div></div>
        <div class="form-row"><label>Co-Leader</label><div class="master-ro">${p.coleader || "—"}</div></div>
        <div class="form-row"><label>项目经理</label><div class="master-ro">${p.pm}</div></div>
        <div class="form-row"><label>下一节点</label><div class="master-ro">${p.nextNode || "—"} ${p.nextDate ? `· ${p.nextDate}` : ""}</div></div>
        <div class="form-row"><label>计划开始</label><div class="master-ro">${p.planStart || "—"}</div></div>
        <div class="form-row"><label>计划结束</label><div class="master-ro">${p.planEnd || "—"}</div></div>
        <div class="form-row full"><label>项目进度</label>
          <div class="master-ro">${pct}%（任务 ${done}/${taskN} · Signoff ${soN} 条）
            <div class="progress-bar"><i style="width:${pct}%"></i></div>
          </div>
        </div>
        <div class="form-row full"><label>备注</label><div class="master-ro">${p.remark || "暂无内容"}</div></div>
      </div>
      <div class="form-section-title">变更历史</div>
      ${
        (p.changeLog || []).length
          ? `<div class="table-wrap"><table class="data"><thead><tr><th>时间</th><th>类型</th><th>说明</th><th>提交人</th></tr></thead>
            <tbody>${(p.changeLog || [])
              .map((c) => `<tr><td>${c.at}</td><td>${c.type}</td><td style="white-space:normal">${c.note}</td><td>${c.by}</td></tr>`)
              .join("")}</tbody></table></div>`
          : `<p class="muted" style="padding:8px 0">暂无主档变更记录。点击工具栏「主档变更」发起 F02 流程。</p>`
      }
    </div>`;
  }

  function projectPlanBody(p) {
    const plans = D.plans.filter((pl) => pl.projectId === p.id);
    if (!plans.length) {
      return emptyForm("该项目尚无计划。立项通过后在「项目计划」中按规则填写里程碑节点并提交。", "去项目计划", null);
    }
    return plans
      .map((pl) => {
        const nodes = pl.nodes || [];
        return `<div class="dict-block">
          <h4>${pl.name} · ${pillStatus(pl.status)} · 节点 ${nodes.length}</h4>
          <div class="table-wrap"><table class="data">
            <thead><tr><th>WBS</th><th>类型</th><th>名称</th><th>负责人</th><th>计划开始</th><th>计划结束</th><th>路径</th></tr></thead>
            <tbody>${
              nodes.length
                ? nodes
                    .map(
                      (n) =>
                        `<tr><td>${n.wbs}</td><td>${n.type || "—"}</td><td>${n.name}</td><td>${n.owner || "—"}</td><td>${n.planStart || "—"}</td><td>${n.planEnd || "—"}</td><td>${n.path || "—"}</td></tr>`
                    )
                    .join("")
                : `<tr><td colspan="7" class="muted">暂无节点（待填写）</td></tr>`
            }</tbody>
          </table></div>
        </div>`;
      })
      .join("");
  }

  function projectTasksBody(p) {
    const list = D.tasks.filter((t) => t.projectId === p.id);
    if (!list.length) return emptyForm("该项目尚无任务。计划审批通过后会同步里程碑到任务管理。", "去任务管理", null);
    return `<div class="table-wrap"><table class="data">
      <thead><tr><th>WBS</th><th>类型</th><th>名称</th><th>状态</th><th>进度</th><th>负责人</th><th>路径</th><th>计划结束</th></tr></thead>
      <tbody>${list
        .map(
          (t) => `<tr>
          <td>${t.wbs}</td>
          <td><span class="pill type-${t.type}">${t.type}</span>${t.critical ? ' <span class="pill crit">关键</span>' : ""}</td>
          <td>${t.name}</td>
          <td>${pillStatus(t.status)}</td>
          <td style="min-width:100px">${t.progress}%<div class="progress-bar"><i style="width:${t.progress}%"></i></div></td>
          <td>${t.owner}</td><td>${t.path}</td><td>${t.planEnd || "—"}</td>
        </tr>`
        )
        .join("")}</tbody></table></div>`;
  }

  function projectSignoffBody(p) {
    const items = D.signoffItems.filter((s) => s.projectId === p.id);
    if (!items.length) {
      return emptyForm("该项目暂无 Signoff 条目。可在 Signoff Checklist 中按 Domain 规则逐条录入，或任务验收后由流程写入。", "去 Signoff", null);
    }
    return `<div class="table-wrap"><table class="data">
      <thead><tr><th>#</th><th>Domain</th><th>Tag</th><th>Description</th><th>Check</th><th>Owner</th><th>Approval</th></tr></thead>
      <tbody>${items
        .map(
          (s, i) => `<tr>
          <td>${i + 1}</td><td>${s.domain}</td>
          <td>${s.tag1}/${s.tag2}/${s.tag3}</td>
          <td style="white-space:normal;max-width:240px">${s.description}</td>
          <td>${s.check}</td><td>${s.owner}</td><td>${s.approval || "—"}</td>
        </tr>`
        )
        .join("")}</tbody></table></div>`;
  }

  function projectBudgetBody(p) {
    const b = D.budgets[p.id];
    if (!b) return emptyForm("该项目暂无预算数据。请在「预算 / 工时 / 费用」中登记。", "去项目预算", null);
    const mmRate = b.manMonthPlan ? Math.round((b.manMonthActual / b.manMonthPlan) * 100) : 0;
    const feeRate = b.feePlan ? Math.round((b.feeActual / b.feePlan) * 100) : 0;
    return `<div class="master-form">
      <div class="form-section-title">人月与费用汇总</div>
      <div class="form-grid">
        <div class="form-row"><label>计划人月</label><div class="master-ro">${b.manMonthPlan}</div></div>
        <div class="form-row"><label>实际人月</label><div class="master-ro">${b.manMonthActual}（执行率 ${mmRate}%）</div></div>
        <div class="form-row"><label>计划费用(万)</label><div class="master-ro">${b.feePlan}</div></div>
        <div class="form-row"><label>实际费用(万)</label><div class="master-ro ${feeRate > 100 ? "pill st-已中止" : ""}">${b.feeActual}（执行率 ${feeRate}%）</div></div>
      </div>
      <div class="form-section-title">费用科目</div>
      <div class="table-wrap"><table class="data">
        <thead><tr><th>科目</th><th>计划</th><th>实际</th><th>结余</th><th>执行率</th></tr></thead>
        <tbody>${(b.subjects || [])
          .map((s) => {
            const rate = s.plan ? Math.round((s.actual / s.plan) * 100) : 0;
            const bal = Math.round((Number(s.plan) - Number(s.actual)) * 100) / 100;
            return `<tr><td>${s.name}</td><td>${s.plan}</td><td>${s.actual}</td><td style="color:${bal < 0 ? "#c0392b" : "inherit"}">${bal}</td><td>${rate}%</td></tr>`;
          })
          .join("")}</tbody>
      </table></div>
    </div>`;
  }

  function projectRiskBody(p) {
    const list = D.risks.filter((r) => r.projectId === p.id);
    if (!list.length) return emptyForm("该项目暂无问题/风险记录。可在「问题风险 / DACI」中按规则添加。", "去问题风险", null);
    return `<div class="table-wrap"><table class="data">
      <thead><tr><th>类型</th><th>维度</th><th>描述</th><th>等级</th><th>状态</th><th>负责人</th><th>ETA</th></tr></thead>
      <tbody>${list
        .map(
          (r) =>
            `<tr><td>${r.type}</td><td>${r.dimension}</td><td style="white-space:normal">${r.desc}</td><td>${r.level}</td><td>${r.status}</td><td>${r.owner}</td><td>${r.eta}</td></tr>`
        )
        .join("")}</tbody></table></div>`;
  }

  /* ========== 任务 ========== */
  function filteredTasks() {
    let list = D.tasks.slice();
    if (state.taskProjectId !== "all") {
      list = list.filter((t) => t.projectId === state.taskProjectId);
    }
    if (state.taskQ) {
      const q = state.taskQ;
      list = list.filter(
        (t) =>
          t.name.includes(q) ||
          t.owner.includes(q) ||
          t.path.includes(q) ||
          t.wbs.includes(q)
      );
    }
    return list;
  }

  function renderTasks() {
    const views = [
      { id: "wbs", label: "任务WBS分解" },
      { id: "milestone", label: "里程碑视图" },
      { id: "owner-board", label: "负责人负载看板视图" },
      { id: "status-board", label: "任务状态看板" },
      { id: "gantt", label: "甘特进度" },
    ];
    const list = filteredTasks();
    const projOpts = `<option value="all">全部项目</option>${D.projects
      .map(
        (p) =>
          `<option value="${p.id}" ${state.taskProjectId === p.id ? "selected" : ""}>${p.name}</option>`
      )
      .join("")}`;

    let body = "";
    if (!list.length) {
      body = emptyForm(
        "暂无任务。请先在「项目计划」填写里程碑节点并审批通过；也可点「+ 添加」手工建任务。",
        "+ 添加",
        null
      );
    } else if (state.taskView === "wbs") body = taskWbs(list);
    else if (state.taskView === "milestone")
      body = taskTable(list.filter((t) => t.type === "里程碑任务" || t.critical));
    else if (state.taskView === "owner-board") body = taskKanban(list, "owner");
    else if (state.taskView === "status-board") body = taskKanban(list, "status");
    else body = ganttHtml(list);

    const curPid = state.taskProjectId !== "all" ? state.taskProjectId : D.projects.find((p) => !p.sample)?.id;
    const showExit =
      curPid && writable(project(curPid)) && F.signoffReady(curPid) && project(curPid)?.status === "执行中";

    formChrome({
      title: "任务管理",
      views,
      activeView: state.taskView,
      onView: (v) => {
        state.taskView = v;
        renderTasks();
      },
      toolbar: stdToolbar({
        addId: "add-task",
        secondary: `${showExit ? `<button type="button" class="btn" id="btn-exit">发起 Exit</button>` : ""}<button type="button" class="btn" id="btn-export">导出</button>`,
        filters: `<select class="select" id="task-proj">${projOpts}</select>`,
        hint: `共 ${list.length} 条 · 进度由验收与 Exit 回写`,
        searchId: "task-q",
        searchValue: state.taskQ,
      }),
      body,
      onAdd: () => openNewTask(),
    });

    $("#task-proj").onchange = (e) => {
      state.taskProjectId = e.target.value;
      persist();
      renderTasks();
    };
    let tqTimer = 0;
    $("#task-q").oninput = (e) => {
      state.taskQ = e.target.value;
      clearTimeout(tqTimer);
      tqTimer = setTimeout(renderTasks, 120);
    };
    $("#add-task").onclick = () => openNewTask();
    $("#btn-export")?.addEventListener("click", () => toast("导出（演示）：可导出当前视图任务"));
    $("#btn-exit")?.addEventListener("click", () => {
      const r = F.startExit(curPid);
      if (!r.ok) { toast(r.msg); renderTasks(); return; }
      stayAfterSubmit(r.msg);
    });
    bindTaskActions();
  }

  function taskActions(t) {
    if (!writable(t)) return `<span class="muted">样例只读</span>`;
    const p = project(t.projectId);
    const btns = [];
    const stageOk = p && D.stages.indexOf(t.stage) <= D.stages.indexOf(p.stage || "");
    if (t.status === "未开始" && stageOk) {
      btns.push(`<button type="button" class="link-op" data-act="start" data-tid="${t.id}">开始执行</button>`);
    }
    if (t.type === "子任务" && t.status === "进行中") {
      btns.push(`<button type="button" class="link-op" data-act="accept" data-tid="${t.id}">交付验收</button>`);
    }
    if (
      t.type === "里程碑任务" &&
      p &&
      t.stage === p.stage &&
      ["执行中"].includes(p.status) &&
      F.signoffReady(p.id)
    ) {
      btns.push(`<button type="button" class="link-op" data-act="exit" data-tid="${t.id}">阶段Exit</button>`);
    }
    if (t.type === "里程碑任务") {
      btns.push(`<button type="button" class="link-op" data-act="dep" data-tid="${t.id}">前置依赖</button>`);
    }
    if (["进行中", "未开始"].includes(t.status)) {
      btns.push(`<button type="button" class="link-op" data-act="change" data-tid="${t.id}">变更申请</button>`);
    }
    return btns.join("") || `<span class="muted">—</span>`;
  }

  function taskWbs(list) {
    const sorted = list.slice().sort((a, b) => a.wbs.localeCompare(b.wbs, "en", { numeric: true }));
    const visible = sorted.filter((t) => {
      if (!t.parentId) return true;
      let cur = t;
      while (cur.parentId) {
        if (state.wbsCollapse[cur.parentId]) return false;
        cur = D.tasks.find((x) => x.id === cur.parentId) || {};
      }
      return true;
    });
    return `<div class="toolbar" style="border:0;padding:8px 16px">
        <button type="button" class="btn" id="exp-all">展开全部</button>
        <button type="button" class="btn" id="col-all">收起全部</button>
      </div>
      <div class="table-wrap"><table class="data">
      <thead><tr>
        <th></th><th>任务WBS编号</th><th>任务类型</th><th>任务名称</th><th>任务状态</th>
        <th>进度</th><th>负责人</th><th>是否延期</th><th>路径</th><th>操作</th>
      </tr></thead>
      <tbody>${visible
        .map((t) => {
          const depth = (t.wbs.match(/\./g) || []).length;
          const hasChild = D.tasks.some((c) => c.parentId === t.id);
          const collapsed = !!state.wbsCollapse[t.id];
          return `<tr>
            <td><input type="checkbox" /></td>
            <td class="indent-${Math.min(depth, 2)}">
              ${
                hasChild
                  ? `<button type="button" class="tree-toggle" data-toggle="${t.id}">${collapsed ? "▸" : "▾"}</button>`
                  : `<span style="display:inline-block;width:18px"></span>`
              }${t.wbs}
            </td>
            <td>${pillType(t.type)}</td>
            <td>${t.name}${t.critical ? ' <span class="pill crit">关键</span>' : ""}</td>
            <td>${pillStatus(t.status)}</td>
            <td style="min-width:88px">${Number(t.progress).toFixed(0)}%<div class="progress-bar"><i style="width:${t.progress}%"></i></div></td>
            <td>${t.owner}</td>
            <td><span class="pill delay-${t.delayed}">${t.delayed}</span></td>
            <td>${t.path}</td>
            <td class="ops">${taskActions(t)}</td>
          </tr>`;
        })
        .join("")}</tbody></table></div>`;
  }

  function taskTable(list) {
    if (!list.length) return `<div class="empty">暂无里程碑</div>`;
    return `<div class="table-wrap"><table class="data">
      <thead><tr><th>WBS</th><th>任务名称</th><th>类型</th><th>状态</th><th>进度</th><th>负责人</th><th>Exit类型</th><th>操作</th></tr></thead>
      <tbody>${list
        .map(
          (t) => `<tr>
          <td>${t.wbs}</td><td>${t.name}</td><td>${pillType(t.type)}</td>
          <td>${pillStatus(t.status)}</td><td>${t.progress}%</td><td>${t.owner}</td>
          <td>${t.exitType || "—"}</td><td class="ops">${taskActions(t)}</td></tr>`
        )
        .join("")}</tbody></table></div>`;
  }

  function taskKanban(list, mode) {
    const keys = mode === "owner" ? [...new Set(list.map((t) => t.owner))] : D.taskStatuses.slice();
    return `<div class="kanban">${keys
      .map((key) => {
        const cards = list.filter((t) =>
          mode === "owner" ? t.owner === key : t.status === key
        );
        return `<div class="kanban-col" data-k="${key}" data-mode="${mode}">
          <div class="kanban-head">${key}<span class="n">${cards.length}</span></div>
          <div class="kanban-body">${cards
            .map(
              (t) => `<div class="k-card" draggable="${writable(t)}" data-tid="${t.id}">
                <h4>${t.name}</h4>
                <div class="k-tags">${pillType(t.type)} ${pillStatus(t.status)}</div>
                <div class="prog-row"><span>${t.progress}%</span><div class="progress-bar"><i style="width:${t.progress}%"></i></div></div>
                <div class="k-field"><span class="lab">负责人</span>${t.owner}</div>
                <div class="k-foot ops">${taskActions(t)}</div>
              </div>`
            )
            .join("")}</div></div>`;
      })
      .join("")}</div>`;
  }

  function ganttHtml(list) {
    if (!list.length) return `<div class="empty">暂无任务</div>`;
    const starts = list.map((t) => +new Date(t.planStart));
    const ends = list.map((t) => +new Date(t.planEnd));
    const min = Math.min(...starts);
    const max = Math.max(...ends);
    const span = Math.max(max - min, 86400000);
    const labels = [];
    const d = new Date(min);
    d.setDate(1);
    for (let i = 0; i < 6; i++) {
      labels.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
      d.setMonth(d.getMonth() + 1);
    }
    const sorted = list.slice().sort((a, b) => a.wbs.localeCompare(b.wbs, "en", { numeric: true }));
    return `<div class="gantt">
      <div class="gantt-left">
        <div class="gantt-h"><div>任务名称</div><div>负责人</div></div>
        ${sorted.map((t) => `<div class="gantt-r"><div>${t.name}</div><div>${t.owner.replace("成员代号-", "")}</div></div>`).join("")}
      </div>
      <div class="gantt-right">
        <div class="gantt-scale">${labels.map((l) => `<span>${l}</span>`).join("")}</div>
        ${sorted
          .map((t) => {
            const s = +new Date(t.planStart);
            const e = +new Date(t.planEnd);
            const left = ((s - min) / span) * 100;
            const width = Math.max(((e - s) / span) * 100, 2.5);
            const cls =
              t.status === "已完成" || t.status === "已验收"
                ? "done"
                : t.delayed === "已延期"
                  ? "late"
                  : t.status === "未开始"
                    ? "todo"
                    : "";
            return `<div class="lane"><div class="gantt-bar ${cls}" style="left:${left}%;width:${width}%"><span class="fill" style="width:${t.progress}%"></span><span style="position:relative;z-index:1">${t.progress}%</span></div></div>`;
          })
          .join("")}
      </div>
    </div>`;
  }

  function bindTaskActions() {
    $$("[data-toggle]").forEach((b) =>
      b.addEventListener("click", () => {
        state.wbsCollapse[b.dataset.toggle] = !state.wbsCollapse[b.dataset.toggle];
        renderTasks();
      })
    );
    $("#exp-all")?.addEventListener("click", () => {
      state.wbsCollapse = {};
      renderTasks();
    });
    $("#col-all")?.addEventListener("click", () => {
      D.tasks.forEach((t) => {
        if (D.tasks.some((c) => c.parentId === t.id)) state.wbsCollapse[t.id] = true;
      });
      renderTasks();
    });
    $$("[data-act]").forEach((b) =>
      b.addEventListener("click", (e) => {
        e.stopPropagation();
        const t = D.tasks.find((x) => x.id === b.dataset.tid);
        if (!t) return;
        if (b.dataset.act === "start") {
          const r = F.startWork(t.id);
          if (!r.ok) return toast(r.msg);
          persist();
          toast(r.msg);
          renderTasks();
        } else if (b.dataset.act === "accept") {
          openAccept(t);
        } else if (b.dataset.act === "exit") {
          openExit(t);
        } else if (b.dataset.act === "dep") openDependency(t);
        else if (b.dataset.act === "change") openChange(t);
      })
    );

    let dragId = null;
    $$(".k-card[draggable=true]").forEach((card) => {
      card.addEventListener("dragstart", () => {
        dragId = card.dataset.tid;
      });
    });
    $$(".kanban-col").forEach((col) => {
      col.addEventListener("dragover", (e) => e.preventDefault());
      col.addEventListener("drop", (e) => {
        e.preventDefault();
        const t = D.tasks.find((x) => x.id === dragId);
        if (!writable(t)) return;
        if (col.dataset.mode === "owner") {
          t.owner = col.dataset.k;
          persist();
          toast("已调整负责人");
          renderTasks();
          return;
        }
        const next = col.dataset.k;
        // 状态不可自由拖到已验收/已完成：须走交付验收或阶段 Exit
        if (["已验收", "已完成"].includes(next)) {
          toast("已验收/已完成须通过「交付验收」或「阶段 Exit」回写");
          return;
        }
        if (next === "进行中" && t.status === "未开始") {
          const r = F.startWork(t.id);
          if (!r.ok) return toast(r.msg);
          persist();
          toast(r.msg);
          renderTasks();
          return;
        }
        if (next === "已取消") {
          t.status = "已取消";
          F.recalcProjectTasks(t.projectId);
          persist();
          toast("已取消");
          renderTasks();
          return;
        }
        toast("该状态变更不符合阶段推进规则");
      });
    });
  }

  function openAccept(t) {
    const p = project(t.projectId);
    openModal({
      title: "任务交付验收",
      body: `
        <div class="hint" style="margin-bottom:12px">进度不手填百分比：子任务交付验收通过后汇总父级；阶段门禁由 Exit Review 推进。</div>
        <div class="form-grid">
          <div class="form-row full"><label>任务</label><div class="master-ro">${t.name}</div></div>
          <div class="form-row"><label>所属阶段</label><div class="master-ro">${t.stage || "—"}</div></div>
          <div class="form-row"><label>项目当前阶段</label><div class="master-ro">${p?.stage || "—"}</div></div>
          <div class="form-row"><label>汇总进度</label><div class="master-ro">${t.progress}%（回写后重算）</div></div>
          <div class="form-row full"><label>交付说明</label><textarea id="ac-note" rows="3" placeholder="交付物、证据链接…"></textarea></div>
        </div>`,
      footer: `
        <button type="button" class="btn" data-modal-close>取消</button>
        <button type="button" class="btn btn-primary" id="ac-save">提交验收</button>`,
      onReady: () => {
        $("#ac-save").onclick = () => {
          const r = F.submitAccept(t.id);
          closeModal();
          if (!r.ok) return toast(r.msg);
          stayAfterSubmit(r.msg);
        };
      },
    });
  }

  function openExit(t) {
    const p = project(t.projectId);
    openModal({
      title: "阶段 Exit Review",
      body: `
        <div class="hint" style="margin-bottom:12px">对齐江原门禁：Signoff 达标后发起 Exit；审批通过将办结当前阶段任务并推进项目阶段。</div>
        <div class="form-grid">
          <div class="form-row"><label>项目</label><div class="master-ro">${p?.name || ""}</div></div>
          <div class="form-row"><label>关键里程碑</label><div class="master-ro">${t.name}</div></div>
          <div class="form-row"><label>当前阶段</label><div class="master-ro">${p?.stage || ""}</div></div>
          <div class="form-row"><label>Exit 类型</label><div class="master-ro">${t.exitType || "阶段 Exit"}</div></div>
          <div class="form-row full"><label>评审说明</label><textarea id="ex-note" rows="3" placeholder="门禁结论、遗留项…"></textarea></div>
        </div>`,
      footer: `
        <button type="button" class="btn" data-modal-close>取消</button>
        <button type="button" class="btn btn-primary" id="ex-save">提交 Exit</button>`,
      onReady: () => {
        $("#ex-save").onclick = () => {
          const r = F.startExitForTask(t.id);
          closeModal();
          if (!r.ok) return toast(r.msg);
          stayAfterSubmit(r.msg);
        };
      },
    });
  }

  function openDependency(t) {
    openModal({
      title: "任务依赖关系 · 前置依赖",
      body: `
        <div class="form-grid">
          <div class="form-row full"><label>当前任务</label><div class="master-ro">${t.wbs} ${t.name}</div></div>
          <div class="form-row full"><label>前置任务</label>
            <select id="dep-pre" multiple size="6" style="height:auto">
              ${D.tasks
                .filter((x) => x.projectId === t.projectId && x.id !== t.id)
                .map((x) => `<option value="${x.id}">${x.wbs} ${x.name}</option>`)
                .join("")}
            </select>
          </div>
        </div>
        <p class="muted" style="margin-top:8px">辅助表单演示：保存依赖关系（不影响阶段回写主路径）。</p>`,
      footer: `
        <button type="button" class="btn" data-modal-close>取消</button>
        <button type="button" class="btn btn-primary" id="dep-save">保存</button>`,
      onReady: () => {
        $("#dep-save").onclick = () => {
          t.deps = Array.from($("#dep-pre").selectedOptions).map((o) => o.value);
          closeModal();
          persist();
          toast(`已保存 ${t.deps.length} 条前置依赖`);
        };
      },
    });
  }


  function openProjectChange(p) {
    if (!p || !writable(p)) return toast("不可变更");
    openModal({
      title: "项目信息变更（F02）",
      body: `<div class="form-grid">
        <div class="form-row full"><label>项目</label><div class="master-ro">${p.name} · ${p.code}</div></div>
        <div class="form-row"><label>变更类型</label>
          <select id="pc-type"><option>组织</option><option>进度计划</option><option>范围</option><option>预算说明</option></select></div>
        <div class="form-row"><label>负责人</label><select id="pc-owner">${D.members.map((m) => `<option ${m.name === p.owner ? "selected" : ""}>${m.name}</option>`).join("")}</select></div>
        <div class="form-row"><label>Co-Leader</label><select id="pc-co">${D.members.map((m) => `<option ${m.name === (p.coleader || "") ? "selected" : ""}>${m.name}</option>`).join("")}</select></div>
        <div class="form-row"><label>项目经理</label><select id="pc-pm">${D.members.map((m) => `<option ${m.name === p.pm ? "selected" : ""}>${m.name}</option>`).join("")}</select></div>
        <div class="form-row"><label>计划开始</label><input type="date" id="pc-ps" value="${p.planStart || ""}" /></div>
        <div class="form-row"><label>计划结束</label><input type="date" id="pc-pe" value="${p.planEnd || ""}" /></div>
        <div class="form-row full"><label>备注回写</label><input id="pc-remark" value="${(p.remark || "").replace(/"/g, "&quot;")}" /></div>
        <div class="form-row full"><label><span class="req">*</span>变更说明</label><textarea id="pc-note" rows="3" placeholder="变更原因与影响…"></textarea></div>
      </div>`,
      footer: `<button type="button" class="btn" data-modal-close>取消</button>
        <button type="button" class="btn btn-primary" id="pc-save">提交</button>`,
      onReady: () => {
        $("#pc-save").onclick = () => {
          const r = F.startProjectChange(p.id, {
            changeType: $("#pc-type").value,
            owner: $("#pc-owner").value,
            coleader: $("#pc-co").value,
            pm: $("#pc-pm").value,
            planStart: $("#pc-ps").value,
            planEnd: $("#pc-pe").value,
            remark: $("#pc-remark").value,
            note: ($("#pc-note").value || "").trim(),
          });
          closeModal();
          if (!r.ok) return toast(r.msg);
          stayAfterSubmit(r.msg);
        };
      },
    });
  }

  function openChange(t) {
    openModal({
      title: "任务变更申请",
      body: `
        <div class="form-grid">
          <div class="form-row full"><label>任务</label><div class="master-ro">${t.name}</div></div>
          <div class="form-row"><label>变更类型</label>
            <select id="ch-type"><option>计划日期</option><option>负责人</option><option>范围说明</option></select></div>
          <div class="form-row" id="ch-owner-row" style="display:none"><label>新负责人</label>
            <select id="ch-owner">${D.members.map((m) => `<option ${m.name === t.owner ? "selected" : ""}>${m.name}</option>`).join("")}</select></div>
          <div class="form-row" id="ch-ps-row"><label>计划开始</label><input type="date" id="ch-ps" value="${t.planStart || ""}" /></div>
          <div class="form-row" id="ch-pe-row"><label>计划结束</label><input type="date" id="ch-pe" value="${t.planEnd || ""}" /></div>
          <div class="form-row full"><label>变更说明</label><textarea id="ch-note" rows="3"></textarea></div>
        </div>`,
      footer: `
        <button type="button" class="btn" data-modal-close>取消</button>
        <button type="button" class="btn btn-primary" id="ch-save">提交</button>`,
      onReady: () => {
        const syncRows = () => {
          const ctype = $("#ch-type").value;
          $("#ch-owner-row").style.display = ctype === "负责人" ? "" : "none";
          $("#ch-ps-row").style.display = ctype === "计划日期" ? "" : "none";
          $("#ch-pe-row").style.display = ctype === "计划日期" ? "" : "none";
        };
        $("#ch-type").onchange = syncRows;
        syncRows();
        $("#ch-save").onclick = () => {
          const note = ($("#ch-note").value || "").trim();
          if (!note) return toast("请填写变更说明");
          const ctype = $("#ch-type").value;
          D.todos.unshift({
            id: "td" + Date.now(),
            status: "待办",
            createdAt: new Date().toISOString().slice(0, 16).replace("T", " "),
            title: `审批：任务变更 · ${t.name}`,
            type: "任务变更",
            from: t.owner,
            projectId: t.projectId,
            action: "approve_change",
            refId: t.id,
            payload: {
              type: ctype,
              note,
              owner: ctype === "负责人" ? $("#ch-owner").value : undefined,
              planStart: ctype === "计划日期" ? $("#ch-ps").value : t.planStart,
              planEnd: ctype === "计划日期" ? $("#ch-pe").value : t.planEnd,
            },
          });
          closeModal();
          stayAfterSubmit("变更申请已提交");
        };
      },
    });
  }

  function openNewTask() {
    const pid =
      state.taskProjectId !== "all"
        ? state.taskProjectId
        : D.projects.find((p) => !p.sample)?.id;
    if (!pid || !writable(project(pid))) {
      toast("请先选择可编辑项目");
      return;
    }
    openModal({
      title: "添加任务",
      body: `
        <div class="form-grid">
          <div class="form-row full"><label>所属项目</label><input value="${project(pid).name}" readonly /></div>
          <div class="form-row"><label><span class="req">*</span>任务名称</label><input id="nt-n" value="任务代号-NEW" /></div>
          <div class="form-row"><label>任务类型</label><select id="nt-t">${D.taskTypes.map((t) => `<option>${t}</option>`).join("")}</select></div>
          <div class="form-row"><label>路径</label><select id="nt-path">${D.domains.map((d) => `<option>${d}</option>`).join("")}</select></div>
          <div class="form-row"><label>负责人</label><select id="nt-o">${D.members.map((m) => `<option>${m.name}</option>`).join("")}</select></div>
          <div class="form-row"><label>计划开始</label><input type="date" id="nt-s" value="${today()}" /></div>
          <div class="form-row"><label>计划完成</label><input type="date" id="nt-e" value="${today()}" /></div>
        </div>`,
      footer: `
        <button type="button" class="btn" data-modal-close>取消</button>
        <button type="button" class="btn btn-primary" id="nt-save">提交</button>`,
      onReady: () => {
        $("#nt-save").onclick = () => {
          const roots = D.tasks.filter((x) => x.projectId === pid && !x.parentId);
          D.tasks.push({
            id: "t" + Date.now(),
            projectId: pid,
            wbs: String(roots.length + 1),
            parentId: null,
            type: $("#nt-t").value,
            name: $("#nt-n").value,
            path: $("#nt-path").value,
            stage: project(pid)?.stage || "",
            status: "未开始",
            progress: 0,
            owner: $("#nt-o").value,
            participants: "成员代号-PM",
            planStart: $("#nt-s").value,
            planEnd: $("#nt-e").value,
            delayed: "正常推进",
            critical: $("#nt-t").value === "里程碑任务",
            exitType: "",
            priority: "普通",
            sample: false,
          });
          closeModal();
          persist();
          toast("已添加");
          renderTasks();
        };
      },
    });
  }

  /* ========== Signoff ========== */
  function openAddSignoff() {
    const pid = state.soProjectId;
    if (!pid || !writable(project(pid))) {
      toast("请先选择可编辑项目");
      return;
    }
    openModal({
      title: "添加 Signoff 检查项",
      body: `<div class="form-grid">
        <div class="form-row"><label><span class="req">*</span>Domain</label>
          <select id="so-domain">${D.domains.map((d) => `<option>${d}</option>`).join("")}</select></div>
        <div class="form-row"><label><span class="req">*</span>Tag1</label><input id="so-t1" value="Design" /></div>
        <div class="form-row"><label><span class="req">*</span>Tag2</label><input id="so-t2" value="RTL" /></div>
        <div class="form-row"><label><span class="req">*</span>Tag3</label><input id="so-t3" value="REG" /></div>
        <div class="form-row full"><label><span class="req">*</span>Description</label>
          <input id="so-desc" placeholder="检查项代号-CXX：…" /></div>
        <div class="form-row"><label>Owner</label>
          <select id="so-owner">${D.members.map((m) => `<option>${m.name}</option>`).join("")}</select></div>
        <div class="form-row"><label>Approver</label>
          <select id="so-appr">${D.members.map((m) => `<option ${m.name === "成员代号-HW" ? "selected" : ""}>${m.name}</option>`).join("")}</select></div>
      </div>`,
      footer: `
        <button type="button" class="btn" data-modal-close>取消</button>
        <button type="button" class="btn btn-primary" id="so-save">保存</button>`,
      onReady: () => {
        $("#so-save").onclick = () => {
          const description = ($("#so-desc").value || "").trim();
          if (!description) return toast("请填写 Description");
          D.signoffItems.push({
            id: "so" + Date.now(),
            projectId: pid,
            domain: $("#so-domain").value,
            tag1: $("#so-t1").value.trim() || "—",
            tag2: $("#so-t2").value.trim() || "—",
            tag3: $("#so-t3").value.trim() || "—",
            description,
            owner: $("#so-owner").value,
            approver: $("#so-appr").value,
            check: "Not Completed",
            approval: "",
            comments: "",
            sample: false,
          });
          closeModal();
          persist();
          toast("已添加检查项");
          renderSignoff();
        };
      },
    });
  }

  function renderSignoff() {
    if (!state.soProjectId) {
      const prefer =
        D.projects.find((p) => p.name === "项目代号-01") ||
        D.projects.find((p) => D.signoffItems.some((s) => s.projectId === p.id)) ||
        D.projects[0];
      state.soProjectId = prefer?.id || "";
    }
    const domains = ["全部", ...new Set(D.signoffItems.map((s) => s.domain).filter(Boolean))];
    let items = D.signoffItems.filter((s) => s.projectId === state.soProjectId);
    if (state.soDomain !== "全部") items = items.filter((s) => s.domain === state.soDomain);
    const p = project(state.soProjectId);

    const canExit = p && writable(p) && F.signoffReady(p.id) && p.status === "执行中";
    formChrome({
      title: "Signoff Checklist",
      views: [
        { id: "owner", label: "Check Owner" },
        { id: "approver", label: "Check Approver" },
      ],
      activeView: state.soMode === "Owner" ? "owner" : "approver",
      onView: (v) => {
        state.soMode = v === "owner" ? "Owner" : "Approver";
        renderSignoff();
      },
      toolbar: stdToolbar({
        addId: "so-add",
        secondary: canExit ? `<button type="button" class="btn" id="btn-exit2">发起 Exit</button>` : "",
        filters: `<select class="select" id="so-p">${
          D.projects.length
            ? D.projects.map((x) => `<option value="${x.id}" ${x.id === state.soProjectId ? "selected" : ""}>${x.name}</option>`).join("")
            : `<option value="">暂无项目</option>`
        }</select>
        <select class="select" id="so-d">${domains.map((d) => `<option ${d === state.soDomain ? "selected" : ""}>${d}</option>`).join("")}</select>`,
        hint: "按 Domain / Tag 填写 Check → Approver 审批",
        search: false,
      }),
      body: !D.projects.length
        ? emptyForm("暂无项目。", "去项目立项", "form-init")
        : !items.length
          ? emptyForm("该项目暂无 Signoff 条目。请点「+ 添加」按规则录入。", "+ 添加", null)
          : `<div class="table-wrap"><table class="data">
            <thead><tr><th>#</th><th>Domain</th><th>Tag1</th><th>Tag2</th><th>Tag3</th><th>Description</th><th>Check</th><th>Owner</th><th>Approver</th><th>Approval</th><th>Comments</th></tr></thead>
            <tbody>${items
              .map((s, i) => {
                const ed = writable(s);
                const checkCell =
                  state.soMode === "Owner" && ed
                    ? `<select class="select so-c" data-sid="${s.id}">${D.checkStatuses.map((c) => `<option ${c === s.check ? "selected" : ""}>${c}</option>`).join("")}</select>`
                    : s.check;
                const apprCell =
                  state.soMode === "Approver" && ed
                    ? `<select class="select so-a" data-sid="${s.id}"><option value="">(空)</option>${["Pending", "Approved", "Rejected"].map((c) => `<option ${c === s.approval ? "selected" : ""}>${c}</option>`).join("")}</select>`
                    : s.approval || "—";
                return `<tr>
                  <td>${i + 1}</td><td>${s.domain || "—"}</td><td>${s.tag1}</td><td>${s.tag2}</td><td>${s.tag3}</td>
                  <td style="white-space:normal;max-width:200px">${s.description}</td>
                  <td>${checkCell}</td><td>${s.owner}</td><td>${s.approver}</td><td>${apprCell}</td>
                  <td style="white-space:normal;max-width:220px;font-size:11px;color:var(--text3)">${s.comments || "—"}</td>
                </tr>`;
              })
              .join("")}</tbody></table></div>`,
      onAdd: () => {
        if (!D.projects.length) return go("form-init");
        openAddSignoff();
      },
    });

    $("#so-p")?.addEventListener("change", (e) => {
      state.soProjectId = e.target.value;
      renderSignoff();
    });
    $("#so-d")?.addEventListener("change", (e) => {
      state.soDomain = e.target.value;
      renderSignoff();
    });
    $("#so-add")?.addEventListener("click", openAddSignoff);
    $("#btn-exit2")?.addEventListener("click", () => {
      const r = F.startExit(state.soProjectId);
      if (!r.ok) return toast(r.msg);
      stayAfterSubmit(r.msg);
    });
    $$(".so-c").forEach((sel) =>
      sel.addEventListener("change", () => {
        toast(F.updateCheck(sel.dataset.sid, sel.value).msg);
        persist();
        renderSignoff();
      })
    );
    $$(".so-a").forEach((sel) =>
      sel.addEventListener("change", () => {
        toast(F.updateApproval(sel.dataset.sid, sel.value).msg);
        persist();
        renderShell();
      })
    );
  }

  function renderRisk() {
    const views = [
      { id: "risk", label: "重点问题或风险" },
      { id: "daci", label: "DACI" },
    ];
    if (!views.some((v) => v.id === state.riskView)) state.riskView = "risk";
    let body = "";
    let addId = "add-risk";
    if (state.riskView === "risk") {
      addId = "add-risk";
      body = !D.risks.length
        ? emptyForm("暂无风险/问题记录。点击「+ 添加」录入。", "+ 添加", null)
        : `<div class="table-wrap"><table class="data"><thead><tr><th>项目</th><th>类型</th><th>维度</th><th>描述</th><th>等级</th><th>状态</th><th>负责人</th><th>ETA</th></tr></thead>
          <tbody>${D.risks
            .map((r) => {
              const p = project(r.projectId);
              return `<tr><td>${p?.name || "—"}</td><td>${r.type}</td><td>${r.dimension}</td><td style="white-space:normal">${r.desc}</td><td>${r.level}</td><td>${r.status}</td><td>${r.owner}</td><td>${r.eta}</td></tr>`;
            })
            .join("")}</tbody></table></div>`;
    } else {
      addId = "add-daci";
      const list = D.daci || [];
      body = !list.length
        ? emptyForm("暂无 DACI 责任矩阵。点击「+ 添加」录入。", "+ 添加", null)
        : `<div class="table-wrap"><table class="data"><thead><tr><th>项目</th><th>事项</th><th>D</th><th>A</th><th>C</th><th>I</th></tr></thead>
          <tbody>${list
            .map((d) => {
              const p = project(d.projectId);
              return `<tr><td>${p?.name || "—"}</td><td style="white-space:normal">${d.item}</td><td>${d.D}</td><td>${d.A}</td><td>${d.C}</td><td>${d.I}</td></tr>`;
            })
            .join("")}</tbody></table></div>`;
    }
    formChrome({
      title: "问题风险 / DACI",
      views,
      activeView: state.riskView,
      onView: (v) => {
        state.riskView = v;
        renderRisk();
      },
      toolbar: stdToolbar({
        addId,
        hint: state.riskView === "risk" ? "登记问题/风险，高风险未关闭将拦截结项" : "维护 D/A/C/I 责任矩阵",
        searchId: "risk-q",
        searchPlaceholder: "搜索描述/事项",
      }),
      body,
      onAdd: () => (state.riskView === "risk" ? $("#add-risk") : $("#add-daci"))?.click(),
    });
    $("#risk-q")?.addEventListener("input", (e) => {
      const q = e.target.value.trim();
      $$(".form-sheet tbody tr").forEach((tr) => {
        tr.style.display = !q || tr.textContent.includes(q) ? "" : "none";
      });
    });
    $("#add-risk")?.addEventListener("click", () => {
      const p = D.projects.find((x) => !x.sample);
      if (!p) return toast("请先创建项目");
      openModal({
        title: "添加问题/风险",
        body: `<div class="form-grid">
          <div class="form-row"><label>项目</label><select id="rk-p">${D.projects
            .filter((x) => !x.sample)
            .map((x) => `<option value="${x.id}">${x.name}</option>`)
            .join("")}</select></div>
          <div class="form-row"><label>类型</label><select id="rk-t"><option>风险</option><option>问题</option></select></div>
          <div class="form-row"><label>维度</label><select id="rk-d"><option>进度</option><option>质量</option><option>资源</option><option>范围</option></select></div>
          <div class="form-row"><label>等级</label><select id="rk-l"><option>高</option><option selected>中</option><option>低</option></select></div>
          <div class="form-row full"><label><span class="req">*</span>描述</label><input id="rk-desc" value="风险代号-RK-NEW" /></div>
          <div class="form-row"><label>负责人</label><select id="rk-o">${D.members.map((m) => `<option>${m.name}</option>`).join("")}</select></div>
          <div class="form-row"><label>ETA</label><input type="date" id="rk-eta" value="${today()}" /></div>
        </div>`,
        footer: `<button type="button" class="btn" data-modal-close>取消</button>
          <button type="button" class="btn btn-primary" id="rk-save">保存</button>`,
        onReady: () => {
          $("#rk-save").onclick = () => {
            const desc = ($("#rk-desc").value || "").trim();
            if (!desc) return toast("请填写描述");
            D.risks.unshift({
              id: "r" + Date.now(),
              projectId: $("#rk-p").value,
              type: $("#rk-t").value,
              dimension: $("#rk-d").value,
              desc,
              level: $("#rk-l").value,
              status: "待处理",
              owner: $("#rk-o").value,
              eta: $("#rk-eta").value,
              sample: false,
            });
            closeModal();
            persist();
            toast("已添加");
            renderRisk();
          };
        },
      });
    });
    $("#add-daci")?.addEventListener("click", () => {
      const editable = D.projects.filter((x) => !x.sample);
      if (!editable.length) return toast("请先创建项目");
      if (!D.daci) D.daci = [];
      openModal({
        title: "添加 DACI",
        body: `<div class="form-grid">
          <div class="form-row"><label>项目</label><select id="dc-p">${editable.map((x) => `<option value="${x.id}">${x.name}</option>`).join("")}</select></div>
          <div class="form-row full"><label><span class="req">*</span>事项</label><input id="dc-item" placeholder="决策/交付事项" /></div>
          <div class="form-row"><label>D</label><select id="dc-d">${D.members.map((m) => `<option>${m.name}</option>`).join("")}</select></div>
          <div class="form-row"><label>A</label><select id="dc-a">${D.members.map((m) => `<option>${m.name}</option>`).join("")}</select></div>
          <div class="form-row"><label>C</label><select id="dc-c">${D.members.map((m) => `<option>${m.name}</option>`).join("")}</select></div>
          <div class="form-row"><label>I</label><select id="dc-i">${D.members.map((m) => `<option>${m.name}</option>`).join("")}</select></div>
        </div>`,
        footer: `<button type="button" class="btn" data-modal-close>取消</button>
          <button type="button" class="btn btn-primary" id="dc-save">保存</button>`,
        onReady: () => {
          $("#dc-save").onclick = () => {
            const item = ($("#dc-item").value || "").trim();
            if (!item) return toast("请填写事项");
            D.daci.unshift({
              id: "dc" + Date.now(),
              projectId: $("#dc-p").value,
              item,
              D: $("#dc-d").value,
              A: $("#dc-a").value,
              C: $("#dc-c").value,
              I: $("#dc-i").value,
            });
            closeModal();
            persist();
            toast("DACI 已添加");
            renderRisk();
          };
        },
      });
    });
  }

  function renderOrg() {
    const views = [
      { id: "org", label: "组织成员" },
      { id: "ann", label: "公告与链接" },
    ];
    if (!views.some((v) => v.id === state.orgView)) state.orgView = "org";
    let body = "";
    let addId = "add-om";
    if (state.orgView === "org") {
      addId = "add-om";
      const list = D.orgMembers || [];
      body = !list.length
        ? emptyForm("暂无组织成员。点击「+ 添加」维护。", "+ 添加", null)
        : `<div class="table-wrap"><table class="data"><thead><tr><th>项目</th><th>角色</th><th>成员</th><th>Domain</th></tr></thead>
          <tbody>${list
            .map((m) => {
              const p = project(m.projectId);
              return `<tr><td>${p?.name || "—"}</td><td>${m.role}</td><td>${m.name}</td><td>${m.domain}</td></tr>`;
            })
            .join("")}</tbody></table></div>`;
    } else {
      addId = "add-ann";
      const list = D.announcements || [];
      body = !list.length
        ? emptyForm("暂无项目公告。点击「+ 添加」发布。", "+ 添加", null)
        : list
            .map((a) => {
              const p = project(a.projectId);
              const links = (a.links || [])
                .map((l) => `<a href="${l.url}" target="_blank" rel="noopener">${l.name}</a>`)
                .join(" · ");
              return `<div class="panel" style="margin:12px;border:1px solid var(--line);border-radius:8px">
                <div class="panel-h">${a.urgent ? '<span class="pill st-已中止">紧急</span> ' : ""}${a.title}
                  <span class="muted" style="font-weight:400;margin-left:8px">${p?.name || ""} · ${a.createdAt || ""}</span></div>
                <div style="padding:12px 14px;font-size:13px;line-height:1.6">${a.content}
                  <div class="muted" style="margin-top:8px">协作链接：${links || "—"}</div>
                </div>
              </div>`;
            })
            .join("");
    }
    formChrome({
      title: "组织与公告",
      views,
      activeView: state.orgView,
      onView: (v) => {
        state.orgView = v;
        renderOrg();
      },
      toolbar: stdToolbar({
        addId,
        hint: "组织成员与协作链接（本期不做双向同步）",
        searchId: "org-q",
      }),
      body,
      onAdd: () => (state.orgView === "org" ? $("#add-om") : $("#add-ann"))?.click(),
    });
    $("#org-q")?.addEventListener("input", (e) => {
      const q = e.target.value.trim();
      $$(".form-sheet tbody tr, .form-sheet .panel").forEach((el) => {
        el.style.display = !q || el.textContent.includes(q) ? "" : "none";
      });
    });
    $("#add-om")?.addEventListener("click", () => {
      const editable = D.projects.filter((x) => !x.sample);
      if (!editable.length) return toast("请先创建项目");
      if (!D.orgMembers) D.orgMembers = [];
      openModal({
        title: "添加组织成员",
        body: `<div class="form-grid">
          <div class="form-row"><label>项目</label><select id="om-p">${editable.map((x) => `<option value="${x.id}">${x.name}</option>`).join("")}</select></div>
          <div class="form-row"><label>角色</label><select id="om-r"><option>项目经理</option><option>负责人</option><option>Co-Leader</option><option>财务</option><option>成员</option></select></div>
          <div class="form-row"><label>成员</label><select id="om-n">${D.members.map((m) => `<option>${m.name}</option>`).join("")}</select></div>
          <div class="form-row"><label>Domain</label><select id="om-d">${D.domains.map((d) => `<option>${d}</option>`).join("")}</select></div>
        </div>`,
        footer: `<button type="button" class="btn" data-modal-close>取消</button>
          <button type="button" class="btn btn-primary" id="om-save">保存</button>`,
        onReady: () => {
          $("#om-save").onclick = () => {
            D.orgMembers.unshift({
              id: "om" + Date.now(),
              projectId: $("#om-p").value,
              role: $("#om-r").value,
              name: $("#om-n").value,
              domain: $("#om-d").value,
            });
            closeModal();
            persist();
            toast("组织成员已添加");
            renderOrg();
          };
        },
      });
    });
    $("#add-ann")?.addEventListener("click", () => {
      const editable = D.projects.filter((x) => !x.sample);
      if (!editable.length) return toast("请先创建项目");
      if (!D.announcements) D.announcements = [];
      openModal({
        title: "发布公告",
        body: `<div class="form-grid">
          <div class="form-row"><label>项目</label><select id="an-p">${editable.map((x) => `<option value="${x.id}">${x.name}</option>`).join("")}</select></div>
          <div class="form-row"><label>紧急</label><select id="an-u"><option value="0">否</option><option value="1">是</option></select></div>
          <div class="form-row full"><label><span class="req">*</span>标题</label><input id="an-t" placeholder="公告标题" /></div>
          <div class="form-row full"><label><span class="req">*</span>内容</label><textarea id="an-c" rows="3"></textarea></div>
          <div class="form-row full"><label>协作链接（名称|URL，多行）</label>
            <textarea id="an-l" rows="2" placeholder="Jira|https://jira.example.com"></textarea></div>
        </div>`,
        footer: `<button type="button" class="btn" data-modal-close>取消</button>
          <button type="button" class="btn btn-primary" id="an-save">发布</button>`,
        onReady: () => {
          $("#an-save").onclick = () => {
            const title = ($("#an-t").value || "").trim();
            const content = ($("#an-c").value || "").trim();
            if (!title || !content) return toast("请填写标题与内容");
            const links = ($("#an-l").value || "")
              .split("\n")
              .map((line) => line.trim())
              .filter(Boolean)
              .map((line) => {
                const [name, url] = line.split("|");
                return { name: (name || "链接").trim(), url: (url || "#").trim() };
              });
            D.announcements.unshift({
              id: "an" + Date.now(),
              projectId: $("#an-p").value,
              title,
              content,
              urgent: $("#an-u").value === "1",
              links,
              createdAt: new Date().toISOString().slice(0, 16).replace("T", " "),
            });
            closeModal();
            persist();
            toast("公告已发布");
            renderOrg();
          };
        },
      });
    });
  }

  function renderClose() {
    const isAbort = state.closeView === "abort";
    const list = D.projects.filter((p) =>
      isAbort
        ? ["执行中", "阶段评审中", "已中止"].includes(p.status)
        : ["执行中", "阶段评审中", "验收审批中", "已结项"].includes(p.status)
    );
    formChrome({
      title: "结项 / 中止申请",
      views: [
        { id: "close", label: "结项申请" },
        { id: "abort", label: "中止申请" },
      ],
      activeView: state.closeView || "close",
      onView: (v) => {
        state.closeView = v;
        renderClose();
      },
      toolbar: stdToolbar({
        showAdd: false,
        hint: isAbort
          ? "在行内发起中止 → 待办审批 → 回写「已中止」"
          : "在行内发起结项 → 待办审批 → 回写「已结项」",
        searchId: "close-q",
        searchPlaceholder: "搜索项目",
      }),
      body: !list.length
        ? emptyForm(isAbort ? "暂无可中止项目。" : "暂无可结项项目。", null, null)
        : `<div class="table-wrap"><table class="data">
          <thead><tr><th>项目</th><th>编号</th><th>状态</th><th>阶段</th><th>PM</th><th>下一节点</th><th>说明</th><th>操作</th></tr></thead>
          <tbody>${list
            .map((p) => {
              let ops = "—";
              if (!isAbort && writable(p) && ["执行中", "阶段评审中"].includes(p.status)) {
                ops = `<button type="button" class="link-op" data-close="${p.id}">发起结项</button>`;
              } else if (!isAbort && writable(p) && p.status === "验收审批中") {
                ops = `<button type="button" class="link-op" data-go="todo">去待办审批</button>`;
              } else if (isAbort && writable(p) && ["执行中", "阶段评审中"].includes(p.status)) {
                ops = `<button type="button" class="link-op" data-abort="${p.id}">发起中止</button>`;
              } else if (p.status === "已结项" || p.status === "已中止") {
                ops = `<span class="muted">已回写</span>`;
              }
              return `<tr>
                <td>${p.name}</td><td class="muted">${p.code}</td>
                <td>${pillStatus(p.status)}</td><td>${p.stage || "—"}</td>
                <td>${p.pm}</td><td>${p.nextNode || "—"}</td>
                <td style="white-space:normal;max-width:220px;font-size:12px;color:var(--text3)">${p.remark || "—"}</td>
                <td class="ops">${ops}</td>
              </tr>`;
            })
            .join("")}</tbody></table></div>`,
    });
    $$("[data-close]").forEach((b) =>
      b.addEventListener("click", () => {
        openModal({
          title: "结项申请",
          body: `<div class="form-grid">
            <div class="form-row full"><label>关联项目</label><div class="master-ro">${project(b.dataset.close)?.name || ""}</div></div>
            <div class="form-row full"><label><span class="req">*</span>结项说明</label>
              <textarea id="close-remark" rows="3" placeholder="交付物、遗留项、验收结论…"></textarea></div>
          </div>
          <p class="muted" style="margin:12px 0 0">提交后进入待办审批，通过后回写项目状态为「已结项」。</p>`,
          footer: `
            <button type="button" class="btn" data-modal-close>取消</button>
            <button type="button" class="btn btn-primary" id="close-submit">提交</button>`,
          onReady: () => {
            $("#close-submit").onclick = () => {
              const remark = ($("#close-remark").value || "").trim();
              const p = project(b.dataset.close);
              if (p && remark) p.remark = remark;
              const r = F.startClose(b.dataset.close);
              closeModal();
              if (!r.ok) return toast(r.msg);
              stayAfterSubmit(r.msg);
            };
          },
        });
      })
    );
    $$("[data-abort]").forEach((b) =>
      b.addEventListener("click", () => {
        const p = project(b.dataset.abort);
        if (!p || !writable(p)) return toast("不可中止");
        openModal({
          title: "中止申请",
          body: `<div class="form-grid">
            <div class="form-row full"><label>关联项目</label><div class="master-ro">${p.name}</div></div>
            <div class="form-row full"><label><span class="req">*</span>中止原因</label>
              <textarea id="abort-remark" rows="3" placeholder="中止原因、影响范围…"></textarea></div>
          </div>`,
          footer: `
            <button type="button" class="btn" data-modal-close>取消</button>
            <button type="button" class="btn btn-primary" id="abort-submit">提交</button>`,
          onReady: () => {
            $("#abort-submit").onclick = () => {
              const remark = ($("#abort-remark").value || "").trim();
              if (!remark) return toast("请填写中止原因");
              const r = F.startAbort(p.id, remark);
              closeModal();
              if (!r.ok) return toast(r.msg);
              stayAfterSubmit(r.msg);
            };
          },
        });
      })
    );
    $$("[data-go]").forEach((b) => b.addEventListener("click", () => go(b.dataset.go)));
    $("#close-q")?.addEventListener("input", (e) => {
      const q = e.target.value.trim();
      $$(".form-sheet tbody tr").forEach((tr) => {
        tr.style.display = !q || tr.textContent.includes(q) ? "" : "none";
      });
    });
  }

  function renderContract() {
    setTop("收入合同", "");
    $("#view").innerHTML = `
      <div class="weak-note">本分组弱化占位，研发主线请使用项目启动 / 项目执行。</div>
      <div class="dash"><div class="panel"><div class="panel-h">合同</div>
      <div class="empty">暂无合同数据</div></div></div>`;
  }

  function renderMaster() {
    const tabs = [
      { id: "types", label: "项目类型", key: "projectTypes", where: "项目立项", hint: "立项表单「项目类型」选项", editable: true },
      { id: "status", label: "项目状态", key: "projectStatuses", where: "流程回写", hint: "由流程回写，一般不手改", editable: false },
      { id: "stages", label: "NPI 阶段", key: "stages", where: "项目 / 任务", hint: "阶段门禁与 Exit 对齐", editable: true },
      { id: "fee", label: "费用科目", key: "feeSubjects", where: "项目预算", hint: "预算与费用登记科目", editable: true },
      { id: "tpl", label: "计划模板", key: "planTemplates", where: "项目计划", hint: "计划弹窗可选模板", editable: true },
      { id: "domain", label: "路径/Domain", key: "domains", where: "任务 / Signoff", hint: "任务路径与 Signoff Domain", editable: true },
    ];
    if (!tabs.some((t) => t.id === state.masterView)) state.masterView = "types";
    const cur = tabs.find((t) => t.id === state.masterView) || tabs[0];
    const arr = D[cur.key] || [];
    const editing = state.masterEdit && cur.editable;

    const toolbar = editing
      ? stdToolbar({
          addId: "md-save",
          addLabel: "保存",
          secondary: `<button type="button" class="btn" id="md-cancel">取消</button><button type="button" class="btn" id="md-add-row">+ 添加</button>`,
          search: false,
        })
      : stdToolbar({
          addId: "md-add",
          addDisabled: !cur.editable,
          secondary: cur.editable
            ? `<button type="button" class="btn" id="md-edit">编辑</button><button type="button" class="btn" id="md-export">导出</button>`
            : "",
          searchId: "md-q",
          searchPlaceholder: "搜索数据",
        });

    // 对齐简道云普通表单：工具栏下方直接是数据表，无「字典说明」嵌套卡片
    const body = editing
      ? `<div class="table-wrap"><table class="data" id="md-edit-table">
          <thead><tr>
            <th style="width:48px"><input type="checkbox" disabled /></th>
            <th style="width:72px">序号</th>
            <th>名称</th>
            <th style="width:140px">引用位置</th>
            <th style="width:100px">操作</th>
          </tr></thead>
          <tbody>${arr
            .map(
              (x, i) => `<tr data-idx="${i}">
              <td><input type="checkbox" /></td>
              <td class="muted">${i + 1}</td>
              <td><input class="md-name cell-input" value="${String(x).replace(/"/g, "&quot;")}" /></td>
              <td class="muted">${cur.where}</td>
              <td class="ops"><button type="button" class="link-op md-del">删除</button></td>
            </tr>`
            )
            .join("")}</tbody>
        </table></div>`
      : !arr.length
        ? emptyForm("暂无数据，点击「+ 添加」创建选项。", "+ 添加", null)
        : `<div class="table-wrap"><table class="data">
          <thead><tr>
            <th style="width:48px"><input type="checkbox" id="md-ck-all" /></th>
            <th style="width:72px">序号</th>
            <th>名称</th>
            <th style="width:160px">引用位置</th>
            <th style="width:120px">操作</th>
          </tr></thead>
          <tbody>${arr
            .map(
              (x, i) => `<tr>
              <td><input type="checkbox" class="md-ck" data-i="${i}" /></td>
              <td class="muted">${i + 1}</td>
              <td><a href="javascript:;" class="md-row-edit" data-i="${i}">${x}</a></td>
              <td class="muted">${cur.where}</td>
              <td class="ops">${
                cur.editable
                  ? `<button type="button" class="link-op md-row-edit" data-i="${i}">编辑</button>`
                  : `<span class="muted">—</span>`
              }</td>
            </tr>`
            )
            .join("")}</tbody>
        </table></div>`;

    formChrome({
      title: "主数据维护",
      views: tabs.map(({ id, label }) => ({ id, label })),
      activeView: cur.id,
      onView: (v) => {
        state.masterView = v;
        state.masterEdit = false;
        renderMaster();
      },
      toolbar,
      body,
      onAdd: () => {
        if (!cur.editable) return;
        if (!state.masterEdit) state._masterSnap = { key: cur.key, arr: D[cur.key].slice() };
        state.masterEdit = true;
        D[cur.key].push("新选项");
        renderMaster();
      },
    });

    $("#md-edit")?.addEventListener("click", () => {
      if (!cur.editable) return toast("该字典由流程回写，仅可查看");
      state._masterSnap = { key: cur.key, arr: D[cur.key].slice() };
      state.masterEdit = true;
      renderMaster();
    });

    const filterRows = () => {
      const q = ($("#md-q")?.value || "").trim();
      $$(".form-sheet tbody tr").forEach((tr) => {
        const name = tr.querySelector("a, .md-name, td:nth-child(3)")?.textContent || "";
        tr.style.display = !q || name.includes(q) ? "" : "none";
      });
    };
    $("#md-q")?.addEventListener("input", filterRows);
    $("#md-export")?.addEventListener("click", () => toast("导出（演示）"));

    $("#md-add")?.addEventListener("click", () => {
      if (!cur.editable) return;
      if (!state.masterEdit) state._masterSnap = { key: cur.key, arr: D[cur.key].slice() };
      state.masterEdit = true;
      D[cur.key].push("新选项");
      renderMaster();
    });
    $("#md-add-row")?.addEventListener("click", () => {
      D[cur.key].push("");
      renderMaster();
      const inputs = $$("#md-edit-table .md-name");
      inputs[inputs.length - 1]?.focus();
    });
    $("#md-cancel")?.addEventListener("click", () => {
      if (state._masterSnap?.key === cur.key) D[cur.key] = state._masterSnap.arr.slice();
      state._masterSnap = null;
      state.masterEdit = false;
      renderMaster();
    });
    $("#md-save")?.addEventListener("click", () => {
      const next = $$("#md-edit-table .md-name")
        .map((inp) => (inp.value || "").trim())
        .filter(Boolean);
      if (!next.length) return toast("至少保留一个选项");
      D[cur.key] = next;
      state.masterEdit = false;
      state._masterSnap = null;
      persist();
      toast("已保存");
      renderMaster();
    });
    $$(".md-del").forEach((b) =>
      b.addEventListener("click", () => {
        const tr = b.closest("tr");
        const idx = Number(tr.dataset.idx);
        D[cur.key].splice(idx, 1);
        renderMaster();
      })
    );
    $$(".md-row-edit").forEach((b) =>
      b.addEventListener("click", (e) => {
        e.preventDefault();
        if (!cur.editable) return;
        if (!state.masterEdit) state._masterSnap = { key: cur.key, arr: D[cur.key].slice() };
        state.masterEdit = true;
        renderMaster();
        setTimeout(() => {
          const inp = $$(".md-name")[Number(b.dataset.i)];
          inp?.focus();
          inp?.select();
        }, 0);
      })
    );
  }

  /* ========== 简道云式居中弹窗 ========== */
  function openModal({ title, body, footer, foot, onReady, ready }) {
    $("#modal-title").textContent = title || "填写表单";
    $("#modal-body").innerHTML = body || "";
    $("#modal-foot").innerHTML = footer || foot || `<button type="button" class="btn" data-modal-close>关闭</button>`;
    $("#modal-mask").classList.add("open");
    $("#modal").classList.add("open");
    $$("[data-modal-close]").forEach((b) => (b.onclick = closeModal));
    (onReady || ready || (() => {}))();
  }

  function closeModal() {
    $("#modal-mask").classList.remove("open");
    $("#modal").classList.remove("open");
  }


  const STORE_KEY = "jy-rd-pm-v11-stage";
  const STORE_VER = 11;

  function persist() {
    try {
      sessionStorage.setItem(
        STORE_KEY,
        JSON.stringify({
          ver: STORE_VER,
          projects: D.projects,
          tasks: D.tasks,
          plans: D.plans,
          todos: D.todos,
          signoffItems: D.signoffItems,
          risks: D.risks,
          contracts: D.contracts,
          budgets: D.budgets,
          orgMembers: D.orgMembers,
          announcements: D.announcements,
          daci: D.daci,
          timeEntries: D.timeEntries,
          feeEntries: D.feeEntries,
          projectTypes: D.projectTypes,
          projectStatuses: D.projectStatuses,
          stages: D.stages,
          feeSubjects: D.feeSubjects,
          planTemplates: D.planTemplates,
          domains: D.domains,
          route: state.route,
          taskProjectId: state.taskProjectId,
          soProjectId: state.soProjectId,
          projId: state.projId,
        })
      );
    } catch (_) {}
  }

  function hydrate() {
    try {
      const raw = sessionStorage.getItem(STORE_KEY);
      if (!raw) return false;
      const o = JSON.parse(raw);
      if (!o || o.ver !== STORE_VER || !o.projects?.length) return false;
      D.projects = o.projects;
      D.tasks = o.tasks || [];
      D.plans = o.plans || [];
      D.todos = o.todos || [];
      D.signoffItems = o.signoffItems || [];
      D.risks = o.risks || [];
      D.contracts = o.contracts || [];
      D.budgets = o.budgets || {};
      D.orgMembers = o.orgMembers || [];
      D.announcements = o.announcements || [];
      D.daci = o.daci || [];
      D.timeEntries = o.timeEntries || [];
      D.feeEntries = o.feeEntries || [];
      if (o.projectTypes?.length) D.projectTypes = o.projectTypes;
      if (o.projectStatuses?.length) D.projectStatuses = o.projectStatuses;
      if (o.stages?.length) D.stages = o.stages;
      if (o.feeSubjects?.length) D.feeSubjects = o.feeSubjects;
      if (o.planTemplates?.length) D.planTemplates = o.planTemplates;
      if (o.domains?.length) D.domains = o.domains;
      if (o.taskProjectId) state.taskProjectId = o.taskProjectId;
      if (o.soProjectId) state.soProjectId = o.soProjectId;
      if (o.projId) state.projId = o.projId;
      return true;
    } catch (_) {
      return false;
    }
  }

  function init() {
    // 优先恢复会话，避免每次刷新全量 seed 卡顿
    if (!hydrate()) {
      F.seedDemoData();
      const rich =
        D.projects.find((p) => p.name === "项目代号-01") ||
        D.projects.find((p) => D.tasks.filter((t) => t.projectId === p.id).length >= 8) ||
        D.projects.find((p) => D.tasks.some((t) => t.projectId === p.id));
      if (rich) {
        state.taskProjectId = rich.id;
        state.soProjectId = rich.id;
        state.projId = rich.id;
      }
      persist();
    }
    let navTimer = 0;
    $("#nav-search").addEventListener("input", (e) => {
      state.navQ = e.target.value;
      clearTimeout(navTimer);
      navTimer = setTimeout(renderNav, 120);
    });
    $("#modal-close").onclick = closeModal;
    $("#modal-mask").onclick = closeModal;
    document.querySelectorAll("[data-route]").forEach((el) => {
      if (el.closest(".wf-strip")) {
        el.addEventListener("click", () => {
          if (el.dataset.route) go(el.dataset.route);
        });
      }
    });
    $$("[data-todo-link]").forEach((a) =>
      a.addEventListener("click", (e) => {
        e.preventDefault();
        go("todo");
      })
    );
    go("dash-home");
  }

  document.addEventListener("DOMContentLoaded", init);
})();
