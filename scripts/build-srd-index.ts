import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const API_LIST = "https://www.dnd5eapi.co/api/2014/monsters";
const CONCURRENCY = 8;

function formatChallengeRating(cr: number): string {
  if (cr === 0) {
    return "0";
  }
  if (cr === 0.125) {
    return "1/8";
  }
  if (cr === 0.25) {
    return "1/4";
  }
  if (cr === 0.5) {
    return "1/2";
  }
  if (Number.isInteger(cr)) {
    return String(cr);
  }
  return String(cr);
}

type ListEntry = { index: string; name: string; url: string };
type IndexEntry = {
  index: string;
  name: string;
  cr: string;
  type: string;
  size: string;
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outPath = path.resolve(__dirname, "../server/src/data/srd-monster-index.json");

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
  const entries = await mapPool(list.results, CONCURRENCY, async (entry) => {
    const detail = (await fetchJson(`${API_LIST}/${entry.index}`)) as {
      index: string;
      name: string;
      challenge_rating: number;
      type: string;
      size: string;
    };
    const row: IndexEntry = {
      index: detail.index,
      name: detail.name,
      cr: formatChallengeRating(Number(detail.challenge_rating ?? 0)),
      type: String(detail.type ?? "unknown"),
      size: String(detail.size ?? "Medium"),
    };
    return row;
  });

  entries.sort((a, b) => a.name.localeCompare(b.name));
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(entries, null, 2)}\n`, "utf8");
  console.log(`Wrote ${entries.length} monsters to ${outPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
