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
    expect(empty.fog).toEqual({ mapId: map.id, baseCovered: true, strokes: [] });

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
    expect(cleared).toEqual({ mapId: map.id, baseCovered: false, strokes: [] });
    expect(store.getFog(map.id).baseCovered).toBe(false);

    const covered = store.resetFog(room.id, map.id, true);
    expect(covered.baseCovered).toBe(true);
    expect(covered.strokes).toEqual([]);
  });
});
