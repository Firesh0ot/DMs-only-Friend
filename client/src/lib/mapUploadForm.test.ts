import { describe, expect, it } from "vitest";
import { appendMapUploadFormData, resolveMapUploadParts } from "./mapUploadForm";

function file(name: string, type = "application/octet-stream"): File {
  return new File([new Uint8Array([1, 2, 3])], name, { type });
}

describe("mapUploadForm", () => {
  it("builds a simple map + optional webm upload", () => {
    const parts = resolveMapUploadParts([file("cave.dd2vtt")], file("cave.webm", "video/webm"));
    expect(parts).toMatchObject({
      map: expect.objectContaining({ name: "cave.dd2vtt" }),
      animated: expect.objectContaining({ name: "cave.webm" }),
    });
  });

  it("assembles a package multi-select", () => {
    const parts = resolveMapUploadParts([
      file("pack.dmsmap.json", "application/json"),
      file("tiny-map-for-unit-tests.dd2vtt"),
      file("tiny-map-for-unit-tests.webm", "video/webm"),
    ], null);
    expect("error" in parts).toBe(false);
    if ("error" in parts) {
      return;
    }
    expect(parts.map.name).toBe("pack.dmsmap.json");
    expect(parts.dd2vtt?.name).toBe("tiny-map-for-unit-tests.dd2vtt");
    expect(parts.animated?.name).toBe("tiny-map-for-unit-tests.webm");

    const body = new FormData();
    appendMapUploadFormData(body, parts, { gridPx: "70", name: "Pack" });
    expect(body.get("name")).toBe("Pack");
    expect(body.get("map")).toBeTruthy();
    expect(body.get("dd2vtt")).toBeTruthy();
    expect(body.get("animated")).toBeTruthy();
  });

  it("rejects webm without a base map", () => {
    const parts = resolveMapUploadParts([], file("only.webm", "video/webm"));
    expect(parts).toEqual({
      error: "Attach WebM together with a base map (png/jpg/webp/.dd2vtt)",
    });
  });
});
