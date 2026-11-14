# Design inventory (Ist-Analyse)

Pre-redesign screenshot inventory for the design-rework phase ([design-rework.md](./design-rework.md), ADR 0032). Screenshots live in the Project store (large PNGs are not committed):

`/cursor/stores/bc-fffa7212-a565-4be6-8d39-7107e39de2ca/media/design-inventory/`

Captured against main tip after #69 merge (`9d9df0f`), with step-2 theme tokens already wired (default `arcane`). They document **current inconsistencies** to close during the screen-by-screen rework — not pixel templates for the new design.

## Screen groups

| # | Group | File | Notes |
|---|-------|------|-------|
| 1 | Landing / Home | `01-landing-home.png` | Brand, Create + Join panels, theme toggle + lantern in chrome bar |
| 2 | Create room | `02-create-room.png` | Create form filled / success path |
| 3 | GM Play HUD | `03-gm-play-hud.png` | Left dice / initiative / spawn stack, fog rail, bottom strip |
| 4 | Settings overview | `04-settings.png` | Maps section; theme toggle in settings header |
| 5 | Settings Characters | `05-settings-characters.png` | Roster prep, Add PC/NPC/SRD |
| 6 | Settings calibrate | `06-settings-calibrate.png` | Screen physical size / calibrate |
| 7 | Player Screen | `07-player-screen.png` | Screen role chrome + empty map wait state |
| 8 | Fullscreen fan (#67) | `08-screen-fullscreen-fan.png` | Fullscreen entered; fan empty (“Waiting for initiative…”) — see also prior fan reference in store `media/screen-fullscreen/carousel-fan-reference.png` |
| 9 | Wood letterbox (#68) | `09-wood-letterbox.png` | Map host uses wood plank letterbox (not white Pixi fill) |
| 10 | GM Fog rail | `10-gm-fog-rail.png` | Fog tool rail + map with fog overlay |
| 11 | Explored fog (#64) | `11-explored-fog.png` | Screen view with fog over dungeon map |
| — | WebM (#66) | *(not captured this pass)* | Import of animated package did not finish in the inventory session; re-shoot during Settings/Map screen rework |

## Inconsistencies

### Spacing & density

- Landing panels share a plaque frame but **inner gaps differ**: Create feels tighter; Join packs three actions + secondary mint into the same vertical budget.
- Settings TOC jump-buttons sit tighter than form label→control spacing; Maps upload row mixes compact `grid_px` with full-width file pickers.
- Play HUD left stack uses a scroll container with **narrow gutter**; panel padding (~1.25rem) does not align with bottom-strip chip density.
- Screen empty state centers a small wait plaque inside a large wood field — vertical rhythm differs from GM HUD empty copy.

### Shadows & elevation

- Plaque panels use multi-layer `--shadow-plaque` + iron outline + inset “rivet” pseudo-elements; HUD chips / topbar buttons use flatter gradients.
- Fog rail circular tools, bottom strip buttons, and Settings primary buttons each have **different elevation recipes** (inset highlight vs flat fill vs wood gradient).
- Only two intentional shadow tokens are planned (`--shadow-sm` / `--shadow-lg`); today many one-off box-shadows remain in `styles.css`.

### Buttons & controls

- At least **four visual button families**: wood-gradient primary, parchment secondary, circular fog-rail icons, dark topbar/session chips.
- Disabled vs secondary styling is easy to confuse on Landing (“Join as player” disabled looks similar to secondary).
- Theme toggle is a modern track/thumb control beside a pictorial lantern — intentional orthogonality, but chrome density differs Landing vs Settings vs Play (Play has lantern only).
- File inputs (`Choose Files`) are native browser widgets and break the wood/parchment control language.

### Typography

- Cinzel (display) used for brand, room title, panel H2/H3; IBM Plex for body — generally good, but **HUD labels and Settings helpers** mix sizes without a shared scale (`--text-xs`…`--text-hero` not yet applied in components).
- Brand glow / lantern flame animation is stronger than any other text treatment; Settings long help paragraphs compete with controls.

### Empty / loading / error

| Surface | Empty | Loading | Error |
|---------|-------|---------|-------|
| Landing | — | “Creating…” on button | `.error` paragraph under layout |
| Dice HUD | “No rolls yet.” | — | — |
| Initiative | “Start combat — roll or set…” | — | — |
| Spawn | “No spawn points on this map.” | — | — |
| Screen map | “Waiting for the GM to upload a map…” | Joining room… (join path) | join failures via status |
| Screen initiative | “Waiting for initiative…” | — | — |
| Settings maps | muted “Upload a map…” / empty roster copy | busy disables inputs | status line `settings-status` |

Inconsistencies: empty copy uses **different plaque vs muted inline** patterns; no shared empty-state component; loading is mostly button-disabled text, not a skeleton/spinner language; errors are red text in some places and status toasts/lines in others.

### Color & texture (pre-token debt)

- Panel chrome still composites **`parchment.webp` texture** on top of `--parchment`; without a theme wash, dark `arcane` surface tokens barely show through (addressed lightly in step 2 with an arcane multiply wash; full texture strategy belongs in screen passes).
- Hard-coded rgba accents (borders, insets, fog icons) bypass tokens — inventory target for Lint-Grep later.
- Lantern previously rewrote wood/parchment/ink; step 2 limits lantern to glow/atmosphere (orthogonal to `data-theme`).

### Screen-specific notes

- **Fullscreen fan (#67):** inventory shot shows chrome-hidden fullscreen with empty fan; populated facing-center cards need a follow-up shot once initiative is rolled (reference art already in store).
- **Wood letterbox (#68):** wood behind map is present; ensure letterbox uses theme surface tokens (not a one-off URL) when Screen is redesigned.
- **Explored fog (#64):** screen shows dim/fogged map; confirm never-seen vs explored gray vs clear LoS use semantic fog tokens when Monitor pass runs.
- **WebM (#66):** deferred screenshot; treat as Settings Maps acceptance item.

## Input to tokens (step 2)

Semantic set already introduced in `client/src/theme/tokens.css`: surfaces, text, heading, accent/glow, HP, type scale, 4px spacing, 2 radii, 2 shadows, motion — with `tavern` / `arcane` schemes and legacy `--wood` / `--parchment` / … aliases. Remaining work (later steps): drive component styles off tokens only, unify button/empty languages, and close this inventory with before/after pairs per theme.
