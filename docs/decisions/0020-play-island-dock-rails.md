# ADR 0020 — Play island dock rails

- **Status:** superseded by [0024](0024-play-game-hud.md)
- **Date:** 2026-11-13

## Context

Play-mode islands used absolute corner/mid docks (`tl`/`tr`/`ml`/`mr`/`bl`/`br`) plus a per-island **Snap** cycle. Tall islands on the same side overlapped and clipped each other. Snap was hard to use one-handed at the table. Saved corner layouts in `localStorage` kept broken stacks after deploy.

## Decision

- Replace corner Snap with **left/right dock rails** that auto-stack islands in a column with a gap.
- Persist layout per room under `dms-islands:v2:{code}`: side membership, order, and collapsed flags.
- Default first visit: left = Map, Dice, Log; right = Initiative, Fog, NPCs.
- Discard legacy `dms-islands:{code}` corner payloads (reset to the v2 default).
- Island chrome: collapse/expand via the title, **Left** / **Right** dock buttons, and ↑ / ↓ reorder within a rail.

## Consequences

- Fixed overlap for the island era; table still felt slow with six tall plaques.
- Superseded the same day by the compact Play HUD in [0024](0024-play-game-hud.md); `dms-islands:v2` keys are cleared when the HUD loads.
