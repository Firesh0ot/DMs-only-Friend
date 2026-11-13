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

  ensureColumn(db, "maps", "name", "TEXT NOT NULL DEFAULT 'Map'");
  ensureColumn(db, "rooms", "active_map_id", "TEXT");
  ensureColumn(db, "rooms", "show_pcs", "INT NOT NULL DEFAULT 1");
  ensureColumn(db, "rooms", "show_npcs", "INT NOT NULL DEFAULT 1");
  ensureColumn(db, "tokens", "map_id", "TEXT");
  ensureColumn(db, "tokens", "character_id", "TEXT");
  ensureColumn(db, "room_initiative", "round", "INT NOT NULL DEFAULT 1");

  db.exec(`
    CREATE TABLE IF NOT EXISTS characters (
      id TEXT PRIMARY KEY,
      room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      kind TEXT NOT NULL,
      image TEXT,
      notes TEXT,
      size_cells REAL NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS character_maps (
      character_id TEXT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
      map_id TEXT NOT NULL REFERENCES maps(id) ON DELETE CASCADE,
      x REAL NOT NULL DEFAULT 1,
      y REAL NOT NULL DEFAULT 1,
      PRIMARY KEY (character_id, map_id)
    );

    CREATE TABLE IF NOT EXISTS battles (
      id TEXT PRIMARY KEY,
      room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
      started_at TEXT NOT NULL,
      ended_at TEXT
    );

    CREATE TABLE IF NOT EXISTS session_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
      battle_id TEXT REFERENCES battles(id) ON DELETE SET NULL,
      type TEXT NOT NULL,
      summary TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_session_events_room_created
      ON session_events (room_id, id DESC);

    CREATE TABLE IF NOT EXISTS map_fog (
      map_id TEXT PRIMARY KEY REFERENCES maps(id) ON DELETE CASCADE,
      base_covered INT NOT NULL DEFAULT 1,
      strokes_json TEXT NOT NULL DEFAULT '[]',
      los_enabled INT NOT NULL DEFAULT 0
    );
  `);

  ensureColumn(db, "characters", "notes", "TEXT");
  ensureColumn(db, "maps", "walls_json", "TEXT NOT NULL DEFAULT '[]'");
  ensureColumn(db, "maps", "portals_json", "TEXT NOT NULL DEFAULT '[]'");
  ensureColumn(db, "maps", "lights_json", "TEXT NOT NULL DEFAULT '[]'");
  ensureColumn(db, "characters", "hp_current", "INT");
  ensureColumn(db, "characters", "hp_max", "INT");
  ensureColumn(db, "characters", "ac", "INT");
  ensureColumn(db, "characters", "conditions_json", "TEXT NOT NULL DEFAULT '[]'");
  ensureColumn(db, "rooms", "pin_hash", "TEXT");
  ensureColumn(db, "rooms", "pin_salt", "TEXT");
  ensureColumn(db, "rooms", "gm_invite_hash", "TEXT");
  ensureColumn(db, "rooms", "screen_hp_quarters", "INT NOT NULL DEFAULT 0");
  ensureColumn(db, "rooms", "physical_cell_cm", "REAL");
  ensureColumn(db, "rooms", "gm_claimed", "INT NOT NULL DEFAULT 1");
  ensureColumn(db, "map_fog", "los_enabled", "INT NOT NULL DEFAULT 0");

  backfillActiveMaps(db);
  backfillTokenMaps(db);
  ensureTokensForeignKeys(db);
}

type TokenForeignKey = {
  table: string;
  from: string;
  to: string;
  on_delete: string;
};

function tokensForeignKeysReady(db: Db): boolean {
  const keys = db.prepare("PRAGMA foreign_key_list(tokens)").all() as TokenForeignKey[];
  const mapFk = keys.find(
    (key) => key.from === "map_id" && key.table === "maps" && key.on_delete.toLowerCase() === "cascade",
  );
  const characterFk = keys.find(
    (key) =>
      key.from === "character_id" &&
      key.table === "characters" &&
      key.on_delete.toLowerCase() === "cascade",
  );
  return Boolean(mapFk && characterFk);
}

function ensureTokensForeignKeys(db: Db): void {
  if (tokensForeignKeysReady(db)) {
    return;
  }

  db.exec(`
    DELETE FROM tokens
    WHERE map_id IS NOT NULL
      AND map_id NOT IN (SELECT id FROM maps);

    DELETE FROM tokens
    WHERE character_id IS NOT NULL
      AND character_id NOT IN (SELECT id FROM characters);

    CREATE TABLE tokens_fk (
      id TEXT PRIMARY KEY,
      room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
      label TEXT NOT NULL,
      image TEXT,
      x REAL NOT NULL,
      y REAL NOT NULL,
      size_cells REAL NOT NULL DEFAULT 1,
      is_player INT NOT NULL DEFAULT 0,
      map_id TEXT REFERENCES maps(id) ON DELETE CASCADE,
      character_id TEXT REFERENCES characters(id) ON DELETE CASCADE
    );

    INSERT INTO tokens_fk (
      id, room_id, label, image, x, y, size_cells, is_player, map_id, character_id
    )
    SELECT
      id, room_id, label, image, x, y, size_cells, is_player, map_id, character_id
    FROM tokens;

    DROP TABLE tokens;
    ALTER TABLE tokens_fk RENAME TO tokens;

    CREATE INDEX IF NOT EXISTS idx_tokens_map_id ON tokens(map_id);
    CREATE INDEX IF NOT EXISTS idx_tokens_character_id ON tokens(character_id);
  `);
}

function ensureColumn(db: Db, table: string, column: string, definition: string): void {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  if (rows.some((row) => row.name === column)) {
    return;
  }
  db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}

function backfillActiveMaps(db: Db): void {
  const rooms = db
    .prepare("SELECT id, active_map_id FROM rooms WHERE active_map_id IS NULL")
    .all() as Array<{ id: string; active_map_id: string | null }>;
  const findMap = db.prepare("SELECT id FROM maps WHERE room_id = ? ORDER BY rowid ASC LIMIT 1");
  const setActive = db.prepare("UPDATE rooms SET active_map_id = ? WHERE id = ?");
  for (const room of rooms) {
    const map = findMap.get(room.id) as { id: string } | undefined;
    if (map) {
      setActive.run(map.id, room.id);
    }
  }
}

function backfillTokenMaps(db: Db): void {
  const tokens = db
    .prepare("SELECT id, room_id FROM tokens WHERE map_id IS NULL")
    .all() as Array<{ id: string; room_id: string }>;
  if (tokens.length === 0) {
    return;
  }
  const active = db.prepare("SELECT active_map_id FROM rooms WHERE id = ?");
  const update = db.prepare("UPDATE tokens SET map_id = ? WHERE id = ?");
  for (const token of tokens) {
    const room = active.get(token.room_id) as { active_map_id: string | null } | undefined;
    if (room?.active_map_id) {
      update.run(room.active_map_id, token.id);
    }
  }
}
