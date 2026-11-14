import { describe, expect, it } from "vitest";
import {
  buildTurnSlots,
  fanCardTransform,
  fanOffsetsForOrder,
  prefersReducedMotion,
} from "./carouselMotion";

describe("buildTurnSlots", () => {
  it("places active in the center with unique neighbors", () => {
    const slots = buildTurnSlots(3, 1, ["a", "b", "c"]);
    expect(slots.map((s) => `${s.slot}:${s.tokenId}`)).toEqual([
      "prev:a",
      "next:c",
      "active:b",
    ]);
  });

  it("avoids duplicate token ids when order length is 2", () => {
    const slots = buildTurnSlots(2, 0, ["a", "b"]);
    expect(slots.map((s) => s.tokenId).sort()).toEqual(["a", "b"]);
    expect(slots.find((s) => s.slot === "active")?.tokenId).toBe("a");
    expect(slots.find((s) => s.slot === "prev")?.tokenId).toBe("b");
  });

  it("keeps stable token identity across activeIndex advances", () => {
    const ids = ["a", "b", "c"];
    const before = buildTurnSlots(3, 0, ids);
    const after = buildTurnSlots(3, 1, ids);
    expect(before.find((s) => s.tokenId === "b")?.slot).toBe("next");
    expect(after.find((s) => s.tokenId === "b")?.slot).toBe("active");
    expect(before.find((s) => s.tokenId === "a")?.slot).toBe("active");
    expect(after.find((s) => s.tokenId === "a")?.slot).toBe("prev");
  });
});

describe("fanOffsetsForOrder", () => {
  it("keeps middle offset for the active index and stable indexes across turns", () => {
    const first = fanOffsetsForOrder(3, 0);
    const second = fanOffsetsForOrder(3, 1);
    expect(first.find((c) => c.offset === 0)?.index).toBe(0);
    expect(second.find((c) => c.offset === 0)?.index).toBe(1);
    expect(first.find((c) => c.index === 1)?.offset).toBe(1);
    expect(second.find((c) => c.index === 1)?.offset).toBe(0);
  });
});

describe("fanCardTransform", () => {
  it("centers the active card and angles neighbors", () => {
    expect(fanCardTransform(0).transform).toContain("rotate(0deg)");
    expect(fanCardTransform(0).zIndex).toBe(10);
    expect(fanCardTransform(1).transform).toContain("rotate(14deg)");
    expect(fanCardTransform(-1).transform).toContain("rotate(-14deg)");
  });
});

describe("prefersReducedMotion", () => {
  it("returns a boolean without throwing", () => {
    expect(typeof prefersReducedMotion()).toBe("boolean");
  });
});
