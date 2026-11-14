# 0027 — WebM animated map backgrounds and map packages

- **Status:** accepted
- **Date:** 2026-11-14

## Context

Phase 3 map integration already ships `.dd2vtt` import, LoS fog, doors, and soft lights. AGENTS.md still called for an optional animated WebM background layer and a small map-package manifest that references a base map plus that WebM. Upload whitelist and the 50 MB limit already anticipated video; only the SoT field, package format, and Pixi playback were missing.

## Decision

- Persist optional `maps.animated_filename` and expose `MapState.animatedFilename` (nullable) on snapshots / `map:set` / `maps:updated`.
- Accept optional multipart `animated` (alias `webm`) beside a normal map upload (PNG/JPG/WebP/`.dd2vtt`).
- Accept map packages: `.dmsmap.json` / `.map.json` manifest (`version: 1`, exactly one of `dd2vtt` or `image`, optional `webm` / `name` / `gridPx`) with companion multipart fields `dd2vtt` or `image` and optional `animated`/`webm`. Basenames must match the manifest.
- Client PixiJS v8 loads the WebM via `Assets.load` video options (`loop`, `muted`, `autoPlay`, `playsinline`) as a map-sized sprite above the static image (static kept as fallback if video fails).
- Per-file upload limit remains 50 MB; WebM alone cannot create a map.

## Consequences

- Settings Maps can attach a looping animated layer for table screens without a separate editor.
- Phase 3 leftover (WebM / map packages) is closed; dynamic shadow casting and light editing stay out of scope.
- Older maps without `animated_filename` continue to work (`null`).
