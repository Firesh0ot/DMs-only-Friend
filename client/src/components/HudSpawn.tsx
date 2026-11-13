import { ClientEvents, type CharacterState, type SpawnPoint } from "@dms/shared";
import { getSocket } from "../socket/socket";

type Props = {
  mapId: string | null;
  characters: CharacterState[];
  spawnPoints: SpawnPoint[];
  toolActive: boolean;
  onToolChange: (active: boolean) => void;
};

export function HudSpawn({
  mapId,
  characters,
  spawnPoints,
  toolActive,
  onToolChange,
}: Props) {
  const mapPoints = mapId ? spawnPoints.filter((point) => point.mapId === mapId) : [];
  const pcs = characters.filter((character) => character.kind === "pc");

  function emitPoints(next: Array<Omit<SpawnPoint, "mapId" | "roomId"> & { assignedCharacterId: string | null }>) {
    if (!mapId) {
      return;
    }
    getSocket().emit(ClientEvents.SpawnSet, {
      mapId,
      points: next.map((point) => ({
        id: point.id,
        label: point.label,
        x: point.x,
        y: point.y,
        assignedCharacterId: point.assignedCharacterId,
      })),
    });
  }

  function assignCharacter(pointId: string, characterId: string | null) {
    emitPoints(
      mapPoints.map((point) =>
        point.id === pointId
          ? { ...point, assignedCharacterId: characterId }
          : point,
      ),
    );
  }

  function removePoint(pointId: string) {
    emitPoints(mapPoints.filter((point) => point.id !== pointId));
  }

  function applySpawn() {
    if (!mapId) {
      return;
    }
    getSocket().emit(ClientEvents.SpawnApply, { mapId });
  }

  return (
    <div className="hud-spawn stack" aria-label="Spawn points">
      <div className="row">
        <button
          type="button"
          className={toolActive ? "is-active hud-chip" : "secondary hud-chip"}
          disabled={!mapId}
          onClick={() => onToolChange(!toolActive)}
        >
          {toolActive ? "Spawn tool on" : "Spawn tool"}
        </button>
        <button
          type="button"
          className="hud-chip"
          disabled={!mapId || mapPoints.length === 0}
          onClick={applySpawn}
        >
          Apply spawn
        </button>
      </div>
      {toolActive ? (
        <p className="muted hud-muted">Click the map to place a spawn cell.</p>
      ) : null}
      {mapPoints.length === 0 ? (
        <p className="muted hud-muted">No spawn points on this map.</p>
      ) : (
        <ul className="hud-spawn__list stack">
          {mapPoints.map((point) => (
            <li key={point.id} className="row hud-spawn__row">
              <span>
                {point.label ?? "Spawn"} ({point.x},{point.y})
              </span>
              <select
                aria-label={`Assign character for spawn ${point.x},${point.y}`}
                value={point.assignedCharacterId ?? ""}
                onChange={(event) =>
                  assignCharacter(point.id, event.target.value ? event.target.value : null)
                }
              >
                <option value="">Free</option>
                {pcs.map((character) => (
                  <option key={character.id} value={character.id}>
                    {character.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="secondary hud-chip"
                onClick={() => removePoint(point.id)}
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
