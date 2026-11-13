# Phase 4 – Offline-Spielerfahrung: Physische Rastergrösse (Spezifikation)

## Ziel

Der Player-Screen (Monitor auf dem Tisch) kann so kalibriert werden, dass **eine Rasterzelle auf dem Bildschirm immer eine feste physische Grösse in cm hat** – unabhängig von Karte, Zoom oder Monitor. Beispiel: 1 Zelle = 3 cm, damit Miniaturen/Messlineal physisch auf den Bildschirm passen.

## Hintergrund & Berechnung

- Aus Monitor-Diagonale (Zoll) und Auflösung ergibt sich die Pixeldichte:
  `ppi = sqrt(W² + H²) / diagonaleInch`
- Für eine Zielgrösse von `c` cm pro Zelle:
  `px pro Zelle = (c / 2.54) * ppi * devicePixelRatio`
- **Achtung:** OS-Display-Skalierung (z. B. 150 %), Browser-Zoom und `devicePixelRatio` machen die reine Formel ungenau. Deshalb zwei Kalibrierungswege:
  1. **Auto-Berechnung** (Zoll + Auflösung + Skalierungsfaktor) als Startwert.
  2. **Lineal-Kalibrierung** (genau): Nutzer legt ein Lineal auf den Bildschirm und zieht eine Linie über eine bekannte Strecke (z. B. 10 cm). Daraus berechnet der Client `pxProCm` direkt – alle Skalierungseinflüsse sind automatisch eingerechnet.

## Abgrenzung

- Kalibrierung ist **pro Gerät** (localStorage), nicht pro Raum – ein 55"-TV und ein iPad brauchen unterschiedliche Werte.
- Die Zielgrösse (cm pro Zelle) ist eine **Raum-Einstellung** (GM setzt Default), die Kalibrierung ist gerätelokal.
- Nur der Player-Screen erhält den Modus; GM- und Spieler-Ansicht behalten freien Zoom.
- Kein automatisches Erkennen des Monitors (kein Monitor-Name-Matching, EDID o. ä.) – bewusst weggelassen.

## Datenmodell

Keine Server-DB-Änderung ausserhalb der Room-Settings:

```sql
-- rooms_settings (bestehende Tabelle um ein Feld erweitern)
physical_cell_cm REAL   -- Zielgrösse einer Rasterzelle in cm, NULL = Modus aus
```

Client-lokal (localStorage, Key `dms.screen.calibration.v1`):

```json
{ "pxPerCm": 37.8, "calibratedAt": "2026-11-12T20:00:00Z", "method": "ruler" | "auto" }
```

## Events

Client → Server:

- `settings:set` (bestehend) um `physicalCellCm` erweitern (GM only). Broadcast wie bisher via `settings:updated`.

Rein clientseitig (kein Server-Event):

- Kalibrierung speichern/laden (localStorage), Modus umschalten.

## Client-Verhalten (Player-Screen)

1. **Anzeige-Modi:** `fit` (heutiges Verhalten) und `physical` (neu). Umschalter im Screen-Menü (unauffällig, damit im Spiel niemand versehentlich umschaltet: Bestätigungsdialog oder lange drücken).
2. **Modus `physical`:** Zoom wird festgesetzt auf
   `zoom = pxProCm * physicalCellCm / map.gridPx`
   Zoom-Gesten und Zoom-Buttons sind deaktiviert; **Pan bleibt erlaubt** (Tisch kann grösser sein als die Karte). GM-Kamera-Follow ist im `physical`-Modus deaktiviert bzw. reduziert sich auf sanftes Pan.
3. **Kalibrierungs-Assistent** (im Screen-Modus erreichbar, GM kann ihn auch auf dem Screen fernöffnen):
   - Schritt 1: Auto – Eingabe Diagonale (Zoll) + Auflösung + OS-Skalierung; Button „Berechnen".
   - Schritt 2: Lineal – eine horizontale Messlinie mit Ziehgriff; Nutzer gibt die Soll-Länge in cm ein (`default: 10`), zieht die Linie entlang des Lineals, Bestätigen → `pxPerCm` wird aus der gezogenen Pixelstrecke berechnet.
   - Schritt 3: Kontrolle – eine Rasterzelle wird mit `physicalCellCm` gerendert; Nutzer prüft mit Lineal, optional Feinkorrektur (±0.1 cm).
4. **Anzeige der Ist-Grösse:** Im Screen-Status (dezent, nur bei aktivem `physical`-Modus): „1 Zelle = 3.0 cm".
5. **Gerätewechsel:** Kalibrierung ist an den Browser des Geräts gebunden; beim ersten Aktivieren von `physical` ohne gespeicherte Kalibrierung startet der Assistent automatisch.

## Abnahmekriterien

1. Nach Lineal-Kalibrierung auf zwei verschiedenen Geräten (unterschiedliche Skalierung) ist eine Rasterzelle auf beiden physisch gleich gross (Abweichung < 1 mm bei 3 cm).
2. Auto-Berechnung liegt typischerweise < 5 % daneben; Assistent weist darauf hin, dass die Lineal-Methode genauer ist.
3. Im `physical`-Modus überlebt ein Seiten-Reload Zoom und Position; Kartenwechsel behält die physische Grösse bei.
4. `physicalCellCm` wird vom GM gesetzt und erscheint ohne Reload auf allen verbundenen Screens.
5. GM-Ansicht und Spieler-Ansicht sind vom Modus unberührt.
6. `npm run lint && npm run test && npm run build` grün; neue Unit-Tests für die Umrechnungsformeln (`ppi`, `pxProCm`, Zielzoom) in `client/src/lib/screenCalibration.test.ts`.

## Umsetzungsreihenfolge

1. `client/src/lib/screenCalibration.ts` – pure Funktionen + Tests (keine UI nötig).
2. Settings-Erweiterung (`physicalCellCm`) Server + shared Schema.
3. Screen-Modus `physical` mit Zoom-Lock.
4. Kalibrierungs-Assistent (Auto + Lineal).
5. Abnahmekriterien durchtesten.
