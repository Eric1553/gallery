/**
 * E2E：计划手填同步 + 子任务交付验收 + 阶段推进（禁止手填%）
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.join(__dirname, "..");
const ctx = { window: {}, console, Date, Math, JSON };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root, "js/data.js"), "utf8"), ctx);
vm.runInContext(fs.readFileSync(path.join(root, "js/flow.js"), "utf8"), ctx);

const F = ctx.window.FlowEngine;
const D = ctx.window.APP_DATA;

function assert(cond, msg) {
  if (!cond) throw new Error("ASSERT: " + msg);
}
function step(name, fn) {
  const r = fn();
  if (r && r.ok === false) throw new Error(`${name}: ${r.msg}`);
  console.log("✓", name, r?.msg || "");
  return r;
}
function pending(action) {
  return D.todos.find((t) => t.status === "待办" && (!action || t.action === action));
}

try {
  step("0 seed", () => F.seedDemoData());
  assert(D.projects.length >= 6, "项目应≥6");
  assert(D.tasks.some((t) => t.wbs === "7" && t.name.includes("结项")), "结项里程碑应有 WBS=7");
  assert(D.tasks.some((t) => t.wbs === "7.1"), "结项子任务 7.1");
  console.log(
    `  data: projects=${D.projects.length} plans=${D.plans.length} tasks=${D.tasks.length} signoff=${D.signoffItems.length}`
  );

  const p3 = D.projects.find((p) => p.name === "项目代号-03");
  assert(p3, "应有项目代号-03");
  let plan = D.plans.find((pl) => pl.projectId === p3.id);
  assert(plan && !(plan.nodes || []).length, "03 计划应为空节点待填");

  step("1 手填节点", () =>
    F.savePlan({
      id: plan.id,
      projectId: p3.id,
      name: plan.name,
      template: "自研简版",
      nodes: F.templateNodes("自研简版", p3),
    })
  );
  step("2 提交计划", () => F.submitPlan(plan));
  step("3 审批同步", () => F.processTodo(pending("approve_plan").id, "approve"));
  assert(D.tasks.filter((t) => t.projectId === p3.id).length >= 3, "应同步节点");

  const p1 = D.projects.find((p) => p.name === "项目代号-01");
  const child =
    D.tasks.find((t) => t.projectId === p1.id && t.name.includes("功耗评估")) ||
    D.tasks.find((t) => t.projectId === p1.id && t.type === "子任务" && t.status === "未开始" && t.stage === p1.stage);
  assert(child, "p1 当前阶段应有未开始子任务");
  step("4 开始执行", () => F.startWork(child.id));
  assert(child.status === "进行中", "开始后应为进行中");
  step("5 交付验收", () => F.submitAccept(child.id));
  step("6 验收审批", () => F.processTodo(pending("approve_accept").id, "approve"));
  assert(child.status === "已验收" && child.progress === 100, "验收后进度100");
  const parent = D.tasks.find((t) => t.id === child.parentId);
  assert(parent && parent.progress > 0, "父级进度应汇总回写");

  // Signoff 拉满后 Exit
  D.signoffItems.filter((s) => s.projectId === p1.id).forEach((s) => {
    s.check = "Completed";
    s.approval = "Approved";
  });
  const ms = D.tasks.find(
    (t) => t.projectId === p1.id && t.stage === p1.stage && t.type === "里程碑任务" && t.critical
  );
  assert(ms, "当前阶段应有关键里程碑");
  const curStage = p1.stage;
  step("7 发起Exit", () => F.startExitForTask(ms.id));
  step("8 Exit审批", () => F.processTodo(pending("approve_exit").id, "approve"));
  assert(p1.stage !== curStage || p1.nextNode.includes("结项"), "阶段应推进或进入结项准备");
  assert(
    D.tasks.filter((t) => t.projectId === p1.id && t.stage === curStage && t.status !== "已取消").every((t) =>
      ["已验收", "已完成"].includes(t.status)
    ),
    "旧阶段任务应全部办结"
  );

  // p4 不得死锁：阶段评审中必须有 Exit 待办
  const p4 = D.projects.find((x) => x.name === "项目代号-04");
  assert(p4 && p4.status === "阶段评审中", "p4 应为阶段评审中");
  assert(
    D.todos.some((td) => td.status === "待办" && td.action === "approve_exit" && td.projectId === p4.id),
    "p4 应有 Exit 待办"
  );
  step("9 p4 Exit审批解死锁", () => F.processTodo(pending("approve_exit").id, "approve"));
  assert(p4.status === "执行中", "p4 Exit 后应回执行中");

  // 中止走流程
  const p5 = D.projects.find((x) => x.name === "项目代号-05");
  step("10 中止申请", () => F.startAbort(p5.id, "资源冲突，演示中止"));
  {
    const frozen = F.startWork(
      D.tasks.find((x) => x.projectId === p5.id && x.type === "子任务" && x.status === "未开始")?.id ||
        D.tasks.find((x) => x.projectId === p5.id && x.status === "未开始").id
    );
    assert(frozen.ok === false, "中止挂起冻结");
    console.log("✓ 10b 中止挂起冻结", frozen.msg);
  }
  step("11 中止审批", () => F.processTodo(pending("approve_abort").id, "approve"));
  assert(p5.status === "已中止", "中止应回写");

  // 阶段评审中禁止开干
  p1.status = "阶段评审中";
  const blocked = F.startWork(
    D.tasks.find((x) => x.projectId === p1.id && x.status === "未开始" && x.type === "子任务").id
  );
  assert(blocked.ok === false, "阶段评审中应禁止开始执行");
  p1.status = "执行中";

  // P1: F02 主档变更
  step("12 主档变更", () =>
    F.startProjectChange(p1.id, {
      changeType: "组织",
      owner: "成员代号-HW",
      coleader: "成员代号-SW",
      pm: p1.pm,
      planStart: p1.planStart,
      planEnd: p1.planEnd,
      remark: p1.remark,
      note: "演示：调整负责人与 Co-Leader",
    })
  );
  step("13 主档变更审批", () => F.processTodo(pending("approve_project_change").id, "approve"));
  assert(p1.owner === "成员代号-HW", "主档负责人应回写");
  assert((p1.changeLog || []).length >= 1, "应有变更历史");

  // P1: 工时 / 费用
  const mm0 = D.budgets[p1.id].manMonthActual;
  const fee0 = D.budgets[p1.id].feeActual;
  step("14 工时填报", () =>
    F.submitTimeEntry({ projectId: p1.id, person: "成员代号-HW", days: 11, domain: "HWG", note: "功耗评估" })
  );
  step("15 工时审批", () => F.processTodo(pending("approve_time").id, "approve"));
  assert(D.budgets[p1.id].manMonthActual > mm0, "实际人月应增加");
  step("16 费用登记", () =>
    F.submitFeeEntry({ projectId: p1.id, subject: "NRE费用", amount: 3, by: "成员代号-FIN", note: "NRE 追加" })
  );
  step("17 费用审批", () => F.processTodo(pending("approve_fee").id, "approve"));
  assert(D.budgets[p1.id].feeActual > fee0, "实际费用应增加");
  assert((D.orgMembers || []).length >= 1 && (D.daci || []).length >= 1 && (D.announcements || []).length >= 1, "组织/DACI/公告应有种子");

  console.log("\n======== E2E PASSED ========");
  process.exit(0);
} catch (e) {
  console.error("\n======== E2E FAILED ========", e.message);
  process.exit(1);
}
