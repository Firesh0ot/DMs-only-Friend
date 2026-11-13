# 0021 — Roadmap reordering: insert Offline/Online experience phases before KI and MCP

- **Status:** accepted
- **Date:** 2026-11-12

## Context

The original roadmap ran Phase 4 = KI map generation, Phase 5 = MCP. Two needs emerged from actual play planning that rank higher than KI/MCP:

1. A monitor lying flat on the table must render the grid at a **fixed physical size** (cm per cell), so miniatures and rulers match the screen.
2. Online play needs **spawn points per map** and a **server-enforced movement budget** during a player's turn.

## Decision

- Insert **Phase 4 – Offline-Spielerfahrung** (physical screen calibration, `docs/phase-4-offline-screen.md`) and **Phase 5 – Online-Spielerfahrung** (spawn points + movement budget, `docs/phase-5-online-movement.md`).
- Shift KI to **Phase 6** and MCP to **Phase 7**. All existing references to "Phase 4 = KI" / "Phase 5 = MCP" in README and AGENTS are updated to the new numbering.

## Consequences

- Phase numbering in docs is now: 1 Tisch-Kern, 2 DM-Werkzeuge, 3 Map-Integration, 4 Offline-Spielerfahrung, 5 Online-Spielerfahrung, 6 KI, 7 MCP.
- No code impact; documentation-only change.

## References

- [docs/phase-4-offline-screen.md](../phase-4-offline-screen.md)
- [docs/phase-5-online-movement.md](../phase-5-online-movement.md)
