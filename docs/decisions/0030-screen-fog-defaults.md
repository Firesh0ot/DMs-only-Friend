# ADR 0030 — Screen fog defaults (empty explored, LoS Active)

- **Status:** accepted
- **Date:** 2026-11-14
- **Supersedes (partial):** explored seeding on clear-all in [0029](0029-screen-explored-fog.md); LoS default in [0016](0016-los-fog-from-walls.md)

## Context

After shipping explored Screen fog (ADR 0029), table testing showed a fresh spawn with the whole map grey/visible: clear-all had seeded **all cells explored**, so unvisited rooms looked explored instead of black. Oliver also wants LoS **Active by default** so he disables it deliberately (DOF-96 / DOF-97).

## Decision

- **Explored starts empty** for new maps and after cover-all / clear-all. Clear-all must **not** mark the whole grid explored. Grow explored only from current visibility (LoS and/or manual reveal), so grey appears only after a PC has seen an area and left.
- Maps with wall/portal geometry: default fog is `losEnabled: true`, `baseCovered: false`, `exploredCells: ""` (pure LoS, blank Screen except current vision). PNG/no-geometry maps keep covered fog with LoS off.
- Persist those defaults when a map is added. Zod / snapshot default for `losEnabled` is `true`; missing DB value (`NULL`) reads as on. Explicit `fog:setLos false` stores off and is not overwritten. One-time migrate treats untouched old default-off rows (empty strokes + empty explored) as unset → on, and clears base cover on wall maps.

## Consequences

- New dd2vtt tables: Screen is black outside current LoS without a clear-all click.
- GM who wants fully covered + LoS must cover-all (and optionally keep LoS on for after reveals).
- ADR 0016’s “clear-all + LoS ≈ pure dynamic LoS” remains valid; wall maps now start in that mode.
