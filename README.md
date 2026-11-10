# DMs-only-Friend

Normally DMs have no friends. But this web app doesn't judge good throws.

**DMs-only-Friend** ist eine selbstgehostbare Web-App für Tabletop-Rollenspiele (D&D und andere Systeme). Sie zeigt Karten auf einem separaten Bildschirm (TV/Tablet als Spielbrett), synchron zur GM-Ansicht, und erleichtert dem Spieleleiter die Arbeit: Initiative-Tracker, Würfel, Fog of War, Monster-Quick-Stats.

## Status

Planungsphase – Umsetzung via [docs/phase-1.md](docs/phase-1.md).

## Kernentscheidungen

- **Web-App** (React + TypeScript, PixiJS/WebGL für die Karten-Canvas), kein Electron.
- **Backend**: Node.js + TypeScript, Socket.IO (WebSocket-Sync), Server = Single Source of Truth.
- **Persistenz**: SQLite, Dateien auf Disk. Self-Hosting via Docker geplant (lokal am Tisch ohne Internet nutzbar).
- **Auth**: Raum-Codes (kein Account-Zwang). GM erstellt Raum → Spieler/Screen joinen per Code/Link.
- **Karten-Import**: Universal VTT (`.dd2vtt`) als Standardformat → unterstützt Dungeon Map Builder, Dungeon Scrawl, Dungeondraft, Dungeon Alchemist. Fallback: PNG/JPG (manuelles Grid), animiertes WebM als Hintergrund-Layer.
- **KI-Maps (Roadmap Phase 4)**: prozedurales Layout (BSP/WFC) mit dd2vtt-kompatiblen Daten, optionale Bild-Stilisierung (Stable Diffusion/ControlNet, grid-genau) als Hintergrund-Layer.
- **MCP-Server (Roadmap Phase 5)**: separater Node-Service, exponiert GM-Aktionen als MCP-Tools.

## Rollen

| Rolle | Sicht |
|---|---|
| **GM** | Karte + Tokens + Initiative-Tracker, Monster-Blätter, Würfel, Notizen, Fog-Pinsel, Import |
| **Player-Screen** | Nur Karte + Tokens + Initiative-Banner, Vollbild (TV/Tablet am Tisch) |
| **Spieler (remote)** | Wie Player-Screen + eigener Token |

## Roadmap

- **Phase 1 – Tisch-Kern:** Raum-System, statische Karte (PNG) + Grid, Tokens draggen, WebSocket-Sync, Player-Screen via Link, einfache Würfel. *Ziel: eine echte Session spielbar.*
- **Phase 2 – DM-Werkzeuge:** Initiative-Tracker (persistente Rundenreihenfolge, Next-Turn, HP-Tracking), Monster-Quickstats, manuelle Fog-of-War-Ebene, Bedingungen auf Tokens.
- **Phase 3 – Map-Integration:** `.dd2vtt`-Importer (PNG, Grid, Wände, Türen, Lichter), Map-Paket-Manifest (dd2vtt + optionales animiertes WebM), automatischer Line-of-Sight-Fog, PNG-Fallback mit Grid-Einstellung.
- **Phase 4 – KI:** prozeduraler Dungeon-Generator mit dd2vtt-Export, danach Bild-Stilisierung als optionaler Layer.
- **Phase 5 – MCP & Feinschliff:** MCP-Server (place_token, roll, next_turn, reveal…), Sounds, Makros.

Detaillierte Phase-1-Spezifikation: [docs/phase-1.md](docs/phase-1.md)
