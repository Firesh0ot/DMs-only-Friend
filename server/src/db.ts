import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

export type Db = Database.Database;

const DEFAULT_DB_PATH = path.resolve(process.cwd(), "data", "dms.sqlite");

export function openDb(dbPath = process.env.DMS_DB_PATH ?? DEFAULT_DB_PATH): Db {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  migrate(db);
  return db;
}

function migrate(db: Db): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS rooms (
      id TEXT PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS maps (
      id TEXT PRIMARY KEY,
      room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
      filename TEXT NOT NULL,
      width INT NOT NULL,
      height INT NOT NULL,
      grid_px INT NOT NULL DEFAULT 70,
      offset_x INT NOT NULL DEFAULT 0,
      offset_y INT NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS tokens (
      id TEXT PRIMARY KEY,
      room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
      label TEXT NOT NULL,
      image TEXT,
      x REAL NOT NULL,
      y REAL NOT NULL,
      size_cells REAL NOT NULL DEFAULT 1,
      is_player INT NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS dice_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
      player_name TEXT NOT NULL,
      expr TEXT NOT NULL,
      results_json TEXT NOT NULL,
      total INT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS room_camera (
      room_id TEXT PRIMARY KEY REFERENCES rooms(id) ON DELETE CASCADE,
      x REAL NOT NULL,
      y REAL NOT NULL,
      zoom REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS room_initiative (
      room_id TEXT PRIMARY KEY REFERENCES rooms(id) ON DELETE CASCADE,
      order_json TEXT NOT NULL,
      active_index INT NOT NULL DEFAULT 0
    );
  `);
}
