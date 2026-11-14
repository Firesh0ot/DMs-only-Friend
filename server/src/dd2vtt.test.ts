import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { isDd2vttUpload, normalizeLightColor, parseDd2vtt } from "./dd2vtt.js";

describe("parseDd2vtt", () => {
  it("extracts image, grid, offsets, and walls from a tiny fixture", () => {
    const fixture = path.resolve(process.cwd(), "../fixtures/tiny-map-for-unit-tests.dd2vtt");
    const parsed = parseDd2vtt(fs.readFileSync(fixture));
    expect(parsed.gridPx).toBe(70);
    expect(parsed.offsetX).toBe(0);
    expect(parsed.offsetY).toBe(0);
    expect(parsed.imageExt).toBe(".png");
    expect(parsed.mime).toBe("image/png");
    expect(parsed.imageBuffer.toString("ascii", 1, 4)).toBe("PNG");
    expect(parsed.walls).toHaveLength(2);
    expect(parsed.walls[0]?.[0]).toEqual({ x: 0, y: 0 });
    expect(parsed.portals).toEqual([]);
    expect(parsed.lights).toHaveLength(1);
    expect(parsed.lights[0]).toMatchObject({
      id: "light-0",
      position: { x: 1, y: 0.5 },
      range: 1.5,
      intensity: 0.8,
      color: "eccd8b",
      shadows: true,
    });
    expect(parsed.mapSizeCells).toEqual({ x: 2, y: 1 });
  });

  it("reads grid, walls, and portals from the dungeon testing fixture", () => {
    const fixture = path.resolve(process.cwd(), "../fixtures/dungeon-map-for-testing.dd2vtt");
    const parsed = parseDd2vtt(fs.readFileSync(fixture));
    expect(parsed.gridPx).toBe(72);
    expect(parsed.walls.length).toBeGreaterThan(0);
    expect(parsed.walls.every((wall) => wall.length >= 2)).toBe(true);
    expect(parsed.portals.length).toBe(5);
    expect(parsed.portals[0]?.id).toBe("portal-0");
    expect(parsed.portals[0]?.closed).toBe(true);
    expect(parsed.portals[0]?.bounds).toHaveLength(2);
    expect(parsed.lights).toEqual([]);
    expect(parsed.imageExt).toBe(".png");
    expect(parsed.mapSizeCells).toEqual({ x: 50, y: 36 });
  });

  it("merges objects_line_of_sight into walls and heals portal gaps", () => {
    const fixture = path.resolve(process.cwd(), "../fixtures/tiny-map-for-unit-tests.dd2vtt");
    const base = JSON.parse(fs.readFileSync(fixture, "utf8")) as Record<string, unknown>;
    const lineOfSight = base.line_of_sight;
    base.line_of_sight = [
      [
        { x: 0, y: 0 },
        { x: 0, y: 0.25 },
      ],
      [
        { x: 0, y: 0.75 },
        { x: 0, y: 1 },
      ],
    ];
    base.objects_line_of_sight = lineOfSight;
    base.portals = [
      {
        bounds: [
          { x: 0, y: 0.25 },
          { x: 0, y: 0.75 },
        ],
        closed: true,
        freestanding: false,
      },
    ];
    const parsed = parseDd2vtt(JSON.stringify(base));
    expect(parsed.portals).toHaveLength(1);
    expect(parsed.walls.length).toBeGreaterThanOrEqual(3);
    expect(
      parsed.walls.some(
        (polyline) =>
          polyline.length >= 2 &&
          polyline.some((point) => point.x === 2 || point.y === 0),
      ),
    ).toBe(true);
  });

  it("rejects malformed JSON", () => {
    expect(() => parseDd2vtt("{nope")).toThrow(/not valid JSON/);
  });
});

describe("normalizeLightColor", () => {
  it("strips UVTT ARGB alpha and accepts RRGGBB", () => {
    expect(normalizeLightColor("ffeccd8b")).toBe("eccd8b");
    expect(normalizeLightColor("#AABBCC")).toBe("aabbcc");
    expect(normalizeLightColor("nope")).toBeNull();
  });
});

describe("isDd2vttUpload", () => {
  it("detects dd2vtt and uvtt extensions", () => {
    expect(isDd2vttUpload({ originalname: "map.dd2vtt", mimetype: "application/json" })).toBe(
      true,
    );
    expect(isDd2vttUpload({ originalname: "map.uvtt", mimetype: "application/octet-stream" })).toBe(
      true,
    );
    expect(isDd2vttUpload({ originalname: "map.png", mimetype: "image/png" })).toBe(false);
  });
});
