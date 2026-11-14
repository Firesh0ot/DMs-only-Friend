import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import {
  ClientEvents,
  type CharacterState,
  type InitiativeEntry,
  type InitiativeState,
  type MovementBudget,
  type Role,
  type TokenState,
  type VisibilityState,
} from "@dms/shared";
import { formatHp, formatHpQuarter } from "../../lib/hp";
import { getSocket } from "../../socket/socket";
import { ConditionBadges } from "../ConditionBadges";
import { ConditionToggles } from "../ConditionToggles";

type Props = {
  role: Role;
  selfCharacterId?: string | null;
  initiative: InitiativeState | null;
  tokens: TokenState[];
  characters: CharacterState[];
  visibility?: VisibilityState;
  movement?: MovementBudget | null;
  compact?: boolean;
};

type CardModel = {
  entry: InitiativeEntry;
  character?: CharacterState;
  token?: TokenState;
  index: number;
  slot: "prev" | "active" | "next";
};

function characterFor(
  entry: InitiativeEntry,
  byToken: Map<string, TokenState>,
  byCharacter: Map<string, CharacterState>,
): CharacterState | undefined {
  const token = byToken.get(entry.tokenId);
  return token?.characterId ? byCharacter.get(token.characterId) : undefined;
}

function displayHp(character: CharacterState | undefined, role: Role): string | null {
  if (!character) {
    return null;
  }
  if (role === "screen" || character.hpQuarter !== null) {
    if (character.hpQuarter !== null) {
      return formatHpQuarter(character.hpQuarter);
    }
  }
  return formatHp(character);
}

function hpQuarterValue(character: CharacterState | undefined): number | null {
  if (!character) {
    return null;
  }
  if (character.hpQuarter !== null) {
    return character.hpQuarter;
  }
  if (character.hpMax === null || character.hpMax <= 0) {
    return null;
  }
  const current = character.hpCurrent ?? 0;
  if (current <= 0) {
    return 0;
  }
  const ratio = current / character.hpMax;
  if (ratio <= 0.25) {
    return 1;
  }
  if (ratio <= 0.5) {
    return 2;
  }
  if (ratio <= 0.75) {
    return 3;
  }
  return 4;
}

export function TurnCarousel({
  role,
  selfCharacterId = null,
  initiative,
  tokens,
  characters,
  visibility,
  movement = null,
  compact = false,
}: Props) {
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [orderOpen, setOrderOpen] = useState(false);
  const [slide, setSlide] = useState<"none" | "forward" | "back">("none");
  const prevIndex = useRef<number | null>(null);

  const byToken = useMemo(() => new Map(tokens.map((token) => [token.id, token])), [tokens]);
  const byCharacter = useMemo(
    () => new Map(characters.map((character) => [character.id, character])),
    [characters],
  );

  useEffect(() => {
    if (!initiative || initiative.order.length === 0) {
      prevIndex.current = null;
      return;
    }
    const previous = prevIndex.current;
    prevIndex.current = initiative.activeIndex;
    if (previous === null || previous === initiative.activeIndex) {
      return;
    }
    const len = initiative.order.length;
    const forward = (previous + 1) % len === initiative.activeIndex;
    setSlide(forward ? "forward" : "back");
    const timer = window.setTimeout(() => setSlide("none"), 320);
    return () => window.clearTimeout(timer);
  }, [initiative]);

  const activeEntry = initiative?.order[initiative.activeIndex] ?? null;
  const activeToken = activeEntry ? byToken.get(activeEntry.tokenId) : undefined;
  const isActivePlayer =
    role === "player" &&
    Boolean(selfCharacterId) &&
    activeToken?.characterId === selfCharacterId;
  const canControl = role === "gm" || isActivePlayer;
  const showGmChrome = role === "gm";

  const cards = useMemo((): CardModel[] => {
    if (!initiative || initiative.order.length === 0) {
      return [];
    }
    const len = initiative.order.length;
    const activeIndex = initiative.activeIndex;
    const prevIdx = len > 1 ? (activeIndex - 1 + len) % len : -1;
    const nextIdx = len > 1 ? (activeIndex + 1) % len : -1;
    const result: CardModel[] = [];
    if (prevIdx >= 0) {
      const entry = initiative.order[prevIdx]!;
      result.push({
        entry,
        character: characterFor(entry, byToken, byCharacter),
        token: byToken.get(entry.tokenId),
        index: prevIdx,
        slot: "prev",
      });
    }
    {
      const entry = initiative.order[activeIndex]!;
      result.push({
        entry,
        character: characterFor(entry, byToken, byCharacter),
        token: byToken.get(entry.tokenId),
        index: activeIndex,
        slot: "active",
      });
    }
    if (nextIdx >= 0) {
      const entry = initiative.order[nextIdx]!;
      result.push({
        entry,
        character: characterFor(entry, byToken, byCharacter),
        token: byToken.get(entry.tokenId),
        index: nextIdx,
        slot: "next",
      });
    }
    return result;
  }, [initiative, byToken, byCharacter]);

  const moveRemaining =
    initiative?.activeMovementRemaining ??
    initiative?.remainingCells ??
    (movement?.active ? movement.remainingCells : null) ??
    null;

  function setVisibility(patch: Partial<VisibilityState>) {
    getSocket().emit(ClientEvents.VisibilitySet, patch);
  }

  function rollAll() {
    getSocket().emit(ClientEvents.InitiativeRoll);
  }

  function rollSelf() {
    getSocket().emit(ClientEvents.InitiativeRollSelf);
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

  const rootClass = [
    "turn-carousel",
    compact ? "turn-carousel--compact" : "turn-carousel--rail",
    `turn-carousel--${role}`,
    slide !== "none" ? `is-sliding-${slide}` : "",
  ]
    .filter(Boolean)
    .join(" ");

  if (!initiative || initiative.order.length === 0) {
    return (
      <div className={rootClass} aria-label="Initiative">
        {showGmChrome && visibility ? (
          <div className="turn-carousel__header">
            <div className="turn-carousel__display" role="group" aria-label="Token display">
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
            <div className="turn-carousel__idle-actions row">
              <button type="button" className="secondary hud-chip" onClick={rollAll} disabled={tokens.length === 0}>
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
            {orderOpen ? (
              <ManualOrder
                tokens={tokens}
                characters={characters}
                initiative={initiative}
                draft={draft}
                setDraft={setDraft}
                onSet={setOrder}
              />
            ) : (
              <p className="muted turn-carousel__idle">Start combat — roll or set initiative</p>
            )}
          </div>
        ) : role === "player" && selfCharacterId ? (
          <div className="turn-carousel__idle-actions stack">
            <p className="muted">Waiting for initiative…</p>
            <button type="button" className="secondary hud-chip" onClick={rollSelf}>
              Roll mine
            </button>
          </div>
        ) : (
          <p className="muted">Waiting for initiative…</p>
        )}
      </div>
    );
  }

  return (
    <div className={rootClass} aria-label="Initiative order">
      <div className="turn-carousel__header">
        <div className="turn-carousel__round">
          <span className="muted">R</span>
          <strong>{initiative.round}</strong>
        </div>
        {showGmChrome && visibility ? (
          <div className="turn-carousel__display" role="group" aria-label="Token display">
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
        ) : null}
        {showGmChrome ? (
          <div className="turn-carousel__idle-actions row">
            <button type="button" className="secondary hud-chip" onClick={rollAll}>
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
        ) : null}
        {role === "player" && selfCharacterId ? (
          <button type="button" className="secondary hud-chip" onClick={rollSelf}>
            Roll mine
          </button>
        ) : null}
      </div>

      <div className="turn-carousel__stage" aria-live="polite">
        {cards.map((card) => {
          const initial = card.entry.label.trim().charAt(0).toUpperCase() || "?";
          const hp = displayHp(card.character, role);
          const quarter = hpQuarterValue(card.character);
          const isActive = card.slot === "active";
          return (
            <article
              key={`${card.entry.tokenId}-${card.slot}`}
              className={`turn-card turn-card--${card.slot}`}
              data-kind={card.entry.kind ?? "npc"}
            >
              <div className="turn-card__portrait">
                {card.entry.image ? (
                  <img src={card.entry.image} alt="" />
                ) : (
                  <div className="turn-card__placeholder" aria-hidden>
                    {initial}
                  </div>
                )}
                {isActive ? (
                  <span className="turn-card__init" title="Initiative">
                    {card.entry.initiative}
                  </span>
                ) : null}
              </div>
              <div className="turn-card__body">
                <strong className="turn-card__name">{card.entry.label}</strong>
                <div className="turn-card__stats">
                  {quarter !== null ? (
                    <span className="hp-bar" title={hp ?? undefined} aria-label={hp ? `HP ${hp}` : "HP"}>
                      {[0, 1, 2, 3].map((step) => (
                        <span
                          key={step}
                          className={step < quarter ? "hp-bar__seg is-filled" : "hp-bar__seg"}
                        />
                      ))}
                    </span>
                  ) : hp ? (
                    <span className="hp-chip">{hp}</span>
                  ) : null}
                  {isActive && card.character?.ac != null ? (
                    <span className="turn-card__ac">AC {card.character.ac}</span>
                  ) : null}
                </div>
                {isActive && card.character ? (
                  <ConditionBadges conditions={card.character.conditions} compact />
                ) : null}
                {isActive && canControl ? (
                  <div className="turn-card__controls">
                    <button
                      type="button"
                      className="secondary hud-chip"
                      disabled={moveRemaining === null}
                      title={moveRemaining === null ? "Movement after turn start" : "Movement remaining"}
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
                    {showGmChrome && card.character ? (
                      <div className="row turn-card__hp-nudge">
                        <button
                          type="button"
                          className="secondary hp-btn"
                          onClick={() => nudgeHp(card.character!.id, -1)}
                          aria-label={`Damage ${card.entry.label} by 1`}
                        >
                          −1
                        </button>
                        <button
                          type="button"
                          className="secondary hp-btn"
                          onClick={() => nudgeHp(card.character!.id, 1)}
                          aria-label={`Heal ${card.entry.label} by 1`}
                        >
                          +1
                        </button>
                      </div>
                    ) : null}
                    {showGmChrome && card.character ? (
                      <ConditionToggles
                        characterId={card.character.id}
                        conditions={card.character.conditions}
                        label={`Conditions for ${card.entry.label}`}
                      />
                    ) : null}
                  </div>
                ) : null}
                {isActive && !canControl && role !== "screen" ? (
                  <div className="turn-card__controls turn-card__controls--readonly">
                    <span className="hp-chip">
                      Move {moveRemaining === null ? "–" : moveRemaining}
                    </span>
                    <span className={`hp-chip ${initiative.activeActionUsed ? "is-used" : ""}`}>
                      Aktion
                    </span>
                    <span className={`hp-chip ${initiative.activeBonusUsed ? "is-used" : ""}`}>
                      Bonus
                    </span>
                  </div>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>

      {showGmChrome && orderOpen ? (
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
    <div className="turn-carousel__manual stack">
      <ul className="token-list compact hud-init__order">
        {tokens.map((token) => {
          const existing = initiative?.order.find((entry) => entry.tokenId === token.id);
          const character = token.characterId ? byCharacter.get(token.characterId) : undefined;
          const value = draft[token.id] ?? (existing ? String(existing.initiative) : "");
          const inputId = `turn-init-${token.id}`;
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
