# 0005 — Medieval tavern theme and lantern modes

- **Status:** accepted
- **Date:** 2026-11-11

## Context

The Phase-1 UI used a cool moss/teal palette that did not match the product mood. Preferences call for a **medieval tavern** look with a **lantern toggle** between candlelit cozy and darker smoky dungeon, strong framed plaques, and a recessed map tabletop — not a flat recolor.

## Decision

- Visual language is CSS-token driven (`--wood`, `--wood-deep`, `--parchment`, `--ink`, `--lantern`, `--iron`, `--smoke`, `--vignette`) plus lightweight free textures under `client/public/theme/` (with LICENSE).
- **Lantern ON:** warmer wood, amber ambient light, parchment islands; gentle page-wide candle flicker on fixed body overlays (see [ADR 0019](0019-page-wide-candlelit-flicker.md)).
- **Lantern OFF:** cooler/darker stone-wood, heavier vignette, muted parchment; no idle flicker.
- Preference is stored in `localStorage` (`dms-lantern`) and applied via `document.documentElement.dataset.lantern`. The lantern control is available on Home, Settings, Play, and Screen.
- Display font (Cinzel) is reserved for titles/brand; body/combat UI stays on a readable sans (IBM Plex Sans).
- Both fonts are self-hosted (`@fontsource/cinzel`, `@fontsource/ibm-plex-sans`) with `font-display: swap`; SIL OFL notices live under `client/licenses/`.
- Islands and Settings use framed plaque chrome; the map sits in a recessed wooden table frame with contact shadow.

## Consequences

- Theme work is chrome-only; behavior and Pixi map rendering are unchanged.
- Avoid purple neon gradients and default Inter/Roboto stacks for this product surface.
- Future phases should extend the same tokens rather than introducing a second palette.
- Production UI must not depend on fonts.googleapis.com / fonts.gstatic.com so table LAN play works offline.
