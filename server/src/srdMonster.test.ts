import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { openDb } from "./db.js";
import {
  ensureSrdPortrait,
  extractMonsterImagePath,
  formatStatblockNotes,
  getCachedMonster,
  loadMonsterIndex,
  normalizeMonster,
  resetMonsterIndexCache,
  resolveImportImage,
  resolveNormalizedMonster,
  rollMonsterHp,
  searchMonsterIndex,
  shouldApplySrdPortrait,
  sizeToCells,
  srdPortraitUrl,
} from "./srdMonster.js";

const goblinFixture = JSON.parse(
  fs.readFileSync(path.resolve(process.cwd(), "../fixtures/srd-goblin.json"), "utf8"),
) as unknown;

const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

function pngResponse(body: Buffer = TINY_PNG): Response {
  return {
    ok: true,
    headers: {
      get(name: string) {
        const key = name.toLowerCase();
        if (key === "content-type") {
          return "image/png";
        }
        if (key === "content-length") {
          return String(body.length);
        }
        return null;
      },
    },
    arrayBuffer: async () =>
      body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength),
  } as Response;
}

describe("srdMonster normalize", () => {
  it("normalizes the goblin fixture", () => {
    const monster = normalizeMonster(goblinFixture);
    expect(monster.name).toBe("Goblin");
    expect(monster.cr).toBe("1/4");
    expect(monster.ac).toBe(15);
    expect(monster.hpMax).toBe(7);
    expect(monster.hitDice).toBe("2d6");
    expect(monster.size).toBe("Small");
    expect(sizeToCells(monster.size)).toBe(1);
    expect(monster.attacks.some((attack) => attack.name === "Scimitar")).toBe(true);
    expect(monster.specials.some((special) => special.includes("Nimble Escape"))).toBe(true);
    const notes = formatStatblockNotes(monster);
    expect(notes.length).toBeGreaterThan(40);
    expect(notes.length).toBeLessThanOrEqual(2000);
    expect(notes).toContain("STR 8");
  });
});

describe("srdMonster search", () => {
  it("finds goblin offline from the committed index", () => {
    resetMonsterIndexCache();
    const results = searchMonsterIndex("goblin");
    expect(results.some((entry) => entry.index === "goblin")).toBe(true);
    expect(loadMonsterIndex().length).toBeGreaterThan(300);
  });
});

describe("srdMonster cache + resolve", () => {
  const dirs: string[] = [];

  afterEach(() => {
    for (const dir of dirs.splice(0)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("uses cache on second resolve and skips fetch", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dms-srd-"));
    dirs.push(dir);
    const db = openDb(path.join(dir, "test.sqlite"));
    const fetchImpl = vi.fn(async () => {
      return {
        ok: true,
        json: async () => goblinFixture,
      } as Response;
    });

    const first = await resolveNormalizedMonster(db, "goblin", {
      fetchImpl: fetchImpl as unknown as typeof fetch,
      fullPath: path.join(dir, "missing-full.json"),
    });
    expect(first.fromCache).toBe(false);
    expect(first.source).toBe("api");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(getCachedMonster(db, "goblin")?.name).toBe("Goblin");

    const second = await resolveNormalizedMonster(db, "goblin", {
      fetchImpl: fetchImpl as unknown as typeof fetch,
      fullPath: path.join(dir, "missing-full.json"),
    });
    expect(second.fromCache).toBe(true);
    expect(second.source).toBe("cache");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("falls back to full-file when API fails", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dms-srd-"));
    dirs.push(dir);
    const db = openDb(path.join(dir, "test.sqlite"));
    const fullPath = path.join(dir, "srd-monsters-full.json");
    fs.writeFileSync(fullPath, JSON.stringify({ goblin: goblinFixture }), "utf8");
    const fetchImpl = vi.fn(async () => {
      throw new Error("network down");
    });

    const resolved = await resolveNormalizedMonster(db, "goblin", {
      fetchImpl: fetchImpl as unknown as typeof fetch,
      fullPath,
    });
    expect(resolved.source).toBe("full-file");
    expect(resolved.monster.name).toBe("Goblin");
    expect(fetchImpl).toHaveBeenCalled();
  });

  it("rolls hit dice for goblin HP", () => {
    const hp = rollMonsterHp("2d6", () => 0.999);
    expect(hp).toBe(12);
  });

  it("returns image path from API payload on first resolve", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dms-srd-"));
    dirs.push(dir);
    const db = openDb(path.join(dir, "test.sqlite"));
    const fetchImpl = vi.fn(async () => {
      return {
        ok: true,
        json: async () => goblinFixture,
      } as Response;
    });

    const resolved = await resolveNormalizedMonster(db, "goblin", {
      fetchImpl: fetchImpl as unknown as typeof fetch,
      fullPath: path.join(dir, "missing-full.json"),
    });
    expect(resolved.imagePath).toBe("/api/images/monsters/goblin.png");
    expect(extractMonsterImagePath(goblinFixture)).toBe("/api/images/monsters/goblin.png");
  });
});

describe("srdMonster portraits", () => {
  const dirs: string[] = [];

  afterEach(() => {
    for (const dir of dirs.splice(0)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("fetches and stores portrait when image path is present", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dms-srd-portrait-"));
    dirs.push(dir);
    const uploadsDir = path.join(dir, "uploads");
    const fetchImpl = vi.fn(async () => pngResponse());

    const result = await ensureSrdPortrait("goblin", "/api/images/monsters/goblin.png", {
      uploadsDir,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(result.fetched).toBe(true);
    expect(result.url).toBe("/uploads/srd-goblin.png");
    expect(fs.existsSync(path.join(uploadsDir, "srd-goblin.png"))).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("soft-fails when image path is missing", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dms-srd-portrait-"));
    dirs.push(dir);
    const uploadsDir = path.join(dir, "uploads");
    const fetchImpl = vi.fn(async () => pngResponse());

    const result = await ensureSrdPortrait("goblin", null, {
      uploadsDir,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(result).toEqual({ url: null, fetched: false });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(fs.existsSync(path.join(uploadsDir, "srd-goblin.png"))).toBe(false);
  });

  it("skips portrait fetch on cache hit when file already exists", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dms-srd-portrait-"));
    dirs.push(dir);
    const uploadsDir = path.join(dir, "uploads");
    fs.mkdirSync(uploadsDir, { recursive: true });
    fs.writeFileSync(path.join(uploadsDir, "srd-goblin.png"), TINY_PNG);
    const fetchImpl = vi.fn(async () => pngResponse());

    const result = await ensureSrdPortrait("goblin", "/api/images/monsters/goblin.png", {
      uploadsDir,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(result).toEqual({ url: "/uploads/srd-goblin.png", fetched: false });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("preserves GM portrait and fills empty or srd image on re-import", () => {
    const srdUrl = srdPortraitUrl("goblin");
    expect(shouldApplySrdPortrait(null)).toBe(true);
    expect(shouldApplySrdPortrait(srdUrl)).toBe(true);
    expect(shouldApplySrdPortrait("/uploads/custom-aria.webp")).toBe(false);

    expect(resolveImportImage(null, srdUrl)).toBe(srdUrl);
    expect(resolveImportImage(srdUrl, srdUrl)).toBe(srdUrl);
    expect(resolveImportImage("/uploads/custom-aria.webp", srdUrl)).toBe(
      "/uploads/custom-aria.webp",
    );
    expect(resolveImportImage(null, null)).toBe(null);
  });

  it("soft-fails on portrait timeout without throwing", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dms-srd-portrait-"));
    dirs.push(dir);
    const uploadsDir = path.join(dir, "uploads");
    const fetchImpl = vi.fn(async () => {
      const error = new Error("aborted");
      error.name = "AbortError";
      throw error;
    });

    const result = await ensureSrdPortrait("goblin", "/api/images/monsters/goblin.png", {
      uploadsDir,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(result).toEqual({ url: null, fetched: false });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});
