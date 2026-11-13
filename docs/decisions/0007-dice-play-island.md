# ADR 0007 — Dice in Play HUD

## Status

Accepted (2026-11-11); Play chrome is the game HUD as of [0024](0024-play-game-hud.md).

## Context

Server-side dice (`parseExpr` / `roll`), `dice:roll` / `dice:rolled`, and `dice_log` already exist from Phase 1, but Play mode had no GM UI and rolls were not mirrored into the session event log. Preferences kept dice lower priority than initiative; the session log landed first, then a Dice island, then the compact HUD.

## Decision

- GM Play shows **Dice** on the left HUD (expression input, quick chips, last/recent results) with the same collapse prefs as other HUD sections (see [0024](0024-play-game-hud.md)).
- Rolls stay server-authoritative: clients emit `dice:roll`; the server parses/rolls, writes `dice_log`, broadcasts `dice:rolled`, and appends a `dice_roll` session event for the Log strip / screen strip.
- Screen and remote players get a light **toast** for the latest roll (no Dice HUD).
- No extra persistence beyond existing `dice_log` and the session event row.

## Consequences

- `SessionEventType` gains `dice_roll`.
- Dice lives in the Play HUD, not a dock-rail island.
