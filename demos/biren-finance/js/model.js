/* 财务一期原型：同一组示例明细驱动汇总、筛选与下钻。金额：万元。 */
(function () {
  const D = window.BIREN_DATA;
  const sum = (rows, key) => rows.reduce((n, r) => n + Number(typeof key === 'function' ? key(r) : r[key] || 0), 0);
  const pct = (a, b) => b ? a / b * 100 : null;
  const periodMonths = key => key === 'q1' ? [1,2,3] : key === 'q2' ? [4,5,6] : key === 'm3' ? [5,6,7] : key === 'm7' ? [7] : [1,2,3,4,5,6,7];
  const distribute = (total, weights) => { let used = 0; const base = weights.reduce((a,b)=>a+b,0); return weights.map((w,i) => { const n = i === weights.length-1 ? total-used : Math.round(total*w/base*100)/100; used += n; return n; }); };
  const people = ['张明','李华','王芳','赵强','陈晨','周凯'];
  const team = name => people.indexOf(name) < 3 ? '华东团队' : '华北团队';
  const sales = [];
  for (let month=1;month<=7;month++) for(let i=0;i<6;i++) {
    const order = 580 + month*48 + i*31, revenue = Math.round(order*(.56+i*.035));
    sales.push({id:`SO2026-${month}${String(i+1).padStart(3,'0')}`,month,date:`2026-${String(month).padStart(2,'0')}-15`,customer:`客户${'ABCDEF'[i]}`,line:['训练卡','推理卡','板卡整机','软件与服务'][i%4],form:['板卡','模组','整机','软件'][i%4],industry:['互联网','运营商','金融','制造'][i%4],person:people[i],team:team(people[i]),material:['BR100-32G','BR166-64G','整机方案包','软件授权'][i%4],order,revenue,backlog:Math.round(order*.35),collect:Math.round(revenue*.86),cost:Math.round(revenue*.632),forecastCost:Math.round(order*.614),qty:40+i*12,delivered:28+i*8,invoice:`INV-${month}-${i+1}`,allocations:[{person:people[i],share:.8},{person:people[(i+1)%6],share:.2}]});
  }
  const targets = people.flatMap((person,i)=>Array.from({length:12},(_,m)=>({person,team:team(person),month:m+1,order:1200+i*65,revenue:800+i*40,collect:720+i*35})));
  const monthsFilter = (rows, months) => rows.filter(r=>months.includes(r.month));
  const salesFilter = f => sales.filter(r=>(!f.months||f.months.includes(r.month))&&(!f.customer||r.customer===f.customer)&&(!f.line||r.line===f.line)&&(!f.person||r.person===f.person)&&(!f.team||r.team===f.team));
  const personal = (name,months) => { const rows=monthsFilter(sales,months).filter(r=>r.allocations.some(a=>a.person===name)); const allocation=r=>r.allocations.find(a=>a.person===name).share; const target=targets.filter(r=>r.person===name&&months.includes(r.month)); return {rows,order:sum(rows,r=>r.order*allocation(r)),revenue:sum(rows,r=>r.revenue*allocation(r)),collect:sum(rows,r=>r.collect*allocation(r)),orderTarget:sum(target,'order'),revenueTarget:sum(target,'revenue'),collectTarget:sum(target,'collect')}; };
  const asOf = '2026-07-31';
  const age = date => Math.floor((Date.parse(asOf+'T00:00:00Z')-Date.parse(date+'T00:00:00Z'))/86400000);
  const receivables=people.flatMap((person,i)=>[0,1,2].map((j)=>({customer:`客户${'ABCDEF'[i]}`,contract:`AR2026-${i+1}${j+1}`,person,team:team(person),amount:360+i*85+j*120,due:j===0?'2026-08-20':j===1?'2026-07-15':`2026-0${3+i%3}-15`,invoiceDate:j===0?'2026-07-20':j===1?'2026-06-20':'2026-02-15',note:j===0?'合同约定账期内':j===1?'已对账，跟进回款':'已发催收函'})));
  const ageBand = r => { const n=age(r.invoiceDate);return n<=30?'1-30天':n<=60?'31-60天':n<=90?'61-90天':'90天+'; };
  const arFilter = f => receivables.filter(r=>(!f.person||r.person===f.person)&&(!f.team||r.team===f.team)&&(!f.aging||ageBand(r)===f.aging));
  const forecast = [{name:'在手订单',value:Math.round(sum(sales,'backlog')/1.13)},{name:'未签单预测',value:31450},{name:'在谈商机',value:9200}];
  // 预算每条记录对应一个部门、项目、预算科目；月度值可以追溯到该行。
  const budget=[];
  Object.entries(D.budget.deptTree).forEach(([l1,node])=>Object.entries(node.children).forEach(([l2,vals],i)=>{
    const fee=l1==='研发中心'?'研发':l1==='销售部'?'销售':l1==='供应链'?'量产':'管理';
    const subject=fee==='研发'?['工程服务费','云资源','委外测试'][i%3]:fee==='销售'?['差旅费','市场费用','会务费'][i%3]:fee==='量产'?'仓储物流':'办公费用';
    budget.push({l1,l2,fee,subject,attribute:fee,expenseType:fee==='研发'?'工程NRE':'部门行政费用',project:fee==='研发'?['BR100量产','软件平台','BR166验证'][i%3]:'通用运营',annual:vals[0],monthlyBudget:distribute(vals[0],Array(12).fill(1)),monthlyActual:[...distribute(vals[1],D.budget.monthActual.slice(0,7)),0,0,0,0,0]});
  }));
  const rd=D.rd.projects.labels.map((project,i)=>({project,l1:i===2||i===5?'软件中心':'研发中心',l2:i===2?'系统软件':i===5?'驱动栈':i===1?'验证测试':'芯片设计',budget:D.rd.projects.budget[i],used:D.rd.projects.actual[i],change:[260,200,160,120,80,40][i],prior:[520,460,280,180,120,80][i],subject:['工程服务费','委外测试','云资源','物料采购','工程服务费','人力分摊'][i],human:[800,600,1600,280,200,1280][i],status:i===1?'审批中':'已批准'}));
  rd.forEach(r=>{r.monthly=distribute(r.used-r.prior,D.rd.monthUsed.slice(0,7)).concat([0,0,0,0,0]);r.changes=distribute(r.change,[1,2,3,4,5,6,7]).concat([0,0,0,0,0]);});
  // 按物料行生成统一存货视图，所有维度在同一批库存行上交叉筛选。
  const inventory=[];
  D.inventory.category.labels.forEach((category,c)=>{
    const amounts=distribute(D.inventory.category.values[c],Array.from({length:24},(_,i)=>i+8));
    const quantities=distribute(D.inventory.category.qty[c],Array.from({length:24},(_,i)=>i+8));
    for(let i=0;i<24;i++) inventory.push({material:`${['RM','WIP','FG'][c]}-${String(i+1).padStart(3,'0')}`,category,level2:D.inventory.boards[category].category.labels[i%3],level3:['标准料','定制料'][i%2],project:D.inventory.project.labels[i%5],location:D.inventory.location.labels[i%4],status:D.inventory.salesStatus.labels[(i+c)%4],aging:D.inventory.aging.labels[Math.floor(i/4)],amount:amounts[i],qty:quantities[i],provision:Math.round(amounts[i]*(i>=16?.08:.015)*100)/100});
  });
  const inventoryFilter=f=>inventory.filter(r=>(!f.category||r.category===f.category)&&(!f.aging||r.aging===f.aging)&&(!f.project||r.project===f.project)&&(!f.location||r.location===f.location)&&(!f.status||r.status===f.status));
  const forms=[
    ['年度预算底表','财务预算',['年度','一级部门','二级部门','项目','预算科目','月度','预算金额'],['2026','研发中心','芯片设计','BR100量产','工程服务费','7','420']],
    ['研发项目预算','研财',['项目','预算版本','预算科目','全周期预算'],['BR166验证','V1','委外测试','4800']],
    ['预算变更表','财务预算',['项目','生效月','变更金额','审批状态','变更说明'],['BR166验证','7','200','已批准','验证范围调整']],
    ['销售 KPI 目标','销售管理',['销售员','月份','订单目标','收入目标'],['张明','7','1200','800']],
    ['销售比例分摊','销售管理',['合同号','销售员','分配比例(%)'],[sales[0].id,'张明','80']],
    ['回款目标','销售管理',['销售员','月份','回款目标'],['张明','7','720']],
    ['标准成本表','成本会计',['物料','生效月','单位标准成本'],['BR100-32G','7','12']],
    ['在谈商机 / 预计签约','销售',['客户','产品线','预测类型','预计签约月','预计收入'],['客户A','训练卡','在谈商机','9','3600']],
    ['科目/组织映射表','财务与IT',['预算科目','ERP科目','部门','成本中心'],['工程服务费','660201','芯片设计','CC100']],
    ['成品结存变动表','供应链',['产品/SKU','现有库存','待生产','已下订单','预计订单'],['BR100-32G','1860','420','1520','680']]
  ].map(([name,owner,fields,sample])=>({name,owner,fields,sample}));
  window.BIREN_MODEL={sum,pct,periodMonths,distribute,people,team,sales,targets,salesFilter,personal,asOf,age,ageBand,receivables,arFilter,forecast,budget,rd,inventory,inventoryFilter,forms};
  D.meta.asOf=asOf;
})();
