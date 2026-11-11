# 0012 — Room identity and GM auth

- **Status:** accepted
- **Date:** 2026-11-12

## Context

Phase 1 used random room codes and treated knowing the code (or a forever `?role=gm` link) as enough to become GM. Map and portrait HTTP uploads were likewise code-only. That is fragile once remote links leave the trusted LAN table.

## Decision

- Room codes are **creator-chosen** slugs (3–24 chars, letters/digits/`_`/`-`), stored uppercased, unique; collisions return 409.
- Creating a room also sets a **GM PIN** (4–8 digits, hashed at rest).
- First GM claim uses a **single-use invite token** in the GM URL **and** the PIN. Redeeming clears the invite hash. Later GM rejoins need the PIN only (no forever public `gmUrl`).
- Lost invite before redeem: `POST /api/rooms/:code/gm-invite` with the PIN mints a new invite. An authenticated GM can also mint via `gm:mintInvite`.
- Screen and player joins stay code-based without PIN.
- `GET /api/rooms/:code/links` returns screen/player URLs and `gmInvitePending` only — never a reusable GM URL.
- Map/portrait uploads require a short-lived **upload token** issued when a GM socket join succeeds (`X-Dms-Upload-Token`). Map size limit stays **50 MB**.

## Consequences

- Home and Settings UX must surface custom code, PIN, and one-time GM invite copy; Settings no longer shows a permanent GM link.
- Legacy rooms without `pin_hash` remain joinable as GM without PIN/invite until recreated (migrate columns nullable).
- Upload tests and clients must send the GM upload token after join.
