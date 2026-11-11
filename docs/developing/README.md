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
- Test map fixture: `fixtures/dungeon-map-for-testing.png`

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
- Initiative: `room_initiative` includes `round`.
- Island layout: client-only `localStorage` key `dms-islands:<roomId>` (Map, Initiative, NPCs, Log).

### Session / battle log

See [ADR 0004](../decisions/0004-session-battle-log.md).

- Tables: `session_events` (append-only), `battles` (start/end timestamps).
- Snapshot fields: `eventLog`, `battle`.
- Events: map change, throttled token moves, initiative set/next, round advance, visibility, battle start/end.
- Auto-start battle on first `initiative:next` if none active; GM ends via `battle:end`.

Out of scope: Fog, `.dd2vtt` import, full monster stats, replay/video. Dice remain on the wire / `dice_log` but are not a Play island priority.

## Architecture pointers

- Binding agent/architecture context: [AGENTS.md](../../AGENTS.md)
- Phase 1 playable-cut spec: [../phase-1.md](../phase-1.md)
- Architecture Decision Records: [../decisions/README.md](../decisions/README.md)

Non-negotiables (see AGENTS.md): server is single source of truth; WebSocket events validated then broadcast to `room:{id}`; PixiJS v8; TypeScript `strict`.

## Related manuals

- Playing (EN): [../playing/en/README.md](../playing/en/README.md)
- Playing (DE): [../playing/de/README.md](../playing/de/README.md)
