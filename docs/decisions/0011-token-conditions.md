# 0011 — Character conditions

- **Status:** accepted
- **Date:** 2026-11-11

## Context

Phase 2 calls for conditions on tokens (prone, frightened, and similar). Combat HP and AC already live on `characters`, with tokens linked via `characterId`. Putting a second status model on tokens would diverge from that pattern and break for roster characters that are not yet placed.

## Decision

- Persist conditions as a JSON array on `characters.conditions_json`, exposed as `CharacterState.conditions`.
- Catalog is a small fixed Zod enum in `shared/` (blinded, charmed, frightened, poisoned, prone, restrained, stunned, unconscious). Extending the set means adding an enum value.
- Mutate via GM-only `character:setConditions` (full replace, deduped, catalog order). Broadcast with role-scoped `characters:updated` / snapshot-on-join — conditions are **not** redacted (visible on screen/player).
- GM Play: toggle chips on Initiative (active combatant) and NPCs (selected). Compact short badges on initiative rows, NPC lists, and the screen initiative rail.

## Consequences

- Conditions follow the character across maps; removing a character clears them.
- Map-canvas icons are deferred; island/rail badges are enough for the Phase 2 close-out.
- Unknown ids in stored JSON are dropped on read so older/corrupt rows stay safe.
