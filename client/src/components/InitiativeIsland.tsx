import { useMemo, useState } from "react";
import {
  ClientEvents,
  type CharacterState,
  type InitiativeState,
  type TokenState,
} from "@dms/shared";
import { formatHp } from "../lib/hp";
import { getSocket } from "../socket/socket";
import { ConditionBadges } from "./ConditionBadges";
import { ConditionToggles } from "./ConditionToggles";
import type { IslandDockProps } from "./islandDock";
import { PlayIsland } from "./PlayIsland";

type Props = IslandDockProps & {
  tokens: TokenState[];
  characters: CharacterState[];
  initiative: InitiativeState | null;
};

export function InitiativeIsland({
  tokens,
  characters,
  initiative,
  side,
  collapsed,
  canMoveUp,
  canMoveDown,
  onToggleCollapsed,
  onDockSide,
  onMoveInSide,
}: Props) {
  const [draft, setDraft] = useState<Record<string, string>>({});
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

  const active = initiative?.order[initiative.activeIndex] ?? null;
  const activeInitial = active?.label.trim().charAt(0).toUpperCase() || "?";
  const activeRow = rows.find((row) => row.token.id === active?.tokenId);
  const activeHp = activeRow?.character ? formatHp(activeRow.character) : null;

  return (
    <PlayIsland
      title="Initiative"
      side={side}
      collapsed={collapsed}
      canMoveUp={canMoveUp}
      canMoveDown={canMoveDown}
      onToggleCollapsed={onToggleCollapsed}
      onDockSide={onDockSide}
      onMoveInSide={onMoveInSide}
    >
      <p>
        Round <strong>{initiative?.round ?? 1}</strong>
        {active ? (
          <>
            {" "}
            · <strong>{active.label}</strong>
            {activeHp ? (
              <>
                {" "}
                <span className="hp-chip">{activeHp}</span>
              </>
            ) : null}
          </>
        ) : null}
      </p>

      {active ? (
        <div className="init-active-card" aria-live="polite">
          {active.image ? (
            <img src={active.image} alt="" className="init-active-card__art" />
          ) : (
            <div className="init-active-card__placeholder" aria-hidden>
              {activeInitial}
            </div>
          )}
          <div>
            <span className="muted">Now</span>
            <strong className="init-active-card__name">{active.label}</strong>
            {activeHp ? <span className="hp-chip">{activeHp}</span> : null}
            {activeRow?.character ? (
              <ConditionBadges conditions={activeRow.character.conditions} compact />
            ) : null}
            {activeRow?.character ? (
              <div className="row init-active-card__hp">
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

      <ul className="token-list compact">
        {rows.map((row) => {
          const isActive = active?.tokenId === row.token.id;
          const initial = row.token.label.trim().charAt(0).toUpperCase() || "?";
          const inputId = `init-${row.token.id}`;
          const hp = row.character ? formatHp(row.character) : null;
          return (
            <li key={row.token.id} className={isActive ? "active" : undefined}>
              <div className="init-row">
                {row.image ? (
                  <img src={row.image} alt="" className="init-row__art" />
                ) : (
                  <span className="init-row__placeholder" aria-hidden>
                    {initial}
                  </span>
                )}
                <label className="init-row__label" htmlFor={inputId}>
                  <span className="init-row__name">
                    <span>{row.token.label}</span>
                    {hp ? <span className="hp-chip">{hp}</span> : null}
                    {row.character ? (
                      <ConditionBadges conditions={row.character.conditions} compact />
                    ) : null}
                  </span>
                  <input
                    id={inputId}
                    style={{ maxWidth: "4.5rem" }}
                    inputMode="numeric"
                    value={row.value}
                    placeholder="init"
                    aria-label={`Initiative for ${row.token.label}`}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, [row.token.id]: event.target.value }))
                    }
                  />
                </label>
              </div>
            </li>
          );
        })}
      </ul>
      <div className="row">
        <button type="button" onClick={setOrder} disabled={tokens.length === 0}>
          Set
        </button>
        <button
          type="button"
          className="secondary"
          onClick={nextTurn}
          disabled={!initiative?.order.length}
        >
          Next
        </button>
      </div>
    </PlayIsland>
  );
}
