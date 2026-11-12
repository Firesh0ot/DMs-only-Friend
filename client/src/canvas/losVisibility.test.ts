import { describe, expect, it } from "vitest";
import type { MapState, TokenState } from "@dms/shared";
import {
  closedPortalSegments,
  mapBoundarySegments,
  mapHasLosGeometry,
  playerVisionPolygons,
  pointInPolygon,
  tokenVisionOrigin,
  visibilityPolygon,
  wallPolylinesToSegments,
} from "./losVisibility";

const map: MapState = {
  id: "map-1",
  roomId: "room-1",
  name: "Tiny",
  filename: "tiny.png",
  width: 280,
  height: 140,
  gridPx: 70,
  offsetX: 0,
  offsetY: 0,
  walls: [
    [
      { x: 0, y: 0 },
      { x: 4, y: 0 },
      { x: 4, y: 2 },
      { x: 0, y: 2 },
      { x: 0, y: 0 },
    ],
    [
      { x: 2, y: 0 },
      { x: 2, y: 2 },
    ],
  ],
  portals: [],
  lights: [],
};

describe("losVisibility", () => {
  it("converts wall polylines to pixel segments", () => {
    const segments = wallPolylinesToSegments(map.walls, map);
    expect(segments.length).toBeGreaterThanOrEqual(5);
    expect(segments.some((segment) => segment.a.x === 140 && segment.b.x === 140)).toBe(true);
  });

  it("builds a visibility polygon blocked by a central wall", () => {
    const segments = [
      ...wallPolylinesToSegments(
        [
          [
            { x: 2, y: 0 },
            { x: 2, y: 2 },
          ],
        ],
        map,
      ),
      ...mapBoundarySegments(map.width, map.height),
    ];
    const origin = { x: 70, y: 70 };
    const polygon = visibilityPolygon(origin, segments, {
      width: map.width,
      height: map.height,
    });
    expect(polygon.length).toBeGreaterThanOrEqual(3);
    expect(pointInPolygon({ x: 40, y: 70 }, polygon)).toBe(true);
    expect(pointInPolygon({ x: 240, y: 70 }, polygon)).toBe(false);
  });

  it("uses player tokens as vision sources", () => {
    const tokens: TokenState[] = [
      {
        id: "t1",
        roomId: "room-1",
        label: "Hero",
        image: null,
        x: 0,
        y: 0,
        sizeCells: 1,
        isPlayer: true,
        mapId: map.id,
        characterId: "c1",
      },
      {
        id: "t2",
        roomId: "room-1",
        label: "Goblin",
        image: null,
        x: 3,
        y: 0,
        sizeCells: 1,
        isPlayer: false,
        mapId: map.id,
        characterId: null,
      },
    ];
    const origin = tokenVisionOrigin(tokens[0]!, map);
    expect(origin).toEqual({ x: 35, y: 35 });

    const polygons = playerVisionPolygons(map, tokens);
    expect(polygons).toHaveLength(1);
    expect(polygons[0]!.length).toBeGreaterThanOrEqual(3);
  });

  it("returns no polygons without walls or portals", () => {
    const bare = { ...map, walls: [], portals: [] };
    expect(mapHasLosGeometry(bare)).toBe(false);
    expect(playerVisionPolygons(bare, [])).toEqual([]);
  });

  it("closed portals block LoS and open portals do not", () => {
    const withDoor: MapState = {
      ...map,
      walls: [
        [
          { x: 2, y: 0 },
          { x: 2, y: 0.75 },
        ],
        [
          { x: 2, y: 1.25 },
          { x: 2, y: 2 },
        ],
      ],
      portals: [
        {
          id: "portal-0",
          bounds: [
            { x: 2, y: 0.75 },
            { x: 2, y: 1.25 },
          ],
          closed: true,
          freestanding: false,
        },
      ],
    };
    const tokens: TokenState[] = [
      {
        id: "t1",
        roomId: "room-1",
        label: "Hero",
        image: null,
        x: 0,
        y: 0,
        sizeCells: 1,
        isPlayer: true,
        mapId: withDoor.id,
        characterId: "c1",
      },
    ];

    expect(closedPortalSegments(withDoor.portals, withDoor)).toHaveLength(1);
    const closedPolygons = playerVisionPolygons(withDoor, tokens);
    expect(closedPolygons).toHaveLength(1);
    expect(pointInPolygon({ x: 40, y: 70 }, closedPolygons[0]!)).toBe(true);
    expect(pointInPolygon({ x: 240, y: 70 }, closedPolygons[0]!)).toBe(false);

    const opened = {
      ...withDoor,
      portals: [{ ...withDoor.portals[0]!, closed: false }],
    };
    expect(closedPortalSegments(opened.portals, opened)).toHaveLength(0);
    const openPolygons = playerVisionPolygons(opened, tokens);
    expect(openPolygons).toHaveLength(1);
    expect(pointInPolygon({ x: 240, y: 70 }, openPolygons[0]!)).toBe(true);
  });
});
