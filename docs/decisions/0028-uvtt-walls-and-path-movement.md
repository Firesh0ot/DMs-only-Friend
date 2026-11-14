# 0028 — UVTT wall geometry limits and path-based movement range

- **Status:** accepted
- **Date:** 2026-11-14

## Context

Oliver’s tavern UVTT still looked short of walls after portal-gap healing (#60). Separately, Phase 5 movement range was a Chebyshev square that ignored walls for reachability, so the blue overlay painted illegal cells even when collision rejected the move.

## Decision

### Wall import

- Consume every Universal VTT geometry field we know: `line_of_sight`, `objects_line_of_sight` (merged), and `portals`.
- Heal missing wall spans around **non-freestanding** portals:
  1. On lines that already have wall segments, fill collinear gaps (existing).
  2. On lines with **no** wall segments, synthesize a partition between perpendicular wall brackets that the portal sits between (new).
- Snap closed portals onto nearby wall lines for LoS / collision.
- **Do not** invent walls from the embedded PNG (no edge detection / paint tracing).

### Intentional limits

- Painted walls with neither `line_of_sight` / `objects_line_of_sight` nor a non-freestanding portal have no vector data — they stay visual only.
- Freestanding portals do not create walls.
- Diagonal / freehand LoS polylines stay as-is; axis-aligned heal only.
- Editor-specific private fields outside the UVTT schema are ignored.

### Movement range

- During initiative, movement **budget / range** uses Chebyshev **path cost** on the 8-connected grid through open portals, around walls, blocked by closed portals.
- Client overlay draws the reachable cell set from `turnStart` within `budgetCells`.
- Server `applyMove` uses the same path cost; straight-line wall collision for a drag segment remains.
- Maps without blockers keep the previous Chebyshev square behaviour.

## Consequences

- Re-import or live heal picks up east-wing style partitions when doors exist between known walls.
- Pure paint partitions without portals remain a map-authoring gap (fix in the VTT editor, or accept visual-only walls).
- Reachable blue overlay matches server budget validation at doorways.
