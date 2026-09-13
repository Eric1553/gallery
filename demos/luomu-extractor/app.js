const $ = (selector) => document.querySelector(selector);
const dropzone = $("#dropzone");
const fileInput = $("#fileInput");
const fileBar = $("#fileBar");
const extractBtn = $("#extractBtn");
let selectedFile = null;
let pollTimer = null;

function formatSize(bytes) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function setFile(file) {
  if (!file) return;
  if (!file.name.toLowerCase().endsWith(".pdf")) {
    alert("请选择PDF文件");
    return;
  }
  selectedFile = file;
  $("#fileName").textContent = file.name;
  $("#fileSize").textContent = formatSize(file.size);
  fileBar.classList.remove("hidden");
  $("#resultPanel").classList.add("hidden");
}

dropzone.addEventListener("click", () => fileInput.click());
dropzone.addEventListener("keydown", (event) => {
  if (event.key === "Enter" || event.key === " ") fileInput.click();
});
$("#chooseBtn").addEventListener("click", (event) => {
  event.stopPropagation();
  fileInput.click();
});
fileInput.addEventListener("change", () => setFile(fileInput.files[0]));
["dragenter", "dragover"].forEach((name) => dropzone.addEventListener(name, (event) => {
  event.preventDefault();
  dropzone.classList.add("dragging");
}));
["dragleave", "drop"].forEach((name) => dropzone.addEventListener(name, (event) => {
  event.preventDefault();
  dropzone.classList.remove("dragging");
}));
dropzone.addEventListener("drop", (event) => setFile(event.dataTransfer.files[0]));

function updateStatus(job) {
  $("#statusPanel").classList.remove("hidden");
  $("#progressText").textContent = `${job.progress || 0}%`;
  $("#progressBar").style.width = `${job.progress || 0}%`;
  $("#statusMessage").textContent = job.message || "";
  const titles = {
    queued: "等待处理",
    processing: "正在识别报告",
    completed: "提取完成",
    failed: "提取失败",
  };
  $("#statusTitle").textContent = titles[job.status] || "处理中";
}

function renderPreview(rows) {
  const table = document.createElement("table");
  rows.forEach((row) => {
    const tr = document.createElement("tr");
    row.forEach((value) => {
      const td = document.createElement("td");
      td.textContent = value || "—";
      tr.appendChild(td);
    });
    table.appendChild(tr);
  });
  const wrap = document.createElement("div");
  wrap.className = "preview-wrap";
  wrap.appendChild(table);
  return wrap;
}

function renderResult(job) {
  const result = job.result;
  $("#resultPanel").classList.remove("hidden");
  $("#reportType").textContent = result.report_type === "annual" ? "年度报告" : "季度报告";
  $("#pageCount").textContent = `${result.matched_pages.length} / ${result.page_count}`;
  $("#tableCount").textContent = result.table_count;
  $("#resultFile").textContent = result.output_path;
  $("#downloadBtn").href = `/api/extractions/${job.id}/download`;

  const warnings = $("#warnings");
  if (result.warnings.length) {
    warnings.innerHTML = result.warnings.map((item) => `<div>• ${escapeHtml(item)}</div>`).join("");
    warnings.classList.remove("hidden");
  } else {
    warnings.classList.add("hidden");
  }

  const list = $("#tableList");
  list.innerHTML = "";
  result.tables.forEach((item) => {
    const article = document.createElement("article");
    article.className = "table-item";
    article.innerHTML = `
      <div class="table-meta">
        <h3>${escapeHtml(item.name)}</h3>
        <span>PDF第${item.page}页 · ${item.row_count}行 × ${item.column_count}列</span>
      </div>
      <p>${escapeHtml(item.purpose)}</p>
    `;
    article.appendChild(renderPreview(item.preview));
    list.appendChild(article);
  });
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
  }[char]));
}

async function poll(jobId) {
  const response = await fetch(`/api/extractions/${jobId}`);
  const job = await response.json();
  updateStatus(job);
  if (job.status === "completed") {
    clearTimeout(pollTimer);
    extractBtn.disabled = false;
    extractBtn.textContent = "重新提取";
    renderResult(job);
    return;
  }
  if (job.status === "failed") {
    clearTimeout(pollTimer);
    extractBtn.disabled = false;
    extractBtn.textContent = "重试";
    return;
  }
  pollTimer = setTimeout(() => poll(jobId), 900);
}

extractBtn.addEventListener("click", async () => {
  if (!selectedFile) return;
  extractBtn.disabled = true;
  extractBtn.textContent = "上传中…";
  $("#resultPanel").classList.add("hidden");
  const formData = new FormData();
  formData.append("file", selectedFile);
  try {
    const response = await fetch("/api/extractions", { method: "POST", body: formData });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.detail || "上传失败");
    updateStatus(payload);
    extractBtn.textContent = "处理中…";
    poll(payload.id);
  } catch (error) {
    extractBtn.disabled = false;
    extractBtn.textContent = "重试";
    alert(error.message);
  }
});
