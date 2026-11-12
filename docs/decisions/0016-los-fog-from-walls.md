# ADR 0016 — Automatic line-of-sight fog from walls

- **Status:** accepted
- **Date:** 2026-11-12

## Context

Phase 3 needs automatic Fog of War from Universal VTT `line_of_sight` polylines already stored in `maps.walls_json`. Manual brush/rect fog (ADR 0010) must remain. The GM should be able to toggle LoS and combine it with manual cover/reveal without a second paint UX.

## Decision

- Persist per-map `los_enabled` on `map_fog` (default off). Server is source of truth; GM-only `fog:setLos` updates it and broadcasts `fog:updated` (same channel as manual fog). Enabling LoS requires wall data on the map.
- Clients recompute vision from `map.walls` + player tokens (`isPlayer`) on the active map. Unlimited range; walls and map bounds block rays. Ray-cast visibility polygons punch holes in an LoS cover layer.
- Combine with manual fog by **OR of fog masks** (visible only where both allow): manual strokes still reveal/hide; LoS additionally hides anything not currently visible to a PC token. Clear-all + LoS on ≈ pure dynamic LoS; Cover-all + LoS still needs manual reveals before LoS can show anything.
- Pixi renders one fog sprite (manual ∪ LoS). Screen/player opaque; GM translucent. Wall overlay for the GM stays.
- Fog island gains an **LoS on/off** control (disabled when the active map has no walls).

## Consequences

- Token moves refresh LoS for all clients without new server events beyond existing token sync.
- Lights, per-token vision radius, and animated WebM stay out of scope. Doors/portals: see [0017](0017-dd2vtt-doors-portals.md).
- Dense wall maps may need later performance work (spatial index / baking); first slice prefers correctness and tests.
