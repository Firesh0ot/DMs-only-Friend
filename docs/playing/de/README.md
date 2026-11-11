# Spielen — DMs-only-Friend

Anleitung für Spielleitung (GM) und Remote-Spieler. Primärziel ist der Tisch (GM-Laptop + TV/Tablet als Spielbrett); Remote-Spieler joinen per Link.

## Rollen

| Rolle | Sicht |
|---|---|
| **GM** | **Settings** für Vorbereitung; **Play** mit schwebenden Inseln (Map, Initiative, NPCs, Log, Dice, Fog) |
| **Player-Screen** | Vollbild-Karte + TCG-Initiative-Leiste; kompakte Kampfdauer / letzte Events; Würfel-Toast bei Rolls; Kamera folgt dem GM |
| **Remote-Spieler** | Wie Player-Screen, plus Steuerung des eigenen Tokens (Label = Name) |

## GM-Vorbereitung (Settings)

1. Raum auf der Startseite erstellen: **Raumcode**, Tischname und **GM-PIN** (4–8 Ziffern) wählen. Den **einmaligen GM-Invite** sofort kopieren, öffnen und PIN eingeben.
2. Eine oder mehrere Karten hochladen: PNG/JPG/WebP (`grid_px` setzen) oder Universal VTT `.dd2vtt` (Raster und Wände kommen aus der Datei). Uploads brauchen eine aktive GM-Session. In der GM-Ansicht erscheinen importierte Wände als bernsteinfarbene Overlay-Linien.
3. Screen-/Player-Links teilen. Es gibt keine dauerhafte GM-URL — bei Bedarf neuen einmaligen Invite in Settings (oder Startseite mit PIN) erzeugen.
4. PCs und NPCs anlegen (Anzeigename, optionale TP/RK, kurze Notizen, Portrait); Häkchen setzen, auf welchen Karten sie erscheinen.
5. Optional unter **Screen**: Viertel-TP-Balken (25/50/75/100 %) auf dem Player-Screen — standardmäßig aus (genaue PC-TP; Monster verborgen).
6. Für die Session auf **Play** wechseln. Portraits und TP-Chips erscheinen in der Initiative, wenn gesetzt.

## GM-Spiel

Schwebende Inseln um die Karte:

- **Map** — aktive Karte wechseln; PCs/NPCs gruppenweise ein-/ausblenden.
- **Initiative** — Werte, Reihenfolge, Next Turn (Runde steigt beim Überlauf). Kompakte TP auf den Karten; ±1 beim aktiven Charakter, wenn verknüpft. Bedingungen (prone, frightened, …) am aktiven Charakter umschalten.
- **NPCs** — NPCs spawnen oder platzieren; auswählen, um TP anzupassen (−5/−1/+1/+5), Bedingungen zu setzen und RK/Notizen zu sehen.
- **Log** — Session-Events und Kampftimer; Kampf **Start** / **Ende**. Das erste **Next** startet automatisch einen Kampf, falls keiner läuft.
- **Dice** — Ausdrücke wie `2d6+3` eingeben (oder Quick-Chips), serverseitig würfeln, Summe und letzte Rolls sehen. Ergebnisse werden gebroadcastet und erscheinen im Session-Log.
- **Fog** — Pinsel oder Rechteck zum **Reveal** / **Hide**; **Cover all** / **Clear all**. Neue Karten starten voll verdeckt. Für dich ist Fog durchscheinend, für Screen/Spieler deckend. Tool **Off**, um wieder zu pannen und Tokens zu bewegen.

**Snap** verschiebt eine Insel zum nächsten Dock-Slot (vier Ecken plus Mitte links/rechts). Beim ersten Besuch gilt ein nicht überlappendes Standard-Layout; Positionen bleiben pro Raumcode im Browser erhalten.

Kartenwechsel lädt die verknüpften Charaktere und entfernt die übrigen. Tokens snappen aufs Raster und syncen live. Pan/Zoom der GM-Ansicht folgen Screen und Spieler. Fog wird pro Karte gespeichert.

## Screen / Player

Keine Inseln. Die Seitenleiste zeigt Runde, Reihenfolge und aktiven Zug. Standardmäßig können PC-TP als genaue Chips erscheinen und **Monster-TP bleiben nur für die GM sichtbar**. Wenn die GM Viertel-TP aktiviert, zeigt die Leiste grobe 25/50/75/100 %-Balken für PCs und NPCs ohne genaue Zahlen. Kompakte Bedingungs-Badges (z. B. PRN, FRI), wenn die GM sie setzt. Ein schmaler Streifen zeigt Kampfdauer und die letzten Events, wenn vorhanden. Würfelwürfe erscheinen kurz als Toast über der Karte. Pan/Zoom folgt dem GM. Unaufgedeckte Bereiche bleiben unter solidem Fog (inkl. Tokens dort).

## Look & Laterne

Die Oberfläche nutzt ein mittelalterliches Tavernen-Thema. Mit dem **Laternen**-Schalter (Startseite, Settings, Play und Screen) wechselst du zwischen kerzenwarm und dunkler, rauchiger Dungeon-Taverne. Die Wahl bleibt in diesem Browser gespeichert.

## Schnellstart (Tisch)

1. App starten (Self-Hosting oder lokal `npm run dev`).
2. GM erstellt einen Raum (Code + PIN) → einmaligen GM-Invite öffnen und PIN eingeben.
3. Screen-URL auf dem TV/Tablet öffnen (nur Code; kein PIN).
4. In Settings: Karten und Roster pflegen; dann Play.
5. Optional: Remote-Spielern ihre Join-Links schicken. GM später mit Code + PIN erneut joinen.

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
- Raum-/GM-Auth-ADR: [../../decisions/0012-room-identity-gm-auth.md](../../decisions/0012-room-identity-gm-auth.md)
- Screen-TP-Viertel-ADR: [../../decisions/0013-screen-hp-quarters.md](../../decisions/0013-screen-hp-quarters.md)
- Developing: [../../developing/README.md](../../developing/README.md)
