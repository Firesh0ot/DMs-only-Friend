# 0009 — HP and monster stats on screen

- **Status:** accepted
- **Date:** 2026-11-11

## Context

Phase 2 needs current/max HP, optional AC, and short stat notes on PC/NPC characters. The player screen (TV/tablet) and remote players share the character snapshot. Showing monster HP on that surface spoils combat; GMs still need full numbers at the table.

## Decision

- Persist `hpCurrent`, `hpMax`, and `ac` on `characters` (nullable). Reuse `notes` for short stat notes.
- Adjust HP in Play via `character:setHp` (absolute or delta), GM-only. Settings upserts set baseline stats.
- **Default visibility:** GM always receives full stats. Screen and remote players receive PC HP/AC; **NPC/monster HP and AC are redacted** (null) in snapshots and `characters:updated` payloads. Notes stay visible.
- Room toggle for coarse screen HP bands is defined in [0013](0013-screen-hp-quarters.md) (default still off = this redaction).

## Consequences

- Clients must treat missing NPC HP as intentional, not “unset.”
- Broadcasts of character lists are role-scoped per socket.
- Initiative rail shows HP chips only when values are present (PCs on screen; all combatants for the GM).
