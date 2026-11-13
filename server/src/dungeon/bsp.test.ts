import { describe, expect, it } from "vitest";
import { generateBspDungeon, isFloor, mulberry32 } from "./bsp.js";
import { extractWallPolylines } from "./walls.js";
import { generateDungeonDd2vtt } from "./toDd2vtt.js";
import { parseDd2vtt } from "../dd2vtt.js";

describe("bsp dungeon", () => {
  it("is deterministic for a fixed seed", () => {
    const a = generateBspDungeon({
      width: 30,
      height: 24,
      minLeaf: 6,
      maxLeaf: 12,
      seed: 42,
    });
    const b = generateBspDungeon({
      width: 30,
      height: 24,
      minLeaf: 6,
      maxLeaf: 12,
      seed: 42,
    });
    expect(Buffer.from(a.cells)).toEqual(Buffer.from(b.cells));
    expect(a.rooms.length).toBeGreaterThan(0);
  });

  it("carves floor and wall polylines", () => {
    const dungeon = generateBspDungeon({
      width: 28,
      height: 22,
      minLeaf: 6,
      maxLeaf: 11,
      seed: 7,
    });
    let floor = 0;
    for (let y = 0; y < dungeon.height; y += 1) {
      for (let x = 0; x < dungeon.width; x += 1) {
        if (isFloor(dungeon.cells, dungeon.width, x, y)) {
          floor += 1;
        }
      }
    }
    expect(floor).toBeGreaterThan(20);
    const walls = extractWallPolylines(dungeon.cells, dungeon.width, dungeon.height);
    expect(walls.length).toBeGreaterThan(0);
    expect(walls.every((line) => line.length >= 2)).toBe(true);
  });

  it("exports dd2vtt that the importer accepts", () => {
    const generated = generateDungeonDd2vtt({
      width: 24,
      height: 20,
      seed: 99,
      gridPx: 32,
    });
    const parsed = parseDd2vtt(generated.dd2vttJson);
    expect(parsed.gridPx).toBe(32);
    expect(parsed.mapSizeCells).toEqual({ x: 24, y: 20 });
    expect(parsed.walls.length).toBeGreaterThan(0);
    expect(parsed.imageExt).toBe(".png");
    expect(parsed.imageBuffer.length).toBeGreaterThan(100);
    expect(parsed.lights.length).toBeGreaterThan(0);
  });

  it("mulberry32 stays in unit interval", () => {
    const random = mulberry32(123);
    for (let i = 0; i < 20; i += 1) {
      const value = random();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});
