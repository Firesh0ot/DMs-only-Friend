import { useMemo, useState, type FormEvent } from "react";
import {
  advantageExpr,
  ClientEvents,
  disadvantageExpr,
  type CharacterState,
  type DiceRolled,
  type TokenState,
} from "@dms/shared";
import { getSocket } from "../socket/socket";

const QUICK_EXPRS = ["d20", "d20+5", "2d6", "2d6+3", "d100"] as const;

type Props = {
  lastDice: DiceRolled | null;
  recent: DiceRolled[];
  tokens?: TokenState[];
  characters?: CharacterState[];
};

export function HudDice({
  lastDice,
  recent,
  tokens = [],
  characters = [],
}: Props) {
  const [expr, setExpr] = useState("2d6+3");
  const [attackMod, setAttackMod] = useState("0");
  const [damageExpr, setDamageExpr] = useState("1d8+3");
  const [targetId, setTargetId] = useState("");

  const targets = useMemo(() => {
    const byCharacter = new Map(characters.map((character) => [character.id, character]));
    return tokens
      .map((token) => {
        const character = token.characterId ? byCharacter.get(token.characterId) : undefined;
        if (!character) {
          return null;
        }
        return { token, character };
      })
      .filter((row): row is { token: TokenState; character: CharacterState } => row !== null);
  }, [tokens, characters]);

  const target = targets.find((row) => row.character.id === targetId) ?? null;
  const mod = Number(attackMod);
  const attackModifier = Number.isFinite(mod) ? Math.trunc(mod) : 0;

  const attackVerdict = useMemo(() => {
    if (!lastDice || !target || target.character.ac == null) {
      return null;
    }
    const isAttackRoll =
      lastDice.expr.includes("d20") &&
      (lastDice.expr.startsWith("1d20") ||
        lastDice.expr.startsWith("d20") ||
        lastDice.expr.includes("kh1") ||
        lastDice.expr.includes("kl1"));
    if (!isAttackRoll) {
      return null;
    }
    const hit = lastDice.total >= target.character.ac;
    return { hit, total: lastDice.total, ac: target.character.ac };
  }, [lastDice, target]);

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

  function rollAttack(mode: "normal" | "adv" | "dis") {
    const next =
      mode === "adv"
        ? advantageExpr(attackModifier)
        : mode === "dis"
          ? disadvantageExpr(attackModifier)
          : attackModifier === 0
            ? "1d20"
            : `1d20${attackModifier >= 0 ? `+${attackModifier}` : String(attackModifier)}`;
    setExpr(next);
    getSocket().emit(ClientEvents.DiceRoll, { expr: next });
  }

  function rollDamage() {
    const trimmed = damageExpr.trim();
    if (!trimmed) {
      return;
    }
    setExpr(trimmed);
    getSocket().emit(ClientEvents.DiceRoll, { expr: trimmed });
  }

  function applyDamage() {
    if (!target || !lastDice) {
      return;
    }
    getSocket().emit(ClientEvents.CharacterSetHp, {
      characterId: target.character.id,
      delta: -Math.abs(lastDice.total),
    });
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
        <button
          type="button"
          className="secondary hud-chip"
          onClick={() => rollQuick(advantageExpr())}
          title="Advantage 2d20kh1"
        >
          Adv
        </button>
        <button
          type="button"
          className="secondary hud-chip"
          onClick={() => rollQuick(disadvantageExpr())}
          title="Disadvantage 2d20kl1"
        >
          Dis
        </button>
      </div>

      <div className="hud-attack stack" aria-label="Attack assist">
        <div className="hud-attack__row">
          <label className="hud-attack__label" htmlFor="hud-attack-target">
            Target
          </label>
          <select
            id="hud-attack-target"
            value={targetId}
            onChange={(event) => setTargetId(event.target.value)}
          >
            <option value="">Select…</option>
            {targets.map(({ token, character }) => (
              <option key={character.id} value={character.id}>
                {token.label}
                {character.ac != null ? ` AC ${character.ac}` : ""}
              </option>
            ))}
          </select>
        </div>
        <div className="hud-attack__row">
          <label className="hud-attack__label" htmlFor="hud-attack-mod">
            Atk mod
          </label>
          <input
            id="hud-attack-mod"
            value={attackMod}
            inputMode="numeric"
            onChange={(event) => setAttackMod(event.target.value)}
            aria-label="Attack modifier"
          />
        </div>
        <div className="hud-dice__quick" role="group" aria-label="Attack rolls">
          <button type="button" className="secondary hud-chip" onClick={() => rollAttack("normal")}>
            Attack
          </button>
          <button type="button" className="secondary hud-chip" onClick={() => rollAttack("adv")}>
            Atk Adv
          </button>
          <button type="button" className="secondary hud-chip" onClick={() => rollAttack("dis")}>
            Atk Dis
          </button>
        </div>
        {attackVerdict ? (
          <p className="hud-attack__verdict" aria-live="polite">
            {attackVerdict.hit ? "Hit" : "Miss"}{" "}
            <span className="muted">
              {attackVerdict.total} vs AC {attackVerdict.ac}
            </span>
          </p>
        ) : null}
        {attackVerdict?.hit ? (
          <div className="hud-attack__damage row">
            <input
              value={damageExpr}
              onChange={(event) => setDamageExpr(event.target.value)}
              aria-label="Damage expression"
              placeholder="1d8+3"
            />
            <button type="button" className="secondary hud-chip" onClick={rollDamage}>
              Dmg
            </button>
            <button
              type="button"
              className="secondary hud-chip"
              onClick={applyDamage}
              disabled={!lastDice}
              title="Apply last roll as damage"
            >
              Apply
            </button>
          </div>
        ) : null}
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
