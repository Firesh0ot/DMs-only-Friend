# ADR 0003 — Prep Settings and Play HUD

## Status

Accepted (2026-11-11); Play chrome updated 2026-11-13 — see [0024](0024-play-game-hud.md) (supersedes dock-rail islands [0020](0020-play-island-dock-rails.md)).

## Context

Phase 1 delivered a single GM chrome (toolbar + initiative panel beside the map). That mixes quest prep with live-table controls and crowds the player/screen view. Preferences ask for Settings (prep) vs Play (compact game HUD), with a map-first player screen and a TCG-style initiative rail.

## Decision

- **Settings** is the GM prep surface: multi-map upload, per-map `grid_px`, room links, PC/NPC roster with map links.
- **Play** shows the map full-bleed with a compact **game-style HUD**: left dice + initiative (including PC/NPC display toggles), right Fog of War, bottom strip for battle / next / log / overflow (active map). Layout collapse prefs persist lightly per room in `localStorage`.
- **Screen/player** have no GM HUD; a side rail shows round, order, and whose turn (portrait or placeholder). Camera still follows the GM.
- Server remains source of truth for maps, active map, characters, visibility (`showPcs` / `showNpcs`), tokens on the active map, and initiative (including `round`).

## Consequences

- Snapshot gains `maps`, `characters`, `visibility`; tokens are filtered by active map and visibility.
- Switching the active map materializes linked character tokens; unlinked characters leave the board.
- Session/battle log: see [0004](0004-session-battle-log.md). Dice/fog live in the HUD; see [0007](0007-dice-play-island.md), [0010](0010-manual-fog-of-war.md), [0024](0024-play-game-hud.md).
