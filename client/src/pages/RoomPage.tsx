import { useEffect, useMemo, useState } from "react";
import {
  ClientEvents,
  roomCodePathSegment,
  type CameraState,
  type FogPaintMode,
  type FogStrokeInput,
  type Role,
} from "@dms/shared";
import { MapCanvas } from "../canvas/MapCanvas";
import type { FogToolMode } from "../canvas/useMapScene";
import { DiceToast } from "../components/DiceToast";
import { InitiativeRail } from "../components/InitiativeRail";
import { LanternToggle } from "../components/LanternToggle";
import { PlayHud } from "../components/PlayHud";
import { SessionStrip } from "../components/SessionStrip";
import { SettingsPanel } from "../components/SettingsPanel";
import { getSocket } from "../socket/socket";
import { useRoomStore } from "../state/roomStore";

type Props = {
  code: string;
  role: Role;
  name: string | null;
  characterId: string | null;
  invite: string | null;
};

type GmMode = "play" | "settings";

export function RoomPage({ code, role, name, characterId, invite }: Props) {
  const joinRoom = useRoomStore((state) => state.joinRoom);
  const snapshot = useRoomStore((state) => state.snapshot);
  const uploadToken = useRoomStore((state) => state.uploadToken);
  const optimisticTokens = useRoomStore((state) => state.optimisticTokens);
  const joining = useRoomStore((state) => state.joining);
  const error = useRoomStore((state) => state.error);
  const connected = useRoomStore((state) => state.connected);
  const moveTokenOptimistic = useRoomStore((state) => state.moveTokenOptimistic);
  const lastDice = useRoomStore((state) => state.lastDice);
  const recentDice = useRoomStore((state) => state.recentDice);

  const [gmMode, setGmMode] = useState<GmMode>("play");
  const [fogTool, setFogTool] = useState<FogToolMode>("off");
  const [fogPaintMode, setFogPaintMode] = useState<FogPaintMode>("reveal");
  const [fogBrushRadius, setFogBrushRadius] = useState(36);
  const [gmPin, setGmPin] = useState(() => sessionStorage.getItem(`dms-gm-pin:${code}`) ?? "");
  const [pinReady, setPinReady] = useState(
    () => role !== "gm" || /^\d{4,8}$/.test(sessionStorage.getItem(`dms-gm-pin:${code}`) ?? ""),
  );

  const tokens = useMemo(() => {
    if (!snapshot) {
      return [];
    }
    return snapshot.tokens.map((token) => optimisticTokens[token.id] ?? token);
  }, [snapshot, optimisticTokens]);

  useEffect(() => {
    if (role === "gm" && !pinReady) {
      return;
    }
    void joinRoom({
      code,
      role,
      name: name ?? undefined,
      characterId: characterId ?? undefined,
      pin: role === "gm" ? gmPin || undefined : undefined,
      invite: role === "gm" ? invite ?? undefined : undefined,
    })
      .then(() => {
        if (role === "gm" && invite) {
          window.location.hash = `/room/${roomCodePathSegment(code)}?role=gm`;
        }
      })
      .catch(() => undefined);
  }, [code, role, name, characterId, invite, joinRoom, pinReady, gmPin]);

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

  function onPortalToggle(portalId: string, closed: boolean) {
    if (!snapshot?.map) {
      return;
    }
    getSocket().emit(ClientEvents.PortalSetClosed, {
      mapId: snapshot.map.id,
      portalId,
      closed,
    });
  }

  function onFogPaint(stroke: FogStrokeInput) {
    if (role !== "gm" || !snapshot?.map) {
      return;
    }
    getSocket().emit(ClientEvents.FogPaint, { mapId: snapshot.map.id, stroke });
  }

  const isGm = role === "gm";
  const showSettings = isGm && gmMode === "settings";
  const showPlayChrome = isGm && gmMode === "play";

  if (isGm && !pinReady) {
    return (
      <main className="app-shell">
        <header className="play-topbar">
          <div>
            <p className="muted">GM gate</p>
            <h1 className="brand brand--compact">Room {code}</h1>
          </div>
          <a href="#/">Home</a>
        </header>
        <section className="panel stack" style={{ maxWidth: "24rem" }}>
          <h2>Enter GM PIN</h2>
          <p className="muted">
            {invite
              ? "Redeem this single-use invite with your PIN to become GM."
              : "Rejoin as GM with the room PIN."}
          </p>
          <label className="stack">
            <span className="muted">PIN</span>
            <input
              value={gmPin}
              onChange={(event) => setGmPin(event.target.value.replace(/\D/g, "").slice(0, 8))}
              inputMode="numeric"
              autoComplete="current-password"
              placeholder="••••"
            />
          </label>
          <button
            onClick={() => {
              if (!/^\d{4,8}$/.test(gmPin)) {
                return;
              }
              sessionStorage.setItem(`dms-gm-pin:${code}`, gmPin);
              setPinReady(true);
            }}
          >
            Continue as GM
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className={isGm || role === "screen" || role === "player" ? "play-shell" : "app-shell"}>
      <header className="play-topbar">
        <div>
          <p className="muted">
            {connected ? "Connected" : "Connecting…"} · {role}
            {snapshot?.playerName ? ` · ${snapshot.playerName}` : ""}
            {isGm && fogTool !== "off" ? " · Fog tool" : ""}
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
                onClick={() => {
                  setFogTool("off");
                  setGmMode("settings");
                }}
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
          settings={snapshot.settings}
          uploadToken={uploadToken}
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
                  characterId={snapshot.characterId}
                  activeTokenId={activeTokenId}
                  fog={snapshot.fog}
                  fogTool={isGm ? fogTool : "off"}
                  fogPaintMode={fogPaintMode}
                  fogBrushRadius={fogBrushRadius}
                  onTokenMove={onTokenMove}
                  onCameraChange={onCameraChange}
                  onFogPaint={onFogPaint}
                  onPortalToggle={isGm ? onPortalToggle : undefined}
                />
              </div>
            </div>

            {showPlayChrome ? (
              <PlayHud
                roomCode={code}
                maps={snapshot.maps}
                activeMap={snapshot.map}
                visibility={snapshot.visibility}
                tokens={tokens}
                characters={snapshot.characters}
                initiative={snapshot.initiative}
                events={snapshot.eventLog}
                battle={snapshot.battle}
                lastDice={lastDice}
                recentDice={recentDice}
                hasLosGeometry={
                  (snapshot.map?.walls.length ?? 0) > 0 || (snapshot.map?.portals.length ?? 0) > 0
                }
                portals={snapshot.map?.portals ?? []}
                losEnabled={snapshot.fog?.losEnabled ?? false}
                fogTool={fogTool}
                fogPaintMode={fogPaintMode}
                fogBrushRadius={fogBrushRadius}
                onFogToolChange={setFogTool}
                onFogPaintModeChange={setFogPaintMode}
                onFogBrushRadiusChange={setFogBrushRadius}
                onPortalToggle={onPortalToggle}
              />
            ) : null}

            {role !== "gm" ? <DiceToast lastDice={lastDice} /> : null}
          </div>
        </div>
      ) : null}
    </main>
  );
}
