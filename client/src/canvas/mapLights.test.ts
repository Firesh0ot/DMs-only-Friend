import { describe, expect, it } from "vitest";
import type { LightState, MapState } from "@dms/shared";
import { lightTintFromColor, lightWorldPosition, softLightAlpha } from "./mapLights";

const map: MapState = {
  id: "map-1",
  roomId: "room-1",
  name: "Tiny",
  filename: "tiny.png",
  animatedFilename: null,
  width: 140,
  height: 70,
  gridPx: 70,
  offsetX: 0,
  offsetY: 0,
  walls: [],
  portals: [],
  lights: [],
};

const light: LightState = {
  id: "light-0",
  position: { x: 1, y: 0.5 },
  range: 1.5,
  intensity: 0.8,
  color: "eccd8b",
  shadows: true,
};

describe("mapLights", () => {
  it("parses RRGGBB tint and soft alpha", () => {
    expect(lightTintFromColor("eccd8b")).toBe(0xeccd8b);
    expect(lightTintFromColor("bad")).toBe(0xfff1c1);
    expect(softLightAlpha(0.8)).toBeCloseTo(0.44);
    expect(softLightAlpha(2)).toBe(0.72);
  });

  it("places lights in map pixel space", () => {
    const placed = lightWorldPosition(light, map);
    expect(placed.x).toBe(70);
    expect(placed.y).toBe(35);
    expect(placed.diameter).toBe(210);
  });
});
