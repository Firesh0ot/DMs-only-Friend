import type { CharacterState } from "@dms/shared";

export function formatHp(character: Pick<CharacterState, "hpCurrent" | "hpMax">): string | null {
  if (character.hpCurrent === null && character.hpMax === null) {
    return null;
  }
  if (character.hpMax === null) {
    return character.hpCurrent === null ? null : String(character.hpCurrent);
  }
  return `${character.hpCurrent ?? "–"}/${character.hpMax}`;
}

export function parseOptionalInt(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const parsed = Number(trimmed);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error("Enter a whole number ≥ 0");
  }
  return parsed;
}
