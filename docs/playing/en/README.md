# Playing — DMs-only-Friend

How-to for the GM and remote players. Table play (GM laptop + TV/tablet screen) is the primary target; remote players join via links.

## Roles

| Role | What you see |
|---|---|
| **GM** | **Settings** for prep; **Play** with a compact game HUD (dice + initiative left, fog right, bottom strip) |
| **Player screen** | Full-screen map + TCG-style initiative rail; compact battle duration / last events; dice toast on rolls; camera follows the GM (or locked physical cell size when calibrated) |
| **Remote player** | Like the player screen, plus control of the token for your **claimed PC** (`characterId`, or unique PC name at join) |

## GM prep (Settings)

1. Create a room from the home page: choose a **room code**, table name, and **GM PIN** (4–8 digits). Room codes are 3–24 characters after normalization: Unicode letters (including German ä/ö/ü and ß), digits, `_`, and `-`. Codes are NFC-normalized and stored uppercased (`ß` becomes `SS`, so `straße` and `strasse` collide). Copy the **single-use GM invite** immediately, then open it and enter the PIN.
2. Upload one or more maps: PNG/JPG/WebP (set `grid_px`) or Universal VTT `.dd2vtt` (grid, walls, doors, and lights come from the file when present). Optionally attach a looping `.webm` animated background, or multi-select a `.dmsmap.json` / `.map.json` package with its base file and WebM. Uploads require a joined GM session. On the GM view, imported walls show as an amber overlay; doors are thicker lines (shut vs open). Soft light glows from the file appear for everyone (no shadow casting yet). Walls come from the file’s vector LoS/portals — painted-only walls without those fields stay visual-only.
3. In Settings → **Room links**, use **Copy** next to Room join / Screen / Player (and a minted GM invite). There is no forever GM URL — mint a new single-use invite from Settings (or home with PIN) if you need another GM device. While a GM session is open, you can **change the GM PIN** there (optionally invalidate a pending invite). If you lose the PIN with no active GM session, the table cannot be recovered — there is no recovery code.
4. Add PCs and NPCs (display name, optional HP/AC, short notes, portrait); tick which maps each character appears on.
5. Optional **Screen** setting: show quarter HP bars (25/50/75/100%) on the player screen — default off (exact PC HP; monsters hidden). Set **cm per cell** for table miniatures (physical size mode); leave empty to keep it off. Use **Open calibration on screens** to launch the ruler/auto wizard on connected table screens.
6. Switch to **Play** when the session starts. Portraits and HP chips appear on initiative cards when set.

## GM play

Compact **game HUD** around the map (not floating islands):

- **Left — Dice** — expressions such as `2d6+3` (or quick chips), server rolls, last/recent totals. Results broadcast into the session log.
- **Left — Initiative** — round, active combatant, **Next**, set order (expand), ±1 HP and conditions on the active combatant. **Show PCs / Show NPCs** live here (display strategy for the board). Removing a token or character drops them from the order automatically.
- **Right — Fog** — compact vertical icon rail (brush / rect, size −/+, reveal/hide, cover/clear eyes, LoS rays; door icons when present). Click a door on the map with the tool **off** (hand) as well. Fog is translucent for you and solid for screen/players.
- **Bottom strip** — battle **Start** / **End** and timer; **Next turn**; **Log** (collapsed by default); **More** for a compact active-map switch. Map upload/grid and NPC roster prep stay in **Settings**.

Collapse section titles to free map space. Collapse prefs are remembered per room code in the browser; older island/dock layouts are cleared.

Changing the active map brings in characters linked to that map (and drops the others). Tokens snap to grid and sync live. Camera pan/zoom on the GM side is followed by screen and players. Fog is stored per map. The first **Next** turn also starts a battle if none is active.

## Screen / player

No GM HUD. Use the side rail for round, turn order, and whose turn it is. By default PC hit points may appear as exact chips and **monster HP stays GM-only**. If the GM enables quarter HP bars, the rail shows coarse 25/50/75/100% bands for PCs and NPCs without exact numbers. Compact condition badges (e.g. PRN, FRI) show when the GM applies them. A small strip shows battle elapsed time and the latest events when present. Dice rolls flash briefly as a toast over the map. By default the screen follows the GM’s pan/zoom (**fit**). When the GM sets a physical cell size, the table screen can switch to **physical** mode (confirm in the top bar): zoom locks so one cell matches that cm size after device calibration (auto estimate or ruler). Pan stays independent; GM zoom-follow pauses. Calibration is stored in this browser only. Unrevealed map areas stay under solid fog (including tokens in those areas).

## Look & lantern

The UI uses a medieval tavern theme. Use the **lantern** control (Home, Settings, Play, and Screen) to switch between candlelit cozy and a darker smoky dungeon look. Candlelit mode soft-flickers warm light across the whole page (chrome and HUD included); the smoky dungeon stays calm. The choice is remembered in this browser. Theme fonts ship with the app, so the look works on LAN / offline without a Google Fonts connection.

## Quick start (table)

1. Start the app (self-hosted or local `npm run dev`).
2. GM creates a room (code + PIN) → open the single-use GM invite and enter the PIN.
3. Open the screen URL on the TV/tablet (code only; no PIN).
4. In Settings: upload maps, set roster links; then Play.
5. Optional: send remote players join links with `characterId` (or a unique PC `name`) so they claim that roster PC. Rejoin as GM later with code + PIN (works even if a reminted invite is still pending — the invite URL is only required for the **first** GM claim). Keep the PIN somewhere safe while you are not joined as GM.

### Self-host / join links

For a LAN or home-server table, pull `ghcr.io/firesh0ot/dms-only-friend` and run compose (default host port **8042**). Copy `.env.example` to `.env` and set `PUBLIC_ORIGIN` to the URL everyone opens in the browser (LAN IP with port, or your public HTTPS origin behind a reverse proxy). Invite and API-built room links use that origin; screen/player Copy links in Settings follow the browser’s current origin, so open the GM UI at the same public URL you share.

Optional Traefik labels (`TRAEFIK_ENABLE` / `FQDN`) attach to an existing Traefik — TLS stays on your proxy. The proxy must allow WebSocket / HTTP `Upgrade` for Socket.IO; if the UI hangs on **Joining room…**, that is usually the cause. Details: [Developing — Docker / table deploy](../../developing/README.md#docker--table-deploy), [behind your reverse proxy](../../developing/README.md#behind-your-reverse-proxy), and [WebSockets required](../../developing/README.md#websockets-required-joining-room).

## Related

- German: [../de/README.md](../de/README.md)
- Phase 1 spec: [../../phase-1.md](../../phase-1.md)
- Prep/Play ADR: [../../decisions/0003-prep-play-ux.md](../../decisions/0003-prep-play-ux.md)
- Play game HUD ADR: [../../decisions/0024-play-game-hud.md](../../decisions/0024-play-game-hud.md)
- Session log ADR: [../../decisions/0004-session-battle-log.md](../../decisions/0004-session-battle-log.md)
- Tavern theme ADR: [../../decisions/0005-tavern-theme-lantern.md](../../decisions/0005-tavern-theme-lantern.md)
- Page-wide candlelit flicker ADR: [../../decisions/0019-page-wide-candlelit-flicker.md](../../decisions/0019-page-wide-candlelit-flicker.md)
- Dice HUD ADR: [../../decisions/0007-dice-play-island.md](../../decisions/0007-dice-play-island.md)
- dd2vtt import ADR: [../../decisions/0008-dd2vtt-map-import.md](../../decisions/0008-dd2vtt-map-import.md)
- WebM map packages ADR: [../../decisions/0027-webm-map-packages.md](../../decisions/0027-webm-map-packages.md)
- HP visibility ADR: [../../decisions/0009-hp-screen-visibility.md](../../decisions/0009-hp-screen-visibility.md)
- Manual fog ADR: [../../decisions/0010-manual-fog-of-war.md](../../decisions/0010-manual-fog-of-war.md)
- LoS fog ADR: [../../decisions/0016-los-fog-from-walls.md](../../decisions/0016-los-fog-from-walls.md)
- UVTT walls + path movement ADR: [../../decisions/0028-uvtt-walls-and-path-movement.md](../../decisions/0028-uvtt-walls-and-path-movement.md)
- Conditions ADR: [../../decisions/0011-token-conditions.md](../../decisions/0011-token-conditions.md)
- Room / GM auth ADR: [../../decisions/0012-room-identity-gm-auth.md](../../decisions/0012-room-identity-gm-auth.md)
- Screen HP quarters ADR: [../../decisions/0013-screen-hp-quarters.md](../../decisions/0013-screen-hp-quarters.md)
- Physical screen camera ADR: [../../decisions/0022-physical-screen-camera-supersede.md](../../decisions/0022-physical-screen-camera-supersede.md)
- Phase 4 offline screen: [../../phase-4-offline-screen.md](../../phase-4-offline-screen.md)
- Player token bind ADR: [../../decisions/0014-player-token-character-bind.md](../../decisions/0014-player-token-character-bind.md)
- Docker / GHCR ADR: [../../decisions/0015-docker-ghcr-packaging.md](../../decisions/0015-docker-ghcr-packaging.md)
- Developing: [../../developing/README.md](../../developing/README.md)
