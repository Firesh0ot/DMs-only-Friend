import { describe, expect, it } from "vitest";
import { applyMove, assignSpawnPoints, chebyshev } from "./movement.js";

describe("chebyshev", () => {
  it("counts diagonal as one cell", () => {
    expect(chebyshev({ x: 0, y: 0 }, { x: 3, y: 3 })).toBe(3);
    expect(chebyshev({ x: 1, y: 1 }, { x: 4, y: 2 })).toBe(3);
  });

  it("returns zero for the same cell", () => {
    expect(chebyshev({ x: 2, y: 5 }, { x: 2, y: 5 })).toBe(0);
  });
});

describe("applyMove", () => {
  it("consumes budget for partial moves", () => {
    const first = applyMove({
      from: { x: 0, y: 0 },
      to: { x: 3, y: 0 },
      remainingCells: 6,
    });
    expect(first).toEqual({ ok: true, distance: 3, remainingCells: 3 });
    const second = applyMove({
      from: { x: 3, y: 0 },
      to: { x: 5, y: 0 },
      remainingCells: 3,
    });
    expect(second).toEqual({ ok: true, distance: 2, remainingCells: 1 });
  });

  it("rejects moves beyond remaining budget", () => {
    const result = applyMove({
      from: { x: 0, y: 0 },
      to: { x: 4, y: 0 },
      remainingCells: 3,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toMatch(/Need 4 cells/);
      expect(result.remainingCells).toBe(3);
    }
  });
});

describe("assignSpawnPoints", () => {
  it("prefers assigned characters then fills free points in order", () => {
    const points = [
      { id: "a", assignedCharacterId: "c2" },
      { id: "b", assignedCharacterId: null },
      { id: "c", assignedCharacterId: null },
      { id: "d", assignedCharacterId: null },
    ];
    const assigned = assignSpawnPoints(points, ["c1", "c2", "c3", "c4", "c5"]);
    expect(assigned.get("c2")?.id).toBe("a");
    expect(assigned.get("c1")?.id).toBe("b");
    expect(assigned.get("c3")?.id).toBe("c");
    expect(assigned.get("c4")?.id).toBe("d");
    expect(assigned.has("c5")).toBe(false);
  });

  it("keeps the first assigned point when duplicates target the same character", () => {
    const points = [
      { id: "a", assignedCharacterId: "c1" },
      { id: "b", assignedCharacterId: "c1" },
      { id: "c", assignedCharacterId: null },
    ];
    const assigned = assignSpawnPoints(points, ["c1", "c2"]);
    expect(assigned.get("c1")?.id).toBe("a");
    expect(assigned.get("c2")?.id).toBe("c");
  });
});
