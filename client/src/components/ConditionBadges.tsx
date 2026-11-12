import type { ConditionId } from "@dms/shared";
import { CONDITION_LABELS, CONDITION_SHORT } from "../lib/conditions";

type Props = {
  conditions: ConditionId[];
  compact?: boolean;
};

export function ConditionBadges({ conditions, compact = false }: Props) {
  if (conditions.length === 0) {
    return null;
  }

  return (
    <span className={compact ? "condition-badges condition-badges--compact" : "condition-badges"}>
      {conditions.map((id) => (
        <span
          key={id}
          className="condition-badge"
          data-condition={id}
          title={CONDITION_LABELS[id]}
        >
          {compact ? CONDITION_SHORT[id] : CONDITION_LABELS[id]}
        </span>
      ))}
    </span>
  );
}
