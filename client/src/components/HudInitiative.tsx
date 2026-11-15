import { useMemo, useState, type Dispatch, type SetStateAction } from "react";
import {
  ClientEvents,
  type CharacterState,
  type InitiativeState,
  type MovementBudget,
  type TokenState,
  type VisibilityState,
} from "@dms/shared";
import { formatHp } from "../lib/hp";
import { getSocket } from "../socket/socket";
import { ConditionBadges } from "./ConditionBadges";
import { ConditionToggles } from "./ConditionToggles";

type Props = {
  tokens: TokenState[];
  characters: CharacterState[];
  initiative: InitiativeState | null;
  visibility: VisibilityState;
  remainingCells?: number | null;
  movement?: MovementBudget | null;
};

export function HudInitiative({
  tokens,
  characters,
  initiative,
  visibility,
  movement = null,
}: Props) {
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [orderOpen, setOrderOpen] = useState(false);

  const byToken = useMemo(() => new Map(tokens.map((token) => [token.id, token])), [tokens]);
  const byCharacter = useMemo(
    () => new Map(characters.map((character) => [character.id, character])),
    [characters],
  );

  const activeEntry = initiative?.order[initiative.activeIndex] ?? null;
  const activeToken = activeEntry ? byToken.get(activeEntry.tokenId) : undefined;
  const activeCharacter = activeToken?.characterId
    ? byCharacter.get(activeToken.characterId)
    : undefined;

  const moveRemaining =
    initiative?.activeMovementRemaining ??
    initiative?.remainingCells ??
    (movement?.active ? movement.remainingCells : null) ??
    null;

  const exactHp = activeCharacter ? formatHp(activeCharacter) : null;
  const initial = activeEntry?.label.trim().charAt(0).toUpperCase() || "?";

  function setVisibility(patch: Partial<VisibilityState>) {
    getSocket().emit(ClientEvents.VisibilitySet, patch);
  }

  function rollAll() {
    getSocket().emit(ClientEvents.InitiativeRoll);
  }

  function endTurn() {
    getSocket().emit(ClientEvents.InitiativeNext);
  }

  function setAction(used: boolean) {
    getSocket().emit(ClientEvents.TurnAction, { used });
  }

  function setBonus(used: boolean) {
    getSocket().emit(ClientEvents.TurnBonus, { used });
  }

  function nudgeHp(characterId: string, delta: number) {
    getSocket().emit(ClientEvents.CharacterSetHp, { characterId, delta });
  }

  function setOrder() {
    const order = tokens
      .map((token) => {
        const existing = initiative?.order.find((entry) => entry.tokenId === token.id);
        const value = draft[token.id] ?? (existing ? String(existing.initiative) : "");
        const initiativeValue = Number(value);
        if (!Number.isFinite(initiativeValue)) {
          return null;
        }
        return { tokenId: token.id, initiative: initiativeValue };
      })
      .filter((entry): entry is { tokenId: string; initiative: number } => entry !== null);
    getSocket().emit(ClientEvents.InitiativeSet, { order });
  }

  return (
    <div className="hud-init" aria-label="Initiative controls">
      <div className="hud-init__toolbar">
        {initiative && initiative.order.length > 0 ? (
          <div className="hud-init__round" aria-live="polite">
            <span className="muted">R</span>
            <strong>{initiative.round}</strong>
          </div>
        ) : null}
        <div className="hud-init__display" role="group" aria-label="Token display">
          <label className="hud-check">
            <input
              type="checkbox"
              checked={visibility.showPcs}
              onChange={(event) => setVisibility({ showPcs: event.target.checked })}
            />
            <span>PC</span>
          </label>
          <label className="hud-check">
            <input
              type="checkbox"
              checked={visibility.showNpcs}
              onChange={(event) => setVisibility({ showNpcs: event.target.checked })}
            />
            <span>NPC</span>
          </label>
        </div>
        <div className="hud-init__actions row">
          <button
            type="button"
            className="secondary hud-chip"
            onClick={rollAll}
            disabled={tokens.length === 0}
          >
            Roll
          </button>
          <button
            type="button"
            className="secondary hud-chip"
            onClick={() => setOrderOpen((open) => !open)}
            aria-expanded={orderOpen}
          >
            {orderOpen ? "Hide" : "Set"}
          </button>
        </div>
      </div>

      {!initiative || initiative.order.length === 0 ? (
        orderOpen ? null : (
          <p className="muted hud-init__idle">Start combat — roll or set initiative</p>
        )
      ) : activeEntry ? (
        <div className="hud-init__active" data-kind={activeEntry.kind ?? "npc"}>
          <div className="hud-init__art-wrap">
            {activeEntry.image ? (
              <img className="hud-init__art" src={activeEntry.image} alt="" />
            ) : (
              <div className="hud-init__placeholder" aria-hidden>
                {initial}
              </div>
            )}
            <span className="hud-init__init" title="Initiative">
              {activeEntry.initiative}
            </span>
          </div>
          <div className="hud-init__active-body">
            <strong className="hud-init__active-name">{activeEntry.label}</strong>
            <div className="hud-init__stats">
              {exactHp ? (
                <span className="hud-init__hp" aria-label={`HP ${exactHp}`}>
                  <span className="hud-init__hp-label">HP</span>
                  <strong className="hud-init__hp-value">{exactHp}</strong>
                </span>
              ) : null}
              {activeCharacter?.ac != null ? (
                <span className="hud-init__ac">AC {activeCharacter.ac}</span>
              ) : null}
            </div>
            {activeCharacter ? (
              <ConditionBadges conditions={activeCharacter.conditions} compact />
            ) : null}
            <div className="hud-init__controls">
              <button
                type="button"
                className="secondary hud-chip"
                disabled={moveRemaining === null}
                title={
                  moveRemaining === null ? "Movement after turn start" : "Movement remaining"
                }
              >
                Move {moveRemaining === null ? "–" : moveRemaining}
              </button>
              <button
                type="button"
                className={`secondary hud-chip ${initiative.activeActionUsed ? "is-used" : ""}`}
                onClick={() => setAction(!(initiative.activeActionUsed ?? false))}
                aria-pressed={Boolean(initiative.activeActionUsed)}
              >
                Aktion
              </button>
              <button
                type="button"
                className={`secondary hud-chip ${initiative.activeBonusUsed ? "is-used" : ""}`}
                onClick={() => setBonus(!(initiative.activeBonusUsed ?? false))}
                aria-pressed={Boolean(initiative.activeBonusUsed)}
              >
                Bonus
              </button>
              <button type="button" onClick={endTurn}>
                End Turn
              </button>
              {activeCharacter ? (
                <div className="row hud-init__hp-nudge">
                  <button
                    type="button"
                    className="secondary hp-btn"
                    onClick={() => nudgeHp(activeCharacter.id, -1)}
                    aria-label={`Damage ${activeEntry.label} by 1`}
                  >
                    −1
                  </button>
                  <button
                    type="button"
                    className="secondary hp-btn"
                    onClick={() => nudgeHp(activeCharacter.id, 1)}
                    aria-label={`Heal ${activeEntry.label} by 1`}
                  >
                    +1
                  </button>
                </div>
              ) : null}
              {activeCharacter ? (
                <ConditionToggles
                  characterId={activeCharacter.id}
                  conditions={activeCharacter.conditions}
                  label={`Conditions for ${activeEntry.label}`}
                />
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {orderOpen ? (
        <ManualOrder
          tokens={tokens}
          characters={characters}
          initiative={initiative}
          draft={draft}
          setDraft={setDraft}
          onSet={setOrder}
        />
      ) : null}
    </div>
  );
}

function ManualOrder({
  tokens,
  characters,
  initiative,
  draft,
  setDraft,
  onSet,
}: {
  tokens: TokenState[];
  characters: CharacterState[];
  initiative: InitiativeState | null;
  draft: Record<string, string>;
  setDraft: Dispatch<SetStateAction<Record<string, string>>>;
  onSet: () => void;
}) {
  const byCharacter = useMemo(
    () => new Map(characters.map((character) => [character.id, character])),
    [characters],
  );
  const activeId = initiative?.order[initiative.activeIndex]?.tokenId;

  return (
    <div className="hud-init__manual stack">
      <ul className="token-list compact hud-init__order">
        {tokens.map((token) => {
          const existing = initiative?.order.find((entry) => entry.tokenId === token.id);
          const character = token.characterId ? byCharacter.get(token.characterId) : undefined;
          const value = draft[token.id] ?? (existing ? String(existing.initiative) : "");
          const inputId = `hud-init-${token.id}`;
          const hp = character ? formatHp(character) : null;
          return (
            <li key={token.id} className={activeId === token.id ? "active" : undefined}>
              <label className="hud-init__row" htmlFor={inputId}>
                <span className="hud-init__name">
                  {token.label}
                  {hp ? <span className="hp-chip">{hp}</span> : null}
                  {character ? (
                    <span className="muted">
                      {character.initiativeBonus >= 0
                        ? `+${character.initiativeBonus}`
                        : String(character.initiativeBonus)}
                    </span>
                  ) : null}
                </span>
                <input
                  id={inputId}
                  inputMode="numeric"
                  value={value}
                  placeholder="init"
                  aria-label={`Initiative for ${token.label}`}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, [token.id]: event.target.value }))
                  }
                />
              </label>
            </li>
          );
        })}
      </ul>
      <button type="button" onClick={onSet} disabled={tokens.length === 0}>
        Set
      </button>
    </div>
  );
}
