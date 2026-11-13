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
  - Erlaubte Zielpositionen: **Chebyshev-Distanz** (Diagonale zählt 1 Zelle – 5e-Vereinfachung) ≤ verbleibende Reichweite.
  - Bewegung konsumiert Budget: jede Teilbewegung reduziert `remaining_cells` um die Distanz vom letzten gültigen Punkt. Der Spieler darf also mehrfach hintereinander ziehen, bis das Budget aufgebraucht ist (wichtig für verschachtelte Züge).
  - Der GM darf **jeden Token jederzeit unbegrenzt** bewegen (Ausnahme-Regel fürs Erzählen).
  - `remaining_cells` wird an alle Sessions gebroadcastet; der aktive Spieler sieht seinen Radius als Overlay.
- **Radius-Overlay (visualisiert das Budget, konsistent zum Pfad-Summen-Modell):** Haltransparentes Quadrat/Kreis **um die aktuelle Token-Position** mit Radius = `remaining_cells` – nicht um `turn_start`. Grund: das Budget ist eine Pfad-Summe (3 Zellen hin + 3 zurück = 6 verbraucht), ein Kreis um `turn_start` würde fälschlich „noch 6 frei“ zeigen, obwohl das Budget aufgebraucht ist. Die Runden-Startposition wird zusätzlich als dezente Marke angezeigt. Nur für den aktiven Spieler (Spieler-Ansicht) und den GM (Kontrolle) sichtbar, nicht auf dem Player-Screen.
- **Kein Wand-Pathfinding in dieser Phase:** Der Radius prüft nur die Distanz, nicht, ob der Weg durch Wände führt – Bewegung „durch Wände" bleibt vorerst möglich und ist als bekanntes, dokumentiertes Loch akzeptiert. (Anmerkung: LoS-Fog ist auf `main` bereits implementiert – Vision-Polygone aus Wänden/Portalen, siehe PRs #40/#42. Ein späterer Ausbau kann diese Wanddaten für Movement-Checks wiederverwenden; bewusst nicht Teil dieser Phase.)

## Abgrenzung (bewusst NICHT drin)

- Kein Dash/Dodge/Disengage, keine Aktionen, kein Terrain-Kosten-Modell (schwieriges Gelände), keine Diagonal-5-10-Regel-Option, kein Pathfinding um Wände, kein Rückgängigmachen von Zügen, kein „Bewegung zurückgeben" bei Rundenende-Rücksetzungen über mehrere Runden.

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
--   turn_start: { x, y }, remaining_cells: INTEGER
```

## Events

Client → Server (alle GM only ausser `token:move`, das existiert):

- `spawn:set` `{ mapId, points: [{ id, label, x, y, assignedCharacterId }] }`
  – ersetzt die komplette Punkteliste der Karte (idempotent, einfach zu synchronisieren).
- `spawn:apply` `{ mapId }` – platziert Spieler-Charaktere auf ihre Spawn-Punkte (Reihenfolge: assigned zuerst, dann freie Punkte nach Join-Reihenfolge; Charaktere ohne Punkt bleiben, wo sie sind). Loggt `spawn_applied`.
- `character:setSpeed` `{ characterId, speedCells }`
- `initiative:next` (bestehend) – erweitert: setzt `turn_start` und `remaining_cells = speed_cells` des aktiven Tokens.
- `token:move` (bestehend) – erweiterte Validierung:
  - GM: unbegrenzt (wie bisher).
  - Spieler: nur wenn sein Token **der aktive Initiative-Eintrag** ist **und** `remaining_cells >= distanz(letzte Position, Ziel)`; sonst Fehler-Event `movement:rejected { reason }`.

Server → Clients:

- `spawn:updated` `{ mapId, points }` (an alle; Spieler sehen Spawn-Punkte nur, solange die Karte nicht „enthüllt" ist bzw. nach Anwendung dezent markiert).
- `movement:updated` `{ tokenId, turnStart, remainingCells, active }` – bei `initiative:next`, jeder gültigen Bewegung und Rundenwechsel.
- `movement:rejected` `{ tokenId, reason }` – nur an den Absender.

## Client-Verhalten

- **GM (Map-Editing):** Spawn-Werkzeug im MapControlIsland: Klick auf Karte setzt Punkt, Drag verschiebt, Kontextmenü: „Charakter zuweisen…", „Löschen". „Auf Spawn setzen"-Button wendet `spawn:apply` an.
- **Spieler-Ansicht:** Wenn `movement:updated` mit `active && tokenId == eigener Token`: Radius-Overlay um die **aktuelle Token-Position** (Radius = `remainingCells`, siehe Design-Entscheidung; `turnStart` nur als dezente Startmarke), Züge ausserhalb werden beim Loslassen abgewiesen (optimistisch erlauben, bei `movement:rejected` zurückfedern). Anzeige „Bewegung übrig: N Zellen".
- **Player-Screen:** Zeigt keine Spawn-Punkte und kein Radius-Overlay (saubere Tischansicht).
- **Initiative-Rail:** kleine Zellen-Anzeige beim aktiven Eintrag (nur GM + Spieler-Ansicht).

## Abnahmekriterien

1. GM setzt 4 Spawn-Punkte auf einer Karte, `spawn:apply` platziert 4 Spieler-Charaktere korrekt; ein fünfter Charakter bleibt unverändert.
2. `assigned_character_id` wird respektiert; zwei Charaktere belegen nie denselben Punkt.
3. Spieler bewegt in seinem Zug maximal `speed_cells` (Chebyshev); Versuch darüber hinaus → Server weist ab, Token federt zurück, Grund ist sichtbar.
4. Teilbewegungen summieren sich korrekt (3 + 2 Zellen bei Speed 6 = 1 Rest).
5. GM kann jeden Token jederzeit ohne Limit bewegen.
6. Nach `initiative:next` ist das Budget des nächsten Tokens frisch; der vorherige Spieler ist gesperrt.
7. Spawn-Punkte und Bewegungs-Budget überleben Reload (Persistenz).
8. `npm run lint && npm run test && npm run build` grün; neue Unit-Tests: Chebyshev-Distanz/Budget-Verbrauch (pure Funktion in `shared/`), Spawn-Zuweisungslogik, `token:move`-Validierung (GM vs. Spieler, aktiv vs. inaktiv).

## Umsetzungsreihenfolge

1. `shared/`: `movement.ts` – `chebyshev()`, `applyMove()` (pure) + Tests.
2. DB-Migrationen (`spawn_points`, `speed_cells`, Initiative-Zusatzzustand).
3. Server: Spawn-Events + `spawn:apply`-Logik.
4. Server: `token:move`-Validierung + `initiative:next`-Erweiterung + Tests.
5. Client GM: Spawn-Editor.
6. Client Spieler: Radius-Overlay + Rejected-Feedback.
7. Abnahmekriterien durchtesten.
