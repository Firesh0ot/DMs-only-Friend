# DMs-only-Friend

Normally DMs have no friends. But this web app doesn't judge good throws.

**DMs-only-Friend** ist eine selbstgehostbare Web-App für Tabletop-Rollenspiele (D&D und andere Systeme). Sie zeigt Karten auf einem separaten Bildschirm (TV/Tablet als Spielbrett), synchron zur GM-Ansicht, und erleichtert dem Spieleleiter die Arbeit: Initiative-Tracker, Würfel, Fog of War, Monster-Quick-Stats.

## Status

Phase 1–2 table core is on main: rooms (PIN + single-use GM invite), multi-map Settings / Play islands, tokens + Follow-GM camera, initiative / HP / conditions, manual fog, `.dd2vtt` import, session log, dice island, tavern theme with self-hosted fonts, one-click link copy, player-token bind. **Docker / GHCR** table deploy is ready (`ghcr.io/firesh0ot/dms-only-friend`, host port **8042** → container **3001**); FQDN/TLS stay on your reverse proxy via `PUBLIC_ORIGIN` / `.env`, with optional Traefik labels (no bundled Caddy). Phase 3 LoS fog from `.dd2vtt` walls is on main ([ADR 0016](docs/decisions/0016-los-fog-from-walls.md)); remaining Phase 3 (doors/lights, WebM map packages) is next. Specs: [docs/phase-1.md](docs/phase-1.md), [ADR 0015](docs/decisions/0015-docker-ghcr-packaging.md). Playing: [EN](docs/playing/en/README.md) · [DE](docs/playing/de/README.md). Developing: [docs/developing/README.md](docs/developing/README.md).

## Documentation

- **Playing** — GM + remote player how-to: [EN](docs/playing/en/README.md) · [DE](docs/playing/de/README.md)
- **Developing** — setup, Docker/GHCR deploy, monorepo, architecture pointers: [docs/developing/README.md](docs/developing/README.md)
- **Decisions** — ADR index: [docs/decisions/README.md](docs/decisions/README.md)

## Dev

```bash
npm install
npm run dev
```

- Client: http://localhost:5173
- Server: http://localhost:3001
- Test map fixture: `fixtures/dungeon-map-for-testing.png`

```bash
npm run lint
npm run test
npm run build
```

## Deploy (Docker / GHCR)

Image: `ghcr.io/firesh0ot/dms-only-friend` (GitHub Actions publishes on `main` / `v*` — [`.github/workflows/docker-publish.yml`](.github/workflows/docker-publish.yml)). Full notes: [Developing — Docker / table deploy](docs/developing/README.md#docker--table-deploy).

```bash
cp .env.example .env   # edit PUBLIC_ORIGIN (and optional Traefik vars)
docker compose pull && docker compose up -d
```

LAN example without a `.env` file:

```bash
export PUBLIC_ORIGIN=http://192.168.1.10:8042
docker compose pull && docker compose up -d
```

- Default publish: host **8042** → container **3001** (`PORT` overrides the host side).
- Set `PUBLIC_ORIGIN` to the URL browsers actually open (scheme + host + port, no trailing slash) so GM invite / room links from the API are correct.
- Behind an existing reverse proxy: put the public HTTPS origin in `.env` (e.g. `PUBLIC_ORIGIN=https://vtt.example.com`). TLS and FQDN stay on the proxy — this compose file does **not** ship Caddy or Traefik as a service.
- Optional Traefik: `TRAEFIK_ENABLE=true` and `FQDN=vtt.example.com` enable Docker labels (`traefik.enable`, Host rule, `websecure`, service port **3001**). Defaults leave Traefik off so plain compose still works.
- **WebSockets required:** Socket.IO needs HTTP `Upgrade` / WebSockets through the proxy. If the browser hangs on **Joining room…**, the proxy is almost certainly blocking upgrades — see [Developing — reverse proxy / WebSockets](docs/developing/README.md#websockets-required-joining-room).
- Data (SQLite + uploads) lives in the `dms-data` volume.

## Kernentscheidungen

- **Web-App** (React + TypeScript, PixiJS/WebGL für die Karten-Canvas), kein Electron.
- **Backend**: Node.js + TypeScript, Socket.IO (WebSocket-Sync), Server = Single Source of Truth.
- **Persistenz**: SQLite, Dateien auf Disk. Self-Hosting via Docker/GHCR (`ghcr.io/firesh0ot/dms-only-friend`).
- **Auth**: Raum-Codes (kein Account-Zwang). GM erstellt Raum → Spieler/Screen joinen per Code/Link.
- **Karten-Import**: Universal VTT (`.dd2vtt`) als Standardformat → unterstützt Dungeon Map Builder, Dungeon Scrawl, Dungeondraft, Dungeon Alchemist. Fallback: PNG/JPG (manuelles Grid), animiertes WebM als Hintergrund-Layer.
- **KI-Maps (Roadmap Phase 4)**: prozedurales Layout (BSP/WFC) mit dd2vtt-kompatiblen Daten, optionale Bild-Stilisierung (Stable Diffusion/ControlNet, grid-genau) als Hintergrund-Layer.
- **MCP-Server (Roadmap Phase 5)**: separater Node-Service, exponiert GM-Aktionen als MCP-Tools.

## Rollen

| Rolle | Sicht |
|---|---|
| **GM** | Settings (Karten, Roster, Links) + Play-Inseln (Map, Initiative, NPCs) |
| **Player-Screen** | Karte + TCG-Initiative-Leiste, Kamera folgt dem GM |
| **Spieler (remote)** | Wie Player-Screen + eigener Token |

## Roadmap

- **Phase 1 – Tisch-Kern:** Raum-System, statische Karte (PNG) + Grid, Tokens draggen, WebSocket-Sync, Player-Screen via Link, einfache Würfel. *Ziel: eine echte Session spielbar.*
- **Phase 2 – DM-Werkzeuge:** Initiative-Tracker (persistente Rundenreihenfolge, Next-Turn, HP-Tracking), Monster-Quickstats, manuelle Fog-of-War-Ebene, Bedingungen auf Tokens.
- **Phase 3 – Map-Integration:** `.dd2vtt`-Importer (PNG, Grid, Wände, Türen, Lichter), Map-Paket-Manifest (dd2vtt + optionales animiertes WebM), automatischer Line-of-Sight-Fog, PNG-Fallback mit Grid-Einstellung.
- **Phase 4 – KI:** prozeduraler Dungeon-Generator mit dd2vtt-Export, danach Bild-Stilisierung als optionaler Layer.
- **Phase 5 – MCP & Feinschliff:** MCP-Server (place_token, roll, next_turn, reveal…), Sounds, Makros.

Detaillierte Phase-1-Spezifikation: [docs/phase-1.md](docs/phase-1.md)
