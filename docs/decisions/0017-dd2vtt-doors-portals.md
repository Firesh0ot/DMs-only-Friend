# ADR 0017 — dd2vtt doors / portals and LoS

- **Status:** accepted
- **Date:** 2026-11-12

## Context

Universal VTT maps expose `portals` (doors) as two-point `bounds` segments with a `closed` flag. Wall polylines leave gaps at those segments. Automatic LoS fog (ADR 0016) already blocks on walls; without portals, closed doors look open to vision.

## Decision

- Parse `portals` on `.dd2vtt` import; persist `maps.portals_json` and include `portals` on `MapState`.
- Closed portals are LoS blockers (same ray cast as walls). Open portals are ignored by LoS.
- GM-only `portal:setClosed` toggles state; server broadcasts `maps:updated` / `map:set`. Initial `closed` comes from the file.
- GM sees amber walls plus door overlays (shut vs open). Click a door on the map (fog tool Off) or use Fog island door buttons.
- LoS enable requires walls **or** portals. Lights, WebM packages, and animated door art stay out of scope.

## Consequences

- Token moves and door toggles refresh LoS on clients from map state; no separate fog paint for doors.
- Freestanding portals use the same open/closed LoS rule.
- Supersedes the “portals out of scope” note in ADR 0016 for this slice only.
