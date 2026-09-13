/** PoC 前端路径：8890 入口，或挂载在 DEMO案例库 /demos/<id>/ 下 */
(function (global) {
  const ECS_ORIGIN = 'http://47.99.198.211:8890';
  const WORKER_DEFAULT = ECS_ORIGIN;

  function galleryMount() {
    const m = (global.location.pathname || '').match(/^(\/demos\/[^/]+)/);
    return m ? m[1] : '';
  }

  function isGalleryMount() {
    return !!galleryMount();
  }

  function isPocProxyHost() {
    return global.location.protocol.startsWith('http') &&
      (global.location.port === '8890' || global.location.host.endsWith(':8890'));
  }

  function isLocalPocProxy() {
    return isPocProxyHost() &&
      (global.location.hostname === '127.0.0.1' || global.location.hostname === 'localhost');
  }

  function isDeployedWeb() {
    if (isGalleryMount()) return true;
    if (!isPocProxyHost()) return false;
    const p = global.location.pathname || '';
    return p.endsWith('/index.html') || p.endsWith('/') ||
      p.includes('doris-data') || p.includes('scene-front') || p.includes('knowledge-graph') ||
      p.includes('knowledge-deliverables') || p.includes('poc-status') ||
      p.includes('poc-tech-brief') || p.includes('poc-demo-runbook') || p.includes('poc-architecture') ||
      p.includes('doc-route') || p.includes('doc-prototype');
  }

  /** 8890 部署路径（与 sync_web_from_scene.sh 保持一致） */
  const PAGE_MAP = {
    workbench: '/',
    doris: '/doris-data.html',
    hub: '/scene-front.html',
    graph: '/knowledge-graph.html',
    deliverables: '/knowledge-deliverables.html',
    status: '/poc-status.html',
    techBrief: '/poc-tech-brief.html',
    demoRunbook: '/poc-demo-runbook.html',
    architecture: '/poc-architecture.html',
    route03: '/doc-route-03.html',
    route04: '/doc-route-04.html',
    route05: '/doc-route-05.html',
    prototype06: '/doc-prototype-06.html',
  };

  /** @param {keyof typeof PAGE_MAP} key */
  function pageUrl(key) {
    const path = PAGE_MAP[key] || '/';
    const mount = galleryMount();
    // 案例库挂载：始终走当前域名下的 /demos/<id>/...，勿跳旧 8890
    if (mount) {
      return path === '/' ? (mount + '/') : (mount + path);
    }
    if (isPocProxyHost()) return path;
    return ECS_ORIGIN + path;
  }

  /** 绑定 data-page 属性的链接 */
  function bindPageLinks(root) {
    const scope = root || document;
    scope.querySelectorAll('[data-page]').forEach(function (el) {
      const key = el.getAttribute('data-page');
      if (key) el.href = pageUrl(key);
    });
  }

  function getWorkerBase(fallbackInput) {
    if (isPocProxyHost()) {
      const origin = global.location.origin.replace(/\/$/, '');
      try {
        const saved = global.localStorage.getItem('poc_worker');
        if (saved && saved.replace(/\/$/, '') !== origin) {
          global.localStorage.setItem('poc_worker', origin);
        }
      } catch (_) {}
      return origin;
    }
    const saved = global.localStorage.getItem('poc_worker');
    if (saved && saved.includes(':8890')) return saved.replace(/\/$/, '');
    return ECS_ORIGIN;
  }

  function shouldWaitForTunnel() {
    return isLocalPocProxy() || global.location.protocol === 'file:';
  }

  function hideTunnelGate() {
    const gate = document.getElementById('tunnelGate');
    const msg = document.getElementById('tunnelGateMsg');
    if (gate) gate.classList.remove('show', 'compact');
    if (msg) msg.textContent = '';
  }

  function markTunnelReady() {
    global.__POC_TUNNEL_READY = true;
    hideTunnelGate();
  }

  /** 快速检测 ECS Worker（800ms 间隔，2.5s 后缩小为底部提示条，连通后自动消失） */
  let _tunnelPromise = null;
  async function waitForTunnel(opts) {
    if (global.__POC_TUNNEL_READY) return true;
    if (!shouldWaitForTunnel()) return true;
    if (_tunnelPromise) return _tunnelPromise;
    _tunnelPromise = _waitForTunnelLoop(opts);
    return _tunnelPromise;
  }

  async function probeWorkerHealth(base, timeoutMs) {
    const resp = await fetch(base + '/health', { signal: AbortSignal.timeout(timeoutMs || 4000) });
    const d = await resp.json().catch(function () { return {}; });
    const ok = resp.ok && d.status !== 'degraded' && d.doris && d.doris.ok;
    return { ok: !!ok, data: d };
  }

  async function _waitForTunnelLoop(opts) {
    const base = getWorkerBase();
    const gate = document.getElementById('tunnelGate');
    const msg = document.getElementById('tunnelGateMsg');
    const t0 = Date.now();
    let compact = false;

    if (gate) gate.classList.add('show');

    while (true) {
      const elapsed = Math.round((Date.now() - t0) / 1000);
      if (!compact && Date.now() - t0 > 2500 && gate) {
        compact = true;
        gate.classList.add('compact');
      }
      if (msg) {
        msg.innerHTML = compact
          ? 'ECS 连接中 ' + elapsed + 's · 页面已可用，入库/推送需等 Worker 连通'
          : '连接 ECS Worker… ' + elapsed + 's · 本地 8890 就绪';
      }
      try {
        const r = await probeWorkerHealth(base, compact ? 4000 : 3500);
        if (r.ok) {
          markTunnelReady();
          return true;
        }
        if (msg && r.data.status === 'degraded' && !compact) {
          msg.innerHTML = 'SSH 握手中… ' + elapsed + 's · 本地代理已响应';
        }
      } catch (_) {}
      await new Promise(function (resolve) { setTimeout(resolve, compact ? 1500 : 800); });
    }
  }

  global.POC_PATHS = {
    ECS_ORIGIN,
    WORKER_DEFAULT,
    galleryMount,
    isGalleryMount,
    isPocProxyHost,
    isLocalPocProxy,
    isDeployedWeb,
    PAGE_MAP,
    pageUrl,
    bindPageLinks,
    getWorkerBase,
    shouldWaitForTunnel,
    waitForTunnel,
    hideTunnelGate,
    markTunnelReady,
    probeWorkerHealth,
  };
})(window);
