# Gallery Change Summary

## 2026-09-13 · nginx auth_request gate

- `GET /api/auth/gate` (also `/gallery/api/auth/gate`): **204** if `gallery_session` is valid, **401** if not. Never 2xx when unauthenticated.
- `/api/auth/status` unchanged: still 200 JSON `{ok: true|false}` for the SPA.
- `public_path()` strips a `/gallery` mount prefix so the gate works with or without nginx path strip.

---

## 2026-09-13 · Presales Brief v1（规范，未部署）

- Canonical schema `schemas/presales_brief.v1.json` + `docs/PRESALES-BRIEF.md`. Fields: meta / customer / visit (narrative=今天讲什么, red_lines=红线, shareability) / demos / talking_points / materials / gaps / provenance.
- `presales_brief.py`: load / validate / normalize; `from_gallery_federation`; `from_knowledge_card` stub (no demo-knowledge import); `to_meeting_card`; `from_ammo_brief` / `to_ammo_brief` (leftover pack keys in `extensions.ammo`).
- `gallery_brief.build_gallery_brief` dual-writes `presales_brief` (v1) while keeping meeting-card keys the frontend already reads (`account`, `stance`, `talk`, `demos.href`, `share`, `internal`, `redlines`, `coverage`).
- Additive read API `GET /api/brief?q=` or `?customer=` (same `_authed()` as `/api/search`). `/api/search` contract unchanged.
- Tests: `tests/test_presales_brief.py` (schema, adapters, gallery mapping, API auth). Knowledge-pack tests remain skip-when-absent.
- Verification (after rebase onto `0a69792` auth hardening): `python3 -m unittest discover -s tests -v` → 59 tests, 2 skipped (demo-knowledge not mounted), 0 failed. `pytest` is not installed in this environment; unittest is the documented runner.
- No secrets, no ECS / systemd, no MaxKB password, no UI theme changes. Merge ≠ deploy; GB wires later.

---

## 2026-09-13 · Auth on demos/covers, fail-closed password, Secure cookie

- `/demos/*` and `/covers/*` require a valid `gallery_session`, same as catalog/search. `/`, `/index.html`, `/assets/` stay public so the gate can load.
- Unauthenticated XHR/fetch/images → `401` JSON `{ok:false,error:unauthorized}` (same as catalog APIs). Browser HTML navigations (`Sec-Fetch-Mode: navigate` / `Accept: text/html`) → `302 Location: /`.
- Removed hardcoded default password. Startup fails closed unless `GALLERY_PASSWORD` or `auth.json` password is set.
- Session cookie gets `Secure` only on HTTPS, `X-Forwarded-Proto=https`, or `GALLERY_COOKIE_SECURE=1`.
- Federated search 401 shows unlock prompt (progress no longer freezes). Catalog load failure shows visible error + retry.
- Asset cache stamp `?v=20260913auth`.
- `biren-finance__rev1/2/3` registered as archived family stubs (trees kept). `static-demos/` HTML removed (canonical = `demos/`). echarts copies and jiandaoyun GIFs kept — see `demos/CLEANUP.md`.
- Tests: `tests/test_gallery_auth.py`. Merge ≠ deploy.

---

## 2026-09-13 · Catalog contract / federation / junk cleanup

- Catalog: every demo now has explicit `audience` (`client`|`internal`); `biren-finance__baseline` is archived in family `biren-finance` so it is not in the default latest pool. Tags remain 4.
- Added `scripts/validate_catalog.py` (fields / audience / family / entry+thumb / search index). Pytest wraps it. Historical `biren-finance__rev1/2/3` stay uncatalogued (warn-only orphans).
- Federated search runs MaxKB / KMS / 反馈 / 飞书 channels concurrently with a per-source deadline (`GALLERY_FED_TIMEOUT`, default 10s). Feedback admin/shot URLs read `FEEDBACK_PUBLIC_BASE` or `GALLERY_FEEDBACK_BASE` (legacy ECS IP is the default).
- Removed Mac-path junk under `biren-finance/Users`, carousel local-server residue, and unused office docs. Functional GIFs / hejian PNGs deferred — see `demos/CLEANUP.md`.
- `retrieve_query` / demo needles now strip `怎么讲` tails even when the demo-knowledge account pack is absent (same documented behavior).
- `tests/test_gallery_brief.py` skips when `KNOWLEDGE_ROOT` / demo-knowledge is not mounted (2 tests). Other pytest cases pass locally.
- Merge ≠ deploy; no ECS / systemd changes.

---

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
