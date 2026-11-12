import {
  hpToQuarter,
  normalizeRoomCode,
  RoomCodeSchema,
  type BattleState,
  type CameraState,
  type CharacterKind,
  type CharacterState,
  type ConditionId,
  ConditionIdSchema,
  type FogState,
  type FogStroke,
  type FogStrokeInput,
  type InitiativeState,
  type MapState,
  type Role,
  type RoomSettings,
  type RoomState,
  type SessionEvent,
  type SessionEventType,
  type Snapshot,
  type TokenState,
  type VisibilityState,
} from "@dms/shared";
import { customAlphabet } from "nanoid";
import { hashSecret, hashToken, randomToken, verifySecret } from "./authCrypto.js";
import type { Db } from "./db.js";

const makeCode = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 6);
const makeId = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 16);
const EVENT_LOG_LIMIT = 80;
const TOKEN_MOVE_LOG_MS = 3000;
const FOG_STROKE_LIMIT = 400;
const UPLOAD_TOKEN_TTL_MS = 12 * 60 * 60 * 1000;

type RoomRow = {
  id: string;
  code: string;
  name: string;
  created_at: string;
  active_map_id: string | null;
  show_pcs: number;
  show_npcs: number;
  pin_hash: string | null;
  pin_salt: string | null;
  gm_invite_hash: string | null;
  screen_hp_quarters: number;
  gm_claimed: number;
};
type MapRow = {
  id: string;
  room_id: string;
  name: string;
  filename: string;
  width: number;
  height: number;
  grid_px: number;
  offset_x: number;
  offset_y: number;
  walls_json: string | null;
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
  map_id: string | null;
  character_id: string | null;
};
type CharacterRow = {
  id: string;
  room_id: string;
  name: string;
  kind: string;
  image: string | null;
  notes: string | null;
  size_cells: number;
  hp_current: number | null;
  hp_max: number | null;
  ac: number | null;
  conditions_json: string | null;
};
type CameraRow = { room_id: string; x: number; y: number; zoom: number };
type InitiativeRow = {
  room_id: string;
  order_json: string;
  active_index: number;
  round: number;
};
type BattleRow = {
  id: string;
  room_id: string;
  started_at: string;
  ended_at: string | null;
};
type SessionEventRow = {
  id: number;
  room_id: string;
  battle_id: string | null;
  type: string;
  summary: string;
  payload_json: string;
  created_at: string;
};
type MapFogRow = {
  map_id: string;
  base_covered: number;
  strokes_json: string;
  los_enabled: number;
};

export type Session = {
  socketId: string;
  roomId: string;
  role: Role;
  playerName: string | null;
  characterId: string | null;
};

export type CreateRoomInput = {
  name?: string;
  code?: string;
  pin?: string;
};

export class RoomStore {
  private sessions = new Map<string, Session>();
  private tokenMoveLogAt = new Map<string, number>();
  private uploadTokens = new Map<string, { roomId: string; expiresAt: number }>();

  constructor(private readonly db: Db) {}

  createRoom(input: CreateRoomInput | string = {}): {
    room: RoomState;
    code: string;
    gmInviteToken: string;
  } {
    const options = typeof input === "string" ? { name: input } : input;
    const name = options.name?.trim() || "Table";
    const code = options.code ? RoomCodeSchema.parse(options.code) : makeCode();
    const pin = options.pin ?? "1234";
    if (this.getRoomByCode(code)) {
      throw new Error("Room code already taken");
    }
    const id = makeId();
    const createdAt = new Date().toISOString();
    const pinSecret = hashSecret(pin);
    const gmInviteToken = randomToken();
    const inviteHash = hashToken(gmInviteToken);
    this.db
      .prepare(
        `INSERT INTO rooms (
           id, code, name, created_at, show_pcs, show_npcs,
           pin_hash, pin_salt, gm_invite_hash, screen_hp_quarters, gm_claimed
         ) VALUES (?, ?, ?, ?, 1, 1, ?, ?, ?, 0, 0)`,
      )
      .run(id, code, name, createdAt, pinSecret.hash, pinSecret.salt, inviteHash);
    return { room: { id, code, name }, code, gmInviteToken };
  }

  getRoomByCode(code: string): RoomState | null {
    const row = this.db
      .prepare("SELECT id, code, name FROM rooms WHERE code = ?")
      .get(normalizeRoomCode(code)) as Pick<RoomRow, "id" | "code" | "name"> | undefined;
    return row ? { id: row.id, code: row.code, name: row.name } : null;
  }

  getRoomById(roomId: string): RoomState | null {
    const row = this.db
      .prepare("SELECT id, code, name FROM rooms WHERE id = ?")
      .get(roomId) as Pick<RoomRow, "id" | "code" | "name"> | undefined;
    return row ? { id: row.id, code: row.code, name: row.name } : null;
  }

  private getRoomRow(roomId: string): RoomRow | null {
    const row = this.db.prepare("SELECT * FROM rooms WHERE id = ?").get(roomId) as
      | RoomRow
      | undefined;
    return row ?? null;
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

  listSessionsInRoom(roomId: string): Session[] {
    return [...this.sessions.values()].filter((session) => session.roomId === roomId);
  }

  listMaps(roomId: string): MapState[] {
    const rows = this.db
      .prepare("SELECT * FROM maps WHERE room_id = ? ORDER BY rowid ASC")
      .all(roomId) as MapRow[];
    return rows.map(mapRowToState);
  }

  getMapById(mapId: string): MapState | null {
    const row = this.db.prepare("SELECT * FROM maps WHERE id = ?").get(mapId) as
      | MapRow
      | undefined;
    return row ? mapRowToState(row) : null;
  }

  getActiveMap(roomId: string): MapState | null {
    const room = this.getRoomRow(roomId);
    if (!room?.active_map_id) {
      return null;
    }
    return this.getMapById(room.active_map_id);
  }

  getMap(roomId: string): MapState | null {
    return this.getActiveMap(roomId);
  }

  addMap(
    roomId: string,
    input: {
      name: string;
      filename: string;
      width: number;
      height: number;
      gridPx: number;
      offsetX?: number;
      offsetY?: number;
      walls?: MapState["walls"];
    },
  ): MapState {
    const id = makeId();
    this.db
      .prepare(
        `INSERT INTO maps (id, room_id, name, filename, width, height, grid_px, offset_x, offset_y, walls_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        roomId,
        input.name,
        input.filename,
        input.width,
        input.height,
        input.gridPx,
        input.offsetX ?? 0,
        input.offsetY ?? 0,
        JSON.stringify(input.walls ?? []),
      );
    const room = this.getRoomRow(roomId);
    if (!room?.active_map_id) {
      this.db.prepare("UPDATE rooms SET active_map_id = ? WHERE id = ?").run(id, roomId);
    }
    const map = this.getMapById(id);
    if (!map) {
      throw new Error("Failed to persist map");
    }
    return map;
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
      name?: string;
    },
  ): MapState {
    return this.addMap(roomId, {
      name: input.name ?? deriveMapName(input.filename),
      filename: input.filename,
      width: input.width,
      height: input.height,
      gridPx: input.gridPx,
      offsetX: input.offsetX,
      offsetY: input.offsetY,
    });
  }

  updateMapGrid(mapId: string, gridPx: number): MapState {
    this.db.prepare("UPDATE maps SET grid_px = ? WHERE id = ?").run(gridPx, mapId);
    const map = this.getMapById(mapId);
    if (!map) {
      throw new Error("Map not found");
    }
    return map;
  }

  setActiveMap(roomId: string, mapId: string): MapState {
    const map = this.getMapById(mapId);
    if (!map || map.roomId !== roomId) {
      throw new Error("Map not found");
    }
    this.db.prepare("UPDATE rooms SET active_map_id = ? WHERE id = ?").run(mapId, roomId);
    this.syncTokensForActiveMap(roomId);
    return map;
  }

  removeMap(roomId: string, mapId: string): { maps: MapState[]; active: MapState | null } {
    const map = this.getMapById(mapId);
    if (!map || map.roomId !== roomId) {
      throw new Error("Map not found");
    }
    this.db.prepare("DELETE FROM map_fog WHERE map_id = ?").run(mapId);
    this.db.prepare("DELETE FROM character_maps WHERE map_id = ?").run(mapId);
    this.db.prepare("DELETE FROM tokens WHERE map_id = ?").run(mapId);
    this.db.prepare("DELETE FROM maps WHERE id = ?").run(mapId);
    const room = this.getRoomRow(roomId);
    if (room?.active_map_id === mapId) {
      const remaining = this.listMaps(roomId);
      const next = remaining[0] ?? null;
      this.db
        .prepare("UPDATE rooms SET active_map_id = ? WHERE id = ?")
        .run(next?.id ?? null, roomId);
      if (next) {
        this.syncTokensForActiveMap(roomId);
      }
    }
    return { maps: this.listMaps(roomId), active: this.getActiveMap(roomId) };
  }

  getVisibility(roomId: string): VisibilityState {
    const room = this.getRoomRow(roomId);
    return {
      showPcs: room ? room.show_pcs === 1 : true,
      showNpcs: room ? room.show_npcs === 1 : true,
    };
  }

  setVisibility(roomId: string, input: Partial<VisibilityState>): VisibilityState {
    const current = this.getVisibility(roomId);
    const next = {
      showPcs: input.showPcs ?? current.showPcs,
      showNpcs: input.showNpcs ?? current.showNpcs,
    };
    this.db
      .prepare("UPDATE rooms SET show_pcs = ?, show_npcs = ? WHERE id = ?")
      .run(next.showPcs ? 1 : 0, next.showNpcs ? 1 : 0, roomId);
    return next;
  }

  getSettings(roomId: string): RoomSettings {
    const room = this.getRoomRow(roomId);
    return {
      screenHpQuarters: room ? room.screen_hp_quarters === 1 : false,
    };
  }

  setSettings(roomId: string, input: Partial<RoomSettings>): RoomSettings {
    const current = this.getSettings(roomId);
    const next = {
      screenHpQuarters: input.screenHpQuarters ?? current.screenHpQuarters,
    };
    this.db
      .prepare("UPDATE rooms SET screen_hp_quarters = ? WHERE id = ?")
      .run(next.screenHpQuarters ? 1 : 0, roomId);
    return next;
  }

  hasGmPin(roomId: string): boolean {
    const room = this.getRoomRow(roomId);
    return Boolean(room?.pin_hash && room.pin_salt);
  }

  hasPendingGmInvite(roomId: string): boolean {
    const room = this.getRoomRow(roomId);
    return Boolean(room?.gm_invite_hash);
  }

  isGmClaimed(roomId: string): boolean {
    const room = this.getRoomRow(roomId);
    if (!room) {
      return false;
    }
    if (!room.pin_hash || !room.pin_salt) {
      return true;
    }
    return room.gm_claimed === 1;
  }

  requiresGmInvite(roomId: string): boolean {
    return this.hasPendingGmInvite(roomId) && !this.isGmClaimed(roomId);
  }

  verifyGmPin(roomId: string, pin: string): boolean {
    const room = this.getRoomRow(roomId);
    if (!room?.pin_hash || !room.pin_salt) {
      return true;
    }
    return verifySecret(pin, room.pin_hash, room.pin_salt);
  }

  assertGmJoin(roomId: string, pin: string | undefined, invite: string | undefined): void {
    const room = this.getRoomRow(roomId);
    if (!room) {
      throw new Error("Room not found");
    }
    const pinRequired = Boolean(room.pin_hash && room.pin_salt);
    if (pinRequired) {
      if (!pin) {
        throw new Error("GM PIN required");
      }
      if (!verifySecret(pin, room.pin_hash!, room.pin_salt!)) {
        throw new Error("Invalid GM PIN");
      }
    }
    const claimed = !pinRequired || room.gm_claimed === 1;
    if (room.gm_invite_hash) {
      if (!invite) {
        if (!claimed) {
          throw new Error(
            "Single-use GM invite URL required for the first GM claim — open the invite link or mint a new one with the PIN",
          );
        }
        return;
      }
      if (hashToken(invite) !== room.gm_invite_hash) {
        throw new Error("Invalid or used GM invite");
      }
      this.db
        .prepare("UPDATE rooms SET gm_invite_hash = NULL, gm_claimed = 1 WHERE id = ?")
        .run(roomId);
      return;
    }
    if (!claimed) {
      this.db.prepare("UPDATE rooms SET gm_claimed = 1 WHERE id = ?").run(roomId);
    }
  }

  mintGmInvite(roomId: string): string {
    const invite = randomToken();
    this.db
      .prepare("UPDATE rooms SET gm_invite_hash = ? WHERE id = ?")
      .run(hashToken(invite), roomId);
    return invite;
  }

  mintGmInviteWithPin(roomId: string, pin: string): string {
    if (!this.verifyGmPin(roomId, pin)) {
      throw new Error("Invalid GM PIN");
    }
    if (!this.hasGmPin(roomId)) {
      throw new Error("Room has no GM PIN");
    }
    return this.mintGmInvite(roomId);
  }

  changeGmPin(
    roomId: string,
    input: { currentPin: string; newPin: string; invalidateInvites?: boolean },
  ): { inviteInvalidated: boolean } {
    const room = this.getRoomRow(roomId);
    if (!room) {
      throw new Error("Room not found");
    }
    if (!this.verifyGmPin(roomId, input.currentPin)) {
      throw new Error("Invalid GM PIN");
    }
    if (input.newPin === input.currentPin && this.hasGmPin(roomId)) {
      throw new Error("New PIN must differ from the current PIN");
    }
    const pinSecret = hashSecret(input.newPin);
    const invalidate = Boolean(input.invalidateInvites);
    if (invalidate) {
      this.db
        .prepare(
          `UPDATE rooms SET pin_hash = ?, pin_salt = ?, gm_invite_hash = NULL WHERE id = ?`,
        )
        .run(pinSecret.hash, pinSecret.salt, roomId);
    } else {
      this.db
        .prepare(`UPDATE rooms SET pin_hash = ?, pin_salt = ? WHERE id = ?`)
        .run(pinSecret.hash, pinSecret.salt, roomId);
    }
    return { inviteInvalidated: invalidate && Boolean(room.gm_invite_hash) };
  }

  issueUploadToken(roomId: string): string {
    const token = randomToken();
    this.uploadTokens.set(token, {
      roomId,
      expiresAt: Date.now() + UPLOAD_TOKEN_TTL_MS,
    });
    return token;
  }

  validateUploadToken(token: string, roomId: string): boolean {
    const entry = this.uploadTokens.get(token);
    if (!entry) {
      return false;
    }
    if (entry.expiresAt < Date.now()) {
      this.uploadTokens.delete(token);
      return false;
    }
    return entry.roomId === roomId;
  }

  revokeUploadToken(token: string): void {
    this.uploadTokens.delete(token);
  }

  listCharacters(roomId: string): CharacterState[] {
    const rows = this.db
      .prepare("SELECT * FROM characters WHERE room_id = ? ORDER BY kind ASC, name ASC")
      .all(roomId) as CharacterRow[];
    const links = this.db
      .prepare(
        `SELECT character_id, map_id FROM character_maps
         WHERE character_id IN (SELECT id FROM characters WHERE room_id = ?)`,
      )
      .all(roomId) as Array<{ character_id: string; map_id: string }>;
    const byCharacter = new Map<string, string[]>();
    for (const link of links) {
      const list = byCharacter.get(link.character_id) ?? [];
      list.push(link.map_id);
      byCharacter.set(link.character_id, list);
    }
    return rows.map((row) => toCharacterState(row, byCharacter.get(row.id) ?? []));
  }

  listCharactersForRole(roomId: string, role: Role): CharacterState[] {
    const screenHpQuarters = this.getSettings(roomId).screenHpQuarters;
    return this.listCharacters(roomId).map((character) =>
      redactCharacterStatsForRole(character, role, screenHpQuarters),
    );
  }

  getCharacter(characterId: string): CharacterState | null {
    const row = this.db.prepare("SELECT * FROM characters WHERE id = ?").get(characterId) as
      | CharacterRow
      | undefined;
    if (!row) {
      return null;
    }
    const mapIds = (
      this.db
        .prepare("SELECT map_id FROM character_maps WHERE character_id = ?")
        .all(characterId) as Array<{ map_id: string }>
    ).map((entry) => entry.map_id);
    return toCharacterState(row, mapIds);
  }

  upsertCharacter(input: {
    id?: string;
    roomId: string;
    name: string;
    kind: CharacterKind;
    image?: string | null;
    notes?: string | null;
    sizeCells?: number;
    mapIds?: string[];
    hpCurrent?: number | null;
    hpMax?: number | null;
    ac?: number | null;
  }): CharacterState {
    const id = input.id ?? makeId();
    const existing = input.id ? this.getCharacter(input.id) : null;
    if (existing && existing.roomId !== input.roomId) {
      throw new Error("Character not found");
    }
    const nextHp = normalizeHp({
      hpCurrent:
        input.hpCurrent !== undefined
          ? input.hpCurrent
          : (existing?.hpCurrent ?? null),
      hpMax: input.hpMax !== undefined ? input.hpMax : (existing?.hpMax ?? null),
    });
    const nextAc = input.ac !== undefined ? input.ac : (existing?.ac ?? null);
    if (existing) {
      this.db
        .prepare(
          `UPDATE characters SET name = ?, kind = ?, image = ?, notes = ?, size_cells = ?,
           hp_current = ?, hp_max = ?, ac = ? WHERE id = ?`,
        )
        .run(
          input.name,
          input.kind,
          input.image !== undefined ? input.image : existing.image,
          input.notes !== undefined ? input.notes : existing.notes,
          input.sizeCells ?? existing.sizeCells,
          nextHp.hpCurrent,
          nextHp.hpMax,
          nextAc,
          id,
        );
    } else {
      this.db
        .prepare(
          `INSERT INTO characters (id, room_id, name, kind, image, notes, size_cells, hp_current, hp_max, ac)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          id,
          input.roomId,
          input.name,
          input.kind,
          input.image ?? null,
          input.notes ?? null,
          input.sizeCells ?? 1,
          nextHp.hpCurrent,
          nextHp.hpMax,
          nextAc,
        );
    }

    if (input.mapIds) {
      this.setCharacterMaps(id, input.roomId, input.mapIds);
    }

    this.syncTokensForActiveMap(input.roomId);
    const character = this.getCharacter(id);
    if (!character) {
      throw new Error("Failed to persist character");
    }
    return character;
  }

  setCharacterHp(
    characterId: string,
    input: { hpCurrent?: number | null; hpMax?: number | null; delta?: number },
  ): CharacterState {
    const existing = this.getCharacter(characterId);
    if (!existing) {
      throw new Error("Character not found");
    }
    let hpCurrent = existing.hpCurrent;
    let hpMax = existing.hpMax;
    if (input.hpMax !== undefined) {
      hpMax = input.hpMax;
    }
    if (input.delta !== undefined) {
      const base = hpCurrent ?? hpMax ?? 0;
      hpCurrent = base + input.delta;
    } else if (input.hpCurrent !== undefined) {
      hpCurrent = input.hpCurrent;
    }
    const nextHp = normalizeHp({ hpCurrent, hpMax });
    this.db
      .prepare("UPDATE characters SET hp_current = ?, hp_max = ? WHERE id = ?")
      .run(nextHp.hpCurrent, nextHp.hpMax, characterId);
    const character = this.getCharacter(characterId);
    if (!character) {
      throw new Error("Failed to persist HP");
    }
    return character;
  }

  setCharacterConditions(characterId: string, conditions: ConditionId[]): CharacterState {
    const existing = this.getCharacter(characterId);
    if (!existing) {
      throw new Error("Character not found");
    }
    const next = normalizeConditions(conditions);
    this.db
      .prepare("UPDATE characters SET conditions_json = ? WHERE id = ?")
      .run(JSON.stringify(next), characterId);
    const character = this.getCharacter(characterId);
    if (!character) {
      throw new Error("Failed to persist conditions");
    }
    return character;
  }

  removeCharacter(characterId: string): { roomId: string } {
    const character = this.getCharacter(characterId);
    if (!character) {
      throw new Error("Character not found");
    }
    this.db.prepare("DELETE FROM tokens WHERE character_id = ?").run(characterId);
    this.db.prepare("DELETE FROM character_maps WHERE character_id = ?").run(characterId);
    this.db.prepare("DELETE FROM characters WHERE id = ?").run(characterId);
    return { roomId: character.roomId };
  }

  private setCharacterMaps(characterId: string, roomId: string, mapIds: string[]): void {
    const roomMaps = new Set(this.listMaps(roomId).map((map) => map.id));
    const valid = [...new Set(mapIds)].filter((mapId) => roomMaps.has(mapId));
    const existing = this.db
      .prepare("SELECT map_id, x, y FROM character_maps WHERE character_id = ?")
      .all(characterId) as Array<{ map_id: string; x: number; y: number }>;
    const positions = new Map(existing.map((row) => [row.map_id, { x: row.x, y: row.y }]));
    this.db.prepare("DELETE FROM character_maps WHERE character_id = ?").run(characterId);
    const insert = this.db.prepare(
      `INSERT INTO character_maps (character_id, map_id, x, y) VALUES (?, ?, ?, ?)`,
    );
    for (const mapId of valid) {
      const pos = positions.get(mapId) ?? { x: 1, y: 1 };
      insert.run(characterId, mapId, pos.x, pos.y);
    }
    if (valid.length === 0) {
      this.db.prepare("DELETE FROM tokens WHERE character_id = ?").run(characterId);
      return;
    }
    this.db
      .prepare(
        `DELETE FROM tokens WHERE character_id = ? AND (map_id IS NULL OR map_id NOT IN (${valid
          .map(() => "?")
          .join(",")}))`,
      )
      .run(characterId, ...valid);
  }

  syncTokensForActiveMap(roomId: string): TokenState[] {
    const active = this.getActiveMap(roomId);
    if (!active) {
      return this.listVisibleTokens(roomId);
    }
    const characters = this.listCharacters(roomId);
    const placements = this.db
      .prepare("SELECT character_id, map_id, x, y FROM character_maps WHERE map_id = ?")
      .all(active.id) as Array<{ character_id: string; map_id: string; x: number; y: number }>;
    const byId = new Map(characters.map((character) => [character.id, character]));
    const existing = this.db
      .prepare("SELECT * FROM tokens WHERE room_id = ? AND map_id = ?")
      .all(roomId, active.id) as TokenRow[];
    const byCharacter = new Map(
      existing
        .filter((row) => row.character_id)
        .map((row) => [row.character_id as string, row]),
    );

    for (const placement of placements) {
      const character = byId.get(placement.character_id);
      if (!character) {
        continue;
      }
      const tokenRow = byCharacter.get(character.id);
      if (tokenRow) {
        this.db
          .prepare(
            `UPDATE tokens SET label = ?, image = ?, size_cells = ?, is_player = ?, x = ?, y = ?
             WHERE id = ?`,
          )
          .run(
            character.name,
            character.image,
            character.sizeCells,
            character.kind === "pc" ? 1 : 0,
            placement.x,
            placement.y,
            tokenRow.id,
          );
      } else {
        this.createToken({
          roomId,
          label: character.name,
          image: character.image,
          x: placement.x,
          y: placement.y,
          sizeCells: character.sizeCells,
          isPlayer: character.kind === "pc",
          mapId: active.id,
          characterId: character.id,
        });
      }
    }

    const linkedIds = new Set(placements.map((placement) => placement.character_id));
    for (const row of existing) {
      if (row.character_id && !linkedIds.has(row.character_id)) {
        this.db.prepare("DELETE FROM tokens WHERE id = ?").run(row.id);
      }
    }

    return this.listVisibleTokens(roomId);
  }

  listTokens(roomId: string): TokenState[] {
    return this.listVisibleTokens(roomId);
  }

  listVisibleTokens(roomId: string): TokenState[] {
    const active = this.getActiveMap(roomId);
    const visibility = this.getVisibility(roomId);
    let rows: TokenRow[];
    if (active) {
      rows = this.db
        .prepare("SELECT * FROM tokens WHERE room_id = ? AND map_id = ? ORDER BY label ASC")
        .all(roomId, active.id) as TokenRow[];
    } else {
      rows = this.db
        .prepare("SELECT * FROM tokens WHERE room_id = ? ORDER BY label ASC")
        .all(roomId) as TokenRow[];
    }
    return rows
      .map(tokenRowToState)
      .filter((token) => (token.isPlayer ? visibility.showPcs : visibility.showNpcs));
  }

  listAllTokensOnActiveMap(roomId: string): TokenState[] {
    const active = this.getActiveMap(roomId);
    if (!active) {
      const rows = this.db
        .prepare("SELECT * FROM tokens WHERE room_id = ? ORDER BY label ASC")
        .all(roomId) as TokenRow[];
      return rows.map(tokenRowToState);
    }
    const rows = this.db
      .prepare("SELECT * FROM tokens WHERE room_id = ? AND map_id = ? ORDER BY label ASC")
      .all(roomId, active.id) as TokenRow[];
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
    mapId?: string | null;
    characterId?: string | null;
  }): TokenState {
    const id = makeId();
    const mapId = input.mapId ?? this.getActiveMap(input.roomId)?.id ?? null;
    this.db
      .prepare(
        `INSERT INTO tokens (id, room_id, label, image, x, y, size_cells, is_player, map_id, character_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        mapId,
        input.characterId ?? null,
      );
    if (input.characterId && mapId) {
      this.db
        .prepare(
          `INSERT INTO character_maps (character_id, map_id, x, y)
           VALUES (?, ?, ?, ?)
           ON CONFLICT(character_id, map_id) DO UPDATE SET x = excluded.x, y = excluded.y`,
        )
        .run(input.characterId, mapId, input.x, input.y);
    }
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
    if (token.characterId && token.mapId) {
      this.db
        .prepare(
          `UPDATE character_maps SET x = ?, y = ? WHERE character_id = ? AND map_id = ?`,
        )
        .run(x, y, token.characterId, token.mapId);
    }
    return token;
  }

  removeToken(tokenId: string): void {
    const token = this.getToken(tokenId);
    this.db.prepare("DELETE FROM tokens WHERE id = ?").run(tokenId);
    if (token?.characterId && token.mapId) {
      this.db
        .prepare("DELETE FROM character_maps WHERE character_id = ? AND map_id = ?")
        .run(token.characterId, token.mapId);
    }
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

  setCharacterPortrait(characterId: string, imageUrl: string): CharacterState {
    const existing = this.getCharacter(characterId);
    if (!existing) {
      throw new Error("Character not found");
    }
    this.db.prepare("UPDATE characters SET image = ? WHERE id = ?").run(imageUrl, characterId);
    this.db
      .prepare("UPDATE tokens SET image = ? WHERE character_id = ?")
      .run(imageUrl, characterId);
    this.refreshInitiativePortraits(existing.roomId);
    const character = this.getCharacter(characterId);
    if (!character) {
      throw new Error("Failed to persist portrait");
    }
    return character;
  }

  refreshInitiativePortraits(roomId: string): InitiativeState | null {
    const current = this.getInitiative(roomId);
    if (!current || current.order.length === 0) {
      return current;
    }
    const tokens = this.listAllTokensOnActiveMap(roomId);
    const characters = this.listCharacters(roomId);
    const byToken = new Map(tokens.map((token) => [token.id, token]));
    const byCharacter = new Map(characters.map((character) => [character.id, character]));
    const order = current.order.map((entry) => {
      const token = byToken.get(entry.tokenId);
      const character = token?.characterId ? byCharacter.get(token.characterId) : undefined;
      return {
        ...entry,
        image: character?.image ?? token?.image ?? entry.image ?? null,
      };
    });
    return this.setInitiative(roomId, { ...current, order });
  }

  getInitiative(roomId: string): InitiativeState | null {
    const row = this.db
      .prepare("SELECT * FROM room_initiative WHERE room_id = ?")
      .get(roomId) as InitiativeRow | undefined;
    if (!row) {
      return null;
    }
    const order = JSON.parse(row.order_json) as InitiativeState["order"];
    return { order, activeIndex: row.active_index, round: row.round || 1 };
  }

  setInitiative(roomId: string, initiative: InitiativeState): InitiativeState {
    this.db
      .prepare(
        `INSERT INTO room_initiative (room_id, order_json, active_index, round) VALUES (?, ?, ?, ?)
         ON CONFLICT(room_id) DO UPDATE SET
           order_json = excluded.order_json,
           active_index = excluded.active_index,
           round = excluded.round`,
      )
      .run(
        roomId,
        JSON.stringify(initiative.order),
        initiative.activeIndex,
        initiative.round,
      );
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

  getActiveBattle(roomId: string): BattleState | null {
    const row = this.db
      .prepare(
        `SELECT * FROM battles
         WHERE room_id = ? AND ended_at IS NULL
         ORDER BY started_at DESC
         LIMIT 1`,
      )
      .get(roomId) as BattleRow | undefined;
    return row ? battleRowToState(row) : null;
  }

  startBattle(roomId: string): { battle: BattleState; event: SessionEvent } {
    if (this.getActiveBattle(roomId)) {
      throw new Error("Battle already active");
    }
    const id = makeId();
    const startedAt = new Date().toISOString();
    this.db
      .prepare("INSERT INTO battles (id, room_id, started_at, ended_at) VALUES (?, ?, ?, NULL)")
      .run(id, roomId, startedAt);
    const battle = this.getActiveBattle(roomId);
    if (!battle) {
      throw new Error("Failed to start battle");
    }
    const event = this.appendEvent({
      roomId,
      type: "battle_start",
      summary: "Battle started",
      payload: { battleId: battle.id },
      battleId: battle.id,
    });
    return { battle, event };
  }

  endBattle(roomId: string): { battle: BattleState; event: SessionEvent } {
    const active = this.getActiveBattle(roomId);
    if (!active) {
      throw new Error("No active battle");
    }
    const endedAt = new Date().toISOString();
    this.db.prepare("UPDATE battles SET ended_at = ? WHERE id = ?").run(endedAt, active.id);
    const battle: BattleState = { ...active, endedAt };
    const durationMs = Date.parse(endedAt) - Date.parse(active.startedAt);
    const event = this.appendEvent({
      roomId,
      type: "battle_end",
      summary: `Battle ended (${formatDuration(durationMs)})`,
      payload: { battleId: battle.id, durationMs },
      battleId: battle.id,
    });
    return { battle, event };
  }

  ensureBattleForNextTurn(roomId: string): {
    battle: BattleState;
    started: boolean;
    startEvent: SessionEvent | null;
  } {
    const existing = this.getActiveBattle(roomId);
    if (existing) {
      return { battle: existing, started: false, startEvent: null };
    }
    const { battle, event } = this.startBattle(roomId);
    return { battle, started: true, startEvent: event };
  }

  appendEvent(input: {
    roomId: string;
    type: SessionEventType;
    summary: string;
    payload?: Record<string, unknown>;
    battleId?: string | null;
    createdAt?: string;
  }): SessionEvent {
    const createdAt = input.createdAt ?? new Date().toISOString();
    const battleId =
      input.battleId === undefined ? this.getActiveBattle(input.roomId)?.id ?? null : input.battleId;
    const payload = input.payload ?? {};
    const result = this.db
      .prepare(
        `INSERT INTO session_events (room_id, battle_id, type, summary, payload_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(input.roomId, battleId, input.type, input.summary, JSON.stringify(payload), createdAt);
    return {
      id: Number(result.lastInsertRowid),
      roomId: input.roomId,
      battleId,
      type: input.type,
      summary: input.summary,
      payload,
      createdAt,
    };
  }

  listRecentEvents(roomId: string, limit = EVENT_LOG_LIMIT): SessionEvent[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM session_events
         WHERE room_id = ?
         ORDER BY id DESC
         LIMIT ?`,
      )
      .all(roomId, limit) as SessionEventRow[];
    return rows.map(sessionEventRowToState).reverse();
  }

  logTokenMove(input: {
    roomId: string;
    tokenId: string;
    label: string;
    x: number;
    y: number;
  }): SessionEvent | null {
    const key = `${input.roomId}:${input.tokenId}`;
    const now = Date.now();
    const previous = this.tokenMoveLogAt.get(key) ?? 0;
    if (now - previous < TOKEN_MOVE_LOG_MS) {
      return null;
    }
    this.tokenMoveLogAt.set(key, now);
    return this.appendEvent({
      roomId: input.roomId,
      type: "token_move",
      summary: `${input.label} moved`,
      payload: { tokenId: input.tokenId, label: input.label, x: input.x, y: input.y },
    });
  }

  getFog(mapId: string): FogState {
    const row = this.db.prepare("SELECT * FROM map_fog WHERE map_id = ?").get(mapId) as
      | MapFogRow
      | undefined;
    if (!row) {
      return { mapId, baseCovered: true, strokes: [], losEnabled: false };
    }
    return {
      mapId: row.map_id,
      baseCovered: row.base_covered === 1,
      strokes: JSON.parse(row.strokes_json) as FogStroke[],
      losEnabled: row.los_enabled === 1,
    };
  }

  getActiveFog(roomId: string): FogState | null {
    const map = this.getActiveMap(roomId);
    if (!map) {
      return null;
    }
    return this.getFog(map.id);
  }

  paintFog(roomId: string, mapId: string, strokeInput: FogStrokeInput): FogState {
    const map = this.getMapById(mapId);
    if (!map || map.roomId !== roomId) {
      throw new Error("Map not found");
    }
    const current = this.getFog(mapId);
    if (current.strokes.length >= FOG_STROKE_LIMIT) {
      throw new Error("Fog stroke limit reached; reset fog to continue");
    }
    const stroke = normalizeFogStroke(
      strokeInput.kind === "brush"
        ? {
            id: makeId(),
            kind: "brush",
            mode: strokeInput.mode,
            radius: strokeInput.radius,
            points: strokeInput.points,
          }
        : {
            id: makeId(),
            kind: "rect",
            mode: strokeInput.mode,
            x: strokeInput.x,
            y: strokeInput.y,
            w: strokeInput.w,
            h: strokeInput.h,
          },
    );
    const strokes = [...current.strokes, stroke];
    this.db
      .prepare(
        `INSERT INTO map_fog (map_id, base_covered, strokes_json, los_enabled)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(map_id) DO UPDATE SET
           base_covered = excluded.base_covered,
           strokes_json = excluded.strokes_json,
           los_enabled = excluded.los_enabled`,
      )
      .run(mapId, current.baseCovered ? 1 : 0, JSON.stringify(strokes), current.losEnabled ? 1 : 0);
    return { mapId, baseCovered: current.baseCovered, strokes, losEnabled: current.losEnabled };
  }

  resetFog(roomId: string, mapId: string, baseCovered: boolean): FogState {
    const map = this.getMapById(mapId);
    if (!map || map.roomId !== roomId) {
      throw new Error("Map not found");
    }
    const current = this.getFog(mapId);
    this.db
      .prepare(
        `INSERT INTO map_fog (map_id, base_covered, strokes_json, los_enabled)
         VALUES (?, ?, '[]', ?)
         ON CONFLICT(map_id) DO UPDATE SET
           base_covered = excluded.base_covered,
           strokes_json = '[]',
           los_enabled = excluded.los_enabled`,
      )
      .run(mapId, baseCovered ? 1 : 0, current.losEnabled ? 1 : 0);
    return { mapId, baseCovered, strokes: [], losEnabled: current.losEnabled };
  }

  setFogLos(roomId: string, mapId: string, enabled: boolean): FogState {
    const map = this.getMapById(mapId);
    if (!map || map.roomId !== roomId) {
      throw new Error("Map not found");
    }
    if (enabled && map.walls.length === 0) {
      throw new Error("Line of sight needs wall data from a .dd2vtt map");
    }
    const current = this.getFog(mapId);
    this.db
      .prepare(
        `INSERT INTO map_fog (map_id, base_covered, strokes_json, los_enabled)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(map_id) DO UPDATE SET
           base_covered = excluded.base_covered,
           strokes_json = excluded.strokes_json,
           los_enabled = excluded.los_enabled`,
      )
      .run(
        mapId,
        current.baseCovered ? 1 : 0,
        JSON.stringify(current.strokes),
        enabled ? 1 : 0,
      );
    return { mapId, baseCovered: current.baseCovered, strokes: current.strokes, losEnabled: enabled };
  }

  claimCharacterForPlayer(
    roomId: string,
    input: { characterId?: string; name?: string; socketId: string },
  ): { characterId: string; playerName: string } {
    const characters = this.listCharacters(roomId).filter((character) => character.kind === "pc");
    let character =
      input.characterId != null
        ? characters.find((entry) => entry.id === input.characterId)
        : undefined;

    if (!character && input.name?.trim()) {
      const name = input.name.trim();
      const matches = characters.filter((entry) => entry.name === name);
      if (matches.length === 0) {
        throw new Error(`No PC named "${name}"`);
      }
      if (matches.length > 1) {
        throw new Error(`Ambiguous PC name "${name}"`);
      }
      character = matches[0];
    }

    if (!character) {
      throw new Error("Select a PC to claim (characterId or name)");
    }

    const taken = this.listSessionsInRoom(roomId).some(
      (session) =>
        session.socketId !== input.socketId &&
        session.role === "player" &&
        session.characterId === character.id,
    );
    if (taken) {
      throw new Error("Character already claimed");
    }

    return { characterId: character.id, playerName: character.name };
  }

  canSessionMoveToken(session: Session, token: TokenState): boolean {
    if (session.role === "gm") {
      return true;
    }
    if (session.role !== "player" || !session.characterId || !token.characterId) {
      return false;
    }
    return token.characterId === session.characterId;
  }

  getSnapshot(
    roomId: string,
    role: Role,
    playerName: string | null,
    characterId: string | null = null,
  ): Snapshot {
    const room = this.getRoomById(roomId);
    if (!room) {
      throw new Error("Room not found");
    }
    return {
      room,
      map: this.getActiveMap(roomId),
      maps: this.listMaps(roomId),
      tokens: this.listVisibleTokens(roomId),
      characters: this.listCharactersForRole(roomId, role),
      visibility: this.getVisibility(roomId),
      settings: this.getSettings(roomId),
      camera: this.getCamera(roomId),
      initiative: this.getInitiative(roomId),
      eventLog: this.listRecentEvents(roomId),
      battle: this.getActiveBattle(roomId),
      fog: this.getActiveFog(roomId),
      role,
      playerName,
      characterId,
    };
  }
}

function normalizeFogStroke(stroke: FogStroke): FogStroke {
  if (stroke.kind === "brush") {
    return stroke;
  }
  const x = Math.min(stroke.x, stroke.x + stroke.w);
  const y = Math.min(stroke.y, stroke.y + stroke.h);
  const w = Math.abs(stroke.w);
  const h = Math.abs(stroke.h);
  if (w < 1 || h < 1) {
    throw new Error("Fog rectangle too small");
  }
  return { ...stroke, x, y, w, h };
}

function battleRowToState(row: BattleRow): BattleState {
  return {
    id: row.id,
    roomId: row.room_id,
    startedAt: row.started_at,
    endedAt: row.ended_at,
  };
}

function sessionEventRowToState(row: SessionEventRow): SessionEvent {
  return {
    id: row.id,
    roomId: row.room_id,
    battleId: row.battle_id,
    type: row.type as SessionEventType,
    summary: row.summary,
    payload: JSON.parse(row.payload_json) as Record<string, unknown>,
    createdAt: row.created_at,
  };
}

function formatDuration(durationMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(durationMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function toCharacterState(row: CharacterRow, mapIds: string[]): CharacterState {
  return {
    id: row.id,
    roomId: row.room_id,
    name: row.name,
    kind: row.kind as CharacterKind,
    image: row.image,
    notes: row.notes ?? null,
    sizeCells: row.size_cells,
    mapIds,
    hpCurrent: row.hp_current ?? null,
    hpMax: row.hp_max ?? null,
    ac: row.ac ?? null,
    hpQuarter: null,
    conditions: parseConditionsJson(row.conditions_json),
  };
}

function parseConditionsJson(raw: string | null | undefined): ConditionId[] {
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return normalizeConditions(parsed);
  } catch {
    return [];
  }
}

function normalizeConditions(values: unknown[]): ConditionId[] {
  const seen = new Set<ConditionId>();
  for (const value of values) {
    const parsed = ConditionIdSchema.safeParse(value);
    if (parsed.success) {
      seen.add(parsed.data);
    }
  }
  return ConditionIdSchema.options.filter((id) => seen.has(id));
}

function normalizeHp(input: {
  hpCurrent: number | null;
  hpMax: number | null;
}): { hpCurrent: number | null; hpMax: number | null } {
  let hpMax = input.hpMax;
  let hpCurrent = input.hpCurrent;
  if (hpMax !== null && hpMax < 0) {
    hpMax = 0;
  }
  if (hpMax !== null && hpCurrent === null) {
    hpCurrent = hpMax;
  }
  if (hpCurrent !== null && hpCurrent < 0) {
    hpCurrent = 0;
  }
  if (hpMax !== null && hpCurrent !== null && hpCurrent > hpMax) {
    hpCurrent = hpMax;
  }
  return { hpCurrent, hpMax };
}

export function redactCharacterStatsForRole(
  character: CharacterState,
  role: Role,
  screenHpQuarters = false,
): CharacterState {
  if (role === "gm") {
    return { ...character, hpQuarter: null };
  }

  if (screenHpQuarters) {
    const quarter = hpToQuarter(character.hpCurrent, character.hpMax);
    return {
      ...character,
      hpCurrent: null,
      hpMax: null,
      ac: character.kind === "pc" ? character.ac : null,
      hpQuarter: quarter,
    };
  }

  if (character.kind === "pc") {
    return { ...character, hpQuarter: null };
  }

  return {
    ...character,
    hpCurrent: null,
    hpMax: null,
    ac: null,
    hpQuarter: null,
  };
}

function mapRowToState(row: MapRow): MapState {
  return {
    id: row.id,
    roomId: row.room_id,
    name: row.name || deriveMapName(row.filename),
    filename: row.filename,
    width: row.width,
    height: row.height,
    gridPx: row.grid_px,
    offsetX: row.offset_x,
    offsetY: row.offset_y,
    walls: parseWallsJson(row.walls_json),
  };
}

function parseWallsJson(raw: string | null | undefined): MapState["walls"] {
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .filter((polyline): polyline is Array<{ x: number; y: number }> => Array.isArray(polyline))
      .map((polyline) =>
        polyline
          .filter(
            (point): point is { x: number; y: number } =>
              !!point &&
              typeof point === "object" &&
              typeof point.x === "number" &&
              typeof point.y === "number",
          )
          .map((point) => ({ x: point.x, y: point.y })),
      )
      .filter((polyline) => polyline.length >= 2);
  } catch {
    return [];
  }
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
    mapId: row.map_id,
    characterId: row.character_id,
  };
}

function deriveMapName(filename: string): string {
  const base = filename.replace(/^\d+-[\w]+-?/, "").replace(/\.[^.]+$/, "");
  return base || "Map";
}

export function roomChannel(roomId: string): string {
  return `room:${roomId}`;
}
