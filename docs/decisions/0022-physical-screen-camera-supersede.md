# 0022 — Physical screen mode supersedes ADR 0002 Follow-GM camera (partially)

- **Status:** accepted
- **Date:** 2026-11-12

## Context

ADR 0002 (Phase 1 table-core) decided: *"Follow-GM camera. The player screen follows the GM's view; it does not offer independent pan/zoom in Phase 1."*

Phase 4 (physical screen calibration, `docs/phase-4-offline-screen.md`) requires the opposite for the new `physical` display mode: the screen zoom is **locked** to a calibrated px-per-cell value and must not follow GM zoom; panning must be possible independently (table monitor may be larger than the map).

## Decision

- ADR 0002 point 2 remains valid for the default `fit` screen mode.
- For the `physical` mode (Phase 4), the Follow-GM camera decision is **superseded**: zoom gestures and GM zoom-follow are disabled; **independent pan is allowed**; GM camera follow degrades to gentle panning only (no zoom).
- This is a scoped exception, not a general re-opening of independent screen cameras.

## Consequences

- `useMapScene` / camera code must branch on screen display mode (`fit` vs `physical`).
- The Phase 4 spec documents this interaction; ADR 0002 gains a supersede note pointing here.

## References

- [docs/phase-4-offline-screen.md](../phase-4-offline-screen.md)
- [0002-phase1-table-core.md](0002-phase1-table-core.md)
