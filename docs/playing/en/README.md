# Playing — DMs-only-Friend

How-to for the GM and remote players. Table play (GM laptop + TV/tablet screen) is the primary target; remote players join via links.

## Roles

| Role | What you see |
|---|---|
| **GM** | **Settings** for prep; **Play** with floating islands (Map, Initiative, NPCs, Log, Dice, Fog) |
| **Player screen** | Full-screen map + TCG-style initiative rail; compact battle duration / last events; dice toast on rolls; camera follows the GM |
| **Remote player** | Like the player screen, plus control of your own token (label = your name) |

## GM prep (Settings)

1. Create a room from the home page and open the GM link.
2. Upload one or more maps: PNG/JPG/WebP (set `grid_px`) or Universal VTT `.dd2vtt` (grid and walls come from the file). On the GM view, imported walls show as an amber overlay.
3. Copy Screen / Player links for the table.
4. Add PCs and NPCs (display name, optional HP/AC, short notes, portrait); tick which maps each character appears on.
5. Switch to **Play** when the session starts. Portraits and HP chips appear on initiative cards when set.

## GM play

Floating islands around the map:

- **Map** — change active map; show/hide PCs or NPCs as groups.
- **Initiative** — enter scores, set order, next turn (round advances when the order wraps). Compact HP on cards; ±1 on the active combatant when linked to a character.
- **NPCs** — spawn or place roster NPCs; select one to adjust HP (−5/−1/+1/+5) and see AC/notes.
- **Log** — recent session events and battle timer; **Start** / **End** battle. The first **Next** turn also starts a battle if none is active.
- **Dice** — enter expressions such as `2d6+3` (or use quick chips), roll on the server, see totals and recent rolls. Results are broadcast and appear in the session log.
- **Fog** — brush or rectangle to **Reveal** / **Hide** areas; **Cover all** / **Clear all**. New maps start fully covered. Fog is translucent for you and solid for screen/players. Turn the tool **Off** to pan and move tokens again.

Use **Snap** on an island to cycle corners. Positions are remembered for this room in the browser.

Changing the active map brings in characters linked to that map (and drops the others). Tokens snap to grid and sync live. Camera pan/zoom on the GM side is followed by screen and players. Fog is stored per map.

## Screen / player

No GM islands. Use the side rail for round, turn order, and whose turn it is. PC hit points may appear on initiative cards; **monster HP stays GM-only** by default. A small strip shows battle elapsed time and the latest events when present. Dice rolls flash briefly as a toast over the map. Follow the GM’s pan/zoom. Unrevealed map areas stay under solid fog (including tokens in those areas).

## Look & lantern

The UI uses a medieval tavern theme. Use the **lantern** control (Home, Settings, Play, and Screen) to switch between candlelit cozy and a darker smoky dungeon look. The choice is remembered in this browser.

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
- Tavern theme ADR: [../../decisions/0005-tavern-theme-lantern.md](../../decisions/0005-tavern-theme-lantern.md)
- Dice island ADR: [../../decisions/0007-dice-play-island.md](../../decisions/0007-dice-play-island.md)
- dd2vtt import ADR: [../../decisions/0008-dd2vtt-map-import.md](../../decisions/0008-dd2vtt-map-import.md)
- HP visibility ADR: [../../decisions/0009-hp-screen-visibility.md](../../decisions/0009-hp-screen-visibility.md)
- Manual fog ADR: [../../decisions/0010-manual-fog-of-war.md](../../decisions/0010-manual-fog-of-war.md)
- Developing: [../../developing/README.md](../../developing/README.md)
