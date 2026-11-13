# ADR 0004 — Session / battle event log

## Status

Accepted (2026-11-11)

## Context

After Prep/Play split, the table still lacks a shared sense of “what happened” and how long a fight lasted. Preferences call for a session/battle log; replay/video remain out of scope.

## Decision

- Server is source of truth: append-only `session_events` in SQLite, optionally tagged with a `battles` row.
- Meaningful play events are logged with ISO timestamps: map change, throttled token moves, initiative set / next turn, round advance, PC/NPC visibility, battle start/end.
- Battle duration: GM can **Start** / **End** from the Play HUD bottom strip. If no battle is active, the first **initiative Next** auto-starts one; GM still ends it.
- Snapshot on join includes recent `eventLog` plus the active `battle` (or `null`).
- GM Play shows Log on the HUD bottom (collapsed by default); see [0024](0024-play-game-hud.md). Screen/player get a compact duration / last-events strip beside the initiative rail.

## Consequences

- New socket events: `battle:start`, `battle:end`, `log:appended`, `battle:updated`.
- Token move spam is throttled server-side (~3s per token).
- Full replay, fog, `.dd2vtt`, and dice UI stay out of this cut (dice remain on the separate `dice_log` table).
