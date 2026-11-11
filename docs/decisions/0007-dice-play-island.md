# ADR 0007 — Dice Play island

## Status

Accepted (2026-11-11)

## Context

Server-side dice (`parseExpr` / `roll`), `dice:roll` / `dice:rolled`, and `dice_log` already exist from Phase 1, but Play mode had no GM UI and rolls were not mirrored into the session event log. Preferences kept dice lower priority than initiative; islands and the session log landed first.

## Decision

- GM Play gets a **Dice** island (expression input, quick chips, last/recent results) using the same corner-snap + per-room `localStorage` layout as other islands.
- Rolls stay server-authoritative: clients emit `dice:roll`; the server parses/rolls, writes `dice_log`, broadcasts `dice:rolled`, and appends a `dice_roll` session event for the Log island / screen strip.
- Screen and remote players get a light **toast** for the latest roll (no Dice island).
- No extra persistence beyond existing `dice_log` and the session event row.

## Consequences

- `SessionEventType` gains `dice_roll`.
- Five Play islands share four corners; overlapping docks are resolved by **Snap**.
- Fog, HP tracking, and `.dd2vtt` remain out of this cut.
