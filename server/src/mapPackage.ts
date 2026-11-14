import { MapPackageManifestSchema, type MapPackageManifest } from "@dms/shared";
import path from "node:path";

export function parseMapPackageManifest(raw: string | Buffer): MapPackageManifest {
  let parsed: unknown;
  try {
    parsed = JSON.parse(typeof raw === "string" ? raw : raw.toString("utf8"));
  } catch {
    throw new Error("Invalid map package: JSON parse failed");
  }
  const result = MapPackageManifestSchema.safeParse(parsed);
  if (!result.success) {
    const detail = result.error.issues[0]?.message ?? "invalid manifest";
    throw new Error(`Invalid map package: ${detail}`);
  }
  return result.data;
}

export function isMapPackageUpload(file: { originalname: string; mimetype: string }): boolean {
  const name = file.originalname.toLowerCase();
  return name.endsWith(".dmsmap.json") || name.endsWith(".map.json");
}

export function isWebmUpload(file: { originalname: string; mimetype: string }): boolean {
  const name = file.originalname.toLowerCase();
  return name.endsWith(".webm") || file.mimetype === "video/webm";
}

export function isAllowedImageUpload(file: { originalname: string; mimetype: string }): boolean {
  if (["image/png", "image/jpeg", "image/webp"].includes(file.mimetype)) {
    return true;
  }
  const name = file.originalname.toLowerCase();
  return /\.(png|jpe?g|webp)$/.test(name);
}

export function basenamesMatch(expected: string, actualOriginalName: string): boolean {
  return path.basename(expected).toLowerCase() === path.basename(actualOriginalName).toLowerCase();
}
