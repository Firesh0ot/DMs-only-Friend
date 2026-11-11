import {
  type CameraState,
  type InitiativeState,
  type MapState,
  type Role,
  type RoomState,
  type Snapshot,
  type TokenState,
} from "@dms/shared";
import { customAlphabet } from "nanoid";
import type { Db } from "./db.js";

const makeCode = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 6);
const makeId = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 16);

type RoomRow = { id: string; code: string; name: string; created_at: string };
type MapRow = {
  id: string;
  room_id: string;
  filename: string;
  width: number;
  height: number;
  grid_px: number;
  offset_x: number;
  offset_y: number;
};
type TokenRow = {
  id: string;
  room_id: string;
  label: string;
  image: string | null;
  x: number;
  y: number;
  size_cells: number;
  is_player: number;
};
type CameraRow = { room_id: string; x: number; y: number; zoom: number };
type InitiativeRow = { room_id: string; order_json: string; active_index: number };

export type Session = {
  socketId: string;
  roomId: string;
  role: Role;
  playerName: string | null;
};

export class RoomStore {
  private sessions = new Map<string, Session>();

  constructor(private readonly db: Db) {}

  createRoom(name = "Table"): { room: RoomState; code: string } {
    const id = makeId();
    const code = makeCode();
    const createdAt = new Date().toISOString();
    this.db
      .prepare("INSERT INTO rooms (id, code, name, created_at) VALUES (?, ?, ?, ?)")
      .run(id, code, name, createdAt);
    return { room: { id, code, name }, code };
  }

  getRoomByCode(code: string): RoomState | null {
    const row = this.db
      .prepare("SELECT id, code, name FROM rooms WHERE code = ?")
      .get(code.toUpperCase()) as Pick<RoomRow, "id" | "code" | "name"> | undefined;
    return row ? { id: row.id, code: row.code, name: row.name } : null;
  }

  getRoomById(roomId: string): RoomState | null {
    const row = this.db
      .prepare("SELECT id, code, name FROM rooms WHERE id = ?")
      .get(roomId) as Pick<RoomRow, "id" | "code" | "name"> | undefined;
    return row ? { id: row.id, code: row.code, name: row.name } : null;
  }

  bindSession(socketId: string, session: Omit<Session, "socketId">): Session {
    const full: Session = { socketId, ...session };
    this.sessions.set(socketId, full);
    return full;
  }

  getSession(socketId: string): Session | undefined {
    return this.sessions.get(socketId);
  }

  removeSession(socketId: string): void {
    this.sessions.delete(socketId);
  }

  getMap(roomId: string): MapState | null {
    const row = this.db.prepare("SELECT * FROM maps WHERE room_id = ?").get(roomId) as
      | MapRow
      | undefined;
    return row ? mapRowToState(row) : null;
  }

  setMap(
    roomId: string,
    input: {
      filename: string;
      width: number;
      height: number;
      gridPx: number;
      offsetX?: number;
      offsetY?: number;
    },
  ): MapState {
    const existing = this.getMap(roomId);
    const id = existing?.id ?? makeId();
    this.db.prepare("DELETE FROM maps WHERE room_id = ?").run(roomId);
    this.db
      .prepare(
        `INSERT INTO maps (id, room_id, filename, width, height, grid_px, offset_x, offset_y)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        roomId,
        input.filename,
        input.width,
        input.height,
        input.gridPx,
        input.offsetX ?? 0,
        input.offsetY ?? 0,
      );
    const map = this.getMap(roomId);
    if (!map) {
      throw new Error("Failed to persist map");
    }
    return map;
  }

  listTokens(roomId: string): TokenState[] {
    const rows = this.db
      .prepare("SELECT * FROM tokens WHERE room_id = ? ORDER BY label ASC")
      .all(roomId) as TokenRow[];
    return rows.map(tokenRowToState);
  }

  getToken(tokenId: string): TokenState | null {
    const row = this.db.prepare("SELECT * FROM tokens WHERE id = ?").get(tokenId) as
      | TokenRow
      | undefined;
    return row ? tokenRowToState(row) : null;
  }

  createToken(input: {
    roomId: string;
    label: string;
    image?: string | null;
    x: number;
    y: number;
    sizeCells?: number;
    isPlayer?: boolean;
  }): TokenState {
    const id = makeId();
    this.db
      .prepare(
        `INSERT INTO tokens (id, room_id, label, image, x, y, size_cells, is_player)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        input.roomId,
        input.label,
        input.image ?? null,
        input.x,
        input.y,
        input.sizeCells ?? 1,
        input.isPlayer ? 1 : 0,
      );
    const token = this.getToken(id);
    if (!token) {
      throw new Error("Failed to persist token");
    }
    return token;
  }

  moveToken(tokenId: string, x: number, y: number): TokenState {
    this.db.prepare("UPDATE tokens SET x = ?, y = ? WHERE id = ?").run(x, y, tokenId);
    const token = this.getToken(tokenId);
    if (!token) {
      throw new Error("Token not found");
    }
    return token;
  }

  removeToken(tokenId: string): void {
    this.db.prepare("DELETE FROM tokens WHERE id = ?").run(tokenId);
  }

  getCamera(roomId: string): CameraState | null {
    const row = this.db.prepare("SELECT * FROM room_camera WHERE room_id = ?").get(roomId) as
      | CameraRow
      | undefined;
    return row ? { x: row.x, y: row.y, zoom: row.zoom } : null;
  }

  setCamera(roomId: string, camera: CameraState): CameraState {
    this.db
      .prepare(
        `INSERT INTO room_camera (room_id, x, y, zoom) VALUES (?, ?, ?, ?)
         ON CONFLICT(room_id) DO UPDATE SET x = excluded.x, y = excluded.y, zoom = excluded.zoom`,
      )
      .run(roomId, camera.x, camera.y, camera.zoom);
    return camera;
  }

  getInitiative(roomId: string): InitiativeState | null {
    const row = this.db
      .prepare("SELECT * FROM room_initiative WHERE room_id = ?")
      .get(roomId) as InitiativeRow | undefined;
    if (!row) {
      return null;
    }
    const order = JSON.parse(row.order_json) as InitiativeState["order"];
    return { order, activeIndex: row.active_index };
  }

  setInitiative(roomId: string, initiative: InitiativeState): InitiativeState {
    this.db
      .prepare(
        `INSERT INTO room_initiative (room_id, order_json, active_index) VALUES (?, ?, ?)
         ON CONFLICT(room_id) DO UPDATE SET
           order_json = excluded.order_json,
           active_index = excluded.active_index`,
      )
      .run(roomId, JSON.stringify(initiative.order), initiative.activeIndex);
    return initiative;
  }

  logDice(input: {
    roomId: string;
    playerName: string;
    expr: string;
    results: number[];
    total: number;
  }): { id: number; createdAt: string } {
    const createdAt = new Date().toISOString();
    const result = this.db
      .prepare(
        `INSERT INTO dice_log (room_id, player_name, expr, results_json, total, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        input.roomId,
        input.playerName,
        input.expr,
        JSON.stringify(input.results),
        input.total,
        createdAt,
      );
    return { id: Number(result.lastInsertRowid), createdAt };
  }

  getSnapshot(roomId: string, role: Role, playerName: string | null): Snapshot {
    const room = this.getRoomById(roomId);
    if (!room) {
      throw new Error("Room not found");
    }
    return {
      room,
      map: this.getMap(roomId),
      tokens: this.listTokens(roomId),
      camera: this.getCamera(roomId),
      initiative: this.getInitiative(roomId),
      role,
      playerName,
    };
  }
}

function mapRowToState(row: MapRow): MapState {
  return {
    id: row.id,
    roomId: row.room_id,
    filename: row.filename,
    width: row.width,
    height: row.height,
    gridPx: row.grid_px,
    offsetX: row.offset_x,
    offsetY: row.offset_y,
  };
}

function tokenRowToState(row: TokenRow): TokenState {
  return {
    id: row.id,
    roomId: row.room_id,
    label: row.label,
    image: row.image,
    x: row.x,
    y: row.y,
    sizeCells: row.size_cells,
    isPlayer: row.is_player === 1,
  };
}

export function roomChannel(roomId: string): string {
  return `room:${roomId}`;
}
