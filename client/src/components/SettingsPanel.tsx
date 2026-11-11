import { useId, useMemo, useState } from "react";
import {
  ClientEvents,
  type CharacterKind,
  type CharacterState,
  type MapState,
} from "@dms/shared";
import { parseOptionalInt } from "../lib/hp";
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
  hpCurrent: string;
  hpMax: string;
  ac: string;
  mapIds: string[];
};

const emptyDraft = (): DraftCharacter => ({
  name: "",
  kind: "pc",
  notes: "",
  hpCurrent: "",
  hpMax: "",
  ac: "",
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
  const [editingStats, setEditingStats] = useState<
    Record<string, { hpCurrent: string; hpMax: string; ac: string }>
  >({});

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
    try {
      const hpMax = parseOptionalInt(draft.hpMax);
      const hpCurrent = draft.hpCurrent.trim()
        ? parseOptionalInt(draft.hpCurrent)
        : hpMax;
      const ac = parseOptionalInt(draft.ac);
      getSocket().emit(ClientEvents.CharacterUpsert, {
        name,
        kind: draft.kind,
        mapIds: draft.mapIds,
        notes: draft.notes.trim() || null,
        sizeCells: 1,
        image: null,
        hpCurrent,
        hpMax,
        ac,
      });
      setDraft(emptyDraft());
      setMessage(`Added ${draft.kind.toUpperCase()} ${name}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Invalid stats");
    }
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
      hpCurrent: patch.hpCurrent !== undefined ? patch.hpCurrent : character.hpCurrent,
      hpMax: patch.hpMax !== undefined ? patch.hpMax : character.hpMax,
      ac: patch.ac !== undefined ? patch.ac : character.ac,
    });
  }

  function statsDraftFor(character: CharacterState) {
    return (
      editingStats[character.id] ?? {
        hpCurrent: character.hpCurrent === null ? "" : String(character.hpCurrent),
        hpMax: character.hpMax === null ? "" : String(character.hpMax),
        ac: character.ac === null ? "" : String(character.ac),
      }
    );
  }

  function saveStats(character: CharacterState) {
    const stats = statsDraftFor(character);
    try {
      const hpMax = parseOptionalInt(stats.hpMax);
      const hpCurrent = stats.hpCurrent.trim() ? parseOptionalInt(stats.hpCurrent) : hpMax;
      const ac = parseOptionalInt(stats.ac);
      saveCharacter(character, { hpCurrent, hpMax, ac });
      setEditingStats((current) => {
        const next = { ...current };
        delete next[character.id];
        return next;
      });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Invalid stats");
    }
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
    const hpCurrentId = `${baseId}-hp-cur-${character.id}`;
    const hpMaxId = `${baseId}-hp-max-${character.id}`;
    const acId = `${baseId}-ac-${character.id}`;
    const notesValue = editingNotes[character.id] ?? character.notes ?? "";
    const stats = statsDraftFor(character);
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

          <div className="character-stats-row">
            <label className="stack" htmlFor={hpCurrentId}>
              <span className="muted">HP</span>
              <input
                id={hpCurrentId}
                inputMode="numeric"
                value={stats.hpCurrent}
                placeholder="cur"
                aria-label={`Current HP for ${character.name}`}
                onChange={(event) =>
                  setEditingStats((current) => ({
                    ...current,
                    [character.id]: { ...stats, hpCurrent: event.target.value },
                  }))
                }
                onBlur={() => saveStats(character)}
              />
            </label>
            <label className="stack" htmlFor={hpMaxId}>
              <span className="muted">Max</span>
              <input
                id={hpMaxId}
                inputMode="numeric"
                value={stats.hpMax}
                placeholder="max"
                aria-label={`Max HP for ${character.name}`}
                onChange={(event) =>
                  setEditingStats((current) => ({
                    ...current,
                    [character.id]: { ...stats, hpMax: event.target.value },
                  }))
                }
                onBlur={() => saveStats(character)}
              />
            </label>
            <label className="stack" htmlFor={acId}>
              <span className="muted">AC</span>
              <input
                id={acId}
                inputMode="numeric"
                value={stats.ac}
                placeholder="–"
                aria-label={`AC for ${character.name}`}
                onChange={(event) =>
                  setEditingStats((current) => ({
                    ...current,
                    [character.id]: { ...stats, ac: event.target.value },
                  }))
                }
                onBlur={() => saveStats(character)}
              />
            </label>
          </div>

          <label className="stack" htmlFor={notesId}>
            <span className="muted">Stat notes</span>
            <textarea
              id={notesId}
              rows={2}
              maxLength={500}
              value={notesValue}
              placeholder="Short stats / traits"
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
        <a href="#settings-maps">Maps</a>
        <a href="#settings-characters">Characters</a>
        <a href="#settings-links">Room links</a>
      </nav>

      <section className="settings-section stack" aria-labelledby="settings-maps">
        <h3 id="settings-maps">Maps</h3>
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
        <p className="muted">
          Upload PNG/JPG/WebP (set grid_px) or Universal VTT <code>.dd2vtt</code> (grid and walls
          come from the file).
        </p>
        <div className="row settings-upload-row">
          <label className="stack" htmlFor={`${baseId}-grid`}>
            <span className="muted">grid_px (PNG)</span>
            <input
              id={`${baseId}-grid`}
              style={{ maxWidth: "6rem" }}
              value={uploadGridPx}
              inputMode="numeric"
              onChange={(event) => setUploadGridPx(event.target.value)}
            />
          </label>
          <label className="stack" htmlFor={`${baseId}-map-file`}>
            <span className="muted">Map file</span>
            <input
              id={`${baseId}-map-file`}
              type="file"
              accept="image/png,image/jpeg,image/webp,.dd2vtt,application/json"
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
                    {map.width}×{map.height} · grid {map.gridPx}
                    {map.walls.length > 0 ? ` · ${map.walls.length} walls` : ""}
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

      <section className="settings-section stack" aria-labelledby="settings-characters">
        <h3 id="settings-characters">Characters</h3>
        <p className="muted">
          Add PCs and NPCs with display names, HP/AC, short notes, and portraits for the initiative
          rail.
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
          <div className="character-stats-row">
            <label className="stack" htmlFor={`${baseId}-new-hp`}>
              <span className="muted">HP</span>
              <input
                id={`${baseId}-new-hp`}
                inputMode="numeric"
                value={draft.hpCurrent}
                placeholder="cur"
                onChange={(event) =>
                  setDraft((current) => ({ ...current, hpCurrent: event.target.value }))
                }
              />
            </label>
            <label className="stack" htmlFor={`${baseId}-new-hp-max`}>
              <span className="muted">Max</span>
              <input
                id={`${baseId}-new-hp-max`}
                inputMode="numeric"
                value={draft.hpMax}
                placeholder="max"
                onChange={(event) =>
                  setDraft((current) => ({ ...current, hpMax: event.target.value }))
                }
              />
            </label>
            <label className="stack" htmlFor={`${baseId}-new-ac`}>
              <span className="muted">AC</span>
              <input
                id={`${baseId}-new-ac`}
                inputMode="numeric"
                value={draft.ac}
                placeholder="–"
                onChange={(event) =>
                  setDraft((current) => ({ ...current, ac: event.target.value }))
                }
              />
            </label>
          </div>
          <label className="stack" htmlFor={`${baseId}-new-notes`}>
            <span className="muted">Stat notes (optional)</span>
            <textarea
              id={`${baseId}-new-notes`}
              rows={2}
              maxLength={500}
              value={draft.notes}
              placeholder="Short stats / traits"
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

      <section className="settings-section stack" aria-labelledby="settings-links">
        <h3 id="settings-links">Room links</h3>
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
