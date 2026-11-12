import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { openDb, type Db } from "./db.js";
import { RoomStore } from "./rooms.js";

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function createStore(): { store: RoomStore; db: Db } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dms-cond-"));
  tempDirs.push(dir);
  const db = openDb(path.join(dir, "test.sqlite"));
  return { store: new RoomStore(db), db };
}

describe("character conditions", () => {
  it("persists conditions, dedupes, and keeps catalog order", () => {
    const { store } = createStore();
    const { room } = store.createRoom("Quest");
    const character = store.upsertCharacter({
      roomId: room.id,
      name: "Goblin",
      kind: "npc",
    });
    expect(character.conditions).toEqual([]);

    const updated = store.setCharacterConditions(character.id, [
      "stunned",
      "prone",
      "prone",
      "frightened",
    ]);
    expect(updated.conditions).toEqual(["frightened", "prone", "stunned"]);

    const cleared = store.setCharacterConditions(character.id, []);
    expect(cleared.conditions).toEqual([]);
  });

  it("includes conditions in snapshots for gm and screen", () => {
    const { store } = createStore();
    const { room } = store.createRoom();
    const pc = store.upsertCharacter({
      roomId: room.id,
      name: "Aria",
      kind: "pc",
    });
    const npc = store.upsertCharacter({
      roomId: room.id,
      name: "Orc",
      kind: "npc",
    });
    store.setCharacterConditions(pc.id, ["poisoned"]);
    store.setCharacterConditions(npc.id, ["blinded", "restrained"]);

    const gmSnap = store.getSnapshot(room.id, "gm", null);
    expect(gmSnap.characters.find((entry) => entry.id === pc.id)?.conditions).toEqual(["poisoned"]);
    expect(gmSnap.characters.find((entry) => entry.id === npc.id)?.conditions).toEqual([
      "blinded",
      "restrained",
    ]);

    const screenSnap = store.getSnapshot(room.id, "screen", null);
    expect(screenSnap.characters.find((entry) => entry.id === pc.id)?.conditions).toEqual([
      "poisoned",
    ]);
    expect(screenSnap.characters.find((entry) => entry.id === npc.id)?.conditions).toEqual([
      "blinded",
      "restrained",
    ]);
  });

  it("ignores unknown condition ids when reading stored json", () => {
    const { store, db } = createStore();
    const { room } = store.createRoom();
    const character = store.upsertCharacter({
      roomId: room.id,
      name: "Scout",
      kind: "pc",
    });
    db.prepare("UPDATE characters SET conditions_json = ? WHERE id = ?").run(
      JSON.stringify(["prone", "flying", "charmed"]),
      character.id,
    );
    expect(store.getCharacter(character.id)?.conditions).toEqual(["charmed", "prone"]);
  });
});
