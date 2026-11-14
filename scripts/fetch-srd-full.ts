import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const API_HOST = "https://www.dnd5eapi.co";
const API_LIST = `${API_HOST}/api/2014/monsters`;
const CONCURRENCY = 6;
const PORTRAIT_MAX_BYTES = 5 * 1024 * 1024;
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

type ListEntry = { index: string; name: string; url: string };
type MonsterPayload = { index?: string; image?: string };

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outPath = path.resolve(__dirname, "../server/src/data/srd-monsters-full.json");
const uploadsDir = path.resolve(__dirname, "../server/uploads");

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${url} → ${response.status}`);
  }
  return response.json();
}

async function mapPool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker(): Promise<void> {
    while (next < items.length) {
      const i = next;
      next += 1;
      results[i] = await fn(items[i]!);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return results;
}

function isPng(buffer: Buffer): boolean {
  return buffer.length >= PNG_MAGIC.length && buffer.subarray(0, PNG_MAGIC.length).equals(PNG_MAGIC);
}

function resolvePortraitUrl(imagePath: string): string {
  if (/^https?:\/\//i.test(imagePath)) {
    return imagePath;
  }
  if (imagePath.startsWith("/")) {
    return `${API_HOST}${imagePath}`;
  }
  return `${API_HOST}/${imagePath}`;
}

async function fetchPortrait(monsterIndex: string, imagePath: string): Promise<"saved" | "skipped" | "failed"> {
  if (!/^[a-z0-9-]+$/i.test(monsterIndex)) {
    return "failed";
  }
  const destPath = path.join(uploadsDir, `srd-${monsterIndex}.png`);
  if (fs.existsSync(destPath)) {
    return "skipped";
  }
  try {
    const response = await fetch(resolvePortraitUrl(imagePath));
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const contentType = response.headers.get("content-type") ?? "";
    if (contentType && !contentType.toLowerCase().includes("image/png")) {
      throw new Error(`unexpected content-type ${contentType}`);
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length === 0 || buffer.length > PORTRAIT_MAX_BYTES || !isPng(buffer)) {
      throw new Error("invalid PNG payload");
    }
    fs.mkdirSync(uploadsDir, { recursive: true });
    fs.writeFileSync(destPath, buffer);
    return "saved";
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`Portrait skip ${monsterIndex}: ${message}`);
    return "failed";
  }
}

async function main(): Promise<void> {
  const withImages = process.argv.includes("--images");
  const list = (await fetchJson(API_LIST)) as { results: ListEntry[] };
  const monsters = await mapPool(list.results, CONCURRENCY, async (entry) => {
    return fetchJson(`${API_LIST}/${entry.index}`);
  });

  const byIndex: Record<string, unknown> = {};
  for (const monster of monsters) {
    const index = (monster as MonsterPayload).index;
    if (!index) {
      continue;
    }
    byIndex[index] = monster;
  }

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(byIndex)}\n`, "utf8");
  console.log(`Wrote ${Object.keys(byIndex).length} full monsters to ${outPath}`);

  if (withImages) {
    const entries = Object.entries(byIndex) as Array<[string, MonsterPayload]>;
    let saved = 0;
    let skipped = 0;
    let failed = 0;
    await mapPool(entries, CONCURRENCY, async ([index, monster]) => {
      const imagePath = typeof monster.image === "string" ? monster.image.trim() : "";
      if (!imagePath) {
        failed += 1;
        return;
      }
      const result = await fetchPortrait(index, imagePath);
      if (result === "saved") {
        saved += 1;
      } else if (result === "skipped") {
        skipped += 1;
      } else {
        failed += 1;
      }
    });
    console.log(
      `Portraits → saved ${saved}, skipped(existing) ${skipped}, missing/failed ${failed} in ${uploadsDir}`,
    );
  } else {
    console.log("Tip: pass --images to also download PNG portraits into server/uploads/srd-*.png");
  }

  console.log("This file is gitignored; keep it on the LAN host for offline import.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
