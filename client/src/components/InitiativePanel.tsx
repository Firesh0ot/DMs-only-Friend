import { useMemo, useState } from "react";
import { ClientEvents, type InitiativeState, type TokenState } from "@dms/shared";
import { getSocket } from "../socket/socket";

type Props = {
  tokens: TokenState[];
  initiative: InitiativeState | null;
};

export function InitiativePanel({ tokens, initiative }: Props) {
  const [draft, setDraft] = useState<Record<string, string>>({});

  const rows = useMemo(() => {
    return tokens.map((token) => {
      const existing = initiative?.order.find((entry) => entry.tokenId === token.id);
      return {
        token,
        value: draft[token.id] ?? (existing ? String(existing.initiative) : ""),
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

  return (
    <section className="panel stack">
      <h2>Initiative</h2>
      {active ? (
        <p>
          Active: <strong>{active.label}</strong> ({active.initiative})
        </p>
      ) : (
        <p className="muted">No order yet</p>
      )}

      <ul className="token-list">
        {rows.map((row) => {
          const isActive = active?.tokenId === row.token.id;
          return (
            <li key={row.token.id} className={isActive ? "active" : undefined}>
              <span>{row.token.label}</span>
              <input
                style={{ maxWidth: "5rem" }}
                inputMode="numeric"
                value={row.value}
                placeholder="init"
                onChange={(event) =>
                  setDraft((current) => ({ ...current, [row.token.id]: event.target.value }))
                }
              />
            </li>
          );
        })}
      </ul>

      <div className="row">
        <button onClick={setOrder} disabled={tokens.length === 0}>
          Set order
        </button>
        <button className="secondary" onClick={nextTurn} disabled={!initiative?.order.length}>
          Next turn
        </button>
      </div>
    </section>
  );
}
