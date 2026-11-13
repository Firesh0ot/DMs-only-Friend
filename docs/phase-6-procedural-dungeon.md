# Phase 6 – KI: Procedural dungeon (minimal slice)

## Ziel

GM kann im Settings/Maps-Bereich einen **prozeduralen Dungeon** erzeugen: BSP-Layout → dd2vtt-kompatible Wand-/Licht-/Bilddaten → normaler Raum-Map-Eintrag (gleiche Pipeline wie Upload).

## Abgrenzung (diese Slice)

- **Drin:** BSP-Räume + Korridore, Wandpolylinien (`line_of_sight`), einfache Raster-PNG, Soft-Lights in Raumzentren, GM-HTTP `POST /api/rooms/:code/map/generate`, Seed für Reproduzierbarkeit.
- **Nicht drin:** WFC, Stable Diffusion/ControlNet-Stilisierung, WebM-Layer, MCP-Tools, Auto-Spawn auf generierter Karte.

## API

`POST /api/rooms/:code/map/generate` (GM upload token):

```json
{ "width": 36, "height": 28, "seed": 42, "gridPx": 70, "name": "Crypt" }
```

Antwort wie Map-Upload (`map`, `maps`) plus `seed` / `roomCount`.

## Abnahme

1. Generate erzeugt eine Map mit `walls.length > 0` und spielbarem Raster.
2. Gleicher Seed → gleiches Layout (Unit-Test).
3. Output ist von `parseDd2vtt` akzeptierbar.
4. `npm run lint && npm run test && npm run build` grün.
