import type { BattleState } from "./events.js";

export function isBattleActive(
  battle: Pick<BattleState, "endedAt"> | null | undefined,
): boolean {
  return Boolean(battle && battle.endedAt == null);
}
