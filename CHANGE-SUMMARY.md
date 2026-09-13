# Gallery Change Summary

## 2026-08-06 · 主列表按时间排序

- 筛选面板新增「排序」：时间升序（默认）、时间降序；`清除筛选` 不重置排序。
- 主列表 `#grid` 按 `added_at`（缺省再 `updated_at`，再 catalog 原序）排序；缺日期排在末尾。
- 精选区 `featured-wrap` 使用未排序的可见列表原序，不受排序控件影响。
- 搜索模式下主列表：相关度优先，时间作次级键；搜索建议下拉仍按相关度。
- `catalog.json`：`meta.version` 1.5.0、`sort_policy`，27 条 demo 均含 `added_at`。
- 缓存戳：`gallery.js` / `gallery.css` → `?v=20260806sort`。

---

# Gallery P0/P1 Baseline Change Summary

- Source snapshot: `/opt/demo-deploy/snapshots/gallery/20260804-233142`
- Isolated target: `/opt/demo-deploy/releases/gallery/20260804-233142-p0`
- Production state: untouched; no service, systemd, Nginx, `/opt/demo-gallery`, or `/opt/demos` changes were made.

## Changes

- Added fail-closed static path resolution for `/assets/`, `/covers/webp/`, and `/demos/`: resolved targets must remain under the allowed root; traversal and symlink escapes return HTTP 404.
- Replaced `scripts/sync_to_ecs.sh` with a scoped, dry-run-by-default workflow. It refuses frozen IDs, never applies deletion to the `/opt/demos` root, excludes `data/`, `covers/`, and `.stage/`, preserves cover/thumb files, and performs no service operations.
- Added minimal standard-library unit tests for a legal static asset, traversal rejection, symlink escape rejection, catalog JSON parsing, and frozen-ID sync refusal.
- No new runtime or test dependency was introduced; no requirements file was needed.

## Verification

- `python3 -m unittest discover -s tests -v`: 5 tests passed.
- Python AST parse: 6 files passed.
- JSON parse: 2 files passed.
- `bash -n scripts/sync_to_ecs.sh`: passed.
- `web/index.html`, `web/assets/gallery.js`, `web/assets/gallery.css`, `catalog.json`, and `search_index.json`: SHA256 unchanged from source.

## Release Notes / Risks

- This is an isolated release artifact only. Promotion of the Gallery module requires `release-ops` review and deployment.
- The scoped sync script intentionally refuses frozen Biren IDs and requires an existing remote demo target; this can block unsafe or first-time direct syncs by design.
- Runtime integration against the live Gallery was not performed because touching or restarting production was prohibited.
