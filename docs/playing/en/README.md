# Playing — DMs-only-Friend

How-to for the GM and remote players. Table play (GM laptop + TV/tablet screen) is the primary target; remote players join via links.

> Stub: expand with screenshots and step-by-step flows as the UX settles.

## Roles

| Role | What you see |
|---|---|
| **GM** | Map, tokens, initiative, dice, room links |
| **Player screen** | Full-screen map + tokens; camera follows the GM; initiative banner |
| **Remote player** | Like the player screen, plus control of your own token |

## Phase 1 — what works today

- Create a room from the home page; open the GM link.
- Share the **screen** link for the TV/tablet at the table.
- Share a **player** join link (code + role) for remote players.
- Upload a PNG/JPG map; set grid size (`grid_px`) manually.
- Place and drag tokens; snaps to grid; syncs live over the room.
- Player-screen camera **follows the GM** (no independent pan/zoom).
- Minimal initiative / turn marker.
- Simple dice rolls (`NdM+K`), rolled on the server, visible to everyone.

## Upcoming (not shipped yet)

- **Settings** island for prep: maps, grid, links, PC/NPC roster.
- **Play** mode floating control islands (map control, initiative + next turn, NPCs; snap to corners; persist per room).
- Player screen stays island-free; TCG-style side UI for round/initiative later.

## Quick start (table)

1. Start the app (self-hosted or local `npm run dev`).
2. GM creates a room → open the GM URL.
3. Open the screen URL on the TV/tablet.
4. Upload a map, place tokens, run initiative and dice as needed.
5. Optional: send remote players their join links.

## Related

- German stub: [../de/README.md](../de/README.md)
- Phase 1 spec: [../../phase-1.md](../../phase-1.md)
- Developing: [../../developing/README.md](../../developing/README.md)
