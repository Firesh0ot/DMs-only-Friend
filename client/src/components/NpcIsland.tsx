import { useState } from "react";
import { ClientEvents, type CharacterState, type TokenState } from "@dms/shared";
import { getSocket } from "../socket/socket";
import { PlayIsland } from "./PlayIsland";
import type { Corner } from "../lib/islandLayout";

type Props = {
  characters: CharacterState[];
  tokens: TokenState[];
  activeMapId: string | null;
  corner: Corner;
  onCycleCorner: () => void;
};

export function NpcIsland({ characters, tokens, activeMapId, corner, onCycleCorner }: Props) {
  const [label, setLabel] = useState("Goblin");
  const npcsOnMap = tokens.filter((token) => !token.isPlayer);
  const rosterNpcs = characters.filter((character) => character.kind === "npc");

  function spawnNpc() {
    if (!activeMapId) {
      return;
    }
    const name = label.trim() || "NPC";
    getSocket().emit(ClientEvents.CharacterUpsert, {
      name,
      kind: "npc",
      mapIds: [activeMapId],
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

      <ul className="token-list compact">
        {npcsOnMap.map((token) => (
          <li key={token.id}>
            <span>{token.label}</span>
            <button className="secondary" onClick={() => removeToken(token.id)}>
              Remove
            </button>
          </li>
        ))}
      </ul>

      {rosterNpcs.length > 0 ? (
        <>
          <p className="muted">Roster</p>
          <ul className="token-list compact">
            {rosterNpcs.map((character) => {
              const onMap = activeMapId ? character.mapIds.includes(activeMapId) : false;
              return (
                <li key={character.id}>
                  <span>{character.name}</span>
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
