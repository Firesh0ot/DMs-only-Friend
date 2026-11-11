import { CONDITION_IDS, type ConditionId } from "@dms/shared";

export const CONDITION_LABELS: Record<ConditionId, string> = {
  blinded: "Blinded",
  charmed: "Charmed",
  frightened: "Frightened",
  poisoned: "Poisoned",
  prone: "Prone",
  restrained: "Restrained",
  stunned: "Stunned",
  unconscious: "Unconscious",
};

export const CONDITION_SHORT: Record<ConditionId, string> = {
  blinded: "BLI",
  charmed: "CHA",
  frightened: "FRI",
  poisoned: "POI",
  prone: "PRN",
  restrained: "RES",
  stunned: "STU",
  unconscious: "UNC",
};

export function toggleCondition(
  current: ConditionId[],
  id: ConditionId,
): ConditionId[] {
  const next = new Set(current);
  if (next.has(id)) {
    next.delete(id);
  } else {
    next.add(id);
  }
  return CONDITION_IDS.filter((entry) => next.has(entry));
}
