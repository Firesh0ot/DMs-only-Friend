import { useMemo, useState } from "react";
import {
  type CharacterState,
  type FogState,
  type MapState,
  type TokenState,
} from "@dms/shared";
import { defaultCombatantTokenIds } from "../lib/combatants";

type Props = {
  tokens: TokenState[];
  characters: CharacterState[];
  map: MapState | null;
  fog: FogState | null;
  onConfirm: (tokenIds: string[]) => void;
  onCancel: () => void;
};

export function BattleStartPicker({
  tokens,
  characters,
  map,
  fog,
  onConfirm,
  onCancel,
}: Props) {
  const byCharacter = useMemo(
    () => new Map(characters.map((character) => [character.id, character])),
    [characters],
  );
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(defaultCombatantTokenIds(tokens, characters, map, fog)),
  );

  const rows = useMemo(() => {
    return tokens.map((token) => {
      const character = token.characterId ? byCharacter.get(token.characterId) : undefined;
      const kind = character?.kind ?? (token.isPlayer ? "pc" : "npc");
      return { token, kind, bonus: character?.initiativeBonus ?? 0 };
    });
  }, [tokens, byCharacter]);

  function toggle(tokenId: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(tokenId)) {
        next.delete(tokenId);
      } else {
        next.add(tokenId);
      }
      return next;
    });
  }

  function selectAll() {
    setSelected(new Set(tokens.map((token) => token.id)));
  }

  function selectDefaults() {
    setSelected(new Set(defaultCombatantTokenIds(tokens, characters, map, fog)));
  }

  return (
    <div className="screen-modal" role="dialog" aria-modal="true" aria-labelledby="battle-start-title">
      <div className="screen-modal__card panel stack battle-start-picker">
        <h2 id="battle-start-title">Start battle</h2>
        <p className="muted">
          Choose combatants. Defaults: all PCs and currently visible NPCs.
        </p>
        <div className="row battle-start-picker__toolbar">
          <button type="button" className="secondary hud-chip" onClick={selectDefaults}>
            Defaults
          </button>
          <button type="button" className="secondary hud-chip" onClick={selectAll}>
            All
          </button>
          <button
            type="button"
            className="secondary hud-chip"
            onClick={() => setSelected(new Set())}
          >
            None
          </button>
        </div>
        <ul className="token-list compact battle-start-picker__list">
          {rows.length === 0 ? (
            <li className="muted">No tokens on the active map</li>
          ) : (
            rows.map(({ token, kind, bonus }) => {
              const inputId = `battle-member-${token.id}`;
              return (
                <li key={token.id}>
                  <label className="battle-start-picker__row" htmlFor={inputId}>
                    <input
                      id={inputId}
                      type="checkbox"
                      checked={selected.has(token.id)}
                      onChange={() => toggle(token.id)}
                    />
                    <span className="battle-start-picker__name">
                      {token.label}
                      <span className="muted">
                        {kind.toUpperCase()}
                        {bonus !== 0
                          ? ` ${bonus >= 0 ? `+${bonus}` : String(bonus)}`
                          : ""}
                      </span>
                    </span>
                  </label>
                </li>
              );
            })
          )}
        </ul>
        <div className="row battle-start-picker__actions">
          <button type="button" className="secondary" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm([...selected])}
            disabled={tokens.length === 0}
          >
            Start ({selected.size})
          </button>
        </div>
      </div>
    </div>
  );
}
