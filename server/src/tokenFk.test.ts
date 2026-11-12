import Database from "better-sqlite3";
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

function tempDbPath(prefix: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tempDirs.push(dir);
  return path.join(dir, "test.sqlite");
}

function tokenForeignKeys(dbPath: string) {
  const db = openDb(dbPath);
  const keys = db
    .prepare("PRAGMA foreign_key_list(tokens)")
    .all() as Array<{ table: string; from: string; on_delete: string }>;
  db.close();
  return keys;
}

describe("tokens foreign keys", () => {
  it("defines CASCADE FKs for map_id and character_id on fresh databases", () => {
    const keys = tokenForeignKeys(tempDbPath("dms-token-fk-fresh-"));
    const mapFk = keys.find((key) => key.from === "map_id");
    const characterFk = keys.find((key) => key.from === "character_id");
    expect(mapFk).toMatchObject({ table: "maps", on_delete: "CASCADE" });
    expect(characterFk).toMatchObject({ table: "characters", on_delete: "CASCADE" });
  });

  it("prunes orphan token rows and rebuilds FKs from a legacy schema", () => {
    const dbPath = tempDbPath("dms-token-fk-legacy-");
    const legacy = new Database(dbPath);
    legacy.pragma("foreign_keys = OFF");
    legacy.exec(`
      CREATE TABLE rooms (
        id TEXT PRIMARY KEY,
        code TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        created_at TEXT NOT NULL,
        active_map_id TEXT
      );
      CREATE TABLE maps (
        id TEXT PRIMARY KEY,
        room_id TEXT NOT NULL,
        filename TEXT NOT NULL,
        width INT NOT NULL,
        height INT NOT NULL,
        grid_px INT NOT NULL DEFAULT 70,
        offset_x INT NOT NULL DEFAULT 0,
        offset_y INT NOT NULL DEFAULT 0,
        name TEXT NOT NULL DEFAULT 'Map'
      );
      CREATE TABLE characters (
        id TEXT PRIMARY KEY,
        room_id TEXT NOT NULL,
        name TEXT NOT NULL,
        kind TEXT NOT NULL
      );
      CREATE TABLE tokens (
        id TEXT PRIMARY KEY,
        room_id TEXT NOT NULL,
        label TEXT NOT NULL,
        image TEXT,
        x REAL NOT NULL,
        y REAL NOT NULL,
        size_cells REAL NOT NULL DEFAULT 1,
        is_player INT NOT NULL DEFAULT 0,
        map_id TEXT,
        character_id TEXT
      );
      INSERT INTO rooms (id, code, name, created_at, active_map_id)
      VALUES ('room-1', 'LEGACY', 'Legacy', '2026-01-01T00:00:00.000Z', 'map-1');
      INSERT INTO maps (id, room_id, filename, width, height, name)
      VALUES ('map-1', 'room-1', 'cave.png', 100, 100, 'Cave');
      INSERT INTO characters (id, room_id, name, kind)
      VALUES ('char-1', 'room-1', 'Aria', 'pc');
      INSERT INTO tokens (id, room_id, label, x, y, map_id, character_id)
      VALUES
        ('tok-ok', 'room-1', 'Aria', 1, 1, 'map-1', 'char-1'),
        ('tok-bad-map', 'room-1', 'GhostMap', 2, 2, 'missing-map', NULL),
        ('tok-bad-char', 'room-1', 'GhostChar', 3, 3, 'map-1', 'missing-char');
    `);
    legacy.close();

    const db = openDb(dbPath);
    const ids = (
      db.prepare("SELECT id FROM tokens ORDER BY id ASC").all() as Array<{ id: string }>
    ).map((row) => row.id);
    expect(ids).toEqual(["tok-ok"]);

    const keys = db
      .prepare("PRAGMA foreign_key_list(tokens)")
      .all() as Array<{ from: string; table: string; on_delete: string }>;
    expect(keys.some((key) => key.from === "map_id" && key.table === "maps")).toBe(true);
    expect(keys.some((key) => key.from === "character_id" && key.table === "characters")).toBe(
      true,
    );
    db.close();
  });

  it("cascades token cleanup when maps and characters are deleted", () => {
    const store = new RoomStore(openDb(tempDbPath("dms-token-fk-cascade-")));
    const { room } = store.createRoom({ name: "Cascade", code: "CASCADE1", pin: "1111" });
    const mapA = store.addMap(room.id, {
      name: "A",
      filename: "a.png",
      width: 100,
      height: 100,
      gridPx: 70,
    });
    const mapB = store.addMap(room.id, {
      name: "B",
      filename: "b.png",
      width: 100,
      height: 100,
      gridPx: 70,
    });
    store.setActiveMap(room.id, mapA.id);

    const aria = store.upsertCharacter({
      roomId: room.id,
      name: "Aria",
      kind: "pc",
      mapIds: [mapA.id, mapB.id],
    });
    const goblin = store.upsertCharacter({
      roomId: room.id,
      name: "Goblin",
      kind: "npc",
      mapIds: [mapA.id],
    });
    const free = store.createToken({
      roomId: room.id,
      label: "Barrel",
      x: 4,
      y: 4,
    });

    store.setActiveMap(room.id, mapA.id);
    expect(store.listAllTokensOnActiveMap(room.id).map((token) => token.label).sort()).toEqual([
      "Aria",
      "Barrel",
      "Goblin",
    ]);

    store.removeCharacter(goblin.id);
    expect(
      store.listAllTokensOnActiveMap(room.id).map((token) => token.characterId),
    ).not.toContain(goblin.id);
    expect(store.listAllTokensOnActiveMap(room.id).some((token) => token.label === "Barrel")).toBe(
      true,
    );

    store.removeMap(room.id, mapA.id);
    expect(store.getActiveMap(room.id)?.id).toBe(mapB.id);
    const onB = store.listAllTokensOnActiveMap(room.id);
    expect(onB.some((token) => token.characterId === aria.id)).toBe(true);
    expect(onB.some((token) => token.id === free.id)).toBe(false);
  });

  it("rejects inserts with unknown map_id or character_id", () => {
    const db = openDb(tempDbPath("dms-token-fk-reject-"));
    const store = new RoomStore(db);
    const { room } = store.createRoom({ name: "Reject", code: "REJECT1", pin: "2222" });
    const map = store.addMap(room.id, {
      name: "Floor",
      filename: "floor.png",
      width: 50,
      height: 50,
      gridPx: 70,
    });

    expect(() =>
      db
        .prepare(
          `INSERT INTO tokens (id, room_id, label, x, y, size_cells, is_player, map_id, character_id)
           VALUES ('bad-map', ?, 'X', 1, 1, 1, 0, 'no-such-map', NULL)`,
        )
        .run(room.id),
    ).toThrow(/FOREIGN KEY/i);

    expect(() =>
      db
        .prepare(
          `INSERT INTO tokens (id, room_id, label, x, y, size_cells, is_player, map_id, character_id)
           VALUES ('bad-char', ?, 'Y', 1, 1, 1, 0, ?, 'no-such-char')`,
        )
        .run(room.id, map.id),
    ).toThrow(/FOREIGN KEY/i);
  });
});
