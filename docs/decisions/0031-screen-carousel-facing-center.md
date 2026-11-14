# ADR 0031 — Screen fullscreen carousel facing center

- **Status:** accepted
- **Date:** 2026-11-14

## Context

The table Screen sits flat in the middle of the table. Players sit around the TV and look toward its center. A fullscreen initiative fan must stay readable from those seats without sharing GM chrome. Oliver confirmed the intent: place the carousel near an edge; card “up” points toward screen center.

## Decision

- **Placement** is a normalized point `(xNorm, yNorm)` in the Screen viewport (0–1), persisted in room settings (`screen_carousel_x` / `screen_carousel_y`) and synced via `settings:updated` / `screen:carouselSet` (GM or Screen).
- **Facing:** widget rotation is `atan2(0.5 - xNorm, -(0.5 - yNorm))` in degrees (CSS clockwise). At the south edge this is `0°` (upright); west ≈ `+90°`, east ≈ `−90°`, north ≈ `±180°`. Card text baselines share that widget “up,” so they read toward the physical table center.
- **Fan layout** (layout only, tavern theme — not Uno styling): middle card = active initiative index; neighbors rotate outward and overlap; Screen is read-only.
- **Fullscreen** on role `screen` hides top bar and left rail; map is edge-to-edge; exit via control or Esc. Fullscreen preference is local to the Screen device.

## Consequences

- DM can preset edges in Settings or drag the Place handle on a Screen; all Screens share the same placement.
- No per-card radial text reflow beyond the shared facing angle — simplest readable model.
- GM Play HUD and remote player chrome are unchanged.
