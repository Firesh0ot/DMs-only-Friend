import { CONDITION_IDS, ClientEvents, type ConditionId } from "@dms/shared";
import { CONDITION_LABELS, toggleCondition } from "../lib/conditions";
import { getSocket } from "../socket/socket";

type Props = {
  characterId: string;
  conditions: ConditionId[];
  label?: string;
};

export function ConditionToggles({ characterId, conditions, label }: Props) {
  function setConditions(next: ConditionId[]) {
    getSocket().emit(ClientEvents.CharacterSetConditions, {
      characterId,
      conditions: next,
    });
  }

  return (
    <div className="condition-toggles" aria-label={label ?? "Conditions"}>
      {CONDITION_IDS.map((id) => {
        const active = conditions.includes(id);
        return (
          <button
            key={id}
            type="button"
            className={active ? "condition-toggle is-active" : "condition-toggle"}
            data-condition={id}
            aria-pressed={active}
            onClick={() => setConditions(toggleCondition(conditions, id))}
          >
            {CONDITION_LABELS[id]}
          </button>
        );
      })}
    </div>
  );
}
