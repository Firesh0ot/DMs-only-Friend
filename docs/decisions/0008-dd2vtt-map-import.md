# 0008 — Universal VTT (.dd2vtt) map import

- **Status:** accepted
- **Date:** 2026-11-11

## Context

Phase 1 only accepted PNG/JPG/WebP with a manual `grid_px`. Universal VTT (`.dd2vtt` / `.uvtt`) is the project’s preferred map format: it embeds the image, grid size, and wall polylines used later for line-of-sight fog. Full automatic LoS fog is a later milestone; we still need walls persisted once maps arrive from Dungeon Map Builder, Dungeon Scrawl, Dungeondraft, and similar tools.

## Decision

- Accept `.dd2vtt` (and `.uvtt`) on `POST /api/rooms/:code/map` alongside image uploads.
- Parse on the server: extract the embedded image to `server/uploads/`, set `grid_px` / offsets from `resolution`, and store `line_of_sight` polylines (grid-cell coordinates) in `maps.walls_json`.
- Expose `walls` on `MapState` in snapshots and map events.
- For GM only, draw a simple wall overlay on the Pixi map. Automatic LoS fog: [0016](0016-los-fog-from-walls.md). Doors/portals: [0017](0017-dd2vtt-doors-portals.md). Lights and WebM layers stay later.
- PNG/JPG/WebP uploads remain supported; their `grid_px` stays manual and `walls` stay empty.

## Consequences

- Settings Maps can ingest VTT exports without a separate calibration step when the file includes grid data.
- Later LoS fog can read persisted walls without re-importing maps.
- Automatic LoS fog from persisted walls is covered in [ADR 0016](0016-los-fog-from-walls.md). Animated WebM packages remain a later cut.
