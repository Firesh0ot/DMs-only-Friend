import { z } from "zod";

const PointSchema = z.object({
  x: z.number(),
  y: z.number(),
});

const PortalSchema = z.object({
  position: PointSchema.optional(),
  bounds: z.tuple([PointSchema, PointSchema]),
  rotation: z.number().optional(),
  closed: z.boolean().default(true),
  freestanding: z.boolean().default(false),
});

const Dd2vttSchema = z.object({
  format: z.number().optional(),
  resolution: z.object({
    map_origin: PointSchema.optional(),
    map_size: PointSchema,
    pixels_per_grid: z.number().positive(),
  }),
  line_of_sight: z.array(z.array(PointSchema)).default([]),
  portals: z.array(PortalSchema).default([]),
  image: z.string().min(1),
});

export type ParsedPortal = {
  id: string;
  bounds: [{ x: number; y: number }, { x: number; y: number }];
  closed: boolean;
  freestanding: boolean;
};

export type ParsedDd2vtt = {
  imageBuffer: Buffer;
  imageExt: ".png" | ".jpg" | ".webp";
  mime: "image/png" | "image/jpeg" | "image/webp";
  gridPx: number;
  offsetX: number;
  offsetY: number;
  walls: Array<Array<{ x: number; y: number }>>;
  portals: ParsedPortal[];
  mapSizeCells: { x: number; y: number };
};

export function parseDd2vtt(raw: string | Buffer): ParsedDd2vtt {
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(typeof raw === "string" ? raw : raw.toString("utf8"));
  } catch {
    throw new Error("Invalid .dd2vtt: not valid JSON");
  }

  const doc = Dd2vttSchema.parse(parsedJson);
  const gridPx = Math.round(doc.resolution.pixels_per_grid);
  if (!Number.isInteger(gridPx) || gridPx < 8 || gridPx > 512) {
    throw new Error("Invalid .dd2vtt: pixels_per_grid must round to 8–512");
  }

  const origin = doc.resolution.map_origin ?? { x: 0, y: 0 };
  const image = decodeEmbeddedImage(doc.image);
  const walls = doc.line_of_sight
    .map((polyline) => polyline.map((point) => ({ x: point.x, y: point.y })))
    .filter((polyline) => polyline.length >= 2);
  const portals = doc.portals
    .map((portal, index) => {
      const a = portal.bounds[0];
      const b = portal.bounds[1];
      if (a.x === b.x && a.y === b.y) {
        return null;
      }
      return {
        id: `portal-${index}`,
        bounds: [
          { x: a.x, y: a.y },
          { x: b.x, y: b.y },
        ] as [{ x: number; y: number }, { x: number; y: number }],
        closed: portal.closed,
        freestanding: portal.freestanding,
      };
    })
    .filter((portal): portal is ParsedPortal => portal !== null);

  return {
    imageBuffer: image.buffer,
    imageExt: image.ext,
    mime: image.mime,
    gridPx,
    offsetX: Math.round(origin.x * gridPx),
    offsetY: Math.round(origin.y * gridPx),
    walls,
    portals,
    mapSizeCells: {
      x: doc.resolution.map_size.x,
      y: doc.resolution.map_size.y,
    },
  };
}

function decodeEmbeddedImage(image: string): {
  buffer: Buffer;
  ext: ".png" | ".jpg" | ".webp";
  mime: "image/png" | "image/jpeg" | "image/webp";
} {
  const dataUrl = /^data:(image\/(?:png|jpeg|jpg|webp));base64,/i.exec(image);
  const base64 = dataUrl ? image.slice(dataUrl[0].length) : image;
  const buffer = Buffer.from(base64, "base64");
  if (buffer.length < 24) {
    throw new Error("Invalid .dd2vtt: embedded image is empty");
  }

  if (dataUrl) {
    const mimeRaw = dataUrl[1]!.toLowerCase().replace("image/jpg", "image/jpeg");
    if (mimeRaw === "image/png") {
      return { buffer, ext: ".png", mime: "image/png" };
    }
    if (mimeRaw === "image/jpeg") {
      return { buffer, ext: ".jpg", mime: "image/jpeg" };
    }
    if (mimeRaw === "image/webp") {
      return { buffer, ext: ".webp", mime: "image/webp" };
    }
  }

  if (buffer.toString("ascii", 1, 4) === "PNG") {
    return { buffer, ext: ".png", mime: "image/png" };
  }
  if (buffer[0] === 0xff && buffer[1] === 0xd8) {
    return { buffer, ext: ".jpg", mime: "image/jpeg" };
  }
  if (buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP") {
    return { buffer, ext: ".webp", mime: "image/webp" };
  }
  throw new Error("Invalid .dd2vtt: embedded image must be png/jpeg/webp");
}

export function isDd2vttUpload(file: { originalname: string; mimetype: string }): boolean {
  const name = file.originalname.toLowerCase();
  if (name.endsWith(".dd2vtt") || name.endsWith(".uvtt")) {
    return true;
  }
  return false;
}
