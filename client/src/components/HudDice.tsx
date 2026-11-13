import { useState, type FormEvent } from "react";
import { ClientEvents, type DiceRolled } from "@dms/shared";
import { getSocket } from "../socket/socket";

const QUICK_EXPRS = ["d20", "d20+5", "2d6", "2d6+3", "d100"] as const;

type Props = {
  lastDice: DiceRolled | null;
  recent: DiceRolled[];
};

export function HudDice({ lastDice, recent }: Props) {
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
    <div className="hud-dice stack">
      <form className="hud-dice__form" onSubmit={submit}>
        <input
          id="hud-dice-expr"
          name="expr"
          value={expr}
          autoComplete="off"
          spellCheck={false}
          placeholder="2d6+3"
          aria-label="Dice expression"
          onChange={(event) => setExpr(event.target.value)}
        />
        <button type="submit">Roll</button>
      </form>
      <div className="hud-dice__quick" role="group" aria-label="Quick rolls">
        {QUICK_EXPRS.map((value) => (
          <button
            key={value}
            type="button"
            className="secondary hud-chip"
            onClick={() => rollQuick(value)}
          >
            {value}
          </button>
        ))}
      </div>
      {lastDice ? (
        <p className="hud-dice__result" aria-live="polite">
          <strong>{lastDice.total}</strong>
          <span className="muted">
            {lastDice.expr}
            {lastDice.results.length > 0 ? ` [${lastDice.results.join(", ")}]` : ""}
          </span>
        </p>
      ) : (
        <p className="muted hud-muted">No rolls yet</p>
      )}
      {recent.length > 1 ? (
        <ul className="hud-dice__history">
          {recent.slice(0, 4).map((entry) => (
            <li key={entry.id}>
              <strong>{entry.total}</strong>
              <span className="muted">{entry.expr}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
