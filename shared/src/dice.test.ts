import { describe, expect, it } from "vitest";
import { advantageExpr, disadvantageExpr, parseExpr, roll } from "./dice.js";

describe("parseExpr", () => {
  it("parses NdM+K", () => {
    expect(parseExpr("2d6+3")).toEqual({
      count: 2,
      sides: 6,
      modifier: 3,
      keep: null,
      keepCount: null,
      expr: "2d6+3",
    });
  });

  it("defaults count to 1", () => {
    expect(parseExpr("d20")).toEqual({
      count: 1,
      sides: 20,
      modifier: 0,
      keep: null,
      keepCount: null,
      expr: "1d20+0",
    });
  });

  it("parses keep highest and lowest", () => {
    expect(parseExpr("2d20kh1")).toEqual({
      count: 2,
      sides: 20,
      modifier: 0,
      keep: "h",
      keepCount: 1,
      expr: "2d20kh1+0",
    });
    expect(parseExpr("2d20kl1+5")).toEqual({
      count: 2,
      sides: 20,
      modifier: 5,
      keep: "l",
      keepCount: 1,
      expr: "2d20kl1+5",
    });
  });

  it("rejects invalid expressions", () => {
    expect(() => parseExpr("fireball")).toThrow(/Invalid dice expression/);
    expect(() => parseExpr("2d20kh3")).toThrow(/Invalid keep count/);
  });
});

describe("advantage helpers", () => {
  it("builds kh/kl expressions", () => {
    expect(advantageExpr()).toBe("2d20kh1");
    expect(advantageExpr(3)).toBe("2d20kh1+3");
    expect(disadvantageExpr(-1)).toBe("2d20kl1-1");
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
    expect(result.kept).toEqual([1, 6]);
    expect(result.total).toBe(10);
  });

  it("keeps the highest die for advantage", () => {
    const values = [0.05, 0.95];
    let index = 0;
    const result = roll("2d20kh1+2", () => {
      const value = values[index] ?? 0;
      index += 1;
      return value;
    });
    expect(result.results).toEqual([2, 20]);
    expect(result.kept).toEqual([20]);
    expect(result.total).toBe(22);
  });

  it("keeps the lowest die for disadvantage", () => {
    const values = [0.05, 0.95];
    let index = 0;
    const result = roll("2d20kl1", () => {
      const value = values[index] ?? 0;
      index += 1;
      return value;
    });
    expect(result.results).toEqual([2, 20]);
    expect(result.kept).toEqual([2]);
    expect(result.total).toBe(2);
  });
});
