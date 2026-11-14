import { describe, expect, it } from "vitest";
import type { MapState, TokenState } from "./events.js";
import { healWallsAroundPortals } from "./wallHeal.js";
import {
  losBlockingSegments,
  playerVisionPolygons,
  pointInPolygon,
  wallPolylinesToSegments,
} from "./losVisibility.js";

const gridPx = 72;

function tavernDividerMap(closedDoor: boolean): MapState {
  return {
    id: "tavern",
    roomId: "room-1",
    name: "Tavern",
    filename: "tavern.png",
    animatedFilename: null,
    width: 50 * gridPx,
    height: 36 * gridPx,
    gridPx,
    offsetX: 0,
    offsetY: 0,
    walls: [
      [
        { x: 6, y: 10 },
        { x: 37, y: 10 },
      ],
      [
        { x: 6, y: 10 },
        { x: 6, y: 27 },
      ],
      [
        { x: 6, y: 27 },
        { x: 37, y: 27 },
      ],
      [
        { x: 37, y: 9 },
        { x: 37, y: 10 },
      ],
      [
        { x: 37, y: 27 },
        { x: 37, y: 30 },
      ],
      [
        { x: 37, y: 9 },
        { x: 41, y: 9 },
      ],
      [
        { x: 41, y: 9 },
        { x: 41, y: 30 },
      ],
      [
        { x: 37, y: 30 },
        { x: 41, y: 30 },
      ],
    ],
    portals: [
      {
        id: "portal-0",
        bounds: [
          { x: 36.92, y: 14.5 },
          { x: 36.92, y: 15.5 },
        ],
        closed: closedDoor,
        freestanding: false,
      },
      {
        id: "portal-1",
        bounds: [
          { x: 36.92, y: 17.9 },
          { x: 36.92, y: 18.9 },
        ],
        closed: true,
        freestanding: false,
      },
    ],
    lights: [],
  };
}

const hero: TokenState = {
  id: "t1",
  roomId: "room-1",
  label: "Hero",
  image: null,
  x: 30,
  y: 15,
  sizeCells: 1,
  isPlayer: true,
  mapId: "tavern",
  characterId: "c1",
};

describe("tavern divider wall vs door LoS", () => {
  it("heals missing interior wall spans around doors", () => {
    const map = tavernDividerMap(true);
    const healed = healWallsAroundPortals(map.walls, map.portals);
    expect(healed.length).toBeGreaterThan(map.walls.length);
    expect(wallPolylinesToSegments(healed, map).length).toBeGreaterThan(
      wallPolylinesToSegments(map.walls, map).length,
    );
  });

  it("blocks LoS through solid walls the same way closed doors do", () => {
    const map = tavernDividerMap(true);
    const polygons = playerVisionPolygons(map, [hero]);
    expect(polygons).toHaveLength(1);
    const polygon = polygons[0]!;

    expect(pointInPolygon({ x: 20 * gridPx, y: 15 * gridPx }, polygon)).toBe(true);
    expect(pointInPolygon({ x: 39 * gridPx, y: 15 * gridPx }, polygon)).toBe(false);
    expect(pointInPolygon({ x: 39 * gridPx, y: 12 * gridPx }, polygon)).toBe(false);
  });

  it("keeps open-door LoS while healed walls still block", () => {
    const map = tavernDividerMap(false);
    const polygons = playerVisionPolygons(map, [hero]);
    expect(polygons).toHaveLength(1);
    const polygon = polygons[0]!;

    expect(pointInPolygon({ x: 39 * gridPx, y: 15 * gridPx }, polygon)).toBe(true);
    expect(pointInPolygon({ x: 39 * gridPx, y: 12 * gridPx }, polygon)).toBe(false);
    expect(losBlockingSegments(map).length).toBeGreaterThan(
      wallPolylinesToSegments(map.walls, map).length,
    );
  });
});
