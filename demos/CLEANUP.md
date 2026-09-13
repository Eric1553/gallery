# Demo asset cleanup notes

Heavy or questionable files that were inventoried for this pass.
Prefer deleting true junk over functional assets.

## Removed (this PR)

| Path | Why |
|---|---|
| `biren-finance/Users/lorin/...` | Accidental nested Mac absolute path (duplicate of the real demo) |
| `fde-carousel/server.py`, `start-server.sh`, `启动轮播.command` | Local video-server leftovers; gallery serves `index.html` statically with a client fallback |
| `fde-carousel/.fde-server.pid`, `.fde-server.log` | Runtime residue |
| `fde-carousel/*.docx` | Office notes, not referenced by the carousel page |
| `jiandaoyun-carousel/server.py`, `启动轮播.command`, `启动轮播.bat` | Same local-server leftovers; page already falls back to bundled GIFs |
| `acme-rd/帆软修改建议.xlsx` | Internal review spreadsheet, not used by `index.html` |
| `acme-rd/优化建议/帆软修改建议20260627.xlsx` | Duplicate office blob |

## Deferred (do not delete without a replace asset)

| Path | Size (approx) | Why kept |
|---|---|---|
| `jiandaoyun-carousel/assets/gifs/assistant-qa-demo.gif` | 6.9 MB | Referenced by `index.html` fallback slides |
| `jiandaoyun-carousel/assets/gifs/assistant-fill-demo.gif` | 4.3 MB | Same — removing blanks the archived carousel |
| `hejian-wall/png/*.png` | ~0.7–1.8 MB each | Prototype-wall preview images used by the HTML cards |
| `fde-carousel` missing `DEMO/*.mp4|mov` | (already absent) | Videos were stripped earlier; page lists them as fallback URLs |
| `acme-rd/docs/screenshots/*.png` | ~1 MB each | Authoring screenshots, not the live entry path |
| `acme-rd/cover.png` | ~1 MB | Fallback cover next to `cover.webp` |
| `biren-finance__rev1/2/3/` | full trees | Uncatalogued historical revs; validator warns only |
| `biren-ceo/server.py`, `biren-ops-loop/server.py` | small | Live MOSS demo servers, not accidental static leftovers |
| `*.bak-*` under biren-ceo / biren-ops-loop | small | Kept; not blocking runtime |

Git LFS / `demos/.gitattributes` was not added: remaining large files are functional GIF/PNG assets, not vendor duplicates.
