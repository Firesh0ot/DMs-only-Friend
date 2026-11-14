import { roll } from "./dice.js";
import type { CharacterKind, InitiativeEntry } from "./events.js";

export type InitiativeRollInput = {
  tokenId: string;
  label: string;
  kind?: CharacterKind;
  image?: string | null;
  initiativeBonus: number;
};

export type InitiativeRollDetail = InitiativeEntry & {
  bonus: number;
  die: number;
};

export function compareInitiativeEntries(
  a: { initiative: number; bonus: number; label: string },
  b: { initiative: number; bonus: number; label: string },
): number {
  return b.initiative - a.initiative || b.bonus - a.bonus || a.label.localeCompare(b.label);
}

export function sortInitiativeEntries<T extends { initiative: number; label: string; bonus?: number }>(
  entries: T[],
): T[] {
  return [...entries].sort((a, b) =>
    compareInitiativeEntries(
      { initiative: a.initiative, bonus: a.bonus ?? 0, label: a.label },
      { initiative: b.initiative, bonus: b.bonus ?? 0, label: b.label },
    ),
  );
}

export function rollInitiative(
  entries: InitiativeRollInput[],
  random: () => number = Math.random,
): InitiativeRollDetail[] {
  const rolled = entries.map((entry) => {
    const bonus = Number.isFinite(entry.initiativeBonus) ? Math.trunc(entry.initiativeBonus) : 0;
    const expr = bonus >= 0 ? `1d20+${bonus}` : `1d20${bonus}`;
    const { results, total } = roll(expr, random);
    return {
      tokenId: entry.tokenId,
      label: entry.label,
      initiative: total,
      kind: entry.kind,
      image: entry.image ?? null,
      bonus,
      die: results[0] ?? total - bonus,
    };
  });
  return sortInitiativeEntries(rolled);
}
