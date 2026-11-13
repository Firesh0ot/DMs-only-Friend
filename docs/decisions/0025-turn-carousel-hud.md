# 0025 — Turn carousel HUD and system-agnostic turn model

- **Status:** proposed
- **Relates to:** [0024](0024-play-game-hud.md) (Play game-style HUD)
- **Date:** 2026-11-13

## Context

Turn order today is a flat list with a next button; the DM wants a game-table-feel HUD: the active character as a large card in the center, initiative neighbours as partially visible rotated cards left and right, rotating on turn change — identical on GM view, player views, and the offline table monitor. Initiative must work both online (server rolls) and offline (physical dice, GM enters values). Phase 5 (spec'd in docs/phase-5-online-movement.md, not yet shipped) will add a server-enforced movement budget; the carousel must not depend on it.

## Decision

0. **Layout (option A):** the carousel replaces the left Initiative section of the Play HUD (ADR 0024) on GM view and the TCG rail content on player/screen views. Dice stays left, bottom bar and fog rail are untouched. PC/NPC visibility toggles move into the carousel header (GM only).
1. **One shared component, role-driven visibility.** A single `TurnCarousel` component renders on GM, player, and screen views; props (`role`, `selfCharacterId`) decide which controls exist. No per-role layout forks.
2. **Initiative: two equal paths, one state.** `initiative:roll` (server rolls `1d20 + initiativeBonus`) and the existing manual `initiative:set` (offline dice) both produce the same `InitiativeState`. New `characters.initiative_bonus` column; SRD import fills it from DEX modifier.
3. **System-agnostic turn model.** Per active turn the server tracks `movementRemaining` (**stubbed until Phase 5 ships** – optional field, disabled Move control), plus `actionUsed` and `bonusUsed` toggles. The app never defines what an "action" is — the flags are memory aids, GM can reset them. No reactions/legendary mechanics in this slice.
4. **End-Turn auth.** `initiative:next` stays one event: GM always; a player may end only their own active turn (session `characterId` must match the active entry).
5. **Carousel layout.** Center: full active card (portrait, name, initiative badge, HP bar with quarters on screen per `screenHpQuarters`, AC, conditions, controls: Move/Aktion/Bonus/End Turn). Left/right: rotated (~±8°), partially cut neighbour cards showing only portrait strip, name, and HP. ~300 ms slide animation on turn change.

## Consequences

- The HUD works for any system (5e, Pathfinder) because turn semantics stay in the flags, not in the app.
- `InitiativeState` gains optional turn fields — backward compatible.
- End Turn is just `initiative:next`; no separate turn-end event.

## References

- [docs/play-hud-initiative.md](../play-hud-initiative.md)
- [0024-play-game-hud.md](0024-play-game-hud.md)
- [0013-screen-hp-quarters.md](0013-screen-hp-quarters.md)
- [0021-roadmap-reorder-offline-online.md](0021-roadmap-reorder-offline-online.md)
