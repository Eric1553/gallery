#!/usr/bin/env node
/**
 * FICO 检索本地代理 + 静态文件服务
 * - MCP 会话复用 + 请求队列（避免并发建连超时）
 * - 服务端解析结果，仅返回 hits（控制体积）
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const FICO_ENDPOINT = 'http://47.116.68.38:8747/mcp';
const PORT = 8748;
const MAX_HITS = 8;
const SEARCH_TIMEOUT_MS = 90000;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
};

/* ── 结果解析（与浏览器端一致） ── */
function guessModule(p) {
  if (p.includes('01_基础财务')) return { id: '01', name: '基础财务', page: 'pages/01-基础财务.html' };
  if (p.includes('02_财务分析')) return { id: '02', name: '财务分析', page: 'pages/02-财务分析.html' };
  if (p.includes('03_财务咨询')) return { id: '03', name: '财务咨询', page: 'pages/03-财务咨询.html' };
  if (p.includes('04_实战案例')) return { id: '04', name: '实战案例', page: 'pages/04-实战案例.html' };
  return { id: '00', name: 'FICO 知识库', page: 'index.html' };
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
  return blocks.slice(0, MAX_HITS).map((block, i) => {
    const pathMatch = block.match(/###\s+(\.\/[^\n]+)/);
    const p = pathMatch ? pathMatch[1].replace(/^\.\//, '') : '';
    const h1 = block.match(/^#\s+(.+)$/m);
    const title = h1 ? h1[1].replace(/\s*\([^)]*\)\s*$/, '').trim() : p.split('/').pop().replace(/\.md$/, '');
    const quote = block.match(/>\s*\*\*([^*]+)\*\*/);
    const quote2 = block.match(/>\s*(.{20,200})/);
    const snippet = (quote?.[1] || quote2?.[1] || block.replace(/[#*`>-]/g, ' ').replace(/\s+/g, ' ').trim()).slice(0, 200);
    const mod = guessModule(p);
    return {
      id: 'remote-' + i, type: 'remote', title, source: p, path: p, snippet,
      module: mod.id, moduleName: mod.name, submodule: p.split('/').slice(1, -1).pop() || '',
      query: '@fico ' + query, page: mod.page,
    };
  });
}

/* ── MCP 会话管理：复用 + 串行队列 ── */
class McpSessionManager {
  constructor() {
    this.session = null;
    this.chain = Promise.resolve();
  }

  async search(question) {
    const run = this.chain.then(() => this._doSearch(question));
    this.chain = run.catch(() => {});
    return run;
  }

  async _doSearch(question) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        if (!this.session?.ready) this.session = await this._createSession();
        const id = this.session.nextId();
        const result = await this.session.post({
          jsonrpc: '2.0', id,
          method: 'tools/call',
          params: { name: 'fico_search', arguments: { question } },
        }, SEARCH_TIMEOUT_MS);
        const text = (result?.content || []).filter(c => c.type === 'text').map(c => c.text).join('\n');
        const hits = parseFicoHits(text, question);
        return { hits, totalChars: text.length, truncated: hits.length < (text.match(/###\s+\.\//g) || []).length };
      } catch (err) {
        this.session?.close();
        this.session = null;
        if (attempt === 1) throw err;
      }
    }
  }

  async _createSession() {
    const controller = new AbortController();
    const res = await fetch(FICO_ENDPOINT, {
      headers: { Accept: 'text/event-stream' },
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`FICO SSE HTTP ${res.status}`);

    let sessionId = null;
    const pending = new Map();
    let msgId = 1;
    let readerTask = null;

    const waitSession = new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        controller.abort();
        reject(new Error('FICO MCP 会话建立超时（30s），服务繁忙请稍后重试'));
      }, 30000);

      readerTask = (async () => {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = '';
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buf += decoder.decode(value, { stream: true });
            const frames = buf.split('\n\n');
            buf = frames.pop() || '';
            for (const frame of frames) {
              let ev = 'message', data = '';
              for (const line of frame.split('\n')) {
                if (line.startsWith('event:')) ev = line.slice(6).trim();
                if (line.startsWith('data:')) data += line.slice(5).trim();
              }
              if (!data) continue;

              if (ev === 'endpoint' && !sessionId) {
                const m = data.match(/sessionId=([a-f0-9-]+)/i);
                if (m) { sessionId = m[1]; clearTimeout(timer); resolve(); }
                continue;
              }

              if (ev === 'message') {
                try {
                  const json = JSON.parse(data);
                  if (json.id != null && pending.has(json.id)) {
                    const { resolve: ok, reject: fail } = pending.get(json.id);
                    pending.delete(json.id);
                    if (json.error) fail(new Error(json.error.message || 'MCP error'));
                    else ok(json.result);
                  }
                } catch { /* 超大 JSON 分片时跳过，等待完整帧 */ }
              }
            }
          }
        } catch (err) {
          clearTimeout(timer);
          if (!sessionId) reject(err);
        }
      })();
    });

    const post = (body, timeoutMs = 60000) => {
      if (!sessionId) throw new Error('session 未就绪');
      return fetch(`${FICO_ENDPOINT}?sessionId=${sessionId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
        body: JSON.stringify(body),
      }).then(r => {
        if (!r.ok) throw new Error(`FICO POST HTTP ${r.status}`);
        if (body.id == null) return null;
        return new Promise((resolve, reject) => {
          pending.set(body.id, { resolve, reject });
          setTimeout(() => {
            if (pending.has(body.id)) {
              pending.delete(body.id);
              reject(new Error(`FICO 检索超时（${Math.round(timeoutMs / 1000)}s），关键词过宽可尝试更具体的问题`));
            }
          }, timeoutMs);
        });
      });
    };

    await waitSession;
    await post({ jsonrpc: '2.0', id: msgId++, method: 'initialize', params: {
      protocolVersion: '2024-11-05', capabilities: {},
      clientInfo: { name: 'fico-proxy', version: '2.0' },
    }});
    await post({ jsonrpc: '2.0', method: 'notifications/initialized' });

    return {
      ready: true,
      post,
      nextId: () => msgId++,
      close: () => { controller.abort(); readerTask?.catch(() => {}); },
    };
  }
}

const mcpManager = new McpSessionManager();

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function serveStatic(req, res) {
  let urlPath = decodeURIComponent(new URL(req.url, `http://localhost:${PORT}`).pathname);
  if (urlPath === '/') urlPath = '/index.html';
  const filePath = path.resolve(ROOT, '.' + urlPath);
  if (!filePath.startsWith(ROOT)) { res.writeHead(403); res.end('Forbidden'); return; }
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream' });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (url.pathname === '/api/fico-search' && req.method === 'POST') {
    let body = '';
    req.on('data', c => { body += c; });
    req.on('end', async () => {
      try {
        const { question } = JSON.parse(body || '{}');
        const q = question?.trim();
        if (!q) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: '缺少 question' }));
          return;
        }
        if (q.length < 2) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: '关键词过短，请输入更具体的问题' }));
          return;
        }
        const t0 = Date.now();
        const data = await mcpManager.search(q);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          ok: true,
          hits: data.hits,
          question: q,
          elapsed: Date.now() - t0,
          broad: q.length <= 4,
          hint: q.length <= 4 ? '关键词较宽，建议补充具体场景如「合并报表怎么做」' : undefined,
        }));
      } catch (err) {
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: err.message }));
      }
    });
    return;
  }

  if (req.method === 'GET' || req.method === 'HEAD') {
    if (req.method === 'HEAD') { res.writeHead(200); res.end(); return; }
    // Special route: serve v10 from parent directory
    if (url.pathname === '/v10' || url.pathname === '/v10.html') {
      const v10Path = path.resolve(ROOT, '..', '统一检索', 'v10.html');
      fs.readFile(v10Path, (err, data) => {
        if (err) { res.writeHead(404); res.end('v10 not found'); return; }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(data);
      });
      return;
    }
    serveStatic(req, res);
    return;
  }
  res.writeHead(405); res.end('Method not allowed');
});

server.listen(PORT, () => {
  console.log(`\n  FICO 财务弹药库 本地服务 v2（会话复用）`);
  console.log(`  页面: http://localhost:${PORT}/index.html`);
  console.log(`  代理: POST http://localhost:${PORT}/api/fico-search\n`);
});
