# Developing — DMs-only-Friend

English developer guide: local setup, monorepo layout, Prep/Play architecture notes, and pointers into ADRs.

## Setup

Requirements: **Node.js 20+**, npm.

```bash
npm install
npm run dev
```

- Client: http://localhost:5173
- Server: http://localhost:3001
- Test map fixtures: `fixtures/dungeon-map-for-testing.png`, `fixtures/dungeon-map-for-testing.dd2vtt`, `fixtures/tiny-map-for-unit-tests.dd2vtt`

Quality gates (must stay green):

```bash
npm run lint
npm run test
npm run build
```

Docker is welcome for self-hosting later; it is **not** required for Phase 1 acceptance.

## Monorepo layout

npm workspaces:

| Package | Role |
|---|---|
| `shared/` | Shared event types and zod schemas (client + server) |
| `server/` | Express + Socket.IO, SQLite, uploads, dice |
| `client/` | Vite + React + TypeScript, PixiJS v8 map canvas, Zustand |

Uploads land under `server/uploads/`. Persistence is SQLite.

## Prep / Play architecture

See [ADR 0003](../decisions/0003-prep-play-ux.md).

- Multi-map: `maps` rows + `rooms.active_map_id`; upload **adds** a map.
- Roster: `characters` + `character_maps`; activating a map syncs tokens for linked characters.
- Visibility: `rooms.show_pcs` / `show_npcs`; snapshot tokens are filtered server-side.
- Settings: `rooms.screen_hp_quarters` (default 0); snapshot `settings`; `settings:set` / `settings:updated`.
- Initiative: `room_initiative` includes `round`.
- Island layout: client-only `localStorage` key `dms-islands:<roomCode>` (Map, Initiative, NPCs, Log, Dice, Fog); defaults use unique docks `tl/tr/mr/br/bl/ml`.
- Auth: creator-chosen room `code`, hashed `pin_hash`/`pin_salt`, single-use `gm_invite_hash`; GM join needs PIN (+ invite while pending). Upload routes require `X-Dms-Upload-Token` issued on GM `room:join`. See [ADR 0012](../decisions/0012-room-identity-gm-auth.md) and [ADR 0013](../decisions/0013-screen-hp-quarters.md).

### Session / battle log

See [ADR 0004](../decisions/0004-session-battle-log.md).

- Tables: `session_events` (append-only), `battles` (start/end timestamps).
- Snapshot fields: `eventLog`, `battle`.
- Events: map change, throttled token moves, initiative set/next, round advance, visibility, battle start/end, dice rolls.
- Auto-start battle on first `initiative:next` if none active; GM ends via `battle:end`.

### Dice Play island

See [ADR 0007](../decisions/0007-dice-play-island.md). GM island emits `dice:roll`; server uses `parseExpr`/`roll`, persists `dice_log`, broadcasts `dice:rolled`, and appends `dice_roll` to the session log. Screen/player show a short toast.

### Map import (.dd2vtt)

See [ADR 0008](../decisions/0008-dd2vtt-map-import.md).

- Parser: `server/src/dd2vtt.ts` (pure); upload path in `server/src/http.ts`.
- Persistence: `maps.walls_json` (grid-cell polylines from `line_of_sight`); embedded image written under `server/uploads/`.
- Client: GM-only wall overlay in `useMapScene`; Settings Maps accepts `.dd2vtt` beside PNG/JPG/WebP.
- Not yet: portals/lights rendering, automatic LoS fog, animated WebM packages.

### Manual fog of war

See [ADR 0010](../decisions/0010-manual-fog-of-war.md).

- Table: `map_fog` (`base_covered`, `strokes_json`) keyed by `map_id`.
- Snapshot field: `fog` for the active map.
- Events: `fog:paint`, `fog:reset` → `fog:updated` (GM only to mutate).
- Client: PixiJS v8 fog mask above tokens; Fog Play island for brush/rect tools.

Out of scope here: automatic LoS from walls, replay/video, WebM animated map layers.

### Character conditions

See [ADR 0011](../decisions/0011-token-conditions.md).

- Column: `characters.conditions_json` (Zod-validated enum ids).
- Event: `character:setConditions` (GM only) → `characters:updated` / snapshot.
- Client: toggle chips on Initiative + NPCs islands; compact badges on screen rail.

### Visual theme

See [ADR 0005](../decisions/0005-tavern-theme-lantern.md). CSS tokens + textures in `client/public/theme/`; lantern mode in `localStorage` (`dms-lantern`) via `document.documentElement.dataset.lantern`.

## Architecture pointers

- Binding agent/architecture context: [AGENTS.md](../../AGENTS.md)
- Phase 1 playable-cut spec: [../phase-1.md](../phase-1.md)
- Architecture Decision Records: [../decisions/README.md](../decisions/README.md)

Non-negotiables (see AGENTS.md): server is single source of truth; WebSocket events validated then broadcast to `room:{id}`; PixiJS v8; TypeScript `strict`.

## Related manuals

- Playing (EN): [../playing/en/README.md](../playing/en/README.md)
- Playing (DE): [../playing/de/README.md](../playing/de/README.md)
