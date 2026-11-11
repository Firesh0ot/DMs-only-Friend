import { useMemo, useState } from "react";
import { ClientEvents, type InitiativeState, type TokenState } from "@dms/shared";
import { getSocket } from "../socket/socket";
import { PlayIsland } from "./PlayIsland";
import type { Corner } from "../lib/islandLayout";

type Props = {
  tokens: TokenState[];
  initiative: InitiativeState | null;
  corner: Corner;
  onCycleCorner: () => void;
};

export function InitiativeIsland({ tokens, initiative, corner, onCycleCorner }: Props) {
  const [draft, setDraft] = useState<Record<string, string>>({});

  const rows = useMemo(() => {
    return tokens.map((token) => {
      const existing = initiative?.order.find((entry) => entry.tokenId === token.id);
      return {
        token,
        value: draft[token.id] ?? (existing ? String(existing.initiative) : ""),
        image: existing?.image ?? token.image,
      };
    });
  }, [tokens, initiative, draft]);

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

  const active = initiative?.order[initiative.activeIndex] ?? null;
  const activeInitial = active?.label.trim().charAt(0).toUpperCase() || "?";

  return (
    <PlayIsland title="Initiative" corner={corner} onCycleCorner={onCycleCorner}>
      <p>
        Round <strong>{initiative?.round ?? 1}</strong>
        {active ? (
          <>
            {" "}
            · <strong>{active.label}</strong>
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
          </div>
        </div>
      ) : null}

      <ul className="token-list compact">
        {rows.map((row) => {
          const isActive = active?.tokenId === row.token.id;
          const initial = row.token.label.trim().charAt(0).toUpperCase() || "?";
          const inputId = `init-${row.token.id}`;
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
                  <span>{row.token.label}</span>
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
