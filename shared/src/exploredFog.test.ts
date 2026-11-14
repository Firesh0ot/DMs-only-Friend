import { describe, expect, it } from "vitest";
import type { FogState, MapState, TokenState } from "./events.js";
import {
  audienceFogKindAtCell,
  createEmptyExplored,
  createFullExplored,
  encodeExploredBits,
  growExploredFromCurrentVisibility,
  growExploredFromStroke,
  isCellExplored,
  isCurrentlyVisibleCell,
  markCellExplored,
  parseExploredCells,
  shouldShowTokenForAudience,
} from "./exploredFog.js";

const map: MapState = {
  id: "map-1",
  roomId: "room-1",
  name: "Tiny",
  filename: "tiny.png",
  animatedFilename: null,
  width: 280,
  height: 140,
  gridPx: 70,
  offsetX: 0,
  offsetY: 0,
  walls: [
    [
      { x: 0, y: 0 },
      { x: 4, y: 0 },
      { x: 4, y: 2 },
      { x: 0, y: 2 },
      { x: 0, y: 0 },
    ],
    [
      { x: 2, y: 0 },
      { x: 2, y: 2 },
    ],
  ],
  portals: [],
  lights: [],
};

function fog(partial: Partial<FogState> = {}): FogState {
  return {
    mapId: map.id,
    baseCovered: true,
    strokes: [],
    losEnabled: false,
    exploredCells: "",
    ...partial,
  };
}

function token(partial: Partial<TokenState> & Pick<TokenState, "id" | "isPlayer" | "x" | "y">): TokenState {
  return {
    roomId: map.roomId,
    label: partial.label ?? partial.id,
    image: null,
    sizeCells: 1,
    mapId: map.id,
    characterId: null,
    ...partial,
  };
}

describe("exploredFog", () => {
  it("encodes and decodes explored cell bits", () => {
    const explored = createEmptyExplored(map);
    expect(markCellExplored(explored, 1, 0)).toBe(true);
    expect(isCellExplored(explored, 1, 0)).toBe(true);
    expect(isCellExplored(explored, 0, 0)).toBe(false);
    const encoded = encodeExploredBits(explored.bits);
    const parsed = parseExploredCells(encoded, map);
    expect(isCellExplored(parsed, 1, 0)).toBe(true);
    expect(isCellExplored(parsed, 0, 0)).toBe(false);
  });

  it("grows explored from reveal strokes", () => {
    const explored = createEmptyExplored(map);
    const changed = growExploredFromStroke(explored, map, {
      id: "r1",
      kind: "rect",
      mode: "reveal",
      x: 70,
      y: 0,
      w: 70,
      h: 70,
    });
    expect(changed).toBe(true);
    expect(isCellExplored(explored, 1, 0)).toBe(true);
    expect(isCellExplored(explored, 0, 0)).toBe(false);
  });

  it("marks all cells explored for clear-all and none for empty", () => {
    expect(isCellExplored(createFullExplored(map), 0, 0)).toBe(true);
    expect(isCellExplored(createEmptyExplored(map), 0, 0)).toBe(false);
  });

  it("treats revealed cells without LoS as currently visible", () => {
    const state = fog({
      strokes: [
        {
          id: "r1",
          kind: "rect",
          mode: "reveal",
          x: 0,
          y: 0,
          w: 70,
          h: 70,
        },
      ],
    });
    expect(isCurrentlyVisibleCell(state, map, [], 0, 0)).toBe(true);
    expect(isCurrentlyVisibleCell(state, map, [], 3, 0)).toBe(false);
  });

  it("grows explored from LoS player vision", () => {
    const state = fog({
      baseCovered: false,
      losEnabled: true,
    });
    const pc = token({ id: "pc", isPlayer: true, x: 0.5, y: 0.5 });
    const explored = createEmptyExplored(map);
    const changed = growExploredFromCurrentVisibility(explored, state, map, [pc]);
    expect(changed).toBe(true);
    expect(isCellExplored(explored, 0, 0)).toBe(true);
  });

  it("classifies audience fog as clear, explored grey, or unseen black", () => {
    const explored = createEmptyExplored(map);
    markCellExplored(explored, 0, 0);
    markCellExplored(explored, 1, 0);
    const state = fog({
      strokes: [
        {
          id: "r1",
          kind: "rect",
          mode: "reveal",
          x: 0,
          y: 0,
          w: 70,
          h: 70,
        },
      ],
      exploredCells: encodeExploredBits(explored.bits),
    });
    expect(audienceFogKindAtCell({ fog: state, map, tokens: [], cellX: 0, cellY: 0 })).toBe("clear");
    expect(audienceFogKindAtCell({ fog: state, map, tokens: [], cellX: 1, cellY: 0 })).toBe(
      "explored",
    );
    expect(audienceFogKindAtCell({ fog: state, map, tokens: [], cellX: 2, cellY: 0 })).toBe(
      "unseen",
    );
  });

  it("hides NPCs outside current visibility for screen audiences", () => {
    const state = fog({
      strokes: [
        {
          id: "r1",
          kind: "rect",
          mode: "reveal",
          x: 0,
          y: 0,
          w: 70,
          h: 70,
        },
      ],
      exploredCells: encodeExploredBits(
        (() => {
          const explored = createEmptyExplored(map);
          markCellExplored(explored, 0, 0);
          markCellExplored(explored, 1, 0);
          return explored.bits;
        })(),
      ),
    });
    const npcHidden = token({ id: "npc", isPlayer: false, x: 1.2, y: 0.2 });
    const npcVisible = token({ id: "npc2", isPlayer: false, x: 0.2, y: 0.2 });
    const pcExplored = token({ id: "pc", isPlayer: true, x: 1.2, y: 0.2 });

    expect(
      shouldShowTokenForAudience({
        role: "screen",
        token: npcHidden,
        map,
        fog: state,
        tokens: [npcHidden, npcVisible, pcExplored],
      }),
    ).toBe(false);
    expect(
      shouldShowTokenForAudience({
        role: "screen",
        token: npcVisible,
        map,
        fog: state,
        tokens: [npcHidden, npcVisible, pcExplored],
      }),
    ).toBe(true);
    expect(
      shouldShowTokenForAudience({
        role: "screen",
        token: pcExplored,
        map,
        fog: state,
        tokens: [npcHidden, npcVisible, pcExplored],
      }),
    ).toBe(true);
    expect(
      shouldShowTokenForAudience({
        role: "gm",
        token: npcHidden,
        map,
        fog: state,
        tokens: [npcHidden],
      }),
    ).toBe(true);
  });
});
