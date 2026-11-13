import { ClientEvents, type MapState, type VisibilityState } from "@dms/shared";
import { getSocket } from "../socket/socket";
import type { IslandDockProps } from "./islandDock";
import { PlayIsland } from "./PlayIsland";

type Props = IslandDockProps & {
  maps: MapState[];
  activeMap: MapState | null;
  visibility: VisibilityState;
};

export function MapControlIsland({
  maps,
  activeMap,
  visibility,
  side,
  collapsed,
  canMoveUp,
  canMoveDown,
  onToggleCollapsed,
  onDockSide,
  onMoveInSide,
}: Props) {
  function activate(mapId: string) {
    getSocket().emit(ClientEvents.MapActivate, { mapId });
  }

  function setVisibility(patch: Partial<VisibilityState>) {
    getSocket().emit(ClientEvents.VisibilitySet, patch);
  }

  return (
    <PlayIsland
      title="Map"
      side={side}
      collapsed={collapsed}
      canMoveUp={canMoveUp}
      canMoveDown={canMoveDown}
      onToggleCollapsed={onToggleCollapsed}
      onDockSide={onDockSide}
      onMoveInSide={onMoveInSide}
    >
      <p className="muted">{activeMap ? activeMap.name : "No active map"}</p>
      <label className="stack">
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
      <label className="row">
        <input
          type="checkbox"
          checked={visibility.showPcs}
          onChange={(event) => setVisibility({ showPcs: event.target.checked })}
        />
        <span>Show PCs</span>
      </label>
      <label className="row">
        <input
          type="checkbox"
          checked={visibility.showNpcs}
          onChange={(event) => setVisibility({ showNpcs: event.target.checked })}
        />
        <span>Show NPCs</span>
      </label>
    </PlayIsland>
  );
}

