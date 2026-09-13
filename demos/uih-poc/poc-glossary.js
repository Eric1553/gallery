/**
 * 联影 PoC · 术语表 + 悬停释义
 * 用法：POC_GLOSSARY.init({ root: document, table: '#poc-glossary-table' })
 */
(function (global) {
  /** @type {Record<string, {category:string, title:string, desc:string, related?:string}>} */
  var TERMS = {
    SSOT: {
      category: '数据治理',
      title: 'Single Source of Truth（唯一数据源）',
      desc: '文档元数据只维护一份权威清单（poc-chunk-profiles.json），工作台、知识产出页、附件 API 等均从该文件读取，避免多处拷贝不一致。',
      related: 'poc-chunk-profiles.json · poc-catalog.js',
    },
    'poc-catalog.js': {
      category: '前端脚本',
      title: '文档清单加载器',
      desc: '读取 poc-chunk-profiles.json，将嵌套结构 flatten 为页面可用的 flat 列表，并生成 SOP/经验索引。各 HTML 页面通过 POC_CATALOG.loadCatalog() 调用。',
      related: '02-前端/js/poc-catalog.js',
    },
    'poc-chunk-profiles.json': {
      category: '数据清单',
      title: '文档切片配置（SSOT）',
      desc: '记录各场景有哪些文档、附件文件名、切片策略、domain 等。新增待入库文档时在此登记，是唯一需要手工维护的清单源文件。',
      related: '01-数据资产/catalog/',
    },
    'poc-paths.js': {
      category: '前端脚本',
      title: '8890 路径解析',
      desc: '判断当前访问的是 ECS 公网还是本机 8890 代理，统一生成页面链接与 Worker API 基址；支持 SSH 隧道连通检测。',
    },
    'poc-sync.js': {
      category: '前端脚本',
      title: '工作台—图谱联动',
      desc: '通过 localStorage 在工作台与故障知识图谱页之间广播选中故障码、文档等状态，实现跨页联动。',
    },
    flatten: {
      category: '数据处理',
      title: '清单展平',
      desc: '将 catalog JSON 中按场景分组的 documents 数组，合并为单层列表供表格渲染与附件 API 校验使用。',
      related: 'poc-catalog.js',
    },
    catalog: {
      category: '数据治理',
      title: '文档目录（Catalog）',
      desc: 'PoC 中特指 poc-chunk-profiles.json 及其加载结果，包含全部待入库/已登记文档的元数据。',
      related: 'SSOT',
    },
    MCP: {
      category: 'Agent 集成',
      title: 'Model Context Protocol',
      desc: 'Dora 等 Agent 平台调用外部能力的标准协议。本 PoC 通过 HTTP 暴露检索、查数等工具，按路径分域（/mcp、/service-mcp）。',
      related: '/mcp · /service-mcp',
    },
    '/mcp': {
      category: 'Agent 接口',
      title: '场景一 · 财务 MCP 入口',
      desc: 'Nginx 8890 反代至财务 RAG MCP 服务（8791）。Dora 场景一 Agent 配置此 URL，可调用制度检索、trace 等工具。',
      related: 'finance_policy_retrieve_trace · scene1-finance',
    },
    '/service-mcp': {
      category: 'Agent 接口',
      title: '场景三 · 售后 MCP 入口',
      desc: 'Nginx 8890 反代至售后 RAG MCP 服务（8793）。Dora 场景三 Agent 配置此 URL，可调用手册检索、trace 等工具。',
      related: 'service_manual_retrieve_trace · scene3-service',
    },
    '/feishu-mcp': {
      category: 'Agent 接口',
      title: '飞书 Wiki MCP 入口',
      desc: 'Nginx 8890 反代至飞书 Wiki MCP（8792），用于飞书原生知识库路径（待进一步优化对接）。',
    },
    finance_policy_retrieve_trace: {
      category: 'MCP 工具',
      title: '财务制度检索（含溯源）',
      desc: '场景一 MCP 工具：对 finance domain 执行混合检索，并返回 trace（预筛、双通道命中、合并逻辑、中文说明）供 Dora 回答引用。',
      related: '/api/v1/retrieve/explain · /mcp',
    },
    service_manual_retrieve_trace: {
      category: 'MCP 工具',
      title: '售后手册检索（含溯源）',
      desc: '场景三 MCP 工具：对 service domain 执行混合检索并返回 trace，用于故障诊断、SOP 引用等问答场景。',
      related: '/api/v1/retrieve/explain · /service-mcp',
    },
    'scene1-finance': {
      category: 'Dora 技能',
      title: '场景一财务 Agent 技能包',
      desc: 'Dora 侧配置的技能标识，对应 03-Dora-Agent/scene1-finance/ 下的提示词、业务规则与 MCP 工具绑定。',
    },
    'scene3-service': {
      category: 'Dora 技能',
      title: '场景三售后 Agent 技能包',
      desc: 'Dora 侧配置的技能标识，对应 03-Dora-Agent/scene3-service/ 下的提示词、业务规则与 MCP 工具绑定。',
    },
    RAG: {
      category: '检索增强',
      title: 'Retrieval-Augmented Generation',
      desc: '检索增强生成：先从 Doris 向量库检索相关文档片段，再交由 Agent 组织回答。场景一制度、场景三手册均属 RAG 路径。',
      related: '/api/v1/retrieve · bge-small-zh',
    },
    trace: {
      category: '检索溯源',
      title: '检索过程说明（Trace）',
      desc: '除 top hits 外，额外返回预筛条件、BM25/向量各通道结果、SQL 预览及 narrative_zh 中文摘要，便于验收时核对依据。',
      related: '/api/v1/retrieve/explain',
    },
    '/api/v1/retrieve': {
      category: 'Worker API',
      title: '混合检索接口',
      desc: 'POST 请求：传入 query、domain、top_k 等，返回合并排序后的文档切片列表（BM25 + HNSW 向量）。',
    },
    '/api/v1/retrieve/explain': {
      category: 'Worker API',
      title: '混合检索溯源接口',
      desc: 'POST 请求：在 retrieve 基础上附加 trace 对象，包含各阶段明细与中文 narrative，供前端与 MCP trace 工具使用。',
      related: 'trace',
    },
    BM25: {
      category: '检索算法',
      title: 'BM25 全文检索',
      desc: '基于中文倒排索引的关键词相关性打分，与向量检索互补，用于混合检索的全文通道。',
    },
    HNSW: {
      category: '检索算法',
      title: 'HNSW 向量近邻检索',
      desc: 'Doris 4.x 向量索引类型，在 512 维 embedding 空间做近似最近邻搜索，用于语义相似匹配。',
      related: 'bge-small-zh',
    },
    'bge-small-zh': {
      category: '向量模型',
      title: '中文 Embedding 模型',
      desc: '将问句与文档切片编码为 512 维向量，度量方式为 inner_product，用于 HNSW 语义检索通道。',
    },
    chunks: {
      category: '数据模型',
      title: '文档切片',
      desc: '入库时将长文档按策略切分为段落块，每块单独向量化写入 kb.uih_doc_chunks。当前库内共 285 个切片。',
    },
    Dora: {
      category: 'Agent 平台',
      title: '帆软 Dora 智能体',
      desc: 'PoC 的 Agent 运行平台，通过 MCP 调用 RAG 工具，并结合 FineBI 分析主题查询结构化数据。',
    },
    Doris: {
      category: '存储引擎',
      title: 'SelectDB / Doris 4.x',
      desc: 'PoC 向量库与文档切片存储，表 kb.uih_doc_chunks 存切片文本与 512 维向量，支持 HNSW + 全文混合检索。',
    },
    Worker: {
      category: '后端服务',
      title: '入库与检索 Worker',
      desc: 'Python FastAPI 服务（8790），负责附件解析、切片、向量化、Stream Load 写入 Doris，并提供 /api/v1/* 检索 API。',
      related: 'doris-ingest/server.py',
    },
    ECS: {
      category: '部署环境',
      title: 'Elastic Compute Service',
      desc: 'PoC 云服务器（47.99.198.211），8890 端口提供 Nginx 静态页与 API/MCP 反代，为演示与 Dora 云端主入口。',
    },
    'sync_web_from_scene.sh': {
      category: '部署脚本',
      title: '前端同步脚本',
      desc: '将 02-前端/pages 与 catalog、JS 复制到 deploy/web，并重命名部署文件名（如 poc-status.html），为 upload_web_to_ecs 做准备。',
    },
    'upload_data_assets_to_ecs.py': {
      category: '部署脚本',
      title: '数据资产上传',
      desc: '将 attachments/ 附件与 catalog JSON 同步至 ECS Worker 可读路径，避免手工 SCP。',
    },
    'service-fault-graph.json': {
      category: '知识图谱',
      title: '故障图谱配置',
      desc: '定义故障码（如 E1001/E1002）到根因、方案、关联文档的映射，供知识图谱页与场景三 Agent 路由使用。',
    },
    'Stream Load': {
      category: '入库方式',
      title: 'Doris Stream Load',
      desc: '批量写入 Doris 表的 HTTP 导入方式，Worker 推送切片与向量数据时使用。',
    },
    Runbook: {
      category: '演示文档',
      title: '演示步骤手册',
      desc: '进展页中的 6.22 汇报演示顺序、时长与环节说明，供现场按步骤执行。',
    },
    SOP: {
      category: '知识产出',
      title: 'Standard Operating Procedure',
      desc: '标准作业程序库，场景三知识产出视图中的第三类成果，来源于 catalog 中登记的 SOP 类文档。',
    },
  };

  var SORTED_KEYS = Object.keys(TERMS).sort(function (a, b) { return b.length - a.length; });

  var tipEl = null;
  var hideTimer = null;

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function normalizeKey(text) {
    return String(text || '').trim().replace(/[.,;:!?）】]+$/g, '');
  }

  function lookup(key) {
    var k = normalizeKey(key);
    if (TERMS[k]) return TERMS[k];
    if (k.startsWith('/') && TERMS[k]) return TERMS[k];
    return null;
  }

  function injectStyles() {
    if (document.getElementById('poc-glossary-style')) return;
    var st = document.createElement('style');
    st.id = 'poc-glossary-style';
    st.textContent = [
      '.poc-glossary-term{cursor:help;border-bottom:1px dotted #64748b;text-decoration:none}',
      'code.poc-glossary-term{background:#e8f0fe}',
      '.poc-glossary-tip{position:fixed;z-index:99999;max-width:360px;padding:12px 14px;',
      'background:#0f2952;color:#f8fafc;border-radius:10px;font-size:12px;line-height:1.55;',
      'box-shadow:0 12px 32px rgba(15,41,82,.35);pointer-events:none;opacity:0;',
      'transition:opacity .12s ease}',
      '.poc-glossary-tip.show{opacity:1}',
      '.poc-glossary-tip .gt-cat{font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:.04em}',
      '.poc-glossary-tip .gt-title{font-weight:700;font-size:13px;margin:4px 0 6px;color:#fff}',
      '.poc-glossary-tip .gt-desc{color:#cbd5e1}',
      '.poc-glossary-tip .gt-rel{margin-top:8px;font-size:11px;color:#7dd3fc}',
      '.poc-glossary-table{width:100%;border-collapse:collapse;font-size:12px}',
      '.poc-glossary-table th,.poc-glossary-table td{border:1px solid #d7e1ef;padding:8px 10px;vertical-align:top;text-align:left}',
      '.poc-glossary-table th{background:#eef3f9;color:#0f2952}',
      '.poc-glossary-table tr:nth-child(even) td{background:#fafcff}',
      '.poc-glossary-table .term-key{font-family:ui-monospace,Menlo,monospace;font-size:11px;color:#1f55cc}',
    ].join('');
    document.head.appendChild(st);
  }

  function ensureTip() {
    if (tipEl) return tipEl;
    tipEl = document.createElement('div');
    tipEl.className = 'poc-glossary-tip';
    tipEl.setAttribute('role', 'tooltip');
    tipEl.id = 'poc-glossary-tip';
    document.body.appendChild(tipEl);
    return tipEl;
  }

  function showTip(termKey, anchor, clientX, clientY) {
    var entry = TERMS[termKey];
    if (!entry) return;
    var tip = ensureTip();
    tip.innerHTML =
      '<div class="gt-cat">' + escapeHtml(entry.category) + '</div>' +
      '<div class="gt-title">' + escapeHtml(entry.title) + '</div>' +
      '<div class="gt-desc">' + escapeHtml(entry.desc) + '</div>' +
      (entry.related ? '<div class="gt-rel">关联：' + escapeHtml(entry.related) + '</div>' : '');
    tip.classList.add('show');
    positionTip(tip, anchor, clientX, clientY);
  }

  function positionTip(tip, anchor, clientX, clientY) {
    var pad = 12;
    var x = (clientX != null ? clientX : 0) + 14;
    var y = (clientY != null ? clientY : 0) + 14;
    if (anchor && anchor.getBoundingClientRect) {
      var r = anchor.getBoundingClientRect();
      x = r.left;
      y = r.bottom + 8;
    }
    tip.style.left = '0';
    tip.style.top = '0';
    var tw = tip.offsetWidth;
    var th = tip.offsetHeight;
    if (x + tw + pad > window.innerWidth) x = window.innerWidth - tw - pad;
    if (y + th + pad > window.innerHeight) y = Math.max(pad, (clientY || r.top) - th - 8);
    if (x < pad) x = pad;
    tip.style.left = x + 'px';
    tip.style.top = y + 'px';
  }

  function hideTip() {
    if (tipEl) tipEl.classList.remove('show');
  }

  function bindTermEl(el, termKey) {
    if (!TERMS[termKey] || el.classList.contains('poc-glossary-bound')) return;
    el.classList.add('poc-glossary-term', 'poc-glossary-bound');
    el.setAttribute('data-glossary-key', termKey);
    el.setAttribute('tabindex', '0');
    el.setAttribute('aria-describedby', 'poc-glossary-tip');
    function onEnter(e) {
      clearTimeout(hideTimer);
      showTip(termKey, el, e.clientX, e.clientY);
    }
    function onMove(e) {
      if (tipEl && tipEl.classList.contains('show')) positionTip(tipEl, null, e.clientX, e.clientY);
    }
    function onLeave() {
      hideTimer = setTimeout(hideTip, 120);
    }
    el.addEventListener('mouseenter', onEnter);
    el.addEventListener('mousemove', onMove);
    el.addEventListener('mouseleave', onLeave);
    el.addEventListener('focus', onEnter);
    el.addEventListener('blur', onLeave);
  }

  function enhanceCodeElements(root) {
    root.querySelectorAll('code').forEach(function (code) {
      if (code.closest('pre')) return;
      var key = normalizeKey(code.textContent);
      if (TERMS[key]) bindTermEl(code, key);
    });
  }

  function enhanceArchDiagram(root) {
    root.querySelectorAll('.arch .u, .arch .b').forEach(function (span) {
      var key = normalizeKey(span.textContent);
      if (TERMS[key]) bindTermEl(span, key);
    });
  }

  function enhanceByAttribute(root) {
    root.querySelectorAll('[data-glossary]').forEach(function (el) {
      var key = el.getAttribute('data-glossary');
      if (key && TERMS[key]) bindTermEl(el, key);
    });
  }

  function enhancePlainText(root) {
    var plainTerms = ['SSOT', 'MCP', 'RAG', 'Dora', 'Doris', 'Worker', 'ECS', 'SOP', 'Runbook', 'trace', 'flatten', 'catalog'];
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: function (node) {
        var p = node.parentElement;
        if (!p) return NodeFilter.FILTER_REJECT;
        var tag = p.tagName;
        if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'CODE' || tag === 'A') return NodeFilter.FILTER_REJECT;
        if (p.closest('.poc-glossary-term, .poc-glossary-table, .poc-glossary-tip')) return NodeFilter.FILTER_REJECT;
        if (!node.textContent.trim()) return NodeFilter.FILTER_REJECT;
        return plainTerms.some(function (t) { return node.textContent.indexOf(t) >= 0; })
          ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      },
    });
    var nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(function (textNode) {
      var text = textNode.textContent;
      var frag = document.createDocumentFragment();
      var last = 0;
      var matches = [];
      plainTerms.forEach(function (term) {
        if (!TERMS[term]) return;
        var re = new RegExp('\\b' + term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'g');
        var m;
        while ((m = re.exec(text)) !== null) matches.push({ term: term, start: m.index, end: m.index + term.length });
      });
      if (!matches.length) return;
      matches.sort(function (a, b) { return a.start - b.start; });
      var filtered = [];
      matches.forEach(function (m) {
        if (!filtered.length || m.start >= filtered[filtered.length - 1].end) filtered.push(m);
      });
      filtered.forEach(function (m) {
        if (m.start > last) frag.appendChild(document.createTextNode(text.slice(last, m.start)));
        var span = document.createElement('span');
        span.className = 'poc-glossary-term-plain';
        span.textContent = text.slice(m.start, m.end);
        bindTermEl(span, m.term);
        frag.appendChild(span);
        last = m.end;
      });
      if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
      textNode.parentNode.replaceChild(frag, textNode);
    });
  }

  function renderTable(container) {
    if (!container) return;
    var cats = {};
    Object.keys(TERMS).sort().forEach(function (key) {
      var c = TERMS[key].category;
      if (!cats[c]) cats[c] = [];
      cats[c].push(key);
    });
    var html = ['<table class="poc-glossary-table"><thead><tr>',
      '<th>术语</th><th>分类</th><th>含义</th><th>关联</th></tr></thead><tbody>'].join('');
    Object.keys(cats).sort().forEach(function (cat) {
      cats[cat].forEach(function (key) {
        var e = TERMS[key];
        html += '<tr><td><span class="term-key poc-glossary-term-plain">' + escapeHtml(key) +
          '</span></td><td>' + escapeHtml(e.category) + '</td><td><strong>' +
          escapeHtml(e.title) + '</strong><br>' + escapeHtml(e.desc) + '</td><td>' +
          (e.related ? escapeHtml(e.related) : '—') + '</td></tr>';
      });
    });
    html += '</tbody></table>';
    container.innerHTML = html;
    container.querySelectorAll('.term-key').forEach(function (el) {
      bindTermEl(el, normalizeKey(el.textContent));
    });
  }

  function init(opts) {
    opts = opts || {};
    injectStyles();
    var root = opts.root || document.querySelector('.wrap') || document.body;
    enhanceCodeElements(root);
    enhanceArchDiagram(root);
    enhanceByAttribute(root);
    if (opts.plainText !== false) enhancePlainText(root);
    if (opts.table) {
      var el = typeof opts.table === 'string' ? document.querySelector(opts.table) : opts.table;
      renderTable(el);
    }
  }

  global.POC_GLOSSARY = {
    TERMS: TERMS,
    init: init,
    bindTermEl: bindTermEl,
    lookup: lookup,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      if (document.querySelector('[data-poc-glossary-auto]')) {
        init({ table: document.querySelector('#poc-glossary-table') });
      }
    });
  }
})(window);
