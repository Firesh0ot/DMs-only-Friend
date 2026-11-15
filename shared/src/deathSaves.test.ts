import { describe, expect, it } from "vitest";
import {
  applyDeathSaveRoll,
  deathSavesAfterHpChange,
  emptyDeathSaves,
  enterDying,
  markDead,
} from "./deathSaves.js";

describe("applyDeathSaveRoll", () => {
  it("adds success and stabilizes at 3", () => {
    const first = applyDeathSaveRoll(enterDying(), 12);
    expect(first.deathSaveSuccesses).toBe(1);
    expect(first.outcome).toBe("success");
    const second = applyDeathSaveRoll(first, 15);
    const third = applyDeathSaveRoll(second, 10);
    expect(third.deathState).toBe("stable");
    expect(third.deathSaveSuccesses).toBe(3);
  });

  it("adds fail and dies at 3", () => {
    const first = applyDeathSaveRoll(enterDying(), 5);
    const second = applyDeathSaveRoll(first, 3);
    const third = applyDeathSaveRoll(second, 9);
    expect(third.deathState).toBe("dead");
    expect(third.deathSaveFailures).toBe(3);
  });

  it("handles nat 1 as two failures", () => {
    const result = applyDeathSaveRoll(enterDying(), 1);
    expect(result.deathSaveFailures).toBe(2);
    expect(result.outcome).toBe("critical_fail");
  });

  it("handles nat 20 as regain consciousness", () => {
    const result = applyDeathSaveRoll(enterDying(), 20);
    expect(result.deathState).toBe("ok");
    expect(result.outcome).toBe("critical_success");
  });
});

describe("deathSavesAfterHpChange", () => {
  it("enters dying at 0 HP", () => {
    expect(
      deathSavesAfterHpChange({ ...emptyDeathSaves(), hpCurrent: 8 }, 0),
    ).toEqual(enterDying());
  });

  it("clears death saves when healed above 0", () => {
    expect(
      deathSavesAfterHpChange({ ...enterDying(), hpCurrent: 0 }, 4),
    ).toEqual(emptyDeathSaves());
  });

  it("adds a failure when damaged while dying", () => {
    expect(
      deathSavesAfterHpChange({ ...enterDying(), hpCurrent: 0 }, 0, {
        damageWhileDying: 5,
        hpMax: 20,
      }),
    ).toEqual({ deathState: "dying", deathSaveSuccesses: 0, deathSaveFailures: 1 });
  });

  it("instant death on massive damage while dying", () => {
    expect(
      deathSavesAfterHpChange({ ...enterDying(), hpCurrent: 0 }, 0, {
        damageWhileDying: 20,
        hpMax: 20,
      }),
    ).toEqual(markDead());
  });
});
