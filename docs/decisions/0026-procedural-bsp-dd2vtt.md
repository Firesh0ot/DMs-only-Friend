# 0026 — Procedural BSP dungeon to dd2vtt

- **Status:** accepted
- **Date:** 2026-11-13
- **Relates to:** [0008](0008-dd2vtt-map-import.md), [0021](0021-roadmap-reorder-offline-online.md)

## Context

Phase 6 (KI) should produce maps the existing importer and LoS/fog stack already understand. Full image stylization (Stable Diffusion) is optional and heavy; overnight needs a minimal shippable generator.

## Decision

- Generate layout with **BSP** (rooms + L-corridors), export **dd2vtt-compatible** JSON: embedded PNG, `pixels_per_grid`, `line_of_sight` wall polylines, soft `lights` at room centers.
- Persist via the same `RoomStore.addMap` path as uploads (`POST /api/rooms/:code/map/generate`, GM upload token).
- Defer WFC, AI stylization, and WebM packages to later Phase 6 slices.

## Consequences

- Generated maps get LoS fog, wall overlay, and lights without a second pipeline.
- Seeds make layouts reproducible for tests and GM re-rolls.
- Stylized art remains a later optional layer on top of the same geometry.
