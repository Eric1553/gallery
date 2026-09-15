document.addEventListener('DOMContentLoaded', () => {
  normalizeV4Shell();
  ensureTopbarPeriod();
  // charts.js 自行 boot；此处不再重复 init，避免切换页感卡顿
  initTabs();
  initSubTabs();
  initFilters();
  initKpiNav();
  initKpiGridFill();
  initActionLinks();
  initHashTabs();
  wrapLegacyModuleCards();
  initSegmented();
  initExpandRows();
  initExport();
  initMonthlyReport();
  initRdView();
  initDataPanels();
  initBusinessTableFilters();
  initNavPrefetch();
  initPeriodFilters();
  initFanoutWorkbench();
  initKnowledgeDim();
  initHrFilters();
  initSiteScopeFilters();
  initShipPlan();
  initLingangOrgTree();
  initAcmSkipForm();
  parkFeedbackOverlay();
});

function normalizeV4Shell() {
  document.querySelectorAll('.brand p').forEach(el => {
    el.textContent = '盛美半导体 · 演示原型 v4.6';
  });
  document.querySelectorAll('[data-demo-ver]').forEach(el => {
    el.textContent = 'v4.6';
  });
}

/** KPI 按卡片数量铺满一行，避免 5 卡却留第 6 列空洞（需 important 才能压过 CSS） */
function initKpiGridFill() {
  document.querySelectorAll('.kpi-grid').forEach(grid => {
    const n = grid.querySelectorAll(':scope > .kpi-card').length;
    if (!n) return;
    const cols = window.matchMedia('(max-width: 560px)').matches
      ? 1
      : window.matchMedia('(max-width: 860px)').matches
        ? Math.min(2, n)
        : window.matchMedia('(max-width: 1280px)').matches
          ? Math.min(3, n)
          : n;
    grid.style.setProperty('grid-template-columns', `repeat(${cols}, minmax(0, 1fr))`, 'important');
  });
}

/** 用户点过反馈球/面板后，禁止再强制收起（embed 会默认展开，延迟 hide 会把刚打开的面板关掉） */
let dfbUserTouched = false;
document.addEventListener('pointerdown', (e) => {
  const t = e.target;
  if (t && t.closest && t.closest('.dfb-fab, .dfb-panel, .dfb-root, .dfb-float')) {
    dfbUserTouched = true;
  }
}, true);

/** 反馈台默认收起面板，只留 FAB；embed 晚于 DOMContentLoaded 挂载时只收起一次 */
function parkFeedbackOverlay() {
  const hideOnce = () => {
    if (dfbUserTouched) return;
    document.querySelectorAll('.dfb-panel').forEach(panel => {
      panel.hidden = true;
    });
    document.body.classList.remove('dfb-comment-mode', 'dfb-picking');
    document.querySelectorAll('.dfb-fab').forEach(fab => {
      fab.classList.remove('commenting', 'picking');
      if (/评论|点选/.test(fab.textContent || '')) fab.textContent = '反馈';
    });
  };
  hideOnce();
  if (document.querySelector('.dfb-panel')) return;
  const obs = new MutationObserver(() => {
    if (dfbUserTouched) {
      obs.disconnect();
      return;
    }
    if (document.querySelector('.dfb-panel')) {
      hideOnce();
      obs.disconnect();
    }
  });
  obs.observe(document.documentElement, { childList: true, subtree: true });
  setTimeout(() => obs.disconnect(), 8000);
}

function currentPageId() {
  return document.body.dataset.page
    || (location.pathname.split('/').pop() || '').replace(/\.html$/, '')
    || 'index';
}

/** 各模块顶栏统一年 / 季 / 月；Wet-RD 另加按周 */
function periodNeedsQuarter() {
  return true;
}

function yearSelectHtml() {
  return `<select data-period-year aria-label="年份">
    <option value="2025">2025 年</option>
    <option value="2026" selected>2026 年</option>
  </select>`;
}

function monthSelectHtml(page, selected = '06') {
  const months = Array.from({ length: 12 }, (_, i) => {
    const n = i + 1;
    const v = String(n).padStart(2, '0');
    return `<option value="${v}"${v === selected ? ' selected' : ''}>${n} 月</option>`;
  }).join('');
  const mtd = page === 'hr'
    ? `<optgroup label="滚动区间"><option value="mtd-half">近半月</option><option value="mtd-hy">近半年</option></optgroup>`
    : '';
  return `<select data-period-month aria-label="月份">
    <option value="all">全年</option>
    ${months}
    ${mtd}
  </select>`;
}

function quarterSelectHtml() {
  return `<select data-period-quarter aria-label="季度">
    <option value="Q1">1 季度</option>
    <option value="Q2" selected>2 季度</option>
    <option value="Q3">3 季度</option>
    <option value="Q4">4 季度</option>
  </select>`;
}

function grainSelectHtml(page) {
  const week = page === 'wet-rd' ? '<option value="week">按周</option>' : '';
  return `<select data-period-grain aria-label="统计口径">
    <option value="year">按年</option>
    <option value="quarter" selected>按季</option>
    <option value="month">按月</option>
    ${week}
  </select>`;
}

function ensureTopbarPeriod() {
  const host = document.querySelector('.topbar-actions') || document.querySelector('.rt-actions');
  if (!host) return;
  host.querySelectorAll('.chip').forEach(chip => {
    if (/数据截止|近半年/.test(chip.textContent || '')) chip.remove();
  });
  host.querySelectorAll('.topbar-period').forEach(el => el.remove());
  const page = currentPageId();
  const wrap = document.createElement('div');
  wrap.className = 'topbar-period';
  wrap.dataset.periodMode = periodNeedsQuarter(page) ? 'quarter' : 'month';
  if (periodNeedsQuarter(page)) {
    wrap.innerHTML = `<span>时间</span>${grainSelectHtml(page)}${yearSelectHtml()}${quarterSelectHtml()}${monthSelectHtml(page)}`;
  } else {
    wrap.innerHTML = `<span>时间</span>${yearSelectHtml()}${monthSelectHtml(page)}`;
  }
  host.insertBefore(wrap, host.firstChild);
  syncPeriodGrainUi();
}

function syncPeriodGrainUi() {
  const box = document.querySelector('.topbar-period');
  if (!box) return;
  const grainEl = box.querySelector('[data-period-grain]');
  const q = box.querySelector('[data-period-quarter]');
  const m = box.querySelector('[data-period-month]');
  const y = box.querySelector('[data-period-year]');
  if (!grainEl) {
    if (q) q.hidden = true;
    return;
  }
  const grain = grainEl.value;
  if (y) y.hidden = grain === 'week';
  if (q) q.hidden = grain !== 'quarter';
  if (m) m.hidden = grain !== 'month';
}

function readPeriodValue() {
  const box = document.querySelector('.topbar-period');
  if (!box) return '2026-06';
  const grain = box.querySelector('[data-period-grain]')?.value || 'month';
  const year = box.querySelector('[data-period-year]')?.value || '2026';
  const quarter = box.querySelector('[data-period-quarter]')?.value || 'Q2';
  const month = box.querySelector('[data-period-month]')?.value || '06';
  if (grain === 'year') return year;
  if (grain === 'quarter') return `${year}-${quarter}`;
  if (grain === 'week') return `${year}-W24`;
  if (month === 'all') return year;
  if (month === 'mtd-half' || month === 'mtd-hy') return month;
  return `${year}-${month}`;
}

function initBusinessTableFilters() {
  const docSite = document.getElementById('doc-site-filter');
  const docStages = document.getElementById('doc-stage-filter');
  const applyDocs = () => {
    if (!docSite || !docStages) return;
    const stage = docStages.querySelector('button.active')?.dataset.stage || '全部';
    document.querySelectorAll('#doc-project-table tbody tr[data-site], #doc-project-table > tr[data-site]').forEach(row => {
      const visible = (docSite.value === '全部' || row.dataset.site === docSite.value) && (stage === '全部' || row.dataset.stages.split(',').includes(stage));
      row.classList.toggle('is-hidden', !visible);
      const detail = row.nextElementSibling;
      if (detail?.classList.contains('detail-row')) detail.classList.toggle('is-hidden', !visible);
    });
  };
  docSite?.addEventListener('change', applyDocs);
  docStages?.querySelectorAll('button').forEach(button => button.addEventListener('click', () => setTimeout(applyDocs)));

  const changeProject = document.getElementById('change-project-filter');
  const changeSite = document.getElementById('change-site-filter');
  const applyChanges = () => {
    document.querySelectorAll('#change-file-table tbody tr, #change-file-table tr[data-project]').forEach(row => {
      const projectOk = !changeProject || changeProject.value === '全部项目' || row.dataset.project === changeProject.value;
      const siteOk = !changeSite || changeSite.value === '全部' || row.dataset.site === changeSite.value;
      row.classList.toggle('is-hidden', !(projectOk && siteOk));
    });
  };
  changeProject?.addEventListener('change', applyChanges);
  changeSite?.addEventListener('change', applyChanges);
}

/** 悬停/空闲预取模块页，减轻「点导航等半天」 */
function initNavPrefetch() {
  const seen = new Set();
  const prefetch = (href) => {
    if (!href || href.startsWith('#') || href.startsWith('http') || seen.has(href)) return;
    seen.add(href);
    const l = document.createElement('link');
    l.rel = 'prefetch';
    l.as = 'document';
    l.href = href;
    document.head.appendChild(l);
  };
  const bind = (el) => {
    const href = el.getAttribute('href') || el.dataset.href;
    if (!href) return;
    el.addEventListener('mouseenter', () => prefetch(href), { passive: true });
    el.addEventListener('touchstart', () => prefetch(href), { passive: true });
  };
  document.querySelectorAll('.nav a[href], a.mini-module-card[href], .kpi-card[data-href]').forEach(bind);
  const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 350));
  idle(() => {
    document.querySelectorAll('.nav a[href]').forEach(a => prefetch(a.getAttribute('href')));
    ['assets/style.css?v=70', 'assets/charts.js?v=68', 'assets/app.js?v=70'].forEach(href => {
      if (seen.has(href)) return;
      seen.add(href);
      const l = document.createElement('link');
      l.rel = 'prefetch';
      l.href = href;
      document.head.appendChild(l);
    });
  });
}

function wrapLegacyModuleCards() {
  document.querySelectorAll('.module-card').forEach(card => {
    if (card.querySelector('.mc-header')) return;
    const icon = card.querySelector(':scope > .mc-icon');
    const h3 = card.querySelector(':scope > h3');
    const p = card.querySelector(':scope > p');
    const meta = card.querySelector(':scope > .mc-meta');
    if (!h3) return;
    const header = document.createElement('div');
    header.className = 'mc-header';
    if (icon) header.appendChild(icon.cloneNode(true));
    const titleWrap = document.createElement('div');
    titleWrap.appendChild(h3.cloneNode(true));
    header.appendChild(titleWrap);
    const body = document.createElement('div');
    body.className = 'mc-body';
    if (p) body.appendChild(p.cloneNode(true));
    if (meta) body.appendChild(meta.cloneNode(true));
    card.replaceChildren();
    card.appendChild(header);
    card.appendChild(body);
  });
}

function initTabs() {
  document.querySelectorAll('.tabs').forEach(tabBar => {
    tabBar.setAttribute('role', 'tablist');
    tabBar.querySelectorAll('.tab').forEach(tab => {
      const target = document.getElementById(tab.dataset.target);
      tab.setAttribute('role', 'tab');
      tab.setAttribute('aria-selected', tab.classList.contains('active') ? 'true' : 'false');
      if (target) {
        if (!target.id) target.id = `tab-panel-${Math.random().toString(36).slice(2)}`;
        tab.setAttribute('aria-controls', target.id);
        target.setAttribute('role', 'tabpanel');
      }
      tab.addEventListener('click', () => {
        const group = tab.dataset.group || 'default';
        tabBar.querySelectorAll('.tab').forEach(t => {
          t.classList.remove('active');
          t.setAttribute('aria-selected', 'false');
        });
        tab.classList.add('active');
        tab.setAttribute('aria-selected', 'true');
        document.querySelectorAll(`.tab-content[data-group="${group}"]`).forEach(c => c.classList.remove('active'));
        if (target) {
          target.classList.add('active');
          // 首屏 hash 激活不强制重绘（由 charts boot 负责）；用户点 Tab 时仅补绘新露出图表
          if (!window.__chartsSkipRefresh) refreshChartsSoon();
        }
        updateExportVisibility();
        if (tab.dataset.hash) {
          history.replaceState(null, '', '#' + tab.dataset.hash);
        }
      });
    });
  });
}

function initSubTabs() {
  document.querySelectorAll('.sub-tabs').forEach(bar => {
    bar.querySelectorAll('.sub-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        const group = btn.dataset.subGroup;
        bar.querySelectorAll('.sub-tab').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        document.querySelectorAll(`.sub-panel[data-sub-group="${group}"]`).forEach(p => {
          p.style.display = p.dataset.subTarget === btn.dataset.subTarget ? 'block' : 'none';
        });
        refreshChartsSoon();
      });
    });
  });
}

function initFilters() {
  document.querySelectorAll('.filter-bar').forEach(bar => {
    if (bar.dataset.filterLive === 'true') return;
    const timeControls = new Set();
    bar.querySelectorAll('.filter-group').forEach(group => {
      const name = (group.querySelector('label')?.textContent || '').trim();
      if (/时间|数据周期/.test(name) || group.querySelector('[data-period], [data-period-seg]')) {
        group.querySelectorAll('select,input,button').forEach(c => timeControls.add(c));
      }
    });
    bar.querySelectorAll('select,input,button').forEach(control => {
      if (timeControls.has(control) || control.hasAttribute('data-period')) return;
      control.disabled = true;
      control.setAttribute('aria-disabled', 'true');
    });
    if (!bar.querySelector('.filter-scope-label')) {
      const label = document.createElement('span');
      label.className = 'chip filter-scope-label';
      label.textContent = '时间可筛选 · 其余为演示条件';
      bar.prepend(label);
    }
  });
}

function initKpiNav() {
  document.querySelectorAll('.kpi-card[data-href]').forEach(card => {
    card.classList.add('clickable');
    card.setAttribute('role', 'link');
    card.tabIndex = 0;
    card.addEventListener('click', () => { window.location.href = card.dataset.href; });
    card.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        window.location.href = card.dataset.href;
      }
    });
  });
}

function initActionLinks() {
  document.querySelectorAll('[data-action]').forEach(el => {
    if (el.dataset.bound) return;
    el.dataset.bound = '1';
    el.addEventListener('click', e => {
      e.preventDefault();
      if (el.dataset.action === 'req') e.stopPropagation();
      const action = el.dataset.action;
      if (action === 'drill') { openDrillModal(el); return; }
      if (action === 'export') { openExportMenu(el); return; }
      if (action === 'monthly-report') { window.location.href = 'report.html'; return; }
      if (action === 'req') { openReqModal(); return; }
      if (action === 'personal') { openPersonalView(el); return; }
      if (action === 'page') { window.location.href = el.dataset.href || '#'; return; }
      showToast('已应用筛选');
    });
  });
}

/* ── Segmented view controls ── */
function initSegmented() {
  document.querySelectorAll('.segmented').forEach(seg => {
    seg.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => {
        seg.querySelectorAll('button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });
  });
}

/* ── Expandable detail rows ── */
function initExpandRows() {
  document.querySelectorAll('tr.expand-row').forEach(row => {
    if (row.dataset.bound) return;
    row.dataset.bound = '1';
    row.tabIndex = 0;
    row.setAttribute('role', 'button');
    row.setAttribute('aria-expanded', 'false');
    const toggle = () => {
      const next = row.nextElementSibling;
      if (next && next.classList.contains('detail-row')) {
        const open = row.classList.toggle('open');
        next.style.display = open ? 'table-row' : 'none';
        row.setAttribute('aria-expanded', open ? 'true' : 'false');
      }
    };
    row.addEventListener('click', event => {
      if (event.target.closest('a,button,select,input')) return;
      toggle();
    });
    row.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        toggle();
      }
    });
  });
}

/* ── Export menu ── */
function initExport() {
  updateExportVisibility();
}
function updateExportVisibility() {
  document.querySelectorAll('[data-action="export"]').forEach(control => {
    const panelTable = control.closest('.panel')?.querySelector('table');
    const hasTable = panelTable
      ? panelTable.offsetParent !== null
      : Array.from(document.querySelectorAll('table')).some(table => table.offsetParent !== null && table.querySelector('tr'));
    control.hidden = !hasTable;
    control.setAttribute('aria-hidden', hasTable ? 'false' : 'true');
  });
}
function openExportMenu(anchor) {
  closeFloat();
  const menu = document.createElement('div');
  menu.className = 'float-menu';
  menu.style.cssText = 'position:absolute;z-index:9997;background:#fff;border:1px solid var(--border);border-radius:12px;box-shadow:var(--shadow-md);padding:6px;min-width:180px;font-family:var(--font);animation:slideDown .18s ease';
  const table = findVisibleTable(anchor);
  if (!table) return;
  ['下载当前表格 CSV', '打印 / 存为 PDF'].forEach(t => {
    const item = document.createElement('div');
    item.textContent = t;
    item.style.cssText = 'padding:9px 12px;border-radius:8px;font-size:12.5px;font-weight:500;color:var(--text-secondary);cursor:pointer;transition:background .15s';
    item.onmouseenter = () => item.style.background = 'var(--surface-3)';
    item.onmouseleave = () => item.style.background = 'transparent';
    item.onclick = () => {
      closeFloat();
      if (t.startsWith('下载')) downloadTableCsv(table);
      else window.print();
    };
    menu.appendChild(item);
  });
  document.body.appendChild(menu);
  const r = anchor.getBoundingClientRect();
  menu.style.top = (r.bottom + window.scrollY + 6) + 'px';
  menu.style.left = Math.min(r.left + window.scrollX, window.innerWidth - 200) + 'px';
  setTimeout(() => document.addEventListener('click', closeFloat, { once: true }), 0);
}
function closeFloat() { document.querySelectorAll('.float-menu').forEach(m => m.remove()); }

function findVisibleTable(anchor) {
  const panelTable = anchor.closest('.panel')?.querySelector('table');
  if (panelTable && panelTable.offsetParent !== null) return panelTable;
  return Array.from(document.querySelectorAll('table')).find(table => table.offsetParent !== null && table.querySelector('tr'));
}

function downloadTableCsv(table) {
  if (!table) return;
  const rows = Array.from(table.rows).filter(row => !row.hidden && row.offsetParent !== null).map(row =>
    Array.from(row.cells).map(cell => {
      const select = cell.querySelector('select');
      const value = select ? select.options[select.selectedIndex]?.text || '' : cell.innerText.trim();
      return `"${value.replaceAll('"', '""')}"`;
    }).join(',')
  );
  const blob = new Blob(['\ufeff' + rows.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${document.title.replace(/\s+/g, '-')}-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  showToast(`已下载 ${rows.length - 1} 行当前可见数据`);
}

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

/* ── Drill / detail modal ── */
function openDrillModal(el) {
  const title = el.dataset.title || '明细数据';
  const sub = el.dataset.sub || '演示数据';
  const cols = (el.dataset.cols || '项目号,Site,产品类别,状态,耗时(天),负责人').split(',');
  const rows = el.dataset.rows ? JSON.parse(el.dataset.rows) : presetDrillRows(title, cols);
  const thead = '<tr>' + cols.map(c => `<th>${escapeHtml(c.trim())}</th>`).join('') + '</tr>';
  const tbody = rows.map(r => '<tr>' + r.map(c => `<td>${escapeHtml(c)}</td>`).join('') + '</tr>').join('');
  openModal(title, sub, `
    <div class="toolbar" style="margin-bottom:14px;justify-content:flex-end">
      <button class="btn" data-action="export">下载当前明细 CSV</button>
    </div>
    <div class="panel" style="box-shadow:none">
      <div class="panel-body flush table-scroll"><table>${thead}${tbody}</table></div>
    </div>`);
  if (cols.length >= 10) {
    document.querySelector('#app-modal .modal')?.classList.add('wide');
  }
  initActionLinks();
}
function presetDrillRows(title, cols) {
  const stepPresets = {
    'TSMC-N28': [
      ['EQP-2201', 'CMP-06', 'POR', '已发布', 'Step 06/8', 'LOOP-3', 'T3→RLS', 'Cu CMP 主抛', 'CMP-N28-B3', 'Downforce 3.2psi / slurry ACM-S3', 'WET-CMP', 'ACM', '演示'],
      ['EQP-2202', 'CLN-04', 'POR', '已发布', 'Step 04/6', 'LOOP-2', 'RLS', 'Pre-clean', 'CLN-N28-A2', 'SC1 65°C / 90s', 'WET-Clean', 'ACM', '演示'],
      ['EQP-2208', 'ETC-06', 'POR', '待 Release', 'Step 06/8', 'LOOP-3', 'T3', 'Etch 主刻蚀', 'ETC-N28-D1', 'CF4 40sccm · 演示', 'Etch', 'TEL', '待 Release Step 06'],
      ['EQP-2210', 'PLT-04', 'POR', '待 Release', 'Step 04/7', 'LOOP-3', 'T2', 'Cu plating', 'PLT-N28-B1', 'Current 1.8A · 演示', 'ECP', 'DNS', '待 Release Step 04']
    ],
    'SMIC-14': [
      ['EQP-1401', 'CMP-05', 'POR', '已发布', 'Step 05/6', 'LOOP-2', 'RLS', 'Cu CMP', 'CMP-14-A3', '2.6psi / ACM-S2', 'WET-CMP', 'ACM', '演示'],
      ['EQP-1407', 'CLN-03', 'POR', '待 Release', 'Step 03/6', 'LOOP-2', 'T2', 'Pre-clean 去胶', 'CLN-14-A1', 'SC1 65°C / 120s', 'WET-Clean', 'DNS', '待 Release Step 03'],
      ['EQP-1408', 'ETC-02', 'POR', '已发布', 'Step 02/5', 'LOOP-1', 'RLS', 'Etch', '—', '—', 'Etch', 'LAM', 'ACM未涉及 · 演示']
    ],
    'Intel-A16': [
      ['EQP-A161', 'ETC-04', 'POR', '已发布', 'Step 04/7', 'LOOP-1', 'RLS', 'Etch 主刻蚀', '—', '—', 'Etch', 'LAM', 'ACM未涉及 · EQP-A161'],
      ['EQP-A163', 'CLN-05', 'POR', '待 Release', 'Step 05/7', 'LOOP-1', 'T1', 'Post-etch clean', '—', '—', 'WET-Clean', 'TEL', 'ACM未涉及 · EQP-A163'],
      ['EQP-A165', 'CMP-02', 'POR', '待 Release', 'Step 02/7', 'LOOP-1', 'T1', 'Cu CMP', '—', '—', 'WET-CMP', 'DNS', 'ACM未涉及 · EQP-A165']
    ],
    'Samsung-V4': [
      ['EQP-V401', 'CMP-05', 'POR', '已发布', 'Step 05/6', 'LOOP-2', 'T3', 'CMP 终点检测', 'CMP-V4-C2', 'Pad IC1000 / 2.8psi', 'WET-CMP', 'ACM', '演示'],
      ['EQP-V404', 'CMP-06', 'POR', '待 Release', 'Step 06/6', 'LOOP-2', 'T3', 'Barrier CMP', 'CMP-V4-C3', '2.4psi · 演示', 'WET-CMP', 'TEL', '待 Release Step 05']
    ]
  };
  const stepKey = Object.keys(stepPresets).find(k => title.includes(k));
  if (stepKey) {
    return stepPresets[stepKey].map(row => cols.map((_, i) => row[i] ?? '—'));
  }
  const presets = {
    'IC1 组': [['RD-2026-061', '新工艺开发', '张**', '进行中', '42天', '演示账套'], ['RD-2026-038', '工艺优化', '张**', '已关闭', '45天', '演示账套']],
    'IC2 组': [['RD-2026-058', '工艺优化', '李**', '已关闭', '36天', '演示账套']],
    '湿法产品部': [['EXT-2026-031', '客户A', '湿法-CMP', '已归档', '2026-03'], ['EXT-2026-028', '客户B', '湿法-Clean', '进行中', '2026-04'], ['EXT-2026-022', '客户C', '湿法-ECP', '已归档', '2026-05'], ['EXT-2026-019', '客户A', '湿法-Bevel', '进行中', '2026-06']],
    '湿法-CMP': [['EXT-2026-031', '客户A', '湿法-CMP', '已归档', '2026-03'], ['EXT-2026-024', '客户B', '湿法-CMP', '进行中', '2026-05']],
    'TSMC': [['P-2026-0142', 'TSMC', 'WET-CMP', '进行中', '91%', '张**'], ['P-2026-0188', 'TSMC', 'ECP', '已归档', '86%', '李**']],
    'SMIC': [['P-2025-0887', 'SMIC', 'Track', '已归档', '94%', '刘**']]
  };
  const key = Object.keys(presets).find(k => title.includes(k));
  const rows = key ? presets[key] : [['DEMO-001', '演示数据', '当前筛选项', '待数据接入', '—', '—']];
  return rows.map(row => cols.map((_, i) => row[i] ?? '—'));
}

/* ── Requirement spec modal ── */
function openReqModal() {
  const data = document.getElementById('req-spec-data');
  if (!data) { showToast('暂无需求说明'); return; }
  openModal(data.dataset.title || '需求说明', data.dataset.sub || '本看板对应的原始业务需求', data.innerHTML);
}

/* ── Modal core ── */
function openModal(title, sub, bodyHTML, footHTML) {
  let bd = document.getElementById('app-modal');
  if (!bd) {
    bd = document.createElement('div');
    bd.id = 'app-modal';
    bd.className = 'modal-backdrop';
    document.body.appendChild(bd);
    bd.addEventListener('click', e => {
      if (Number(bd.dataset.ignoreUntil || 0) > Date.now()) return;
      if (e.target === bd) closeModal();
    });
  }
  bd.dataset.ignoreUntil = String(Date.now() + 400);
  bd.replaceChildren();
  const modal = document.createElement('div');
  modal.className = 'modal';
  const head = document.createElement('div');
  head.className = 'modal-head';
  const heading = document.createElement('div');
  const h3 = document.createElement('h3');
  h3.textContent = title;
  const subtitle = document.createElement('div');
  subtitle.className = 'modal-sub';
  subtitle.textContent = sub || '';
  heading.append(h3, subtitle);
  const closeButton = document.createElement('button');
  closeButton.className = 'modal-close';
  closeButton.type = 'button';
  closeButton.setAttribute('aria-label', '关闭');
  closeButton.textContent = '关闭';
  closeButton.addEventListener('click', closeModal);
  head.append(heading, closeButton);
  const body = document.createElement('div');
  body.className = 'modal-body';
  body.innerHTML = bodyHTML;
  modal.append(head, body);
  if (footHTML) {
    const foot = document.createElement('div');
    foot.className = 'modal-foot';
    foot.innerHTML = footHTML;
    modal.appendChild(foot);
  }
  bd.appendChild(modal);
  requestAnimationFrame(() => bd.classList.add('show'));
}
function closeModal() {
  const bd = document.getElementById('app-modal');
  if (bd) bd.classList.remove('show');
}

function initMonthlyReport() {
  document.querySelectorAll('[data-action="monthly-report"]').forEach(button => {
    button.title = '直接打开预置的月度运营报告';
  });
}

function initHashTabs() {
  const currentPage = () => {
    const part = (location.pathname.split('/').pop() || 'index.html').split('?')[0];
    return part || 'index.html';
  };
  const activate = hashValue => {
    const hash = String(hashValue || '').replace(/^.*#/, '').trim();
    if (!hash) return false;
    const tab = document.querySelector(`.tab[data-hash="${CSS.escape(hash)}"]`);
    if (!tab) return false;
    window.__chartsSkipRefresh = true;
    try { tab.click(); } finally { window.__chartsSkipRefresh = false; }
    const panel = document.getElementById(tab.dataset.target);
    if (panel) panel.scrollIntoView({ block: 'start', behavior: 'smooth' });
    // 首屏：只切 Tab，交给 charts boot 一次绘制。已 boot 后的 hash 切换才补绘。
    if (window.DashboardCharts && window.DashboardCharts.ready) refreshChartsSoon();
    return true;
  };
  // ECS gallery injects <base href="/demos/acme-rd/">; bare "#fanout" would jump to index.
  // Prefer page#hash links, and intercept same-page hash activation before navigation.
  document.querySelectorAll('a[href*="#"]').forEach(link => {
    link.addEventListener('click', event => {
      const href = link.getAttribute('href') || '';
      if (!href.includes('#') || href.startsWith('http')) return;
      const [pagePart, hash = ''] = href.split('#');
      if (!hash) return;
      const page = (pagePart || '').split('/').pop();
      if (page && page !== currentPage()) return;
      if (!activate(hash)) return;
      event.preventDefault();
      history.replaceState(null, '', `${currentPage()}#${hash}`);
    });
  });
  activate(location.hash);
  window.addEventListener('hashchange', () => activate(location.hash));
}

function showToast(text) {
  let t = document.getElementById('proto-toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'proto-toast';
    t.style.cssText = 'position:fixed;bottom:28px;right:28px;background:#0f172a;color:#f8fafc;padding:14px 20px;border-radius:12px;font-size:13px;font-weight:500;z-index:9999;box-shadow:0 10px 40px rgba(0,0,0,.2);max-width:340px;transition:opacity .3s,transform .3s;font-family:var(--font),sans-serif';
    document.body.appendChild(t);
  }
  t.textContent = text;
  t.style.opacity = '1';
  t.style.transform = 'translateY(0)';
  clearTimeout(t._timer);
  t._timer = setTimeout(() => {
    t.style.opacity = '0';
    t.style.transform = 'translateY(8px)';
  }, 2800);
}

function setActiveNav(page) {
  document.querySelectorAll('.nav a').forEach(a => {
    a.classList.toggle('active', a.dataset.page === page);
  });
}

/* ── Wet-RD 研发需求 segmented 切换 ── */
function initRdView() {
  document.querySelectorAll('[data-rd-panel]').forEach(panel => {
    const seg = panel.closest('.panel')?.querySelector('.segmented[data-rd-seg]');
    if (!seg) return;
    seg.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => {
        seg.querySelectorAll('button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const view = btn.dataset.rdView || 'group';
        panel.querySelectorAll('[data-rd-pane]').forEach(v => {
          const on = v.dataset.rdPane === view;
          v.classList.toggle('is-hidden', !on);
          v.hidden = !on;
        });
        refreshChartsSoon();
      });
    });
  });
}

/* ── 数据面板切换（Case By 产品/Site 等） ── */
function initDataPanels() {
  document.querySelectorAll('.segmented[data-panel-seg]').forEach(seg => {
    const targetId = seg.dataset.panelSeg;
    seg.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => {
        seg.querySelectorAll('button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        document.querySelectorAll(`[data-panel-group="${targetId}"]`).forEach(p => {
          const on = p.dataset.panelView === btn.dataset.panelView;
          p.classList.toggle('is-hidden', !on);
          if (!on) p.hidden = true;
          else p.hidden = false;
        });
        refreshChartsSoon();
      });
    });
  });
}

/** 布局稳定后再补绘，避免与 charts 首屏 boot / ResizeObserver 叠成二次刷新 */
function refreshChartsSoon(force) {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (window.DashboardCharts) DashboardCharts.init(!!force);
    });
  });
}

function invalidateCharts() {
  document.querySelectorAll('.chart-wrap, [data-sparkline]').forEach(el => {
    el.classList.remove('chart-rendered');
    delete el.dataset.chartW;
    if (el.hasAttribute('data-sparkline')) el.replaceChildren();
  });
}

/* ── OA 个人流程耗时视图 ── */
function openPersonalView(el) {
  const person = el.dataset.person || '王**';
  const dept = el.dataset.dept || '工艺验证部';
  openModal('个人流程耗时 · ' + person, dept + ' · 演示数据',
    `<div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:18px">
      <div class="kpi-card accent-blue"><div class="kpi-label">进行中流程</div><div class="kpi-value">5</div></div>
      <div class="kpi-card accent-amber"><div class="kpi-label">平均节点耗时</div><div class="kpi-value">4.2<small>天</small></div></div>
      <div class="kpi-card accent-purple"><div class="kpi-label">Hold 流程</div><div class="kpi-value">3</div></div>
      <div class="kpi-card accent-green"><div class="kpi-label">本月已归档</div><div class="kpi-value">12</div></div>
    </div>
    <div class="panel" style="box-shadow:none;margin-bottom:16px">
      <div class="panel-head"><h3>个人流程明细</h3></div>
      <div class="panel-body flush"><table>
        <tr><th>流程类型</th><th>流程编号</th><th>当前节点</th><th>已耗时</th><th>是否超时</th></tr>
        <tr class="highlight-row"><td>Checksheet</td><td>CS-2026-061</td><td>PE Owner 审批</td><td>12 天</td><td><span class="tag tag-warn">是</span></td></tr>
        <tr><td>Spec 新增</td><td>SP-2026-088</td><td>产品验证</td><td>6 天</td><td><span class="tag tag-close">否</span></td></tr>
        <tr><td>Case</td><td>CASE-2026-089</td><td>PM 评审</td><td>8 天</td><td><span class="tag tag-open">关注</span></td></tr>
      </table></div>
    </div>
    <div class="alert-box info">推送规则：每周三 09:00 汇总个人平均耗时；超时流程即时提醒</div>`,
    `<button class="btn" onclick="closeModal()">关闭</button><button class="btn btn-primary" onclick="showToast('已订阅 ${person} 的流程耗时周报')">订阅周报</button>`);
}

function openPushSettings() {
  openModal('流程提醒推送配置', '个人 / 部门流程耗时定时推送 · 群通知 / 邮件',
    `<div class="panel" style="box-shadow:none">
      <div class="panel-body flush"><table>
        <tr><th>推送类型</th><th>频率</th><th>渠道</th><th>对象</th><th>状态</th></tr>
        <tr><td>个人平均耗时周报</td><td>每周三 09:00</td><td>企业微信 + 邮件</td><td>流程经办人</td><td><span class="tag tag-close">已启用</span></td></tr>
        <tr><td>超时流程即时提醒</td><td>实时（Hold &gt; 3 天）</td><td>企业微信</td><td>经办人 + 直属主管</td><td><span class="tag tag-close">已启用</span></td></tr>
        <tr><td>部门归档率月报</td><td>每月 1 日</td><td>邮件</td><td>部门负责人</td><td><span class="tag tag-open">待启用</span></td></tr>
      </table></div>
    </div>
    <p class="chart-footnote" style="text-align:left;margin-top:12px">超时提醒次数按 OA 推送记录统计</p>`,
    `<button class="btn" onclick="closeModal()">关闭</button>`);
}
window.openPushSettings = openPushSettings;

function periodLabelOf(value) {
  const raw = String(value || '');
  if (raw === 'mtd-half') return '近半月';
  if (raw === 'mtd-hy') return '近半年';
  const week = raw.match(/^(\d{4})-W(\d{2})$/);
  if (week) return `${week[1]} 年第 ${Number(week[2])} 周`;
  const yq = raw.match(/^(\d{4})-Q([1-4])$/);
  if (yq) return `${yq[1]} 年 ${yq[2]} 季度`;
  const qOnly = raw.match(/^Q([1-4])$/);
  if (qOnly) return `2026 年 ${qOnly[1]} 季度`;
  const month = raw.match(/^(\d{4})-(\d{2})$/);
  if (month) return `${month[1]} 年 ${Number(month[2])} 月`;
  if (/^\d{4}$/.test(raw)) return `${raw} 年`;
  return raw;
}

function periodSeed(value) {
  const s = String(value || '');
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return Math.abs(h);
}

/** 演示切片系数：基准期保持原稿数字，其余区间确定性偏移 */
function periodFactor(value) {
  const v = String(value || '');
  if (v === '2026-Q2' || v === '2026-06') return 1;
  if (v === '2026') return 1.68;
  if (v === '2025') return 1.42;
  if (v === 'mtd-half') return 0.38;
  if (v === 'mtd-hy') return 0.86;
  if (v === '2026-Q1') return 0.79;
  if (v === '2026-Q3') return 1.11;
  if (v === '2026-Q4') return 0.93;
  if (v === '2025-Q2') return 0.84;
  const seed = periodSeed(v);
  let f = 0.64 + (seed % 52) / 100;
  if (v.startsWith('2025')) f *= 0.88;
  return Math.round(f * 100) / 100;
}

function scaleDemoNumber(n, factor, asPercent) {
  if (!Number.isFinite(n)) return n;
  let next = n * factor;
  if (asPercent) next = Math.min(99.4, Math.max(24, next));
  if (Number.isInteger(n)) return Math.max(n === 0 ? 0 : 1, Math.round(next));
  return Math.round(next * 10) / 10;
}

function scaleKpiText(text, factor) {
  const raw = String(text || '');
  const m = raw.match(/^(\s*)([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]+)?)(.*)$/);
  if (!m) return raw;
  const num = parseFloat(m[2].replace(/,/g, ''));
  if (!Number.isFinite(num)) return raw;
  const suffix = m[3] || '';
  const asPercent = /%/.test(suffix) || /%/.test(raw);
  const next = scaleDemoNumber(num, factor, asPercent);
  const hasComma = m[2].includes(',');
  const hasDot = m[2].includes('.');
  const formatted = hasDot
    ? (Number.isInteger(num) ? String(next) : Number(next).toFixed(1))
    : (hasComma ? Number(next).toLocaleString('zh-CN') : String(next));
  return m[1] + formatted + suffix;
}

function scaleChartPayload(raw, factor, percentHint) {
  let data;
  try { data = JSON.parse(raw); } catch (e) { return raw; }
  const pct = !!percentHint;
  const scaleVal = (v, itemPct) => scaleDemoNumber(v, factor, pct || itemPct);
  if (Array.isArray(data)) {
    return JSON.stringify(data.map(item => {
      if (item && typeof item === 'object' && typeof item.v === 'number') {
        return { ...item, v: scaleVal(item.v, item.unit === '%') };
      }
      if (typeof item === 'number') return scaleVal(item, false);
      return item;
    }));
  }
  if (data && Array.isArray(data.groups)) {
    return JSON.stringify({
      ...data,
      groups: data.groups.map(g => ({
        ...g,
        values: (g.values || []).map(v => scaleVal(v, false))
      }))
    });
  }
  if (data && Array.isArray(data.series)) {
    return JSON.stringify({
      ...data,
      series: data.series.map(s => ({
        ...s,
        data: (s.data || []).map(v => scaleVal(v, false))
      }))
    });
  }
  return raw;
}

function rememberPeriodBase() {
  document.querySelectorAll('.kpi-value').forEach(el => {
    if (el.dataset.periodBase == null) el.dataset.periodBase = el.textContent.trim();
  });
  document.querySelectorAll('[data-period-num]').forEach(el => {
    if (el.dataset.periodBase == null) el.dataset.periodBase = el.textContent.trim();
  });
  document.querySelectorAll('[data-bars], [data-hbars], [data-group-bars], [data-donut], [data-line], [data-sparkline]').forEach(el => {
    ['bars', 'hbars', 'groupBars', 'donut', 'line', 'sparkline', 'total'].forEach(key => {
      const live = el.dataset[key];
      const baseKey = 'periodBase' + key.charAt(0).toUpperCase() + key.slice(1);
      if (live != null && el.dataset[baseKey] == null) el.dataset[baseKey] = live;
    });
  });
}

function applyPeriodSlice(value) {
  const factor = periodFactor(value);
  const first = document.body.dataset.periodApplied !== '1';
  document.body.dataset.periodApplied = '1';
  rememberPeriodBase();
  document.querySelectorAll('.kpi-value').forEach(el => {
    el.textContent = scaleKpiText(el.dataset.periodBase || el.textContent, factor);
  });
  document.querySelectorAll('[data-period-num]').forEach(el => {
    el.textContent = scaleKpiText(el.dataset.periodBase || el.textContent, factor);
  });
  document.querySelectorAll('[data-bars], [data-hbars], [data-group-bars], [data-donut], [data-line], [data-sparkline]').forEach(el => {
    const percent = el.hasAttribute('data-percent');
    const map = [
      ['bars', 'periodBaseBars'],
      ['hbars', 'periodBaseHbars'],
      ['groupBars', 'periodBaseGroupBars'],
      ['donut', 'periodBaseDonut'],
      ['line', 'periodBaseLine'],
      ['sparkline', 'periodBaseSparkline']
    ];
    map.forEach(([live, base]) => {
      if (el.dataset[base] != null) el.dataset[live] = scaleChartPayload(el.dataset[base], factor, percent);
    });
    if (el.dataset.periodBaseTotal != null) {
      el.dataset.total = scaleKpiText(el.dataset.periodBaseTotal, factor);
    }
  });
  if (first && factor === 1) return;
  invalidateCharts();
  refreshChartsSoon(true);
}

function ensurePeriodBanner() {
  if (document.querySelector('[data-period-banner]')) return;
  const content = document.querySelector('.content, .paper');
  if (!content) return;
  const banner = document.createElement('div');
  banner.className = 'demo-banner';
  banner.setAttribute('data-period-banner', '');
  const header = content.querySelector('.page-header, .overview-head, .r-cover');
  if (header && header.parentElement === content) content.insertBefore(banner, header.nextSibling);
  else content.insertBefore(banner, content.firstChild);
}

function initPeriodFilters() {
  const apply = (value, silent) => {
    const period = value || readPeriodValue();
    const text = periodLabelOf(period);
    ensurePeriodBanner();
    document.querySelectorAll('[data-period-banner]').forEach(banner => {
      banner.textContent = `数据周期：${text}（演示口径，按所选区间统计）`;
    });
    document.querySelectorAll('[data-period-asof]').forEach(el => {
      el.textContent = el.dataset.periodAsof.replace('{period}', text);
    });
    applyPeriodSlice(period);
    if (!silent) showToast(`已切换时间范围：${text}`);
  };
  const box = document.querySelector('.topbar-period');
  box?.querySelectorAll('select').forEach(select => {
    if (select.dataset.periodBound) return;
    select.dataset.periodBound = '1';
    select.disabled = false;
    select.removeAttribute('aria-disabled');
    select.addEventListener('change', () => {
      if (select.hasAttribute('data-period-grain')) syncPeriodGrainUi();
      apply(readPeriodValue());
    });
  });
  syncPeriodGrainUi();
  apply(readPeriodValue(), true);
  document.querySelectorAll('.filter-bar .btn-apply').forEach(btn => {
    if (btn.closest('[data-filter-live="true"]')) return;
    btn.disabled = false;
    btn.removeAttribute('aria-disabled');
    if (btn.dataset.periodBound) return;
    btn.dataset.periodBound = '1';
    btn.addEventListener('click', event => {
      event.preventDefault();
      event.stopImmediatePropagation();
      apply(readPeriodValue());
    });
  });
}

function initFanoutWorkbench() {
  const roleBox = document.getElementById('fo-auto-role');
  const scope = document.getElementById('fo-scope');
  const klass = document.getElementById('fo-class');
  const category = document.getElementById('fo-category');
  const refreshRole = () => {
    if (!roleBox || !klass || !category) return;
    const cls = klass.value;
    const cat = category.value;
    const inner = scope?.value === '内部';
    let owner = '工艺产品经理 周**';
    let summary = '工艺产品经理（工艺类 + 软件类）';
    if (['安全类', '质量类', '硬件类'].includes(cls) || cat === '硬件') {
      owner = '设备产品经理 吴**';
      summary = '设备产品经理（安全 / 质量 / 硬件）';
    }
    if (cat === '项目' || inner) {
      owner = inner ? `${owner} / 项目经理 陈**` : owner;
      if (inner) summary = `项目经理汇总公司内；同时抄送 ${summary}`;
    }
    roleBox.textContent = `关联：${owner} · 执行汇总归 ${summary}`;
  };
  [scope, klass, category].forEach(el => el?.addEventListener('change', refreshRole));
  refreshRole();
  document.getElementById('fo-submit')?.addEventListener('click', () => {
    showToast('申请已写入演示清单（未对接 OA）');
  });

  const regionRows = Array.from(document.querySelectorAll('#fo-region-table tbody tr'));
  const regionCount = document.getElementById('fo-region-count');
  const applyRegion = () => {
    const s = document.getElementById('fo-region-scope')?.value || '';
    const c = document.getElementById('fo-region-class')?.value || '';
    const a = document.getElementById('fo-region-area')?.value || '';
    let n = 0;
    regionRows.forEach(row => {
      const ok = (!s || row.dataset.scope === s) && (!c || row.dataset.class === c) && (!a || row.dataset.area === a);
      row.hidden = !ok;
      if (ok) n += 1;
    });
    if (regionCount) regionCount.textContent = `当前 ${n} 单`;
  };
  ['fo-region-scope', 'fo-region-class', 'fo-region-area'].forEach(id => {
    document.getElementById(id)?.addEventListener('change', applyRegion);
  });
  document.querySelectorAll('#fo-region-table input[type="checkbox"]').forEach(box => {
    box.addEventListener('change', () => {
      const cell = box.closest('tr')?.querySelector('td:last-child');
      if (!cell) return;
      const n = box.closest('td')?.querySelectorAll('input[type="checkbox"]:checked').length || 0;
      cell.textContent = String(n);
    });
  });

  const check = document.getElementById('fanout-check-filter');
  const exec = document.getElementById('fanout-exec-filter');
  const query = document.getElementById('fanout-query');
  const count = document.getElementById('fanout-result-count');
  const rows = Array.from(document.querySelectorAll('#fanout-table-body tr'));
  const applySite = () => {
    if (!count || !rows.length) return;
    const needle = (query?.value || '').trim().toLowerCase();
    let visible = 0;
    rows.forEach(row => {
      const okCheck = !check?.value || row.dataset.check === check.value;
      const okExec = !exec?.value || row.dataset.exec === exec.value;
      const okQuery = !needle || (row.dataset.search || '').toLowerCase().includes(needle);
      row.hidden = !(okCheck && okExec && okQuery);
      if (!row.hidden) visible += 1;
    });
    count.textContent = `当前显示 ${visible} 条`;
  };
  check?.addEventListener('change', applySite);
  exec?.addEventListener('change', applySite);
  query?.addEventListener('input', applySite);
}

function initKnowledgeDim() {
  if (currentPageId() !== 'knowledge') return;
  const seg = document.querySelector('[data-panel-seg="kb-dim"]');
  if (!seg) return;
  const title = document.getElementById('kb-dim-title');
  const labels = { rd: '按研发组织 · 学习人次', lg: '按临港研发线 · 学习人次', ic: '按 IC 组 · 学习人次' };
  seg.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => {
      const view = btn.dataset.panelView;
      if (title && labels[view]) title.textContent = labels[view];
    });
  });
}

function initHrFilters() {
  if (currentPageId() !== 'hr') return;
  const bar = document.getElementById('hr-filter-bar');
  const result = document.getElementById('hr-cross-result');
  if (!bar) return;
  bar.dataset.filterLive = 'true';
  const apply = () => {
    const parts = [];
    bar.querySelectorAll('.filter-group').forEach(group => {
      const name = (group.querySelector('label')?.textContent || '').trim();
      const sel = group.querySelector('select');
      if (!name || !sel || sel.value === '全部') return;
      parts.push(`${name}=${sel.value}`);
    });
    const seed = parts.join('|') || 'all';
    let n = 342;
    if (parts.length) {
      let h = 0;
      for (let i = 0; i < seed.length; i++) h = ((h << 5) - h) + seed.charCodeAt(i);
      n = 16 + (Math.abs(h) % 92);
    }
    const head = document.querySelector('#hr-headcount .kpi-value');
    if (head) {
      head.dataset.periodBase = String(n);
      head.textContent = scaleKpiText(String(n), periodFactor(readPeriodValue()));
    }
    if (result) {
      const drill = 'data-action="drill" data-title="人员资历明细" data-sub="HR+OA 员工编号关联 · 交叉筛选 · 演示" data-cols="工号,姓名,职能线,IC组,司龄,工龄,学历,技能等级"';
      result.innerHTML = parts.length
        ? `筛选结果：<strong>${parts.join(' · ')}</strong> → 匹配 <strong>${n}</strong> 人 · <a class="link" href="#" ${drill}>查看人员明细 →</a>`
        : `筛选结果：当前为全部在岗人员 → <strong>${n}</strong> 人 · <a class="link" href="#" ${drill}>查看人员明细 →</a>`;
      initActionLinks();
    }
  };
  bar.querySelectorAll('select').forEach(sel => sel.addEventListener('change', apply));
  bar.querySelector('.btn-apply')?.addEventListener('click', event => {
    event.preventDefault();
    apply();
  });
  apply();
}

const SITE_DEMO_ROWS = [
  { site: 'TSMC', n: 38, wet: 86, ecp: 42, track: 28, progress: 'T2/T3 占 38%', tier: 1, st: { WET: [72, 11, 3], ECP: [35, 5, 2], Track: [23, 4, 1] } },
  { site: 'SMIC', n: 31, wet: 64, ecp: 38, track: 22, progress: 'T2/T3 占 42%', tier: 1, st: { WET: [52, 9, 3], ECP: [31, 5, 2], Track: [18, 3, 1] } },
  { site: 'Intel', n: 26, wet: 52, ecp: 34, track: 18, progress: 'T2/T3 占 35%', tier: 1, st: { WET: [42, 8, 2], ECP: [28, 4, 2], Track: [14, 3, 1] } },
  { site: 'Samsung', n: 21, wet: 48, ecp: 28, track: 16, progress: 'T2/T3 占 40%', tier: 1, st: { WET: [40, 6, 2], ECP: [23, 4, 1], Track: [13, 2, 1] } },
  { site: 'Micron', n: 18, wet: 36, ecp: 22, track: 12, progress: 'T2/T3 占 33%', tier: 1, st: { WET: [30, 5, 1], ECP: [18, 3, 1], Track: [10, 2, 0] } },
  { site: 'UMC', n: 14, wet: 28, ecp: 16, track: 10, progress: 'T2/T3 占 31%', tier: 1, st: { WET: [23, 4, 1], ECP: [13, 2, 1], Track: [8, 2, 0] } },
  { site: 'YMTC', n: 12, wet: 24, ecp: 14, track: 8, progress: 'T2/T3 占 29%', tier: 1, st: { WET: [20, 3, 1], ECP: [11, 2, 1], Track: [6, 2, 0] } },
  { site: 'CXMT', n: 10, wet: 20, ecp: 12, track: 7, progress: 'T2/T3 占 28%', tier: 1, st: { WET: [16, 3, 1], ECP: [10, 2, 0], Track: [6, 1, 0] } },
  { site: 'Infineon', n: 9, wet: 16, ecp: 10, track: 6, progress: 'T2/T3 占 27%', tier: 1, st: { WET: [13, 2, 1], ECP: [8, 2, 0], Track: [5, 1, 0] } },
  { site: 'GlobalFoundries', n: 8, wet: 14, ecp: 9, track: 5, progress: 'T2/T3 占 26%', tier: 1, st: { WET: [11, 2, 1], ECP: [7, 2, 0], Track: [4, 1, 0] } },
  { site: 'Nanya', n: 7, wet: 12, ecp: 7, track: 4, progress: 'T2/T3 占 24%', tier: 2, st: { WET: [10, 2, 0], ECP: [6, 1, 0], Track: [3, 1, 0] } },
  { site: 'ST', n: 6, wet: 10, ecp: 6, track: 3, progress: 'T2/T3 占 22%', tier: 2, st: { WET: [8, 2, 0], ECP: [5, 1, 0], Track: [2, 1, 0] } },
  { site: 'HHGrace', n: 5, wet: 9, ecp: 5, track: 3, progress: 'T2/T3 占 21%', tier: 2, st: { WET: [7, 2, 0], ECP: [4, 1, 0], Track: [2, 1, 0] } },
  { site: 'Powerchip', n: 4, wet: 7, ecp: 4, track: 2, progress: 'T2/T3 占 20%', tier: 2, st: { WET: [6, 1, 0], ECP: [3, 1, 0], Track: [2, 0, 0] } }
];

function visibleSiteDemo(siteVal) {
  if (siteVal === 'top10') return SITE_DEMO_ROWS.filter(r => r.tier === 1);
  if (siteVal && siteVal !== 'all') return SITE_DEMO_ROWS.filter(r => r.site === siteVal);
  return SITE_DEMO_ROWS.slice();
}

function initSiteScopeFilters() {
  if (currentPageId() !== 'site-product') return;
  const siteSel = document.getElementById('site-scope-site');
  const prodSel = document.getElementById('site-scope-prod');
  if (!siteSel || !prodSel) return;
  const apply = () => {
    const siteVal = siteSel.value;
    const prodVal = prodSel.value;
    const rows = visibleSiteDemo(siteVal);
    const factor = periodFactor(readPeriodValue());
    const pick = (row) => {
      if (prodVal === 'WET') return row.wet;
      if (prodVal === 'ECP') return row.ecp;
      if (prodVal === 'Track') return row.track;
      return row.wet + row.ecp + row.track;
    };
    const lxChart = document.getElementById('lx-site-chart');
    if (lxChart) {
      const payload = JSON.stringify(rows.map(r => ({ l: r.site, v: r.n })));
      lxChart.dataset.periodBaseBars = payload;
    }
    const cover = document.getElementById('kpi-site-cover');
    if (cover) cover.dataset.periodBase = String(rows.length);
    const total = document.getElementById('kpi-site-total');
    if (total) {
      const sum = (siteVal === 'all' && prodVal === 'all')
        ? 186
        : rows.reduce((a, r) => a + r.n, 0);
      total.dataset.periodBase = String(sum);
    }
    const prods = prodVal === 'all' ? ['WET', 'ECP', 'Track'] : [prodVal];
    const sumSt = (idx) => rows.reduce((a, r) => a + prods.reduce((b, p) => b + (r.st[p][idx] || 0), 0), 0);
    const runN = sumSt(0);
    const mntN = sumSt(1);
    const downN = sumSt(2);
    const runEl = document.getElementById('kpi-run-count');
    const mntEl = document.getElementById('kpi-mnt-count');
    const downEl = document.getElementById('kpi-down-count');
    if (runEl) runEl.dataset.periodBase = String(runN);
    if (mntEl) mntEl.dataset.periodBase = String(mntN);
    if (downEl) downEl.dataset.periodBase = String(downN);
    const rtChart = document.getElementById('jitai-runtime-chart');
    if (rtChart) {
      rtChart.dataset.periodBaseGroupBars = JSON.stringify({
        groups: prods.map(p => ({
          label: p,
          values: [
            rows.reduce((a, r) => a + r.st[p][0], 0),
            rows.reduce((a, r) => a + r.st[p][1], 0),
            rows.reduce((a, r) => a + r.st[p][2], 0)
          ]
        })),
        series: ['运行中', '维护中', '停机']
      });
    }
    applyPeriodSlice(readPeriodValue());
    const jitaiBody = document.getElementById('jitai-site-body');
    if (jitaiBody) {
      jitaiBody.innerHTML = rows.map(r => {
        const wet = scaleDemoNumber(r.wet, factor, false);
        const ecp = scaleDemoNumber(r.ecp, factor, false);
        const track = scaleDemoNumber(r.track, factor, false);
        const sum = prodVal === 'all' ? wet + ecp + track : pick({ ...r, wet, ecp, track });
        return `<tr data-site="${r.site}" data-tier="${r.tier}"><td>${r.site}</td><td>${prodVal === 'all' || prodVal === 'WET' ? wet : '—'}</td><td>${prodVal === 'all' || prodVal === 'ECP' ? ecp : '—'}</td><td>${prodVal === 'all' || prodVal === 'Track' ? track : '—'}</td><td>${sum}</td><td>${r.progress}</td></tr>`;
      }).join('');
    }
    const runtimeBody = document.getElementById('jitai-runtime-body');
    if (runtimeBody) {
      runtimeBody.innerHTML = rows.flatMap(r => prods.map(p => {
        const run = scaleDemoNumber(r.st[p][0], factor, false);
        const mnt = scaleDemoNumber(r.st[p][1], factor, false);
        const down = scaleDemoNumber(r.st[p][2], factor, false);
        return `<tr data-site="${r.site}" data-prod="${p}"><td>${r.site}</td><td>${p}</td><td>${run}</td><td>${mnt}</td><td>${down}</td><td>${run + mnt + down}</td></tr>`;
      })).join('');
    }
    const hint = document.getElementById('site-scope-hint');
    if (hint) {
      const siteTxt = siteVal === 'all' ? '全部 Site（演示全集）' : siteVal === 'top10' ? 'Top 10' : siteVal;
      const prodTxt = prodVal === 'all' ? '全部产品类型' : prodVal;
      hint.textContent = `当前范围：${siteTxt} · ${prodTxt} · ${rows.length} 个 Site`;
    }
    document.querySelectorAll('[data-site-row]').forEach(row => {
      const okSite = siteVal === 'all' || (siteVal === 'top10' && row.dataset.tier !== '2') || row.dataset.site === siteVal;
      row.classList.toggle('is-hidden', !okSite);
      const detail = row.nextElementSibling;
      if (detail?.classList.contains('detail-row')) detail.classList.toggle('is-hidden', !okSite);
    });
    document.querySelectorAll('[data-acm-skip-row]').forEach(row => {
      const okSite = siteVal === 'all' || (siteVal === 'top10' && row.dataset.tier !== '2') || row.dataset.site === siteVal;
      const okProd = prodVal === 'all' || row.dataset.prod === prodVal;
      row.classList.toggle('is-hidden', !(okSite && okProd));
    });
  };
  siteSel.addEventListener('change', apply);
  prodSel.addEventListener('change', apply);
  document.querySelector('#site-scope-bar .btn-apply')?.addEventListener('click', event => {
    event.preventDefault();
    apply();
  });
  document.querySelector('.topbar-period')?.addEventListener('change', apply);
  apply();
}

function initLingangOrgTree() {
  if (currentPageId() !== 'lingang') return;
  const row = document.querySelector('[data-org-parent="wet"]');
  const chart = document.getElementById('lg-dept-chart');
  if (!row || !chart) return;
  let parents = [];
  let children = [];
  try { parents = JSON.parse(chart.dataset.periodBaseBars || chart.dataset.bars || '[]'); } catch (e) { parents = []; }
  try { children = JSON.parse(chart.dataset.orgChildren || '[]'); } catch (e) { children = []; }
  const title = document.getElementById('lg-dept-title');
  const syncChart = () => {
    const open = row.classList.contains('open');
    const data = open && children.length ? children : parents;
    const raw = JSON.stringify(data);
    chart.dataset.periodBaseBars = raw;
    chart.dataset.bars = scaleChartPayload(raw, periodFactor(readPeriodValue()), false);
    if (title) title.textContent = open ? '外部需求 · 湿法产品部下一级（演示）' : '外部需求 · 近半年 按部门';
    chart.classList.remove('chart-rendered');
    delete chart.dataset.chartW;
    refreshChartsSoon(true);
  };
  row.addEventListener('click', event => {
    if (event.target.closest('a,button,select,input')) return;
    setTimeout(syncChart, 0);
  });
  row.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') setTimeout(syncChart, 0);
  });
}

function initAcmSkipForm() {
  const body = document.getElementById('acm-skip-body');
  const submit = document.getElementById('acm-skip-submit');
  if (!body || !submit) return;
  submit.addEventListener('click', () => {
    const site = document.getElementById('acm-skip-site')?.value || 'Intel';
    const prod = document.getElementById('acm-skip-prod')?.value || '—';
    const vendor = document.getElementById('acm-skip-vendor')?.value || 'LAM';
    const count = document.getElementById('acm-skip-count')?.value || '1';
    const remark = document.getElementById('acm-skip-remark')?.value || 'ACM未涉及';
    const prodType = /Track/i.test(prod) ? 'Track' : /ECP|Etch|Plating/i.test(prod) ? 'ECP' : 'WET';
    const tr = document.createElement('tr');
    tr.dataset.acmSkipRow = '';
    tr.dataset.site = site;
    tr.dataset.prod = prodType;
    tr.dataset.tier = '1';
    tr.innerHTML = `<td>${escapeHtml(site)}</td><td>${escapeHtml(prod)}</td><td>${escapeHtml(vendor)}</td><td>${escapeHtml(count)}</td><td>${escapeHtml(remark)}</td>`;
    body.prepend(tr);
    showToast('已写入 ACM未涉及 演示清单（生产走 CRM Tool application 或填报）');
  });
}

function initShipPlan() {
  const form = document.getElementById('ship-plan-form');
  const body = document.getElementById('ship-plan-body');
  const submit = document.getElementById('ship-plan-submit');
  if (!form || !body || !submit) return;
  submit.addEventListener('click', () => {
    const site = document.getElementById('ship-site')?.value || 'TSMC';
    const month = document.getElementById('ship-month')?.value || '2026-10';
    const qty = document.getElementById('ship-qty')?.value || '1';
    const [y, m] = month.split('-').map(Number);
    const asmMonth = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
    const note = document.getElementById('ship-note')?.value || '演示填报';
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${escapeHtml(site)}</td><td>${escapeHtml(month)}</td><td>${escapeHtml(qty)}</td><td>${escapeHtml(asmMonth)}</td><td>临港装配提前 1 个月</td><td>${escapeHtml(note)}</td><td><span class="tag tag-open">演示</span></td>`;
    body.prepend(tr);
    showToast('已写入演示出机计划（未对接生产计划）');
  });
}
