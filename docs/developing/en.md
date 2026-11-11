# Developing — DMs-only-Friend

## Stack

npm workspaces: `shared/` (zod events), `server/` (Express + Socket.IO + SQLite), `client/` (React + PixiJS v8 + Zustand).

```bash
npm install
npm run dev
npm run lint && npm run test && npm run build
```

## Prep / Play architecture

See [ADR 0003](../decisions/0003-prep-play-ux.md).

- Multi-map: `maps` rows + `rooms.active_map_id`; upload **adds** a map.
- Roster: `characters` + `character_maps`; activating a map syncs tokens for linked characters.
- Visibility: `rooms.show_pcs` / `show_npcs`; snapshot tokens are filtered server-side.
- Initiative: `room_initiative` includes `round`.
- Island layout: client-only `localStorage` key `dms-islands:<roomId>`.

## Fixtures

PNG smoke map: `fixtures/dungeon-map-for-testing.png` (also tiny PNG for unit upload tests).

## Out of scope here

Fog, `.dd2vtt` import, battle log, full monster stats. Dice remain available on the wire but are not a Play island priority.
