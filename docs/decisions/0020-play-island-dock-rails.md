# ADR 0020 — Play island dock rails

- **Status:** accepted
- **Date:** 2026-11-13

## Context

Play-mode islands used absolute corner/mid docks (`tl`/`tr`/`ml`/`mr`/`bl`/`br`) plus a per-island **Snap** cycle. Tall islands on the same side (especially `tr` + `mr` + `br`) overlapped and clipped each other. Snap was tiny and hard to use one-handed at the table, and cycling could park several islands on the same slot. Saved corner layouts in `localStorage` kept broken stacks after deploy.

## Decision

- Replace corner Snap with **left/right dock rails** that auto-stack islands in a column with a gap.
- Persist layout per room under `dms-islands:v2:{code}`: side membership, order, and collapsed flags.
- Default first visit: left = Map, Dice, Log; right = Initiative, Fog, NPCs.
- Discard legacy `dms-islands:{code}` corner payloads (reset to the v2 default) so existing rooms stop overlapping after deploy.
- Island chrome: collapse/expand via the title, **Left** / **Right** dock buttons, and ↑ / ↓ reorder within a rail.
- Each expanded island shares rail height; body scrolls inside the island when content exceeds its share. Island frame stays `overflow: visible` so tavern plaque `::after` chrome does not create phantom outer scrollbars (see prior island scrollbar fix).

## Consequences

- ADR [0003](0003-prep-play-ux.md) Play islands remain floating controls; docking semantics change from corners to rails.
- Playing manuals (EN/DE) describe Left/Right/collapse instead of Snap.
- No server/schema change; layout stays browser-local per room code.
