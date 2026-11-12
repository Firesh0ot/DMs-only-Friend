import type { CharacterState, InitiativeState, TokenState } from "@dms/shared";
import { useMemo } from "react";
import { formatHp, formatHpQuarter } from "../lib/hp";
import { ConditionBadges } from "./ConditionBadges";

type Props = {
  initiative: InitiativeState | null;
  tokens: TokenState[];
  characters: CharacterState[];
};

export function InitiativeRail({ initiative, tokens, characters }: Props) {
  const byToken = useMemo(() => new Map(tokens.map((token) => [token.id, token])), [tokens]);
  const byCharacter = useMemo(
    () => new Map(characters.map((character) => [character.id, character])),
    [characters],
  );

  function characterFor(tokenId: string): CharacterState | undefined {
    const token = byToken.get(tokenId);
    return token?.characterId ? byCharacter.get(token.characterId) : undefined;
  }

  if (!initiative || initiative.order.length === 0) {
    return (
      <aside className="initiative-rail" aria-label="Initiative">
        <p className="muted">Waiting for initiative…</p>
      </aside>
    );
  }

  function displayHp(character: CharacterState | undefined): string | null {
    if (!character) {
      return null;
    }
    if (character.hpQuarter !== null) {
      return formatHpQuarter(character.hpQuarter);
    }
    return formatHp(character);
  }

  const active = initiative.order[initiative.activeIndex];
  const activeCharacter = active ? characterFor(active.tokenId) : undefined;
  const activeHp = displayHp(activeCharacter);

  return (
    <aside className="initiative-rail" aria-label="Initiative order">
      <div className="initiative-rail__round">
        <span className="muted">Round</span>
        <strong>{initiative.round}</strong>
      </div>
      {active ? (
        <div className="initiative-rail__active-turn">
          {active.image ? (
            <img src={active.image} alt="" className="initiative-rail__active-art" />
          ) : (
            <div className="initiative-rail__active-placeholder" aria-hidden>
              {active.label.trim().charAt(0).toUpperCase() || "?"}
            </div>
          )}
          <p className="initiative-rail__turn">
            Turn: <strong>{active.label}</strong>
            {activeHp ? (
              <>
                {" "}
                <span className="hp-chip">{activeHp}</span>
              </>
            ) : null}
          </p>
          {activeCharacter ? (
            <ConditionBadges conditions={activeCharacter.conditions} compact />
          ) : null}
        </div>
      ) : null}
      <ol className="initiative-rail__list">
        {initiative.order.map((entry, index) => {
          const isActive = index === initiative.activeIndex;
          const initial = entry.label.trim().charAt(0).toUpperCase() || "?";
          const character = characterFor(entry.tokenId);
          const hp = displayHp(character);
          const quarter = character?.hpQuarter;
          return (
            <li key={`${entry.tokenId}-${index}`} className={isActive ? "is-active" : undefined}>
              <div className="tcg-card" data-kind={entry.kind ?? "npc"}>
                {entry.image ? (
                  <img src={entry.image} alt="" className="tcg-card__art" />
                ) : (
                  <div className="tcg-card__placeholder" aria-hidden>
                    {initial}
                  </div>
                )}
                <div className="tcg-card__meta">
                  <span className="tcg-card__name">{entry.label}</span>
                  <span className="tcg-card__stats">
                    {quarter !== null && quarter !== undefined ? (
                      <span
                        className="hp-bar"
                        title={hp ?? undefined}
                        aria-label={hp ? `HP ${hp}` : "HP"}
                      >
                        {[0, 1, 2, 3].map((step) => (
                          <span
                            key={step}
                            className={
                              step < quarter ? "hp-bar__seg is-filled" : "hp-bar__seg"
                            }
                          />
                        ))}
                      </span>
                    ) : hp ? (
                      <span className="hp-chip">{hp}</span>
                    ) : null}
                    {character ? (
                      <ConditionBadges conditions={character.conditions} compact />
                    ) : null}
                    <span className="tcg-card__init">{entry.initiative}</span>
                  </span>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </aside>
  );
}
