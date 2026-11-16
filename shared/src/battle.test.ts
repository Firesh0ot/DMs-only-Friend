import { describe, expect, it } from "vitest";
import { isBattleActive } from "./battle.js";

describe("isBattleActive", () => {
  it("is false for null or undefined", () => {
    expect(isBattleActive(null)).toBe(false);
    expect(isBattleActive(undefined)).toBe(false);
  });

  it("is true when endedAt is null", () => {
    expect(isBattleActive({ endedAt: null })).toBe(true);
  });

  it("is false when battle has ended", () => {
    expect(isBattleActive({ endedAt: "2026-01-01T00:00:00.000Z" })).toBe(false);
  });
});
