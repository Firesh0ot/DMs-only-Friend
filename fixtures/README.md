# Test fixtures

Phase 1 manual testing uses `dungeon-map-for-testing.png` for map upload / grid checks.

`tiny-map-for-unit-tests.png` is a small PNG for automated upload tests.

`tiny-map-for-unit-tests.dd2vtt` is a small Universal VTT file (embedded tiny PNG + sample walls + one light) for parser and upload unit tests.

`dungeon-map-for-testing.dd2vtt` is a full Universal VTT export (embedded image, grid, walls, doors). Use it for manual Settings → Maps import checks.

`tiny-map-for-unit-tests.webm` is a tiny VP8 WebM for automated animated-layer upload tests.

`tiny-map-package-for-unit-tests.dmsmap.json` is a version-1 map package manifest referencing the tiny `.dd2vtt` + `.webm` fixtures.

`dungeon-map-animated-for-testing.webm` is a larger WebM for manual Settings → Maps animated-layer checks (pair with `dungeon-map-for-testing.dd2vtt` or the PNG).
