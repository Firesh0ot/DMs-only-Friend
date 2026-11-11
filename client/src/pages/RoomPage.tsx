import { useEffect, useMemo, useState } from "react";
import { ClientEvents, type CameraState, type Role } from "@dms/shared";
import { MapCanvas } from "../canvas/MapCanvas";
import { DiceIsland } from "../components/DiceIsland";
import { DiceToast } from "../components/DiceToast";
import { InitiativeIsland } from "../components/InitiativeIsland";
import { InitiativeRail } from "../components/InitiativeRail";
import { LogIsland } from "../components/LogIsland";
import { MapControlIsland } from "../components/MapControlIsland";
import { NpcIsland } from "../components/NpcIsland";
import { SessionStrip } from "../components/SessionStrip";
import { LanternToggle } from "../components/LanternToggle";
import { SettingsPanel } from "../components/SettingsPanel";
import {
  loadIslandLayout,
  nextCorner,
  saveIslandLayout,
  type IslandId,
  type IslandLayout,
} from "../lib/islandLayout";
import { getSocket } from "../socket/socket";
import { useRoomStore } from "../state/roomStore";

type Props = {
  code: string;
  role: Role;
  name: string | null;
};

type GmMode = "play" | "settings";

export function RoomPage({ code, role, name }: Props) {
  const joinRoom = useRoomStore((state) => state.joinRoom);
  const snapshot = useRoomStore((state) => state.snapshot);
  const optimisticTokens = useRoomStore((state) => state.optimisticTokens);
  const joining = useRoomStore((state) => state.joining);
  const error = useRoomStore((state) => state.error);
  const connected = useRoomStore((state) => state.connected);
  const moveTokenOptimistic = useRoomStore((state) => state.moveTokenOptimistic);
  const lastDice = useRoomStore((state) => state.lastDice);
  const recentDice = useRoomStore((state) => state.recentDice);

  const [gmMode, setGmMode] = useState<GmMode>("play");
  const [islandLayout, setIslandLayout] = useState<IslandLayout | null>(null);

  const tokens = useMemo(() => {
    if (!snapshot) {
      return [];
    }
    return snapshot.tokens.map((token) => optimisticTokens[token.id] ?? token);
  }, [snapshot, optimisticTokens]);

  useEffect(() => {
    void joinRoom(code, role, name ?? undefined);
  }, [code, role, name, joinRoom]);

  useEffect(() => {
    if (!snapshot?.room.id || role !== "gm") {
      return;
    }
    setIslandLayout(loadIslandLayout(snapshot.room.id));
  }, [snapshot?.room.id, role]);

  const activeTokenId = useMemo(() => {
    const initiative = snapshot?.initiative;
    if (!initiative || initiative.order.length === 0) {
      return null;
    }
    return initiative.order[initiative.activeIndex]?.tokenId ?? null;
  }, [snapshot?.initiative]);

  function onTokenMove(tokenId: string, x: number, y: number) {
    moveTokenOptimistic(tokenId, x, y);
    getSocket().emit(ClientEvents.TokenMove, { tokenId, x, y });
  }

  function onCameraChange(camera: CameraState) {
    if (role !== "gm") {
      return;
    }
    getSocket().emit(ClientEvents.CameraSet, camera);
  }

  function cycleIsland(id: IslandId) {
    if (!snapshot || !islandLayout) {
      return;
    }
    const next = { ...islandLayout, [id]: nextCorner(islandLayout[id]) };
    setIslandLayout(next);
    saveIslandLayout(snapshot.room.id, next);
  }

  const isGm = role === "gm";
  const showSettings = isGm && gmMode === "settings";
  const showPlayChrome = isGm && gmMode === "play" && islandLayout;

  return (
    <main className={isGm || role === "screen" || role === "player" ? "play-shell" : "app-shell"}>
      <header className="play-topbar">
        <div>
          <p className="muted">
            {connected ? "Connected" : "Connecting…"} · {role}
            {snapshot?.playerName ? ` · ${snapshot.playerName}` : ""}
          </p>
          <h1 className="brand brand--compact">Room {code}</h1>
        </div>
        <div className="row">
          <LanternToggle />
          {isGm ? (
            <>
              <button
                className={gmMode === "play" ? "is-active" : "secondary"}
                onClick={() => setGmMode("play")}
              >
                Play
              </button>
              <button
                className={gmMode === "settings" ? "is-active" : "secondary"}
                onClick={() => setGmMode("settings")}
              >
                Settings
              </button>
            </>
          ) : (
            <a href="#/">Home</a>
          )}
        </div>
      </header>

      {joining ? <p className="lede">Joining room…</p> : null}
      {error ? <p className="error">{error}</p> : null}

      {snapshot && showSettings ? (
        <SettingsPanel
          code={code}
          maps={snapshot.maps}
          activeMapId={snapshot.map?.id ?? null}
          characters={snapshot.characters}
          onClose={() => setGmMode("play")}
        />
      ) : null}

      {snapshot && !showSettings ? (
        <div className={`play-stage ${role !== "gm" ? "play-stage--with-rail" : ""}`}>
          {role !== "gm" ? (
            <div className="play-stage__side stack">
              <InitiativeRail
                initiative={snapshot.initiative}
                tokens={tokens}
                characters={snapshot.characters}
              />
              <SessionStrip battle={snapshot.battle} events={snapshot.eventLog} />
            </div>
          ) : null}

          <div className="play-stage__map">
            {!snapshot.map ? (
              <p className="lede play-stage__empty">Waiting for the GM to upload a map…</p>
            ) : null}
            <div className="map-table">
              <div className="map-table__well">
                <MapCanvas
                  map={snapshot.map}
                  tokens={tokens}
                  camera={snapshot.camera}
                  role={role}
                  playerName={snapshot.playerName}
                  activeTokenId={activeTokenId}
                  onTokenMove={onTokenMove}
                  onCameraChange={onCameraChange}
                />
              </div>
            </div>

            {showPlayChrome ? (
              <>
                <MapControlIsland
                  maps={snapshot.maps}
                  activeMap={snapshot.map}
                  visibility={snapshot.visibility}
                  corner={islandLayout.map}
                  onCycleCorner={() => cycleIsland("map")}
                />
                <InitiativeIsland
                  tokens={tokens}
                  characters={snapshot.characters}
                  initiative={snapshot.initiative}
                  corner={islandLayout.initiative}
                  onCycleCorner={() => cycleIsland("initiative")}
                />
                <NpcIsland
                  characters={snapshot.characters}
                  tokens={tokens}
                  activeMapId={snapshot.map?.id ?? null}
                  corner={islandLayout.npcs}
                  onCycleCorner={() => cycleIsland("npcs")}
                />
                <LogIsland
                  events={snapshot.eventLog}
                  battle={snapshot.battle}
                  corner={islandLayout.log}
                  onCycleCorner={() => cycleIsland("log")}
                />
                <DiceIsland
                  lastDice={lastDice}
                  recent={recentDice}
                  corner={islandLayout.dice}
                  onCycleCorner={() => cycleIsland("dice")}
                />
              </>
            ) : null}

            {role !== "gm" ? <DiceToast lastDice={lastDice} /> : null}
          </div>
        </div>
      ) : null}
    </main>
  );
}
