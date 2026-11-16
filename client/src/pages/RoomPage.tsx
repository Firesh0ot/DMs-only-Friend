import { useEffect, useMemo, useState } from "react";
import {
  ClientEvents,
  DEFAULT_SCREEN_CAROUSEL,
  roomCodePathSegment,
  type CameraState,
  type FogPaintMode,
  type FogStrokeInput,
  type Role,
} from "@dms/shared";
import { MapCanvas } from "../canvas/MapCanvas";
import type { FogToolMode } from "../canvas/useMapScene";
import { DiceToast } from "../components/DiceToast";
import { LanternToggle } from "../components/LanternToggle";
import { PlayHud } from "../components/PlayHud";
import { ScreenDisplayControls } from "../components/ScreenDisplayControls";
import { SessionStrip } from "../components/SessionStrip";
import { SettingsPanel } from "../components/SettingsPanel";
import { ScreenFanCarousel } from "../components/turn/ScreenFanCarousel";
import { TurnCarousel } from "../components/turn/TurnCarousel";
import {
  initialScreenCalibration,
  initialScreenDisplayMode,
  loadPhysicalCamera,
  physicalZoom,
  savePhysicalCamera,
  type ScreenCalibration,
  type ScreenDisplayMode,
} from "../lib/screenCalibration";
import {
  SCREEN_CAROUSEL_INVERT_EVENT,
  readScreenCarouselInvert,
  writeScreenCarouselInvert,
} from "../lib/screenCarouselInvert";
import { getSocket } from "../socket/socket";
import { useRoomStore } from "../state/roomStore";

const SCREEN_FULLSCREEN_KEY = "dms-screen-fullscreen";

function loadScreenFullscreen(): boolean {
  try {
    return localStorage.getItem(SCREEN_FULLSCREEN_KEY) === "1";
  } catch {
    return false;
  }
}

function saveScreenFullscreen(value: boolean): void {
  try {
    localStorage.setItem(SCREEN_FULLSCREEN_KEY, value ? "1" : "0");
  } catch {
    /* ignore */
  }
}

type Props = {
  code: string;
  role: Role;
  name: string | null;
  characterId: string | null;
  invite: string | null;
};

type GmMode = "play" | "prep" | "settings";

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
  const [spawnTool, setSpawnTool] = useState(false);
  const [fogPaintMode, setFogPaintMode] = useState<FogPaintMode>("reveal");
  const [fogBrushRadius, setFogBrushRadius] = useState(36);
  const lastMovementReject = useRoomStore((state) => state.lastMovementReject);
  const clearMovementReject = useRoomStore((state) => state.clearMovementReject);
  const [gmPin, setGmPin] = useState(() => sessionStorage.getItem(`dms-gm-pin:${code}`) ?? "");
  const [pinReady, setPinReady] = useState(
    () => role !== "gm" || /^\d{4,8}$/.test(sessionStorage.getItem(`dms-gm-pin:${code}`) ?? ""),
  );
  const [screenMode, setScreenMode] = useState<ScreenDisplayMode>(() =>
    role === "screen" ? initialScreenDisplayMode() : "fit",
  );
  const [screenCalibration, setScreenCalibration] = useState<ScreenCalibration | null>(() =>
    role === "screen" ? initialScreenCalibration() : null,
  );
  const [physicalCamera] = useState(() => (role === "screen" ? loadPhysicalCamera() : null));
  const [screenFullscreen, setScreenFullscreen] = useState(
    () => role === "screen" && loadScreenFullscreen(),
  );
  const [carouselInvert, setCarouselInvert] = useState(() => readScreenCarouselInvert());

  const tokens = useMemo(() => {
    if (!snapshot) {
      return [];
    }
    return snapshot.tokens.map((token) => optimisticTokens[token.id] ?? token);
  }, [snapshot, optimisticTokens]);

  useEffect(() => {
    function syncInvert() {
      setCarouselInvert(readScreenCarouselInvert());
    }
    function onStorage(event: StorageEvent) {
      if (event.key === null || event.key === "dms-screen-carousel-invert") {
        syncInvert();
      }
    }
    window.addEventListener(SCREEN_CAROUSEL_INVERT_EVENT, syncInvert);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(SCREEN_CAROUSEL_INVERT_EVENT, syncInvert);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

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
    return () => {
      useRoomStore.getState().clearJoinCredentials();
    };
  }, []);

  const activeTokenId = useMemo(() => {
    const initiative = snapshot?.initiative;
    if (!initiative || initiative.order.length === 0) {
      return null;
    }
    return initiative.order[initiative.activeIndex]?.tokenId ?? null;
  }, [snapshot?.initiative]);

  const lockedZoom = useMemo(() => {
    if (role !== "screen" || screenMode !== "physical") {
      return null;
    }
    const cellCm = snapshot?.settings.physicalCellCm;
    const gridPx = snapshot?.map?.gridPx;
    if (!screenCalibration || cellCm === null || cellCm === undefined || !gridPx) {
      return null;
    }
    try {
      return physicalZoom(screenCalibration.pxPerCm, cellCm, gridPx);
    } catch {
      return null;
    }
  }, [
    role,
    screenMode,
    screenCalibration,
    snapshot?.settings.physicalCellCm,
    snapshot?.map?.gridPx,
  ]);

  function onTokenMove(tokenId: string, x: number, y: number) {
    const next = moveTokenOptimistic(tokenId, x, y);
    if (!next) {
      return;
    }
    getSocket().emit(ClientEvents.TokenMove, { tokenId, x: next.x, y: next.y });
  }

  function onSpawnPlace(x: number, y: number) {
    if (!snapshot?.map) {
      return;
    }
    const mapId = snapshot.map.id;
    const existing = snapshot.spawnPoints.filter((point) => point.mapId === mapId);
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `sp-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    getSocket().emit(ClientEvents.SpawnSet, {
      mapId,
      points: [
        ...existing.map((point) => ({
          id: point.id,
          label: point.label,
          x: point.x,
          y: point.y,
          assignedCharacterId: point.assignedCharacterId,
        })),
        { id, label: `Spawn ${existing.length + 1}`, x, y, assignedCharacterId: null },
      ],
    });
  }

  useEffect(() => {
    if (!lastMovementReject) {
      return;
    }
    const timer = window.setTimeout(() => clearMovementReject(), 3500);
    return () => window.clearTimeout(timer);
  }, [lastMovementReject, clearMovementReject]);

  useEffect(() => {
    if (role !== "screen" || !screenFullscreen) {
      return;
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setScreenFullscreen(false);
        saveScreenFullscreen(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [role, screenFullscreen]);

  function toggleScreenFullscreen(next?: boolean) {
    const value = next ?? !screenFullscreen;
    setScreenFullscreen(value);
    saveScreenFullscreen(value);
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

  function onWallAddSegment(a: { x: number; y: number }, b: { x: number; y: number }) {
    if (!snapshot?.map) {
      return;
    }
    getSocket().emit(ClientEvents.WallAddSegment, {
      mapId: snapshot.map.id,
      a,
      b,
    });
  }

  function onObstaclePlace(kind: "seeThrough" | "solid", x: number, y: number) {
    if (!snapshot?.map) {
      return;
    }
    getSocket().emit(ClientEvents.ObstaclePlace, {
      mapId: snapshot.map.id,
      kind,
      x,
      y,
    });
  }

  function onObstacleRemove(id: string) {
    if (!snapshot?.map) {
      return;
    }
    getSocket().emit(ClientEvents.ObstacleRemove, {
      mapId: snapshot.map.id,
      id,
    });
  }

  function onFogPaint(stroke: FogStrokeInput) {
    if (role !== "gm" || !snapshot?.map) {
      return;
    }
    getSocket().emit(ClientEvents.FogPaint, { mapId: snapshot.map.id, stroke });
  }

  const isGm = role === "gm";
  const isScreen = role === "screen";
  const showPrep = isGm && gmMode === "prep";
  const showSettings = isGm && gmMode === "settings";
  const showPlayChrome = isGm && gmMode === "play";
  const showPanel = showPrep || showSettings;
  const screenFs = isScreen && screenFullscreen;
  const carouselPlacement = snapshot?.settings.screenCarousel ?? DEFAULT_SCREEN_CAROUSEL;

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
    <main
      className={[
        isGm || isScreen || role === "player" ? "play-shell" : "app-shell",
        screenFs ? "play-shell--screen-fs" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {!screenFs ? (
        <header className="play-topbar">
          <div>
            <p className="muted">
              {connected ? "Connected" : "Connecting…"} · {role}
              {snapshot?.playerName ? ` · ${snapshot.playerName}` : ""}
              {isGm && (fogTool === "brush" || fogTool === "rect") ? " · Fog tool" : ""}
              {isGm && fogTool === "wall" ? " · Wall tool" : ""}
              {isGm && fogTool === "obstacle-seeThrough" ? " · Obstacle (see-through)" : ""}
              {isGm && fogTool === "obstacle-solid" ? " · Obstacle (solid)" : ""}
              {isGm && spawnTool ? " · Spawn tool" : ""}
            </p>
            <h1 className="brand brand--compact">Room {code}</h1>
          </div>
          <div className="row">
            <LanternToggle />
            {isScreen && snapshot ? (
              <>
                <ScreenDisplayControls
                  settings={snapshot.settings}
                  mode={screenMode}
                  calibration={screenCalibration}
                  onModeChange={setScreenMode}
                  onCalibrationChange={setScreenCalibration}
                />
                <button type="button" className="secondary" onClick={() => toggleScreenFullscreen(true)}>
                  Fullscreen
                </button>
              </>
            ) : null}
            {isGm ? (
              <>
                <button
                  className={gmMode === "play" ? "is-active" : "secondary"}
                  onClick={() => setGmMode("play")}
                >
                  Play
                </button>
                <button
                  className={gmMode === "prep" ? "is-active" : "secondary"}
                  onClick={() => {
                    setFogTool("off");
                    setSpawnTool(false);
                    setGmMode("prep");
                  }}
                >
                  Prep
                </button>
                <button
                  className={gmMode === "settings" ? "is-active" : "secondary"}
                  onClick={() => {
                    setFogTool("off");
                    setSpawnTool(false);
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
      ) : null}

      {joining && !screenFs ? <p className="lede">Joining room…</p> : null}
      {error && !screenFs ? <p className="error">{error}</p> : null}
      {lastMovementReject && !screenFs ? (
        <p className="error" role="status">
          Movement blocked: {lastMovementReject.reason}
        </p>
      ) : null}

      {snapshot && showPanel ? (
        <SettingsPanel
          variant={showPrep ? "prep" : "settings"}
          code={code}
          maps={snapshot.maps}
          activeMapId={snapshot.map?.id ?? null}
          characters={snapshot.characters}
          settings={snapshot.settings}
          uploadToken={uploadToken}
          encounters={snapshot.encounters}
          prepNotes={snapshot.prepNotes}
          onClose={() => setGmMode("play")}
        />
      ) : null}

      {snapshot && !showPanel ? (
        <div
          className={[
            "play-stage",
            role !== "gm" && !screenFs ? "play-stage--with-rail" : "",
            screenFs ? "play-stage--screen-fs" : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {role !== "gm" && !screenFs ? (
            <div className="play-stage__side stack">
              <aside className="initiative-rail turn-carousel-rail" aria-label="Initiative">
                <TurnCarousel
                  role={role}
                  selfCharacterId={snapshot.characterId}
                  initiative={snapshot.initiative}
                  tokens={tokens}
                  characters={snapshot.characters}
                  movement={role === "player" ? snapshot.movement : null}
                />
              </aside>
              <SessionStrip battle={snapshot.battle} events={snapshot.eventLog} />
            </div>
          ) : null}

          <div className="play-stage__map">
            {!snapshot.map ? (
              <p className="lede play-stage__empty">Waiting for the GM to upload a map…</p>
            ) : null}
            <div className={`map-table ${screenFs ? "map-table--screen-fs" : ""}`}>
              <div className="map-table__well">
                <MapCanvas
                  map={snapshot.map}
                  tokens={tokens}
                  characters={snapshot.characters}
                  camera={snapshot.camera}
                  role={role}
                  characterId={snapshot.characterId}
                  activeTokenId={activeTokenId}
                  fog={snapshot.fog}
                  fogTool={isGm ? fogTool : "off"}
                  fogPaintMode={fogPaintMode}
                  fogBrushRadius={fogBrushRadius}
                  screenDisplayMode={isScreen ? screenMode : "fit"}
                  lockedZoom={lockedZoom}
                  initialPhysicalCamera={isScreen ? physicalCamera : null}
                  onTokenMove={onTokenMove}
                  onCameraChange={onCameraChange}
                  onPhysicalCameraChange={
                    isScreen ? (camera) => savePhysicalCamera(camera) : undefined
                  }
                  onFogPaint={onFogPaint}
                  onPortalToggle={isGm ? onPortalToggle : undefined}
                  spawnTool={isGm && spawnTool}
                  spawnPoints={snapshot.spawnPoints}
                  onSpawnPlace={isGm ? onSpawnPlace : undefined}
                  onWallAddSegment={isGm ? onWallAddSegment : undefined}
                  onObstaclePlace={isGm ? onObstaclePlace : undefined}
                  onObstacleRemove={isGm ? onObstacleRemove : undefined}
                  movement={snapshot.movement}
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
                fog={snapshot.fog}
                lastDice={lastDice}
                recentDice={recentDice}
                hasLosGeometry={
                  (snapshot.map?.walls.length ?? 0) > 0 ||
                  (snapshot.map?.portals.length ?? 0) > 0 ||
                  (snapshot.map?.obstacles.some((obstacle) => obstacle.kind === "solid") ?? false)
                }
                portals={snapshot.map?.portals ?? []}
                losEnabled={snapshot.fog?.losEnabled ?? false}
                fogTool={fogTool}
                fogPaintMode={fogPaintMode}
                fogBrushRadius={fogBrushRadius}
                onFogToolChange={(tool) => {
                  if (tool !== "off") {
                    setSpawnTool(false);
                  }
                  setFogTool(tool);
                }}
                onFogPaintModeChange={setFogPaintMode}
                onFogBrushRadiusChange={setFogBrushRadius}
                onPortalToggle={onPortalToggle}
                spawnPoints={snapshot.spawnPoints}
                spawnTool={spawnTool}
                onSpawnToolChange={setSpawnTool}
                movement={snapshot.movement}
              />
            ) : null}

            {screenFs ? (
              <>
                <ScreenFanCarousel
                  role={role}
                  initiative={snapshot.initiative}
                  tokens={tokens}
                  characters={snapshot.characters}
                  placement={carouselPlacement}
                  draggable
                  invertFacing={carouselInvert}
                />
                <div className="screen-fs-controls">
                  <button
                    type="button"
                    className={carouselInvert ? "is-active" : "secondary"}
                    aria-pressed={carouselInvert}
                    title="Flip Screen/TV card facing outside-in or toward center"
                    onClick={() => {
                      const next = !carouselInvert;
                      writeScreenCarouselInvert(next);
                      setCarouselInvert(next);
                    }}
                  >
                    Flip
                  </button>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => toggleScreenFullscreen(false)}
                  >
                    Exit fullscreen
                  </button>
                  <span className="muted screen-fs-controls__hint">Esc</span>
                </div>
              </>
            ) : null}

            {role !== "gm" && !screenFs ? <DiceToast lastDice={lastDice} /> : null}
            {screenFs ? <DiceToast lastDice={lastDice} /> : null}
          </div>
        </div>
      ) : null}
    </main>
  );
}
