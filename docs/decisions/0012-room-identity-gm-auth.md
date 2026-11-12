# 0012 — Room identity and GM auth

- **Status:** accepted
- **Date:** 2026-11-12

## Context

Phase 1 used random room codes and treated knowing the code (or a forever `?role=gm` link) as enough to become GM. Map and portrait HTTP uploads were likewise code-only. That is fragile once remote links leave the trusted LAN table.

## Decision

- Room codes are **creator-chosen** slugs (3–24 chars after normalization): Unicode letters (incl. German ä/ö/ü/ß), ASCII digits, `_`, `-`. NFC-normalized and stored uppercased (`ß` → `SS`); unique; collisions return 409. Codes stay the URL identity (percent-encoded in path segments); table `name` remains a separate display label.
- Creating a room also sets a **GM PIN** (4–8 digits, hashed at rest).
- First GM claim uses a **single-use invite token** in the GM URL **and** the PIN. Redeeming clears the invite hash and sets `gm_claimed`. Later GM rejoins need the PIN only (no forever public `gmUrl`).
- Reminted invites (home/`gm:mintInvite`) stay optional after the first claim: PIN-only rejoin still works (e.g. after Docker recreate) while a pending invite remains usable for another GM device. Invite is **required** only while the room is unclaimed.
- Lost invite before first claim: `POST /api/rooms/:code/gm-invite` with the PIN mints a new invite. An authenticated GM can also mint via `gm:mintInvite`.
- A joined GM may change the PIN via `gm:changePin` (persists a new hash; optional `invalidateInvites` clears a pending invite). Lost PIN with no active GM session loses the table — no recovery code.
- Screen and player joins stay code-based without PIN.
- `GET /api/rooms/:code/links` returns screen/player URLs, `gmInvitePending`, and `gmInviteRequired` — never a reusable GM URL.
- Map/portrait uploads require a short-lived **upload token** issued when a GM socket join succeeds (`X-Dms-Upload-Token`). Map size limit stays **50 MB**.

## Consequences

- Home and Settings UX must surface custom code, PIN, and one-time GM invite copy; Settings no longer shows a permanent GM link.
- Legacy rooms without `pin_hash` remain joinable as GM without PIN/invite until recreated (migrate columns nullable).
- Upload tests and clients must send the GM upload token after join.
