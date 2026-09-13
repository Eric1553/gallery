/** 公共组件、数字格式、全局联动 */
const Cockpit = {
  state: { period: 'month', version: 'actual', scope: 'group' },

  chartTheme: {
    backgroundColor: 'transparent',
    textStyle: { color: '#5a6b7d', fontSize: 11 },
    color: ['#1890ff', '#005293', '#1a6cb3', '#4a9fd4', '#6bb8e0', '#8cadc8']
  },

  fmt: {
    num(n, decimals = 2) {
      const v = Number(n);
      if (Number.isNaN(v)) return n;
      return v.toLocaleString('zh-CN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    },
    pct(n, signed = true) {
      const v = Number(n);
      const s = signed && v > 0 ? '+' : '';
      return `${s}${this.num(v, 1)}%`;
    }
  },

  initNav(activePage, opts = {}) {
    const sidebarPage = opts.sidebarPage ?? activePage;
    document.querySelectorAll('.header-nav a').forEach(a => {
      a.classList.toggle('active', a.dataset.page === activePage);
    });
    document.querySelectorAll('.sidebar a').forEach(a => {
      a.classList.toggle('active', a.dataset.page === sidebarPage);
    });
    this.renderSidebar(sidebarPage);
  },

  /** 统一侧栏（五层体系） */
  renderSidebar(activePage) {
    const root = document.querySelector('.sidebar');
    if (!root || typeof CockpitLevels === 'undefined') return;
    root.innerHTML = CockpitLevels.nav.map(sec => `
      <div class="sidebar-section">
        <div class="sidebar-label">${sec.label}</div>
        ${sec.items.map(it => `
          <a href="${it.href}" data-page="${it.page}"${it.page === activePage ? ' class="active"' : ''}>
            <span class="icon">${it.icon}</span> ${it.label}
          </a>`).join('')}
      </div>`).join('');
  },

  levelLabel(pageOrCode) {
    if (!window.CockpitLevels) return pageOrCode || '';
    const lv = CockpitLevels.pageLevel[pageOrCode] || String(pageOrCode || '').toLowerCase();
    return CockpitLevels.label(lv.startsWith('l') ? lv : CockpitLevels.pageLevel[lv] || 'l2');
  },

  renderKpis(container, kpis) {
    if (!container) return;
    container.innerHTML = kpis.map(k => `
      <div class="kpi-card ${k.highlight ? 'highlight' : ''}">
        <div class="kpi-label">${k.label}</div>
        <div class="kpi-value">${k.value}<span class="kpi-unit">${k.unit || ''}</span></div>
        <div class="kpi-metrics">
          ${k.yoy ? `<span class="${k.yoy.startsWith('+') ? 'up' : k.yoy.startsWith('-') ? 'down' : 'neutral'}">同比 ${k.yoy}</span>` : ''}
          ${k.mom ? `<span class="${k.mom.startsWith('+') ? 'up' : k.mom.startsWith('-') ? 'down' : 'neutral'}">环比 ${k.mom}</span>` : ''}
          ${k.rate ? `<span class="neutral">达成率 ${k.rate}</span>` : ''}
          ${k.target ? `<span class="neutral">目标 ${k.target}${k.unit || ''}</span>` : ''}
        </div>
      </div>
    `).join('');
  },

  renderFilterBar(container, options = {}) {
    if (!container) return;
    const { showVersion = false, showScope = false, showProcess = false } = options;
    const inToolbar = !!container.closest('.page-toolbar');
    container.classList.add('filter-bar');
    if (inToolbar) container.classList.add('toolbar-filters');

    const periodCluster = `
      <div class="filter-group"><label>周期</label><select data-filter="period"><option value="month">月度</option><option value="quarter">季度</option></select></div>
      <div class="filter-group"><label>期间</label><input type="month" value="2025-07" data-filter="date"></div>
      ${showVersion ? `<div class="filter-group"><label>版本</label><select data-filter="version"><option value="budget">2025-Budget-V3</option><option value="forecast">2025-Forecast-V2</option></select></div>` : ''}`;

    const orgCluster = `
      <div class="filter-group"><label>BU</label><select data-filter="bu"><option value="">全部</option>${MockData.bus.map(b => `<option>${b}</option>`).join('')}</select></div>
      <div class="filter-group"><label>FAB</label><select data-filter="fab"><option value="">全部</option>${MockData.fabs.map(f => `<option>${f}</option>`).join('')}</select></div>
      ${showScope ? `<div class="filter-group"><label>口径</label><select data-filter="scope"><option value="group">集团考核</option><option value="single">单体</option><option value="group-cost">集团</option></select></div>` : ''}`;

    const dimCluster = `
      <div class="filter-group"><label>业务</label><select data-filter="biz"><option value="">全部</option><option>晶圆</option><option>光罩</option><option>MPW</option></select></div>
      <div class="filter-group"><label>应用</label><select data-filter="app"><option value="">全部</option><option>智能手机</option><option>汽车电子</option><option>物联网</option></select></div>
      <div class="filter-group"><label>地区</label><select data-filter="region"><option value="">全部</option><option>中国大陆</option><option>北美</option><option>亚太</option></select></div>
      ${showProcess ? `<div class="filter-group"><label>工艺</label><select data-filter="process"><option value="">全部</option><option>FinFET</option><option>28nm</option><option>40nm</option></select></div>` : ''}`;

    if (inToolbar) {
      container.innerHTML = `
        <div class="filter-cluster"><span class="cluster-label">期间</span><div class="cluster-items">${periodCluster}</div></div>
        <div class="filter-cluster"><span class="cluster-label">组织</span><div class="cluster-items">${orgCluster}</div></div>
        <div class="filter-cluster"><span class="cluster-label">维度</span><div class="cluster-items">${dimCluster}</div></div>`;
    } else {
      container.innerHTML = periodCluster + orgCluster + dimCluster;
    }
    this.bindFilterEvents(container);
  },

  bindFilterEvents(container) {
    if (!container) return;
    container.querySelectorAll('select, input').forEach(el => {
      el.addEventListener('change', () => {
        this.showStatus(`筛选已更新 · ${this.getFilterSummary(container)}`);
        document.dispatchEvent(new CustomEvent('cockpit:filter', { detail: this.getFilterValues(container) }));
      });
    });
  },

  getFilterValues(container) {
    const v = {};
    container?.querySelectorAll('[data-filter]').forEach(el => { v[el.dataset.filter] = el.value; });
    return v;
  },

  getFilterSummary(container) {
    const v = this.getFilterValues(container);
    return Object.entries(v).filter(([, val]) => val).map(([k, val]) => `${k}:${val}`).join(' · ') || '全部';
  },

  showStatus(msg) {
    let bar = document.getElementById('filter-status');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'filter-status';
      bar.className = 'filter-status';
      const fb = document.getElementById('filter-bar');
      (fb?.parentElement || document.body).insertBefore(bar, fb?.nextSibling || null);
    }
    bar.textContent = msg;
    bar.classList.add('show');
    clearTimeout(bar._t);
    bar._t = setTimeout(() => bar.classList.remove('show'), 2800);
  },

  /** 分组子 Tab：同一 data-tab-group 内互斥 */
  bindSubTabGroups(root = document) {
    root.querySelectorAll('[data-tab-group]').forEach(bar => {
      bar.querySelectorAll('.sub-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          bar.querySelectorAll('.sub-tab-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          const group = bar.dataset.tabGroup;
          const value = btn.dataset.value || btn.textContent.trim();
          if (group === 'period') Cockpit.state.period = value === '季度' || value === 'quarter' ? 'quarter' : 'month';
          if (group === 'version') Cockpit.state.version = value === 'forecast' || btn.textContent.includes('预测') ? 'forecast' : 'actual';
          if (group === 'scope') Cockpit.state.scope = value === 'single' || btn.textContent.includes('单体') ? 'single' : 'group';
          document.dispatchEvent(new CustomEvent('cockpit:subtab', { detail: { group, value } }));
          Cockpit.showStatus(`${group === 'period' ? '周期' : group === 'version' ? '数据版本' : '口径'}：${btn.textContent.trim()}`);
          setTimeout(() => Charts.resizeAll(), 120);
        });
      });
    });
  },

  /** 面板内趋势/预测切换 */
  bindPanelToggles(root = document) {
    root.querySelectorAll('[data-toggle-group]').forEach(group => {
      const chartId = group.dataset.chart;
      group.querySelectorAll('.sub-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          group.querySelectorAll('.sub-tab-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          const mode = btn.dataset.mode || 'trend';
          document.dispatchEvent(new CustomEvent('cockpit:chartmode', { detail: { chartId, mode } }));
        });
      });
    });
  },

  bindTabs(tabBarSelector, onSwitch) {
    const bar = document.querySelector(tabBarSelector);
    if (!bar) return;
    bar.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        bar.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        if (btn.dataset.tab) {
          document.querySelectorAll('[data-panel]').forEach(p => {
            p.style.display = p.dataset.panel === btn.dataset.tab ? 'block' : 'none';
          });
        }
        if (onSwitch) onSwitch(btn.dataset.tab);
        setTimeout(() => Charts.resizeAll(), 120);
      });
    });
  },

  renderCustomerTable(tbody, customers, opts = {}) {
    if (!tbody) return;
    tbody.innerHTML = customers.map(c => {
      const mom = ((c.value / c.prev - 1) * 100);
      return `<tr class="${opts.clickable ? 'clickable' : ''}" data-name="${c.name}" data-rank="${c.rank}">
        <td class="num-int">${c.rank}</td>
        <td>${opts.linkName ? `<span class="link-cell">${c.name}</span>` : c.name}</td>
        ${opts.prevRank ? `<td class="num-int">${c.rank + (c.rank % 2 ? 1 : -1)}</td>` : ''}
        <td class="num">${Cockpit.fmt.num(c.value)}</td>
        ${opts.showPrev ? `<td class="num">${Cockpit.fmt.num(c.prev)}</td>` : ''}
        ${opts.showMom ? `<td class="num ${mom >= 0 ? 'up' : 'down'}">${Cockpit.fmt.pct(mom)}</td>` : ''}
        <td class="num">${Cockpit.fmt.num(c.ratio, 1)}%</td>
      </tr>`;
    }).join('');
  },

  filterTableRows(tableId, attr, value) {
    const table = document.getElementById(tableId);
    if (!table) return;
    table.querySelectorAll('tbody tr').forEach(tr => {
      const match = !value || tr.dataset[attr] === value || tr.dataset[attr]?.includes(value);
      tr.classList.toggle('dimmed', !match);
      tr.classList.toggle('selected', !!value && match);
    });
    table.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  },

  openModal(title, contentHtml) {
    let overlay = document.getElementById('drill-modal');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'drill-modal';
      overlay.className = 'modal-overlay';
      overlay.innerHTML = `<div class="modal"><div class="modal-header"><h3 id="modal-title"></h3><button class="modal-close" onclick="Cockpit.closeModal()">&times;</button></div><div class="modal-body" id="modal-body"></div></div>`;
      document.body.appendChild(overlay);
      overlay.addEventListener('click', e => { if (e.target === overlay) Cockpit.closeModal(); });
    }
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-body').innerHTML = contentHtml;
    overlay.classList.add('open');
  },

  closeModal() {
    document.getElementById('drill-modal')?.classList.remove('open');
  },

  drillDetail(title, dimension) {
    const fb = document.getElementById('filter-bar');
    const date = fb?.querySelector('[data-filter="date"]')?.value || '2025-07';
    const rows = MockData.topCustomers.slice(0, 6).map((c, i) => `
      <tr><td>${date}</td><td>SMIC</td><td>Fab${i + 1}</td><td>${c.name}</td>
      <td class="num">${Cockpit.fmt.num(c.value * 0.85)}</td>
      <td class="num up">${Cockpit.fmt.pct(8 + i * 1.2)}</td>
      <td class="num ${i % 2 ? 'up' : 'down'}">${i % 2 ? '+' : '-'}${Cockpit.fmt.num(1 + i * 0.3, 1)}%</td></tr>
    `).join('');
    this.openModal(`${title} — 明细钻取`, `
      <div class="modal-filter">${fb ? fb.innerHTML : ''}</div>
      <p class="modal-hint">继承主页面时间参数（${date}）· 弹窗内筛选器可独立调整 · 维度：${dimension}</p>
      <table class="data-table table-fixed"><thead><tr><th>期间</th><th>BU</th><th>FAB</th><th>客户</th><th class="text-right">金额(亿)</th><th class="text-right">同比</th><th class="text-right">环比</th></tr></thead><tbody>${rows}</tbody></table>
      <div class="chart-box sm" id="modal-chart" style="margin-top:14px;height:220px"></div>
    `);
    this.bindFilterEvents(document.querySelector('.modal-filter'));
    setTimeout(() => {
      Charts.bar(document.getElementById('modal-chart'),
        MockData.revenueByBusiness.map(d => d.name),
        [{ name: '明细金额', data: MockData.revenueByBusiness.map(d => d.value), color: '#1890ff' }]
      );
      Charts.resizeAll();
    }, 150);
  },

  resizeCharts() { Charts.resizeAll(); },

  /** 启动前校验本地依赖（仅检查当前页面实际引用的脚本） */
  verifyAssets(extra = []) {
    const hasScript = (key) => !!document.querySelector(`script[src*="${key}"]`);
    const checks = [];

    if (hasScript('echarts.min.js')) {
      checks.push(['ECharts', !!(window.echarts || globalThis.echarts), 'assets/js/echarts.min.js']);
    }
    if (hasScript('mock-data.js')) {
      checks.push(['MockData', !!window.MockData, 'assets/js/mock-data.js']);
    }
    if (hasScript('charts.js')) {
      checks.push(['Charts', !!window.Charts, 'assets/js/charts.js']);
    }
    if (hasScript('dupont-data.js')) {
      checks.push(['DupontData', !!window.DupontData, 'assets/js/dupont-data.js']);
    }
    if (hasScript('dupont.js')) {
      checks.push(['Dupont', !!window.Dupont, 'assets/js/dupont.js']);
    }
    checks.push(['Cockpit', !!window.Cockpit, 'assets/js/common.js']);
    checks.push(...extra.map(([name, ok, path]) => [name, !!ok, path]));

    const missing = checks.filter(([, ok]) => !ok);
    if (!missing.length) return true;

    const loc = document.location.href.replace(/^file:\/\//, '');
    const hint = missing.map(([name, , path]) => {
      const ref = hasScript(path.split('/').pop() || path);
      return ref
        ? `${path}（已引用但未执行，请检查文件是否损坏）`
        : `${path}（页面未引用此脚本）`;
    }).join('、');

    this.showBootBanner(new Error(`本地脚本未加载：${hint}。当前页面：${loc}`));
    return false;
  },

  showBootBanner(err) {
    const list = Array.isArray(err) ? err : [{ name: '初始化', message: err?.message || String(err) }];
    const id = 'cockpit-boot-banner';
    if (document.getElementById(id)) return;
    const html = list.map(e => `<li><b>${e.name || '错误'}</b>：${e.message || e}</li>`).join('');
    document.body.insertAdjacentHTML('afterbegin',
      `<div id="${id}" class="boot-banner"><strong>页面资源加载异常</strong><ul>${html}</ul><span>请确认从「财经驾驶舱原型」文件夹内打开 HTML（路径含 assets 目录）；或双击「打开本地预览.command」用浏览器访问。</span></div>`);
  },

  _bootErrors: null
};

window.Cockpit = Cockpit;

/** 分步初始化，单步失败不阻断其余图表 */
function bootStep(name, fn) {
  try {
    return fn();
  } catch (e) {
    console.error('[Cockpit boot:' + name + ']', e);
    Cockpit._bootErrors = Cockpit._bootErrors || [];
    Cockpit._bootErrors.push({ name, message: e.message });
    return null;
  }
}

window.addEventListener('resize', () => { if (typeof Charts !== 'undefined') Charts.resizeAll(); });

function boot(fn, opts = {}) {
  const run = () => {
    Cockpit._bootErrors = [];
    try {
      if (!Cockpit.verifyAssets(opts.require || [])) {
        if (!opts._retried) {
          opts._retried = true;
          window.addEventListener('load', run, { once: true });
        }
        return;
      }
      fn();
      Cockpit.bindSubTabGroups();
      Cockpit.bindPanelToggles();
      if (Cockpit._bootErrors?.length) Cockpit.showBootBanner(Cockpit._bootErrors);
      const resize = () => { if (typeof Charts !== 'undefined') Charts.resizeAll(); };
      requestAnimationFrame(() => { resize(); setTimeout(resize, 120); setTimeout(resize, 400); setTimeout(resize, 900); });
    } catch (e) {
      console.error('[Cockpit boot error]', e);
      Cockpit.showBootBanner(e);
    }
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
  else run();
  window.addEventListener('load', () => setTimeout(() => { if (typeof Charts !== 'undefined') Charts.resizeAll(); }, 150));
}
