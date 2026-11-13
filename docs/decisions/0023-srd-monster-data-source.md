# 0023 — SRD 5.1 as the only monster data source (CC-BY-4.0, on-demand + cache)

- **Status:** accepted
- **Date:** 2026-11-12

## Context

The DM should be able to import D&D 5e monsters as NPCs. Full monster content from WotC products (Monster Manual, Volo's, Mordenkainen's) is not licensed for reproduction. The 5.1 System Reference Document is available under CC-BY-4.0 and covers ~330 common monsters. Embedding the entire dataset (~15 MB) is unnecessary: the fetch can happen once per monster at import time, and imported NPCs persist as regular characters.

## Decision

1. **Only SRD 5.1 (CC-BY-4.0)** content may be imported, via dnd5eapi.co (5e-bits, open source) as primary source. No 5e.tools, no D&D Beyond, no WotC product content beyond the SRD.
2. **On-demand, server-side fetch**: the server fetches a monster's statblock exactly once per monster on first import, normalizes it into our own format, and caches it in `srd_cache`. Imported monsters become ordinary `characters` rows — no further API dependency afterwards.
3. **Offline by design**: a small metadata index file (names/CR/type only, committed to the repo) keeps search working offline; an optional full-dataset file (`scripts/fetch-srd-full.ts`, not committed) covers full offline import if the API ever disappears.
4. **Attribution is mandatory**: Settings/About must state "D&D 5e SRD 5.1, © Wizards of the Coast, CC-BY-4.0, data via dnd5eapi.co".

## Consequences

- The table keeps working offline after session prep; only first-time imports need connectivity.
- Homebrew/non-SRD monsters are out of scope for this feature (separate follow-up) to avoid any licensing grey zone.
- If dnd5eapi.co disappears, the committed index plus the downloadable full file keep the feature alive.

## References

- [docs/srd-monster-library.md](../srd-monster-library.md)
- https://www.dnd5eapi.co/
