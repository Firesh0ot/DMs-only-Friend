import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  SCREEN_CAROUSEL_INVERT_KEY,
  carouselFacingWithInvert,
  readScreenCarouselInvert,
  writeScreenCarouselInvert,
} from "./screenCarouselInvert";

describe("screenCarouselInvert", () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("defaults to facing center (not inverted)", () => {
    expect(readScreenCarouselInvert()).toBe(false);
  });

  it("persists invert in localStorage", () => {
    writeScreenCarouselInvert(true);
    expect(localStorage.getItem(SCREEN_CAROUSEL_INVERT_KEY)).toBe("1");
    expect(readScreenCarouselInvert()).toBe(true);
    writeScreenCarouselInvert(false);
    expect(readScreenCarouselInvert()).toBe(false);
  });

  it("adds 180deg when inverted", () => {
    expect(carouselFacingWithInvert(-90, false)).toBe(-90);
    expect(carouselFacingWithInvert(-90, true)).toBe(90);
    expect(carouselFacingWithInvert(0, true)).toBe(180);
  });
});
