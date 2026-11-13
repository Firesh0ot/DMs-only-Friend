import { generateBspDungeon, isFloor, type BspOptions } from "./bsp.js";
import { encodeRgbPng } from "./png.js";
import { extractWallPolylines } from "./walls.js";

export type GeneratedDungeon = {
  dd2vttJson: string;
  imageBuffer: Buffer;
  gridPx: number;
  widthPx: number;
  heightPx: number;
  walls: Array<Array<{ x: number; y: number }>>;
  roomCount: number;
  seed: number;
  mapSizeCells: { x: number; y: number };
};

export type GenerateDungeonInput = {
  width?: number;
  height?: number;
  seed?: number;
  gridPx?: number;
  minLeaf?: number;
  maxLeaf?: number;
};

const FLOOR_RGB = [54, 42, 32] as const;
const WALL_RGB = [18, 14, 12] as const;
const GRID_RGB = [72, 58, 44] as const;

export function generateDungeonDd2vtt(input: GenerateDungeonInput = {}): GeneratedDungeon {
  const gridPx = clamp(input.gridPx ?? 70, 16, 128);
  const seed = (input.seed ?? Date.now()) >>> 0;
  const options: BspOptions = {
    width: input.width ?? 36,
    height: input.height ?? 28,
    minLeaf: input.minLeaf ?? 7,
    maxLeaf: input.maxLeaf ?? 14,
    seed,
  };
  const dungeon = generateBspDungeon(options);
  const walls = extractWallPolylines(dungeon.cells, dungeon.width, dungeon.height);
  const pixels = new Uint8Array(dungeon.width * dungeon.height * gridPx * gridPx * 3);

  for (let cy = 0; cy < dungeon.height; cy += 1) {
    for (let cx = 0; cx < dungeon.width; cx += 1) {
      const floor = isFloor(dungeon.cells, dungeon.width, cx, cy);
      for (let py = 0; py < gridPx; py += 1) {
        for (let px = 0; px < gridPx; px += 1) {
          const x = cx * gridPx + px;
          const y = cy * gridPx + py;
          const i = (y * dungeon.width * gridPx + x) * 3;
          const onGrid = px === 0 || py === 0;
          const color = floor ? (onGrid ? GRID_RGB : FLOOR_RGB) : WALL_RGB;
          pixels[i] = color[0];
          pixels[i + 1] = color[1];
          pixels[i + 2] = color[2];
        }
      }
    }
  }

  const widthPx = dungeon.width * gridPx;
  const heightPx = dungeon.height * gridPx;
  const imageBuffer = encodeRgbPng(widthPx, heightPx, pixels);
  const image = `data:image/png;base64,${imageBuffer.toString("base64")}`;
  const doc = {
    format: 0.2,
    resolution: {
      map_origin: { x: 0, y: 0 },
      map_size: { x: dungeon.width, y: dungeon.height },
      pixels_per_grid: gridPx,
    },
    line_of_sight: walls,
    objects_line_of_sight: [],
    portals: [],
    lights: dungeon.rooms.slice(0, 8).map((room) => ({
      position: {
        x: room.x + room.w / 2,
        y: room.y + room.h / 2,
      },
      range: Math.max(room.w, room.h) * 0.75,
      intensity: 0.55,
      color: "ffd4a574",
      shadows: true,
    })),
    environment: { baked_lighting: false, ambient_light: "0" },
    image,
  };

  return {
    dd2vttJson: JSON.stringify(doc),
    imageBuffer,
    gridPx,
    widthPx,
    heightPx,
    walls,
    roomCount: dungeon.rooms.length,
    seed,
    mapSizeCells: { x: dungeon.width, y: dungeon.height },
  };
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.min(max, Math.max(min, Math.round(value)));
}
