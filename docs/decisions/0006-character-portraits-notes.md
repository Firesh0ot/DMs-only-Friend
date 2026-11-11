# 0006 — Character portraits and notes

- **Status:** accepted
- **Date:** 2026-11-11

## Context

Settings needed clearer PC/NPC prep and initiative cards that show who is acting. Characters already had an optional `image` field; GMs needed an upload path, short notes, and Settings accessibility improvements.

## Decision

- Persist optional `notes` on `characters` (max 500 via Zod).
- Portrait upload: `POST /api/rooms/:code/characters/:characterId/portrait` (png/jpg/webp, 5 MB). Stored as `/uploads/<file>` on `characters.image` and copied to linked tokens.
- Refresh initiative order portraits when a character image changes.
- Settings groups: Maps → Characters (PC/NPC) → Room links, with labeled controls and visible focus rings.

## Consequences

- Snapshot `characters` includes `notes`.
- Screen TCG rail and GM initiative island show portraits (or initials placeholder).
- Map uploads remain 50 MB; portraits stay smaller.
