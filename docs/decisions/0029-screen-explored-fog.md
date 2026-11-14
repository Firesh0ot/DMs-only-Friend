# ADR 0029 — Screen explored fog and hidden NPCs

- **Status:** accepted
- **Date:** 2026-11-14

## Context

Manual fog (ADR 0010) and LoS fog (ADR 0016) already hide the map for Screen/player. Screen used a single opaque cover, so once-seen areas looked the same as never-seen. Oliver asked for two audience layers (VTT-style): solid black for never seen, GM-like grey for explored but not currently visible, and clear for current LoS/manual reveal. NPCs must also be able to move in fog without appearing on Screen.

## Decision

- Persist a per-map **explored cell bitset** on `map_fog.explored_cells` (base64). It is part of `FogState.exploredCells` and travels with snapshots / `fog:updated`.
- Grow explored when cells become currently visible: manual reveal strokes, clear-all reset, LoS enable, PC vision after token moves, and portal toggles that change LoS. Hide strokes do not shrink explored. Cover-all reset clears explored.
- **Currently visible** remains manual-clear ∩ LoS-clear (same OR-of-masks rule as ADR 0016).
- Screen/player fog compositing: unseen → opaque black; explored ∩ covered → grey at GM fog strength (~0.58); currently visible → clear. GM fog stays the existing single translucent overlay (all tokens still visible for prep).
- LoS helpers live in `@dms/shared` so the server can grow explored without trusting the client.
- Screen/player token rendering: show PCs in explored or current visibility; show NPCs only when currently visible. Hidden NPC views are destroyed so moves through black/grey do not flash. GM unchanged.

## Consequences

- Multi-Screen and reconnects share the same explored mask via the server.
- Large maps make full-grid explored growth on every PC move a possible hotspot; cell bitsets stay compact, but vision union may need bounding later.
- Existing rooms start with empty explored until reveals/LoS grow it again (no automatic backfill of historical strokes beyond new paints).
