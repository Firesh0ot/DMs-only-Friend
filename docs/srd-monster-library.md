# SRD-Monster-Bibliothek (On-Demand + Cache) – Spezifikation

Erweiterung von Phase 2 (DM-Werkzeuge). GM kann per Namenssuche Monster aus dem D&D 5e SRD suchen und als NPC (Charakter + Token mit Stats) in den Raum importieren. Der Tisch läuft danach offline weiter: Jedes einmal importierte Monster ist persistiert, die Suche funktioniert über ein kleinges lokales Indexfile offline.

## Lizenz-Grundlage (verbindlich, siehe ADR 0023)

- **Nur SRD 5.1 (CC-BY-4.0)** als Datenquelle. Keine Reproduktion von Monster Manual / Volo's / Mordenkainen's-Inhalten, keine Product-Identity-Namen ausserhalb des SRD.
- **Attribution:** Anzeige in Settings/About: „D&D 5e SRD 5.1, © Wizards of the Coast, lizenziert unter Creative Commons Attribution 4.0 (CC-BY-4.0). Daten über dnd5eapi.co." – Pflichtfeld, nicht optional.
- Keine anderen Quellen (5e.tools, D&D Beyond) einbinden.

## Datenquellen

- **Primär:** [dnd5eapi.co](https://www.dnd5eapi.co/) (5e-bits, Open Source) – REST, JSON, Version `2014` Endpunkte.
  - Suche/Trefferliste: `GET /api/2014/monsters?name={query}` (liefert `index, name, url`)
  - Detail: `GET /api/2014/monsters/{index}` (voller Statblock)
- **Fallback (offline / API weg):** Einmal heruntergeladene Voll-Zusammenfassung als lokale Datei (siehe „Offline-Fallback"), plus bereits importierte Monster aus dem Cache.
- Alle Fetches laufen **serverseitig** (kein Browser-Fetch: kein CORS, zentrale Normalisierung, Cache-Kontrolle). Timeout 5 s, 1 Retry, danach klarer Fehler an die UI.

## Architektur-Fluss (Fetch passiert genau einmal pro Monster)

1. GM tippt „Goblin" ins Suchfeld (NpcIsland) → Client sendet `monster:search`.
2. Server durchsucht das **lokale Indexfile** (`server/src/data/srd-monster-index.json`, ~50–100 KB, nur `index/name/cr/type/size`) → Trefferliste. Kein API-Call für die Suche selbst.
3. GM wählt „Goblin" → `monster:import { monsterIndex }`.
4. Server: Cache-Lookup (`srd_cache`) → Hit: direkt normalisieren. Miss: API-Detail-Fetch → normalisieren → in `srd_cache` speichern.
5. Server erzeugt daraus einen **normalen Charakter** (`characters`) + Token auf der aktiven Karte und broadcastet wie bei `character:upsert`.
6. Ab jetzt ist das Monster ein ganz normaler Datensatz: Session, Reload, nächster Spieltag – **kein API-Kontakt mehr nötig**.

## Indexfile & Offline-Fallback

- `scripts/build-srd-index.ts`: lädt einmalig die Monster-Liste der API und schreibt `server/src/data/srd-monster-index.json` (nur Metadaten, keine Statblocks). Wird ins Repo committet und mit dem Container ausgeliefert → **Suche funktioniert offline**.
- `scripts/fetch-srd-full.ts` (manueller Fallback für die Zukunft): lädt **alle** Monster-Details und schreibt `server/src/data/srd-monsters-full.json` (~15 MB, **nicht** im Repo, in `.gitignore`). Server nutzt diese Datei automatisch als Quelle, wenn die API nicht erreichbar ist. Dokumentiert in `docs/developing/README.md` („Voll-Datensatz für Offline-LAN herunterladen").
- UI-Zustände: Online → API/Cache; Offline ohne Voll-Datei → „SRD-Suche eingeschränkt: N importierte Monster verfügbar"; Offline mit Voll-Datei → volle Auswahl.

## Datenmodell

```sql
-- neue Tabelle: normalisierte SRD-Statblöcke, pro monsterIndex genau eine Zeile
srd_cache(
  monster_index TEXT PRIMARY KEY,      -- dnd5eapi "index" (z. B. "goblin")
  name TEXT NOT NULL,
  cr TEXT,
  type TEXT,
  size TEXT,
  statblock_json TEXT NOT NULL,       -- normalisiertes eigenes Format (unten)
  source TEXT NOT NULL,               -- 'api' | 'full-file'
  fetched_at TEXT NOT NULL
);
```

Das importierte Monster selbst wird als normale Zeile in `characters` angelegt (bestehende Tabelle, kein Schema-Change dort). `statblock_json` ist das **eigene Normalisierungsformat**, damit spätere API-Änderungen keine Migrationen an importierten NPCs auslösen:

```json
{
  "name": "Goblin", "cr": "1/4", "type": "humanoid", "size": "small",
  "ac": 15, "hpMax": 7, "hitDice": "2d6",
  "speed": "30 ft.", "abilities": { "str": 8, "dex": 14, "con": 10, "int": 10, "wis": 8, "cha": 8 },
  "attacks": [{ "name": "Scimitar", "toHit": "+4", "damage": "1d6+2 slashing" }],
  "specials": ["Nimble Escape"], "languages": "Common, Goblin", "senses": "darkvision 60 ft."
}
```

## Normalisierungsregeln (5e-bits → eigenes Format)

- `hpMax`: aus `hit_points` übernehmen (bereits ausgerechnet); `hitDice` aus `hit_dice` (z. B. `2d6`) – HP-Würfeln beim Import über den bestehenden Dice-Parser anbieten („Durchschnitt: 7 / Würfeln: 2d6").
- `sizeCells` für den Token: Tiny/Small/Medium = 1, Large = 2, Huge = 3, Gargantuan = 4.
- `attacks`: aus `actions[]` (nur Einträge mit `attack_bonus`/`damage`), Name + `+X` + Schaden zusammensetzen; alles andere (Legendary, Reactions) in `specials` als Klartext.
- `ac` aus `armor_class[0].value`; `abilities` aus `stats`/`strength…charisma`-Feldern je API-Version.
- Nicht mappbare Felder landen unbeschnitten in `specials` – **nie verwerfen**, der GM entscheidet.

## Events

Client → Server (beide GM only):

- `monster:search` `{ query: string }` → Antwort (Callback): `{ ok, results: [{ index, name, cr, type, size }], source: "index" | "cache" }` (max. 25 Treffer, Case-insensitive Substring-Suche im Indexfile).
- `monster:import` `{ monsterIndex: string, x?: number, y?: number, rollHp?: boolean }` → Antwort: `{ ok, character, token }` oder `{ ok: false, error }`. Bei `rollHp: true` HP mit `roll(hitDice)` würfeln.
- `monster:cache:list` `{}` → `{ ok, monsters: [{ index, name, cr }] }` (importierte/cached Monster, für Offline-Anzeige).

Server → Clients:

- `monster:imported` `{ character, token }` – entspricht dem bestehenden `character:upsert`-Broadcast-Muster; Screens sehen nur den Token wie bei jedem Token-Create.

## Client-Verhalten

- **NpcIsland:** Suchfeld mit Debounce (300 ms), Trefferliste (Name, CR, Typ), Klick → Import; bei `monster:import`-Fehler roter Toast mit Grund (z. B. „SRD-API nicht erreichbar – bitte Voll-Datensatz installieren oder später erneut versuchen").
- **Offline-Badge:** Wenn `monster:search` `source: "cache"` meldet oder fehlschlägt: Hinweis „Offline: N Monster aus Cache verfügbar".
- **Attribution:** Statischer Textblock im SettingsPanel (siehe Lizenz).

## Abgrenzung (bewusst NICHT drin)

Kein Bestiarium-Editor, keine Spell-Datenbank, kein automatisches Würfeln von Attacken, kein Encounter-Builder (XP-Budget), kein Import von Homebrew-JSON (separater Folgeschritt), kein CR-Filter-UI (nur Freitextsuche; CR wird angezeigt).

## Abnahmekriterien

1. Suche „goblin" liefert offline (ohne Internet) Treffer aus dem Indexfile; Import scheitert offline ohne Voll-Datei mit klarem Fehler, mit Voll-Datei funktioniert er komplett offline.
2. Import mit Internet: API-Fetch genau beim ersten Import des Monsters; zweiter Import desselben Monsters löst **keinen** HTTP-Request aus (Cache-Hit, per Test verifiziert).
3. Importiertes Monster verhält sich wie ein per `character:upsert` angelegter NPC: Token auf der Karte, HP/AC/Conditions editierbar, sichtbar auf allen Screens, überlebt Reload.
4. `rollHp: true` würfelt `2d6` für einen Goblin serverseitig und setzt `hpCurrent` entsprechend.
5. Attribution-Text steht im SettingsPanel.
6. API-Ausfall (Timeout) während des Imports zerstört nichts: Fehler-Toast, kein halber Datensatz.
7. `npm run lint && npm run test && npm run build` grün. Neue Tests: Normalisierung (reine Funktion `normalizeMonster(raw)` gegen ein Fixture-Statblock-JSON in `fixtures/`), Cache-Hit-Pfad (kein Fetch bei zweitem Import), Offline-Suche.

## Umsetzungsreihenfolge

1. `scripts/build-srd-index.ts` + committetes Indexfile (einmaliger Lauf).
2. `shared/`: `MonsterSearchResult`/`MonsterImportPayload`-Typen + zod-Schemas.
3. Server: `srdMonster.ts` (Fetch + Normalisierung + Cache) mit Fixture-Tests.
4. Server: Events (`monster:search/import/cache:list`) in `events/`.
5. Client: NpcIsland-Suchfeld + Import-Flow + Offline-Badge.
6. `scripts/fetch-srd-full.ts` + Doku in `docs/developing/README.md`.
7. Abnahmekriterien durchtesten.
