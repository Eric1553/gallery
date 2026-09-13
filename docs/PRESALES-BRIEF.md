# Presales Brief v1

Canonical pre-meeting brief for **Gallery / Knowledge / Ammo**.  
One schema, three projections. This repo is the source of truth; sibling modules should map to it rather than grow a second card shape.

Schema file: [`schemas/presales_brief.v1.json`](../schemas/presales_brief.v1.json)  
Python: [`presales_brief.py`](../presales_brief.py) (load / validate / normalize + adapters)

**This PR does not deploy.** GB / release-ops can wire and ship later.

## Fields

| Block | Fields | Notes |
|---|---|---|
| `meta` | `schema_version` (`"1"`), `brief_id`, `updated_at`, `owner`, `status` | `status`: `draft` \| `ready` \| `archived` |
| `customer` | `name`, `short_name`, `industry`, `audience_notes` | Audience notes = who is in the room |
| `visit` | `date?`, `goal`, `narrative`, `red_lines[]`, `shareability` | `narrative` = 今天讲什么; `red_lines` = 红线 |
| `visit.shareability` | `external[]`, `internal_only[]` | String or `{title, snippet, url?}` |
| `demos[]` | `id`, `title`, `hall`, `why`, `featured?` | `hall` from catalog when known |
| `talking_points[]` | `title`, `body`, `source?` | Knowledge `talk[]` maps here |
| `materials` | `knowledge[]`, `ammo_pack_ids[]`, `links[]` | Do not flatten ammo pack extras |
| `gaps[]` | string or `{id, note, area?}` | Thin / missing coverage |
| `provenance.sources[]` | `{module, ref}` | `gallery`, `knowledge`, `ammo`, … |
| `extensions` | free object | **Ammo leftovers** live in `extensions.ammo` |

Unknown keys are kept (additionalProperties). Additive only.

## Projections

```
                    ┌─────────────────────┐
   Knowledge        │  Presales Brief v1  │        Ammo
   meeting card ──► │  schemas/…v1.json   │ ◄──► data/packs/*/brief.json
   /knowledge/      │  presales_brief.py  │
                    └──────────▲──────────┘
                               │
                    Gallery federation
                    + catalog.json
                    GET /api/brief?q=
                    /api/search → briefing.presales_brief
```

### Gallery (this repo)

- `from_gallery_federation(query, payload)` builds v1 from federated hits + catalog (`hall` / `featured` / `summary`).
- `gallery_brief.build_gallery_brief` still returns the **meeting-card** keys the frontend already reads (`account`, `stance`, `talk`, `demos[].href`, `share`, `internal`, `redlines`, `coverage`, …) and **dual-writes** `presales_brief` (v1) on the same object.
- `GET /api/brief?q=` or `?customer=` (session / device auth, same as `/api/search`) returns `{ ok, query, brief }` where `brief` is v1.

### Knowledge (not in this repo)

- Meeting-card → v1: `from_knowledge_card(card)` (import-tolerant stub; no `demo-knowledge` import required).
- v1 → meeting-card: `to_meeting_card(brief)` for `/knowledge/` or Gallery `fed-brief`.
- Load the pack the same way as today: `KNOWLEDGE_ROOT`, `/opt/demo-runtime/demo-knowledge/current`, or sibling `demo-knowledge`. Gallery already uses that list in `gallery_brief._load_knowledge`.

### Ammo (`data/packs/<id>/brief.json`)

- v1 → pack file: `to_ammo_brief(brief)`  
  Maps `customer.name` → `customer`, `visit.goal/narrative/red_lines`, `talking_points`, `demos`, `materials.*`.  
  **Does not drop** leftover pack keys: they are copied from `extensions.ammo`.
- pack file → v1: `from_ammo_brief(ammo)`  
  Inverse map; unmapped keys go to `extensions.ammo` so a round-trip keeps them.

Do not delete ammo fields such as `pack_id`, `title`, `moss_*`, custom lanes — pass them through `extensions.ammo`.

## Read API (Gallery)

```
GET /api/brief?q=壁仞怎么讲
GET /api/brief?customer=壁仞
```

- Requires Gallery auth (same `_authed()` / `gallery_session` as `/api/search`).
- `q` / `customer` aliases; shorter than 2 characters → `200` + empty draft brief + `meta.note`.
- Implementation: `federated_search` then project v1 (reuses `/api/search` briefing when present).
- Unauthenticated → `401 {"ok": false, "error": "unauthorized"}`.

`/api/search` is unchanged for the UI. The meeting-card stays at `briefing`; v1 is `briefing.presales_brief` only.

## How GB wires this later

1. Merge this PR. **Do not deploy** until Lorin asks.
2. Gallery runtime: ship `presales_brief.py`, `schemas/`, `gallery_brief.py`, `server.py`. Nginx already prefixes `/api/`; no new route on the portal.
3. Knowledge: call `from_knowledge_card` / `to_meeting_card` from `briefing.py` when that repo is next touched. Keep `KNOWLEDGE_ROOT` mounts.
4. Ammo: read/write `data/packs/<id>/brief.json` via `from_ammo_brief` / `to_ammo_brief`. Keep pack-specific keys.
5. Optional: Knowledge or portal can `GET /gallery/api/brief?q=` with the advisor session.

## Example (trimmed)

```json
{
  "meta": {
    "schema_version": "1",
    "brief_id": "psb-biren",
    "updated_at": "2026-09-13T10:00:00Z",
    "owner": "gallery",
    "status": "draft"
  },
  "customer": {
    "name": "壁仞科技",
    "short_name": "壁仞",
    "industry": "半导体",
    "audience_notes": ""
  },
  "visit": {
    "date": null,
    "goal": "",
    "narrative": "今天讲经营闭环与财经驾驶舱",
    "red_lines": ["不要承诺未上线的集团合并口径"],
    "shareability": { "external": [], "internal_only": [] }
  },
  "demos": [
    {
      "id": "biren-ceo",
      "title": "壁仞科技 · CEO 决策看板",
      "hall": "ceo",
      "why": "客户 · 壁仞科技",
      "featured": true
    }
  ],
  "talking_points": [],
  "materials": { "knowledge": [], "ammo_pack_ids": [], "links": [] },
  "gaps": [],
  "provenance": { "sources": [{ "module": "gallery", "ref": "federated_search" }] }
}
```
