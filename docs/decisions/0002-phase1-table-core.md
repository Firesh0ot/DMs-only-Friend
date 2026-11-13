# 0002 — Phase 1 table-core decisions

- **Status:** accepted
- **Date:** 2026-11-11

## Context

Phase 1 aims at a playable LAN table (GM laptop + TV/tablet screen) without feature-creeping into later phases. Preferences and the Phase 1 spec already pinned several product and architecture choices; this ADR records them in one place.

## Decision

1. **Server is single source of truth.** All gameplay actions are WebSocket events; the server validates and broadcasts to `room:{id}`. Clients may show optimistic updates, then correct from the server.
2. **Follow-GM camera.** The player screen follows the GM’s view; it does not offer independent pan/zoom in Phase 1.
3. **PNG/JPG + manual grid.** Maps are static images with manual `grid_px` (and offsets). No calibration UI yet.
4. **Minimal initiative.** A first playable cut may include a minimal initiative / turn marker. Full Phase-2 tracker (HP, conditions, fog tools) waits.
5. **GM-link auth.** Knowing the room GM link is enough for friends; no GM-secret or account system in Phase 1.
6. **`.dd2vtt` deferred.** Universal VTT import stays for Phase 3 after the PNG + manual-grid table works.

Related product prefs (not re-litigated here): dice/HP are lower priority than turn order for early play; Settings/Play floating islands are a follow-up after the Phase 1 merge, not folded into open leaf PRs; Docker is optional for Phase 1 acceptance.

## Consequences

- Phase 1 scope stays small and shippable: rooms, map upload, tokens, Follow-GM sync, minimal initiative, simple dice.
- Remote players are supported via join links but remain secondary to the LAN table.
- Map fidelity (walls, LOS fog, animated backgrounds) and prep/play island UX land in later work, guided by separate ADRs or phase specs when those milestones close.

## Superseded (partially)

- Point 2 (Follow-GM camera) is superseded for the `physical` screen mode by [ADR 0022](0022-physical-screen-camera-supersede.md): zoom locks to the calibrated physical cell size, independent pan is allowed. The default `fit` mode keeps Follow-GM as decided here.

## References

- [docs/phase-1.md](../phase-1.md)
- [AGENTS.md](../../AGENTS.md)
- Project preferences (Context store)
