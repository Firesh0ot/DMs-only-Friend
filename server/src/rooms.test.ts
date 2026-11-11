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
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dms-rooms-"));
  tempDirs.push(dir);
  const db = openDb(path.join(dir, "test.sqlite"));
  return new RoomStore(db);
}

describe("RoomStore", () => {
  it("creates a room and returns a snapshot on join data", () => {
    const store = createStore();
    const { room, code } = store.createRoom("Forest Table");
    expect(code).toHaveLength(6);
    expect(store.getRoomByCode(code)?.id).toBe(room.id);

    const snapshot = store.getSnapshot(room.id, "gm", null);
    expect(snapshot.room.name).toBe("Forest Table");
    expect(snapshot.map).toBeNull();
    expect(snapshot.maps).toEqual([]);
    expect(snapshot.characters).toEqual([]);
    expect(snapshot.visibility).toEqual({ showPcs: true, showNpcs: true });
    expect(snapshot.tokens).toEqual([]);
  });

  it("persists tokens and camera", () => {
    const store = createStore();
    const { room } = store.createRoom();
    const token = store.createToken({
      roomId: room.id,
      label: "Aria",
      x: 2,
      y: 3,
      isPlayer: true,
    });
    store.setCamera(room.id, { x: 10, y: 20, zoom: 1.5 });

    const snapshot = store.getSnapshot(room.id, "screen", null);
    expect(snapshot.tokens).toHaveLength(1);
    expect(snapshot.tokens[0]?.label).toBe("Aria");
    expect(snapshot.camera).toEqual({ x: 10, y: 20, zoom: 1.5 });

    const moved = store.moveToken(token.id, 4, 5);
    expect(moved.x).toBe(4);
    expect(moved.y).toBe(5);
  });
});
