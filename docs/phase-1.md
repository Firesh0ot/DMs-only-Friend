# Phase 1 – Tisch-Kern (Spezifikation)

**Status:** Acceptance criteria below are met on `main`. Items listed under “Abgrenzung Phase 1” (fog, `.dd2vtt`, initiative, monster stats, …) shipped in later phases — see [ADRs 0003–0016](decisions/README.md) and Playing manuals for what exists now. This file stays the historical Phase 1 design sketch.

## Ziel

Ein minimaler, spielbarer Tisch: GM erstellt einen Raum, importiert ein PNG als Karte, setzt Tokens, der Player-Screen zeigt dieselbe Karte live synchron, Tokens lassen sich draggen, ein einfacher Würfelwurf wird für alle sichtbar angezeigt.

## Tech-Setup

- Monorepo (npm workspaces) mit `server/`, `client/`, `shared/`.
- Server: Node 20+, TypeScript strict, Express, Socket.IO, better-sqlite3, multer (Bild-Uploads), `zod` für Event-Validierung.
- Client: Vite + React + TypeScript, PixiJS v8, Zustand (State).
- Lint/Format: ESLint + Prettier. Tests: Vitest (Event-Handler und Dice-Logik isoliert testbar).
- `npm run dev` startet Server + Client parallel (z. B. via `concurrently`).

## Repo-Struktur

```
/
├─ package.json            (workspaces)
├─ shared/
│  └─ src/events.ts        (Event-Typen + zod-Schemas, von Client & Server genutzt)
├─ server/
│  └─ src/
│     ├─ index.ts          (Express + Socket.IO Bootstrap)
│     ├─ rooms.ts          (Raum-Verwaltung, Join-Logik, Rollen)
│     ├─ events/           (map.ts, token.ts, dice.ts)
│     ├─ dice.ts           (parseExpr, roll – pure Funktionen)
│     ├─ db.ts             (SQLite: rooms, maps, tokens, dice_log)
│     └─ uploads/          (Karten-PNGs)
└─ client/
   └─ src/
      ├─ pages/GmPage.tsx
      ├─ pages/PlayerPage.tsx
      ├─ canvas/MapCanvas.tsx      (PixiJS-Container)
      ├─ canvas/useMapScene.ts      (PixiJS-Setup, Texturen, Drag)
      ├─ state/roomStore.ts        (Zustand: Snapshot + lokale Optimistic Updates)
      ├─ socket/socket.ts          (Socket.IO-Client)
      └─ components/ (Toolbar, TokenBar, DicePanel, InitiativeBanner-Platzhalter)
```

## Datenmodell (SQLite, minimal)

```sql
rooms(id TEXT PRIMARY KEY, code TEXT UNIQUE, name TEXT, created_at TEXT);
maps(id TEXT PRIMARY KEY, room_id TEXT, filename TEXT, width INT, height INT,
     grid_px INT DEFAULT 70, offset_x INT DEFAULT 0, offset_y INT DEFAULT 0);
tokens(id TEXT PRIMARY KEY, room_id TEXT, label TEXT, image TEXT,
       x REAL, y REAL, size_cells REAL DEFAULT 1, is_player INT DEFAULT 0);
dice_log(id INTEGER PRIMARY KEY AUTOINCREMENT, room_id TEXT, player_name TEXT,
         expr TEXT, results_json TEXT, total INT, created_at TEXT);
```

Koordinaten der Tokens sind **Grid-Zellen** (Float erlaubt), nicht Pixel.

## Socket-Events (Server-validiert, dann Broadcast an `room:{id}`)

Client → Server:

- `room:join` `{ code, role: "gm" | "screen" | "player", name? }`
  → Antwort: voller Snapshot `{ room, map, tokens }`
- `map:upload` via REST `POST /api/rooms/:code/map` (multipart, nur GM), danach Broadcast `map:set` `{ mapId, gridPx }`
- `token:move` `{ tokenId, x, y }`
- `token:create` `{ label, image?, x, y, isPlayer? }`
- `token:remove` `{ tokenId }`
- `dice:roll` `{ expr }` – Würfel werden **auf dem Server** geparst und gewürfelt (z. B. `2d6+3`), Ergebnis in `dice_log` und gebroadcastet.

Server → Clients:

- `snapshot` (bei Join), `map:set`, `token:moved`, `token:created`, `token:removed`, `dice:rolled`

**Berechtigungsregeln:**

- Nur `role === "gm"` darf `map:*`, `token:create`, `token:remove`.
- Spieler dürfen nur **ihren eigenen** Token bewegen (Phase 1 simpel: Token-Label = Spielername, `is_player = 1`).
- Der Server ist autoritativ: Client zeigt das eigene Drag-Ergebnis optimistic, korrigiert bei Server-Antwort.

## REST (minimal)

- `POST /api/rooms` → erstellt Raum, gibt `{ code, gmUrl, screenUrl }` zurück.
- `POST /api/rooms/:code/map` → PNG-Upload (nur GM, Limit 50 MB, Whitelist png/jpg/webp).
- Bereitstellung der Uploads: `GET /uploads/:filename`.

## Client-Verhalten

- **Join-Flow:** `/#/ABC123` → Player-Screen (Vollbild-freundlich). `?role=player&name=X` für Spieler-Ansicht mit eigenem Token. GM-Link separat.
- **MapCanvas (PixiJS v8):**
  - Background-Sprite (Karte) + Grid-Grafik (aus `gridPx` generiert) + Token-Container.
  - Tokens dragbar, **Snap auf Grid-Zellmitten** beim Loslassen.
  - Pan/Zoom (Wheel + Drag), ResizeObserver für Vollbild.
- **Synchronisierung:** Drag-Ende (mouseup) → `token:move`-Event; während des Drags nur lokale Anzeige. Optional: gedrosselte Positionsevents während des Drags (max ~10/s) für flüssigeres Miterleben.
- **Würfel-Panel:** Eingabe `NdM+K`, Historie der letzten 10 Würfe, große Anzeige des letzten Ergebnisses – auch auf dem Player-Screen als Toast/Banner.

## Abgrenzung Phase 1 (bewusst NICHT drin)

Kein Fog of War, kein `.dd2vtt`-Import, kein Initiative-Tracker, keine Auth jenseits Raum-Codes, keine Monster-Blätter, kein Video-Background, kein MCP.

## Abnahmekriterien (als Checkliste abhaken)

1. GM kann Raum erstellen, bekommt Link + Code; Player-Screen joint per Code ohne Account.
2. PNG-Upload erscheint live auf allen verbundenen Screens.
3. Token-Drag ist auf allen Screens innerhalb < 300 ms sichtbar (LAN).
4. Zwei Browser-Tabs (GM + Screen) zeigen nach Reload identischen Zustand (Persistenz via SQLite).
5. `dice:roll` mit `2d6+3` liefert ein korrektes, serverseitig ermitteltes Ergebnis, sichtbar auf allen Screens.
6. Spieler können nur ihren eigenen Token bewegen (Server weist anderes ab).
7. `npm run lint`, `npm run test` (mindestens: Dice-Parser-Unit-Tests, Event-Validierung) und `npm run build` laufen grün.

## Umsetzungsreihenfolge (empfohlen)

1. Monorepo-Skelett + `shared/` Event-Typen
2. Server: Raum-Erstellung, Join, Snapshot (SQLite-Persistenz)
3. Karten-Upload + Anzeige (PixiJS, Grid)
4. Token-Drag mit Sync
5. Würfel (Parser + Events + Panel)
6. Abnahmekriterien durchtesten, Lint/Test/Build grün machen
