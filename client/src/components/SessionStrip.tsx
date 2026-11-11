import { useEffect, useState } from "react";
import type { BattleState, SessionEvent } from "@dms/shared";
import { battleElapsedMs, formatDuration } from "../lib/formatDuration";

type Props = {
  battle: BattleState | null;
  events: SessionEvent[];
};

export function SessionStrip({ battle, events }: Props) {
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (!battle || battle.endedAt) {
      return;
    }
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [battle]);

  const latest = [...events].slice(-2).reverse();
  if (!battle && latest.length === 0) {
    return null;
  }

  const elapsed =
    battle && !battle.endedAt
      ? formatDuration(battleElapsedMs(battle.startedAt, battle.endedAt, nowMs))
      : null;

  return (
    <div className="session-strip" aria-label="Session log">
      {elapsed ? <strong className="session-strip__time">{elapsed}</strong> : null}
      <ul className="session-strip__events">
        {latest.map((event) => (
          <li key={event.id}>{event.summary}</li>
        ))}
      </ul>
    </div>
  );
}
