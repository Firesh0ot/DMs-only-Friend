# ADR 0003 — Prep Settings and Play control islands

## Status

Accepted (2026-11-11)

## Context

Phase 1 delivered a single GM chrome (toolbar + initiative panel beside the map). That mixes quest prep with live-table controls and crowds the player/screen view. Preferences ask for Settings (prep) vs Play (floating islands), with a map-first player screen and a TCG-style initiative rail.

## Decision

- **Settings** is the GM prep surface: multi-map upload, per-map `grid_px`, room links, PC/NPC roster with map links.
- **Play** shows the map full-bleed with three floating islands (Map control, Initiative, NPCs). Islands snap to corners; placement is persisted per room in `localStorage`.
- **Screen/player** have no islands; a side rail shows round, order, and whose turn (portrait or placeholder). Camera still follows the GM.
- Server remains source of truth for maps, active map, characters, visibility (`showPcs` / `showNpcs`), tokens on the active map, and initiative (including `round`).

## Consequences

- Snapshot gains `maps`, `characters`, `visibility`; tokens are filtered by active map and visibility.
- Switching the active map materializes linked character tokens; unlinked characters leave the board.
- Fog, `.dd2vtt`, and dice UI stay out of this cut. Session/battle log: see [0004](0004-session-battle-log.md).
