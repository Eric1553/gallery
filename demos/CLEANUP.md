# Demo asset cleanup notes

Heavy or questionable files that were inventoried for this pass.
Prefer deleting true junk over functional assets.

## Removed

| Path | Why |
|---|---|
| `biren-finance/Users/lorin/...` | Accidental nested Mac absolute path (duplicate of the real demo) |
| `fde-carousel/server.py`, `start-server.sh`, `启动轮播.command` | Local video-server leftovers; gallery serves `index.html` statically with a client fallback |
| `fde-carousel/.fde-server.pid`, `.fde-server.log` | Runtime residue |
| `fde-carousel/*.docx` | Office notes, not referenced by the carousel page |
| `jiandaoyun-carousel/server.py`, `启动轮播.command`, `启动轮播.bat` | Same local-server leftovers; page already falls back to bundled GIFs |
| `acme-rd/帆软修改建议.xlsx` | Internal review spreadsheet, not used by `index.html` |
| `acme-rd/优化建议/帆软修改建议20260627.xlsx` | Duplicate office blob |
| `static-demos/jingxin-helmsman/index.html` | Byte-identical to `demos/jingxin-helmsman/index.html`; `demos/` is canonical |
| `static-demos/jingxin-helmsman-mobile/index.html` | Byte-identical to `demos/jingxin-helmsman-mobile/index.html` |

`static-demos/` now holds only a README pointing at `demos/` so the two trees cannot drift.

## `__rev*` orphans → archived catalog stubs

**Choice: keep the trees and register archived catalog stubs** (`family=biren-finance`, `archived=true`, `is_latest=false`). Not deleted: each revision is a frozen working copy (`REVISION.json` + its own `index.html` / JS), not an unused identical duplicate of `biren-finance`.

| id | Note |
|---|---|
| `biren-finance` | Latest, `family=biren-finance` |
| `biren-finance__baseline` | Already archived in the family |
| `biren-finance__rev1` | Archived stub — 订单总览日期维度; no thumb/cover (validator warn-only) |
| `biren-finance__rev2` | Archived stub — same theme, later stamp; no thumb/cover |
| `biren-finance__rev3` | Archived stub — CEO 五板块; has `thumb.webp` / `cover.webp` |

They stay out of the default latest pool and show under the biren-finance Archive panel. Still **client** audience (壁仞), not 帆软/FDE.

## echarts copies — kept (dedup unsafe)

| Path | md5 | Why kept |
|---|---|---|
| `biren-finance*/js/vendor/echarts.min.js` (5 trees) | identical | Each frozen package is self-contained; HTML uses a relative `js/vendor/` path. Pointing them at `/assets/vendor` would break offline/standalone copies and mix a shared public asset into private demo packages. |
| `smic-finance/assets/js/echarts.min.js` | different | Different build than biren |
| `weijie-sales/assets/echarts.min.js` | different | Different build than biren / smic |

No unused echarts copy was found inside demos. Shared `/assets/vendor` was considered and rejected for this pass.

## Deferred (do not delete without a replace asset)

| Path | Size (approx) | Why kept |
|---|---|---|
| `jiandaoyun-carousel/assets/gifs/assistant-qa-demo.gif` | 6.9 MB | Required by `index.html` fallback slides (`assets/gifs/assistant-qa-demo.gif`) |
| `jiandaoyun-carousel/assets/gifs/assistant-fill-demo.gif` | 4.3 MB | Same — `assistant-fill-demo.gif`. No unused GIF duplicate. |
| `hejian-wall/png/*.png` | ~0.7–1.8 MB each | Prototype-wall preview images used by the HTML cards |
| `fde-carousel` missing `DEMO/*.mp4|mov` | (already absent) | Videos were stripped earlier; page lists them as fallback URLs |
| `acme-rd/docs/screenshots/*.png` | ~1 MB each | Authoring screenshots, not the live entry path |
| `acme-rd/cover.png` | ~1 MB | Fallback cover next to `cover.webp` |
| `biren-ceo/server.py`, `biren-ops-loop/server.py` | small | Live MOSS demo servers, not accidental static leftovers |
| `*.bak-*` under biren-ceo / biren-ops-loop | small | Kept; not blocking runtime |

Git LFS / `demos/.gitattributes` was not added: remaining large files are functional GIF/PNG assets, not vendor duplicates.

## Verified 2026-09-13

Re-read this file on current `main` and re-scanned `demos/`. Policy unchanged; no unsafe deletes.

| Item | Status |
|---|---|
| `biren-finance__rev1/2/3` catalog stubs | **Already on main.** `family=biren-finance`, `archived=true`, `is_latest=false`, `audience=client`（壁仞）, `featured=false`. Latest remains `biren-finance`; `biren-finance__baseline` already archived. Out of default latest pool; shown on the biren-finance Archive panel. |
| rev1 / rev2 thumb/cover | Still missing. Validator warn-only. **Do not invent** fake covers. |
| rev3 thumb/cover | Present (`thumb.webp` / `cover.webp`). |
| jiandaoyun `assistant-*-demo.gif` | Still referenced by `jiandaoyun-carousel/index.html` fallback slides. **Keep.** |
| echarts copies (5× biren + smic + weijie) | Still per-package, still referenced. Dedup across frozen trees remains **unsafe**. |
| New junk matching the Removed table | None found (no nested `Users/…` Mac paths, no carousel `start-server` / `启动轮播` leftovers, no unreferenced office blobs). `biren-ceo/壁仞科技_CEO决策看板_客户演示操作说明.docx` is linked from that demo’s README — keep. `static-demos/` remains README-only. |

Handoff steps for later DEMO work: [`docs/DEMO-CHANGE-FLOW.md`](../docs/DEMO-CHANGE-FLOW.md). Merge ≠ deploy.
