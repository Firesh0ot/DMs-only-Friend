import { useEffect, useState } from "react";
import type { DiceRolled } from "@dms/shared";

type Props = {
  lastDice: DiceRolled | null;
};

export function DiceToast({ lastDice }: Props) {
  const [visible, setVisible] = useState<DiceRolled | null>(null);

  useEffect(() => {
    if (!lastDice) {
      return;
    }
    setVisible(lastDice);
    const timer = window.setTimeout(() => {
      setVisible((current) => (current?.id === lastDice.id ? null : current));
    }, 4500);
    return () => window.clearTimeout(timer);
  }, [lastDice]);

  if (!visible) {
    return null;
  }

  return (
    <div className="dice-toast" role="status" aria-live="polite">
      <strong className="dice-toast__total">{visible.total}</strong>
      <span className="dice-toast__detail">
        {visible.playerName}: {visible.expr}
        {visible.results.length > 0 ? ` [${visible.results.join(", ")}]` : ""}
      </span>
    </div>
  );
}
