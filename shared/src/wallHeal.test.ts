import { describe, expect, it } from "vitest";
import { healWallsAroundPortals, mergeWallPolylines } from "./wallHeal.js";

describe("mergeWallPolylines", () => {
  it("concatenates line_of_sight and objects_line_of_sight polylines", () => {
    const merged = mergeWallPolylines(
      [
        [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
        ],
      ],
      [
        [
          { x: 2, y: 2 },
          { x: 3, y: 2 },
        ],
        [{ x: 4, y: 4 }],
      ],
    );
    expect(merged).toHaveLength(2);
    expect(merged[1]?.[0]).toEqual({ x: 2, y: 2 });
  });
});

describe("healWallsAroundPortals", () => {
  it("fills missing wall spans around collinear non-freestanding portals", () => {
    const walls = [
      [
        { x: 37, y: 9 },
        { x: 37, y: 10 },
      ],
      [
        { x: 37, y: 27 },
        { x: 37, y: 30 },
      ],
    ];
    const portals = [
      {
        freestanding: false,
        bounds: [
          { x: 36.92, y: 14.5 },
          { x: 36.92, y: 15.5 },
        ] as [{ x: number; y: number }, { x: number; y: number }],
      },
      {
        freestanding: false,
        bounds: [
          { x: 36.92, y: 17.9 },
          { x: 36.92, y: 18.9 },
        ] as [{ x: number; y: number }, { x: number; y: number }],
      },
    ];

    const healed = healWallsAroundPortals(walls, portals);
    const vertical = healed.filter(
      (polyline) =>
        polyline.length === 2 &&
        polyline[0] &&
        polyline[1] &&
        Math.abs(polyline[0].x - 37) < 1e-6 &&
        Math.abs(polyline[1].x - 37) < 1e-6,
    );

    expect(
      vertical.some(
        (polyline) =>
          Math.abs(polyline[0]!.y - 10) < 1e-6 && Math.abs(polyline[1]!.y - 14.5) < 1e-6,
      ),
    ).toBe(true);
    expect(
      vertical.some(
        (polyline) =>
          Math.abs(polyline[0]!.y - 15.5) < 1e-6 && Math.abs(polyline[1]!.y - 17.9) < 1e-6,
      ),
    ).toBe(true);
    expect(
      vertical.some(
        (polyline) =>
          Math.abs(polyline[0]!.y - 18.9) < 1e-6 && Math.abs(polyline[1]!.y - 27) < 1e-6,
      ),
    ).toBe(true);
  });

  it("does not invent walls for freestanding portals alone", () => {
    const walls = [
      [
        { x: 0, y: 0 },
        { x: 0, y: 1 },
      ],
    ];
    const portals = [
      {
        freestanding: true,
        bounds: [
          { x: 5, y: 5 },
          { x: 5, y: 6 },
        ] as [{ x: number; y: number }, { x: number; y: number }],
      },
    ];
    expect(healWallsAroundPortals(walls, portals)).toHaveLength(1);
  });

  it("keeps existing complete wall-and-door lines unchanged", () => {
    const walls = [
      [
        { x: 0, y: 2 },
        { x: 1, y: 2 },
      ],
      [
        { x: 2, y: 2 },
        { x: 3, y: 2 },
      ],
    ];
    const portals = [
      {
        freestanding: false,
        bounds: [
          { x: 1, y: 2 },
          { x: 2, y: 2 },
        ] as [{ x: number; y: number }, { x: number; y: number }],
      },
    ];
    expect(healWallsAroundPortals(walls, portals)).toHaveLength(2);
  });

  it("synthesizes partition walls for non-freestanding portals between perpendicular walls", () => {
    const walls = [
      [
        { x: 37, y: 9 },
        { x: 37, y: 30 },
      ],
      [
        { x: 41, y: 9 },
        { x: 41, y: 30 },
      ],
      [
        { x: 37, y: 9 },
        { x: 41, y: 9 },
      ],
      [
        { x: 37, y: 30 },
        { x: 41, y: 30 },
      ],
    ];
    const portals = [
      {
        freestanding: false,
        bounds: [
          { x: 37.33, y: 24.22 },
          { x: 38.33, y: 24.22 },
        ] as [{ x: number; y: number }, { x: number; y: number }],
      },
    ];

    const healed = healWallsAroundPortals(walls, portals);
    const horizontal = healed.filter(
      (polyline) =>
        polyline.length === 2 &&
        polyline[0] &&
        polyline[1] &&
        Math.abs(polyline[0].y - 24.22) < 1e-6 &&
        Math.abs(polyline[1].y - 24.22) < 1e-6,
    );

    expect(
      horizontal.some(
        (polyline) =>
          Math.min(polyline[0]!.x, polyline[1]!.x) <= 37 + 1e-6 &&
          Math.max(polyline[0]!.x, polyline[1]!.x) >= 37.33 - 1e-6,
      ),
    ).toBe(true);
    expect(
      horizontal.some(
        (polyline) =>
          Math.min(polyline[0]!.x, polyline[1]!.x) <= 38.33 + 1e-6 &&
          Math.max(polyline[0]!.x, polyline[1]!.x) >= 41 - 1e-6,
      ),
    ).toBe(true);
  });

  it("does not invent walls when a portal has no perpendicular brackets", () => {
    const walls = [
      [
        { x: 0, y: 0 },
        { x: 0, y: 1 },
      ],
    ];
    const portals = [
      {
        freestanding: false,
        bounds: [
          { x: 10, y: 10 },
          { x: 11, y: 10 },
        ] as [{ x: number; y: number }, { x: number; y: number }],
      },
    ];
    expect(healWallsAroundPortals(walls, portals)).toHaveLength(1);
  });
});
