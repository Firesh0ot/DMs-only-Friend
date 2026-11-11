import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { openDb } from "./db.js";
import { RoomStore } from "./rooms.js";

const tempDirs: string[] = [];

afterEach(() => {
  vi.useRealTimers();
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function createStore(): RoomStore {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dms-log-"));
  tempDirs.push(dir);
  return new RoomStore(openDb(path.join(dir, "test.sqlite")));
}

describe("session event log and battle timing", () => {
  it("appends events and includes them in the snapshot", () => {
    const store = createStore();
    const { room } = store.createRoom();

    const first = store.appendEvent({
      roomId: room.id,
      type: "map_change",
      summary: "Map: Cave",
      payload: { name: "Cave" },
    });
    const second = store.appendEvent({
      roomId: room.id,
      type: "initiative_set",
      summary: "Initiative set (2)",
    });

    expect(first.id).toBeGreaterThan(0);
    expect(second.createdAt).toMatch(/T/);

    const snapshot = store.getSnapshot(room.id, "gm", null);
    expect(snapshot.eventLog).toHaveLength(2);
    expect(snapshot.eventLog[0]?.type).toBe("map_change");
    expect(snapshot.eventLog[1]?.summary).toBe("Initiative set (2)");
    expect(snapshot.battle).toBeNull();
  });

  it("starts and ends a battle with duration in the end summary", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-11T18:00:00.000Z"));

    const store = createStore();
    const { room } = store.createRoom();

    const started = store.startBattle(room.id);
    expect(started.battle.endedAt).toBeNull();
    expect(started.event.type).toBe("battle_start");
    expect(store.getActiveBattle(room.id)?.id).toBe(started.battle.id);
    expect(store.getSnapshot(room.id, "screen", null).battle?.id).toBe(started.battle.id);

    expect(() => store.startBattle(room.id)).toThrow(/already active/i);

    vi.setSystemTime(new Date("2026-11-11T18:05:30.000Z"));
    const ended = store.endBattle(room.id);
    expect(ended.battle.endedAt).toBe("2026-11-11T18:05:30.000Z");
    expect(ended.event.type).toBe("battle_end");
    expect(ended.event.summary).toContain("5:30");
    expect(store.getActiveBattle(room.id)).toBeNull();
    expect(store.getSnapshot(room.id, "gm", null).battle).toBeNull();
  });

  it("auto-starts a battle on first next-turn ensure", () => {
    const store = createStore();
    const { room } = store.createRoom();

    const first = store.ensureBattleForNextTurn(room.id);
    expect(first.started).toBe(true);
    expect(first.startEvent?.type).toBe("battle_start");

    const second = store.ensureBattleForNextTurn(room.id);
    expect(second.started).toBe(false);
    expect(second.battle.id).toBe(first.battle.id);
    expect(second.startEvent).toBeNull();
  });

  it("throttles token move log entries", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-11T19:00:00.000Z"));

    const store = createStore();
    const { room } = store.createRoom();
    const token = store.createToken({ roomId: room.id, label: "Aria", x: 1, y: 1 });

    const first = store.logTokenMove({
      roomId: room.id,
      tokenId: token.id,
      label: "Aria",
      x: 2,
      y: 2,
    });
    const skipped = store.logTokenMove({
      roomId: room.id,
      tokenId: token.id,
      label: "Aria",
      x: 3,
      y: 3,
    });
    expect(first?.type).toBe("token_move");
    expect(skipped).toBeNull();

    vi.setSystemTime(new Date("2026-11-11T19:00:04.000Z"));
    const later = store.logTokenMove({
      roomId: room.id,
      tokenId: token.id,
      label: "Aria",
      x: 4,
      y: 4,
    });
    expect(later?.type).toBe("token_move");
    expect(store.listRecentEvents(room.id)).toHaveLength(2);
  });
});
