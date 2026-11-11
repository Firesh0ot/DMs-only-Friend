import { describe, expect, it } from "vitest";
import { parseExpr, roll } from "./dice.js";

describe("parseExpr", () => {
  it("parses NdM+K", () => {
    expect(parseExpr("2d6+3")).toEqual({
      count: 2,
      sides: 6,
      modifier: 3,
      expr: "2d6+3",
    });
  });

  it("defaults count to 1", () => {
    expect(parseExpr("d20")).toEqual({
      count: 1,
      sides: 20,
      modifier: 0,
      expr: "1d20+0",
    });
  });

  it("rejects invalid expressions", () => {
    expect(() => parseExpr("fireball")).toThrow(/Invalid dice expression/);
  });
});

describe("roll", () => {
  it("rolls deterministically with a stub RNG", () => {
    const values = [0, 0.99];
    let index = 0;
    const result = roll("2d6+3", () => {
      const value = values[index] ?? 0;
      index += 1;
      return value;
    });
    expect(result.results).toEqual([1, 6]);
    expect(result.total).toBe(10);
  });
});
