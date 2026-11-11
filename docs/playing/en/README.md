# Playing — DMs-only-Friend

How-to for the GM and remote players. Table play (GM laptop + TV/tablet screen) is the primary target; remote players join via links.

## Roles

| Role | What you see |
|---|---|
| **GM** | **Settings** for prep; **Play** with floating islands (Map, Initiative, NPCs, Log) |
| **Player screen** | Full-screen map + TCG-style initiative rail; compact battle duration / last events; camera follows the GM |
| **Remote player** | Like the player screen, plus control of your own token (label = your name) |

## GM prep (Settings)

1. Create a room from the home page and open the GM link.
2. Upload one or more maps; set each map’s `grid_px`.
3. Copy Screen / Player links for the table.
4. Add PCs and NPCs; tick which maps each character appears on.
5. Switch to **Play** when the session starts.

## GM play

Floating islands around the map:

- **Map** — change active map; show/hide PCs or NPCs as groups.
- **Initiative** — enter scores, set order, next turn (round advances when the order wraps).
- **NPCs** — spawn or place roster NPCs on the current map.
- **Log** — recent session events and battle timer; **Start** / **End** battle. The first **Next** turn also starts a battle if none is active.

Use **Snap** on an island to cycle corners. Positions are remembered for this room in the browser.

Changing the active map brings in characters linked to that map (and drops the others). Tokens snap to grid and sync live. Camera pan/zoom on the GM side is followed by screen and players.

## Screen / player

No GM islands. Use the side rail for round, turn order, and whose turn it is. A small strip shows battle elapsed time and the latest events when present. Follow the GM’s pan/zoom.

## Quick start (table)

1. Start the app (self-hosted or local `npm run dev`).
2. GM creates a room → open the GM URL.
3. Open the screen URL on the TV/tablet.
4. In Settings: upload maps, set roster links; then Play.
5. Optional: send remote players their join links.

## Related

- German: [../de/README.md](../de/README.md)
- Phase 1 spec: [../../phase-1.md](../../phase-1.md)
- Prep/Play ADR: [../../decisions/0003-prep-play-ux.md](../../decisions/0003-prep-play-ux.md)
- Session log ADR: [../../decisions/0004-session-battle-log.md](../../decisions/0004-session-battle-log.md)
- Developing: [../../developing/README.md](../../developing/README.md)
