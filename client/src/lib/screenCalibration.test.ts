import { describe, expect, it } from "vitest";
import {
  cssPxPerCell,
  devicePpi,
  followGmPanOnly,
  physicalZoom,
  pxPerCmFromAuto,
  pxPerCmFromRuler,
} from "./screenCalibration";

describe("screenCalibration", () => {
  it("computes device ppi from diagonal and resolution", () => {
    const ppi = devicePpi(1920, 1080, 24);
    expect(ppi).toBeCloseTo(91.79, 1);
  });

  it("converts auto calibration to CSS px per cm with devicePixelRatio", () => {
    const pxPerCm = pxPerCmFromAuto(1920, 1080, 24, 2);
    expect(pxPerCm).toBeCloseTo(devicePpi(1920, 1080, 24) / (2.54 * 2), 5);
  });

  it("derives pxPerCm from a ruler drag in CSS pixels", () => {
    expect(pxPerCmFromRuler(378, 10)).toBeCloseTo(37.8, 5);
  });

  it("computes target zoom so one cell matches physical size", () => {
    const zoom = physicalZoom(37.8, 3, 70);
    expect(cssPxPerCell(37.8, 3)).toBeCloseTo(113.4, 5);
    expect(zoom).toBeCloseTo(113.4 / 70, 5);
  });

  it("follows GM pan while locking zoom in physical mode", () => {
    const next = followGmPanOnly({ x: 100, y: 40, zoom: 2 }, 1.5, 800, 600);
    expect(next.zoom).toBe(1.5);
    const worldCx = (800 / 2 - 100) / 2;
    const worldCy = (600 / 2 - 40) / 2;
    expect(next.x).toBeCloseTo(800 / 2 - worldCx * 1.5, 5);
    expect(next.y).toBeCloseTo(600 / 2 - worldCy * 1.5, 5);
  });
});
