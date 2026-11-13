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
import { DiceIsland } from "../components/DiceIsland";
import { DiceToast } from "../components/DiceToast";
import { FogIsland } from "../components/FogIsland";
import { InitiativeIsland } from "../components/InitiativeIsland";
import { InitiativeRail } from "../components/InitiativeRail";
import { LogIsland } from "../components/LogIsland";
import { MapControlIsland } from "../components/MapControlIsland";
import { NpcIsland } from "../components/NpcIsland";
import { SessionStrip } from "../components/SessionStrip";
import { LanternToggle } from "../components/LanternToggle";
import { SettingsPanel } from "../components/SettingsPanel";
import type { IslandDockProps } from "../components/islandDock";
import {
  dockIsland,
  isIslandCollapsed,
  loadIslandLayout,
  moveIslandInSide,
  saveIslandLayout,
  toggleIslandCollapsed,
  type DockSide,
  type IslandId,
  type IslandLayout,
} from "../lib/islandLayout";
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
  const [islandLayout, setIslandLayout] = useState<IslandLayout | null>(null);
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

  useEffect(() => {
    if (role !== "gm") {
      return;
    }
    setIslandLayout(loadIslandLayout(code));
  }, [code, role]);

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

  function patchIslandLayout(next: IslandLayout) {
    setIslandLayout(next);
    saveIslandLayout(code, next);
  }

  function dockPropsFor(id: IslandId, side: DockSide, order: IslandId[]): IslandDockProps {
    const index = order.indexOf(id);
    return {
      side,
      collapsed: islandLayout ? isIslandCollapsed(islandLayout, id) : false,
      canMoveUp: index > 0,
      canMoveDown: index >= 0 && index < order.length - 1,
      onToggleCollapsed: () => {
        if (!islandLayout) {
          return;
        }
        patchIslandLayout(toggleIslandCollapsed(islandLayout, id));
      },
      onDockSide: (nextSide) => {
        if (!islandLayout) {
          return;
        }
        patchIslandLayout(dockIsland(islandLayout, id, nextSide));
      },
      onMoveInSide: (direction) => {
        if (!islandLayout) {
          return;
        }
        patchIslandLayout(moveIslandInSide(islandLayout, id, direction));
      },
    };
  }

  function renderPlayIsland(id: IslandId, side: DockSide, order: IslandId[]) {
    if (!snapshot || !islandLayout) {
      return null;
    }
    const dock = dockPropsFor(id, side, order);
    switch (id) {
      case "map":
        return (
          <MapControlIsland
            key={id}
            maps={snapshot.maps}
            activeMap={snapshot.map}
            visibility={snapshot.visibility}
            {...dock}
          />
        );
      case "initiative":
        return (
          <InitiativeIsland
            key={id}
            tokens={tokens}
            characters={snapshot.characters}
            initiative={snapshot.initiative}
            {...dock}
          />
        );
      case "npcs":
        return (
          <NpcIsland
            key={id}
            characters={snapshot.characters}
            tokens={tokens}
            activeMapId={snapshot.map?.id ?? null}
            {...dock}
          />
        );
      case "log":
        return (
          <LogIsland
            key={id}
            events={snapshot.eventLog}
            battle={snapshot.battle}
            {...dock}
          />
        );
      case "dice":
        return (
          <DiceIsland key={id} lastDice={lastDice} recent={recentDice} {...dock} />
        );
      case "fog":
        return (
          <FogIsland
            key={id}
            mapId={snapshot.map?.id ?? null}
            hasLosGeometry={
              (snapshot.map?.walls.length ?? 0) > 0 || (snapshot.map?.portals.length ?? 0) > 0
            }
            portals={snapshot.map?.portals ?? []}
            losEnabled={snapshot.fog?.losEnabled ?? false}
            tool={fogTool}
            paintMode={fogPaintMode}
            brushRadius={fogBrushRadius}
            onToolChange={setFogTool}
            onPaintModeChange={setFogPaintMode}
            onBrushRadiusChange={setFogBrushRadius}
            onPortalToggle={onPortalToggle}
            {...dock}
          />
        );
      default:
        return null;
    }
  }

  const isGm = role === "gm";
  const showSettings = isGm && gmMode === "settings";
  const showPlayChrome = isGm && gmMode === "play" && islandLayout;

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

            {showPlayChrome && islandLayout ? (
              <>
                <div className="island-rail island-rail--left" aria-label="Left dock">
                  {islandLayout.left.map((id) =>
                    renderPlayIsland(id, "left", islandLayout.left),
                  )}
                </div>
                <div className="island-rail island-rail--right" aria-label="Right dock">
                  {islandLayout.right.map((id) =>
                    renderPlayIsland(id, "right", islandLayout.right),
                  )}
                </div>
              </>
            ) : null}

            {role !== "gm" ? <DiceToast lastDice={lastDice} /> : null}
          </div>
        </div>
      ) : null}
    </main>
  );
}
