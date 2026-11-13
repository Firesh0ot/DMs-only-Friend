import { ClientEvents, type FogPaintMode, type PortalState } from "@dms/shared";
import { getSocket } from "../socket/socket";
import type { FogToolMode } from "../canvas/useMapScene";

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

  return (
    <div className="hud-fog stack">
      <p className="muted hud-muted">
        {tool === "off" ? "Tool off" : "Paint to reveal or hide"}
      </p>
      <div className="hud-fog__tools" role="group" aria-label="Fog tool">
        <button
          type="button"
          className={tool === "off" ? "is-active hud-chip" : "secondary hud-chip"}
          onClick={() => onToolChange("off")}
        >
          Off
        </button>
        <button
          type="button"
          className={tool === "brush" ? "is-active hud-chip" : "secondary hud-chip"}
          onClick={() => onToolChange("brush")}
          disabled={!mapId}
        >
          Brush
        </button>
        <button
          type="button"
          className={tool === "rect" ? "is-active hud-chip" : "secondary hud-chip"}
          onClick={() => onToolChange("rect")}
          disabled={!mapId}
        >
          Rect
        </button>
      </div>
      <div className="hud-fog__tools" role="group" aria-label="Fog paint mode">
        <button
          type="button"
          className={paintMode === "reveal" ? "is-active hud-chip" : "secondary hud-chip"}
          onClick={() => onPaintModeChange("reveal")}
        >
          Reveal
        </button>
        <button
          type="button"
          className={paintMode === "hide" ? "is-active hud-chip" : "secondary hud-chip"}
          onClick={() => onPaintModeChange("hide")}
        >
          Hide
        </button>
      </div>
      <label className="hud-fog__brush">
        <span className="muted">Brush {brushRadius}px</span>
        <input
          type="range"
          min={12}
          max={120}
          step={4}
          value={brushRadius}
          onChange={(event) => onBrushRadiusChange(Number(event.target.value))}
          disabled={tool !== "brush"}
        />
      </label>
      <div className="hud-fog__tools">
        <button
          type="button"
          className="secondary hud-chip"
          disabled={!mapId}
          onClick={() => reset(true)}
        >
          Cover
        </button>
        <button
          type="button"
          className="secondary hud-chip"
          disabled={!mapId}
          onClick={() => reset(false)}
        >
          Clear
        </button>
        <button
          type="button"
          className={losEnabled ? "is-active hud-chip" : "secondary hud-chip"}
          disabled={!mapId || !hasLosGeometry}
          onClick={() => setLos(!losEnabled)}
          title={
            hasLosGeometry
              ? "Toggle automatic line-of-sight fog"
              : "Import a .dd2vtt map with walls or doors"
          }
        >
          LoS {losEnabled ? "on" : "off"}
        </button>
      </div>
      {portals.length > 0 ? (
        <div className="hud-fog__doors" role="group" aria-label="Doors">
          <span className="muted hud-muted">Doors</span>
          <div className="hud-fog__tools">
            {portals.map((portal, index) => (
              <button
                key={portal.id}
                type="button"
                className={portal.closed ? "secondary hud-chip" : "is-active hud-chip"}
                disabled={!mapId}
                onClick={() => onPortalToggle(portal.id, !portal.closed)}
                title={portal.closed ? "Open door" : "Close door"}
              >
                D{index + 1} {portal.closed ? "shut" : "open"}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
