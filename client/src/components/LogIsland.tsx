import { useEffect, useState } from "react";
import { ClientEvents, type BattleState, type SessionEvent } from "@dms/shared";
import { battleElapsedMs, formatDuration } from "../lib/formatDuration";
import type { Corner } from "../lib/islandLayout";
import { getSocket } from "../socket/socket";
import { PlayIsland } from "./PlayIsland";

type Props = {
  events: SessionEvent[];
  battle: BattleState | null;
  corner: Corner;
  onCycleCorner: () => void;
};

export function LogIsland({ events, battle, corner, onCycleCorner }: Props) {
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (!battle || battle.endedAt) {
      return;
    }
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [battle]);

  const elapsed = battle
    ? formatDuration(battleElapsedMs(battle.startedAt, battle.endedAt, nowMs))
    : null;
  const recent = [...events].reverse().slice(0, 40);

  return (
    <PlayIsland title="Log" corner={corner} onCycleCorner={onCycleCorner}>
      <div className="row log-island__battle">
        <span className="muted">{battle && !battle.endedAt ? `Battle ${elapsed}` : "No battle"}</span>
        {battle && !battle.endedAt ? (
          <button className="secondary" onClick={() => getSocket().emit(ClientEvents.BattleEnd)}>
            End
          </button>
        ) : (
          <button onClick={() => getSocket().emit(ClientEvents.BattleStart)}>Start</button>
        )}
      </div>

      <ul className="event-log">
        {recent.length === 0 ? (
          <li className="muted">No events yet</li>
        ) : (
          recent.map((event) => (
            <li key={event.id}>
              <time dateTime={event.createdAt}>{formatClock(event.createdAt)}</time>
              <span>{event.summary}</span>
            </li>
          ))
        )}
      </ul>
    </PlayIsland>
  );
}

function formatClock(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "--:--";
  }
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}
