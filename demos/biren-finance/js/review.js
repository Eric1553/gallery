/* Customer review 2026-11-03: ordinary BI filters; demo mappings only. */
(()=>{
 const $=s=>document.querySelector(s),M=window.BIREN_MODEL;
 window.reviewFilter=(rows,p)=>{const start=$('#'+p+'-start')?.value||'0000-01-01',end=$('#'+p+'-end')?.value||'9999-12-31';return rows.filter(r=>r.date>=start&&r.date<=end&&(p!=='sl'||[ ['sl-query',r.customer],['sl-order',r.id],['sl-sku',r.sku]].every(([id,v])=>String(v).toLowerCase().includes($('#'+id).value.trim().toLowerCase()))));};
 for(const p of ['sl','ar','kpi']){
 const host=$('#'+p+'-period').closest('.filters');
 host.insertAdjacentHTML('afterbegin',`<label class="filter-field"><span>开始日期</span><input id="${p}-start" type="date" value="2026-01-01"></label><label class="filter-field"><span>截止日期</span><input id="${p}-end" type="date" value="2026-07-31"></label>`);
 $('#'+p+'-period').closest('label').style.display='none';
 host.insertAdjacentHTML('afterend','<p class="review-note">示例数据截至 2026-07-31；余额按截止日快照，发生额按起止日期。区间目标按覆盖月份及天数折算。</p>');
 for(const suffix of ['start','end'])$('#'+p+'-'+suffix).addEventListener('change',()=>{const a=$('#'+p+'-start'),b=$('#'+p+'-end');if(a.value>b.value){b.value=a.value;}$('#'+p+'-period').dispatchEvent(new Event('change'));});
 }
 $('#sl-date-mode').closest('label').style.display='none';
 $('#sl-customer').closest('label').style.display='none';
 $('#sl-period').closest('.filters').insertAdjacentHTML('beforeend', ['query','order','sku'].map((k,i)=>`<label class="filter-field"><span>${['客户关键词','订单号','SKU'][i]}</span><input id="sl-${k}" type="search" placeholder="${['输入客户名称','输入完整或部分订单号','输入 SKU 关键词'][i]}"></label>`).join(''));
 ['sl-query','sl-order','sl-sku'].forEach(id=>$('#'+id).addEventListener('input',()=>$('#sl-period').dispatchEvent(new Event('change'))));
 document.querySelectorAll('#sl-person option,#ar-person option').forEach(o=>{if(o.value)o.textContent=o.value+' · E'+(1001+M.people.indexOf(o.value));});
 $('#sl-scope').parentElement.insertAdjacentHTML('afterend','<p class="review-note">SKU 以物料示例映射；BOM 索引、SAP 销售员1工号及人员主数据待接口确认。金额为演示数据。</p>');
 $('#ar-detail').insertAdjacentHTML('beforebegin','<p class="review-note">到期日＝开票日＋合同账期；截止日超过到期日且余额未清即计为逾期。当月应收展示截至所选截止日已到期未收金额，含历史逾期。应收余额采用示例快照，待接入 SAP 截止日余额表；账龄按开票日起算，区别于逾期天数。</p>');
 const rerender=()=>{const active=document.querySelector('.view.active')?.id;const p=active==='view-sales'?'sl':active==='view-ar'?'ar':active==='view-kpi'?'kpi':null;if(p)$('#'+p+'-period').dispatchEvent(new Event('change'));};
 rerender();
})();
