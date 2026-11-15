# D&D-Spielablauf-Anleitung (für Logik- & HUD-Implementierung)

Diese Anleitung beschreibt, **wie eine D&D-5e-Session tatsächlich abläuft** und was die App in jeder Phase dafür benötigt. Sie dient als Referenz, um Spiel-Logiken und HUD daran auszurichten – nicht als Regelersetzung (Regeln bleiben im SRD 5.1). Am Ende: konkrete abgeleitete Anforderungen, inklusive **Vorbereitungs-Kategorie** und **Initiative-Mitgliedschaft**.

## Rollen und Grundlagen

- **DM (Dungeon Master):** erzählt die Welt, spielt alle NPCs/Monster, interpretiert Regeln, entscheidet über Schwierigkeiten.
- **Spieler:** steuern je einen Charakter (PC) mit Werten (Attribute, HP, AC, Fertigkeiten), entscheiden, was dieser tut.
- **Würfel:** d20 ist der Kern (Erfolgsproben gegen Schwierigkeit oder AC), dazu Schadenswürfel (d4–d12), Prozentwürfel. Wichtige Varianten: Advantage/Disadvantage (2× d20, höherer/niedrigerer zählt).
- **Raster:** 1 Zelle = 5 ft; Bewegung in Zellen; Runden sind abstrakt 6 Sekunden Spielzeit.

## Spielablauf einer Session

### Phase 0 – Vorbereitung (Session Prep, vor der Session)

Was der DM tut:
1. Abenteuer/Lage lesen oder schreiben: Orte, NPCs, Geheimnisse, mögliche Kämpfe.
2. **Karten vorbereiten:** pro Ort eine Karte importieren (dd2vtt/PNG), Grid prüfen, Fog einstellen.
3. **NPCs/Monster anlegen:** Statblöcke (SRD-Import oder Homebrew), HP, Portrait.
4. **Encounter skizzieren:** wer erscheint wo, wie viele, Verstärkungen.
5. **Notizen & Tabellen:** NSC-Namen, Gerüchte, Loot, Zufallsbegegnungen.

App-Bedarf: alles, was **vor** dem Spiel passiert, gehört in einen klar getrennten **Vorbereitungs-Bereich** (siehe Requirement R1). Die App hat heute Settings/Characters/Maps-Prep; es fehlt eine gebündelte **Prep-Kategorie** als eigener Navigationsbereich (Karten, NPCs, Encounter-Skizzen, Notizen, Zufallstabellen) mit dem Ziel: „Session vorbereitet → Play drücken → läuft."

### Phase 1 – Freies Spiel / Exploration (nicht rundenbasiert)

- DM beschreibt die Szene; Spieler fragen, untersuchen, reden, bewegen sich frei.
- **Keine Initiative, keine Runden.** Gelegentliche Würfe (Wahrnehmung, Heimsuche, Überzeugen) – einzeln, wenn die Situation es verlangt.
- Bewegung auf der Karte ist frei (kein Budget).
- **Entdeckung:** Spieler sehen nur, was ihre Tokens sehen (LoS-Fog). NPCs existieren auf der Karte, **bevor** die Spieler sie bemerken – der DM platziert sie verdeckt.

App-Bedarf: freie Token-Bewegung (vorhanden), LoS-Fog (vorhanden), Würfel (vorhanden), **versteckte NPCs** (vorhanden: Sichtbarkeit + LoS-Verdeckung #64). **Fehlt:** NPCs dürfen nicht automatisch in der Initiative landen (siehe R2) und ein „Entdeckt"-Übergang, wenn ein NPC sichtbar wird.

### Phase 2 – Encounter / Kampf (rundenbasiert)

Ablauf:
1. **Überraschung** (optional): verdeckte Wahrnehmung vs. Stealth; Überraschte haben keinen Zug in Runde 1.
2. **Initiative auswürfeln:** d20 + DEX-Mod für jeden **Teilnehmer des Kampfes** – nicht für jeden Token auf der Karte.
3. **Runden:** ein Zug pro Teilnehmer in Reihenfolge; pro Zug: **Bewegung** (Budget in Zellen), **Aktion** (Angriff, Zauber, Helfen …), **Bonus-Aktion** (falls verfügbar), **Reaktion** (außerhalb des eigenen Zuges, z. B. Gelegenheitsangriff), Freie Aktionen (reden, Gegenstand rausnehmen).
4. **Zustände:** HP-Verlust, Conditions (prone, frightened, unconscious …), Konzentration, **Todesrettungswürfe** bei 0 HP (3 Erfolge stabil / 3 Fails tot).
5. **Dynamik:** Teilnehmer **kommen hinzu** (Verstärkung betritt die Karte) und **fallen heraus** (Flucht, Tod, Unsichtbarkeit, Gefangennahme) – mitten im Kampf.
6. **Ende:** eine Seite besiegt/flieht → Kampf endet, Initiative wird aufgelöst.

App-Bedarf: Initiative-Carousel mit Zug-Flags (vorhanden), Bewegungsbudget (vorhanden), HP/Conditions (vorhanden). **Fehlt:** manuelle Initiative-Mitgliedschaft (R2) und das bewusste **Hinzufügen/Entfernen während des Kampfes** (Teil von R2).

### Phase 3 – Ruhe & Ressourcen

- **Short Rest (1 h):** Hit Dice ausgeben, einige Fähigkeiten zurück.
- **Long Rest (8 h):** HP voll, fast alles zurück.
- App-Bedarf heute: HP manuell editierbar – ausreichend fürs erste; ein Ruhe-Workflow ist ein späterer Ausbau (nicht Teil dieser Anleitung).

### Phase 4 – Session-Ende

- XP/Level-Up, Loot-Verteilung, Recap. App-Bedarf: Session-Log (vorhanden) als Recap-Quelle.

## Abgeleitete Anforderungen

### R1 – Vorbereitungs-Kategorie (Prep) im GUI

Heute verteilt sich Vorbereitung auf Settings-Bereiche. Gefordert: eine **eigenständige Prep-Kategorie** (Navigationsebene neben Play), die alle Phase-0-Tätigkeiten bündelt:

- **Karten:** Import, Grid, Fog-Voreinstellung, Spawn-Punkte (alles vorhanden, nur gebündelt).
- **NPCs & Monster:** SRD-Import, Homebrew-Pflege, Portrait (vorhanden, gebündelt).
- **Encounter-Skizzen:** Gruppe von NPCs mit Einstiegsposition/Verstärkung als wiederverwendbares Paket (neu, aber klein: benannte NPC-Liste + „alle auf Karte platzieren").
- **Notizen & Zufallstabellen:** Freitext-Notizen pro Karte/Raum; Würfel-Tabelle (Zeile würfeln) (neu, später).

Akzeptanz: DM kann eine komplette Session vorbereiten, ohne den Play-Bildschirm zu betreten; Play übernimmt die vorbereiteten Karten/NPCs unverändert.

### R2 – Initiative-Mitgliedschaft (NPCs nicht automatisch)

**Problem (aktueller Zustand):** Alle NPCs auf der Karte erscheinen automatisch in der Initiative. Das widerspricht dem Spielablauf: Ein noch unentdeckter Wächter im Nebenraum ist nicht Kampfteilnehmer.

**Regel nach Spielablauf:**
- Initiative enthält **nur aktive Kampfteilnehmer** – der DM entscheidet, wer das ist.
- `initiative:roll` würfelt nur für **Mitglieder** der Initiative, nicht für alle Tokens.
- **Hinzufügen:** DM fügt einen NPC hinzu (entdeckt/Verstärkung betritt die Karte) – Initiative wird für ihn gewürfelt (oder DM gibt manuell ein) und er wird ans Ende der Reihenfolge einsortiert (5e: handelt in der laufenden Runde beim niedrigsten Initiative-Wert danach).
- **Entfernen:** DM nimmt einen NPC heraus (geflohen, tot, unsichtbar, Verhandlung) – er verschwindet aus der Reihenfolge, ohne die aktive Position zu zerstören (aktiver Index wird korrekt nachgeführt).
- **UI:** Im TurnCarousel/Initiative-Bereich: pro NPC ein „+/-"-Toggle (in Initiative / nicht); im Kampf-Start-Dialog: Auswahl der Teilnehmer (Default: sichtbare/entdeckte NPCs, alle PCs).
- **Persistenz:** Mitgliedschaft pro Kampf; nach `battle:end` wird sie zurückgesetzt.

Akzeptanz: (1) Unentdeckter NPC erscheint nach `initiative:roll` nicht in der Reihenfolge. (2) DM fügt ihn mid-combat hinzu → er erscheint sofort korrekt einsortiert. (3) DM entfernt fliehenden NPC → Carousel rotiert weiter, aktiver Zug bleibt korrekt. (4) `battle:start` fragt Teilnehmer ab statt automatisch alle zu nehmen.

### R3 – daraus folgend (später, nur Vermerke)

- Advantage/Disadvantage im Dice-Parser (`2d20kh1/kl1`)
- Angriffs-Workflow (d20 vs AC → Schaden → HP)
- Death-Save-Zustand
- „Entdeckt"-Status als Bindeglied zwischen LoS-Sichtbarkeit und Initiative-Vorschlag (Default-Auswahl bei R2)

## Mapping: Spielablauf ↔ heutige Features

| Phase | App-Feature | Status |
|---|---|---|
| Prep | Karten-Import, NPC-Bibliothek, Portraits | vorhanden, aber verstreut → R1 |
| Exploration | LoS-Fog, NPC-Verdeckung, freie Bewegung | vorhanden |
| Kampf | Initiative-Carousel, Zug-Flags, Bewegungsbudget, HP/Conditions | vorhanden; Mitgliedschaft fehlt → R2 |
| Kampf-Dynamik | Mid-combat Teilnehmer-Änderung | fehlt → R2 |
| Rest | HP manuell | Basis reicht; Workflow später |
| Ende | Session-Log | vorhanden |
