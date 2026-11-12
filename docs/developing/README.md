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

## Docker / table deploy

Production image: `ghcr.io/firesh0ot/dms-only-friend` (published from `main` / `v*` tags via [`.github/workflows/docker-publish.yml`](../../.github/workflows/docker-publish.yml)). See [ADR 0015](../decisions/0015-docker-ghcr-packaging.md). Copy [`.env.example`](../../.env.example) to `.env` and edit as needed.

**Image deps:** the Dockerfile’s `prod-deps` stage installs server/shared production workspaces (`npm ci --omit=dev -w @dms/server -w @dms/shared`) and copies both the hoisted root `node_modules` and any nested `server/node_modules` (needed when npm nests a major that differs from the client tree, e.g. `nanoid@5`). After merging packaging changes, wait for the GHCR publish workflow on `main`, then `docker compose pull && docker compose up -d`.

**Pull and run (compose):**

```bash
export PUBLIC_ORIGIN=http://192.168.1.10:8042   # LAN IP or public URL clients will open
docker compose pull
docker compose up -d
```

Or build locally:

```bash
PUBLIC_ORIGIN=http://localhost:8042 docker compose up -d --build
```

Open `PUBLIC_ORIGIN` in the browser (default host port **8042**, container listens on **3001**). SQLite + uploads persist in the `dms-data` volume (`DATA_DIR=/data` → `/data/dms.sqlite`, `/data/uploads`).

**`PUBLIC_ORIGIN`:** must match the URL players/TV use (scheme + host + port, no trailing slash). The server embeds it in GM invite / room links from the HTTP API (`server/src/index.ts` → `createHttpApp`). Screen/player links built in the browser already use `window.location.origin`.

### Behind your reverse proxy

TLS and the public FQDN stay on your existing reverse proxy — compose does **not** ship Caddy/Traefik as a service. Set `PUBLIC_ORIGIN` to the public HTTPS origin so invite/screen links are correct:

```bash
# .env
PUBLIC_ORIGIN=https://vtt.example.com
PORT=8042
```

Point the proxy at the published host port (default **8042**) or at container **3001** on a shared Docker network.

#### WebSockets required (“Joining room…”)

Room join and live sync use **Socket.IO** over WebSocket (with HTTP long-polling fallback). The reverse proxy must forward HTTP **`Upgrade`** / WebSocket connections to the app. If upgrades are stripped or refused, the UI often loads but then sticks on **Joining room…** and never receives the room snapshot.

Symptoms: static assets and `/api/health` work; DevTools → Network shows Socket.IO failing to upgrade (or endless polling that never completes join).

**Traefik (optional labels, off by default):** compose already exposes labels that route HTTP to port **3001**. Traefik passes WebSockets by default — do not add middlewares that drop `Connection` / `Upgrade`. Enable with:

```bash
# .env — attach this service to an existing Traefik
TRAEFIK_ENABLE=true
FQDN=vtt.example.com
PUBLIC_ORIGIN=https://vtt.example.com
```

Labels applied when enabled: `traefik.enable`, `traefik.http.routers.dms.rule=Host(…)`, `traefik.http.routers.dms.entrypoints` (default `websecure`), `traefik.http.routers.dms.tls`, `traefik.http.services.dms.loadbalancer.server.port=3001`. Put the container on the same Docker network as Traefik (external network) if needed — no bundled proxy stack.

**nginx** (proxy to published host port **8042**, or to container **3001** on a Docker network):

```nginx
location / {
  proxy_pass http://127.0.0.1:8042;
  proxy_http_version 1.1;
  proxy_set_header Host $host;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto $scheme;
  proxy_set_header Upgrade $http_upgrade;
  proxy_set_header Connection "upgrade";
}
```

**Caddy:** `reverse_proxy` upgrades WebSockets by default — just point it at the same upstream and set `PUBLIC_ORIGIN` to the public HTTPS origin.

**One-liner without compose:**

```bash
docker run --rm -p 8042:3001 \
  -e PUBLIC_ORIGIN=http://192.168.1.10:8042 \
  -v dms-data:/data \
  ghcr.io/firesh0ot/dms-only-friend:latest
```

Env knobs: `PORT`, `HOST` (default `0.0.0.0`), `DATA_DIR`, `UPLOADS_DIR`, `DMS_DB_PATH`, `PUBLIC_ORIGIN`, `CLIENT_DIST`, plus compose-only `TRAEFIK_ENABLE`, `FQDN`, `TRAEFIK_ENTRYPOINTS`, `TRAEFIK_TLS`, `DMS_IMAGE_TAG`.

Local `npm run dev` remains the day-to-day path; Docker is for self-host / table deploy.

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
- Auth: creator-chosen room `code`, hashed `pin_hash`/`pin_salt`, single-use `gm_invite_hash`; GM join needs PIN (+ invite while pending). Joined GM may change PIN via `gm:changePin` (optional invite invalidation). Upload routes require `X-Dms-Upload-Token` issued on GM `room:join`. See [ADR 0012](../decisions/0012-room-identity-gm-auth.md) and [ADR 0013](../decisions/0013-screen-hp-quarters.md).

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
- Persistence: `maps.walls_json` (grid-cell polylines from `line_of_sight`) and `maps.portals_json` (doors from `portals`); embedded image written under `server/uploads/`.
- Client: GM-only wall + door overlay in `useMapScene`; Settings Maps accepts `.dd2vtt` beside PNG/JPG/WebP.
- Automatic LoS fog: see below / [ADR 0016](../decisions/0016-los-fog-from-walls.md). Doors: [ADR 0017](../decisions/0017-dd2vtt-doors-portals.md). Not yet: lights rendering, animated WebM packages.

### Manual fog of war

See [ADR 0010](../decisions/0010-manual-fog-of-war.md).

- Table: `map_fog` (`base_covered`, `strokes_json`, `los_enabled`) keyed by `map_id`.
- Snapshot field: `fog` for the active map (`losEnabled` included).
- Events: `fog:paint`, `fog:reset`, `fog:setLos` → `fog:updated` (GM only to mutate).
- Client: PixiJS v8 fog mask above tokens; Fog Play island for brush/rect tools and LoS toggle.

### Automatic LoS fog

See [ADR 0016](../decisions/0016-los-fog-from-walls.md).

- Vision from PC tokens against `maps.walls_json` plus **closed** portals from `maps.portals_json`.
- Client: `losVisibility.ts` ray cast; composed with manual fog (visible only if both allow).
- Door toggle: GM `portal:setClosed` → map broadcast; Fog island door buttons + click door overlay.
- Out of scope here: lights, vision radius, replay/video, WebM animated map layers.

### Character conditions

See [ADR 0011](../decisions/0011-token-conditions.md).

- Column: `characters.conditions_json` (Zod-validated enum ids).
- Event: `character:setConditions` (GM only) → `characters:updated` / snapshot.
- Client: toggle chips on Initiative + NPCs islands; compact badges on screen rail.

### Visual theme

See [ADR 0005](../decisions/0005-tavern-theme-lantern.md). CSS tokens + textures in `client/public/theme/`; lantern mode in `localStorage` (`dms-lantern`) via `document.documentElement.dataset.lantern`. Display/body fonts (Cinzel, IBM Plex Sans) are self-hosted via `@fontsource/*` imports in the client (`font-display: swap`); OFL texts live under `client/licenses/`. No Google Fonts CDN — LAN/offline builds stay intact.

## Architecture pointers

- Binding agent/architecture context: [AGENTS.md](../../AGENTS.md)
- Phase 1 playable-cut spec: [../phase-1.md](../phase-1.md)
- Architecture Decision Records: [../decisions/README.md](../decisions/README.md)

Non-negotiables (see AGENTS.md): server is single source of truth; WebSocket events validated then broadcast to `room:{id}`; PixiJS v8; TypeScript `strict`.

## Related manuals

- Playing (EN): [../playing/en/README.md](../playing/en/README.md)
- Playing (DE): [../playing/de/README.md](../playing/de/README.md)
