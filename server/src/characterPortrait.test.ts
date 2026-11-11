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
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dms-portrait-"));
  tempDirs.push(dir);
  return new RoomStore(openDb(path.join(dir, "test.sqlite")));
}

describe("character notes and portraits", () => {
  it("persists notes and portrait image on character and tokens", () => {
    const store = createStore();
    const { room } = store.createRoom("Quest");
    const map = store.addMap(room.id, {
      name: "Cave",
      filename: "cave.png",
      width: 100,
      height: 100,
      gridPx: 50,
    });

    const character = store.upsertCharacter({
      roomId: room.id,
      name: "Aria",
      kind: "pc",
      notes: "Ranger",
      mapIds: [map.id],
    });
    expect(character.notes).toBe("Ranger");

    const withPortrait = store.setCharacterPortrait(character.id, "/uploads/aria.webp");
    expect(withPortrait.image).toBe("/uploads/aria.webp");

    const tokens = store.listVisibleTokens(room.id);
    expect(tokens[0]?.image).toBe("/uploads/aria.webp");

    store.setInitiative(room.id, {
      order: [
        {
          tokenId: tokens[0]!.id,
          label: "Aria",
          initiative: 18,
          kind: "pc",
          image: null,
        },
      ],
      activeIndex: 0,
      round: 1,
    });
    const refreshed = store.refreshInitiativePortraits(room.id);
    expect(refreshed?.order[0]?.image).toBe("/uploads/aria.webp");
  });
});
