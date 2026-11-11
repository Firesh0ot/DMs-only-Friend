import { useState, type FormEvent } from "react";
import { ClientEvents, type DiceRolled } from "@dms/shared";
import type { Corner } from "../lib/islandLayout";
import { getSocket } from "../socket/socket";
import { PlayIsland } from "./PlayIsland";

const QUICK_EXPRS = ["d20", "d20+5", "2d6", "2d6+3", "d100"] as const;

type Props = {
  lastDice: DiceRolled | null;
  recent: DiceRolled[];
  corner: Corner;
  onCycleCorner: () => void;
};

export function DiceIsland({ lastDice, recent, corner, onCycleCorner }: Props) {
  const [expr, setExpr] = useState("2d6+3");

  function submit(event: FormEvent) {
    event.preventDefault();
    const trimmed = expr.trim();
    if (!trimmed) {
      return;
    }
    getSocket().emit(ClientEvents.DiceRoll, { expr: trimmed });
  }

  function rollQuick(value: string) {
    setExpr(value);
    getSocket().emit(ClientEvents.DiceRoll, { expr: value });
  }

  return (
    <PlayIsland title="Dice" corner={corner} onCycleCorner={onCycleCorner}>
      <form className="dice-island__form" onSubmit={submit}>
        <label className="dice-island__label" htmlFor="dice-expr">
          Expression
          <input
            id="dice-expr"
            name="expr"
            value={expr}
            autoComplete="off"
            spellCheck={false}
            placeholder="2d6+3"
            aria-label="Dice expression"
            onChange={(event) => setExpr(event.target.value)}
          />
        </label>
        <button type="submit">Roll</button>
      </form>

      <div className="dice-island__quick" role="group" aria-label="Quick rolls">
        {QUICK_EXPRS.map((value) => (
          <button
            key={value}
            type="button"
            className="secondary dice-island__chip"
            onClick={() => rollQuick(value)}
          >
            {value}
          </button>
        ))}
      </div>

      {lastDice ? (
        <p className="dice-island__result" aria-live="polite">
          <strong>{lastDice.total}</strong>
          <span className="muted">
            {lastDice.playerName} · {lastDice.expr}
            {lastDice.results.length > 0 ? ` [${lastDice.results.join(", ")}]` : ""}
          </span>
        </p>
      ) : (
        <p className="muted">No rolls yet</p>
      )}

      {recent.length > 1 ? (
        <ul className="dice-island__history">
          {recent.slice(0, 6).map((entry) => (
            <li key={entry.id}>
              <strong>{entry.total}</strong>
              <span>
                {entry.expr}
                <span className="muted"> · {entry.playerName}</span>
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </PlayIsland>
  );
}
