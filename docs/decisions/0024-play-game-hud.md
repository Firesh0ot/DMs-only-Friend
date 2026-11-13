# ADR 0024 — Play game-style HUD

- **Status:** accepted
- **Date:** 2026-11-13
- **Supersedes:** [0020](0020-play-island-dock-rails.md) (dock rails / floating islands)

## Context

Dock-rail islands (#46 / ADR 0020) stopped overlap, but six tall plaques still ate map space and felt slow at the table (large buttons, prep controls mixed into Play). Preferences (2026-11-13) ask for one compact game-style interaction HUD: bottom strip for frequent actions; left dice + initiative (with PC/NPC display strategy); right Fog of War; map/NPC prep in Settings.

## Decision

- Replace Play dock-rail islands with a fixed **Play HUD** over the map (tavern plaque chrome, denser controls, collapse for secondary UI).
- **Left:** Dice and Initiative. PC/NPC show-hide lives on the Initiative section (not a Map island).
- **Right:** Fog tools as a compact vertical **icon rail** (round Photoshop-style buttons: brush/rect, size −/+, reveal/hide glyphs, eye cover/clear, LoS rays, door icons).
- **Bottom:** Battle Start/End, Next turn, Log toggle, More overflow (active-map switch + pointer to Settings for NPC/map prep).
- Persist only light collapse prefs per room: `dms-play-hud:v1:{code}`. Clear obsolete `dms-islands:` / `dms-islands:v2:` keys on load/save.
- Player/screen UI unchanged (no GM HUD; TCG rail + session strip + dice toast).

## Consequences

- ADR [0003](0003-prep-play-ux.md) Play surface is a HUD, not floating islands.
- ADR [0020](0020-play-island-dock-rails.md) is superseded; rail dock chrome and island reorder are retired.
- Dice / fog / log docs describe HUD sections instead of islands.
- No server/schema change; visibility, fog, dice, and initiative stay socket-driven.
