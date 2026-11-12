# Spielen — DMs-only-Friend

Anleitung für Spielleitung (GM) und Remote-Spieler. Primärziel ist der Tisch (GM-Laptop + TV/Tablet als Spielbrett); Remote-Spieler joinen per Link.

## Rollen

| Rolle | Sicht |
|---|---|
| **GM** | **Settings** für Vorbereitung; **Play** mit schwebenden Inseln (Map, Initiative, NPCs, Log, Dice, Fog) |
| **Player-Screen** | Vollbild-Karte + TCG-Initiative-Leiste; kompakte Kampfdauer / letzte Events; Würfel-Toast bei Rolls; Kamera folgt dem GM |
| **Remote-Spieler** | Wie Player-Screen, plus Steuerung des eigenen Tokens (Label = Name) |

## GM-Vorbereitung (Settings)

1. Raum auf der Startseite erstellen und GM-Link öffnen.
2. Eine oder mehrere Karten hochladen: PNG/JPG/WebP (`grid_px` setzen) oder Universal VTT `.dd2vtt` (Raster und Wände kommen aus der Datei). In der GM-Ansicht erscheinen importierte Wände als bernsteinfarbene Overlay-Linien.
3. Screen-/Player-Links teilen.
4. PCs und NPCs anlegen (Anzeigename, optionale TP/RK, kurze Notizen, Portrait); Häkchen setzen, auf welchen Karten sie erscheinen.
5. Für die Session auf **Play** wechseln. Portraits und TP-Chips erscheinen in der Initiative, wenn gesetzt.

## GM-Spiel

Schwebende Inseln um die Karte:

- **Map** — aktive Karte wechseln; PCs/NPCs gruppenweise ein-/ausblenden.
- **Initiative** — Werte, Reihenfolge, Next Turn (Runde steigt beim Überlauf). Kompakte TP auf den Karten; ±1 beim aktiven Charakter, wenn verknüpft. Bedingungen (prone, frightened, …) am aktiven Charakter umschalten.
- **NPCs** — NPCs spawnen oder platzieren; auswählen, um TP anzupassen (−5/−1/+1/+5), Bedingungen zu setzen und RK/Notizen zu sehen.
- **Log** — Session-Events und Kampftimer; Kampf **Start** / **Ende**. Das erste **Next** startet automatisch einen Kampf, falls keiner läuft.
- **Dice** — Ausdrücke wie `2d6+3` eingeben (oder Quick-Chips), serverseitig würfeln, Summe und letzte Rolls sehen. Ergebnisse werden gebroadcastet und erscheinen im Session-Log.
- **Fog** — Pinsel oder Rechteck zum **Reveal** / **Hide**; **Cover all** / **Clear all**. Neue Karten starten voll verdeckt. Für dich ist Fog durchscheinend, für Screen/Spieler deckend. Tool **Off**, um wieder zu pannen und Tokens zu bewegen.

**Snap** verschiebt eine Insel zur nächsten Ecke. Positionen bleiben pro Raum im Browser erhalten.

Kartenwechsel lädt die verknüpften Charaktere und entfernt die übrigen. Tokens snappen aufs Raster und syncen live. Pan/Zoom der GM-Ansicht folgen Screen und Spieler. Fog wird pro Karte gespeichert.

## Screen / Player

Keine Inseln. Die Seitenleiste zeigt Runde, Reihenfolge und aktiven Zug. TP von PCs können auf den Initiativkarten erscheinen; **Monster-TP bleiben standardmäßig nur für die GM sichtbar**. Kompakte Bedingungs-Badges (z. B. PRN, FRI), wenn die GM sie setzt. Ein schmaler Streifen zeigt Kampfdauer und die letzten Events, wenn vorhanden. Würfelwürfe erscheinen kurz als Toast über der Karte. Pan/Zoom folgt dem GM. Unaufgedeckte Bereiche bleiben unter solidem Fog (inkl. Tokens dort).

## Look & Laterne

Die Oberfläche nutzt ein mittelalterliches Tavernen-Thema. Mit dem **Laternen**-Schalter (Startseite, Settings, Play und Screen) wechselst du zwischen kerzenwarm und dunkler, rauchiger Dungeon-Taverne. Die Wahl bleibt in diesem Browser gespeichert.

## Schnellstart (Tisch)

1. App starten (Self-Hosting oder lokal `npm run dev`).
2. GM erstellt einen Raum → GM-URL öffnen.
3. Screen-URL auf dem TV/Tablet öffnen.
4. In Settings: Karten und Roster pflegen; dann Play.
5. Optional: Remote-Spielern ihre Join-Links schicken.

## Weiteres

- English: [../en/README.md](../en/README.md)
- Phase-1-Spezifikation: [../../phase-1.md](../../phase-1.md)
- Prep/Play-ADR: [../../decisions/0003-prep-play-ux.md](../../decisions/0003-prep-play-ux.md)
- Session-Log-ADR: [../../decisions/0004-session-battle-log.md](../../decisions/0004-session-battle-log.md)
- Tavernen-Theme-ADR: [../../decisions/0005-tavern-theme-lantern.md](../../decisions/0005-tavern-theme-lantern.md)
- Dice-Insel-ADR: [../../decisions/0007-dice-play-island.md](../../decisions/0007-dice-play-island.md)
- dd2vtt-Import-ADR: [../../decisions/0008-dd2vtt-map-import.md](../../decisions/0008-dd2vtt-map-import.md)
- TP-Sichtbarkeit-ADR: [../../decisions/0009-hp-screen-visibility.md](../../decisions/0009-hp-screen-visibility.md)
- Manuelles Fog-ADR: [../../decisions/0010-manual-fog-of-war.md](../../decisions/0010-manual-fog-of-war.md)
- Bedingungen-ADR: [../../decisions/0011-token-conditions.md](../../decisions/0011-token-conditions.md)
- Developing: [../../developing/README.md](../../developing/README.md)
