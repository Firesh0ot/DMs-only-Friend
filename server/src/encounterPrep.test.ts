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
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dms-encounter-"));
  tempDirs.push(dir);
  return new RoomStore(openDb(path.join(dir, "test.sqlite")));
}

describe("encounter sketches and prep notes", () => {
  it("stores named NPC lists and places them on the active map", () => {
    const store = createStore();
    const { room } = store.createRoom("Prep");
    const map = store.addMap(room.id, {
      name: "Cave",
      filename: "cave.png",
      width: 700,
      height: 700,
      gridPx: 70,
    });
    const goblin = store.upsertCharacter({
      roomId: room.id,
      name: "Goblin",
      kind: "npc",
      mapIds: [],
    });
    const wolf = store.upsertCharacter({
      roomId: room.id,
      name: "Wolf",
      kind: "npc",
      mapIds: [],
    });
    store.upsertCharacter({
      roomId: room.id,
      name: "Aria",
      kind: "pc",
      mapIds: [map.id],
    });

    const sketch = store.upsertEncounter({
      roomId: room.id,
      name: "Door ambush",
      npcIds: [goblin.id, wolf.id, "missing", goblin.id],
    });
    expect(sketch.name).toBe("Door ambush");
    expect(sketch.npcIds).toEqual([goblin.id, wolf.id]);

    expect(store.listVisibleTokens(room.id).map((token) => token.label)).toEqual(["Aria"]);

    const placed = store.placeEncounter(room.id, sketch.id);
    expect(placed.placedCharacterIds.sort()).toEqual([goblin.id, wolf.id].sort());
    const labels = store.listVisibleTokens(room.id).map((token) => token.label).sort();
    expect(labels).toEqual(["Aria", "Goblin", "Wolf"]);
    expect(store.getCharacter(goblin.id)?.mapIds).toContain(map.id);
    expect(store.getCharacter(wolf.id)?.mapIds).toContain(map.id);
  });

  it("prunes deleted NPCs from sketches and persists prep notes", () => {
    const store = createStore();
    const { room } = store.createRoom();
    const npc = store.upsertCharacter({
      roomId: room.id,
      name: "Guard",
      kind: "npc",
    });
    const sketch = store.upsertEncounter({
      roomId: room.id,
      name: "Guards",
      npcIds: [npc.id],
    });
    store.removeCharacter(npc.id);
    expect(store.listEncounters(room.id).find((entry) => entry.id === sketch.id)?.npcIds).toEqual(
      [],
    );

    expect(store.setPrepNotes(room.id, "Secret door behind the throne")).toBe(
      "Secret door behind the throne",
    );
    expect(store.getSnapshot(room.id, "gm", null).prepNotes).toBe("Secret door behind the throne");
    expect(store.getSnapshot(room.id, "gm", null).encounters).toHaveLength(1);
  });
});
