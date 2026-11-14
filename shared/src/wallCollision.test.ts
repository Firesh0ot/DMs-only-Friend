import { describe, expect, it } from "vitest";
import {
  closedPortalsToGridSegments,
  moveBlockedByWalls,
  movementBlockerSegments,
  segmentsProperlyIntersect,
  wallPolylinesToGridSegments,
} from "./wallCollision.js";

describe("wallPolylinesToGridSegments", () => {
  it("splits polylines into edge segments and skips zero-length edges", () => {
    const segments = wallPolylinesToGridSegments([
      [
        { x: 0, y: 0 },
        { x: 2, y: 0 },
        { x: 2, y: 2 },
      ],
      [
        { x: 1, y: 1 },
        { x: 1, y: 1 },
      ],
    ]);
    expect(segments).toEqual([
      { a: { x: 0, y: 0 }, b: { x: 2, y: 0 } },
      { a: { x: 2, y: 0 }, b: { x: 2, y: 2 } },
    ]);
  });
});

describe("closedPortalsToGridSegments", () => {
  it("includes only closed portals", () => {
    const segments = closedPortalsToGridSegments([
      {
        closed: true,
        bounds: [
          { x: 1, y: 0 },
          { x: 1, y: 1 },
        ],
      },
      {
        closed: false,
        bounds: [
          { x: 3, y: 0 },
          { x: 3, y: 1 },
        ],
      },
    ]);
    expect(segments).toEqual([{ a: { x: 1, y: 0 }, b: { x: 1, y: 1 } }]);
  });
});

describe("segmentsProperlyIntersect", () => {
  it("detects a proper crossing", () => {
    expect(
      segmentsProperlyIntersect(
        { a: { x: 0, y: 0.5 }, b: { x: 2, y: 0.5 } },
        { a: { x: 1, y: 0 }, b: { x: 1, y: 1 } },
      ),
    ).toBe(true);
  });

  it("ignores shared endpoints and collinear overlap", () => {
    expect(
      segmentsProperlyIntersect(
        { a: { x: 0, y: 0 }, b: { x: 1, y: 0 } },
        { a: { x: 1, y: 0 }, b: { x: 2, y: 0 } },
      ),
    ).toBe(false);
    expect(
      segmentsProperlyIntersect(
        { a: { x: 0, y: 0 }, b: { x: 2, y: 0 } },
        { a: { x: 0.5, y: 0 }, b: { x: 1.5, y: 0 } },
      ),
    ).toBe(false);
  });
});

describe("moveBlockedByWalls", () => {
  const wallBetween = wallPolylinesToGridSegments([
    [
      { x: 1, y: 0 },
      { x: 1, y: 1 },
    ],
  ]);

  it("allows moves that stay on the same side of a wall", () => {
    expect(moveBlockedByWalls({ x: 0, y: 0 }, { x: 0, y: 1 }, wallBetween)).toBe(false);
    expect(moveBlockedByWalls({ x: 2, y: 0 }, { x: 3, y: 0 }, wallBetween)).toBe(false);
  });

  it("blocks a Chebyshev step that crosses a wall edge", () => {
    expect(moveBlockedByWalls({ x: 0, y: 0 }, { x: 1, y: 0 }, wallBetween)).toBe(true);
  });

  it("blocks longer straight moves through walls; open door gaps stay passable", () => {
    const wallWithDoorGap = movementBlockerSegments([
      [
        { x: 2, y: 0 },
        { x: 2, y: 1 },
      ],
      [
        { x: 2, y: 2 },
        { x: 2, y: 3 },
      ],
    ]);
    expect(moveBlockedByWalls({ x: 1, y: 0 }, { x: 2, y: 0 }, wallWithDoorGap)).toBe(true);
    expect(moveBlockedByWalls({ x: 1, y: 1 }, { x: 2, y: 1 }, wallWithDoorGap)).toBe(false);

    const closedDoor = movementBlockerSegments(
      [],
      [
        {
          closed: true,
          bounds: [
            { x: 2, y: 1 },
            { x: 2, y: 2 },
          ],
        },
      ],
    );
    expect(moveBlockedByWalls({ x: 1, y: 1 }, { x: 2, y: 1 }, closedDoor)).toBe(true);
  });

  it("does not block a zero-length move", () => {
    expect(moveBlockedByWalls({ x: 1, y: 1 }, { x: 1, y: 1 }, wallBetween)).toBe(false);
  });
});
