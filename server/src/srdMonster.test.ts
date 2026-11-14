import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { openDb } from "./db.js";
import {
  formatStatblockNotes,
  getCachedMonster,
  loadMonsterIndex,
  normalizeMonster,
  resetMonsterIndexCache,
  resolveNormalizedMonster,
  rollMonsterHp,
  searchMonsterIndex,
  sizeToCells,
} from "./srdMonster.js";

const goblinFixture = JSON.parse(
  fs.readFileSync(path.resolve(process.cwd(), "../fixtures/srd-goblin.json"), "utf8"),
) as unknown;

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
});
