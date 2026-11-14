# Design-Rework: Visuelle Neugestaltung (Spezifikation)

Phase für ein systematisches Design-Rework der gesamten Website. Ansatz: **Design-Tokens zuerst, dann Screen für Screen** – die App bleibt während des gesamten Reworks jederzeit spielbar. Grundlage sind drei ausgearbeitete Design-Varianten, aus denen Oli (Produkt-Owner) eine auswählt.

## Ziel

1. **Drei Design-Varianten** ausarbeiten (Richtung, Palette, Typografie, Formensprache) – Oli wählt eine.
2. **Zentrales Token-System** (`theme.css`) mit allen Design-Entscheidungen an einer Stelle.
3. **Screen-für-Screen-Umsetzung** in Priorität: Landing → DM-Play → Settings → Tisch-Monitor.
4. **Favicon** als reduzierte Silhouette aus der gewählten Variante.

## Screenshot-Workflow (Verbindlich)

Screenshots haben **beide** Rollen:

1. **Ist-Analyse (vor dem Redesign):** Cursor macht vor Beginn Screenshots aller Screens (Landing/HomePage, Raum-Erstellen, GM-Play mit HUD/Carousel/Fog-Rail, Settings inkl. Characters/Kalibrierung, Player-Screen) und legt ein **Inkonsistenz-Inventar** an: welche Abweichungen gibt es zwischen Screens (Abstände, Schatten, Button-Stile, Fehlerzustände, Ladezustände, Leerezustände)? Dieses Inventar ist Input für die Token-Definition und wird in `docs/design-inventory.md` festgehalten.
2. **Vorher/Nachher-Vergleich (Abnahme):** Pro Screen wird ein Screenshot-Paar (vor/nach) als Abnahmekriterium geführt; die Abnahme prüft, dass das Inventar der Inkonsistenzen geschlossen wurde.

Screenshots werden **nicht** als pixelgenaue Vorlage für das neue Design benutzt – maßgeblich sind Tokens und Varianten-Spec, nicht der alte Ist-Zustand.

## Die drei Design-Varianten

Alle Varianten nutzen die bestehende Infrastruktur (Cinzel + IBM Plex Sans sind self-hosted, Lantern-Toggle bleibt als Feature erhalten). Die Entscheidung trifft Oli; bis dahin ist keine Variante umgesetzt.

### Variante A – „Verfeinerte Taverne" (Evolution)

Die bestehende Identität (Holz, Pergament, Lampionschein, Cinzel) bleibt, wird aber diszipliniert: weniger Textur-Noise, konsistentere Abstände, klarere Hierarchie, ruhigere Flächen.

- **Palette:** Bestehende Farben (`--wood`, `--parchment`, `--lantern`) als Basis, reduziert um Nebenvarianten; ein neutrales Grau-Set für UI-Elemente, damit Panels nicht alle braun sind.
- **Typografie:** Cinzel nur noch für Screen-Titel und Karten-Namen; IBM Plex Sans für alles Operative (HUD, Buttons, Listen).
- **Formen:** Bestehende Plaque-Ästhetik, aber einheitliche Radii (z. B. 6/12 px) und nur noch zwei Schatten-Stufen.
- **Stärke:** Geringstes Risiko, kein Vertrauensverlust bei Bestehenden, Favicon-Moodboard passt ohnehin.
- **Schwäche:** Am Ende immer noch „Taverne" – kein neuer Eindruck.

### Variante B – „Arkaner Modus" (Revolution, Favicon-Moodboard)

Neuausrichtung am Favicon-Bild: dunkler, kontrastreicher, moderner – die Karte (Map) wird zur Hauptbühne, UI tritt als dunkles Interface zurück. Das ist das, was moderne VTTs (Foundry mit Modulen, Alchemy) visuell auszeichnet.

- **Palette:** Tiefes Anthrazit/Basalt als Fläche (`#141210`-Bereich), warmes Amber **nur** als Akzent (aktiver Zug, Highlights, Lantern-Glow), Pergament **nur** für Text auf dunklen Flächen; Grün/Rot für HP-Zustände.
- **Typografie:** Cinzel für Titel und die TurnCarousel-Karten (dort ist es stark), IBM Plex Sans für HUD; größere Basisschrift im Play (Lesbarkeit auf Distanz).
- **Formen:** Flache Panels mit feinen Borderlinien statt Plaque-Ornamentik; Glow nur für aktive Zustände (aktiver Token, aktive Karte im Carousel).
- **Stärke:** Größter visueller Sprung, Map wirkt größer, bester Kontrast für den Tisch-Monitor (dunkle UI auf TV bei Nacht), Favicon passt 1:1.
- **Schwäche:** Größter Umfang (fast alle Komponenten), Lobby/Landing muss mitgedacht werden, damit es nicht „leer" wirkt.

### Variante C – „Pergament & Präzision" (Hybrid)

Helle, moderne Interface-Ästhetik mit Fantasy-Akzenten: Pergament-weiße Flächen, präzise Typo, dezente Fantasy-Details (Ornament-Linien, Siegel-Icons) nur an Schlüsselstellen (Karten, Titel, Favicon).

- **Palette:** Warmes Off-White als Grundfläche, Tinte (dunkles Braun-Schwarz) für Text, Amber als Akzent, Holz-Braun nur als Sekundärfarbe.
- **Typografie:** IBM Plex Sans dominant, Cinzel sparsam als „Siegel" (Titel, Karten-Namen, Logo).
- **Formen:** Saubere Karten-Metapher (die TurnCarousel-Karten werden zu echten Karten mit feiner Bordenlinie), minimale Schatten, klare Zustandsfarben.
- **Stärke:** Freundlichster erster Eindruck (Landing!), beste Lesbarkeit, modernster Look für neue Nutzer.
- **Schwäche:** Am Tisch-Monitor (dunkler Raum) sind helle Flächen ungünstig – der Screen müsste als Ausnahme dunkel bleiben (Dark-Screen-Ausnahme in den Tokens vorsehen).

**Empfehlung (nicht bindend):** Variante B für Play/Screen kombiniert mit der Landing-Freundlichkeit von C wäre ideal – wenn Oli das wünscht, ist das eine vierte Variante „B+C-Split" (Play dunkel, Landing/Settings hell). In den Tokens ist das nur umsetzbar, wenn **von Anfang an** zwei Flächenschemata (`scheme: dark` / `scheme: light`) vorgesehen werden.

## Design-Tokens (`client/src/theme/tokens.css`)

Neue, einzige Quelle der Wahrheit; `styles.css` wird im Verlauf auf die Tokens umgestellt (bestehende `--wood`- etc. Variablen werden Aliase auf Tokens):

```css
/* Beispieldaten für Variante B; final abhängig von Olis Wahl */
:root {
  /* Flächen */
  --surface-0: #141210;        /* App-Hintergrund */
  --surface-1: #1d1a16;        /* Panels */
  --surface-2: #26221d;        /* Erhöhte Panels, HUD */
  /* Text */
  --text-primary: #e8dcc3;
  --text-secondary: #a89878;
  --text-disabled: #5c5548;
  /* Akzente */
  --accent: #e8a045;            /* Amber: aktive Zustände */
  --accent-glow: 0 0 12px rgba(232, 160, 69, 0.35);
  /* Semantik */
  --hp-high: #4a8f5c; --hp-low: #c9a227; --hp-critical: #b34132;
  /* Typo-Skala (nur 6 Stufen) */
  --font-display: "Cinzel", serif;
  --font-body: "IBM Plex Sans", sans-serif;
  --text-xs: 12px; --text-sm: 14px; --text-md: 16px;
  --text-lg: 20px; --text-xl: 28px; --text-hero: 40px;
  /* Spacing (4er-Raster) */
  --space-1: 4px; --space-2: 8px; --space-3: 12px; --space-4: 16px;
  --space-5: 24px; --space-6: 32px; --space-7: 48px;
  /* Radii + Elevation (nur je 2 Stufen) */
  --radius-sm: 6px; --radius-lg: 12px;
  --shadow-sm: 0 1px 2px rgba(0,0,0,.4);
  --shadow-lg: 0 8px 24px rgba(0,0,0,.5);
  /* Motion */
  --motion-fast: 120ms ease; --motion-turn: 300ms cubic-bezier(.2,.8,.2,1);
}
```

Regeln: **keine** hex-Farben und px-Werte mehr direkt in Komponenten-Styles; Zustände (hover/active/disabled) werden pro Token definiert, nicht pro Komponente. Der Lantern-Toggle wird auf Token-Ebene implementiert (er moduliert nur `--accent-glow` und Glow-Stufen).

## Umsetzungsreihenfolge (Screen für Screen)

0. **Varianten-Abnahme:** Oli wählt A/B/C (oder B+C-Split) – erst dann weiter.
1. **Ist-Inventar:** Screenshots aller Screens + `docs/design-inventory.md` (Inkonsistenzen, Leere-/Fehler-/Ladezustände).
2. **Tokens:** `tokens.css` anlegen, `styles.css`-Variablen zu Aliasen machen, alle Komponenten laufen (noch altes Aussehen, neue Quelle).
3. **Landing/HomePage + Raum-Erstellen:** erster Screen, weil er den Ton setzt und am wenigsten Logik berührt. Favicon (SVG + ICO aus der Varianten-Silhouette) gleich mit.
4. **DM-Play:** HUD-Panels, TurnCarousel-Karten, Dice, Fog-Rail, Log – der größte Brocken, in Teil-Schritten (erst Flächen/Typo, dann Komponenten-Detail).
5. **Settings/Prep:** SettingsPanel, Characters, Kalibrierungs-Assistent, Spawn-Editor.
6. **Tisch-Monitor/Player-Screen:** zuletzt, inkl. Distanz-Lesbarkeit (größere Typo-Stufen nutzen, Kontrast-Check 3 m).
7. **Abnahme:** Vorher/Nachher-Screenshot-Paare pro Screen; Inventar-Abgleich; `npm run lint && test && build` grün.

## Abgrenzung (bewusst NICHT drin)

Keine Layout-Umstrukturierung (HUD-Positionen bleiben wie ADR 0024/0025), keine neuen Features, kein Rebranding (Name/Logo-Text bleibt), keine Illustrationen/Artworks pro Screen (nur Favicon + Moodboard), kein Dark/Light-Toggle für Nutzer im ersten Wurf (falls B+C-Split: Schemata sind an Screens gebunden, nicht umschaltbar).

## Abnahmekriterien

1. `docs/design-inventory.md` existiert mit Screenshots aller 5 Screen-Gruppen und gelisteten Inkonsistenzen.
2. Alle Farben/Spacing/Typo in Komponenten kommen aus Tokens – kein direktes Hex/px in Komponenten-Styles (Lint-Grep als Check).
3. Pro Screen existiert ein Vorher/Nachher-Screenshot-Paar; alle Inventar-Inkonsistenzen sind geschlossen.
4. Favicon (`favicon.svg` + ICO/PNG 32px, lesbar bei 16px) ist eingebunden und stammt aus der gewählten Variante.
5. Lantern-Toggle funktioniert weiterhin und wirkt nur über Tokens.
6. Tisch-Monitor: Text in 3 m lesbar (Typo-Stufe, Kontrast ≥ 4.5:1 für Fließtext).
7. `npm run lint && npm run test && npm run build` grün; keine visuellen Regressionen in bestehenden Tests.
