# 0019 — Page-wide candlelit flicker

- **Status:** accepted
- **Date:** 2026-11-13

## Context

Lantern ON already drew a warm ambient overlay on `body.tavern-body::after` (`position: fixed`, full viewport, above chrome). Idle motion was opacity-only on corner-biased radials, so the flicker read as a local map/ambient glow rather than mystical candlelight over the whole page. Preferences ask for subtle tavern atmosphere, not seizure-level flash, and dungeon (lantern OFF) must stay calm.

## Decision

- **Lantern ON:** page-wide CSS ambience only — fixed full-viewport overlays on `body.tavern-body::before` (vignette) and `::after` (warm wash). Idle motion couples a soft brightness/saturate + opacity pulse on the warm layer with a slower irregular vignette breathe; the warm layer includes a light full-page film so chrome, islands, Settings, and Screen share the same candle rhythm.
- **Lantern OFF:** no idle flicker; static heavy vignette / smoke treatment only.
- Blow-out / light-up transition FX (`data-lantern-fx`) and the lantern toggle flame animation stay as before.
- `prefers-reduced-motion: reduce` freezes overlays to static cozy values (no continuous pulse, no transition FX).
- No canvas, no heavy JS — CSS overlays with `pointer-events: none`.

## Consequences

- Candlelit mode feels globally atmospheric without changing Pixi map rendering or island layout.
- Theme docs should describe flicker as viewport chrome ambience, not a map-only effect.
- Future mood polish should extend these body overlays / tokens rather than per-island animations.
