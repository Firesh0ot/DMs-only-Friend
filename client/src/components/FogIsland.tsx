import { ClientEvents, type FogPaintMode } from "@dms/shared";
import { getSocket } from "../socket/socket";
import type { FogToolMode } from "../canvas/useMapScene";
import type { Corner } from "../lib/islandLayout";
import { PlayIsland } from "./PlayIsland";

type Props = {
  mapId: string | null;
  hasWalls: boolean;
  losEnabled: boolean;
  tool: FogToolMode;
  paintMode: FogPaintMode;
  brushRadius: number;
  corner: Corner;
  onToolChange: (tool: FogToolMode) => void;
  onPaintModeChange: (mode: FogPaintMode) => void;
  onBrushRadiusChange: (radius: number) => void;
  onCycleCorner: () => void;
};

export function FogIsland({
  mapId,
  hasWalls,
  losEnabled,
  tool,
  paintMode,
  brushRadius,
  corner,
  onToolChange,
  onPaintModeChange,
  onBrushRadiusChange,
  onCycleCorner,
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
    <PlayIsland title="Fog" corner={corner} onCycleCorner={onCycleCorner}>
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
          disabled={!mapId || !hasWalls}
          onClick={() => setLos(!losEnabled)}
          title={
            hasWalls
              ? "Toggle automatic line-of-sight fog from walls"
              : "Import a .dd2vtt map with walls to enable LoS"
          }
        >
          LoS {losEnabled ? "on" : "off"}
        </button>
      </div>
      <p className="muted fog-island__hint">
        {hasWalls
          ? "LoS hides areas behind walls from PC tokens; manual fog still applies. Players see solid fog; you see it translucent."
          : "Players see solid fog; you see it translucent for editing. LoS needs .dd2vtt walls."}
      </p>
    </PlayIsland>
  );
}
