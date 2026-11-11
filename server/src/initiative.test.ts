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

describe("initiative persistence", () => {
  it("stores order and advances active index", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dms-init-"));
    tempDirs.push(dir);
    const store = new RoomStore(openDb(path.join(dir, "test.sqlite")));
    const { room } = store.createRoom();
    const aria = store.createToken({ roomId: room.id, label: "Aria", x: 1, y: 1 });
    const goblin = store.createToken({ roomId: room.id, label: "Goblin", x: 2, y: 2 });

    const first = store.setInitiative(room.id, {
      order: [
        { tokenId: aria.id, label: "Aria", initiative: 18 },
        { tokenId: goblin.id, label: "Goblin", initiative: 12 },
      ],
      activeIndex: 0,
    });
    expect(first.activeIndex).toBe(0);

    const nextIndex = (first.activeIndex + 1) % first.order.length;
    const second = store.setInitiative(room.id, {
      order: first.order,
      activeIndex: nextIndex,
    });
    expect(second.activeIndex).toBe(1);
    expect(store.getInitiative(room.id)?.order[1]?.label).toBe("Goblin");
  });
});
