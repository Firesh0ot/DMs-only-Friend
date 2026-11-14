import type { MonsterSearchResult } from "@dms/shared";
import { roll } from "@dms/shared";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Db } from "./db.js";
import bundledMonsterIndex from "./data/srd-monster-index.json" with { type: "json" };

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const API_BASE = "https://www.dnd5eapi.co/api/2014/monsters";
const FETCH_TIMEOUT_MS = 5000;
const NOTES_MAX = 2000;

export type SrdIndexEntry = {
  index: string;
  name: string;
  cr: string;
  type: string;
  size: string;
};

export type NormalizedMonster = {
  name: string;
  cr: string;
  type: string;
  size: string;
  ac: number;
  hpMax: number;
  hitDice: string;
  speed: string;
  abilities: {
    str: number;
    dex: number;
    con: number;
    int: number;
    wis: number;
    cha: number;
  };
  attacks: Array<{ name: string; toHit: string; damage: string }>;
  specials: string[];
  languages: string;
  senses: string;
};

export type CachedMonsterRow = {
  monster_index: string;
  name: string;
  cr: string;
  type: string;
  size: string;
  statblock_json: string;
  source: string;
  fetched_at: string;
};

type ApiArmorClass = { value?: number };
type ApiDamage = {
  damage_dice?: string;
  damage_type?: { name?: string };
};
type ApiAction = {
  name?: string;
  desc?: string;
  attack_bonus?: number;
  damage?: ApiDamage[];
};
type ApiAbility = { name?: string; desc?: string };
type ApiMonster = {
  index?: string;
  name?: string;
  size?: string;
  type?: string;
  challenge_rating?: number;
  armor_class?: ApiArmorClass[];
  hit_points?: number;
  hit_dice?: string;
  speed?: Record<string, string | undefined>;
  strength?: number;
  dexterity?: number;
  constitution?: number;
  intelligence?: number;
  wisdom?: number;
  charisma?: number;
  languages?: string;
  senses?: Record<string, string | number | undefined>;
  special_abilities?: ApiAbility[];
  actions?: ApiAction[];
  legendary_actions?: ApiAbility[];
  reactions?: ApiAbility[];
};

let indexCache: SrdIndexEntry[] | null = null;

export function resolveSrdDataPath(filename: string): string {
  return path.resolve(__dirname, "data", filename);
}

export function loadMonsterIndex(indexPath?: string): SrdIndexEntry[] {
  if (!indexPath) {
    if (!indexCache) {
      indexCache = bundledMonsterIndex as SrdIndexEntry[];
    }
    return indexCache;
  }
  const raw = fs.readFileSync(indexPath, "utf8");
  const parsed = JSON.parse(raw) as SrdIndexEntry[];
  if (!Array.isArray(parsed)) {
    throw new Error("Invalid SRD monster index");
  }
  return parsed;
}

export function resetMonsterIndexCache(): void {
  indexCache = null;
}

export function formatChallengeRating(cr: number): string {
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

export function sizeToCells(size: string): number {
  switch (size.trim().toLowerCase()) {
    case "tiny":
    case "small":
    case "medium":
      return 1;
    case "large":
      return 2;
    case "huge":
      return 3;
    case "gargantuan":
      return 4;
    default:
      return 1;
  }
}

export function speedToCells(speed: string): number {
  const match = /(\d+)\s*ft/i.exec(speed);
  if (!match) {
    return 6;
  }
  const feet = Number(match[1]);
  if (!Number.isFinite(feet) || feet <= 0) {
    return 6;
  }
  return Math.max(1, Math.min(50, Math.round(feet / 5)));
}

function formatSpeed(speed: Record<string, string | undefined> | undefined): string {
  if (!speed) {
    return "";
  }
  const parts: string[] = [];
  for (const [key, value] of Object.entries(speed)) {
    if (!value) {
      continue;
    }
    if (key === "walk") {
      parts.push(value);
    } else {
      parts.push(`${key} ${value}`);
    }
  }
  return parts.join(", ");
}

function formatSenses(senses: Record<string, string | number | undefined> | undefined): string {
  if (!senses) {
    return "";
  }
  return Object.entries(senses)
    .map(([key, value]) => {
      if (value === undefined || value === null) {
        return null;
      }
      const label = key.replace(/_/g, " ");
      return `${label} ${value}`;
    })
    .filter((part): part is string => Boolean(part))
    .join(", ");
}

function formatAttackDamage(damage: ApiDamage[] | undefined): string {
  if (!damage || damage.length === 0) {
    return "";
  }
  return damage
    .map((entry) => {
      const dice = entry.damage_dice ?? "";
      const type = entry.damage_type?.name?.toLowerCase() ?? "";
      return [dice, type].filter(Boolean).join(" ");
    })
    .filter(Boolean)
    .join("; ");
}

function abilityLine(ability: ApiAbility | undefined): string | null {
  if (!ability?.name) {
    return null;
  }
  if (ability.desc) {
    return `${ability.name}: ${ability.desc}`;
  }
  return ability.name;
}

export function normalizeMonster(raw: unknown): NormalizedMonster {
  const monster = raw as ApiMonster;
  if (!monster || typeof monster !== "object" || !monster.name) {
    throw new Error("Invalid monster payload");
  }

  const attacks: NormalizedMonster["attacks"] = [];
  const specials: string[] = [];

  for (const action of monster.actions ?? []) {
    if (
      typeof action.attack_bonus === "number" &&
      action.name &&
      Array.isArray(action.damage) &&
      action.damage.length > 0
    ) {
      attacks.push({
        name: action.name,
        toHit: `+${action.attack_bonus}`,
        damage: formatAttackDamage(action.damage),
      });
      continue;
    }
    const line = abilityLine(action);
    if (line) {
      specials.push(line);
    }
  }

  for (const ability of monster.special_abilities ?? []) {
    const line = abilityLine(ability);
    if (line) {
      specials.push(line);
    }
  }
  for (const reaction of monster.reactions ?? []) {
    const line = abilityLine(reaction);
    if (line) {
      specials.push(`Reaction — ${line}`);
    }
  }
  for (const legendary of monster.legendary_actions ?? []) {
    const line = abilityLine(legendary);
    if (line) {
      specials.push(`Legendary — ${line}`);
    }
  }

  const ac = monster.armor_class?.[0]?.value;
  const hpMax = monster.hit_points;
  if (typeof ac !== "number" || typeof hpMax !== "number") {
    throw new Error(`Monster ${monster.name} is missing AC or HP`);
  }

  return {
    name: monster.name,
    cr: formatChallengeRating(Number(monster.challenge_rating ?? 0)),
    type: String(monster.type ?? "unknown"),
    size: String(monster.size ?? "Medium"),
    ac,
    hpMax,
    hitDice: String(monster.hit_dice ?? ""),
    speed: formatSpeed(monster.speed),
    abilities: {
      str: Number(monster.strength ?? 10),
      dex: Number(monster.dexterity ?? 10),
      con: Number(monster.constitution ?? 10),
      int: Number(monster.intelligence ?? 10),
      wis: Number(monster.wisdom ?? 10),
      cha: Number(monster.charisma ?? 10),
    },
    attacks,
    specials,
    languages: String(monster.languages ?? ""),
    senses: formatSenses(monster.senses),
  };
}

export function formatStatblockNotes(monster: NormalizedMonster): string {
  const lines: string[] = [];
  lines.push(`${monster.name} · CR ${monster.cr} · ${monster.size} ${monster.type}`);
  lines.push(
    `STR ${monster.abilities.str} DEX ${monster.abilities.dex} CON ${monster.abilities.con} INT ${monster.abilities.int} WIS ${monster.abilities.wis} CHA ${monster.abilities.cha}`,
  );
  lines.push(`AC ${monster.ac} · HP ${monster.hpMax}${monster.hitDice ? ` (${monster.hitDice})` : ""}`);
  if (monster.speed) {
    lines.push(`Speed ${monster.speed}`);
  }
  if (monster.senses) {
    lines.push(`Senses ${monster.senses}`);
  }
  if (monster.languages) {
    lines.push(`Languages ${monster.languages}`);
  }
  if (monster.attacks.length > 0) {
    lines.push("Attacks:");
    for (const attack of monster.attacks) {
      lines.push(`- ${attack.name} ${attack.toHit}, ${attack.damage}`);
    }
  }
  if (monster.specials.length > 0) {
    lines.push("Special:");
    for (const special of monster.specials) {
      lines.push(`- ${special}`);
    }
  }
  const text = lines.join("\n");
  if (text.length <= NOTES_MAX) {
    return text;
  }
  return `${text.slice(0, NOTES_MAX - 1)}…`;
}

export function searchMonsterIndex(
  query: string,
  index: SrdIndexEntry[] = loadMonsterIndex(),
): MonsterSearchResult[] {
  const needle = query.trim().toLowerCase();
  if (!needle) {
    return [];
  }
  const results: MonsterSearchResult[] = [];
  for (const entry of index) {
    if (
      entry.name.toLowerCase().includes(needle) ||
      entry.index.toLowerCase().includes(needle)
    ) {
      results.push({
        index: entry.index,
        name: entry.name,
        cr: entry.cr,
        type: entry.type,
        size: entry.size,
      });
      if (results.length >= 25) {
        break;
      }
    }
  }
  return results;
}

export function getCachedMonster(db: Db, monsterIndex: string): CachedMonsterRow | null {
  const row = db
    .prepare(
      `SELECT monster_index, name, cr, type, size, statblock_json, source, fetched_at
       FROM srd_cache WHERE monster_index = ?`,
    )
    .get(monsterIndex) as CachedMonsterRow | undefined;
  return row ?? null;
}

export function listCachedMonsters(db: Db): Array<{ index: string; name: string; cr: string }> {
  const rows = db
    .prepare(`SELECT monster_index, name, cr FROM srd_cache ORDER BY name COLLATE NOCASE ASC`)
    .all() as Array<{ monster_index: string; name: string; cr: string }>;
  return rows.map((row) => ({
    index: row.monster_index,
    name: row.name,
    cr: row.cr,
  }));
}

export function putCachedMonster(
  db: Db,
  input: {
    monsterIndex: string;
    monster: NormalizedMonster;
    source: "api" | "full-file";
  },
): void {
  db.prepare(
    `INSERT INTO srd_cache (monster_index, name, cr, type, size, statblock_json, source, fetched_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(monster_index) DO UPDATE SET
       name = excluded.name,
       cr = excluded.cr,
       type = excluded.type,
       size = excluded.size,
       statblock_json = excluded.statblock_json,
       source = excluded.source,
       fetched_at = excluded.fetched_at`,
  ).run(
    input.monsterIndex,
    input.monster.name,
    input.monster.cr,
    input.monster.type,
    input.monster.size,
    JSON.stringify(input.monster),
    input.source,
    new Date().toISOString(),
  );
}

export async function fetchMonsterFromApi(
  monsterIndex: string,
  fetchImpl: typeof fetch = fetch,
): Promise<unknown> {
  const url = `${API_BASE}/${encodeURIComponent(monsterIndex)}`;
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
      let response: Response;
      try {
        response = await fetchImpl(url, { signal: controller.signal });
      } finally {
        clearTimeout(timer);
      }
      if (!response.ok) {
        throw new Error(`SRD API returned ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }
  throw new Error(
    lastError?.name === "AbortError"
      ? "SRD API not reachable (timeout)"
      : (lastError?.message ?? "SRD API not reachable"),
  );
}

export function loadMonsterFromFullFile(
  monsterIndex: string,
  fullPath = resolveSrdDataPath("srd-monsters-full.json"),
): unknown | null {
  if (!fs.existsSync(fullPath)) {
    return null;
  }
  const raw = JSON.parse(fs.readFileSync(fullPath, "utf8")) as
    | Record<string, unknown>
    | unknown[];
  if (Array.isArray(raw)) {
    const match = raw.find((entry) => {
      const monster = entry as ApiMonster;
      return monster.index === monsterIndex;
    });
    return match ?? null;
  }
  if (raw && typeof raw === "object" && monsterIndex in raw) {
    return (raw as Record<string, unknown>)[monsterIndex];
  }
  return null;
}

export type ResolveMonsterOptions = {
  fetchImpl?: typeof fetch;
  fullPath?: string;
};

export async function resolveNormalizedMonster(
  db: Db,
  monsterIndex: string,
  options: ResolveMonsterOptions = {},
): Promise<{ monster: NormalizedMonster; fromCache: boolean; source: "api" | "full-file" | "cache" }> {
  const cached = getCachedMonster(db, monsterIndex);
  if (cached) {
    return {
      monster: JSON.parse(cached.statblock_json) as NormalizedMonster,
      fromCache: true,
      source: "cache",
    };
  }

  try {
    const raw = await fetchMonsterFromApi(monsterIndex, options.fetchImpl ?? fetch);
    const monster = normalizeMonster(raw);
    putCachedMonster(db, { monsterIndex, monster, source: "api" });
    return { monster, fromCache: false, source: "api" };
  } catch (error) {
    const full = loadMonsterFromFullFile(monsterIndex, options.fullPath);
    if (full) {
      const monster = normalizeMonster(full);
      putCachedMonster(db, { monsterIndex, monster, source: "full-file" });
      return { monster, fromCache: false, source: "full-file" };
    }
    const message =
      error instanceof Error ? error.message : "SRD API not reachable";
    throw new Error(
      `${message} — install the full dataset (scripts/fetch-srd-full.ts) or try again later`,
    );
  }
}

export function rollMonsterHp(hitDice: string, random: () => number = Math.random): number {
  if (!hitDice.trim()) {
    throw new Error("Monster has no hit dice to roll");
  }
  const result = roll(hitDice, random);
  return Math.max(1, result.total);
}
