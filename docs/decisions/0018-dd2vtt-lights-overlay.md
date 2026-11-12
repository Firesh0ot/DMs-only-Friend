# ADR 0018 — Soft lights from dd2vtt

- **Status:** accepted
- **Date:** 2026-11-12

## Context

Universal VTT maps may include a `lights` array (position, range, intensity, ARGB color, shadows). Phase 3 calls for lights on import; full dynamic lighting with wall shadows is heavier than this overnight slice. We already persist walls and portals; lights should travel with the map so the table can show atmosphere without a second import.

## Decision

- Parse `lights` on `.dd2vtt` import; persist `maps.lights_json` and include `lights` on `MapState`.
- Normalize UVTT `AARRGGBB` colors to `RRGGBB` for storage; keep range in grid cells and intensity 0–1.
- Soft visual only: additive radial glow sprites on the Pixi map (all roles), under grid/walls/tokens/fog. No light editor, no shadow casting, no ambient/environment darkening, no WebM.
- PNG/JPG/WebP uploads keep `lights: []`.

## Consequences

- Maps with authored lights look warmer on GM, screen, and remote clients after import.
- Later dynamic lighting / LoS-aware shadows can reuse `lights` without re-import.
- Supersedes the “lights out of scope” note in ADR 0008 / 0017 for this soft overlay only.
