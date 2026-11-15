import { useMemo, useState, type Dispatch, type SetStateAction } from "react";
import {
  ClientEvents,
  type BattleState,
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
  battle: BattleState | null;
  remainingCells?: number | null;
  movement?: MovementBudget | null;
};

export function HudInitiative({
  tokens,
  characters,
  initiative,
  visibility,
  battle,
  movement = null,
}: Props) {
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [orderOpen, setOrderOpen] = useState(false);

  const byToken = useMemo(() => new Map(tokens.map((token) => [token.id, token])), [tokens]);
  const byCharacter = useMemo(
    () => new Map(characters.map((character) => [character.id, character])),
    [characters],
  );

  const battleActive = Boolean(battle && !battle.endedAt);
  const combatantSet = useMemo(
    () => new Set(battleActive ? (battle?.combatantTokenIds ?? []) : []),
    [battleActive, battle?.combatantTokenIds],
  );
  const memberTokens = useMemo(
    () => tokens.filter((token) => combatantSet.has(token.id)),
    [tokens, combatantSet],
  );
  const nonMemberTokens = useMemo(
    () => tokens.filter((token) => !combatantSet.has(token.id)),
    [tokens, combatantSet],
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

  const downedCharacters = useMemo(() => {
    const activeId = activeCharacter?.id;
    return characters.filter((character) => {
      if (character.id === activeId) {
        return false;
      }
      return (
        character.deathState === "dying" ||
        character.deathState === "stable" ||
        character.deathState === "dead" ||
        (character.hpCurrent !== null && character.hpCurrent <= 0)
      );
    });
  }, [characters, activeCharacter?.id]);

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

  function deathSave(characterId: string, action: "roll" | "stabilize" | "kill" | "success" | "fail") {
    getSocket().emit(ClientEvents.CharacterDeathSave, { characterId, action });
  }

  function addCombatant(tokenId: string) {
    getSocket().emit(ClientEvents.InitiativeAdd, { tokenId });
  }

  function removeCombatant(tokenId: string) {
    getSocket().emit(ClientEvents.InitiativeRemove, { tokenId });
  }

  function toggleDiscovered(token: TokenState) {
    getSocket().emit(ClientEvents.TokenSetDiscovered, {
      tokenId: token.id,
      discovered: !token.discovered,
    });
  }

  function setOrder() {
    const order = memberTokens
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
            disabled={!battleActive || memberTokens.length === 0}
            title={
              !battleActive
                ? "Start a battle to roll initiative"
                : memberTokens.length === 0
                  ? "No combatants selected"
                  : "Roll initiative for combatants"
            }
          >
            Roll
          </button>
          <button
            type="button"
            className="secondary hud-chip"
            onClick={() => setOrderOpen((open) => !open)}
            aria-expanded={orderOpen}
            disabled={!battleActive}
          >
            {orderOpen ? "Hide" : "Set"}
          </button>
        </div>
      </div>

      {!battleActive ? (
        orderOpen ? null : (
          <p className="muted hud-init__idle">Start battle to pick combatants, then roll</p>
        )
      ) : !initiative || initiative.order.length === 0 ? (
        orderOpen ? null : (
          <p className="muted hud-init__idle">Roll or set initiative for combatants</p>
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
              {activeCharacter &&
              (activeCharacter.deathState === "dying" ||
                activeCharacter.deathState === "stable" ||
                activeCharacter.deathState === "dead" ||
                (activeCharacter.hpCurrent !== null && activeCharacter.hpCurrent <= 0)) ? (
                <DeathSaveControls
                  character={activeCharacter}
                  onAction={(action) => deathSave(activeCharacter.id, action)}
                />
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

      {downedCharacters.length > 0 ? (
        <div className="hud-init__downed stack" aria-label="Downed characters">
          <p className="muted hud-init__downed-title">Downed</p>
          <ul className="hud-init__roster-list">
            {downedCharacters.map((character) => (
              <li key={character.id}>
                <span className="hud-init__name">{character.name}</span>
                <DeathSaveControls
                  character={character}
                  onAction={(action) => deathSave(character.id, action)}
                />
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {battleActive ? (
        <CombatantRoster
          memberTokens={memberTokens}
          nonMemberTokens={nonMemberTokens}
          initiative={initiative}
          onAdd={addCombatant}
          onRemove={removeCombatant}
          onToggleDiscovered={toggleDiscovered}
        />
      ) : null}

      {orderOpen && battleActive ? (
        <ManualOrder
          tokens={memberTokens}
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

function DeathSaveControls({
  character,
  onAction,
}: {
  character: CharacterState;
  onAction: (action: "roll" | "stabilize" | "kill" | "success" | "fail") => void;
}) {
  const dying = character.deathState === "dying";
  return (
    <div className="hud-death stack" aria-label={`Death saves for ${character.name}`}>
      <p className="hud-death__status">
        <span className="hud-death__state">{character.deathState}</span>
        <span className="muted">
          S{character.deathSaveSuccesses}/3 · F{character.deathSaveFailures}/3
        </span>
      </p>
      <div className="row hud-death__actions">
        <button
          type="button"
          className="secondary hud-chip"
          disabled={!dying}
          onClick={() => onAction("roll")}
        >
          Roll
        </button>
        <button
          type="button"
          className="secondary hud-chip"
          disabled={!dying}
          onClick={() => onAction("success")}
          title="Mark success"
        >
          +S
        </button>
        <button
          type="button"
          className="secondary hud-chip"
          disabled={!dying}
          onClick={() => onAction("fail")}
          title="Mark failure"
        >
          +F
        </button>
        <button
          type="button"
          className="secondary hud-chip"
          disabled={character.deathState === "dead" || character.deathState === "stable"}
          onClick={() => onAction("stabilize")}
        >
          Stable
        </button>
        <button
          type="button"
          className="secondary hud-chip"
          disabled={character.deathState === "dead"}
          onClick={() => onAction("kill")}
        >
          Dead
        </button>
      </div>
    </div>
  );
}

function CombatantRoster({
  memberTokens,
  nonMemberTokens,
  initiative,
  onAdd,
  onRemove,
  onToggleDiscovered,
}: {
  memberTokens: TokenState[];
  nonMemberTokens: TokenState[];
  initiative: InitiativeState | null;
  onAdd: (tokenId: string) => void;
  onRemove: (tokenId: string) => void;
  onToggleDiscovered: (token: TokenState) => void;
}) {
  const activeId = initiative?.order[initiative.activeIndex]?.tokenId;
  const scoreByToken = useMemo(() => {
    const map = new Map<string, number>();
    for (const entry of initiative?.order ?? []) {
      map.set(entry.tokenId, entry.initiative);
    }
    return map;
  }, [initiative]);

  return (
    <div className="hud-init__roster" aria-label="Combatant membership">
      <ul className="token-list compact hud-init__roster-list">
        {memberTokens.map((token) => {
          const score = scoreByToken.get(token.id);
          return (
            <li key={token.id} className={activeId === token.id ? "active" : undefined}>
              <span className="hud-init__name">
                {token.label}
                {score !== undefined ? <span className="muted">{score}</span> : null}
              </span>
              <button
                type="button"
                className={`secondary hud-chip hud-init__member-btn ${token.discovered || token.isPlayer ? "is-active" : ""}`}
                onClick={() => onToggleDiscovered(token)}
                aria-pressed={token.discovered || token.isPlayer}
                title={token.discovered || token.isPlayer ? "Discovered" : "Mark discovered"}
                disabled={token.isPlayer}
              >
                Seen
              </button>
              <button
                type="button"
                className="secondary hud-chip hud-init__member-btn"
                onClick={() => onRemove(token.id)}
                aria-label={`Remove ${token.label} from initiative`}
                title="Remove from initiative"
              >
                −
              </button>
            </li>
          );
        })}
        {nonMemberTokens.map((token) => (
          <li key={token.id} className="hud-init__roster-out">
            <span className="hud-init__name muted">{token.label}</span>
            <button
              type="button"
              className={`secondary hud-chip hud-init__member-btn ${token.discovered || token.isPlayer ? "is-active" : ""}`}
              onClick={() => onToggleDiscovered(token)}
              aria-pressed={token.discovered || token.isPlayer}
              title={token.discovered || token.isPlayer ? "Discovered" : "Mark discovered"}
              disabled={token.isPlayer}
            >
              Seen
            </button>
            <button
              type="button"
              className="secondary hud-chip hud-init__member-btn"
              onClick={() => onAdd(token.id)}
              aria-label={`Add ${token.label} to initiative`}
              title="Add to initiative"
            >
              +
            </button>
          </li>
        ))}
      </ul>
      {memberTokens.length === 0 && nonMemberTokens.length === 0 ? (
        <p className="muted hud-init__idle">No tokens on the active map</p>
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
