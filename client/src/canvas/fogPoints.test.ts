import { describe, expect, it } from "vitest";
import { downsamplePoints } from "./fogPoints";

describe("downsamplePoints", () => {
  it("returns empty and single-point inputs unchanged", () => {
    expect(downsamplePoints([], 10)).toEqual([]);
    const only = [{ x: 1, y: 2 }];
    expect(downsamplePoints(only, 10)).toBe(only);
  });

  it("keeps first and last and drops points closer than minDistance", () => {
    const points = [
      { x: 0, y: 0 },
      { x: 3, y: 0 },
      { x: 6, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 1 },
    ];
    expect(downsamplePoints(points, 5)).toEqual([
      { x: 0, y: 0 },
      { x: 6, y: 0 },
      { x: 10, y: 1 },
    ]);
  });

  it("always keeps the final point even when it is close to the last kept point", () => {
    const points = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10.5, y: 0 },
    ];
    expect(downsamplePoints(points, 5)).toEqual([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10.5, y: 0 },
    ]);
  });

  it("keeps all points when every step meets minDistance", () => {
    const points = [
      { x: 0, y: 0 },
      { x: 5, y: 0 },
      { x: 10, y: 0 },
    ];
    expect(downsamplePoints(points, 5)).toEqual(points);
  });

  it("caps output length at 240 while retaining the first point", () => {
    const points = Array.from({ length: 500 }, (_, i) => ({ x: i * 10, y: 0 }));
    const result = downsamplePoints(points, 1);
    expect(result).toHaveLength(240);
    expect(result[0]).toEqual({ x: 0, y: 0 });
    expect(result[239]).toEqual({ x: 2390, y: 0 });
  });
});
