import { useEffect, useState } from "react";
import {
  ClientEvents,
  type BattleState,
  type CharacterState,
  type MapState,
  type SessionEvent,
  type SpawnPoint,
} from "@dms/shared";
import { battleElapsedMs, formatDuration } from "../lib/formatDuration";
import { getSocket } from "../socket/socket";
import { HudSpawn } from "./HudSpawn";

type Props = {
  maps: MapState[];
  activeMap: MapState | null;
  events: SessionEvent[];
  battle: BattleState | null;
  logCollapsed: boolean;
  onToggleLog: () => void;
  canNext: boolean;
  characters: CharacterState[];
  spawnPoints: SpawnPoint[];
  spawnTool: boolean;
  onSpawnToolChange: (active: boolean) => void;
};

export function HudBottomStrip({
  maps,
  activeMap,
  events,
  battle,
  logCollapsed,
  onToggleLog,
  canNext,
  characters,
  spawnPoints,
  spawnTool,
  onSpawnToolChange,
}: Props) {
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [moreOpen, setMoreOpen] = useState(false);

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
  const recent = [...events].reverse().slice(0, 12);
  const mapId = activeMap?.id ?? null;

  function activate(mapIdValue: string) {
    getSocket().emit(ClientEvents.MapActivate, { mapId: mapIdValue });
  }

  function nextTurn() {
    getSocket().emit(ClientEvents.InitiativeNext);
  }

  return (
    <div className="hud-bottom">
      <div className="hud-bottom__bar">
        <div className="hud-bottom__group" aria-label="Battle">
          <span className="muted">
            {battle && !battle.endedAt ? `Battle ${elapsed}` : "No battle"}
          </span>
          {battle && !battle.endedAt ? (
            <button
              type="button"
              className="secondary hud-chip"
              onClick={() => getSocket().emit(ClientEvents.BattleEnd)}
            >
              End
            </button>
          ) : (
            <button
              type="button"
              className="hud-chip"
              onClick={() => getSocket().emit(ClientEvents.BattleStart)}
            >
              Start
            </button>
          )}
        </div>

        <button type="button" className="hud-chip hud-bottom__next" onClick={nextTurn} disabled={!canNext}>
          Next turn
        </button>

        <HudSpawn
          mode="actions"
          mapId={mapId}
          characters={characters}
          spawnPoints={spawnPoints}
          toolActive={spawnTool}
          onToolChange={onSpawnToolChange}
        />

        <div className="hud-bottom__group">
          <button
            type="button"
            className="secondary hud-chip"
            onClick={onToggleLog}
            aria-expanded={!logCollapsed}
          >
            {logCollapsed ? "Log" : "Hide log"}
          </button>
          <button
            type="button"
            className="secondary hud-chip"
            onClick={() => setMoreOpen((open) => !open)}
            aria-expanded={moreOpen}
          >
            More
          </button>
        </div>
      </div>

      {moreOpen ? (
        <div className="hud-bottom__more">
          <label className="hud-bottom__map">
            <span className="muted">Active map</span>
            <select
              value={activeMap?.id ?? ""}
              onChange={(event) => {
                if (event.target.value) {
                  activate(event.target.value);
                }
              }}
            >
              {maps.length === 0 ? <option value="">No maps</option> : null}
              {maps.map((map) => (
                <option key={map.id} value={map.id}>
                  {map.name}
                </option>
              ))}
            </select>
          </label>
          <HudSpawn
            mode="details"
            mapId={mapId}
            characters={characters}
            spawnPoints={spawnPoints}
            toolActive={spawnTool}
            onToolChange={onSpawnToolChange}
          />
          <p className="muted hud-muted">NPC roster and map prep live in Settings.</p>
        </div>
      ) : null}

      {!moreOpen ? <SpawnStatusHint mapId={mapId} spawnPoints={spawnPoints} toolActive={spawnTool} /> : null}

      {!logCollapsed ? (
        <ul className="hud-bottom__log event-log">
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
      ) : null}
    </div>
  );
}

function SpawnStatusHint({
  mapId,
  spawnPoints,
  toolActive,
}: {
  mapId: string | null;
  spawnPoints: SpawnPoint[];
  toolActive: boolean;
}) {
  let message: string | null = null;
  if (toolActive) {
    message = "Click the map to place a spawn cell.";
  } else if (mapId && !spawnPoints.some((point) => point.mapId === mapId)) {
    message = "No spawn points on this map.";
  }
  if (!message) {
    return null;
  }
  return <p className="muted hud-muted hud-spawn__hint">{message}</p>;
}

function formatClock(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "--:--";
  }
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}
