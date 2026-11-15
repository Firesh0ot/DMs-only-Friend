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
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dms-death-"));
  tempDirs.push(dir);
  return new RoomStore(openDb(path.join(dir, "test.sqlite")));
}

describe("death saves", () => {
  it("enters dying at 0 HP and supports roll/stabilize/kill", () => {
    const store = createStore();
    const { room } = store.createRoom("Quest");
    const character = store.upsertCharacter({
      roomId: room.id,
      name: "Aria",
      kind: "pc",
      hpMax: 10,
      hpCurrent: 10,
    });

    const downed = store.setCharacterHp(character.id, { hpCurrent: 0 });
    expect(downed.deathState).toBe("dying");
    expect(downed.deathSaveSuccesses).toBe(0);
    expect(downed.deathSaveFailures).toBe(0);
    expect(downed.conditions).toContain("unconscious");

    const rolled = store.applyCharacterDeathSave(character.id, "roll", () => 0.55);
    expect(rolled.roll?.total).toBe(12);
    expect(rolled.character.deathSaveSuccesses).toBe(1);

    const stable = store.applyCharacterDeathSave(character.id, "stabilize");
    expect(stable.character.deathState).toBe("stable");

    const dead = store.applyCharacterDeathSave(character.id, "kill");
    expect(dead.character.deathState).toBe("dead");
    expect(dead.character.deathSaveFailures).toBe(3);
  });

  it("clears death saves when healed above 0", () => {
    const store = createStore();
    const { room } = store.createRoom();
    const character = store.upsertCharacter({
      roomId: room.id,
      name: "Aria",
      kind: "pc",
      hpMax: 10,
      hpCurrent: 1,
    });
    store.setCharacterHp(character.id, { hpCurrent: 0 });
    const healed = store.setCharacterHp(character.id, { hpCurrent: 2 });
    expect(healed.deathState).toBe("ok");
    expect(healed.deathSaveSuccesses).toBe(0);
    expect(healed.conditions).not.toContain("unconscious");
  });

  it("persists discovered on tokens", () => {
    const store = createStore();
    const { room } = store.createRoom();
    const npc = store.createToken({
      roomId: room.id,
      label: "Goblin",
      x: 2,
      y: 2,
      isPlayer: false,
    });
    expect(npc.discovered).toBe(false);
    const seen = store.setTokenDiscovered(npc.id, true);
    expect(seen.discovered).toBe(true);
    const pc = store.createToken({
      roomId: room.id,
      label: "Aria",
      x: 1,
      y: 1,
      isPlayer: true,
    });
    expect(pc.discovered).toBe(true);
  });
});
