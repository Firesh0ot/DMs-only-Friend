# 0033 — Manual wall and obstacle placer in Play

- **Status:** accepted
- **Date:** 2026-11-15

## Context

UVTT maps without vector `line_of_sight` / portal data (and plain PNG maps) had no way to add blocking geometry in Play. ADR 0028 left painted-only UVTT walls as a map-authoring gap. GMs needed a lightweight paint tool for permanent walls and removable rectangular obstacles without importing a new file.

## Decision

- **Wall tool (GM Play):** click A then B to append a solid 2-point polyline to `maps.walls_json` via `wall:addSegment`. Blocks LoS and movement. No delete/edit in this slice. After append, re-run `healWallsAroundPortals` when portals exist so doors stay valid.
- **Obstacle tools (GM Play):** place 1×1 cell AABBs like spawn markers via `obstacle:place`. Kinds: `seeThrough` (movement only) and `solid` (LoS + movement). With an obstacle tool active, clicking an existing obstacle removes it (`obstacle:remove`). Persist in `maps.obstacles_json`.
- Geometry: solid obstacle edges join LoS blockers; both kinds join movement/pathfinding blockers. LoS enable treats solid obstacles like walls/portals.
- HUD: Wall + Obstacle see-through/solid icons on the right structure/fog rail; mutually exclusive with fog paint and spawn.

## Consequences

- PNG / paint-only UVTT maps can gain real LoS and collision without re-export from a VTT editor.
- Wall delete, freehand chains, resize, manual doors, and image tracing stay out of scope.
- Closes the practical gap called out in ADR 0028 for tables that only have image maps.
