import { ClientEvents, type FogPaintMode, type PortalState } from "@dms/shared";
import { getSocket } from "../socket/socket";
import type { FogToolMode } from "../canvas/useMapScene";

const BRUSH_MIN = 12;
const BRUSH_MAX = 120;
const BRUSH_STEP = 4;

type Props = {
  mapId: string | null;
  hasLosGeometry: boolean;
  portals: PortalState[];
  losEnabled: boolean;
  tool: FogToolMode;
  paintMode: FogPaintMode;
  brushRadius: number;
  onToolChange: (tool: FogToolMode) => void;
  onPaintModeChange: (mode: FogPaintMode) => void;
  onBrushRadiusChange: (radius: number) => void;
  onPortalToggle: (portalId: string, closed: boolean) => void;
};

function IconHand() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="hud-fog-rail__glyph">
      <path
        fill="currentColor"
        d="M8.5 11.2V6.4a1.4 1.4 0 0 1 2.8 0v3.3h.3V4.9a1.4 1.4 0 0 1 2.8 0v4.8h.3V5.6a1.4 1.4 0 1 1 2.8 0v6.2c0 .3.1.5.3.7l1.4 1.5a1.5 1.5 0 0 1-2.1 2.1l-.9-.9v2.3a2.5 2.5 0 0 1-2.5 2.5h-2.2a4.5 4.5 0 0 1-4.5-4.5v-4.3a1.4 1.4 0 0 1 2.8 0v2.1Z"
      />
    </svg>
  );
}

function IconBrush() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="hud-fog-rail__glyph">
      <path
        fill="currentColor"
        d="M7.2 14.4c1.8 0 3.2 1.4 3.2 3.2 0 1.9-1.8 3.4-3.6 3.4S3 19.5 3 17.6c0-1 .8-1.7 1.4-2.3.5-.5 1-.9 1.2-1.4.2-.4.6-.5 1.6-.5Zm9.3-11.1 4.2 4.2c.5.5.5 1.3 0 1.8l-6.5 6.5c-.4.4-.9.6-1.4.7l-3 .5c-.6.1-1.1-.4-1-.1l.5-3c.1-.5.3-1 .7-1.4l6.5-6.5c.5-.5 1.3-.5 1.8 0Z"
      />
    </svg>
  );
}

function IconRect() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="hud-fog-rail__glyph">
      <rect
        x="4.5"
        y="6.5"
        width="15"
        height="11"
        rx="1.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />
    </svg>
  );
}

function IconMinus() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="hud-fog-rail__glyph">
      <path fill="currentColor" d="M6 11h12v2H6z" />
    </svg>
  );
}

function IconPlus() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="hud-fog-rail__glyph">
      <path fill="currentColor" d="M11 6h2v5h5v2h-5v5h-2v-5H6v-2h5z" />
    </svg>
  );
}

function IconEye() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="hud-fog-rail__glyph">
      <path
        fill="currentColor"
        d="M12 5c5.2 0 9.4 3.4 10.7 7-1.3 3.6-5.5 7-10.7 7S2.6 15.6 1.3 12C2.6 8.4 6.8 5 12 5Zm0 3.2A3.8 3.8 0 1 0 12 15.8 3.8 3.8 0 0 0 12 8.2Zm0 2a1.8 1.8 0 1 1 0 3.6 1.8 1.8 0 0 1 0-3.6Z"
      />
    </svg>
  );
}

function IconEyeSlash() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="hud-fog-rail__glyph">
      <path
        fill="currentColor"
        d="M3.3 4.7 4.7 3.3l16 16-1.4 1.4-2.5-2.5C15.3 18.7 13.7 19 12 19 6.8 19 2.6 15.6 1.3 12c.5-1.4 1.5-2.8 2.8-3.9L3.3 4.7Zm5.2 5.2A3.8 3.8 0 0 0 12 15.8c.4 0 .8-.1 1.2-.2l-1.5-1.5a1.8 1.8 0 0 1-2.1-2.1L8.5 9.9Zm13.2 2.1c-.4 1.1-1.1 2.2-2 3.1l-2.2-2.2a3.8 3.8 0 0 0-4.3-4.3L11 6.4c.3 0 .7-.1 1-.1 5.2 0 9.4 3.4 10.7 7Z"
      />
    </svg>
  );
}

function IconLos() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="hud-fog-rail__glyph">
      <circle cx="12" cy="12" r="2.2" fill="currentColor" />
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        d="M12 4.5v2.2M12 17.3v2.2M4.5 12h2.2M17.3 12h2.2M6.4 6.4l1.6 1.6M16 16l1.6 1.6M17.6 6.4 16 8M8 16l-1.6 1.6"
      />
    </svg>
  );
}

function IconReveal() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="hud-fog-rail__glyph">
      <circle cx="12" cy="12" r="7.5" fill="none" stroke="currentColor" strokeWidth="2" />
      <path fill="currentColor" d="M11 8h2v3h3v2h-3v3h-2v-3H8v-2h3z" />
    </svg>
  );
}

function IconHide() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="hud-fog-rail__glyph">
      <circle cx="12" cy="12" r="7.5" fill="currentColor" opacity="0.22" />
      <circle cx="12" cy="12" r="7.5" fill="none" stroke="currentColor" strokeWidth="2" />
      <path fill="currentColor" d="M8 11h8v2H8z" />
    </svg>
  );
}

function IconDoor() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="hud-fog-rail__glyph">
      <path
        fill="currentColor"
        d="M6 3.5h10.5A1.5 1.5 0 0 1 18 5v14.5H6V3.5Zm8.2 8.2a1.1 1.1 0 1 0 0 2.2 1.1 1.1 0 0 0 0-2.2Z"
      />
    </svg>
  );
}

export function HudFog({
  mapId,
  hasLosGeometry,
  portals,
  losEnabled,
  tool,
  paintMode,
  brushRadius,
  onToolChange,
  onPaintModeChange,
  onBrushRadiusChange,
  onPortalToggle,
}: Props) {
  function reset(baseCovered: boolean) {
    if (!mapId) {
      return;
    }
    getSocket().emit(ClientEvents.FogReset, { mapId, baseCovered });
  }

  function setLos(enabled: boolean) {
    if (!mapId) {
      return;
    }
    getSocket().emit(ClientEvents.FogSetLos, { mapId, enabled });
  }

  function nudgeBrush(delta: number) {
    const next = Math.min(BRUSH_MAX, Math.max(BRUSH_MIN, brushRadius + delta));
    onBrushRadiusChange(next);
  }

  function toolClass(active: boolean) {
    return `hud-fog-rail__btn${active ? " is-active" : ""}`;
  }

  return (
    <aside className="hud-fog-rail" aria-label="Fog tools">
      <div className="hud-fog-rail__group" role="group" aria-label="Fog tool">
        <button
          type="button"
          className={toolClass(tool === "off")}
          onClick={() => onToolChange("off")}
          title="Pan / move tokens"
          aria-label="Fog tool off"
          aria-pressed={tool === "off"}
        >
          <IconHand />
        </button>
        <button
          type="button"
          className={toolClass(tool === "brush")}
          onClick={() => onToolChange("brush")}
          disabled={!mapId}
          title="Brush"
          aria-label="Fog brush"
          aria-pressed={tool === "brush"}
        >
          <IconBrush />
        </button>
        <button
          type="button"
          className={toolClass(tool === "rect")}
          onClick={() => onToolChange("rect")}
          disabled={!mapId}
          title="Rectangle"
          aria-label="Fog rectangle"
          aria-pressed={tool === "rect"}
        >
          <IconRect />
        </button>
      </div>

      <div className="hud-fog-rail__group" role="group" aria-label="Brush size">
        <button
          type="button"
          className="hud-fog-rail__btn"
          onClick={() => nudgeBrush(-BRUSH_STEP)}
          disabled={tool !== "brush" || brushRadius <= BRUSH_MIN}
          title={`Smaller brush (${brushRadius}px)`}
          aria-label="Decrease brush size"
        >
          <IconMinus />
        </button>
        <span className="hud-fog-rail__size" aria-hidden="true">
          {brushRadius}
        </span>
        <button
          type="button"
          className="hud-fog-rail__btn"
          onClick={() => nudgeBrush(BRUSH_STEP)}
          disabled={tool !== "brush" || brushRadius >= BRUSH_MAX}
          title={`Larger brush (${brushRadius}px)`}
          aria-label="Increase brush size"
        >
          <IconPlus />
        </button>
      </div>

      <div className="hud-fog-rail__group" role="group" aria-label="Reveal or hide">
        <button
          type="button"
          className={toolClass(paintMode === "reveal")}
          onClick={() => onPaintModeChange("reveal")}
          title="Reveal"
          aria-label="Reveal fog"
          aria-pressed={paintMode === "reveal"}
        >
          <IconReveal />
        </button>
        <button
          type="button"
          className={toolClass(paintMode === "hide")}
          onClick={() => onPaintModeChange("hide")}
          title="Hide"
          aria-label="Hide fog"
          aria-pressed={paintMode === "hide"}
        >
          <IconHide />
        </button>
      </div>

      <div className="hud-fog-rail__group" role="group" aria-label="Cover or clear">
        <button
          type="button"
          className="hud-fog-rail__btn"
          disabled={!mapId}
          onClick={() => reset(true)}
          title="Cover all"
          aria-label="Cover all fog"
        >
          <IconEyeSlash />
        </button>
        <button
          type="button"
          className="hud-fog-rail__btn"
          disabled={!mapId}
          onClick={() => reset(false)}
          title="Clear all"
          aria-label="Clear all fog"
        >
          <IconEye />
        </button>
      </div>

      <div className="hud-fog-rail__group" role="group" aria-label="Line of sight">
        <button
          type="button"
          className={toolClass(losEnabled)}
          disabled={!mapId || !hasLosGeometry}
          onClick={() => setLos(!losEnabled)}
          title={
            hasLosGeometry
              ? losEnabled
                ? "LoS on — click to turn off"
                : "LoS off — click to turn on"
              : "Import a .dd2vtt map with walls or doors"
          }
          aria-label={losEnabled ? "Line of sight on" : "Line of sight off"}
          aria-pressed={losEnabled}
        >
          <IconLos />
        </button>
      </div>

      {portals.length > 0 ? (
        <div className="hud-fog-rail__group" role="group" aria-label="Doors">
          {portals.map((portal, index) => (
            <button
              key={portal.id}
              type="button"
              className={toolClass(!portal.closed)}
              disabled={!mapId}
              onClick={() => onPortalToggle(portal.id, !portal.closed)}
              title={portal.closed ? `Door ${index + 1} shut — open` : `Door ${index + 1} open — close`}
              aria-label={
                portal.closed ? `Open door ${index + 1}` : `Close door ${index + 1}`
              }
              aria-pressed={!portal.closed}
            >
              <IconDoor />
              <span className="hud-fog-rail__door-n">{index + 1}</span>
            </button>
          ))}
        </div>
      ) : null}
    </aside>
  );
}
