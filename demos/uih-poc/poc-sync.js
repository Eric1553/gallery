/**
 * 工作台 ↔ 知识图谱 跨页联动（localStorage + BroadcastChannel）
 */
(function (global) {
  const STORAGE_KEY = 'poc_workbench_sync_v1';
  const CHANNEL_NAME = 'poc_workbench_sync_v1';

  function load() {
    try {
      const raw = global.localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  function save(partial) {
    const prev = load();
    const next = Object.assign({}, prev, partial, { updatedAt: Date.now() });
    global.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    try {
      const ch = new BroadcastChannel(CHANNEL_NAME);
      ch.postMessage({ type: 'update', state: next });
      ch.close();
    } catch (_) {}
    return next;
  }

  function subscribe(handler) {
    const onStorage = (e) => {
      if (e.key === STORAGE_KEY) handler(load(), 'storage');
    };
    global.addEventListener('storage', onStorage);
    let ch = null;
    try {
      ch = new BroadcastChannel(CHANNEL_NAME);
      ch.onmessage = (e) => {
        if (e.data && e.data.state) handler(e.data.state, 'broadcast');
      };
    } catch (_) {}
    return function unsubscribe() {
      global.removeEventListener('storage', onStorage);
      if (ch) ch.close();
    };
  }

  /** 将 CATALOG + 文件队列 + 入库状态合并为图谱可用的文档节点 */
  function buildDocumentNodes(state) {
    const pushed = new Set(state.pushedDocIds || []);
    const fileMap = {};
    (state.fileStates || []).forEach((f) => {
      if (f.document_id) fileMap[f.document_id] = f;
    });
    return (state.catalog || [])
      .filter((c) => c.knowledge)
      .map((c) => {
        const fs = fileMap[c.document_id] || {};
        let ingestStatus = 'pending';
        if (pushed.has(c.document_id) || fs.status === 'pushed') ingestStatus = 'indexed';
        else if (fs.status === 'ready') ingestStatus = 'ready';
        else if (fs.status === 'error') ingestStatus = 'error';
        else if (['parsing', 'chunking', 'embedding'].includes(fs.status)) ingestStatus = 'processing';
        return {
          id: c.document_id,
          type: 'document',
          label: c.document_id,
          document_id: c.document_id,
          domain: c.domain,
          doc_type: c.doc_type,
          scene: c.scene,
          file: c.file,
          chunk_strategy: c.chunk_strategy,
          chunks: fs.chunks || 0,
          ingestStatus,
          isNew: !!fs.isNew,
        };
      });
  }

  global.POC_SYNC = {
    STORAGE_KEY,
    load,
    save,
    subscribe,
    buildDocumentNodes,
  };
})(window);
