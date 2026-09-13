/**
 * 联影 PoC · 文档清单加载器（SSOT: poc-chunk-profiles.json）
 * 工作台 / 知识产出页 / Worker attachments API 共用同一 flatten 规则
 */
(function (global) {
  const SCENE_BLOCKS = {
    scene1_finance: 1,
    scene2_otd: 2,
    scene3_service: 3,
  };

  function flattenProfiles(profiles) {
    if (!profiles || typeof profiles !== 'object') return [];
    const out = [];
    for (const [key, block] of Object.entries(profiles)) {
      const scene = block.scene || SCENE_BLOCKS[key];
      if (!scene || !block.documents) continue;
      const domain = block.domain || '';
      for (const doc of block.documents) {
        if (!doc.document_id || !doc.file) continue;
        out.push({
          scene,
          domain: doc.domain || domain,
          document_id: doc.document_id,
          file: doc.file,
          doc_type: doc.doc_type || 'policy',
          chunk_strategy: doc.chunk_strategy || 'paragraph',
          chunk_size: doc.chunk_size || 480,
          overlap: doc.overlap != null ? doc.overlap : 64,
          knowledge: doc.knowledge !== false,
          structured: !!doc.structured,
          title: doc.title || doc.file.replace(/\.[^.]+$/, ''),
          device_models: doc.device_models || [],
          fault_codes: doc.fault_codes || [],
          confidence: doc.confidence,
          confidence_label: doc.confidence_label,
          confidence_source: doc.confidence_source,
          demo_queries: doc.demo_queries || [],
          keywords: doc.keywords || [],
          note: doc.note || '',
          _raw: doc,
        });
      }
    }
    return out;
  }

  function knowledgeCatalog(flat) {
    return (flat || []).filter((c) => c.knowledge);
  }

  function byScene(flat, scene) {
    return (flat || []).filter((c) => c.scene === scene);
  }

  async function fetchJson(urls, timeoutMs) {
    const list = Array.isArray(urls) ? urls : [urls];
    let lastErr = null;
    for (const u of list) {
      if (!u) continue;
      try {
        const r = await fetch(u, { signal: AbortSignal.timeout(timeoutMs || 10000) });
        if (r.ok) return r.json();
        lastErr = new Error('HTTP ' + r.status + ' @ ' + u);
      } catch (e) {
        lastErr = e;
      }
    }
    throw lastErr || new Error('无法加载 catalog');
  }

  async function loadProfiles(opts) {
    const base = (opts && opts.base) || (global.POC_PATHS && global.POC_PATHS.getWorkerBase()) || '';
    const origin = global.location && global.location.origin && global.location.protocol.startsWith('http')
      ? global.location.origin.replace(/\/$/, '') : '';
    const urls = [
      base ? base + '/poc-chunk-profiles.json' : '',
      origin ? origin + '/poc-chunk-profiles.json' : '',
      '../01-数据资产/catalog/poc-chunk-profiles.json',
      'poc-chunk-profiles.json',
    ].filter(Boolean);
    return fetchJson(urls, opts && opts.timeout);
  }

  async function loadDemoPaths(opts) {
    const base = (opts && opts.base) || (global.POC_PATHS && global.POC_PATHS.getWorkerBase()) || '';
    const origin = global.location && global.location.origin && global.location.protocol.startsWith('http')
      ? global.location.origin.replace(/\/$/, '') : '';
    const urls = [
      base ? base + '/poc-demo-paths.json' : '',
      origin ? origin + '/poc-demo-paths.json' : '',
      'poc-demo-paths.json',
    ].filter(Boolean);
    try {
      return await fetchJson(urls, opts && opts.timeout);
    } catch (_) {
      return { paths: {}, otd_tables: [] };
    }
  }

  async function loadCatalog(opts) {
    const profiles = await loadProfiles(opts);
    const flat = flattenProfiles(profiles);
    return { profiles, flat, knowledge: knowledgeCatalog(flat) };
  }

  function sopIndexFromCatalog(flat) {
    return flat.filter((c) => c.knowledge && (c.doc_type === 'SOP' || c.doc_type === 'manual'));
  }

  function experienceIndexFromCatalog(flat) {
    return flat.filter((c) => c.knowledge && (c.doc_type === 'experience' || c.doc_type === 'report'));
  }

  global.POC_CATALOG = {
    SCENE_BLOCKS,
    flattenProfiles,
    knowledgeCatalog,
    byScene,
    loadProfiles,
    loadDemoPaths,
    loadCatalog,
    sopIndexFromCatalog,
    experienceIndexFromCatalog,
  };
})(typeof window !== 'undefined' ? window : globalThis);
