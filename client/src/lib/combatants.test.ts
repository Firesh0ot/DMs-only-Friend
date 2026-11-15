import { describe, expect, it } from "vitest";
import type { CharacterState, MapState, TokenState } from "@dms/shared";
import { defaultCombatantTokenIds } from "./combatants";

function token(partial: Partial<TokenState> & Pick<TokenState, "id" | "label">): TokenState {
  return {
    roomId: "r1",
    image: null,
    x: 1,
    y: 1,
    sizeCells: 1,
    isPlayer: false,
    mapId: "m1",
    characterId: null,
    ...partial,
  };
}

function character(
  partial: Partial<CharacterState> & Pick<CharacterState, "id" | "name" | "kind">,
): CharacterState {
  return {
    roomId: "r1",
    image: null,
    notes: null,
    sizeCells: 1,
    speedCells: 6,
    initiativeBonus: 0,
    mapIds: ["m1"],
    hpCurrent: null,
    hpMax: null,
    ac: null,
    hpQuarter: null,
    conditions: [],
    ...partial,
  };
}

const map: MapState = {
  id: "m1",
  roomId: "r1",
  name: "Cave",
  filename: "cave.png",
  animatedFilename: null,
  width: 100,
  height: 100,
  gridPx: 70,
  offsetX: 0,
  offsetY: 0,
  walls: [],
  portals: [],
  lights: [],
  obstacles: [],
};

describe("defaultCombatantTokenIds", () => {
  it("includes all PCs and NPCs when there is no fog", () => {
    const tokens = [
      token({ id: "t1", label: "Aria", isPlayer: true, characterId: "c1" }),
      token({ id: "t2", label: "Goblin", characterId: "c2" }),
    ];
    const characters = [
      character({ id: "c1", name: "Aria", kind: "pc" }),
      character({ id: "c2", name: "Goblin", kind: "npc" }),
    ];
    expect(defaultCombatantTokenIds(tokens, characters, map, null)).toEqual(["t1", "t2"]);
  });
});
