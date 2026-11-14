import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { openDb } from "./db.js";
import { RoomStore } from "./rooms.js";

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function createStore(): RoomStore {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dms-fog-"));
  tempDirs.push(dir);
  const db = openDb(path.join(dir, "test.sqlite"));
  return new RoomStore(db);
}

describe("manual fog of war", () => {
  it("defaults to covered fog on snapshot and persists brush/rect strokes", () => {
    const store = createStore();
    const { room } = store.createRoom();
    const map = store.addMap(room.id, {
      name: "Crypt",
      filename: "crypt.png",
      width: 700,
      height: 500,
      gridPx: 70,
    });

    const empty = store.getSnapshot(room.id, "gm", null);
    expect(empty.fog).toEqual({
      mapId: map.id,
      baseCovered: true,
      strokes: [],
      losEnabled: false,
      exploredCells: "",
    });

    const painted = store.paintFog(room.id, map.id, {
      kind: "brush",
      mode: "reveal",
      radius: 40,
      points: [
        { x: 100, y: 120 },
        { x: 140, y: 150 },
      ],
    });
    expect(painted.strokes).toHaveLength(1);
    expect(painted.strokes[0]?.kind).toBe("brush");
    expect(painted.strokes[0]?.mode).toBe("reveal");
    expect(painted.strokes[0]?.id).toBeTruthy();

    const withRect = store.paintFog(room.id, map.id, {
      kind: "rect",
      mode: "hide",
      x: 200,
      y: 50,
      w: -80,
      h: 60,
    });
    expect(withRect.strokes).toHaveLength(2);
    const rect = withRect.strokes[1];
    expect(rect?.kind).toBe("rect");
    expect(rect?.mode).toBe("hide");
    if (rect?.kind === "rect") {
      expect(rect.x).toBe(120);
      expect(rect.y).toBe(50);
      expect(rect.w).toBe(80);
      expect(rect.h).toBe(60);
    }

    const screen = store.getSnapshot(room.id, "screen", null);
    expect(screen.fog?.strokes).toHaveLength(2);
    expect(screen.fog?.baseCovered).toBe(true);
  });

  it("preserves reveal then hide modes across brush and rect paints", () => {
    const store = createStore();
    const { room } = store.createRoom();
    const map = store.addMap(room.id, {
      name: "Ruins",
      filename: "ruins.png",
      width: 500,
      height: 400,
      gridPx: 50,
    });

    const revealed = store.paintFog(room.id, map.id, {
      kind: "brush",
      mode: "reveal",
      radius: 24,
      points: [{ x: 40, y: 40 }],
    });
    expect(revealed.strokes[0]?.mode).toBe("reveal");

    const hidden = store.paintFog(room.id, map.id, {
      kind: "rect",
      mode: "hide",
      x: 10,
      y: 10,
      w: 60,
      h: 40,
    });
    expect(hidden.strokes.map((stroke) => stroke.mode)).toEqual(["reveal", "hide"]);
    expect(store.getFog(map.id).strokes.map((stroke) => stroke.mode)).toEqual(["reveal", "hide"]);
  });

  it("resets fog cover and clears strokes", () => {
    const store = createStore();
    const { room } = store.createRoom();
    const map = store.addMap(room.id, {
      name: "Hall",
      filename: "hall.png",
      width: 400,
      height: 400,
      gridPx: 50,
    });
    store.paintFog(room.id, map.id, {
      kind: "rect",
      mode: "reveal",
      x: 10,
      y: 10,
      w: 100,
      h: 80,
    });

    const cleared = store.resetFog(room.id, map.id, false);
    expect(cleared.mapId).toBe(map.id);
    expect(cleared.baseCovered).toBe(false);
    expect(cleared.strokes).toEqual([]);
    expect(cleared.losEnabled).toBe(false);
    expect(cleared.exploredCells.length).toBeGreaterThan(0);
    expect(store.getFog(map.id).baseCovered).toBe(false);

    const covered = store.resetFog(room.id, map.id, true);
    expect(covered.baseCovered).toBe(true);
    expect(covered.strokes).toEqual([]);
    expect(covered.exploredCells).toBe("");
  });

  it("grows explored cells from reveal paints and LoS vision", () => {
    const store = createStore();
    const { room } = store.createRoom();
    const map = store.addMap(room.id, {
      name: "Sight",
      filename: "sight.png",
      width: 280,
      height: 140,
      gridPx: 70,
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
    });
    store.createToken({
      roomId: room.id,
      label: "Hero",
      x: 0.5,
      y: 0.5,
      isPlayer: true,
      mapId: map.id,
    });

    const painted = store.paintFog(room.id, map.id, {
      kind: "rect",
      mode: "reveal",
      x: 0,
      y: 0,
      w: 70,
      h: 70,
    });
    expect(painted.exploredCells.length).toBeGreaterThan(0);

    store.setFogLos(room.id, map.id, true);
    const afterLos = store.getFog(map.id);
    expect(afterLos.exploredCells.length).toBeGreaterThan(0);

    store.moveToken(store.listAllTokensOnActiveMap(room.id)[0]!.id, 0.8, 0.8);
    const grown = store.growExploredFromVision(room.id);
    expect(grown === null || grown.exploredCells.length > 0).toBe(true);
  });

  it("toggles LoS fog and preserves it across manual reset", () => {
    const store = createStore();
    const { room } = store.createRoom();
    const map = store.addMap(room.id, {
      name: "Dungeon",
      filename: "dungeon.png",
      width: 280,
      height: 140,
      gridPx: 70,
      walls: [
        [
          { x: 0, y: 0 },
          { x: 2, y: 0 },
        ],
        [
          { x: 1, y: 0 },
          { x: 1, y: 1 },
        ],
      ],
    });

    expect(() => store.setFogLos(room.id, map.id, true)).not.toThrow();
    expect(store.getFog(map.id).losEnabled).toBe(true);

    store.paintFog(room.id, map.id, {
      kind: "rect",
      mode: "reveal",
      x: 0,
      y: 0,
      w: 40,
      h: 40,
    });
    const reset = store.resetFog(room.id, map.id, true);
    expect(reset.losEnabled).toBe(true);
    expect(reset.strokes).toEqual([]);

    const disabled = store.setFogLos(room.id, map.id, false);
    expect(disabled.losEnabled).toBe(false);
  });

  it("rejects LoS enable without walls or portals", () => {
    const store = createStore();
    const { room } = store.createRoom();
    const map = store.addMap(room.id, {
      name: "Plain",
      filename: "plain.png",
      width: 200,
      height: 200,
      gridPx: 50,
    });
    expect(() => store.setFogLos(room.id, map.id, true)).toThrow(/wall or portal/i);
  });

  it("allows LoS enable with portals only", () => {
    const store = createStore();
    const { room } = store.createRoom();
    const map = store.addMap(room.id, {
      name: "Doors",
      filename: "doors.png",
      width: 200,
      height: 200,
      gridPx: 50,
      portals: [
        {
          id: "portal-0",
          bounds: [
            { x: 1, y: 0 },
            { x: 1, y: 1 },
          ],
          closed: true,
          freestanding: true,
        },
      ],
    });
    expect(() => store.setFogLos(room.id, map.id, true)).not.toThrow();
    expect(store.getFog(map.id).losEnabled).toBe(true);
  });
});
