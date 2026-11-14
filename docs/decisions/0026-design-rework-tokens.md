# 0026 — Design rework: tokens-first, screen-by-screen, three variants

- **Status:** proposed
- **Date:** 2026-11-14

## Context

The app has a working tavern theme (`styles.css`, ~3000 lines, CSS variables scattered, Cinzel + IBM Plex Sans self-hosted, lantern toggle). The generated favicon moodboard (d20 with warm lantern glow on dark stone) sparked a full visual rework. Screenshots of the current site exist and will be taken by Cursor, but redesigning from screenshots alone risks visual iteration without a system.

## Decision

1. **Tokens first.** A single `client/src/theme/tokens.css` becomes the source of truth (surfaces, text, accents, semantic HP colors, 6-step type scale, 4px spacing grid, 2 radii, 2 shadows, motion). No raw hex/px in component styles afterwards; existing `--wood`-style variables become aliases.
2. **Screen-by-screen rollout** in priority: Landing → DM-Play → Settings → table monitor. The app stays playable throughout; no big-bang.
3. **Three design variants are specified** (A refined tavern evolution, B arcane dark revolution based on the favicon moodboard, C parchment-light hybrid with a possible B+C split: dark Play, light Landing/Settings). Oli picks one before implementation starts.
4. **Screenshots have both roles:** (a) pre-work inventory of inconsistencies (`docs/design-inventory.md`), (b) before/after pairs as acceptance evidence. They are not the design template.
5. **Favicon** is derived as a reduced silhouette of the chosen variant (SVG + ICO, crisp at 16px).

## Consequences

- The lantern toggle must be re-expressed on token level (modulates glow tokens only).
- If the B+C split is chosen, tokens must define two surface schemes from the start, bound to screens (no user-facing toggle in this slice).
- No layout changes: HUD positions per ADR 0024/0025 stay.

## References

- [docs/design-rework.md](../design-rework.md)
- [0005-tavern-theme-lantern.md](0005-tavern-theme-lantern.md)
- [0024-play-game-hud.md](0024-play-game-hud.md)
