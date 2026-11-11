import { useId, useMemo, useState } from "react";
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

type DraftCharacter = {
  name: string;
  kind: CharacterKind;
  notes: string;
  mapIds: string[];
};

const emptyDraft = (): DraftCharacter => ({
  name: "",
  kind: "pc",
  notes: "",
  mapIds: [],
});

export function SettingsPanel({
  code,
  maps,
  activeMapId,
  characters,
  onClose,
}: Props) {
  const baseId = useId();
  const [uploadGridPx, setUploadGridPx] = useState("70");
  const [mapName, setMapName] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftCharacter>(emptyDraft);
  const [editingNotes, setEditingNotes] = useState<Record<string, string>>({});

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const links = useMemo(
    () => ({
      gm: `${origin}/#/room/${code}?role=gm`,
      screen: `${origin}/#/room/${code}?role=screen`,
      player: `${origin}/#/room/${code}?role=player`,
    }),
    [origin, code],
  );

  const pcs = characters.filter((character) => character.kind === "pc");
  const npcs = characters.filter((character) => character.kind === "npc");

  async function onUploadMap(file: File | null) {
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
      setMessage(`Uploaded map ${file.name}`);
      setMapName("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  async function onUploadPortrait(characterId: string, file: File | null) {
    if (!file) {
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const body = new FormData();
      body.append("portrait", file);
      const response = await fetch(`/api/rooms/${code}/characters/${characterId}/portrait`, {
        method: "POST",
        body,
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? "Portrait upload failed");
      }
      setMessage(`Portrait updated`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Portrait upload failed");
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

  function addCharacter() {
    const name = draft.name.trim();
    if (!name) {
      setMessage("Enter a display name for the character");
      return;
    }
    getSocket().emit(ClientEvents.CharacterUpsert, {
      name,
      kind: draft.kind,
      mapIds: draft.mapIds,
      notes: draft.notes.trim() || null,
      sizeCells: 1,
      image: null,
    });
    setDraft(emptyDraft());
    setMessage(`Added ${draft.kind.toUpperCase()} ${name}`);
  }

  function saveCharacter(character: CharacterState, patch: Partial<CharacterState>) {
    getSocket().emit(ClientEvents.CharacterUpsert, {
      id: character.id,
      name: (patch.name ?? character.name).trim(),
      kind: patch.kind ?? character.kind,
      mapIds: patch.mapIds ?? character.mapIds,
      notes:
        patch.notes !== undefined
          ? patch.notes
          : (editingNotes[character.id] ?? character.notes ?? null),
      sizeCells: character.sizeCells,
      image: character.image,
    });
  }

  function toggleCharacterMap(character: CharacterState, mapId: string) {
    const mapIds = character.mapIds.includes(mapId)
      ? character.mapIds.filter((id) => id !== mapId)
      : [...character.mapIds, mapId];
    saveCharacter(character, { mapIds });
  }

  function removeCharacter(characterId: string) {
    getSocket().emit(ClientEvents.CharacterRemove, { characterId });
  }

  function renderCharacterCard(character: CharacterState) {
    const notesId = `${baseId}-notes-${character.id}`;
    const portraitId = `${baseId}-portrait-${character.id}`;
    const notesValue = editingNotes[character.id] ?? character.notes ?? "";
    const initial = character.name.trim().charAt(0).toUpperCase() || "?";

    return (
      <li key={character.id} className={`character-card character-card--${character.kind}`}>
        <div className="character-card__portrait">
          {character.image ? (
            <img src={character.image} alt="" className="character-card__art" />
          ) : (
            <div className="character-card__placeholder" aria-hidden>
              {initial}
            </div>
          )}
          <label className="character-card__portrait-upload" htmlFor={portraitId}>
            <span className="visually-hidden">Upload portrait for {character.name}</span>
            <input
              id={portraitId}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              disabled={busy}
              onChange={(event) =>
                void onUploadPortrait(character.id, event.target.files?.[0] ?? null)
              }
            />
            Portrait
          </label>
        </div>

        <div className="character-card__body stack">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <strong>{character.name}</strong>
            <span className={`kind-pill kind-pill--${character.kind}`}>
              {character.kind.toUpperCase()}
            </span>
          </div>

          <label className="stack" htmlFor={notesId}>
            <span className="muted">Notes</span>
            <textarea
              id={notesId}
              rows={2}
              maxLength={500}
              value={notesValue}
              placeholder="Short description"
              onChange={(event) =>
                setEditingNotes((current) => ({
                  ...current,
                  [character.id]: event.target.value,
                }))
              }
              onBlur={() =>
                saveCharacter(character, {
                  notes: (editingNotes[character.id] ?? character.notes ?? "").trim() || null,
                })
              }
            />
          </label>

          <fieldset className="settings-fieldset">
            <legend className="muted">Maps</legend>
            {maps.length === 0 ? (
              <p className="muted">Upload a map before linking characters.</p>
            ) : (
              <div className="row">
                {maps.map((map) => {
                  const checkboxId = `${baseId}-${character.id}-${map.id}`;
                  return (
                    <label key={map.id} className="check-row" htmlFor={checkboxId}>
                      <input
                        id={checkboxId}
                        type="checkbox"
                        checked={character.mapIds.includes(map.id)}
                        onChange={() => toggleCharacterMap(character, map.id)}
                      />
                      <span>{map.name}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </fieldset>

          <div className="row">
            <button
              type="button"
              className="secondary"
              onClick={() => removeCharacter(character.id)}
            >
              Remove
            </button>
          </div>
        </div>
      </li>
    );
  }

  return (
    <section className="settings-panel panel stack" aria-labelledby={`${baseId}-title`}>
      <div className="settings-panel__header row">
        <h2 id={`${baseId}-title`}>Settings</h2>
        <button type="button" className="secondary" onClick={onClose}>
          Back to Play
        </button>
      </div>

      {message ? (
        <p className="settings-status" role="status" aria-live="polite">
          {message}
        </p>
      ) : null}

      <nav className="settings-toc" aria-label="Settings sections">
        <a href={`#${baseId}-maps`}>Maps</a>
        <a href={`#${baseId}-characters`}>Characters</a>
        <a href={`#${baseId}-links`}>Room links</a>
      </nav>

      <section className="settings-section stack" aria-labelledby={`${baseId}-maps`}>
        <h3 id={`${baseId}-maps`}>Maps</h3>
        <label className="stack" htmlFor={`${baseId}-map-name`}>
          <span className="muted">Name (optional)</span>
          <input
            id={`${baseId}-map-name`}
            value={mapName}
            onChange={(event) => setMapName(event.target.value)}
            placeholder="Cave entrance"
            autoComplete="off"
          />
        </label>
        <div className="row settings-upload-row">
          <label className="stack" htmlFor={`${baseId}-grid`}>
            <span className="muted">grid_px</span>
            <input
              id={`${baseId}-grid`}
              style={{ maxWidth: "6rem" }}
              value={uploadGridPx}
              inputMode="numeric"
              onChange={(event) => setUploadGridPx(event.target.value)}
            />
          </label>
          <label className="stack" htmlFor={`${baseId}-map-file`}>
            <span className="muted">Map image</span>
            <input
              id={`${baseId}-map-file`}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              disabled={busy}
              onChange={(event) => void onUploadMap(event.target.files?.[0] ?? null)}
            />
          </label>
        </div>

        <ul className="token-list">
          {maps.map((map) => {
            const gridId = `${baseId}-map-grid-${map.id}`;
            return (
              <li key={map.id} className={map.id === activeMapId ? "active" : undefined}>
                <div className="stack" style={{ flex: 1, gap: "0.35rem" }}>
                  <strong>{map.name}</strong>
                  <span className="muted">
                    {map.width}×{map.height}
                    {map.id === activeMapId ? " · active" : ""}
                  </span>
                  <div className="row">
                    <label className="stack" htmlFor={gridId} style={{ gap: "0.25rem" }}>
                      <span className="visually-hidden">grid_px for {map.name}</span>
                      <input
                        id={gridId}
                        style={{ maxWidth: "5rem" }}
                        defaultValue={String(map.gridPx)}
                        inputMode="numeric"
                        onBlur={(event) => updateGrid(map.id, event.target.value)}
                      />
                    </label>
                    <button type="button" className="secondary" onClick={() => activateMap(map.id)}>
                      Set active
                    </button>
                    <button type="button" className="secondary" onClick={() => removeMap(map.id)}>
                      Remove
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="settings-section stack" aria-labelledby={`${baseId}-characters`}>
        <h3 id={`${baseId}-characters`}>Characters</h3>
        <p className="muted">
          Add PCs and NPCs with display names, notes, and portraits for the initiative rail.
        </p>

        <fieldset className="settings-fieldset stack">
          <legend>Add character</legend>
          <label className="stack" htmlFor={`${baseId}-new-name`}>
            <span className="muted">Display name</span>
            <input
              id={`${baseId}-new-name`}
              value={draft.name}
              onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
              placeholder="Aria"
              autoComplete="off"
            />
          </label>
          <label className="stack" htmlFor={`${baseId}-new-kind`}>
            <span className="muted">Type</span>
            <select
              id={`${baseId}-new-kind`}
              value={draft.kind}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  kind: event.target.value as CharacterKind,
                }))
              }
            >
              <option value="pc">PC</option>
              <option value="npc">NPC</option>
            </select>
          </label>
          <label className="stack" htmlFor={`${baseId}-new-notes`}>
            <span className="muted">Notes (optional)</span>
            <textarea
              id={`${baseId}-new-notes`}
              rows={2}
              maxLength={500}
              value={draft.notes}
              placeholder="Short description"
              onChange={(event) =>
                setDraft((current) => ({ ...current, notes: event.target.value }))
              }
            />
          </label>
          {maps.length > 0 ? (
            <fieldset className="settings-fieldset">
              <legend className="muted">Link to maps</legend>
              <div className="row">
                {maps.map((map) => {
                  const checkboxId = `${baseId}-new-map-${map.id}`;
                  return (
                    <label key={map.id} className="check-row" htmlFor={checkboxId}>
                      <input
                        id={checkboxId}
                        type="checkbox"
                        checked={draft.mapIds.includes(map.id)}
                        onChange={() =>
                          setDraft((current) => ({
                            ...current,
                            mapIds: current.mapIds.includes(map.id)
                              ? current.mapIds.filter((id) => id !== map.id)
                              : [...current.mapIds, map.id],
                          }))
                        }
                      />
                      <span>{map.name}</span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          ) : (
            <p className="muted">Upload a map before linking characters.</p>
          )}
          <button type="button" onClick={addCharacter}>
            Add {draft.kind.toUpperCase()}
          </button>
        </fieldset>

        <div className="settings-roster stack">
          <h4 className="settings-subhead">Player characters</h4>
          {pcs.length === 0 ? (
            <p className="muted">No PCs yet.</p>
          ) : (
            <ul className="character-list">{pcs.map(renderCharacterCard)}</ul>
          )}

          <h4 className="settings-subhead">NPCs</h4>
          {npcs.length === 0 ? (
            <p className="muted">No NPCs yet.</p>
          ) : (
            <ul className="character-list">{npcs.map(renderCharacterCard)}</ul>
          )}
        </div>
      </section>

      <section className="settings-section stack" aria-labelledby={`${baseId}-links`}>
        <h3 id={`${baseId}-links`}>Room links</h3>
        <p className="muted mono">
          Code <span className="visually-hidden">room code</span>
          {code}
        </p>
        <label className="stack" htmlFor={`${baseId}-link-gm`}>
          <span className="muted">GM</span>
          <input
            id={`${baseId}-link-gm`}
            readOnly
            value={links.gm}
            onFocus={(event) => event.target.select()}
          />
        </label>
        <label className="stack" htmlFor={`${baseId}-link-screen`}>
          <span className="muted">Screen</span>
          <input
            id={`${baseId}-link-screen`}
            readOnly
            value={links.screen}
            onFocus={(event) => event.target.select()}
          />
        </label>
        <label className="stack" htmlFor={`${baseId}-link-player`}>
          <span className="muted">Player</span>
          <input
            id={`${baseId}-link-player`}
            readOnly
            value={links.player}
            onFocus={(event) => event.target.select()}
          />
        </label>
      </section>
    </section>
  );
}
