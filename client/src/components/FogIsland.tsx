import { ClientEvents, type FogPaintMode, type PortalState } from "@dms/shared";
import { getSocket } from "../socket/socket";
import type { FogToolMode } from "../canvas/useMapScene";
import type { IslandDockProps } from "./islandDock";
import { PlayIsland } from "./PlayIsland";

type Props = IslandDockProps & {
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

export function FogIsland({
  mapId,
  hasLosGeometry,
  portals,
  losEnabled,
  tool,
  paintMode,
  brushRadius,
  side,
  collapsed,
  canMoveUp,
  canMoveDown,
  onToolChange,
  onPaintModeChange,
  onBrushRadiusChange,
  onToggleCollapsed,
  onDockSide,
  onMoveInSide,
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
    <PlayIsland
      title="Fog"
      side={side}
      collapsed={collapsed}
      canMoveUp={canMoveUp}
      canMoveDown={canMoveDown}
      onToggleCollapsed={onToggleCollapsed}
      onDockSide={onDockSide}
      onMoveInSide={onMoveInSide}
    >
      <p className="muted">
        {tool === "off" ? "Tool off — pan and move tokens." : "Paint on the map to reveal or hide."}
      </p>
      <div className="fog-island__tools" role="group" aria-label="Fog tool">
        <button
          type="button"
          className={tool === "off" ? "is-active" : "secondary"}
          onClick={() => onToolChange("off")}
        >
          Off
        </button>
        <button
          type="button"
          className={tool === "brush" ? "is-active" : "secondary"}
          onClick={() => onToolChange("brush")}
          disabled={!mapId}
        >
          Brush
        </button>
        <button
          type="button"
          className={tool === "rect" ? "is-active" : "secondary"}
          onClick={() => onToolChange("rect")}
          disabled={!mapId}
        >
          Rect
        </button>
      </div>
      <div className="fog-island__tools" role="group" aria-label="Fog paint mode">
        <button
          type="button"
          className={paintMode === "reveal" ? "is-active" : "secondary"}
          onClick={() => onPaintModeChange("reveal")}
        >
          Reveal
        </button>
        <button
          type="button"
          className={paintMode === "hide" ? "is-active" : "secondary"}
          onClick={() => onPaintModeChange("hide")}
        >
          Hide
        </button>
      </div>
      <label className="stack">
        <span className="muted">Brush size ({brushRadius}px)</span>
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
      <div className="fog-island__tools">
        <button type="button" className="secondary" disabled={!mapId} onClick={() => reset(true)}>
          Cover all
        </button>
        <button type="button" className="secondary" disabled={!mapId} onClick={() => reset(false)}>
          Clear all
        </button>
      </div>
      <div className="fog-island__tools" role="group" aria-label="Line of sight fog">
        <button
          type="button"
          className={losEnabled ? "is-active" : "secondary"}
          disabled={!mapId || !hasLosGeometry}
          onClick={() => setLos(!losEnabled)}
          title={
            hasLosGeometry
              ? "Toggle automatic line-of-sight fog from walls and doors"
              : "Import a .dd2vtt map with walls or doors to enable LoS"
          }
        >
          LoS {losEnabled ? "on" : "off"}
        </button>
      </div>
      {portals.length > 0 ? (
        <div className="fog-island__doors" role="group" aria-label="Doors">
          <span className="muted">Doors (click map or here)</span>
          <div className="fog-island__tools">
            {portals.map((portal, index) => (
              <button
                key={portal.id}
                type="button"
                className={portal.closed ? "secondary" : "is-active"}
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
      <p className="muted fog-island__hint">
        {hasLosGeometry
          ? "LoS hides areas behind walls and closed doors from PC tokens; manual fog still applies. Open doors let vision through. Players see solid fog; you see it translucent."
          : "Players see solid fog; you see it translucent for editing. LoS needs .dd2vtt walls or doors."}
      </p>
    </PlayIsland>
  );
}
