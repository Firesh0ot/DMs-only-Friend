import { describe, expect, it } from "vitest";
import {
  basenamesMatch,
  isMapPackageUpload,
  isWebmUpload,
  parseMapPackageManifest,
} from "./mapPackage.js";

describe("mapPackage", () => {
  it("parses a dd2vtt + webm package manifest", () => {
    const manifest = parseMapPackageManifest(
      JSON.stringify({
        version: 1,
        name: "Animated crypt",
        dd2vtt: "crypt.dd2vtt",
        webm: "crypt.webm",
      }),
    );
    expect(manifest.dd2vtt).toBe("crypt.dd2vtt");
    expect(manifest.webm).toBe("crypt.webm");
    expect(manifest.name).toBe("Animated crypt");
  });

  it("parses an image package with gridPx", () => {
    const manifest = parseMapPackageManifest(
      JSON.stringify({
        version: 1,
        image: "floor.png",
        gridPx: 70,
      }),
    );
    expect(manifest.image).toBe("floor.png");
    expect(manifest.gridPx).toBe(70);
  });

  it("rejects manifests missing both dd2vtt and image", () => {
    expect(() => parseMapPackageManifest(JSON.stringify({ version: 1, webm: "a.webm" }))).toThrow(
      /exactly one of dd2vtt or image/,
    );
  });

  it("rejects manifests with both dd2vtt and image", () => {
    expect(() =>
      parseMapPackageManifest(
        JSON.stringify({ version: 1, dd2vtt: "a.dd2vtt", image: "a.png" }),
      ),
    ).toThrow(/exactly one of dd2vtt or image/);
  });

  it("detects upload kinds by name and mime", () => {
    expect(isMapPackageUpload({ originalname: "pack.dmsmap.json", mimetype: "application/json" })).toBe(
      true,
    );
    expect(isWebmUpload({ originalname: "layer.webm", mimetype: "application/octet-stream" })).toBe(
      true,
    );
    expect(basenamesMatch("maps/crypt.webm", "crypt.webm")).toBe(true);
    expect(basenamesMatch("crypt.webm", "other.webm")).toBe(false);
  });
});
