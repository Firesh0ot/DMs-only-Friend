# Developing — DMs-only-Friend

English developer guide: local setup, monorepo layout, and pointers into architecture docs.

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

## Architecture pointers

- Binding agent/architecture context: [AGENTS.md](../../AGENTS.md)
- Phase 1 playable-cut spec: [../phase-1.md](../phase-1.md)
- Architecture Decision Records: [../decisions/README.md](../decisions/README.md)

Non-negotiables (see AGENTS.md): server is single source of truth; WebSocket events validated then broadcast to `room:{id}`; PixiJS v8; TypeScript `strict`.

## Related manuals

- Playing (EN): [../playing/en/README.md](../playing/en/README.md)
- Playing (DE): [../playing/de/README.md](../playing/de/README.md)
