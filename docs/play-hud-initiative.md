# Play-HUD: Initiative-Carousel & Zug-Logik (Spezifikation)

Erweiterung von Phase 2 (DM-Werkzeuge), baut auf Phase 5 (Bewegungsbudget) auf. Definiert das Magic-Karten-artige Turn-Carousel für alle Ansichten (GM, Spieler, Offline-Monitor) und die Initiative-Logik mit Offline- **und** Online-Würfeln.

## Ziel

1. **Initiative auswürfeln** – online (Server würfelt) oder offline (physische Würfel, GM tippt Werte) – bestimmt die Reihenfolge der Charaktere.
2. **Zug-Struktur:** Der aktive Charakter hat pro Zug Bewegung (Phase-5-Budget), eine **Aktion** und eine **Bonus-Aktion**.
3. **Carousel-HUD:** Mitte = aktiver Charakter als grosse Karte inkl. Bedienung; links/rechts = die Nachbarn in der Initiative-Reihenfolge als halb verdeckt rotierte Karten (nur Bild-Rand, Name, HP). Beim Zugwechsel rotiert das Band.

## Initiative-Logik

### Würfeln – zwei gleichwertige Wege, identischer Ergebnis-Zustand

- **Online:** `initiative:roll` (GM only) – der Server würfelt für jeden Charakter auf der aktiven Karte `1d20 + initiativeBonus` (bestehender Dice-Parser), sortiert absteigend, persistiert als `InitiativeState` (wie heute `initiative:set`), broadcastet `initiative:updated` und loggt jeden Einzelwurf (`Goblin: 1d20+2 → 14`). Spieler können für **ihren eigenen** Charakter mit `initiative:rollSelf` selbst würfeln (Server, GM kann danach jederzeit neu ordnen).
- **Offline:** Der heutige manuelle Weg bleibt voll erhalten: Spieler würfeln physisch, GM gibt die Werte über `initiative:set` ein (Feld „Initiative" pro Charakter im Initiative-Rail). Beide Wege erzeugen denselben `InitiativeState` – die UI unterscheidet sie nicht.
- **Tie-Break** (beide Wege): höhere Initiative → höheres `initiativeBonus` → Name aufsteigend.
- **`initiativeBonus` pro Charakter** (neu): Spalte `characters.initiative_bonus INT NOT NULL DEFAULT 0`. GM editierbar im Charakterblatt; beim SRD-Import wird der DEX-Modifikator automatisch übernommen (siehe `docs/srd-monster-library.md`).

### Zug-Struktur (System-agnostisch)

Pro aktivem Zug verwaltet der Server drei Ressourcen-Flags im Initiative-Zustand:

- `movementRemaining` (Zellen) – **Stub in diesem Slice:** Das Carousel benötigt **keine** implementierte Phase-5-Bewegungslogik. `activeMovementRemaining` ist im Schema **optional**; solange Phase 5 nicht geshipt ist, rendert der Move-Control den Wert `–` und ist deaktiviert (Tooltip „aktiv nach Phase 5“). Wenn Phase 5 landet, füllt der Server das Feld automatisch – am Carousel ändert sich kein Code.
- `actionUsed: boolean`, `bonusUsed: boolean` – **reine Toggle**, die App erzwingt **nicht**, was eine „Aktion" ist (5e, Pathfinder, jedes System). Sie sind Gedächtnis-Stützen für GM/Spieler und werden in der Karte angezeigt (frisch/abgehakt). GM kann Flags jederzeit zurücksetzen.
- Alle drei werden bei `initiative:next` für den neuen aktiven Token zurückgesetzt.
- **End-Turn-Autorisierung (Erweiterung von `initiative:next`, heute GM only):** GM darf immer. Ein Spieler darf genau dann `initiative:next` senden, wenn **sein** Session-`characterId` mit dem `characterId` des aktiven Initiative-Eintrags übereinstimmt (er beendet also nur seinen eigenen Zug). Der Server prüft das vor dem Broadcast; Fremdversuche werden abgewiesen (Test). Der „End Turn“-Button im HUD sendet schlicht `initiative:next` – kein separates Event.

### Events (neu bzw. erweitert)

- `initiative:roll` `{}` (GM only) → wie oben.
- `initiative:rollSelf` `{}` (Spieler, eigener Charakter). **Mapping-Regel:** Spieler-Sessions tragen seit PR #23 ein `characterId`; der Server löst darüber den Charakter und dessen Token auf der aktiven Karte (`tokens.character_id`) auf. Kein Token auf der aktiven Karte → Fehler „Kein Token auf der aktiven Karte“; Initiative-Wert wird nur für genau diesen einen Eintrag neu gesetzt, die übrige Reihenfolge bleibt unverändert (kein Voll-Roll).
- `turn:action` `{ used: boolean }` (GM oder aktiver Spieler) → broadcastet `initiative:updated` mit neuem `actionUsed`.
- `turn:bonus` `{ used: boolean }` – analog.
- `InitiativeState` (shared) wird erweitert um `activeActionUsed`, `activeBonusUsed`, `activeMovementRemaining` (abgeleitet aus Phase-5-Zustand) – abwärtskompatibel optional.

## Layout-Entscheidung (Option A – ersetzt die linke Initiative-Sektion)

Der geshipte Play-HUD (ADR 0024) gliedert sich in: **links** Dice + Initiative (mit PC/NPC-Anzeige-Toggles), **unten** Battle Start/End + Next turn + Log, **rechts** Fog-Icon-Rail. Das Carousel ersetzt **nur die linke Initiative-Sektion** (Option A):

- **GM-Play-HUD:** Das `TurnCarousel` ersetzt die Initiative-Sektion in `HudInitiative`; **Dice bleibt links**, **Bottom-Bar bleibt unverändert** (Battle Start/End, Next turn, Log). Der Carousel-„End Turn“ sendet dasselbe `initiative:next` wie der Bottom-„Next turn“-Button – zwei Eingänge, ein Event, keine Doppelmorphologie.
- **Spieler-Ansicht & Player-Screen:** dasselbe `TurnCarousel` ersetzt den Inhalt der bestehenden TCG-Rail (ADR 0024: „TCG rail + session strip + dice toast“) – ein Layout, alle Displays, wie gewünscht.
- **Bewusst verworfen:** (B) screen/player-only würde dem GM-Werkzeug-Charakter widersprechen; (C) linke Initiative komplett entfernen würde die Offline-Manuelleingabe (`initiative:set`) ohne Ersatz verschlechtern. Fällt eine spätere Präferenz auf (C), ist das ein neuer ADR, kein Spec-Edit.

## HUD-Layout: Turn-Carousel

### Grundform (Magic-Karten-Metapher)

```
        ┌─────────┐  ┌───────────────┐  ┌─────────┐
        │ (Rand)  │  │  PORTRAIT     │  │ (Rand)  │
        │ Bild-   │  │  Name         │  │ Bild-   │
        │ Name    │  │  HP  ▓▓▓░░ 32 │  │ Name    │
        │ HP      │  │  AC 15  INI 14│  │ HP      │
        └─────────┘  │  Conditions   │  └─────────┘
     -links rotiert  │ [Move][A][BA] │  rechts rotiert
      (~-8°,         │  [End Turn]   │  (~+8°)
       ~60% Breite)  └───────────────┘
```

- **Mitte (aktive Karte, ~100 % Breite):** Portrait, Name, Initiative-Wert (Badge oben rechts), HP-Balken (current/max) mit Viertel-Färbung wie `screenHpQuarters`, AC-Badge, Condition-Badges, Bedienleiste: **Move** (verbleibende Zellen; bis Phase 5: Stub „–“, deaktiviert), **Aktion** und **Bonus-Aktion** als Toggle-Buttons, **End Turn**.
- **Links/rechts (Nachbarn):** um ±8° rotierte, ~60 % breite Karten, ausserhalb angeschnitten („eingesteckt"); sichtbar nur: Portrait-Streifen, Name, HP-Balken. **Keine** AC, keine Conditions, keine Bedienung.
- **Rotation:** Bei `initiative:updated` mit neuem `activeIndex` gleiten die Karten (CSS-Transform, ~300 ms, easing): rechts → Mitte, Mitte → links, links raus; neuer Nachfolger rechts rein. Bei Rundenwechsel (Wrap) gleiche Animation, Round-Badge zählt hoch.
- **Keine Initiative aktiv:** Carousel kollabiert zu einer dezenten Leiste („Kampf starten" für GM); Karten-Logik ruht.

### Rollen-Varianten (dasselbe Component, Rolle steuert die Sicht)

| Rolle | Mitte | Bedienung | Nachbarn |
|---|---|---|---|
| **GM** | aktiver Charakter | volle Bedienung (Move/A/BA/End, Flags zurücksetzen, HP schnell) | sichtbar |
| **Aktiver Spieler** | eigener Charakter | Move/A/BA/End für **seinen** Token | sichtbar |
| **Andere Spieler** | aktiver Charakter | read-only (nur Anzeige) | sichtbar |
| **Screen / Offline-Monitor** | aktiver Charakter | **keine** Bedienung, keine GM-Daten (HP-Viertel-Regel wie `screenHpQuarters`) | sichtbar |

- **PC/NPC-Toggles ziehen mit:** Die `showPcs`/`showNpcs`-Toggles leben heute in der Initiative-Sektion (`HudInitiative`) – da das Carousel diese Sektion ersetzt, ziehen die Toggles in den **Carousel-Header** (GM only, kompakte Icon-Toggles; auf Spieler/Screen nicht vorhanden, wie bisher).
- Umsetzung als ein geteiltes Component `TurnCarousel` (`client/src/components/turn/`), Props: `state: InitiativeState`, `role`, `selfCharacterId?`. Die drei Ansichten (RoomPage GM, Spieler-Ansicht, Player-Screen) instanziieren dasselbe Carousel mit anderen Props – **ein Layout, drei Displays**, wie gewünscht.
- Platzierung: GM = linke Initiative-Sektion des Play-HUD (ADR 0024); Spieler/Screen = TCG-Rail-Position, im Vollbild-Modus grösser skaliert (dasselbe Component, CSS-Variable für Skalierung).

## Datenmodell

```sql
-- characters: neu
ensureColumn(db, "characters", "initiative_bonus", "INT NOT NULL DEFAULT 0");

-- InitiativeState (shared, erweitert; Persistenz wie bisher in room_initiative):
-- order[] bleibt, neu pro aktivem Zug: action_used, bonus_used (JSON in room_initiative)
```

Keine weiteren Tabellen. Bewegungsbudget kommt aus dem Phase-5-Zustand.

## Abgrenzung (bewusst NICHT drin)

Keine Reactions, keine Legendary Actions, keine Aktionen-Definitionen (Attack/Ausweichen etc. – nur die Toggles), kein Automatismus zwischen Aktion und irgendwelchen Würfen, keine Initiative-Tie-Neuwürfe, kein Drag-and-Drop der Karten-Reihenfolge (Sortierung folgt allein den Werten), **keine Implementierung von Phase-5-Bewegung** (Move-Control ist ein Stub bis Phase 5 shipt).

## Abnahmekriterien

1. `initiative:roll` würfelt serverseitig `1d20+bonus` für alle Charaktere der aktiven Karte, sortiert (Tie-Break wie definiert), alle Screens zeigen dieselbe Reihenfolge sofort.
2. Offline-Weg: GM gibt per `initiative:set` Werte ein → identisches Carousel-Verhalten wie nach `initiative:roll`.
3. Spieler kann via `initiative:rollSelf` nur den eigenen Charakter würfeln; Server weist fremde Versuche ab (Test).
4. Mitte-Karte zeigt Portrait, Name, INI, HP (Viertel-Färbung auf dem Screen gemäss `screenHpQuarters`), AC, Conditions.
5. Aktion/Bonus-Toggle: nur GM und der aktive Spieler können schalten; Zustand ist auf allen Screens synchron und überlebt Reload.
6. „End Turn" rotiert das Carousel in ~300 ms; bei Wrap zählt die Runde hoch; Bewegungsbudget und Flags des neuen Tokens sind frisch.
7. Nur eigene/aktive Bedienelemente sind klickbar (Rollen-Tests); Screen hat keinerlei Bedienung. Der aktive Spieler kann „End Turn“ nur für seinen eigenen Zug senden; ein nicht-aktiver Spieler wird abgewiesen (Server-Test).
8. `npm run lint && npm run test && npm run build` grün; neue Tests: Initiative-Wurf + Tie-Break (pure Funktion `rollInitiative`), Zug-Reset bei `initiative:next`, `rollSelf`-Berechtigung.

## Umsetzungsreihenfolge

1. `shared/`: `rollInitiative`/Sortierung (pure) + erweiterte `InitiativeState`-Schemas + Tests.
2. DB: `initiative_bonus`-Spalte; Server-Events `initiative:roll`, `initiative:rollSelf`, `turn:action`, `turn:bonus` + Tests.
3. Client: `TurnCarousel`-Component (erst statisch: Mitte + zwei Nachbarn, Rollen-Props).
4. Rotation-Animation + Round-Wrap.
5. Anbindung an Phase-5-Bewegungsanzeige (Move-Button) und HP-Viertel-Regel.
6. Integration in RoomPage (GM), Spieler-Ansicht, Player-Screen (Skalierungs-Variable).
7. Abnahmekriterien durchtesten.
