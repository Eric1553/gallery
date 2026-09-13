/** 杜邦分析 · 共享渲染 */
const Dupont = {
  srcLabel: { sys: ['系统', 'tag-sys'], mix: ['加工', 'tag-mix'], manual: ['填报', 'tag-manual'], formula: ['公式', 'tag-formula'] },

  /** 专业四层杜邦架构图 */
  renderArchitecture(container, data, onClick) {
    if (!container || !data) return;
    const { root, branches } = data;
    const branchHtml = branches.map((b, i) => {
      const themeClass = b.theme === 'profit' ? 'b-profit' : b.theme === 'turn' ? 'b-turn' : 'b-lev';
      const op = i < branches.length - 1 ? '' : '';
      return `${i > 0 ? '<div class="da-op">×</div>' : ''}
        <div class="da-branch ${themeClass}" data-branch="${b.id}">
          <div class="da-branch-head">${b.label}</div>
          <div class="da-vline"></div>
          ${Dupont._archNode(b.factor, 'n-factor')}
          <div class="da-ratio-row">
            ${Dupont._archNode(b.ratio[0], 'n-leaf')}
            <div class="da-ratio-op">÷</div>
            ${Dupont._archNode(b.ratio[1], 'n-leaf')}
          </div>
          <div class="da-detail-row">
            ${b.detail.map(n => Dupont._archNode(n, `n-leaf${n.fill ? ' fill-tag' : ''}`)).join('')}
          </div>
        </div>`;
    }).join('');

    container.innerHTML = `
      <div class="dupont-arch">
        <div class="da-header">
          <div class="da-formula-block">
            <div class="da-formula-title">杜邦恒等式 · 四层分解</div>
            <div class="da-formula-eq">
              ROE<em>=</em>销售净利率<em>×</em>总资产周转率<em>×</em>权益乘数
            </div>
          </div>
          <div class="da-legend">
            <span><i class="c-profit"></i>盈利能力</span>
            <span><i class="c-turn"></i>运营效率</span>
            <span><i class="c-lev"></i>财务杠杆</span>
            <span>蓝色节点可钻取</span>
          </div>
        </div>
        <div class="da-stage" id="da-stage">
          <svg class="da-svg" id="da-svg" aria-hidden="true"></svg>
          <div class="da-level-rail">
            <span>L0 结果</span><span>L1 因素</span><span>L2 驱动</span><span>L3 明细</span>
          </div>
          <div class="da-stage-inner">
            <div class="da-root-wrap">${Dupont._archNode(root, 'n-root')}</div>
            <div class="da-branches">${branchHtml}</div>
          </div>
        </div>
        <div class="da-footer">固定四层展开 · 比上期 / 比上年同期 · 点击高亮节点查看下方详情</div>
      </div>`;

    container.querySelectorAll('.da-node.is-link').forEach(el => {
      el.addEventListener('click', () => {
        container.querySelectorAll('.da-node').forEach(n => n.classList.remove('is-active'));
        el.classList.add('is-active');
        const id = el.dataset.id;
        const node = [root, ...branches.flatMap(b => [b.factor, ...b.ratio, ...b.detail])].find(n => n && n.id === id);
        if (onClick && node) onClick(node);
      });
    });

    requestAnimationFrame(() => {
      Dupont._archContainer = container;
      Dupont._drawArchLines(container);
    });
    if (!Dupont._resizeBound) {
      window.addEventListener('resize', () => {
        if (Dupont._archContainer) Dupont._drawArchLines(Dupont._archContainer);
      });
      Dupont._resizeBound = true;
    }
  },

  _archNode(n, cls) {
    if (!n) return '';
    const chg = n.yoy ? `<div class="dn-chg ${String(n.yoy).startsWith('-') ? 'dn' : 'up'}">同比 ${n.yoy}${n.mom ? ` · 环比 ${n.mom}` : ''}</div>` : '';
    const formula = n.formula ? `<div class="dn-formula">${n.formula}</div>` : '';
    const abbr = n.abbr ? `<div class="dn-abbr">${n.abbr}</div>` : '';
    const lv = n.level ? `<span class="dn-lv">${n.level}</span>` : '';
    const fill = n.fill ? '<span class="dn-lv" style="left:auto;right:5px;background:#faad14">填报</span>' : '';
    return `<div class="da-node ${cls}${n.link ? ' is-link' : ''}" data-id="${n.id}">${lv}${fill}
      <div class="dn-name">${n.name}</div>${abbr}
      <div class="dn-val">${n.value}</div>${chg}${formula}
    </div>`;
  },

  _drawArchLines(container) {
    const stage = container.querySelector('#da-stage');
    const svg = container.querySelector('#da-svg');
    if (!stage || !svg) return;
    const sr = stage.getBoundingClientRect();
    svg.setAttribute('viewBox', `0 0 ${sr.width} ${sr.height}`);
    svg.innerHTML = '';

    const root = stage.querySelector('.n-root');
    const factors = stage.querySelectorAll('.n-factor');
    if (!root || !factors.length) return;

    const centerBottom = (el) => {
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2 - sr.left, y: r.bottom - sr.top };
    };
    const centerTop = (el) => {
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2 - sr.left, y: r.top - sr.top };
    };

    const rb = centerBottom(root);
    factors.forEach((f, i) => {
      const ft = centerTop(f);
      const branch = f.closest('.da-branch');
      const cls = branch?.classList.contains('b-profit') ? 'l-profit' : branch?.classList.contains('b-turn') ? 'l-turn' : 'l-lev';
      const midY = rb.y + (ft.y - rb.y) * 0.45;
      svg.innerHTML += `<path class="l-main ${cls}" d="M ${rb.x} ${rb.y} L ${rb.x} ${midY} L ${ft.x} ${midY} L ${ft.x} ${ft.y}"/>`;

      const ratioNodes = branch?.querySelectorAll('.da-ratio-row .da-node') || [];
      ratioNodes.forEach(rn => {
        const rt = centerTop(rn);
        const my = ft.y + (rt.y - ft.y) * 0.5;
        svg.innerHTML += `<path class="${cls}" d="M ${ft.x} ${ft.y + 4} L ${ft.x} ${my} L ${rt.x} ${my} L ${rt.x} ${rt.y}"/>`;
      });
    });
  },

  renderPyramid(container, nodes, onClick) {
    Dupont.renderArchitecture(container, DupontData.architecture, onClick);
  },

  renderIndicatorTable(tbody, rows, opts = {}) {
    if (!tbody) return;
    const { filter = 'all', search = '', groupByCat = false } = opts;
    let list = rows;
    if (filter !== 'all') list = list.filter(r => r.src === filter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(r => r.name.toLowerCase().includes(q));
    }
    if (!groupByCat) {
      tbody.innerHTML = list.map(r => Dupont.rowHtml(r)).join('');
      return;
    }
    const cats = DupontData.categories;
    tbody.innerHTML = cats.map(cat => {
      const items = list.filter(r => r.cat === cat.id);
      if (!items.length) return '';
      return `<tr class="cat-row"><td colspan="10">${cat.name}（${items.length} 项）</td></tr>${items.map(r => Dupont.rowHtml(r)).join('')}`;
    }).join('');
  },

  rowHtml(r) {
    const [lbl, cls] = Dupont.srcLabel[r.src] || ['—', ''];
    const mom = r.current - r.prev;
    const yoy = r.current - r.yoyPrev;
    const ytdYoy = r.ytd - r.yoyYtd;
    return `<tr class="${r.fill ? 'fill-row' : ''}" data-src="${r.src}" data-cat="${r.cat}">
      <td>${r.name}<span class="indicator-tag ${cls}">${lbl}</span>${r.fill ? '<span class="indicator-tag tag-manual">待填报</span>' : ''}</td>
      <td>${lbl}</td>
      <td class="num">${Cockpit.fmt.num(r.current)}</td>
      <td class="num">${Cockpit.fmt.num(r.prev)}</td>
      <td class="num ${mom >= 0 ? 'up' : 'down'}">${Cockpit.fmt.num(mom)}</td>
      <td class="num">${Cockpit.fmt.num(r.yoyPrev)}</td>
      <td class="num ${yoy >= 0 ? 'up' : 'down'}">${Cockpit.fmt.num(yoy)}</td>
      <td class="num">${Cockpit.fmt.num(r.ytd)}</td>
      <td class="num ${ytdYoy >= 0 ? 'up' : 'down'}">${Cockpit.fmt.num(ytdYoy)}</td>
    </tr>`;
  },

  bindSiteTabs(container, onChange) {
    container?.querySelectorAll('.dupont-site-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        container.querySelectorAll('.dupont-site-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        if (onChange) onChange(tab.dataset.site);
        Cockpit.showStatus(`Site：${tab.textContent.trim()}`);
      });
    });
  },

  /** Site 切换时更新架构图数值 */
  updateArchitectureForSite(container, siteId) {
    const row = DupontData.siteCompare.find(s =>
      (siteId === 'group' && s.site === '集团合并') ||
      (siteId === 'smic' && s.site === 'SMIC') ||
      (siteId === 'smic-n' && s.site === 'SMIC-N') ||
      (siteId === 'smic-s' && s.site === 'SMIC-S')
    );
    if (!row || !container) return;
    const arch = JSON.parse(JSON.stringify(DupontData.architecture));
    arch.root.value = `${row.roe}%`;
    arch.branches[0].factor.value = `${row.npm}%`;
    arch.branches[1].factor.value = `${row.tat} 次`;
    arch.branches[2].factor.value = `${row.em}`;
    Dupont.renderArchitecture(container, arch, window.showDetail);
  }
};

window.Dupont = Dupont;
