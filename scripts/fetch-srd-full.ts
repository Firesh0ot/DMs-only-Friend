import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const API_LIST = "https://www.dnd5eapi.co/api/2014/monsters";
const CONCURRENCY = 6;

type ListEntry = { index: string; name: string; url: string };

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outPath = path.resolve(__dirname, "../server/src/data/srd-monsters-full.json");

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

async function main(): Promise<void> {
  const list = (await fetchJson(API_LIST)) as { results: ListEntry[] };
  const monsters = await mapPool(list.results, CONCURRENCY, async (entry) => {
    return fetchJson(`${API_LIST}/${entry.index}`);
  });

  const byIndex: Record<string, unknown> = {};
  for (const monster of monsters) {
    const index = (monster as { index?: string }).index;
    if (!index) {
      continue;
    }
    byIndex[index] = monster;
  }

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(byIndex)}\n`, "utf8");
  console.log(`Wrote ${Object.keys(byIndex).length} full monsters to ${outPath}`);
  console.log("This file is gitignored; keep it on the LAN host for offline import.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
