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
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dms-prep-"));
  tempDirs.push(dir);
  return new RoomStore(openDb(path.join(dir, "test.sqlite")));
}

describe("prep multi-map and roster", () => {
  it("keeps multiple maps and switches active map tokens via character links", () => {
    const store = createStore();
    const { room } = store.createRoom("Quest");

    const cave = store.addMap(room.id, {
      name: "Cave",
      filename: "cave.png",
      width: 700,
      height: 700,
      gridPx: 70,
    });
    const tavern = store.addMap(room.id, {
      name: "Tavern",
      filename: "tavern.png",
      width: 700,
      height: 700,
      gridPx: 50,
    });

    expect(store.listMaps(room.id)).toHaveLength(2);
    expect(store.getActiveMap(room.id)?.id).toBe(cave.id);

    store.upsertCharacter({
      roomId: room.id,
      name: "Aria",
      kind: "pc",
      mapIds: [cave.id, tavern.id],
    });
    store.upsertCharacter({
      roomId: room.id,
      name: "Goblin",
      kind: "npc",
      mapIds: [cave.id],
    });

    let tokens = store.listVisibleTokens(room.id);
    expect(tokens.map((token) => token.label).sort()).toEqual(["Aria", "Goblin"]);

    store.setActiveMap(room.id, tavern.id);
    tokens = store.listVisibleTokens(room.id);
    expect(tokens.map((token) => token.label)).toEqual(["Aria"]);
    expect(store.getActiveMap(room.id)?.id).toBe(tavern.id);
  });

  it("filters PC/NPC visibility groups", () => {
    const store = createStore();
    const { room } = store.createRoom();
    const map = store.addMap(room.id, {
      name: "Arena",
      filename: "arena.png",
      width: 100,
      height: 100,
      gridPx: 50,
    });
    store.upsertCharacter({
      roomId: room.id,
      name: "Aria",
      kind: "pc",
      mapIds: [map.id],
    });
    store.upsertCharacter({
      roomId: room.id,
      name: "Orc",
      kind: "npc",
      mapIds: [map.id],
    });

    store.setVisibility(room.id, { showNpcs: false });
    expect(store.listVisibleTokens(room.id).map((token) => token.label)).toEqual(["Aria"]);

    store.setVisibility(room.id, { showPcs: false, showNpcs: true });
    expect(store.listVisibleTokens(room.id).map((token) => token.label)).toEqual(["Orc"]);
  });

  it("updates per-map grid_px", () => {
    const store = createStore();
    const { room } = store.createRoom();
    const map = store.addMap(room.id, {
      name: "Grid",
      filename: "grid.png",
      width: 140,
      height: 70,
      gridPx: 70,
    });
    const updated = store.updateMapGrid(map.id, 35);
    expect(updated.gridPx).toBe(35);
    expect(store.getMapById(map.id)?.gridPx).toBe(35);
  });
});
