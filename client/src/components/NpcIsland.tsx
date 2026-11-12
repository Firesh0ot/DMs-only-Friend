import { useMemo, useState } from "react";
import { ClientEvents, type CharacterState, type TokenState } from "@dms/shared";
import { formatHp } from "../lib/hp";
import type { Corner } from "../lib/islandLayout";
import { getSocket } from "../socket/socket";
import { ConditionBadges } from "./ConditionBadges";
import { ConditionToggles } from "./ConditionToggles";
import { PlayIsland } from "./PlayIsland";

type Props = {
  characters: CharacterState[];
  tokens: TokenState[];
  activeMapId: string | null;
  corner: Corner;
  onCycleCorner: () => void;
};

export function NpcIsland({ characters, tokens, activeMapId, corner, onCycleCorner }: Props) {
  const [label, setLabel] = useState("Goblin");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hpDraft, setHpDraft] = useState<string | null>(null);
  const npcsOnMap = tokens.filter((token) => !token.isPlayer);
  const rosterNpcs = characters.filter((character) => character.kind === "npc");
  const byId = useMemo(
    () => new Map(characters.map((character) => [character.id, character])),
    [characters],
  );

  const selected =
    (selectedId ? byId.get(selectedId) : null) ??
    (npcsOnMap[0]?.characterId ? byId.get(npcsOnMap[0].characterId) : null) ??
    rosterNpcs[0] ??
    null;

  function spawnNpc() {
    if (!activeMapId) {
      return;
    }
    const name = label.trim() || "NPC";
    getSocket().emit(ClientEvents.CharacterUpsert, {
      name,
      kind: "npc",
      mapIds: [activeMapId],
      hpMax: 7,
      hpCurrent: 7,
      ac: 13,
    });
    setLabel("Goblin");
  }

  function removeToken(tokenId: string) {
    getSocket().emit(ClientEvents.TokenRemove, { tokenId });
  }

  function linkToActiveMap(character: CharacterState) {
    if (!activeMapId) {
      return;
    }
    const mapIds = character.mapIds.includes(activeMapId)
      ? character.mapIds
      : [...character.mapIds, activeMapId];
    getSocket().emit(ClientEvents.CharacterUpsert, {
      id: character.id,
      name: character.name,
      kind: character.kind,
      mapIds,
      image: character.image,
      notes: character.notes,
      sizeCells: character.sizeCells,
      hpCurrent: character.hpCurrent,
      hpMax: character.hpMax,
      ac: character.ac,
    });
    setSelectedId(character.id);
  }

  function adjustHp(delta: number) {
    if (!selected) {
      return;
    }
    getSocket().emit(ClientEvents.CharacterSetHp, {
      characterId: selected.id,
      delta,
    });
  }

  function commitHpDraft() {
    if (!selected || hpDraft === null) {
      return;
    }
    const trimmed = hpDraft.trim();
    setHpDraft(null);
    if (!trimmed) {
      return;
    }
    const hpCurrent = Number(trimmed);
    if (!Number.isInteger(hpCurrent) || hpCurrent < 0) {
      return;
    }
    getSocket().emit(ClientEvents.CharacterSetHp, {
      characterId: selected.id,
      hpCurrent,
      hpMax: selected.hpMax ?? Math.max(hpCurrent, 1),
    });
  }

  return (
    <PlayIsland title="NPCs" corner={corner} onCycleCorner={onCycleCorner}>
      <div className="row">
        <input value={label} onChange={(event) => setLabel(event.target.value)} />
        <button onClick={spawnNpc} disabled={!activeMapId}>
          Spawn
        </button>
      </div>

      {selected ? (
        <div className="hp-panel" aria-label={`HP for ${selected.name}`}>
          <div className="hp-panel__head">
            <strong>{selected.name}</strong>
            {selected.ac !== null ? <span className="muted">AC {selected.ac}</span> : null}
          </div>
          <div className="hp-panel__controls row">
            <button
              type="button"
              className="secondary hp-btn"
              onClick={() => adjustHp(-1)}
              aria-label={`Damage ${selected.name} by 1`}
            >
              −1
            </button>
            <button
              type="button"
              className="secondary hp-btn"
              onClick={() => adjustHp(-5)}
              aria-label={`Damage ${selected.name} by 5`}
            >
              −5
            </button>
            <input
              className="hp-panel__input"
              inputMode="numeric"
              value={hpDraft ?? (selected.hpCurrent === null ? "" : String(selected.hpCurrent))}
              placeholder="HP"
              aria-label={`Current HP for ${selected.name}`}
              onChange={(event) => setHpDraft(event.target.value)}
              onBlur={() => commitHpDraft()}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  commitHpDraft();
                }
              }}
            />
            <span className="hp-chip" title="Hit points">
              {formatHp(selected) ?? "–"}
            </span>
            <button
              type="button"
              className="secondary hp-btn"
              onClick={() => adjustHp(1)}
              aria-label={`Heal ${selected.name} by 1`}
            >
              +1
            </button>
            <button
              type="button"
              className="secondary hp-btn"
              onClick={() => adjustHp(5)}
              aria-label={`Heal ${selected.name} by 5`}
            >
              +5
            </button>
          </div>
          {selected.notes ? <p className="muted hp-panel__notes">{selected.notes}</p> : null}
          <ConditionToggles
            characterId={selected.id}
            conditions={selected.conditions}
            label={`Conditions for ${selected.name}`}
          />
        </div>
      ) : null}

      <ul className="token-list compact">
        {npcsOnMap.map((token) => {
          const character = token.characterId ? byId.get(token.characterId) : undefined;
          const isSelected = selected?.id === character?.id;
          return (
            <li key={token.id} className={isSelected ? "active" : undefined}>
              <button
                type="button"
                className="token-select"
                onClick={() => {
                  if (!character) {
                    return;
                  }
                  setSelectedId(character.id);
                  setHpDraft(null);
                }}
              >
                <span>{token.label}</span>
                {character ? (
                  <span className="token-select__meta">
                    <span className="hp-chip">{formatHp(character) ?? "HP?"}</span>
                    <ConditionBadges conditions={character.conditions} compact />
                  </span>
                ) : null}
              </button>
              <button className="secondary" onClick={() => removeToken(token.id)}>
                Remove
              </button>
            </li>
          );
        })}
      </ul>

      {rosterNpcs.length > 0 ? (
        <>
          <p className="muted">Roster</p>
          <ul className="token-list compact">
            {rosterNpcs.map((character) => {
              const onMap = activeMapId ? character.mapIds.includes(activeMapId) : false;
              const isSelected = selected?.id === character.id;
              return (
                <li key={character.id} className={isSelected ? "active" : undefined}>
                  <button
                    type="button"
                    className="token-select"
                    onClick={() => {
                      setSelectedId(character.id);
                      setHpDraft(null);
                    }}
                  >
                    <span>{character.name}</span>
                    <span className="token-select__meta">
                      <span className="hp-chip">{formatHp(character) ?? "HP?"}</span>
                      <ConditionBadges conditions={character.conditions} compact />
                    </span>
                  </button>
                  {!onMap && activeMapId ? (
                    <button className="secondary" onClick={() => linkToActiveMap(character)}>
                      Place
                    </button>
                  ) : (
                    <span className="muted">{onMap ? "on map" : ""}</span>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      ) : null}
    </PlayIsland>
  );
}
