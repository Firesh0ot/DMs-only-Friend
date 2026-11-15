import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  ClientEvents,
  carouselFacingDeg,
  clampCarouselPlacement,
  type CharacterState,
  type InitiativeEntry,
  type InitiativeState,
  type Role,
  type ScreenCarouselPlacement,
  type TokenState,
} from "@dms/shared";
import { formatHp, formatHpQuarter } from "../../lib/hp";
import {
  SCREEN_CAROUSEL_INVERT_EVENT,
  carouselFacingWithInvert,
  readScreenCarouselInvert,
} from "../../lib/screenCarouselInvert";
import { getSocket } from "../../socket/socket";
import { ConditionBadges } from "../ConditionBadges";
import { fanCardTransform, fanOffsetsForOrder } from "./carouselMotion";

type Props = {
  role: Role;
  initiative: InitiativeState | null;
  tokens: TokenState[];
  characters: CharacterState[];
  placement: ScreenCarouselPlacement;
  draggable?: boolean;
  invertFacing?: boolean;
  showHp?: boolean;
  embedded?: boolean;
};

type FanCard = {
  entry: InitiativeEntry;
  character?: CharacterState;
  offset: number;
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

export function ScreenFanCarousel({
  role,
  initiative,
  tokens,
  characters,
  placement,
  draggable = false,
  invertFacing,
  showHp = true,
  embedded = false,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const [localInvert, setLocalInvert] = useState(() => readScreenCarouselInvert());
  const dragOrigin = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);

  useEffect(() => {
    if (invertFacing !== undefined) {
      return;
    }
    function sync() {
      setLocalInvert(readScreenCarouselInvert());
    }
    function onStorage(event: StorageEvent) {
      if (event.key === null || event.key === "dms-screen-carousel-invert") {
        sync();
      }
    }
    window.addEventListener(SCREEN_CAROUSEL_INVERT_EVENT, sync);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(SCREEN_CAROUSEL_INVERT_EVENT, sync);
      window.removeEventListener("storage", onStorage);
    };
  }, [invertFacing]);

  const byToken = useMemo(() => new Map(tokens.map((token) => [token.id, token])), [tokens]);
  const byCharacter = useMemo(
    () => new Map(characters.map((character) => [character.id, character])),
    [characters],
  );

  const cards = useMemo((): FanCard[] => {
    if (!initiative || initiative.order.length === 0) {
      return [];
    }
    return fanOffsetsForOrder(initiative.order.length, initiative.activeIndex).map(
      ({ index, offset }) => {
        const entry = initiative.order[index]!;
        return {
          entry,
          character: characterFor(entry, byToken, byCharacter),
          offset,
        };
      },
    );
  }, [initiative, byToken, byCharacter]);

  const inverted = invertFacing ?? localInvert;
  const facing = carouselFacingWithInvert(carouselFacingDeg(placement), inverted);

  useEffect(() => {
    if (!dragging) {
      return;
    }
    function onMove(event: PointerEvent) {
      const origin = dragOrigin.current;
      if (!origin || event.pointerId !== origin.pointerId) {
        return;
      }
      const parent = rootRef.current?.offsetParent as HTMLElement | null;
      if (!parent) {
        return;
      }
      const rect = parent.getBoundingClientRect();
      const dx = event.clientX - origin.startX;
      const dy = event.clientY - origin.startY;
      const next = clampCarouselPlacement({
        xNorm: origin.originX + dx / Math.max(rect.width, 1),
        yNorm: origin.originY + dy / Math.max(rect.height, 1),
      });
      rootRef.current?.style.setProperty("--fan-x", `${next.xNorm * 100}%`);
      rootRef.current?.style.setProperty("--fan-y", `${next.yNorm * 100}%`);
    }
    function onUp(event: PointerEvent) {
      const origin = dragOrigin.current;
      if (!origin || event.pointerId !== origin.pointerId) {
        return;
      }
      const parent = rootRef.current?.offsetParent as HTMLElement | null;
      if (!parent) {
        setDragging(false);
        dragOrigin.current = null;
        return;
      }
      const rect = parent.getBoundingClientRect();
      const next = clampCarouselPlacement({
        xNorm: origin.originX + (event.clientX - origin.startX) / Math.max(rect.width, 1),
        yNorm: origin.originY + (event.clientY - origin.startY) / Math.max(rect.height, 1),
      });
      getSocket().emit(ClientEvents.ScreenCarouselSet, next);
      setDragging(false);
      dragOrigin.current = null;
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [dragging]);

  function onHandlePointerDown(event: ReactPointerEvent<HTMLButtonElement>) {
    if (!draggable) {
      return;
    }
    event.preventDefault();
    dragOrigin.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: placement.xNorm,
      originY: placement.yNorm,
    };
    setDragging(true);
  }

  const rootClass = [
    "screen-fan",
    embedded ? "screen-fan--embedded" : "",
    dragging ? "is-dragging" : "",
    !initiative || initiative.order.length === 0 ? "screen-fan--idle" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const rootStyle = {
    "--fan-x": `${placement.xNorm * 100}%`,
    "--fan-y": `${placement.yNorm * 100}%`,
    "--fan-facing": `${facing}deg`,
  } as CSSProperties;

  return (
    <div ref={rootRef} className={rootClass} style={rootStyle} aria-label="Initiative fan">
      <div className="screen-fan__orient">
        {draggable ? (
          <button
            type="button"
            className="screen-fan__handle"
            aria-label="Move initiative carousel"
            onPointerDown={onHandlePointerDown}
          >
            Place
          </button>
        ) : null}
        {!initiative || initiative.order.length === 0 ? (
          <p className="screen-fan__idle muted">Waiting for initiative…</p>
        ) : (
          <>
            <div className="screen-fan__round" aria-live="polite">
              <span className="muted">R</span>
              <strong>{initiative.round}</strong>
            </div>
            <div className="screen-fan__stage">
              {cards.map((card) => {
                const initial = card.entry.label.trim().charAt(0).toUpperCase() || "?";
                const hp = showHp ? displayHp(card.character, role) : null;
                const quarter = showHp ? hpQuarterValue(card.character) : null;
                const isActive = card.offset === 0;
                const style = fanCardTransform(card.offset);
                const showStats =
                  isActive &&
                  (quarter !== null || Boolean(hp) || Boolean(card.character?.conditions.length));
                return (
                  <article
                    key={card.entry.tokenId}
                    className={`screen-fan__card ${isActive ? "is-active" : ""}`}
                    data-kind={card.entry.kind ?? "npc"}
                    data-offset={card.offset}
                    style={style}
                  >
                    <div className="screen-fan__portrait">
                      {card.entry.image ? (
                        <img src={card.entry.image} alt="" />
                      ) : (
                        <div className="screen-fan__placeholder" aria-hidden>
                          {initial}
                        </div>
                      )}
                      {isActive ? (
                        <span className="screen-fan__init" title="Initiative">
                          {card.entry.initiative}
                        </span>
                      ) : null}
                    </div>
                    <div className="screen-fan__body">
                      <strong className="screen-fan__name">{card.entry.label}</strong>
                      {showStats ? (
                        <div className="screen-fan__stats">
                          {quarter !== null ? (
                            <span
                              className="hp-bar"
                              title={hp ?? undefined}
                              aria-label={hp ? `HP ${hp}` : "HP"}
                            >
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
                          {card.character ? (
                            <ConditionBadges conditions={card.character.conditions} compact />
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
