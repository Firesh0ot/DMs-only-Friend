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

describe("token ownership helpers", () => {
  it("marks player tokens and keeps GM-created NPC distinct", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dms-tok-"));
    tempDirs.push(dir);
    const store = new RoomStore(openDb(path.join(dir, "test.sqlite")));
    const { room } = store.createRoom();
    const player = store.createToken({
      roomId: room.id,
      label: "Aria",
      x: 1,
      y: 1,
      isPlayer: true,
    });
    const npc = store.createToken({
      roomId: room.id,
      label: "Goblin",
      x: 2,
      y: 2,
      isPlayer: false,
    });
    expect(player.isPlayer).toBe(true);
    expect(npc.isPlayer).toBe(false);
  });
});
