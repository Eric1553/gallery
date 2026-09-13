/**
 * 简道云式流程回写（后台逻辑）
 * 不提供「剧本/向导」UI；只响应表单提交与待办审批。
 */
(function () {
  function D() {
    return window.APP_DATA;
  }

  function nowStr() {
    return new Date().toISOString().slice(0, 19).replace("T", " ");
  }

  function today() {
    return new Date().toISOString().slice(0, 10);
  }

  function uid(prefix) {
    return prefix + "-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  function project(id) {
    return D().projects.find((p) => p.id === id);
  }

  function addTodo(todo) {
    D().todos.unshift({
      id: uid("td"),
      status: "待办",
      createdAt: nowStr(),
      ...todo,
    });
  }

  function completeTodo(id) {
    const t = D().todos.find((x) => x.id === id);
    if (t) {
      t.status = "已办";
      t.doneAt = nowStr();
    }
  }

  function nextCode() {
    const n = D().projects.length + 1;
    return `JY-RD-2026-${String(n).padStart(4, "0")}`;
  }

  function nextName() {
    const n = D().projects.filter((p) => !p.sample).length + 1;
    return `项目代号-${String(n).padStart(2, "0")}`;
  }

  function buildProjectRow(fields, status) {
    return {
      id: uid("p"),
      code: fields.code || nextCode(),
      name: fields.name || nextName(),
      type: fields.type || D().projectTypes[0],
      status,
      stage: "",
      owner: fields.owner || "成员代号-PL",
      coleader: fields.coleader || "",
      pm: fields.pm || "成员代号-PM",
      planStart: fields.planStart || today(),
      planEnd: fields.planEnd || today(),
      nextNode: status === "立项审批中" ? "立项审批" : "提交立项",
      nextDate: today(),
      health: "正常",
      remark: fields.remark || "",
      flowStatus: status === "立项审批中" ? "进行中" : "未开始",
      sample: false,
    };
  }

  /** 暂存：流程未发起 */
  function createProject(fields) {
    const row = buildProjectRow(fields, "立项准备中");
    D().projects.unshift(row);
    return { ok: true, msg: "已暂存（立项准备中）", project: row };
  }

  /** 弹窗「提交」：创建并直接发起流程（对齐简道云流程表单） */
  function submitInitForm(fields) {
    const row = buildProjectRow(fields, "立项审批中");
    D().projects.unshift(row);
    addTodo({
      title: `审批：${row.name} 立项申请`,
      type: "立项审批",
      from: row.pm,
      projectId: row.id,
      action: "approve_init",
      refId: row.id,
    });
    return { ok: true, msg: "已提交立项，流程已发起", project: row, todoCreated: true };
  }

  /** 列表中对「立项准备中」记录再次提交 */
  function submitInit(projectId) {
    const p = project(projectId);
    if (!p) return { ok: false, msg: "项目不存在" };
    if (p.sample) return { ok: false, msg: "对照样例只读" };
    if (p.status !== "立项准备中") {
      return { ok: false, msg: `当前「${p.status}」，不能提交立项` };
    }
    p.status = "立项审批中";
    p.flowStatus = "进行中";
    p.nextNode = "立项审批";
    addTodo({
      title: `审批：${p.name} 立项申请`,
      type: "立项审批",
      from: p.pm,
      projectId: p.id,
      action: "approve_init",
      refId: p.id,
    });
    return { ok: true, msg: "已提交，流程已发起", todoCreated: true };
  }

  /** 计划模板 → 里程碑节点（手填前可一键带入，仍可改） */
  function templateNodes(template, p) {
    const start = (p && p.planStart) || today();
    const end = (p && p.planEnd) || today();
    const owner = (p && p.owner) || "成员代号-PL";
    const map = {
      NPI默认六阶段: [
        { wbs: "1", type: "里程碑任务", name: "里程碑-需求基线", owner, planStart: start, planEnd: start, path: "HWG", stage: "需求调研", exitType: "Go/NoGo Decision Meeting" },
        { wbs: "2", type: "里程碑任务", name: "里程碑-执行规划", owner, planStart: start, planEnd: start, path: "POG", stage: "执行规划", exitType: "" },
        { wbs: "3", type: "里程碑任务", name: "里程碑-BTO-SO", owner, planStart: start, planEnd: end, path: "HWG", stage: "设计实现", exitType: "BTO SO Exit Review" },
        { wbs: "4", type: "里程碑任务", name: "里程碑-ES", owner, planStart: end, planEnd: end, path: "PEG", stage: "产品验证", exitType: "ES Exit Review" },
        { wbs: "5", type: "里程碑任务", name: "里程碑-小批量试产", owner, planStart: end, planEnd: end, path: "PCG", stage: "小批量试产", exitType: "QS Exit Review" },
        { wbs: "6", type: "里程碑任务", name: "里程碑-大批量试产", owner, planStart: end, planEnd: end, path: "PCG", stage: "大批量试产", exitType: "" },
      ],
      自研简版: [
        { wbs: "1", type: "里程碑任务", name: "里程碑-需求调研", owner, planStart: start, planEnd: start, path: "SWG", stage: "需求调研", exitType: "" },
        { wbs: "2", type: "里程碑任务", name: "里程碑-设计实现", owner, planStart: start, planEnd: end, path: "SWG", stage: "设计实现", exitType: "" },
        { wbs: "3", type: "里程碑任务", name: "里程碑-产品验证", owner, planStart: end, planEnd: end, path: "SWG", stage: "产品验证", exitType: "" },
      ],
      技术服务简版: [
        { wbs: "1", type: "里程碑任务", name: "里程碑-服务启动", owner, planStart: start, planEnd: start, path: "POG", stage: "需求调研", exitType: "" },
        { wbs: "2", type: "里程碑任务", name: "里程碑-交付验收", owner, planStart: end, planEnd: end, path: "POG", stage: "产品验证", exitType: "" },
      ],
    };
    return (map[template] || map["自研简版"]).map((n) => ({ ...n }));
  }

  function emptyPlan(projectId, extras) {
    const p = project(projectId);
    return {
      id: uid("pl"),
      projectId,
      name: extras?.name || `计划-${p?.name || projectId}`,
      status: "进行中",
      template: extras?.template || "",
      nodes: extras?.nodes || [],
      flowStatus: "进行中",
      sample: false,
      createdAt: nowStr(),
    };
  }

  /** 立项通过 → 智能助手：生成空「项目计划」草稿（节点需人手填） */
  function ensurePlanDraft(projectId) {
    let plan = D().plans.find((pl) => pl.projectId === projectId);
    if (!plan) {
      plan = emptyPlan(projectId);
      D().plans.unshift(plan);
    }
    return plan;
  }

  function pushTask(row) {
    D().tasks.push({ sample: false, delayed: "正常推进", participants: "成员代号-PM", priority: "普通", ...row });
    return row.id;
  }

  function stageIndex(name) {
    const i = D().stages.indexOf(name);
    return i < 0 ? 0 : i;
  }

  /** 进度只由状态/子任务回写与阶段 Exit 计算，禁止手填百分比 */
  function leafProgressByStatus(status) {
    if (status === "已完成" || status === "已验收") return 100;
    if (status === "进行中") return 50;
    if (status === "已取消") return 0;
    return 0;
  }

  function recalcProjectTasks(projectId) {
    const tasks = D().tasks.filter((t) => t.projectId === projectId);
    const childrenOf = (id) => tasks.filter((t) => t.parentId === id);
    const memo = {};
    function calc(id) {
      if (memo[id] != null) return memo[id];
      const t = tasks.find((x) => x.id === id);
      if (!t) return 0;
      const kids = childrenOf(id).filter((k) => k.status !== "已取消");
      if (!kids.length) {
        t.progress = leafProgressByStatus(t.status);
        memo[id] = t.progress;
        return t.progress;
      }
      kids.forEach((k) => calc(k.id));
      const avg = Math.round(kids.reduce((s, k) => s + (k.progress || 0), 0) / kids.length);
      t.progress = avg;
      if (
        avg === 100 &&
        kids.every((k) => ["已验收", "已完成"].includes(k.status)) &&
        !["已完成", "已取消"].includes(t.status)
      ) {
        t.status = "已完成";
      } else if (avg > 0 && t.status === "未开始") {
        t.status = "进行中";
      }
      memo[id] = t.progress;
      return t.progress;
    }
    tasks.filter((t) => !t.parentId).forEach((t) => calc(t.id));
    const p = project(projectId);
    if (p) {
      const roots = tasks.filter((t) => !t.parentId && t.status !== "已取消");
      p.progressPct = roots.length
        ? Math.round(roots.reduce((s, t) => s + (t.progress || 0), 0) / roots.length)
        : 0;
    }
    return { ok: true };
  }


  /** 中止/结项等流程挂起时冻结执行操作 */
  function pendingFlowFreeze(projectId) {
    const p = project(projectId);
    if (p?.abortPending || p?.nextNode === "中止审批") {
      const has = D().todos.some((t) => t.status === "待办" && t.projectId === projectId && t.action === "approve_abort");
      if (has || p.abortPending) return "中止审批中，仅可查看进展";
    }
    const pend = D().todos.find(
      (t) =>
        t.status === "待办" &&
        t.projectId === projectId &&
        ["approve_abort", "approve_close"].includes(t.action)
    );
    if (!pend) return null;
    return pend.action === "approve_abort" ? "中止审批中，仅可查看进展" : "结项审批中，仅可查看进展";
  }

  /** 当前阶段内：未开始 → 进行中（开干），不改百分比 */
  function startWork(taskId) {
    const t = D().tasks.find((x) => x.id === taskId);
    if (!t) return { ok: false, msg: "任务不存在" };
    if (t.sample) return { ok: false, msg: "对照样例只读" };
    const p = project(t.projectId);
    if (!p) return { ok: false, msg: "项目不存在" };
    if (p.status === "阶段评审中") {
      return { ok: false, msg: "阶段评审中仅可查看进展，不可推进任务" };
    }
    const freeze = pendingFlowFreeze(p.id);
    if (freeze) return { ok: false, msg: freeze };
    if (p.status !== "执行中") {
      return { ok: false, msg: `项目「${p.status}」不可推进任务` };
    }
    if (stageIndex(t.stage) > stageIndex(p.stage)) {
      return { ok: false, msg: `任务属「${t.stage}」，当前项目阶段为「${p.stage}」，需先完成阶段 Exit` };
    }
    if (t.status !== "未开始") return { ok: false, msg: `当前「${t.status}」，无需开始` };
    t.status = "进行中";
    recalcProjectTasks(t.projectId);
    return { ok: true, msg: `已开始：${t.name}（进度由阶段推进与交付验收回写）` };
  }

  /** 可演示的丰满样例：多项目 + 多计划 + 多维任务树 + 待办 */
  function seedDemoData() {
    clearBusiness();

    const mk = (fields, patch) => {
      const r = createProject(fields);
      Object.assign(r.project, patch || {});
      return r.project;
    };

    const p1 = mk(
      {
        code: "JY-RD-2026-0001",
        name: "项目代号-01",
        type: "NPI产品研发项目",
        owner: "成员代号-PL",
        coleader: "成员代号-HW",
        pm: "成员代号-PM",
        planStart: "2026-06-01",
        planEnd: "2026-12-20",
      },
      {
        status: "执行中",
        stage: "设计实现",
        flowStatus: "已完成",
        nextNode: "里程碑-BTO-SO",
        nextDate: "2026-09-15",
        health: "正常",
      }
    );
    const p2 = mk(
      {
        code: "JY-RD-2026-0002",
        name: "项目代号-02",
        type: "自研项目",
        owner: "成员代号-PL",
        coleader: "成员代号-SW",
        pm: "成员代号-PM",
        planStart: "2026-08-01",
        planEnd: "2026-11-30",
      },
      {
        status: "立项审批中",
        stage: "需求调研",
        flowStatus: "进行中",
        nextNode: "立项审批",
      }
    );
    addTodo({
      title: `审批：${p2.name} 立项申请`,
      type: "立项审批",
      from: p2.pm,
      projectId: p2.id,
      action: "approve_init",
      refId: p2.id,
    });

    const p3 = mk(
      {
        code: "JY-RD-2026-0003",
        name: "项目代号-03",
        type: "NPI产品研发项目",
        owner: "成员代号-PL",
        coleader: "成员代号-HW",
        pm: "成员代号-PM",
        planStart: "2026-07-01",
        planEnd: "2026-11-30",
      },
      {
        status: "执行中",
        stage: "需求调研",
        flowStatus: "已完成",
        nextNode: "填写项目计划",
      }
    );
    const pl3 = ensurePlanDraft(p3.id);
    pl3.name = "计划-项目代号-03";
    pl3.template = "";
    pl3.nodes = [];
    pl3.status = "进行中";
    addTodo({
      title: `填写：${p3.name} 项目计划（里程碑节点）`,
      type: "项目计划",
      from: "系统",
      projectId: p3.id,
      action: "fill_plan",
      refId: pl3.id,
    });

    const p4 = mk(
      {
        code: "JY-RD-2026-0004",
        name: "项目代号-04",
        type: "NPI产品研发项目",
        owner: "成员代号-PL",
        coleader: "成员代号-HW",
        pm: "成员代号-PM",
        planStart: "2026-05-01",
        planEnd: "2026-10-30",
      },
      {
        status: "阶段评审中",
        stage: "产品验证",
        flowStatus: "进行中",
        nextNode: "Exit Review 审批",
        nextDate: "2026-08-18",
        health: "风险",
        remark: "ES Exit 已提交，待审批",
      }
    );
    addTodo({
      title: `审批：${p4.name} 阶段 Exit Review`,
      type: "阶段Exit",
      from: p4.pm,
      projectId: p4.id,
      action: "approve_exit",
      refId: p4.id,
    });
    const p5 = mk(
      {
        code: "JY-RD-2026-0005",
        name: "项目代号-05",
        type: "技术服务项目",
        owner: "成员代号-PL",
        coleader: "",
        pm: "成员代号-PM",
        planStart: "2026-03-01",
        planEnd: "2026-08-20",
      },
      {
        status: "执行中",
        stage: "设计实现",
        flowStatus: "已完成",
        nextNode: "里程碑-交付验收",
      }
    );
    const p6 = mk(
      {
        code: "JY-RD-2026-0006",
        name: "项目代号-06",
        type: "产学研项目",
        owner: "成员代号-PL",
        coleader: "成员代号-SW",
        pm: "成员代号-PM",
        planStart: "2025-10-01",
        planEnd: "2026-06-01",
      },
      { status: "已结项", stage: "大批量试产", flowStatus: "已完成", nextNode: "—" }
    );
    mk(
      {
        code: "JY-RD-2026-0007",
        name: "项目代号-07",
        type: "其他",
        owner: "成员代号-PL",
        pm: "成员代号-PM",
        planStart: "2026-08-01",
        planEnd: "2026-09-30",
      },
      { status: "立项准备中", flowStatus: "未开始", nextNode: "提交立项" }
    );

    // —— 计划：多条、多状态、带节点 ——
    const pl1Nodes = templateNodes("NPI默认六阶段", p1);
    const pl1 = emptyPlan(p1.id, {
      name: "计划-项目代号-01",
      template: "NPI默认六阶段",
      nodes: pl1Nodes,
    });
    pl1.status = "已完成";
    pl1.flowStatus = "已完成";
    D().plans.unshift(pl1);

    const pl5Nodes = templateNodes("技术服务简版", p5);
    const pl5 = emptyPlan(p5.id, {
      name: "计划-项目代号-05",
      template: "技术服务简版",
      nodes: pl5Nodes,
    });
    pl5.status = "已完成";
    pl5.flowStatus = "已完成";
    D().plans.push(pl5);

    const pl4 = emptyPlan(p4.id, {
      name: "计划-项目代号-04",
      template: "NPI默认六阶段",
      nodes: templateNodes("NPI默认六阶段", p4).slice(0, 4),
    });
    pl4.status = "已完成";
    pl4.flowStatus = "已完成";
    D().plans.push(pl4);

    const pl6 = emptyPlan(p6.id, {
      name: "计划-项目代号-06",
      template: "自研简版",
      nodes: templateNodes("自研简版", p6),
    });
    pl6.status = "已完成";
    pl6.flowStatus = "已完成";
    D().plans.push(pl6);

    // —— 任务树：p1 丰满（WBS/看板/甘特可演示）——
    const t1 = uid("t");
    const t11 = uid("t");
    const t12 = uid("t");
    const t2 = uid("t");
    const t21 = uid("t");
    const t22 = uid("t");
    const t3 = uid("t");
    const t31 = uid("t");
    const t32 = uid("t");
    const t4 = uid("t");
    pushTask({ id: t1, projectId: p1.id, wbs: "1", parentId: null, type: "里程碑任务", name: "里程碑-需求基线", path: "HWG", stage: "需求调研", status: "已完成", progress: 100, owner: "成员代号-HW", planStart: "2026-06-01", planEnd: "2026-06-30", critical: true, exitType: "Go/NoGo Decision Meeting", priority: "最高" });
    pushTask({ id: t11, projectId: p1.id, wbs: "1.1", parentId: t1, type: "子任务", name: "任务代号-需求基线冻结", path: "HWG", stage: "需求调研", status: "已验收", progress: 100, owner: "成员代号-HW", planStart: "2026-06-01", planEnd: "2026-06-15", critical: false });
    pushTask({ id: t12, projectId: p1.id, wbs: "1.2", parentId: t1, type: "子任务", name: "任务代号-规格评审", path: "SWG", stage: "需求调研", status: "已完成", progress: 100, owner: "成员代号-SW", planStart: "2026-06-10", planEnd: "2026-06-28", critical: false });
    pushTask({ id: t2, projectId: p1.id, wbs: "2", parentId: null, type: "里程碑任务", name: "里程碑-执行规划", path: "POG", stage: "执行规划", status: "已完成", progress: 100, owner: "成员代号-PM", planStart: "2026-07-01", planEnd: "2026-07-20", critical: true });
    pushTask({ id: t21, projectId: p1.id, wbs: "2.1", parentId: t2, type: "子任务", name: "任务代号-资源排程", path: "POG", stage: "执行规划", status: "已验收", progress: 100, owner: "成员代号-PM", planStart: "2026-07-01", planEnd: "2026-07-12", critical: false });
    pushTask({ id: t22, projectId: p1.id, wbs: "2.2", parentId: t2, type: "子任务", name: "任务代号-风险识别", path: "POG", stage: "执行规划", status: "已完成", progress: 100, owner: "成员代号-S01", planStart: "2026-07-08", planEnd: "2026-07-18", critical: false });
    pushTask({ id: t3, projectId: p1.id, wbs: "3", parentId: null, type: "里程碑任务", name: "里程碑-BTO-SO", path: "HWG", stage: "设计实现", status: "进行中", progress: 62, owner: "成员代号-HW", planStart: "2026-08-01", planEnd: "2026-09-15", critical: true, exitType: "BTO SO Exit Review", priority: "最高", delayed: "正常推进" });
    pushTask({ id: t31, projectId: p1.id, wbs: "3.1", parentId: t3, type: "子任务", name: "任务代号-RTL-Review", path: "SWG", stage: "设计实现", status: "进行中", progress: 45, owner: "成员代号-S01", planStart: "2026-08-05", planEnd: "2026-08-28", critical: false });
    pushTask({ id: t32, projectId: p1.id, wbs: "3.2", parentId: t3, type: "子任务", name: "任务代号-Signoff-开签准备", path: "POG", stage: "设计实现", status: "进行中", progress: 70, owner: "成员代号-PM", planStart: "2026-07-20", planEnd: "2026-08-05", critical: true, delayed: "已延期", priority: "最高", exitType: "MRA" });
    pushTask({ id: t4, projectId: p1.id, wbs: "4", parentId: null, type: "里程碑任务", name: "里程碑-ES", path: "PEG", stage: "产品验证", status: "未开始", progress: 0, owner: "成员代号-HW", planStart: "2026-09-20", planEnd: "2026-10-15", critical: true, exitType: "ES Exit Review", priority: "较高" });
    pushTask({ id: uid("t"), projectId: p1.id, wbs: "4.1", parentId: t4, type: "子任务", name: "任务代号-验证用例准备", path: "PEG", stage: "产品验证", status: "未开始", progress: 0, owner: "成员代号-S02", planStart: "2026-09-20", planEnd: "2026-10-05", critical: false });
    pushTask({ id: uid("t"), projectId: p1.id, wbs: "4.2", parentId: t4, type: "子任务", name: "任务代号-ES报告", path: "PEG", stage: "产品验证", status: "未开始", progress: 0, owner: "成员代号-HW", planStart: "2026-10-01", planEnd: "2026-10-15", critical: false });
    const t5 = uid("t");
    pushTask({ id: t5, projectId: p1.id, wbs: "5", parentId: null, type: "里程碑任务", name: "里程碑-小批量试产", path: "PCG", stage: "小批量试产", status: "未开始", progress: 0, owner: "成员代号-HW", planStart: "2026-10-20", planEnd: "2026-11-15", critical: true, exitType: "QS Exit Review" });
    pushTask({ id: uid("t"), projectId: p1.id, wbs: "5.1", parentId: t5, type: "子任务", name: "任务代号-试产物料齐套", path: "PCG", stage: "小批量试产", status: "未开始", progress: 0, owner: "成员代号-S02", planStart: "2026-10-20", planEnd: "2026-11-01", critical: false });
    pushTask({ id: uid("t"), projectId: p1.id, wbs: "5.2", parentId: t5, type: "子任务", name: "任务代号-试产问题闭环", path: "PCG", stage: "小批量试产", status: "未开始", progress: 0, owner: "成员代号-HW", planStart: "2026-11-01", planEnd: "2026-11-15", critical: false });
    const t6 = uid("t");
    pushTask({ id: t6, projectId: p1.id, wbs: "6", parentId: null, type: "里程碑任务", name: "里程碑-大批量试产", path: "PCG", stage: "大批量试产", status: "未开始", progress: 0, owner: "成员代号-PL", planStart: "2026-11-20", planEnd: "2026-12-20", critical: true, exitType: "PS Exit Review" });
    pushTask({ id: uid("t"), projectId: p1.id, wbs: "6.1", parentId: t6, type: "子任务", name: "任务代号-产能爬坡", path: "PCG", stage: "大批量试产", status: "未开始", progress: 0, owner: "成员代号-HW", planStart: "2026-11-20", planEnd: "2026-12-10", critical: false });
    pushTask({ id: uid("t"), projectId: p1.id, wbs: "6.2", parentId: t6, type: "子任务", name: "任务代号-量产移交", path: "PCG", stage: "大批量试产", status: "未开始", progress: 0, owner: "成员代号-PL", planStart: "2026-12-05", planEnd: "2026-12-20", critical: false });
    // 结项任务：对齐简道云 DEMO 的 WBS=7「项目总结与文档归档」
    const t7 = uid("t");
    pushTask({ id: t7, projectId: p1.id, wbs: "7", parentId: null, type: "里程碑任务", name: "里程碑-结项归档", path: "POG", stage: "大批量试产", status: "未开始", progress: 0, owner: "成员代号-PM", planStart: "2026-12-15", planEnd: "2026-12-28", critical: true, exitType: "NPI结项" });
    pushTask({ id: uid("t"), projectId: p1.id, wbs: "7.1", parentId: t7, type: "子任务", name: "任务代号-项目总结", path: "POG", stage: "大批量试产", status: "未开始", progress: 0, owner: "成员代号-PM", planStart: "2026-12-15", planEnd: "2026-12-22", critical: false });
    pushTask({ id: uid("t"), projectId: p1.id, wbs: "7.2", parentId: t7, type: "子任务", name: "任务代号-文档归档", path: "POG", stage: "大批量试产", status: "未开始", progress: 0, owner: "成员代号-S01", planStart: "2026-12-18", planEnd: "2026-12-28", critical: false });

    // p4 阶段评审中任务
    const t41 = uid("t");
    pushTask({ id: t41, projectId: p4.id, wbs: "1", parentId: null, type: "里程碑任务", name: "里程碑-ES-验证", path: "HWG", stage: "产品验证", status: "进行中", progress: 80, owner: "成员代号-HW", planStart: "2026-07-15", planEnd: "2026-08-18", critical: true, exitType: "ES Exit Review", priority: "最高" });
    pushTask({ id: uid("t"), projectId: p4.id, wbs: "1.1", parentId: t41, type: "子任务", name: "任务代号-QS准备", path: "SWG", stage: "产品验证", status: "未开始", progress: 0, owner: "成员代号-SW", planStart: "2026-08-20", planEnd: "2026-09-30", critical: true });
    pushTask({ id: uid("t"), projectId: p4.id, wbs: "1.2", parentId: t41, type: "子任务", name: "任务代号-验证报告", path: "PEG", stage: "产品验证", status: "进行中", progress: 55, owner: "成员代号-S01", planStart: "2026-08-01", planEnd: "2026-08-16", critical: false });

    // p5 技术服务（加厚，避免筛选到此项目时看板/WBS 过空）
    const t51 = uid("t");
    const t52 = uid("t");
    const t53 = uid("t");
    pushTask({ id: t51, projectId: p5.id, wbs: "1", parentId: null, type: "里程碑任务", name: "里程碑-服务启动", path: "POG", stage: "需求调研", status: "已完成", progress: 100, owner: "成员代号-PM", planStart: "2026-03-01", planEnd: "2026-03-20", critical: true });
    pushTask({ id: uid("t"), projectId: p5.id, wbs: "1.1", parentId: t51, type: "子任务", name: "任务代号-现场调研", path: "POG", stage: "需求调研", status: "已验收", progress: 100, owner: "成员代号-S02", planStart: "2026-03-01", planEnd: "2026-03-15", critical: false });
    pushTask({ id: uid("t"), projectId: p5.id, wbs: "1.2", parentId: t51, type: "子任务", name: "任务代号-范围确认", path: "POG", stage: "需求调研", status: "已完成", progress: 100, owner: "成员代号-PL", planStart: "2026-03-10", planEnd: "2026-03-20", critical: false });
    pushTask({ id: t52, projectId: p5.id, wbs: "2", parentId: null, type: "里程碑任务", name: "里程碑-方案设计", path: "SWG", stage: "设计实现", status: "已完成", progress: 100, owner: "成员代号-SW", planStart: "2026-04-01", planEnd: "2026-05-15", critical: true });
    pushTask({ id: uid("t"), projectId: p5.id, wbs: "2.1", parentId: t52, type: "子任务", name: "任务代号-架构评审", path: "SWG", stage: "设计实现", status: "已验收", progress: 100, owner: "成员代号-S01", planStart: "2026-04-01", planEnd: "2026-04-20", critical: false });
    pushTask({ id: uid("t"), projectId: p5.id, wbs: "2.2", parentId: t52, type: "子任务", name: "任务代号-接口联调", path: "SWG", stage: "设计实现", status: "已完成", progress: 100, owner: "成员代号-S02", planStart: "2026-04-15", planEnd: "2026-05-10", critical: false });
    pushTask({ id: t53, projectId: p5.id, wbs: "3", parentId: null, type: "里程碑任务", name: "里程碑-交付验收", path: "POG", stage: "产品验证", status: "进行中", progress: 40, owner: "成员代号-PL", planStart: "2026-07-01", planEnd: "2026-08-20", critical: true, exitType: "Service Exit" });
    pushTask({ id: uid("t"), projectId: p5.id, wbs: "3.1", parentId: t53, type: "子任务", name: "任务代号-UAT用例", path: "PEG", stage: "产品验证", status: "进行中", progress: 55, owner: "成员代号-S02", planStart: "2026-07-01", planEnd: "2026-07-25", critical: false });
    pushTask({ id: uid("t"), projectId: p5.id, wbs: "3.2", parentId: t53, type: "子任务", name: "任务代号-培训交付", path: "POG", stage: "产品验证", status: "未开始", progress: 0, owner: "成员代号-PM", planStart: "2026-08-01", planEnd: "2026-08-15", critical: false });
    pushTask({ id: uid("t"), projectId: p5.id, wbs: "3.3", parentId: t53, type: "子任务", name: "任务代号-运维移交", path: "POG", stage: "产品验证", status: "未开始", progress: 0, owner: "成员代号-S01", planStart: "2026-08-10", planEnd: "2026-08-20", critical: false });
    const t54 = uid("t");
    pushTask({ id: t54, projectId: p5.id, wbs: "4", parentId: null, type: "里程碑任务", name: "里程碑-结项归档", path: "POG", stage: "大批量试产", status: "未开始", progress: 0, owner: "成员代号-PM", planStart: "2026-08-21", planEnd: "2026-08-30", critical: true, exitType: "服务结项" });
    pushTask({ id: uid("t"), projectId: p5.id, wbs: "4.1", parentId: t54, type: "子任务", name: "任务代号-项目总结", path: "POG", stage: "大批量试产", status: "未开始", progress: 0, owner: "成员代号-PM", planStart: "2026-08-21", planEnd: "2026-08-26", critical: false });
    pushTask({ id: uid("t"), projectId: p5.id, wbs: "4.2", parentId: t54, type: "子任务", name: "任务代号-文档归档", path: "POG", stage: "大批量试产", status: "未开始", progress: 0, owner: "成员代号-S01", planStart: "2026-08-25", planEnd: "2026-08-30", critical: false });

    // p1 再补几条，撑满状态看板各列
    pushTask({ id: uid("t"), projectId: p1.id, wbs: "3.3", parentId: t3, type: "子任务", name: "任务代号-功耗评估", path: "HWG", stage: "设计实现", status: "未开始", progress: 0, owner: "成员代号-HW", planStart: "2026-08-20", planEnd: "2026-09-05", critical: false });
    pushTask({ id: uid("t"), projectId: p1.id, wbs: "3.4", parentId: t3, type: "子任务", name: "任务代号-旧方案废弃", path: "SWG", stage: "设计实现", status: "已取消", progress: 0, owner: "成员代号-S02", planStart: "2026-08-01", planEnd: "2026-08-10", critical: false });

    recalcProjectTasks(p1.id);
    recalcProjectTasks(p4.id);
    recalcProjectTasks(p5.id);

    // Signoff：多项目预填（按规则录入结果，不靠「生成」按钮）
    seedSignoff(p1.id, { touchNext: false });
    seedSignoff(p4.id, { touchNext: false });
    seedSignoff(p5.id, { touchNext: false });
    D().signoffItems.filter((s) => s.projectId === p1.id).forEach((s, i) => {
      if (i === 0) {
        s.check = "Completed";
        s.approval = "Approved";
      } else if (i === 1) {
        s.check = "Completed";
        s.approval = "Pending";
      } else if (i === 2) {
        s.check = "Completed with waive";
        s.approval = "Approved";
      }
    });
    D().signoffItems.filter((s) => s.projectId === p4.id).forEach((s, i) => {
      if (i < 2) {
        s.check = "Completed";
        s.approval = i === 0 ? "Approved" : "Pending";
      }
    });

    D().risks.push({
      id: uid("r"),
      projectId: p1.id,
      type: "风险",
      dimension: "进度",
      desc: "风险代号-RK01：关键里程碑临近，Signoff 完成率待提升",
      level: "高",
      status: "进行中",
      owner: "成员代号-PM",
      eta: "2026-08-20",
      sample: false,
    });
    D().risks.push({
      id: uid("r"),
      projectId: p4.id,
      type: "问题",
      dimension: "质量",
      desc: "问题代号-IS01：Exit Review 前置 Approve 未达阈值",
      level: "中",
      status: "待处理",
      owner: "成员代号-HW",
      eta: "2026-08-18",
      sample: false,
    });
    D().risks.push({
      id: uid("r"),
      projectId: p5.id,
      type: "风险",
      dimension: "资源",
      desc: "风险代号-RK02：交付窗口临近，培训资源需锁定",
      level: "中",
      status: "进行中",
      owner: "成员代号-PM",
      eta: "2026-08-12",
      sample: false,
    });

    D().budgets[p1.id] = {
      manMonthPlan: 120,
      manMonthActual: 78,
      feePlan: 860,
      feeActual: 612,
      subjects: D().feeSubjects.map((name, i) => ({
        name,
        plan: [120, 80, 200, 90, 40, 70, 150, 80, 30][i] || 20,
        actual: [98, 60, 180, 70, 22, 55, 90, 30, 7][i] || 5,
      })),
    };
    D().budgets[p5.id] = {
      manMonthPlan: 36,
      manMonthActual: 28,
      feePlan: 180,
      feeActual: 142,
      subjects: D().feeSubjects.map((name, i) => ({
        name,
        plan: [40, 20, 30, 20, 10, 15, 25, 10, 10][i] || 8,
        actual: [36, 18, 28, 16, 6, 12, 18, 6, 2][i] || 4,
      })),
    };
    D().budgets[p4.id] = {
      manMonthPlan: 90,
      manMonthActual: 72,
      feePlan: 520,
      feeActual: 468,
      subjects: D().feeSubjects.map((name, i) => ({
        name,
        plan: [80, 50, 120, 60, 30, 40, 80, 40, 20][i] || 15,
        actual: [70, 48, 110, 55, 22, 35, 70, 38, 20][i] || 12,
      })),
    };

    D().orgMembers = [
      { id: uid("om"), projectId: p1.id, role: "项目经理", name: "成员代号-PM", domain: "POG" },
      { id: uid("om"), projectId: p1.id, role: "负责人", name: "成员代号-PL", domain: "HWG" },
      { id: uid("om"), projectId: p1.id, role: "Co-Leader", name: "成员代号-HW", domain: "HWG" },
      { id: uid("om"), projectId: p1.id, role: "财务", name: "成员代号-FIN", domain: "POG" },
      { id: uid("om"), projectId: p5.id, role: "项目经理", name: "成员代号-PM", domain: "POG" },
      { id: uid("om"), projectId: p5.id, role: "负责人", name: "成员代号-PL", domain: "SWG" },
    ];
    D().announcements = [
      {
        id: uid("an"),
        projectId: p1.id,
        title: "公告-阶段Exit窗口提醒",
        content: "本周完成 BTO SO Exit Review 材料冻结；协作链接见下方。",
        urgent: true,
        links: [
          { name: "Jira", url: "https://jira.example.com" },
          { name: "Confluence", url: "https://wiki.example.com" },
        ],
        createdAt: "2026-08-04 10:00",
      },
      {
        id: uid("an"),
        projectId: p5.id,
        title: "公告-结项资料清单",
        content: "请提交总结报告与归档清单，链接预留 Redmine / Git。",
        urgent: false,
        links: [
          { name: "Redmine", url: "https://redmine.example.com" },
          { name: "Git", url: "https://git.example.com" },
        ],
        createdAt: "2026-08-03 15:20",
      },
    ];
    D().daci = [
      { id: uid("dc"), projectId: p1.id, item: "功耗基线冻结", D: "成员代号-HW", A: "成员代号-PL", C: "成员代号-PM", I: "成员代号-S01" },
      { id: uid("dc"), projectId: p1.id, item: "验证用例放行", D: "成员代号-SW", A: "成员代号-PL", C: "成员代号-HW", I: "成员代号-PM" },
      { id: uid("dc"), projectId: p5.id, item: "结项文档归档", D: "成员代号-PM", A: "成员代号-PL", C: "成员代号-FIN", I: "成员代号-S02" },
    ];
    D().timeEntries = [];
    D().feeEntries = [];

    // 结项演示：项目代号-05 处于可结项；另备一条已在审批中
    p5.remark = "交付验收进行中，可发起结项申请";
    const pClose = mk(
      {
        code: "JY-RD-2026-0008",
        name: "项目代号-08",
        type: "技术服务项目",
        owner: "成员代号-PL",
        coleader: "",
        pm: "成员代号-PM",
        planStart: "2025-11-01",
        planEnd: "2026-07-31",
      },
      {
        status: "验收审批中",
        stage: "产品验证",
        flowStatus: "进行中",
        nextNode: "结项审批",
        remark: "结项申请已提交，待审批回写",
      }
    );
    addTodo({
      title: `审批：${pClose.name} 结项申请`,
      type: "结项审批",
      from: pClose.pm,
      projectId: pClose.id,
      action: "approve_close",
      refId: pClose.id,
    });

    return {
      ok: true,
      msg: `演示数据就绪：${D().projects.length} 项目 / ${D().plans.length} 计划 / ${D().tasks.length} 任务 / ${D().signoffItems.length} Signoff`,
    };
  }

  function approveInit(todo) {
    const p = project(todo.refId || todo.projectId);
    if (!p) return { ok: false, msg: "项目不存在" };
    if (p.status !== "立项审批中") return { ok: false, msg: "不在立项审批中" };
    p.status = "执行中";
    p.stage = "需求调研";
    p.flowStatus = "已完成";
    p.nextNode = "填写项目计划";
    completeTodo(todo.id);
    const plan = ensurePlanDraft(p.id);
    addTodo({
      title: `填写：${p.name} 项目计划（里程碑节点）`,
      type: "项目计划",
      from: "系统",
      projectId: p.id,
      action: "fill_plan",
      refId: plan.id,
    });
    return { ok: true, msg: "立项通过 → 已生成项目计划草稿，请填写里程碑节点" };
  }

  function savePlan(payload) {
    const p = project(payload.projectId);
    if (!p) return { ok: false, msg: "请选择关联项目" };
    if (p.sample) return { ok: false, msg: "对照样例只读" };
    let plan = payload.id ? D().plans.find((x) => x.id === payload.id) : null;
    if (!plan) {
      plan = emptyPlan(payload.projectId);
      D().plans.unshift(plan);
    }
    if (["审批中", "已完成"].includes(plan.status) && !payload.force) {
      return { ok: false, msg: `计划「${plan.status}」，不可暂存` };
    }
    plan.projectId = payload.projectId;
    plan.name = payload.name || plan.name;
    plan.template = payload.template || "";
    plan.nodes = (payload.nodes || []).map((n, i) => ({
      wbs: n.wbs || String(i + 1),
      type: n.type || "里程碑任务",
      name: n.name || "",
      owner: n.owner || p.owner,
      planStart: n.planStart || p.planStart,
      planEnd: n.planEnd || p.planEnd,
      path: n.path || "HWG",
      stage: n.stage || p.stage || "需求调研",
      exitType: n.exitType || "",
    }));
    plan.status = "进行中";
    plan.flowStatus = "进行中";
    return { ok: true, msg: "计划已暂存", plan };
  }

  function submitPlan(payload) {
    const saved = savePlan({ ...payload, force: true });
    if (!saved.ok) return saved;
    const plan = saved.plan;
    if (!plan.nodes.length) return { ok: false, msg: "请至少填写一条计划节点（里程碑）" };
    if (plan.nodes.some((n) => !n.name.trim())) return { ok: false, msg: "存在未命名的计划节点" };
    plan.status = "审批中";
    plan.flowStatus = "进行中";
    const p = project(plan.projectId);
    if (p) p.nextNode = "计划审批";
    // 办结「填写计划」类待办
    D().todos
      .filter((t) => t.status === "待办" && t.action === "fill_plan" && t.refId === plan.id)
      .forEach((t) => completeTodo(t.id));
    addTodo({
      title: `审批：${p?.name || ""} 项目计划`,
      type: "计划审批",
      from: p?.pm || "成员代号-PM",
      projectId: plan.projectId,
      action: "approve_plan",
      refId: plan.id,
    });
    return { ok: true, msg: "计划已提交审批", plan, todoCreated: true };
  }

  /** 计划审批通过 → 智能助手：里程碑节点同步到任务管理 */
  function approvePlan(todo) {
    const plan = D().plans.find((x) => x.id === todo.refId);
    if (!plan) return { ok: false, msg: "计划不存在" };
    const p = project(plan.projectId);
    if (!p) return { ok: false, msg: "项目不存在" };
    plan.status = "已完成";
    plan.flowStatus = "已完成";
    p.stage = plan.nodes[0]?.stage || "执行规划";
    p.nextNode = plan.nodes.find((n) => n.type === "里程碑任务")?.name || "任务推进";

    // 仅同步「尚未同步」的节点；保留用户后续在任务管理加的子任务
    const existing = D().tasks.filter((t) => t.projectId === plan.projectId);
    const existingNames = new Set(existing.map((t) => t.wbs + "|" + t.name));
    let added = 0;
    plan.nodes.forEach((n) => {
      const key = n.wbs + "|" + n.name;
      if (existingNames.has(key)) return;
      D().tasks.push({
        id: uid("t"),
        projectId: plan.projectId,
        wbs: n.wbs,
        parentId: null,
        type: n.type || "里程碑任务",
        name: n.name,
        path: n.path || "HWG",
        stage: n.stage || "",
        status: "未开始",
        progress: 0,
        owner: n.owner || p.owner,
        participants: p.pm,
        planStart: n.planStart || p.planStart,
        planEnd: n.planEnd || p.planEnd,
        delayed: "正常推进",
        critical: (n.type || "里程碑任务") === "里程碑任务",
        exitType: n.exitType || "",
        priority: "较高",
        sample: false,
        fromPlanId: plan.id,
      });
      added++;
    });
    completeTodo(todo.id);
    return { ok: true, msg: `计划通过，已同步 ${added} 条节点到任务管理` };
  }

  /** @deprecated 保留别名，避免旧调用；请用 submitPlan/approvePlan */
  function confirmPlan(projectId) {
    const plan = D().plans.find((pl) => pl.projectId === projectId);
    if (!plan) return { ok: false, msg: "请先在项目计划中填写里程碑节点并提交" };
    if (plan.status === "已完成") return { ok: false, msg: "计划已完成" };
    return submitPlan({
      id: plan.id,
      projectId,
      name: plan.name,
      template: plan.template,
      nodes: plan.nodes,
    });
  }

  /** @deprecated 禁止手填%；保留入口仅转发「开始执行」以免旧调用误用 */
  function submitProgress(taskId) {
    return startWork(taskId);
  }

  function approveProgress(todo) {
    completeTodo(todo.id);
    return { ok: true, msg: "进度已改为阶段推进模式，无需百分比审批" };
  }

  function submitAccept(taskId) {
    const t = D().tasks.find((x) => x.id === taskId);
    if (!t) return { ok: false, msg: "任务不存在" };
    if (t.sample) return { ok: false, msg: "对照样例只读" };
    if (t.type === "里程碑任务") {
      return { ok: false, msg: "里程碑请走「阶段 Exit Review」，不要对里程碑做任务验收" };
    }
    const p = project(t.projectId);
    if (!p) return { ok: false, msg: "项目不存在" };
    if (p.status === "阶段评审中") {
      return { ok: false, msg: "阶段评审中仅可查看进展，不可提交交付验收" };
    }
    {
      const freeze = pendingFlowFreeze(p.id);
      if (freeze) return { ok: false, msg: freeze };
    }
    if (stageIndex(t.stage) > stageIndex(p.stage)) {
      return { ok: false, msg: `任务属「${t.stage}」，当前阶段「${p.stage}」，不可验收` };
    }
    if (t.status === "未开始") {
      const sw = startWork(taskId);
      if (!sw.ok) return sw;
    }
    if (!["进行中"].includes(t.status) && t.status !== "未开始") {
      if (["已验收", "已完成"].includes(t.status)) return { ok: false, msg: "已验收/已完成" };
    }
    if (t.status !== "进行中") return { ok: false, msg: "请先「开始执行」再提交交付验收" };
    addTodo({
      title: `审批：任务交付验收 · ${t.name}`,
      type: "任务验收",
      from: t.owner,
      projectId: t.projectId,
      action: "approve_accept",
      refId: taskId,
    });
    return { ok: true, msg: "交付验收已提交，通过后回写任务并汇总父级进度" };
  }

  function approveAccept(todo) {
    const t = D().tasks.find((x) => x.id === todo.refId);
    if (!t) return { ok: false, msg: "任务不存在" };
    t.status = "已验收";
    t.progress = 100;
    completeTodo(todo.id);
    recalcProjectTasks(t.projectId);
    const p = project(t.projectId);
    if (p && p.stage === t.stage && !D().signoffItems.some((s) => s.projectId === t.projectId && !s.sample)) {
      seedSignoff(t.projectId, { touchNext: false });
    }
    if (p && signoffReady(t.projectId)) p.nextNode = "阶段 Exit Review";
    return { ok: true, msg: `${t.name} 已验收，父级进度已按阶段任务汇总` };
  }

  function seedSignoff(projectId, opts = {}) {
    if (D().signoffItems.some((s) => s.projectId === projectId && !s.sample)) {
      return;
    }
    const items = [
      {
        domain: "SOC Design",
        tag1: "Design",
        tag2: "RTL",
        tag3: "REG",
        description: "检查项代号-C01：Register RALF reviewed",
        owner: "成员代号-S01",
        approver: "成员代号-HW",
      },
      {
        domain: "SOC Design",
        tag1: "Design",
        tag2: "RTL",
        tag3: "CDC",
        description: "检查项代号-C02：CDC report signed",
        owner: "成员代号-S01",
        approver: "成员代号-HW",
      },
      {
        domain: "IP",
        tag1: "IP",
        tag2: "Integration",
        tag3: "DOC",
        description: "检查项代号-C03：IP integration checklist",
        owner: "成员代号-S02",
        approver: "成员代号-SW",
      },
      {
        domain: "POG",
        tag1: "Process",
        tag2: "Signoff",
        tag3: "MRA",
        description: "检查项代号-C04：开签材料齐套",
        owner: "成员代号-PM",
        approver: "成员代号-PL",
      },
      {
        domain: "PEG",
        tag1: "Verify",
        tag2: "UAT",
        tag3: "CASE",
        description: "检查项代号-C05：验收用例基线",
        owner: "成员代号-S02",
        approver: "成员代号-PL",
      },
    ];
    items.forEach((s) => {
      D().signoffItems.push({
        id: uid("so"),
        projectId,
        ...s,
        check: "Not Completed",
        approval: "",
        comments: "",
        sample: false,
      });
    });
    const p = project(projectId);
    if (p && opts.touchNext !== false) {
      p.nextNode = "Signoff Approve";
      p.nextDate = today();
    }
  }

  function updateCheck(itemId, check, actor) {
    const s = D().signoffItems.find((x) => x.id === itemId);
    if (!s) return { ok: false, msg: "条目不存在" };
    if (s.sample) return { ok: false, msg: "对照样例只读" };
    const prev = s.check;
    s.check = check;
    s.comments = `${actor || s.owner} changed Check from ${prev} to ${check} in ${nowStr()} | ${s.comments || ""}`;
    if (["Completed", "Completed with waive", "N/A"].includes(check) && s.approval !== "Approved") {
      s.approval = "Pending";
      if (
        !D().todos.some(
          (t) => t.status === "待办" && t.action === "approve_signoff" && t.refId === itemId
        )
      ) {
        addTodo({
          title: `Signoff Approve：${s.description.slice(0, 28)}`,
          type: "Signoff",
          from: s.owner,
          projectId: s.projectId,
          action: "approve_signoff",
          refId: itemId,
        });
      }
    }
    return { ok: true, msg: "Check 已更新" };
  }

  function updateApproval(itemId, approval, actor) {
    const s = D().signoffItems.find((x) => x.id === itemId);
    if (!s) return { ok: false, msg: "条目不存在" };
    if (s.sample) return { ok: false, msg: "对照样例只读" };
    s.approval = approval;
    s.comments = `${actor || s.approver} set Approval=${approval || "(空)"} in ${nowStr()} | ${s.comments || ""}`;
    D().todos
      .filter((t) => t.action === "approve_signoff" && t.refId === itemId && t.status === "待办")
      .forEach((t) => completeTodo(t.id));
    const p = project(s.projectId);
    if (p && signoffReady(s.projectId)) {
      p.nextNode = "阶段 Exit Review";
    }
    return { ok: true, msg: "Approval 已更新" };
  }

  function signoffReady(projectId) {
    const items = D().signoffItems.filter((s) => s.projectId === projectId);
    if (!items.length) return false;
    const approved = items.filter((s) => s.approval === "Approved").length;
    return approved / items.length >= 0.6;
  }

  function startExit(projectId) {
    const p = project(projectId);
    if (!p) return { ok: false, msg: "项目不存在" };
    if (p.sample) return { ok: false, msg: "对照样例只读" };
    {
      const freeze = pendingFlowFreeze(projectId);
      if (freeze) return { ok: false, msg: freeze };
    }
    if (!signoffReady(projectId)) {
      return { ok: false, msg: "Signoff Approve 率未达 60%" };
    }
    if (p.status === "阶段评审中") return { ok: false, msg: "已在阶段评审中" };
    p.status = "阶段评审中";
    p.nextNode = "Exit Review 审批";
    addTodo({
      title: `审批：${p.name} 阶段 Exit Review`,
      type: "阶段Exit",
      from: p.pm,
      projectId: p.id,
      action: "approve_exit",
      refId: p.id,
    });
    return { ok: true, msg: "Exit Review 已提交，请在待办中审批" };
  }

  function approveExit(todo) {
    const p = project(todo.refId || todo.projectId);
    if (!p) return { ok: false, msg: "项目不存在" };
    if (p.status !== "阶段评审中") return { ok: false, msg: "不在阶段评审中" };
    const order = D().stages;
    const cur = p.stage;
    const idx = Math.max(0, order.indexOf(cur));
    // 阶段推进：办结当前阶段里程碑；未验收子任务标记取消（门禁通过后清理）
    const stageTasks = D().tasks.filter((t) => t.projectId === p.id && t.stage === cur && t.status !== "已取消");
    const openSubs = stageTasks.filter((t) => t.type === "子任务" && !["已验收", "已完成"].includes(t.status));
    openSubs.forEach((t) => {
      t.status = "已取消";
      t.delayed = "正常推进";
      t.remark = (t.remark || "") + " Exit通过后关闭未交付子任务";
    });
    stageTasks
      .filter((t) => t.type === "里程碑任务" || ["已验收", "已完成"].includes(t.status))
      .forEach((t) => {
        if (t.type === "里程碑任务") t.status = "已完成";
        t.progress = 100;
      });
    const nextStage = order[Math.min(idx + 1, order.length - 1)];
    const advanced = nextStage !== cur;
    if (advanced) p.stage = nextStage;
    p.status = "执行中";
    // 解锁下一阶段里程碑及子任务为可执行
    if (advanced) {
      D().tasks
        .filter((t) => t.projectId === p.id && t.stage === nextStage && t.status === "未开始")
        .forEach((t) => {
          if (t.type === "里程碑任务" || !t.parentId) t.status = "进行中";
        });
      const nextMs = D().tasks.find(
        (t) => t.projectId === p.id && t.stage === nextStage && t.type === "里程碑任务" && t.critical
      );
      p.nextNode = nextMs?.name || nextStage;
      p.nextDate = nextMs?.planEnd || "";
    } else {
      p.nextNode = "结项准备";
    }
    recalcProjectTasks(p.id);
    completeTodo(todo.id);
    return { ok: true, msg: advanced ? `Exit 通过：${cur} → ${p.stage}，任务进度已回写` : `Exit 通过，已处于末阶段，可准备结项` };
  }

  function startExitForTask(taskId) {
    const t = D().tasks.find((x) => x.id === taskId);
    if (!t) return { ok: false, msg: "任务不存在" };
    if (t.type !== "里程碑任务") return { ok: false, msg: "仅关键里程碑可发起阶段 Exit" };
    const p = project(t.projectId);
    if (!p) return { ok: false, msg: "项目不存在" };
    if (t.stage !== p.stage) {
      return { ok: false, msg: `该里程碑属「${t.stage}」，当前阶段「${p.stage}」` };
    }
    return startExit(p.id);
  }

  function startClose(projectId) {
    const p = project(projectId);
    if (!p) return { ok: false, msg: "项目不存在" };
    if (p.sample) return { ok: false, msg: "对照样例只读" };
    if (D().todos.some((t) => t.status === "待办" && t.projectId === projectId && t.action === "approve_abort")) {
      return { ok: false, msg: "中止审批中，不可结项" };
    }
    if (p.status === "阶段评审中") return { ok: false, msg: "阶段评审中不可结项，请先完成 Exit" };
    if (p.status !== "执行中") {
      return { ok: false, msg: `当前「${p.status}」不可结项` };
    }
    const openRisk = D().risks.filter((r) => r.projectId === p.id && ["待处理", "进行中"].includes(r.status) && r.level === "高");
    if (openRisk.length) return { ok: false, msg: "存在未关闭的高风险，请先闭环再结项" };
    const closeMs = D().tasks.find((t) => t.projectId === p.id && t.name.includes("结项") && t.type === "里程碑任务");
    if (closeMs && closeMs.status === "未开始") {
      // 允许发起，但要求至少进入结项归档
      closeMs.status = "进行中";
    }
    p.status = "验收审批中";
    p.nextNode = "结项审批";
    addTodo({
      title: `审批：${p.name} 结项申请`,
      type: "结项审批",
      from: p.pm,
      projectId: p.id,
      action: "approve_close",
      refId: p.id,
    });
    return { ok: true, msg: "结项申请已提交，请在待办中审批" };
  }

  function approveClose(todo) {
    const p = project(todo.refId || todo.projectId);
    if (!p) return { ok: false, msg: "项目不存在" };
    if (p.status !== "验收审批中") return { ok: false, msg: "不在结项审批中" };
    p.status = "已结项";
    p.flowStatus = "已完成";
    p.nextNode = "—";
    p.nextDate = "";
    // 结项归档 WBS 一并办结
    D().tasks
      .filter((t) => t.projectId === p.id && /结项|归档/.test(t.name) && t.status !== "已取消")
      .forEach((t) => {
        t.status = t.type === "子任务" ? "已验收" : "已完成";
        t.progress = 100;
      });
    recalcProjectTasks(p.id);
    completeTodo(todo.id);
    return { ok: true, msg: "结项完成，已回写「已结项」并办结归档 WBS" };
  }


  function startAbort(projectId, remark) {
    const p = project(projectId);
    if (!p) return { ok: false, msg: "项目不存在" };
    if (p.sample) return { ok: false, msg: "对照样例只读" };
    if (!["执行中", "阶段评审中", "立项准备中"].includes(p.status)) {
      return { ok: false, msg: `当前「${p.status}」不可中止` };
    }
    if (!remark || !String(remark).trim()) return { ok: false, msg: "请填写中止原因" };
    if (D().todos.some((t) => t.status === "待办" && t.projectId === projectId && t.action === "approve_abort")) {
      return { ok: false, msg: "已有中止审批待办" };
    }
    p.remark = String(remark).trim();
    p.nextNode = "中止审批";
    p.flowStatus = "进行中";
    p.abortPending = true;
    addTodo({
      title: `审批：${p.name} 中止申请`,
      type: "中止审批",
      from: p.pm,
      projectId: p.id,
      action: "approve_abort",
      refId: p.id,
      payload: { remark: p.remark },
    });
    return { ok: true, msg: "中止申请已提交，请在待办中审批" };
  }

  function approveAbort(todo) {
    const p = project(todo.refId || todo.projectId);
    if (!p) return { ok: false, msg: "项目不存在" };
    p.status = "已中止";
    p.flowStatus = "已完成";
    p.nextNode = "—";
    p.nextDate = "";
    p.abortPending = false;
    if (todo.payload?.remark) p.remark = todo.payload.remark;
    completeTodo(todo.id);
    return { ok: true, msg: "中止通过，已回写「已中止」" };
  }


  function ensureBudget(projectId) {
    if (!D().budgets[projectId]) {
      D().budgets[projectId] = {
        manMonthPlan: 0,
        manMonthActual: 0,
        feePlan: 0,
        feeActual: 0,
        subjects: D().feeSubjects.map((name) => ({ name, plan: 0, actual: 0 })),
      };
    }
    return D().budgets[projectId];
  }

  function startProjectChange(projectId, payload) {
    const p = project(projectId);
    if (!p) return { ok: false, msg: "项目不存在" };
    if (p.sample) return { ok: false, msg: "对照样例只读" };
    {
      const freeze = pendingFlowFreeze(projectId);
      if (freeze) return { ok: false, msg: freeze };
    }
    if (!["执行中", "立项准备中", "阶段评审中"].includes(p.status)) {
      return { ok: false, msg: `当前「${p.status}」不可发起主档变更` };
    }
    if (D().todos.some((t) => t.status === "待办" && t.projectId === projectId && t.action === "approve_project_change")) {
      return { ok: false, msg: "已有主档变更待办" };
    }
    if (!payload?.changeType || !String(payload.note || "").trim()) {
      return { ok: false, msg: "请填写变更类型与说明" };
    }
    p.nextNode = "主档变更审批";
    addTodo({
      title: `审批：${p.name} 项目信息变更（${payload.changeType}）`,
      type: "项目变更",
      from: p.pm,
      projectId: p.id,
      action: "approve_project_change",
      refId: p.id,
      payload: {
        ...payload,
        before: {
          owner: p.owner,
          coleader: p.coleader,
          pm: p.pm,
          planStart: p.planStart,
          planEnd: p.planEnd,
          remark: p.remark,
        },
      },
    });
    return { ok: true, msg: "项目信息变更已提交，请在待办中审批" };
  }

  function approveProjectChange(todo) {
    const p = project(todo.refId || todo.projectId);
    if (!p) return { ok: false, msg: "项目不存在" };
    const payload = todo.payload || {};
    if (payload.owner) p.owner = payload.owner;
    if (payload.coleader !== undefined && payload.coleader !== "") p.coleader = payload.coleader;
    if (payload.pm) p.pm = payload.pm;
    if (payload.planStart) p.planStart = payload.planStart;
    if (payload.planEnd) p.planEnd = payload.planEnd;
    if (payload.remark !== undefined && payload.remark !== "") p.remark = payload.remark;
    if (!p.changeLog) p.changeLog = [];
    p.changeLog.unshift({
      at: nowStr(),
      type: payload.changeType || "主档变更",
      note: payload.note || "",
      by: todo.from || p.pm,
    });
    if (p.nextNode === "主档变更审批") p.nextNode = p.stage || "执行中";
    completeTodo(todo.id);
    return { ok: true, msg: `项目主档已回写：${payload.changeType || "变更"}` };
  }

  function submitTimeEntry(fields) {
    const projectId = fields?.projectId;
    const p = project(projectId);
    if (!p) return { ok: false, msg: "项目不存在" };
    if (p.sample) return { ok: false, msg: "对照样例只读" };
    {
      const freeze = pendingFlowFreeze(projectId);
      if (freeze) return { ok: false, msg: freeze };
    }
    const days = Number(fields.days);
    if (!(days > 0)) return { ok: false, msg: "请填写有效人天" };
    if (!D().timeEntries) D().timeEntries = [];
    const entry = {
      id: uid("te"),
      projectId,
      person: fields.person || p.pm,
      days,
      manMonth: Math.round((days / 22) * 100) / 100,
      domain: fields.domain || "POG",
      note: String(fields.note || "").trim(),
      status: "审批中",
      createdAt: nowStr(),
    };
    D().timeEntries.unshift(entry);
    addTodo({
      title: `审批：工时填报 · ${p.name} · ${entry.person}（${entry.days}人天）`,
      type: "工时填报",
      from: entry.person,
      projectId,
      action: "approve_time",
      refId: entry.id,
      payload: { entryId: entry.id },
    });
    return { ok: true, msg: "工时填报已提交，请在待办中审批" };
  }

  function approveTime(todo) {
    const entry = (D().timeEntries || []).find((x) => x.id === todo.refId);
    if (!entry) {
      completeTodo(todo.id);
      return { ok: false, msg: "填报记录不存在" };
    }
    entry.status = "已通过";
    const b = ensureBudget(entry.projectId);
    b.manMonthActual = Math.round((Number(b.manMonthActual || 0) + Number(entry.manMonth)) * 100) / 100;
    completeTodo(todo.id);
    return { ok: true, msg: `工时已入账 +${entry.manMonth} 人月（实际 ${b.manMonthActual}）` };
  }

  function submitFeeEntry(fields) {
    const projectId = fields?.projectId;
    const p = project(projectId);
    if (!p) return { ok: false, msg: "项目不存在" };
    if (p.sample) return { ok: false, msg: "对照样例只读" };
    {
      const freeze = pendingFlowFreeze(projectId);
      if (freeze) return { ok: false, msg: freeze };
    }
    const amount = Number(fields.amount);
    if (!(amount > 0)) return { ok: false, msg: "请填写有效金额（万）" };
    const subject = fields.subject || D().feeSubjects[0];
    if (!D().feeEntries) D().feeEntries = [];
    const entry = {
      id: uid("fe"),
      projectId,
      subject,
      amount,
      note: String(fields.note || "").trim(),
      status: "审批中",
      createdAt: nowStr(),
      by: fields.by || "成员代号-FIN",
    };
    D().feeEntries.unshift(entry);
    addTodo({
      title: `审批：费用登记 · ${p.name} · ${subject}（${amount}万）`,
      type: "费用登记",
      from: entry.by,
      projectId,
      action: "approve_fee",
      refId: entry.id,
      payload: { entryId: entry.id },
    });
    return { ok: true, msg: "费用登记已提交，请在待办中审批" };
  }

  function approveFee(todo) {
    const entry = (D().feeEntries || []).find((x) => x.id === todo.refId);
    if (!entry) {
      completeTodo(todo.id);
      return { ok: false, msg: "费用记录不存在" };
    }
    entry.status = "已通过";
    const b = ensureBudget(entry.projectId);
    let sub = (b.subjects || []).find((s) => s.name === entry.subject);
    if (!sub) {
      sub = { name: entry.subject, plan: 0, actual: 0 };
      b.subjects.push(sub);
    }
    sub.actual = Math.round((Number(sub.actual || 0) + Number(entry.amount)) * 100) / 100;
    b.feeActual = Math.round(b.subjects.reduce((a, s) => a + Number(s.actual || 0), 0) * 100) / 100;
    completeTodo(todo.id);
    const rate = b.feePlan ? Math.round((b.feeActual / b.feePlan) * 100) : 0;
    return { ok: true, msg: `费用已入账 +${entry.amount}万（执行率 ${rate}%）` };
  }

  function approveChange(todo) {
    const t = D().tasks.find((x) => x.id === todo.refId);
    if (!t) {
      completeTodo(todo.id);
      return { ok: false, msg: "任务不存在" };
    }
    const payload = todo.payload || {};
    if (payload.type === "负责人" && payload.owner) t.owner = payload.owner;
    if (payload.type === "计划日期") {
      if (payload.planStart) t.planStart = payload.planStart;
      if (payload.planEnd) t.planEnd = payload.planEnd;
    }
    if (payload.note) t.remark = `变更：${payload.note}`;
    completeTodo(todo.id);
    recalcProjectTasks(t.projectId);
    return { ok: true, msg: `任务变更已回写：${t.name}` };
  }

  function processTodo(todoId, decision) {
    const t = D().todos.find((x) => x.id === todoId);
    if (!t || t.status !== "待办") return { ok: false, msg: "待办不可处理" };
    if (decision === "reject") {
      t.status = "已驳回";
      t.doneAt = nowStr();
      if (t.action === "approve_abort") {
        const p = project(t.refId || t.projectId);
        if (p) {
          p.abortPending = false;
          if (p.nextNode === "中止审批") p.nextNode = p.stage || "执行中";
        }
      }
      if (t.action === "approve_project_change") {
        const p = project(t.refId || t.projectId);
        if (p && p.nextNode === "主档变更审批") p.nextNode = p.stage || "执行中";
      }
      if (t.action === "approve_time") {
        const entry = (D().timeEntries || []).find((x) => x.id === t.refId);
        if (entry) entry.status = "已驳回";
      }
      if (t.action === "approve_fee") {
        const entry = (D().feeEntries || []).find((x) => x.id === t.refId);
        if (entry) entry.status = "已驳回";
      }
      return { ok: true, msg: "已驳回" };
    }
    switch (t.action) {
      case "approve_init":
        return approveInit(t);
      case "fill_plan":
        return { ok: true, msg: "请打开项目计划填写里程碑节点", navigate: "form-plan", planId: t.refId };
      case "approve_plan":
        return approvePlan(t);
      case "approve_progress":
        return approveProgress(t);
      case "approve_accept":
        return approveAccept(t);
      case "approve_signoff": {
        const r = updateApproval(t.refId, "Approved", "成员代号-Approver");
        completeTodo(todoId);
        return r;
      }
      case "approve_exit":
        return approveExit(t);
      case "approve_close":
        return approveClose(t);
      case "approve_abort":
        return approveAbort(t);
      case "approve_change":
        return approveChange(t);
      case "approve_project_change":
        return approveProjectChange(t);
      case "approve_time":
        return approveTime(t);
      case "approve_fee":
        return approveFee(t);
      default:
        completeTodo(todoId);
        return { ok: true, msg: "已办结" };
    }
  }

  function clearBusiness() {
    D().projects = [];
    D().tasks = [];
    D().plans = [];
    D().todos = [];
    D().signoffItems = [];
    D().risks = [];
    D().contracts = [];
    D().budgets = {};
    D().orgMembers = [];
    D().announcements = [];
    D().daci = [];
    D().timeEntries = [];
    D().feeEntries = [];
    return { ok: true, msg: "业务数据已清空" };
  }

  function loadSample() {
    const s = D()._sample;
    if (!s) return { ok: false, msg: "无样例" };
    // 不覆盖用户自建数据：只追加尚未存在的 sample id
    const has = (arr, id) => arr.some((x) => x.id === id);
    s.projects.forEach((p) => {
      if (!has(D().projects, p.id)) D().projects.push({ ...p });
    });
    s.tasks.forEach((t) => {
      if (!has(D().tasks, t.id)) D().tasks.push({ ...t });
    });
    s.plans.forEach((p) => {
      if (!has(D().plans, p.id)) D().plans.push({ ...p });
    });
    s.signoffItems.forEach((x) => {
      if (!has(D().signoffItems, x.id)) D().signoffItems.push({ ...x });
    });
    s.risks.forEach((x) => {
      if (!has(D().risks, x.id)) D().risks.push({ ...x });
    });
    D().budgets = { ...D().budgets, ...JSON.parse(JSON.stringify(s.budgets)) };
    return { ok: true, msg: "已装载对照样例（只读标记）" };
  }

  function removeSample() {
    D().projects = D().projects.filter((p) => !p.sample);
    D().tasks = D().tasks.filter((t) => !t.sample);
    D().plans = D().plans.filter((p) => !p.sample);
    D().signoffItems = D().signoffItems.filter((s) => !s.sample);
    D().risks = D().risks.filter((r) => !r.sample);
    Object.keys(D().budgets).forEach((k) => {
      if (k === "p1") delete D().budgets[k];
    });
    return { ok: true, msg: "已移除对照样例" };
  }

  window.FlowEngine = {
    createProject,
    submitInitForm,
    submitInit,
    templateNodes,
    ensurePlanDraft,
    savePlan,
    submitPlan,
    approvePlan,
    confirmPlan,
    startWork,
    submitProgress,
    submitAccept,
    updateCheck,
    updateApproval,
    startExit,
    startExitForTask,
    startClose,
    startAbort,
    startProjectChange,
    submitTimeEntry,
    submitFeeEntry,
    ensureBudget,
    processTodo,
    seedSignoff,
    signoffReady,
    recalcProjectTasks,
    seedDemoData,
    clearBusiness,
    loadSample,
    removeSample,
    project,
  };
})();

