import { useMemo, useState } from "react";
import {
  ClientEvents,
  type CharacterKind,
  type CharacterState,
  type MapState,
} from "@dms/shared";
import { getSocket } from "../socket/socket";

type Props = {
  code: string;
  maps: MapState[];
  activeMapId: string | null;
  characters: CharacterState[];
  onClose: () => void;
};

export function SettingsPanel({
  code,
  maps,
  activeMapId,
  characters,
  onClose,
}: Props) {
  const [uploadGridPx, setUploadGridPx] = useState("70");
  const [mapName, setMapName] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [charName, setCharName] = useState("");
  const [charKind, setCharKind] = useState<CharacterKind>("pc");
  const [charMapIds, setCharMapIds] = useState<string[]>([]);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const links = useMemo(
    () => ({
      gm: `${origin}/#/room/${code}?role=gm`,
      screen: `${origin}/#/room/${code}?role=screen`,
      player: `${origin}/#/room/${code}?role=player`,
    }),
    [origin, code],
  );

  async function onUpload(file: File | null) {
    if (!file) {
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const body = new FormData();
      body.append("map", file);
      body.append("gridPx", uploadGridPx);
      if (mapName.trim()) {
        body.append("name", mapName.trim());
      }
      const response = await fetch(`/api/rooms/${code}/map`, {
        method: "POST",
        body,
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? "Upload failed");
      }
      setMessage(`Uploaded ${file.name}`);
      setMapName("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  function updateGrid(mapId: string, gridPx: string) {
    const value = Number(gridPx);
    if (!Number.isInteger(value) || value < 8 || value > 512) {
      setMessage("grid_px must be 8–512");
      return;
    }
    getSocket().emit(ClientEvents.MapUpdateGrid, { mapId, gridPx: value });
  }

  function removeMap(mapId: string) {
    getSocket().emit(ClientEvents.MapRemove, { mapId });
  }

  function activateMap(mapId: string) {
    getSocket().emit(ClientEvents.MapActivate, { mapId });
  }

  function upsertCharacter(existing?: CharacterState) {
    const name = (existing ? existing.name : charName).trim();
    if (!name) {
      return;
    }
    getSocket().emit(ClientEvents.CharacterUpsert, {
      id: existing?.id,
      name,
      kind: existing?.kind ?? charKind,
      mapIds: existing ? existing.mapIds : charMapIds,
      sizeCells: existing?.sizeCells ?? 1,
      image: existing?.image ?? null,
    });
    if (!existing) {
      setCharName("");
      setCharMapIds([]);
    }
  }

  function toggleCharacterMap(character: CharacterState, mapId: string) {
    const mapIds = character.mapIds.includes(mapId)
      ? character.mapIds.filter((id) => id !== mapId)
      : [...character.mapIds, mapId];
    getSocket().emit(ClientEvents.CharacterUpsert, {
      id: character.id,
      name: character.name,
      kind: character.kind,
      mapIds,
      sizeCells: character.sizeCells,
      image: character.image,
    });
  }

  function removeCharacter(characterId: string) {
    getSocket().emit(ClientEvents.CharacterRemove, { characterId });
  }

  return (
    <section className="settings-panel panel stack">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h2>Settings</h2>
        <button className="secondary" onClick={onClose}>
          Back to Play
        </button>
      </div>

      <section className="stack">
        <h3>Room links</h3>
        <p className="muted mono">Code {code}</p>
        <label className="stack">
          <span className="muted">GM</span>
          <input readOnly value={links.gm} onFocus={(event) => event.target.select()} />
        </label>
        <label className="stack">
          <span className="muted">Screen</span>
          <input readOnly value={links.screen} onFocus={(event) => event.target.select()} />
        </label>
        <label className="stack">
          <span className="muted">Player</span>
          <input readOnly value={links.player} onFocus={(event) => event.target.select()} />
        </label>
      </section>

      <section className="stack">
        <h3>Maps</h3>
        <label className="stack">
          <span className="muted">Name (optional)</span>
          <input
            value={mapName}
            onChange={(event) => setMapName(event.target.value)}
            placeholder="Cave entrance"
          />
        </label>
        <label className="stack">
          <span className="muted">grid_px</span>
          <div className="row">
            <input
              style={{ maxWidth: "6rem" }}
              value={uploadGridPx}
              onChange={(event) => setUploadGridPx(event.target.value)}
            />
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              disabled={busy}
              onChange={(event) => void onUpload(event.target.files?.[0] ?? null)}
            />
          </div>
        </label>

        <ul className="token-list">
          {maps.map((map) => (
            <li key={map.id} className={map.id === activeMapId ? "active" : undefined}>
              <div className="stack" style={{ flex: 1, gap: "0.35rem" }}>
                <strong>{map.name}</strong>
                <span className="muted">
                  {map.width}×{map.height}
                </span>
                <div className="row">
                  <input
                    style={{ maxWidth: "5rem" }}
                    defaultValue={String(map.gridPx)}
                    aria-label={`grid_px for ${map.name}`}
                    onBlur={(event) => updateGrid(map.id, event.target.value)}
                  />
                  <button className="secondary" onClick={() => activateMap(map.id)}>
                    Active
                  </button>
                  <button className="secondary" onClick={() => removeMap(map.id)}>
                    Remove
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="stack">
        <h3>Characters</h3>
        <div className="row">
          <input
            value={charName}
            onChange={(event) => setCharName(event.target.value)}
            placeholder="Name"
          />
          <select
            value={charKind}
            onChange={(event) => setCharKind(event.target.value as CharacterKind)}
          >
            <option value="pc">PC</option>
            <option value="npc">NPC</option>
          </select>
          <button onClick={() => upsertCharacter()}>Add</button>
        </div>
        {maps.length > 0 ? (
          <div className="row">
            {maps.map((map) => (
              <label key={map.id} className="row" style={{ gap: "0.35rem" }}>
                <input
                  type="checkbox"
                  checked={charMapIds.includes(map.id)}
                  onChange={() =>
                    setCharMapIds((current) =>
                      current.includes(map.id)
                        ? current.filter((id) => id !== map.id)
                        : [...current, map.id],
                    )
                  }
                />
                <span className="muted">{map.name}</span>
              </label>
            ))}
          </div>
        ) : (
          <p className="muted">Upload a map before linking characters.</p>
        )}

        <ul className="token-list">
          {characters.map((character) => (
            <li key={character.id}>
              <div className="stack" style={{ flex: 1, gap: "0.35rem" }}>
                <span>
                  {character.name}{" "}
                  <span className="muted">({character.kind.toUpperCase()})</span>
                </span>
                <div className="row">
                  {maps.map((map) => (
                    <label key={map.id} className="row" style={{ gap: "0.35rem" }}>
                      <input
                        type="checkbox"
                        checked={character.mapIds.includes(map.id)}
                        onChange={() => toggleCharacterMap(character, map.id)}
                      />
                      <span className="muted">{map.name}</span>
                    </label>
                  ))}
                  <button className="secondary" onClick={() => removeCharacter(character.id)}>
                    Remove
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {message ? <p className="muted">{message}</p> : null}
    </section>
  );
}
