import { useMemo, useState } from "react";
import {
  ClientEvents,
  type CharacterState,
  type InitiativeState,
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
};

export function HudInitiative({
  tokens,
  characters,
  initiative,
  visibility,
  remainingCells = null,
}: Props) {
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [orderOpen, setOrderOpen] = useState(false);
  const byCharacter = useMemo(
    () => new Map(characters.map((character) => [character.id, character])),
    [characters],
  );

  const rows = useMemo(() => {
    return tokens.map((token) => {
      const existing = initiative?.order.find((entry) => entry.tokenId === token.id);
      const character = token.characterId ? byCharacter.get(token.characterId) : undefined;
      return {
        token,
        character,
        value: draft[token.id] ?? (existing ? String(existing.initiative) : ""),
        image: existing?.image ?? token.image,
      };
    });
  }, [tokens, initiative, draft, byCharacter]);

  function setOrder() {
    const order = rows
      .map((row) => ({
        tokenId: row.token.id,
        initiative: Number(row.value),
      }))
      .filter((entry) => Number.isFinite(entry.initiative));
    getSocket().emit(ClientEvents.InitiativeSet, { order });
  }

  function nextTurn() {
    getSocket().emit(ClientEvents.InitiativeNext);
  }

  function nudgeHp(characterId: string, delta: number) {
    getSocket().emit(ClientEvents.CharacterSetHp, { characterId, delta });
  }

  function setVisibility(patch: Partial<VisibilityState>) {
    getSocket().emit(ClientEvents.VisibilitySet, patch);
  }

  const active = initiative?.order[initiative.activeIndex] ?? null;
  const activeInitial = active?.label.trim().charAt(0).toUpperCase() || "?";
  const activeRow = rows.find((row) => row.token.id === active?.tokenId);
  const activeHp = activeRow?.character ? formatHp(activeRow.character) : null;

  return (
    <div className="hud-init stack">
      <div className="hud-init__display" role="group" aria-label="Token display">
        <label className="hud-check">
          <input
            type="checkbox"
            checked={visibility.showPcs}
            onChange={(event) => setVisibility({ showPcs: event.target.checked })}
          />
          <span>PCs</span>
        </label>
        <label className="hud-check">
          <input
            type="checkbox"
            checked={visibility.showNpcs}
            onChange={(event) => setVisibility({ showNpcs: event.target.checked })}
          />
          <span>NPCs</span>
        </label>
      </div>

      <div className="hud-init__status row">
        <span>
          R<strong>{initiative?.round ?? 1}</strong>
          {active ? (
            <>
              {" "}
              · <strong>{active.label}</strong>
              {activeHp ? <span className="hp-chip">{activeHp}</span> : null}
              {remainingCells !== null && remainingCells !== undefined ? (
                <span className="hp-chip">Move {remainingCells}</span>
              ) : null}
            </>
          ) : null}
        </span>
        <button
          type="button"
          className="secondary hud-chip"
          onClick={nextTurn}
          disabled={!initiative?.order.length}
        >
          Next
        </button>
      </div>

      {active ? (
        <div className="hud-init__active" aria-live="polite">
          {active.image ? (
            <img src={active.image} alt="" className="hud-init__art" />
          ) : (
            <div className="hud-init__placeholder" aria-hidden>
              {activeInitial}
            </div>
          )}
          <div className="hud-init__active-body">
            {activeRow?.character ? (
              <ConditionBadges conditions={activeRow.character.conditions} compact />
            ) : null}
            {activeRow?.character ? (
              <div className="row">
                <button
                  type="button"
                  className="secondary hp-btn"
                  onClick={() => nudgeHp(activeRow.character!.id, -1)}
                  aria-label={`Damage ${active.label} by 1`}
                >
                  −1
                </button>
                <button
                  type="button"
                  className="secondary hp-btn"
                  onClick={() => nudgeHp(activeRow.character!.id, 1)}
                  aria-label={`Heal ${active.label} by 1`}
                >
                  +1
                </button>
              </div>
            ) : null}
            {activeRow?.character ? (
              <ConditionToggles
                characterId={activeRow.character.id}
                conditions={activeRow.character.conditions}
                label={`Conditions for ${active.label}`}
              />
            ) : null}
          </div>
        </div>
      ) : null}

      <button
        type="button"
        className="secondary hud-chip"
        onClick={() => setOrderOpen((open) => !open)}
        aria-expanded={orderOpen}
      >
        {orderOpen ? "Hide order" : "Set order"}
      </button>

      {orderOpen ? (
        <>
          <ul className="token-list compact hud-init__order">
            {rows.map((row) => {
              const isActive = active?.tokenId === row.token.id;
              const inputId = `hud-init-${row.token.id}`;
              const hp = row.character ? formatHp(row.character) : null;
              return (
                <li key={row.token.id} className={isActive ? "active" : undefined}>
                  <label className="hud-init__row" htmlFor={inputId}>
                    <span className="hud-init__name">
                      {row.token.label}
                      {hp ? <span className="hp-chip">{hp}</span> : null}
                    </span>
                    <input
                      id={inputId}
                      inputMode="numeric"
                      value={row.value}
                      placeholder="init"
                      aria-label={`Initiative for ${row.token.label}`}
                      onChange={(event) =>
                        setDraft((current) => ({ ...current, [row.token.id]: event.target.value }))
                      }
                    />
                  </label>
                </li>
              );
            })}
          </ul>
          <button type="button" onClick={setOrder} disabled={tokens.length === 0}>
            Set
          </button>
        </>
      ) : null}
    </div>
  );
}
