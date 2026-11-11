import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { openDb } from "./db.js";
import { redactCharacterStatsForRole, RoomStore } from "./rooms.js";

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function createStore(): RoomStore {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dms-hp-"));
  tempDirs.push(dir);
  return new RoomStore(openDb(path.join(dir, "test.sqlite")));
}

describe("character HP and stats", () => {
  it("persists HP, AC, and clamps adjustments", () => {
    const store = createStore();
    const { room } = store.createRoom("Quest");
    const character = store.upsertCharacter({
      roomId: room.id,
      name: "Goblin",
      kind: "npc",
      hpMax: 12,
      ac: 13,
      notes: "scimitar",
    });
    expect(character.hpMax).toBe(12);
    expect(character.hpCurrent).toBe(12);
    expect(character.ac).toBe(13);

    const damaged = store.setCharacterHp(character.id, { delta: -4 });
    expect(damaged.hpCurrent).toBe(8);

    const healed = store.setCharacterHp(character.id, { delta: 20 });
    expect(healed.hpCurrent).toBe(12);

    const cleared = store.setCharacterHp(character.id, { hpCurrent: null, hpMax: null });
    expect(cleared.hpCurrent).toBeNull();
    expect(cleared.hpMax).toBeNull();
  });

  it("redacts monster HP for screen while keeping PC HP", () => {
    const store = createStore();
    const { room } = store.createRoom();
    const pc = store.upsertCharacter({
      roomId: room.id,
      name: "Aria",
      kind: "pc",
      hpMax: 24,
      hpCurrent: 18,
      ac: 15,
    });
    const npc = store.upsertCharacter({
      roomId: room.id,
      name: "Orc",
      kind: "npc",
      hpMax: 15,
      ac: 13,
      notes: "greataxe",
    });

    const gmSnap = store.getSnapshot(room.id, "gm", null);
    expect(gmSnap.characters.find((entry) => entry.id === npc.id)?.hpCurrent).toBe(15);

    const screenSnap = store.getSnapshot(room.id, "screen", null);
    const screenPc = screenSnap.characters.find((entry) => entry.id === pc.id);
    const screenNpc = screenSnap.characters.find((entry) => entry.id === npc.id);
    expect(screenPc?.hpCurrent).toBe(18);
    expect(screenPc?.ac).toBe(15);
    expect(screenNpc?.hpCurrent).toBeNull();
    expect(screenNpc?.hpMax).toBeNull();
    expect(screenNpc?.ac).toBeNull();
    expect(screenNpc?.notes).toBe("greataxe");

    expect(redactCharacterStatsForRole(npc, "player").hpMax).toBeNull();
    expect(redactCharacterStatsForRole(npc, "gm").hpMax).toBe(15);
  });
});
