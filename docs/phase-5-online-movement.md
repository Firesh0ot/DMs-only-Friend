# Phase 5 – Online-Spielerfahrung: Spawn-Bereiche & Bewegungsradius (Spezifikation)

## Ziel

1. **Spawn-Bereiche pro Karte:** GM definiert pro Karte Startpunkte und platziert die Gruppe über die explizite Aktion `spawn:apply` (kein automatisches Platzieren bei Karten-Aktivierung).
2. **Bewegungsradius:** Ist ein Spieler an der Reihe (aktiver Initiative-Eintrag), darf er seinen Token nur innerhalb seiner Bewegungsreichweite bewegen. Der Server erzwingt das.

## Design-Entscheidungen

- **Spawn = Punktliste pro Karte mit Rollen-Zuordnung**, kein Freihand-Bereich: Tabelle `spawn_points` mit Spalte `assigned_character_id` (durchgängig so benannt, auch in Events/UI). `NULL` = frei („wer zuerst kommt"), sonst `character_id` = fester Platz (z. B. für die Tür). Punkte sind Grid-Zellen-Koordinaten.
- **„Karte enthüllen" = Map-Aktivierung** (`map:activate` / `MapActivate`): Es gibt keinen separaten Reveal-Mechanismus. `spawn:apply` ist eine explizite GM-Aktion, die typischerweise direkt nach dem Aktivieren der Karte ausgeführt wird; ein Auto-Apply beim Aktivieren ist bewusst **nicht** Teil dieser Phase.
- **Bewegungsmodell (bewusst einfach, 5e-kompatibel):**
  - `speed_cells` pro Charakter (Default 6 = 30 ft, GM editierbar; NPC-Monster ebenfalls).
  - Bei `initiative:next` speichert der Server die **Startposition des aktiven Tokens** (`turn_start_x/y`).
  - **Sperrmodus (Klarstellung zum heutigen Verhalten):** Heute können Spieler ihren Token jederzeit bewegen. Ab dieser Phase gilt: **Wenn eine Initiative-Ordnung existiert und ein Kampf/Battle läuft**, darf ein Spieler seinen Token nur bewegen, wenn sein Token der aktive Initiative-Eintrag ist. **Ohne aktive Initiative/Battle** bleibt der heutige Zustand (freie Bewegung des eigenen Tokens) unverändert. Der GM ist von jeder Sperre ausgenommen.
  - Erlaubte Zielpositionen: **Chebyshev-Pfadkosten** (8-Nachbarschaft, Diagonale zählt 1 – 5e-Vereinfachung) entlang begehbarer Zellen ≤ `remaining_cells` **und** Ziel erreichbar von `turn_start` mit Kosten ≤ `budget_cells` (`budget_cells` = Speed zu Zugbeginn). Wände und geschlossene Portale blockieren den Pfad; offene Portale sind Durchgänge.
  - Bewegung konsumiert Budget: jede Teilbewegung reduziert `remaining_cells` um die Pfadkosten vom letzten gültigen Punkt. Der Spieler darf also mehrfach hintereinander ziehen, bis das Budget aufgebraucht ist (wichtig für verschachtelte Züge).
  - Der GM darf **jeden Token jederzeit unbegrenzt** bewegen (Ausnahme-Regel fürs Erzählen; Wand-Kollision gilt trotzdem).
  - `remaining_cells` / `budget_cells` / `turn_start` werden an alle Sessions gebroadcastet; der aktive Spieler sieht seinen Radius als Overlay.
- **Radius-Overlay (Turn-Start-Anker, Tisch-Feedback):** Haltransparente **erreichbare Zellen** fest um `turn_start` mit Pfadbudget = `budget_cells` – bewegt sich **nicht** mit dem Token; Form folgt Tür-Chokepoints. Gelbe Marke auf der Startzelle. Client clamped optimistische Züge auf erreichbare Zellen ∩ Schritt-`remaining_cells`. Nur für den aktiven Spieler (Spieler-Ansicht) und den GM (Kontrolle) sichtbar, nicht auf dem Player-Screen. Ohne Wände bleibt das klassische Chebyshev-Quadrat.
- **Wand-Kollision (Server-SoT):** `token:move` prüft die Gerade zwischen Zellen-Mitten gegen `maps.walls_json` und **geschlossene** Portale. Kreuzt die Gerade ein Blocker-Segment → `movement:rejected` (`Blocked by wall`); Budget wird nicht verbraucht. Zusätzlich muss das Ziel per Pfadkosten im Budget liegen (Server = Client-Overlay). Offene Portale blockieren nicht. Karten ohne Wände verhalten sich wie zuvor (reines Chebyshev). Um Wände herumlaufen: Teilzüge entlang freier Zellen / durch offene Türen. `spawn:apply` teleportiert ohne Kollisionscheck. Details: [ADR 0028](decisions/0028-uvtt-walls-and-path-movement.md).

## Abgrenzung (bewusst NICHT drin)

- Kein Dash/Dodge/Disengage, keine Aktionen, kein Terrain-Kosten-Modell (schwieriges Gelände), keine Diagonal-5-10-Regel-Option, kein automatisches Mehrzellen-Pathfinding einer einzelnen Drag-Geste durch Wände (Gerade Zellenmitte→Zellenmitte bleibt Kollisionscheck; Budget/Overlay nutzen Pfadkosten), kein Rückgängigmachen von Zügen, kein „Bewegung zurückgeben" bei Rundenende-Rücksetzungen über mehrere Runden.

## Datenmodell

```sql
spawn_points(
  id TEXT PRIMARY KEY,
  map_id TEXT NOT NULL,
  room_id TEXT NOT NULL,
  label TEXT,
  x REAL NOT NULL, y REAL NOT NULL,          -- Grid-Zellen
  assigned_character_id TEXT                  -- NULL = frei
);

-- characters um ein Feld erweitern:
speed_cells INTEGER NOT NULL DEFAULT 6;

-- initiative state um Bewegungs-Budget erweitern (pro aktuellem Zug):
-- in der bestehenden initiative-Struktur:
--   turn_start: { x, y }, remaining_cells: INTEGER, budget_cells: INTEGER
```

## Events

Client → Server (alle GM only ausser `token:move`, das existiert):

- `spawn:set` `{ mapId, points: [{ id, label, x, y, assignedCharacterId }] }`
  – ersetzt die komplette Punkteliste der Karte (idempotent, einfach zu synchronisieren).
- `spawn:apply` `{ mapId }` – platziert Spieler-Charaktere auf ihre Spawn-Punkte (Reihenfolge: assigned zuerst, dann freie Punkte nach Join-Reihenfolge; Charaktere ohne Punkt bleiben, wo sie sind). Loggt `spawn_applied`.
- `character:setSpeed` `{ characterId, speedCells }`
- `initiative:next` (bestehend) – erweitert: setzt `turn_start` und `remaining_cells = speed_cells` des aktiven Tokens.
- `token:move` (bestehend) – erweiterte Validierung:
  - Alle Rollen: Ziel darf keine Wand / kein geschlossenes Portal auf der Geraden Zellenmitte→Zellenmitte kreuzen; sonst `movement:rejected { reason: "Blocked by wall" }`.
  - GM: Distanz-Budget unbegrenzt (wie bisher); Wand-Kollision gilt trotzdem.
  - Spieler: nur wenn sein Token **der aktive Initiative-Eintrag** ist **und** `remaining_cells >= distanz(letzte Position, Ziel)`; sonst Fehler-Event `movement:rejected { reason }`.

Server → Clients:

- `spawn:updated` `{ mapId, points }` (an alle; Spieler sehen Spawn-Punkte nur, solange die Karte nicht „enthüllt" ist bzw. nach Anwendung dezent markiert).
- `movement:updated` `{ tokenId, turnStart, remainingCells, budgetCells, active }` – bei `initiative:next`, jeder gültigen Bewegung und Rundenwechsel.
- `movement:rejected` `{ tokenId, reason }` – nur an den Absender.

## Client-Verhalten

- **GM (Map-Editing):** Spawn-Werkzeug im MapControlIsland: Klick auf Karte setzt Punkt, Drag verschiebt, Kontextmenü: „Charakter zuweisen…", „Löschen". „Auf Spawn setzen"-Button wendet `spawn:apply` an.
- **Spieler-Ansicht:** Wenn `movement:updated` mit `active && tokenId == eigener Token`: Radius-Overlay **fest um `turnStart`** (Radius = `budgetCells`); Züge werden clientseitig in das sichtbare Quadrat ∩ Restbudget geclamppt, Server weist Überschreitungen ab (`movement:rejected`). Anzeige „Bewegung übrig: N Zellen".
- **Player-Screen:** Zeigt keine Spawn-Punkte und kein Radius-Overlay (saubere Tischansicht).
- **Initiative-Rail:** kleine Zellen-Anzeige beim aktiven Eintrag (nur GM + Spieler-Ansicht).

## Abnahmekriterien

1. GM setzt 4 Spawn-Punkte auf einer Karte, `spawn:apply` platziert 4 Spieler-Charaktere korrekt; ein fünfter Charakter bleibt unverändert.
2. `assigned_character_id` wird respektiert; zwei Charaktere belegen nie denselben Punkt.
3. Spieler bewegt in seinem Zug maximal `speed_cells` (Chebyshev-Pfadkosten durch offene Türen); Versuch darüber hinaus oder hinter geschlossene Wände → Server weist ab, Token federt zurück, Grund ist sichtbar. Overlay zeigt nur erreichbare Zellen.
4. Teilbewegungen summieren sich korrekt (3 + 2 Zellen bei Speed 6 = 1 Rest).
5. GM kann jeden Token jederzeit ohne Limit bewegen.
6. Nach `initiative:next` ist das Budget des nächsten Tokens frisch; der vorherige Spieler ist gesperrt.
7. Spawn-Punkte und Bewegungs-Budget überleben Reload (Persistenz).
8. `npm run lint && npm run test && npm run build` grün; Unit-Tests: Chebyshev-Distanz/Budget-Verbrauch, Pfadkosten wand-blockiert vs. Tür-Pfad, Wand-Kollision (Gerade vs. Wall/Portal-Segmente), Spawn-Zuweisungslogik, `token:move`-Validierung (GM vs. Spieler, aktiv vs. inaktiv, Wand-Block).

## Umsetzungsreihenfolge

1. `shared/`: `movement.ts` – `chebyshev()`, `applyMove()` (pure) + Tests.
2. DB-Migrationen (`spawn_points`, `speed_cells`, Initiative-Zusatzzustand).
3. Server: Spawn-Events + `spawn:apply`-Logik.
4. Server: `token:move`-Validierung + `initiative:next`-Erweiterung + Tests.
5. Client GM: Spawn-Editor.
6. Client Spieler: Radius-Overlay + Rejected-Feedback.
7. Abnahmekriterien durchtesten.
