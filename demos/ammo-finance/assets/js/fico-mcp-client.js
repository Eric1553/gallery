/**
 * FICO MCP 客户端 v2
 * 优先走本地代理（避免浏览器 file:// / CORS 限制），回退直连 MCP
 */
(function (global) {
  'use strict';

  const FICO_ENDPOINT = 'http://47.116.68.38:8747/mcp';
  const PROXY_CANDIDATES = [
    'http://localhost:8748/api/fico-search',
    'http://127.0.0.1:8748/api/fico-search',
  ];

  let proxyUrl = null;
  let proxyChecked = false;

  class FicoMcpClient {
    constructor() {
      this.direct = new DirectMcpClient(FICO_ENDPOINT);
      this.mode = null;
    }

    async search(question) {
      const proxy = await detectProxy();

      if (location.protocol === 'file:' && !proxy) {
        throw new Error(fileProtocolHint());
      }

      if (proxy) {
        this.mode = 'proxy';
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 95000);
        const res = await fetch(proxy, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question }),
          signal: ctrl.signal,
        });
        clearTimeout(timer);
        const data = await res.json();
        if (!res.ok || data.ok === false) throw new Error(data.error || `代理错误 HTTP ${res.status}`);
        const hits = data.hits || parseFicoHits(data.raw || '', question);
        return { hits, elapsed: data.elapsed, mode: 'proxy', hint: data.hint, broad: data.broad };
      }

      this.mode = 'direct';
      const result = await this.direct.search(question);
      return { ...result, mode: 'direct' };
    }

    disconnect() { this.direct.disconnect(); }
  }

  async function detectProxy() {
    if (proxyChecked) return proxyUrl;
    proxyChecked = true;

    if (location.port === '8748') {
      proxyUrl = '/api/fico-search';
      return proxyUrl;
    }

    for (const url of PROXY_CANDIDATES) {
      try {
        const base = url.replace('/api/fico-search', '');
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 2000);
        const res = await fetch(`${base}/index.html`, { method: 'HEAD', signal: ctrl.signal });
        clearTimeout(t);
        if (res.ok) { proxyUrl = url; return url; }
      } catch { /* next */ }
    }
    return null;
  }

  class DirectMcpClient {
    constructor(endpoint) {
      this.endpoint = endpoint;
      this.sessionId = null;
      this.es = null;
      this.ready = false;
      this.msgId = 1;
      this.pending = new Map();
      this._connectPromise = null;
    }

    async ensureSession() {
      if (this.ready && this.sessionId) return;
      if (this._connectPromise) return this._connectPromise;
      this._connectPromise = this._openSession();
      try { await this._connectPromise; }
      finally { this._connectPromise = null; }
    }

    _openSession() {
      return new Promise((resolve, reject) => {
        this._cleanup();
        const es = new EventSource(this.endpoint);
        this.es = es;
        let settled = false;

        const timeout = setTimeout(() => {
          if (!settled) {
            settled = true;
            this._cleanup();
            reject(new Error(fileProtocolHint()));
          }
        }, 25000);

        const onEndpoint = async (data) => {
          try {
            const m = data.match(/sessionId=([a-f0-9-]+)/i);
            if (!m) throw new Error('未获取到 sessionId');
            this.sessionId = m[1];
            await this._post({ jsonrpc: '2.0', id: this.msgId++, method: 'initialize', params: {
              protocolVersion: '2024-11-05', capabilities: {},
              clientInfo: { name: 'fico-search-ui', version: '1.0' },
            }});
            await this._post({ jsonrpc: '2.0', method: 'notifications/initialized' });
            this.ready = true;
            if (!settled) { settled = true; clearTimeout(timeout); resolve(); }
          } catch (err) {
            if (!settled) { settled = true; clearTimeout(timeout); reject(err); }
          }
        };

        es.addEventListener('endpoint', ev => onEndpoint((ev.data || '').trim()));
        es.onmessage = ev => {
          if ((ev.data || '').includes('sessionId=')) onEndpoint((ev.data || '').trim());
          try {
            const data = JSON.parse(ev.data);
            if (data.id != null && this.pending.has(data.id)) {
              const { resolve: res, reject: rej } = this.pending.get(data.id);
              this.pending.delete(data.id);
              if (data.error) rej(new Error(data.error.message || 'MCP 调用失败'));
              else res(data.result);
            }
          } catch { /* ignore */ }
        };

        es.onerror = () => {
          if (!settled && !this.ready) {
            settled = true;
            clearTimeout(timeout);
            this._cleanup();
            reject(new Error(fileProtocolHint()));
          }
        };
      });
    }

    async _post(body) {
      const res = await fetch(`${this.endpoint}?sessionId=${this.sessionId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`MCP HTTP ${res.status}`);
      if (body.id == null) return null;
      return new Promise((resolve, reject) => {
        this.pending.set(body.id, { resolve, reject });
        setTimeout(() => {
          if (this.pending.has(body.id)) {
            this.pending.delete(body.id);
            reject(new Error('检索超时（60s）'));
          }
        }, 60000);
      });
    }

    async search(question) {
      await this.ensureSession();
      const id = this.msgId++;
      const result = await this._post({
        jsonrpc: '2.0', id,
        method: 'tools/call',
        params: { name: 'fico_search', arguments: { question } },
      });
      const text = (result?.content || []).filter(c => c.type === 'text').map(c => c.text).join('\n');
      return { raw: text, hits: parseFicoHits(text, question) };
    }

    _cleanup() {
      if (this.es) { this.es.close(); this.es = null; }
      this.sessionId = null;
      this.ready = false;
      this.pending.forEach(({ reject }) => reject(new Error('连接已断开')));
      this.pending.clear();
    }

    disconnect() { this._cleanup(); }
  }

  function fileProtocolHint() {
    if (location.protocol === 'file:') {
      return '浏览器无法从本地文件直连 MCP。请运行: node scripts/fico-proxy.mjs 后访问 http://localhost:8748';
    }
    return 'MCP 连接失败。请运行 node scripts/fico-proxy.mjs 启动本地代理，或检查 FICO 服务';
  }

  function parseFicoHits(text, query) {
    if (!text || text.length < 20) return [];
    const blocks = text.split(/(?=###\s+\.\/)/g).filter(b => b.trim().startsWith('###'));
    if (!blocks.length) {
      return [{
        id: 'raw-0', type: 'remote', title: query, source: 'FICO 知识库', path: '',
        snippet: text.slice(0, 280).replace(/\n+/g, ' '),
        module: '00', moduleName: '远程检索', query: '@fico ' + query, page: 'index.html',
      }];
    }
    return blocks.map((block, i) => {
      const pathMatch = block.match(/###\s+(\.\/[^\n]+)/);
      const path = pathMatch ? pathMatch[1].replace(/^\.\//, '') : '';
      const h1 = block.match(/^#\s+(.+)$/m);
      const title = h1 ? h1[1].replace(/\s*\([^)]*\)\s*$/, '').trim() : path.split('/').pop().replace(/\.md$/, '');
      const quote = block.match(/>\s*\*\*([^*]+)\*\*/);
      const quote2 = block.match(/>\s*(.{20,200})/);
      const snippet = (quote?.[1] || quote2?.[1] || block.replace(/[#*`>-]/g, ' ').replace(/\s+/g, ' ').trim()).slice(0, 200);
      const mod = guessModule(path);
      return {
        id: 'remote-' + i, type: 'remote', title, source: path, path, snippet,
        module: mod.id, moduleName: mod.name, submodule: path.split('/').slice(1, -1).pop() || '',
        query: '@fico ' + query, page: mod.page,
      };
    });
  }

  function guessModule(path) {
    if (path.includes('01_基础财务')) return { id: '01', name: '基础财务', page: 'pages/01-基础财务.html' };
    if (path.includes('02_财务分析')) return { id: '02', name: '财务分析', page: 'pages/02-财务分析.html' };
    if (path.includes('03_财务咨询')) return { id: '03', name: '财务咨询', page: 'pages/03-财务咨询.html' };
    if (path.includes('04_实战案例')) return { id: '04', name: '实战案例', page: 'pages/04-实战案例.html' };
    return { id: '00', name: 'FICO 知识库', page: 'index.html' };
  }

  global.FicoMcpClient = FicoMcpClient;
  global.parseFicoHits = parseFicoHits;
})(window);
