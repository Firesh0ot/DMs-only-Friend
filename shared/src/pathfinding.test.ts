import { describe, expect, it } from "vitest";
import { movementBlockerSegments } from "./wallCollision.js";
import { applyMove, clampMoveToBudget } from "./movement.js";
import { pathCostChebyshev, reachableCells } from "./pathfinding.js";

const wallWithDoorGap = [
  [
    { x: 5, y: 0 },
    { x: 5, y: 4 },
  ],
  [
    { x: 5, y: 5 },
    { x: 5, y: 10 },
  ],
];

const openDoorPortals = [
  {
    bounds: [
      { x: 5, y: 4 },
      { x: 5, y: 5 },
    ] as [{ x: number; y: number }, { x: number; y: number }],
    closed: false,
    freestanding: false,
  },
];

const closedDoorPortals = [
  {
    bounds: [
      { x: 5, y: 4 },
      { x: 5, y: 5 },
    ] as [{ x: number; y: number }, { x: number; y: number }],
    closed: true,
    freestanding: false,
  },
];

describe("pathCostChebyshev", () => {
  it("matches chebyshev with no blockers", () => {
    expect(pathCostChebyshev({ x: 0, y: 0 }, { x: 3, y: 2 }, [])).toBe(3);
  });

  it("blocks through walls without a door path", () => {
    const blockers = movementBlockerSegments(wallWithDoorGap, closedDoorPortals);
    expect(pathCostChebyshev({ x: 3, y: 4 }, { x: 7, y: 4 }, blockers, null, 4)).toBeNull();
  });

  it("paths through an open door with chebyshev step cost", () => {
    const blockers = movementBlockerSegments(wallWithDoorGap, openDoorPortals);
    const cost = pathCostChebyshev({ x: 3, y: 4 }, { x: 7, y: 4 }, blockers);
    expect(cost).toBe(4);
  });

  it("treats a closed door as a wall", () => {
    const blockers = movementBlockerSegments(wallWithDoorGap, closedDoorPortals);
    const bounds = { minX: 0, maxX: 10, minY: 0, maxY: 10 };
    expect(pathCostChebyshev({ x: 3, y: 4 }, { x: 7, y: 4 }, blockers, bounds, 6)).toBeNull();
  });
});

describe("reachableCells", () => {
  it("is a chebyshev square without walls", () => {
    const cells = reachableCells({ x: 5, y: 5 }, 1, []);
    expect(cells).toHaveLength(9);
  });

  it("does not include cells behind a closed wall", () => {
    const blockers = movementBlockerSegments(wallWithDoorGap, closedDoorPortals);
    const bounds = { minX: 0, maxX: 10, minY: 0, maxY: 10 };
    const cells = reachableCells({ x: 3, y: 4 }, 4, blockers, bounds);
    expect(cells.some((cell) => cell.x === 7 && cell.y === 4)).toBe(false);
    expect(cells.some((cell) => cell.x === 2 && cell.y === 4)).toBe(true);
  });

  it("includes cells through an open door within path budget", () => {
    const blockers = movementBlockerSegments(wallWithDoorGap, openDoorPortals);
    const cells = reachableCells({ x: 3, y: 4 }, 4, blockers);
    expect(cells.some((cell) => cell.x === 7 && cell.y === 4)).toBe(true);
  });
});

describe("applyMove with blockers", () => {
  it("rejects destinations that require crossing a closed door", () => {
    const blockers = movementBlockerSegments(wallWithDoorGap, closedDoorPortals);
    const result = applyMove({
      from: { x: 3, y: 4 },
      to: { x: 7, y: 4 },
      remainingCells: 6,
      turnStart: { x: 3, y: 4 },
      budgetCells: 6,
      blockers,
      bounds: { minX: 0, maxX: 10, minY: 0, maxY: 10 },
    });
    expect(result.ok).toBe(false);
  });

  it("accepts a door path and consumes path cost", () => {
    const blockers = movementBlockerSegments(wallWithDoorGap, openDoorPortals);
    const result = applyMove({
      from: { x: 3, y: 4 },
      to: { x: 7, y: 4 },
      remainingCells: 6,
      turnStart: { x: 3, y: 4 },
      budgetCells: 6,
      blockers,
    });
    expect(result).toEqual({ ok: true, distance: 4, remainingCells: 2 });
  });
});

describe("clampMoveToBudget with blockers", () => {
  it("clamps to a reachable cell instead of through a wall", () => {
    const blockers = movementBlockerSegments(wallWithDoorGap, closedDoorPortals);
    const clamped = clampMoveToBudget({
      from: { x: 3, y: 4 },
      to: { x: 8, y: 4 },
      remainingCells: 4,
      turnStart: { x: 3, y: 4 },
      budgetCells: 4,
      blockers,
      bounds: { minX: 0, maxX: 10, minY: 0, maxY: 10 },
    });
    expect(clamped.x).toBeLessThan(5);
  });
});
