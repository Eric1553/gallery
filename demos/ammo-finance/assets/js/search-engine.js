/**
 * FICO 检索引擎 v4
 * - 仅 Enter / 点击检索，输入过程不触发远程请求
 * - 历史记录启动时迁移清理 + 可手动清空
 */
(function () {
  'use strict';

  const TYPE_LABELS = { remote: '远程', document: '文档', query: '弹药包', case: '案例', scene: '场景' };
  const TYPE_CLASS = { remote: 'remote', document: 'doc', query: 'query', case: 'case', scene: 'scene' };
  const MOD_CLASS = { '01': '', '02': 'm02', '03': 'm03', '04': 'm04' };
  const RECENT_KEY = 'fico-search-recent';
  const RECENT_VER_KEY = 'fico-search-recent-v';
  const RECENT_VER = 2;

  let mcp = null;
  let isOpen = false;
  let isComposing = false;
  let results = [];
  let focusIdx = -1;
  let searchGen = 0;
  let lastQuery = '';
  let rawIndex = null;

  const els = {};

  function basePath() {
    return window.location.pathname.includes('/pages/') ? '../' : '';
  }

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function highlight(text, q) {
    if (!q) return esc(text);
    const terms = q.split(/[\s,，、]+/).filter(t => t.length > 1);
    if (!terms.length) return esc(text);
    const re = new RegExp('(' + terms.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')', 'gi');
    return esc(text).replace(re, '<mark>$1</mark>');
  }

  /** 判断是否为合格的完整检索词（过滤打字碎片/拼音/IME残留） */
  function isValidRecent(q) {
    const text = q.trim();
    if (text.length < 4) return false;
    const chinese = (text.match(/[\u4e00-\u9fff]/g) || []).length;
    if (chinese >= 2) {
      if (/[\u4e00-\u9fff][a-zA-ZÀ-ÿ'"`~]$/.test(text)) return false;
      if (/[\u4e00-\u9fff](zen|zhe|zen'me|shi|ma)$/i.test(text)) return false;
      return true;
    }
    return text.length >= 8 && /^[a-zA-Z0-9\s@._-]+$/.test(text);
  }

  function dedupeRecent(list) {
    const sorted = [...list].filter(isValidRecent).sort((a, b) => b.length - a.length);
    const kept = [];
    for (const q of sorted) {
      if (!kept.some(k => k.startsWith(q) || q.startsWith(k))) kept.push(q);
    }
    return kept.slice(0, 5);
  }

  function migrateRecent() {
    const ver = Number(localStorage.getItem(RECENT_VER_KEY) || 0);
    let raw = [];
    try { raw = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); } catch { raw = []; }
    const cleaned = dedupeRecent(raw);
    if (ver < RECENT_VER || cleaned.length !== raw.length) {
      localStorage.setItem(RECENT_KEY, JSON.stringify(cleaned));
      localStorage.setItem(RECENT_VER_KEY, String(RECENT_VER));
    }
  }

  function getRecent() {
    migrateRecent();
    try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); }
    catch { return []; }
  }

  function saveRecent(q) {
    if (!isValidRecent(q)) return;
    const text = q.trim();
    let r = getRecent().filter(x => x !== text && !text.startsWith(x) && !x.startsWith(text));
    r = [text, ...r].slice(0, 5);
    localStorage.setItem(RECENT_KEY, JSON.stringify(r));
    localStorage.setItem(RECENT_VER_KEY, String(RECENT_VER));
  }

  function clearRecent() {
    localStorage.removeItem(RECENT_KEY);
    localStorage.setItem(RECENT_VER_KEY, String(RECENT_VER));
    renderIdle();
  }

  function copyText(text, btn) {
    navigator.clipboard.writeText(text).then(() => {
      if (!btn) return;
      const orig = btn.textContent;
      btn.textContent = '✓ 已复制';
      btn.classList.add('copied');
      setTimeout(() => { btn.textContent = orig; btn.classList.remove('copied'); }, 1400);
    });
  }

  function renderLoading(query) {
    els.meta.innerHTML = `<span class="fsp-status searching">● FICO MCP 远程检索中…</span><span>查询「${esc(query)}」</span>`;
    els.results.innerHTML = `
      <div class="fsp-loading">
        <div class="fsp-loading-spinner"></div>
        <div class="fsp-loading-title">正在检索 FICO 知识库</div>
        <div class="fsp-loading-desc">KB + Stages 全库语义搜索 · ${esc(query)}</div>
      </div>`;
    els.remoteBtn.style.display = 'none';
  }

  function renderIdle() {
    const recent = getRecent();
    const hot = rawIndex?.quickTags || [];
    els.meta.innerHTML = `<span>按 <strong>Enter</strong> 或点「检索」发起查询</span><span>273+ 篇全库</span>`;
    els.suggestBar.style.display = 'none';
    els.remoteBtn.style.display = 'none';

    let html = '';
    if (recent.length) {
      html += `<div class="fsp-section-head">
        <div class="fsp-section-label" style="margin:0">最近检索</div>
        <button class="fsp-clear-history" type="button">清空</button>
      </div>
      <div class="fsp-suggest-row">` +
        recent.map(r => `<button class="fsp-suggest-chip recent" data-q="${esc(r)}">${esc(r)}</button>`).join('') +
        `</div>`;
    }
    html += `<div class="fsp-section-label">热门检索</div><div class="fsp-suggest-row">` +
      hot.map(t => `<button class="fsp-suggest-chip" data-q="${esc(t)}">${esc(t)}</button>`).join('') + `</div>`;
    html += `<div class="fsp-tips">
      <div class="fsp-tip"><b>操作</b>输入完整问题后按 Enter 或点右侧「检索」按钮</div>
      <div class="fsp-tip"><b>访问</b>请用 <code>http://localhost:8748</code> 打开页面（需先启动代理）</div>
    </div>`;
    els.results.innerHTML = html;
    bindSuggestChips();
    els.results.querySelector('.fsp-clear-history')?.addEventListener('click', clearRecent);
    results = [];
    focusIdx = -1;
  }

  function renderResults(hits, query, meta) {
    results = hits;
    focusIdx = -1;
    const q = query.trim();

    els.remoteBtn.style.display = 'flex';
    els.remoteBtn.dataset.query = '@fico ' + q;

    if (!hits.length) {
      els.meta.innerHTML = `<span class="fsp-status error">● 未命中</span><span>无匹配结果</span>`;
      els.results.innerHTML = `
        <div class="fsp-empty">
          <div class="fsp-empty-ico">📡</div>
          <div class="fsp-empty-title">FICO 全库未找到「${esc(q)}」</div>
          <div class="fsp-empty-desc">换关键词重试，或复制 @fico 指令到 Cursor 继续追问</div>
        </div>`;
      return;
    }

    const ms = meta?.elapsed ? ` · ${meta.elapsed}ms` : '';
    const hintHtml = meta?.hint ? `<span class="fsp-broad-hint">💡 ${esc(meta.hint)}</span>` : '';
    els.meta.innerHTML = `<span class="fsp-status ok">● FICO MCP</span><span>命中 <strong>${hits.length}</strong> 条${ms}</span>${hintHtml}`;

    els.results.innerHTML = hits.map((item, idx) => {
      const modCls = MOD_CLASS[item.module] || '';
      const typeCls = TYPE_CLASS[item.type] || 'remote';
      const typeLabel = TYPE_LABELS[item.type] || '远程';
      const page = item.page || 'index.html';

      return `
        <div class="fsp-item" data-idx="${idx}" data-page="${esc(page)}" data-query="${esc(item.query || '@fico ' + q)}">
          <div class="fsp-item-score remote-bar" style="--pct:100%"></div>
          <div class="fsp-item-body">
            <div class="fsp-item-top">
              <span class="fsp-type-badge ${typeCls}">${typeLabel}</span>
              <div style="min-width:0;flex:1">
                <div class="fsp-item-title">${highlight(item.title, q)}</div>
                <div class="fsp-item-desc">${highlight(item.snippet || item.desc || '', q)}</div>
              </div>
            </div>
            <div class="fsp-item-meta">
              <span class="fsp-mod-tag ${modCls}">${esc(item.moduleName || '')}</span>
              ${item.source ? `<span class="fsp-source-tag" title="${esc(item.source)}">${esc(item.source.split('/').pop())}</span>` : ''}
            </div>
            <div class="fsp-query-row">
              <div class="fsp-query-code">${esc(item.query || '@fico ' + q)}</div>
              <button class="fsp-copy-btn" data-copy="${esc(item.query || '@fico ' + q)}">复制</button>
            </div>
          </div>
        </div>`;
    }).join('');

    bindResultEvents();
  }

  function renderError(err, query) {
    els.meta.innerHTML = `<span class="fsp-status error">● 连接失败</span>`;
    els.remoteBtn.style.display = 'flex';
    els.remoteBtn.dataset.query = '@fico ' + query;
    const viaProxy = location.port === '8748';
    els.results.innerHTML = `
      <div class="fsp-empty">
        <div class="fsp-empty-ico">⚠️</div>
        <div class="fsp-empty-title">FICO MCP 连接失败</div>
        <div class="fsp-empty-desc">${esc(err.message)}<br><br>
          <b>常见原因：</b>未通过本地代理访问、代理未启动、或关键词过宽导致超时（如单独搜「财务」）<br><br>
          ${viaProxy ? '' : '<b>请通过本地代理访问：</b><br>'}
          <code style="display:block;margin:8px 0;padding:8px;background:#e8eeff;border-radius:6px;font-size:10px;word-break:break-all;">cd 造弹药专项/财务专项 && node scripts/fico-proxy.mjs</code>
          然后打开 <a href="http://localhost:8748/index.html" style="color:#3a5fc4">http://localhost:8748/index.html</a>
        </div>
        <button class="fsp-retry-btn" data-retry="${esc(query)}">重新检索</button>
      </div>`;
    els.results.querySelector('.fsp-retry-btn')?.addEventListener('click', () => runSearch(query, { save: true }));
  }

  function bindSuggestChips() {
    els.results.querySelectorAll('.fsp-suggest-chip').forEach(btn => {
      btn.addEventListener('click', () => runSearch(btn.dataset.q, { save: true }));
    });
  }

  function bindResultEvents() {
    els.results.querySelectorAll('.fsp-item').forEach(el => {
      el.addEventListener('click', e => {
        if (e.target.closest('.fsp-copy-btn')) return;
        copyText(el.dataset.query);
      });
    });
    els.results.querySelectorAll('.fsp-copy-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        copyText(btn.dataset.copy, btn);
      });
    });
  }

  async function runSearch(q, opts = {}) {
    const query = q.trim();
    lastQuery = query;
    els.input.value = q;
    els.clear.classList.toggle('show', q.length > 0);

    if (!query) { renderIdle(); return; }
    if (query.length < 2) return;

    const gen = ++searchGen;
    renderLoading(query);

    const t0 = Date.now();
    try {
      if (!mcp) mcp = new FicoMcpClient();
      const { hits, hint } = await mcp.search(query);
      if (gen !== searchGen) return;
      if (opts.save) saveRecent(query);
      renderResults(hits, query, { elapsed: Date.now() - t0, hint });
    } catch (err) {
      if (gen !== searchGen) return;
      mcp?.disconnect();
      mcp = null;
      const msg = err.name === 'AbortError' ? '检索超时（90s），请缩小关键词范围后重试' : err.message;
      renderError(new Error(msg), query);
    }
  }

  function triggerSearch() {
    if (isComposing) return;
    const v = els.input.value.trim();
    if (v) runSearch(v, { save: true });
    else renderIdle();
  }

  function setFocus(idx) {
    const items = els.results.querySelectorAll('.fsp-item');
    items.forEach(el => el.classList.remove('focused'));
    if (idx >= 0 && idx < items.length) {
      items[idx].classList.add('focused');
      items[idx].scrollIntoView({ block: 'nearest' });
      focusIdx = idx;
    }
  }

  function open(prefill) {
    isOpen = true;
    els.rail.classList.add('open');
    els.overlay.classList.add('open');
    setTimeout(() => els.input.focus(), 260);
    if (prefill) runSearch(prefill, { save: true });
    else renderIdle();
  }

  function close() {
    isOpen = false;
    els.rail.classList.remove('open');
    els.overlay.classList.remove('open');
    focusIdx = -1;
  }

  function toggle() { isOpen ? close() : open(); }

  function buildDOM() {
    const bp = basePath();
    const overlay = document.createElement('div');
    overlay.className = 'fico-search-overlay';

    const rail = document.createElement('div');
    rail.className = 'fico-search-rail';

    const tab = document.createElement('button');
    tab.className = 'fico-search-tab';
    tab.setAttribute('aria-label', '打开 FICO 检索');
    tab.innerHTML = `
      <span class="tab-arrow">‹</span>
      <span class="tab-ico">📡</span>
      <span class="tab-label">FICO检索</span>
      <span class="tab-kbd">⌘K</span>`;

    const panel = document.createElement('div');
    panel.className = 'fico-search-panel';
    panel.innerHTML = `
      <div class="fsp-head">
        <div class="fsp-head-top">
          <div class="fsp-title">
            <div class="fsp-title-ico">📡</div>
            <div>
              <div class="fsp-title-main">FICO 检索引擎</div>
              <div class="fsp-title-sub">FICO MCP 远程检索 · 按 Enter 查询</div>
            </div>
          </div>
          <button class="fsp-close" aria-label="关闭">✕</button>
        </div>
        <div class="fsp-input-row">
          <div class="fsp-input-wrap">
            <span class="search-ico">🔍</span>
            <input class="fsp-input" type="search" placeholder="输入完整问题后按 Enter…" autocomplete="off" spellcheck="false" />
            <button class="fsp-clear" aria-label="清除输入">✕</button>
          </div>
          <button class="fsp-go-btn" type="button">检索</button>
        </div>
      </div>
      <div class="fsp-meta"></div>
      <div class="fsp-results"></div>
      <div class="fsp-foot">
        <button class="fsp-remote-btn" style="display:none">
          <span>📋</span> 复制 @fico 指令
        </button>
        <div class="fsp-foot-right">
          <span class="fsp-foot-hint"><kbd>Enter</kbd> 检索 · <kbd>Esc</kbd> 关闭</span>
          <a class="fsp-foot-link" href="${bp}pages/检索指引.html">指引</a>
        </div>
      </div>`;

    rail.appendChild(panel);
    rail.appendChild(tab);
    document.body.appendChild(overlay);
    document.body.appendChild(rail);

    Object.assign(els, {
      rail, tab, overlay, panel,
      input: panel.querySelector('.fsp-input'),
      clear: panel.querySelector('.fsp-clear'),
      goBtn: panel.querySelector('.fsp-go-btn'),
      results: panel.querySelector('.fsp-results'),
      meta: panel.querySelector('.fsp-meta'),
      closeBtn: panel.querySelector('.fsp-close'),
      remoteBtn: panel.querySelector('.fsp-remote-btn'),
    });
  }

  function bindEvents() {
    els.tab.addEventListener('click', toggle);
    els.overlay.addEventListener('click', close);
    els.closeBtn.addEventListener('click', close);
    els.goBtn.addEventListener('click', triggerSearch);

    els.input.addEventListener('compositionstart', () => { isComposing = true; });
    els.input.addEventListener('compositionend', () => { isComposing = false; });

    els.input.addEventListener('input', () => {
      els.clear.classList.toggle('show', els.input.value.length > 0);
    });

    els.input.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !isComposing) {
        e.preventDefault();
        triggerSearch();
      }
    });

    els.clear.addEventListener('click', () => {
      els.input.value = '';
      els.clear.classList.remove('show');
      renderIdle();
      els.input.focus();
    });

    els.remoteBtn.addEventListener('click', () => {
      copyText(els.remoteBtn.dataset.query || '@fico ' + els.input.value, els.remoteBtn);
    });

    document.addEventListener('keydown', e => {
      const mod = navigator.platform.includes('Mac') ? e.metaKey : e.ctrlKey;
      if (mod && e.key === 'k') { e.preventDefault(); toggle(); return; }
      if (!isOpen) return;
      if (e.key === 'Escape') { close(); return; }
      const items = els.results.querySelectorAll('.fsp-item');
      if (e.key === 'ArrowDown') { e.preventDefault(); setFocus(Math.min(focusIdx + 1, items.length - 1)); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setFocus(Math.max(focusIdx - 1, 0)); }
      else if (e.key === 'Enter' && focusIdx >= 0 && items[focusIdx]) {
        e.preventDefault();
        copyText(items[focusIdx].dataset.query);
      }
    });

    document.querySelectorAll('[data-open-search]').forEach(el => {
      el.addEventListener('click', e => {
        e.preventDefault();
        open(el.dataset.searchQuery || '');
      });
    });
  }

  async function init() {
    migrateRecent();
    buildDOM();
    try {
      const res = await fetch(basePath() + 'data/search-index.json');
      rawIndex = await res.json();
    } catch {
      rawIndex = { quickTags: ['合并报表', '半导体', '金税四期', 'SAP月结', 'Board Deck'] };
    }
    bindEvents();
    renderIdle();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  window.FicoSearch = { open, close, toggle, clearRecent };
})();
