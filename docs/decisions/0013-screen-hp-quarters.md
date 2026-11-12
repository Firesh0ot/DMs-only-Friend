# 0013 — Screen HP quarter bands

- **Status:** accepted
- **Date:** 2026-11-12
- **Related:** [0009](0009-hp-screen-visibility.md)

## Context

ADR 0009 redacts NPC HP/AC on screen/player while leaving PC HP exact, with no room toggle. Table GMs sometimes want a coarse life bar on the TV without spoiling exact monster or PC numbers.

## Decision

- Add room setting `screenHpQuarters` (SQLite `rooms.screen_hp_quarters`), **default off**, GM-only via `settings:set`, included in the snapshot as `settings`.
- When **off**: keep ADR 0009 behavior (PC exact HP/AC; NPC HP/AC null; `hpQuarter` null).
- When **on**: screen/player snapshots clear exact `hpCurrent`/`hpMax` for PCs and NPCs, set `hpQuarter` to 0–4 (0 / 25 / 50 / 75 / 100%), keep PC AC, keep NPC AC redacted.
- Player-screen UI may render quarter bars from `hpQuarter`; GM views keep exact numbers.

## Consequences

- Clients must prefer `hpQuarter` when present and never invent exact HP from bands.
- Enabling the toggle rebroadcasts role-scoped character lists.
