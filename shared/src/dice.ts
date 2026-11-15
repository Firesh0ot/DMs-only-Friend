export type KeepMode = "h" | "l";

export type ParsedDice = {
  count: number;
  sides: number;
  modifier: number;
  keep: KeepMode | null;
  keepCount: number | null;
  expr: string;
};

const DICE_RE = /^\s*(\d*)d(\d+)\s*(?:(kh|kl)(\d+))?\s*([+-]\s*\d+)?\s*$/i;

export function parseExpr(expr: string): ParsedDice {
  const match = DICE_RE.exec(expr);
  if (!match) {
    throw new Error(`Invalid dice expression: ${expr}`);
  }

  const count = match[1] === "" ? 1 : Number(match[1]);
  const sides = Number(match[2]);
  const keepRaw = match[3]?.toLowerCase() ?? null;
  const keep: KeepMode | null = keepRaw === "kh" ? "h" : keepRaw === "kl" ? "l" : null;
  const keepCount = match[4] ? Number(match[4]) : null;
  const modifier = match[5] ? Number(match[5].replace(/\s+/g, "")) : 0;

  if (!Number.isInteger(count) || count < 1 || count > 100) {
    throw new Error(`Invalid dice count: ${count}`);
  }
  if (!Number.isInteger(sides) || sides < 2 || sides > 1000) {
    throw new Error(`Invalid dice sides: ${sides}`);
  }
  if (keep !== null) {
    if (!Number.isInteger(keepCount) || keepCount === null || keepCount < 1 || keepCount > count) {
      throw new Error(`Invalid keep count: ${keepCount}`);
    }
  }

  const keepSuffix = keep && keepCount !== null ? `k${keep}${keepCount}` : "";
  const modSuffix = modifier >= 0 ? `+${modifier}` : `${modifier}`;
  return {
    count,
    sides,
    modifier,
    keep,
    keepCount: keep ? keepCount : null,
    expr: `${count}d${sides}${keepSuffix}${modSuffix}`,
  };
}

export function advantageExpr(modifier = 0): string {
  return formatKeepExpr(2, 20, "h", 1, modifier);
}

export function disadvantageExpr(modifier = 0): string {
  return formatKeepExpr(2, 20, "l", 1, modifier);
}

function formatKeepExpr(
  count: number,
  sides: number,
  keep: KeepMode,
  keepCount: number,
  modifier: number,
): string {
  const keepSuffix = `k${keep}${keepCount}`;
  const modSuffix = modifier === 0 ? "" : modifier > 0 ? `+${modifier}` : `${modifier}`;
  return `${count}d${sides}${keepSuffix}${modSuffix}`;
}

export function roll(
  expr: string,
  random: () => number = Math.random,
): { results: number[]; kept: number[]; total: number; parsed: ParsedDice } {
  const parsed = parseExpr(expr);
  const results: number[] = [];
  for (let i = 0; i < parsed.count; i += 1) {
    const value = Math.floor(random() * parsed.sides) + 1;
    results.push(value);
  }
  const kept = selectKept(results, parsed.keep, parsed.keepCount);
  const total = kept.reduce((sum, value) => sum + value, 0) + parsed.modifier;
  return { results, kept, total, parsed };
}

function selectKept(
  results: number[],
  keep: KeepMode | null,
  keepCount: number | null,
): number[] {
  if (keep === null || keepCount === null || keepCount >= results.length) {
    return [...results];
  }
  const sorted = [...results].sort((a, b) => a - b);
  if (keep === "h") {
    return sorted.slice(sorted.length - keepCount);
  }
  return sorted.slice(0, keepCount);
}
