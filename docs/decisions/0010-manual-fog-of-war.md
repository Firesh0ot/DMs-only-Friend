# ADR 0010 — Manual Fog of War

- **Status:** accepted
- **Date:** 2026-11-11

## Context

Phase 2 calls for a manual Fog-of-War layer (brush and rectangles) so the GM can hide and reveal the map for the table screen and remote players. Automatic line-of-sight from walls (`.dd2vtt`) stays later. Prep/Play islands are already the GM chrome pattern.

## Decision

- Fog is **per map**, stored in SQLite (`map_fog`: `base_covered` + ordered `strokes_json`).
- Default for a new map: fully covered (`baseCovered: true`, no strokes).
- GM-only socket events: `fog:paint` (append brush or rect stroke) and `fog:reset` (cover-all or clear-all). Server assigns stroke ids, normalizes rects, and broadcasts `fog:updated`.
- Snapshot on join includes `fog` for the active map (or `null` with no map). Map activate/upload/remove also refreshes fog for clients.
- Client renders fog with PixiJS v8 (`RenderTexture` fed by Canvas2D mask compositing: `destination-out` reveal / `source-over` hide). Screen/player see opaque fog; GM sees translucent fog for editing. Pixi `erase` blend is avoided because it does not apply when rendering bare `Graphics` into a `RenderTexture` in v8.
- Play gets a **Fog** island (tool off/brush/rect, reveal/hide, brush size, cover/clear) with corner snap like other islands. No automatic LoS.

## Consequences

- Stroke lists can grow; a hard cap rejects further paints until reset (bake/compact can come later).
- Fog is independent of dice, HP, and `.dd2vtt` importers.
- Later wall-based LoS can feed the same mask or a sibling layer without changing the GM paint UX.
