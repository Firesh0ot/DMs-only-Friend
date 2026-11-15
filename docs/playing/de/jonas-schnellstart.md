# Schnellstart für Jonas — von der Karte bis zum Spiel

Kurzanleitung, um mit **DMs-only-Friend** (https://dm.fortbuchenweg.ch/) zu spielen: Karte bauen, hochladen, Charaktere setzen, bewegen, spielen. Ausführliche Details: [README](README.md).

## 1. Karte auf Dungeon Map Builder bauen

1. Öffne **https://dungeonmapbuilder.com/** — kostenlos, kein Account nötig.
2. Zeichne Räume (Room-Tool) oder klicke **Generate** für ein fertiges Layout; setze Türen, Fackeln, Props. **Wichtig:** Wände/Türen als echte Objekte setzen (nicht nur malen) — nur dann funktionieren Sichtlinien (LoS) und versteckte Monster später automatisch.
3. **Exportieren:**
   - Immer: **Export → Universal VTT (.dd2vtt)** — enthält Karte, Raster, Wände, Türen, Lichter.
   - Wenn animiert (flackernde Fackeln, Wasser): zusätzlich **Export → Animated WebM** — die Loop-Animation als Video.

## 2. Karte hochladen

1. Öffne **https://dm.fortbuchenweg.ch/** und erstelle einen Raum (Raumcode + GM-PIN merken, GM-Invite kopieren und öffnen).
2. Gehe in **Settings → Karten importieren**:
   - `.dd2vtt` auswählen — Raster, Wände, Türen und Lichter kommen automatisch mit.
   - Falls vorhanden: die `.webm` im selben Dialog mit auswählen — die Karte wird animiert.
3. Karte in **Play** aktivieren (untere Leiste → **More** → Kartenwechsel).

## 3. Charaktere anlegen (PCs & NPCs)

- **Manuell:** Settings → Characters → Charakter anlegen (Name, HP, AC, Portrait, Notizen; Häkchen, auf welchen Karten er erscheint).
- **Aus der SRD-Datenbank (D&D 5e):** im Character-Bereich **Monster suchen** (z. B. „Goblin") → auswählen → importieren. Statblock, HP und Portrait kommen automatisch; der GM kann alles anpassen.

## 4. Tokens setzen und bewegen

- **Setzen:** Charakter in Play per Klick/Toggle auf die Karte setzen (bzw. beim Spawn-Bereich starten).
- **Bewegen (GM):** Token mit der Maus ziehen — jederzeit, ohne Limit. Mausrad = Zoom, Ziehen der Karte = Kamera.
- **Bewegen (Spieler):** Remote-Spieler joinen per Player-Link und bewegen **nur ihren eigenen** Token. Im Kampf gilt das Bewegungsbudget (Reichweite), der Server erzwingt es.

## 5. Spielablauf & Steuerung (Play-HUD)

| Wo | Was |
|---|---|
| **Links — Dice** | Würfel eingeben (`2d6+3`, `1d20+5`) oder Quick-Chips; alle sehen das Ergebnis |
| **Links — Initiative** | Runde + aktiver Charakter; **Next** = nächster Zug; Reihenfolge aufklappen und setzen; ±1 HP und Bedingungen am Aktiven |
| **Rechts — Fog** | Icon-Leiste: Pinsel/Rechteck, Grösse −/+, Reveal/Hide, LoS; **Wand**-Tool (zwei Punkte klicken); Türen per Klick öffnen/schliessen |
| **Unten — Battle** | Kampf **Start/Ende** + Timer; **Next turn**; **Log** (Session-Chronik); **More** (Kartenwechsel) |

**Typischer Ablauf:** Karte enthüllen (Fog) → Spieler entdecken → Kampf **Start** → Initiative würfeln/setzen → pro Zug: bewegen + Aktion + Bonus → HP/Bedingungen am aktiven Token → **Next** → Kampf **Ende**.

## 6. Testen

Mach einfach einen Testraum (z. B. Code `TEST`): Karte hochladen, 2 NPCs importieren, Kampf starten, Initiative würfeln, Fog malen, Türen öffnen — wenn alles reagiert, bist du bereit für die echte Session. Player-Screen (TV/Tablet) über den Screen-Link in Vollbild öffnen und prüfen, dass er der GM-Ansicht folgt.
