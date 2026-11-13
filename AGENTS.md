# AGENTS.md

Dieses Dokument ist der verbindliche Kontext für alle Coding-Agenten (Cursor etc.), die an diesem Repo arbeiten.

## Projekt

**DMs-only-Friend** – selbstgehostbare Web-App für Tabletop-Rollenspiele (D&D u. a.). Zeigt Karten auf einem separaten Bildschirm (TV/Tablet als Spielbrett) synchron zur GM-Ansicht und unterstützt den GM (Initiative, Würfel, Fog of War, Monster-Stats). Hybrid nutzbar: lokal am Tisch (LAN, ohne Internet) und mit Remote-Spielern.

## Architektur-Prämissen (nicht verhandeln)

- **Web-App**: React + TypeScript Client, **PixiJS v8** (WebGL) für die Karten-Canvas. Kein Electron/Tauri.
- **Monorepo** (npm workspaces): `server/`, `client/`, `shared/` (geteilte Event-/Typdefinitionen).
- **Backend**: Node.js 20+, TypeScript strict, Express, **Socket.IO**, better-sqlite3, multer, `zod` für Event-Validierung.
- **Server = Single Source of Truth**: alle Aktionen sind WebSocket-Events, Server validiert und broadcastet an `room:{id}`. Clients dürfen optimistic Updates zeigen, korrigieren aber anhand der Server-Antwort.
- **Persistenz**: SQLite (`rooms`, `maps`, `tokens`, `dice_log`), Uploads als Dateien in `server/uploads/`.
- **Auth**: Selbst gewählte Raum-Codes, kein Account-Zwang. GM braucht PIN + einmaligen Invite-Link (danach PIN zum Rejoin). Rollen: `gm`, `screen` (Player-Screen), `player` (remote).
- **Berechtigungen**: Nur `gm` darf `map:*`, HTTP-Uploads und `token:create/remove`. Spieler dürfen nur ihren eigenen Token bewegen.
- **Karten-Import**: Universal VTT (`.dd2vtt`) als Standardformat (unterstützt Dungeon Map Builder, Dungeon Scrawl, Dungeondraft, Dungeon Alchemist). Fallback: PNG/JPG mit manuellem Grid; animiertes WebM als optionaler Hintergrund-Layer. Kein Einbetten externer Editoren.
- **KI-Maps** (Phase 6): prozedurales Layout (BSP/WFC) → dd2vtt-konforme Daten; optionale Bild-Stilisierung (Stable Diffusion/ControlNet, grid-genau) als Hintergrund-Layer.
- **MCP-Server** (Phase 7): separater Node-Service, spricht die Backend-API an, exponiert Tools wie `place_token`, `roll`, `next_turn`, `reveal_area`.

## Konventionen

- TypeScript `strict: true`, keine Kommentare im Code, sprechende Namen, kleine Funktionen.
- Lint/Format: ESLint + Prettier. Tests: Vitest.
- Würfel werden **auf dem Server** gewürfelt (Dice-Parser als isolierte, pure Funktion: `parseExpr`, `roll`) – unit-testbar, nicht manipulierbar.
- PixiJS v8 API (async `application.init()`), nicht v7 mischen.
- Uploads: Größenlimit 50 MB, Whitelist png/jpg/webp/webm; Karten zusätzlich `.dd2vtt` (Server extrahiert Bild + Grid + Wände).
- State im Client: Zustand (Zustand-Store) + Snapshot bei Join.

## Roadmap

1. **Phase 1 – Tisch-Kern:** Raum-System, statische Karte (PNG) + Grid, Tokens draggen, WebSocket-Sync, Player-Screen via Link, einfache Würfel. → [docs/phase-1.md](docs/phase-1.md)
2. **Phase 2 – DM-Werkzeuge:** Initiative-Tracker (persistente Rundenreihenfolge, Next-Turn, HP-Tracking), Monster-Quickstats, manuelle Fog-of-War-Ebene (Pinsel/Rechtecke), Bedingungen auf Tokens (prone, frightened, …).
3. **Phase 3 – Map-Integration:** `.dd2vtt`-Importer (PNG, Grid, Wände, Türen, Lichter), Map-Paket-Manifest (JSON: referenziert dd2vtt + optionales animiertes WebM), automatischer Line-of-Sight-Fog aus Wanddaten, PNG-Fallback mit Grid-Einstellung.
4. **Phase 4 – Offline-Spielerfahrung:** Physische Rastergrösse auf dem Tisch-Monitor. Kalibrierung: Auto aus Zoll+Auflösung, exakt per Lineal-Methode; Zoom-Lock im `physical` Screen-Modus; Kalibrierung gerätelokal in localStorage, Zielgrösse als Raum-Setting. → [docs/phase-4-offline-screen.md](docs/phase-4-offline-screen.md)
5. **Phase 5 – Online-Spielerfahrung:** Spawn-Punkte pro Karte (mit Charakter-Zuweisung, `spawn:apply` platziert Spieler) und server-erzwungenes Bewegungsbudget bei aktiver Initiative (Chebyshev-Distanz, Teilbewegungen konsumieren Budget, GM ausgenommen). → [docs/phase-5-online-movement.md](docs/phase-5-online-movement.md)
6. **Phase 6 – KI:** prozeduraler Dungeon-Generator (BSP) mit dd2vtt-Export, danach Bild-Stilisierung als optionaler Layer.
7. **Phase 7 – MCP & Feinschliff:** MCP-Server, Sounds, Makros.

## Arbeitsweise

- Immer nur die aktuelle Phase umsetzen; Abgrenzungen der Phase respektieren (kein Feature-Creep in frühe Phasen).
- Nach jedem abgeschlossenen Schritt: `npm run lint`, `npm run test`, `npm run build` müssen grün sein.
- Abnahmekriterien der Phasen-Spec als Checkliste abhaken.

## Documentation

- **When to write:** Update manuals/ADRs on preference or architecture changes and at phase/milestone closes — not every merge.
- **Where:**
  - Playing (EN+DE): `docs/playing/en/`, `docs/playing/de/`
  - Developing (EN): `docs/developing/`
  - ADRs (EN): `docs/decisions/`
- **ADR naming:** `NNNN-short-kebab-title.md` (see [docs/decisions/README.md](docs/decisions/README.md)).
- Project Context may hold pointers to these paths; do not duplicate manuals there.
