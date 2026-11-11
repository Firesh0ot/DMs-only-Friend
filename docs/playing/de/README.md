# Spielen — DMs-only-Friend

Anleitung für Spielleitung (GM) und Remote-Spieler. Primärziel ist der Tisch (GM-Laptop + TV/Tablet als Spielbrett); Remote-Spieler joinen per Link.

> Stub: Screenshots und detaillierte Abläufe folgen, sobald die UX feststeht.

## Rollen

| Rolle | Sicht |
|---|---|
| **GM** | Karte, Tokens, Initiative, Würfel, Raum-Links |
| **Player-Screen** | Vollbild-Karte + Tokens; Kamera folgt dem GM; Initiative-Banner |
| **Remote-Spieler** | Wie Player-Screen, plus Steuerung des eigenen Tokens |

## Phase 1 — was heute funktioniert

- Raum auf der Startseite erstellen; GM-Link öffnen.
- **Screen**-Link für TV/Tablet am Tisch teilen.
- **Spieler**-Join-Link (Code + Rolle) für Remote-Spieler teilen.
- PNG/JPG-Karte hochladen; Rastergröße (`grid_px`) manuell setzen.
- Tokens platzieren und ziehen; Snap aufs Raster; Live-Sync im Raum.
- Player-Screen-Kamera **folgt dem GM** (kein eigenes Pan/Zoom).
- Minimale Initiative / Zugmarkierung.
- Einfache Würfelwürfe (`NdM+K`), serverseitig gewürfelt, für alle sichtbar.

## Geplant (noch nicht ausgeliefert)

- **Settings**-Insel für Prep: Karten, Raster, Links, PC/NPC-Roster.
- **Play**-Modus mit schwebenden Control-Inseln (Kartensteuerung, Initiative + nächster Zug, NPCs; Ecken-Snap; Persistenz pro Raum).
- Player-Screen bleibt ohne Inseln; später TCG-artige Seiten-UI für Runde/Initiative.

## Schnellstart (Tisch)

1. App starten (Self-Hosting oder lokal `npm run dev`).
2. GM erstellt einen Raum → GM-URL öffnen.
3. Screen-URL auf dem TV/Tablet öffnen.
4. Karte hochladen, Tokens setzen, Initiative und Würfel nach Bedarf nutzen.
5. Optional: Remote-Spielern ihre Join-Links schicken.

## Weiteres

- English stub: [../en/README.md](../en/README.md)
- Phase-1-Spezifikation: [../../phase-1.md](../../phase-1.md)
- Developing: [../../developing/README.md](../../developing/README.md)
