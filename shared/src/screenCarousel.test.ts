import { describe, expect, it } from "vitest";
import {
  carouselFacingDeg,
  clampCarouselPlacement,
  DEFAULT_SCREEN_CAROUSEL,
  SCREEN_CAROUSEL_PRESETS,
} from "./screenCarousel.js";

describe("screenCarousel", () => {
  it("defaults to south edge", () => {
    expect(DEFAULT_SCREEN_CAROUSEL).toEqual(SCREEN_CAROUSEL_PRESETS.south);
  });

  it("clamps placement to the unit square", () => {
    expect(clampCarouselPlacement({ xNorm: -0.2, yNorm: 1.4 })).toEqual({
      xNorm: 0,
      yNorm: 1,
    });
  });

  it("faces upright at south edge (toward center)", () => {
    expect(carouselFacingDeg(SCREEN_CAROUSEL_PRESETS.south)).toBeCloseTo(0, 5);
  });

  it("faces right at west edge", () => {
    expect(carouselFacingDeg(SCREEN_CAROUSEL_PRESETS.west)).toBeCloseTo(90, 5);
  });

  it("faces left at east edge", () => {
    expect(carouselFacingDeg(SCREEN_CAROUSEL_PRESETS.east)).toBeCloseTo(-90, 5);
  });

  it("faces inverted at north edge", () => {
    expect(Math.abs(carouselFacingDeg(SCREEN_CAROUSEL_PRESETS.north))).toBeCloseTo(180, 5);
  });

  it("returns 0 at exact center", () => {
    expect(carouselFacingDeg({ xNorm: 0.5, yNorm: 0.5 })).toBe(0);
  });
});
