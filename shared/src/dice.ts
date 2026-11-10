export type ParsedDice = {
  count: number;
  sides: number;
  modifier: number;
  expr: string;
};

const DICE_RE = /^\s*(\d*)d(\d+)\s*([+-]\s*\d+)?\s*$/i;

export function parseExpr(expr: string): ParsedDice {
  const match = DICE_RE.exec(expr);
  if (!match) {
    throw new Error(`Invalid dice expression: ${expr}`);
  }

  const count = match[1] === "" ? 1 : Number(match[1]);
  const sides = Number(match[2]);
  const modifier = match[3] ? Number(match[3].replace(/\s+/g, "")) : 0;

  if (!Number.isInteger(count) || count < 1 || count > 100) {
    throw new Error(`Invalid dice count: ${count}`);
  }
  if (!Number.isInteger(sides) || sides < 2 || sides > 1000) {
    throw new Error(`Invalid dice sides: ${sides}`);
  }

  return {
    count,
    sides,
    modifier,
    expr: `${count}d${sides}${modifier >= 0 ? `+${modifier}` : `${modifier}`}`,
  };
}

export function roll(
  expr: string,
  random: () => number = Math.random,
): { results: number[]; total: number; parsed: ParsedDice } {
  const parsed = parseExpr(expr);
  const results: number[] = [];
  for (let i = 0; i < parsed.count; i += 1) {
    const value = Math.floor(random() * parsed.sides) + 1;
    results.push(value);
  }
  const total = results.reduce((sum, value) => sum + value, 0) + parsed.modifier;
  return { results, total, parsed };
}
