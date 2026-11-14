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
      round: 0,
    });
    expect(first.activeIndex).toBe(0);
    expect(first.round).toBe(0);

    const nextIndex = (first.activeIndex + 1) % first.order.length;
    const second = store.setInitiative(room.id, {
      order: first.order,
      activeIndex: nextIndex,
      round: 0,
    });
    expect(second.activeIndex).toBe(1);
    expect(store.getInitiative(room.id)?.order[1]?.label).toBe("Goblin");
    expect(store.getInitiative(room.id)?.round).toBe(0);
  });

  it("persists round 0 without coercing to 1", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dms-init-round0-"));
    tempDirs.push(dir);
    const store = new RoomStore(openDb(path.join(dir, "test.sqlite")));
    const { room } = store.createRoom();
    const aria = store.createToken({ roomId: room.id, label: "Aria", x: 1, y: 1 });

    store.setInitiative(room.id, {
      order: [{ tokenId: aria.id, label: "Aria", initiative: 18 }],
      activeIndex: 0,
      round: 0,
    });
    expect(store.getInitiative(room.id)?.round).toBe(0);
  });

  it("prunes removed tokens and keeps the active combatant when possible", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dms-init-prune-"));
    tempDirs.push(dir);
    const store = new RoomStore(openDb(path.join(dir, "test.sqlite")));
    const { room } = store.createRoom();
    const aria = store.createToken({ roomId: room.id, label: "Aria", x: 1, y: 1 });
    const goblin = store.createToken({ roomId: room.id, label: "Goblin", x: 2, y: 2 });
    const wolf = store.createToken({ roomId: room.id, label: "Wolf", x: 3, y: 3 });

    store.setInitiative(room.id, {
      order: [
        { tokenId: aria.id, label: "Aria", initiative: 20 },
        { tokenId: goblin.id, label: "Goblin", initiative: 15 },
        { tokenId: wolf.id, label: "Wolf", initiative: 10 },
      ],
      activeIndex: 1,
      round: 2,
    });

    const pruned = store.removeToken(goblin.id);
    expect(pruned?.order.map((entry) => entry.label)).toEqual(["Aria", "Wolf"]);
    expect(pruned?.activeIndex).toBe(1);
    expect(pruned?.round).toBe(2);
    expect(store.pruneStaleInitiative(room.id)).toBeNull();
  });

  it("prunes initiative when a character and its tokens are removed", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dms-init-char-"));
    tempDirs.push(dir);
    const store = new RoomStore(openDb(path.join(dir, "test.sqlite")));
    const { room } = store.createRoom();
    const map = store.addMap(room.id, {
      name: "Cave",
      filename: "cave.png",
      width: 100,
      height: 100,
      gridPx: 70,
    });
    store.setActiveMap(room.id, map.id);
    const aria = store.upsertCharacter({
      roomId: room.id,
      name: "Aria",
      kind: "pc",
      mapIds: [map.id],
    });
    const goblin = store.upsertCharacter({
      roomId: room.id,
      name: "Goblin",
      kind: "npc",
      mapIds: [map.id],
    });
    const tokens = store.listAllTokensOnActiveMap(room.id);
    const ariaToken = tokens.find((token) => token.characterId === aria.id)!;
    const goblinToken = tokens.find((token) => token.characterId === goblin.id)!;

    store.setInitiative(room.id, {
      order: [
        { tokenId: ariaToken.id, label: "Aria", initiative: 18 },
        { tokenId: goblinToken.id, label: "Goblin", initiative: 12 },
      ],
      activeIndex: 0,
      round: 1,
    });

    const removed = store.removeCharacter(goblin.id);
    expect(removed.initiative?.order.map((entry) => entry.label)).toEqual(["Aria"]);
    expect(removed.initiative?.activeIndex).toBe(0);
  });

  it("removes zero-HP characters from initiative and does not auto-reinsert", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dms-init-zero-hp-"));
    tempDirs.push(dir);
    const store = new RoomStore(openDb(path.join(dir, "test.sqlite")));
    const { room } = store.createRoom();
    const map = store.addMap(room.id, {
      name: "Cave",
      filename: "cave.png",
      width: 100,
      height: 100,
      gridPx: 70,
    });
    store.setActiveMap(room.id, map.id);
    const aria = store.upsertCharacter({
      roomId: room.id,
      name: "Aria",
      kind: "pc",
      mapIds: [map.id],
      hpMax: 20,
      hpCurrent: 20,
    });
    const goblin = store.upsertCharacter({
      roomId: room.id,
      name: "Goblin",
      kind: "npc",
      mapIds: [map.id],
      hpMax: 12,
      hpCurrent: 12,
    });
    const wolf = store.upsertCharacter({
      roomId: room.id,
      name: "Wolf",
      kind: "npc",
      mapIds: [map.id],
      hpMax: 10,
      hpCurrent: 10,
    });
    const tokens = store.listAllTokensOnActiveMap(room.id);
    const ariaToken = tokens.find((token) => token.characterId === aria.id)!;
    const goblinToken = tokens.find((token) => token.characterId === goblin.id)!;
    const wolfToken = tokens.find((token) => token.characterId === wolf.id)!;

    store.setInitiative(room.id, {
      order: [
        { tokenId: ariaToken.id, label: "Aria", initiative: 20 },
        { tokenId: goblinToken.id, label: "Goblin", initiative: 15 },
        { tokenId: wolfToken.id, label: "Wolf", initiative: 10 },
      ],
      activeIndex: 1,
      round: 2,
    });

    store.setCharacterHp(goblin.id, { hpCurrent: 0 });
    const pruned = store.pruneZeroHpInitiative(room.id);
    expect(pruned?.order.map((entry) => entry.label)).toEqual(["Aria", "Wolf"]);
    expect(pruned?.activeIndex).toBe(1);
    expect(pruned?.round).toBe(2);
    expect(store.listAllTokensOnActiveMap(room.id).map((token) => token.label).sort()).toEqual([
      "Aria",
      "Goblin",
      "Wolf",
    ]);
    expect(store.pruneZeroHpInitiative(room.id)).toBeNull();

    store.setCharacterHp(goblin.id, { hpCurrent: 8 });
    expect(store.pruneZeroHpInitiative(room.id)).toBeNull();
    expect(store.getInitiative(room.id)?.order.map((entry) => entry.label)).toEqual([
      "Aria",
      "Wolf",
    ]);
  });

  it("drops the active combatant when they hit 0 HP", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dms-init-active-zero-"));
    tempDirs.push(dir);
    const store = new RoomStore(openDb(path.join(dir, "test.sqlite")));
    const { room } = store.createRoom();
    const map = store.addMap(room.id, {
      name: "Cave",
      filename: "cave.png",
      width: 100,
      height: 100,
      gridPx: 70,
    });
    store.setActiveMap(room.id, map.id);
    const aria = store.upsertCharacter({
      roomId: room.id,
      name: "Aria",
      kind: "pc",
      mapIds: [map.id],
      hpMax: 20,
      hpCurrent: 20,
    });
    const goblin = store.upsertCharacter({
      roomId: room.id,
      name: "Goblin",
      kind: "npc",
      mapIds: [map.id],
      hpMax: 12,
      hpCurrent: 12,
    });
    const tokens = store.listAllTokensOnActiveMap(room.id);
    const ariaToken = tokens.find((token) => token.characterId === aria.id)!;
    const goblinToken = tokens.find((token) => token.characterId === goblin.id)!;

    store.setInitiative(room.id, {
      order: [
        { tokenId: ariaToken.id, label: "Aria", initiative: 18 },
        { tokenId: goblinToken.id, label: "Goblin", initiative: 12 },
      ],
      activeIndex: 0,
      round: 1,
    });

    store.setCharacterHp(aria.id, { delta: -50 });
    const pruned = store.pruneZeroHpInitiative(room.id);
    expect(pruned?.order.map((entry) => entry.label)).toEqual(["Goblin"]);
    expect(pruned?.activeIndex).toBe(0);
  });
});
