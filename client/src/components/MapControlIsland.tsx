import { ClientEvents, type MapState, type VisibilityState } from "@dms/shared";
import { getSocket } from "../socket/socket";
import { PlayIsland } from "./PlayIsland";
import type { Corner } from "../lib/islandLayout";

type Props = {
  maps: MapState[];
  activeMap: MapState | null;
  visibility: VisibilityState;
  corner: Corner;
  onCycleCorner: () => void;
};

export function MapControlIsland({
  maps,
  activeMap,
  visibility,
  corner,
  onCycleCorner,
}: Props) {
  function activate(mapId: string) {
    getSocket().emit(ClientEvents.MapActivate, { mapId });
  }

  function setVisibility(patch: Partial<VisibilityState>) {
    getSocket().emit(ClientEvents.VisibilitySet, patch);
  }

  return (
    <PlayIsland title="Map" corner={corner} onCycleCorner={onCycleCorner}>
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
