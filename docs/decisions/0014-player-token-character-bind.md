# 0014 — Player token ownership by character id

- **Status:** accepted
- **Date:** 2026-11-12
- **Related:** [0002](0002-phase1-table-core.md), [0006](0006-character-portraits-notes.md)

## Context

Remote players could move a token when `token.isPlayer` and `token.label` matched the join `name`. Renames, duplicate labels, and free-floating player tokens made that check fragile. Tokens already carry `characterId` from the roster.

## Decision

- A `player` session must **claim** a PC at join: `characterId` on `room:join`, or a unique PC `name` that resolves to one roster PC.
- The session stores that `characterId`; the snapshot exposes it (plus `playerName` from the claimed PC for dice/UI).
- `token:move` allows a player only when `token.characterId === session.characterId`. GM may move any token; screen may move none.
- Claims are exclusive among connected player sessions for the same character; disconnect frees the claim.
- Label string equality is not used for ownership.

## Consequences

- Player join links should include `characterId` (preferred) or a unique PC `name`.
- Tokens without `characterId` are not player-movable (GM still can).
- No SQLite migration: binding lives on the in-memory session; `tokens.character_id` already exists.
