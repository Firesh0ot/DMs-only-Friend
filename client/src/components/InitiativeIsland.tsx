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
      <ul className="token-list compact">
        {rows.map((row) => {
          const isActive = active?.tokenId === row.token.id;
          return (
            <li key={row.token.id} className={isActive ? "active" : undefined}>
              <span>{row.token.label}</span>
              <input
                style={{ maxWidth: "4.5rem" }}
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
          Set
        </button>
        <button className="secondary" onClick={nextTurn} disabled={!initiative?.order.length}>
          Next
        </button>
      </div>
    </PlayIsland>
  );
}
