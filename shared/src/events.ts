import { z } from "zod";

export const RoleSchema = z.enum(["gm", "screen", "player"]);
export type Role = z.infer<typeof RoleSchema>;

export const CharacterKindSchema = z.enum(["pc", "npc"]);
export type CharacterKind = z.infer<typeof CharacterKindSchema>;

export const ConditionIdSchema = z.enum([
  "blinded",
  "charmed",
  "frightened",
  "poisoned",
  "prone",
  "restrained",
  "stunned",
  "unconscious",
]);
export type ConditionId = z.infer<typeof ConditionIdSchema>;

export const CONDITION_IDS = ConditionIdSchema.options;

export const WallPointSchema = z.object({
  x: z.number(),
  y: z.number(),
});
export type WallPoint = z.infer<typeof WallPointSchema>;

export const WallPolylineSchema = z.array(WallPointSchema).min(2);
export type WallPolyline = z.infer<typeof WallPolylineSchema>;

export const PortalStateSchema = z.object({
  id: z.string().min(1),
  bounds: z.tuple([WallPointSchema, WallPointSchema]),
  closed: z.boolean(),
  freestanding: z.boolean().default(false),
});
export type PortalState = z.infer<typeof PortalStateSchema>;

export const LightStateSchema = z.object({
  id: z.string().min(1),
  position: WallPointSchema,
  range: z.number().positive(),
  intensity: z.number().min(0).max(1),
  color: z.string().regex(/^[0-9a-fA-F]{6}$/),
  shadows: z.boolean().default(true),
});
export type LightState = z.infer<typeof LightStateSchema>;

export const MapStateSchema = z.object({
  id: z.string(),
  roomId: z.string(),
  name: z.string(),
  filename: z.string(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  gridPx: z.number().int().positive(),
  offsetX: z.number().int(),
  offsetY: z.number().int(),
  walls: z.array(WallPolylineSchema).default([]),
  portals: z.array(PortalStateSchema).default([]),
  lights: z.array(LightStateSchema).default([]),
});
export type MapState = z.infer<typeof MapStateSchema>;

export const TokenStateSchema = z.object({
  id: z.string(),
  roomId: z.string(),
  label: z.string().min(1),
  image: z.string().nullable(),
  x: z.number(),
  y: z.number(),
  sizeCells: z.number().positive(),
  isPlayer: z.boolean(),
  mapId: z.string().nullable(),
  characterId: z.string().nullable(),
});
export type TokenState = z.infer<typeof TokenStateSchema>;

export const CharacterStateSchema = z.object({
  id: z.string(),
  roomId: z.string(),
  name: z.string().min(1),
  kind: CharacterKindSchema,
  image: z.string().nullable(),
  notes: z.string().nullable(),
  sizeCells: z.number().positive(),
  speedCells: z.number().int().positive(),
  mapIds: z.array(z.string()),
  hpCurrent: z.number().int().nullable(),
  hpMax: z.number().int().nullable(),
  ac: z.number().int().nullable(),
  hpQuarter: z.number().int().min(0).max(4).nullable(),
  conditions: z.array(ConditionIdSchema).default([]),
});
export type CharacterState = z.infer<typeof CharacterStateSchema>;

export const VisibilityStateSchema = z.object({
  showPcs: z.boolean(),
  showNpcs: z.boolean(),
});
export type VisibilityState = z.infer<typeof VisibilityStateSchema>;

export const RoomSettingsSchema = z.object({
  screenHpQuarters: z.boolean(),
  physicalCellCm: z.number().nullable(),
});
export type RoomSettings = z.infer<typeof RoomSettingsSchema>;

export const PHYSICAL_CELL_CM_MIN = 0.5;
export const PHYSICAL_CELL_CM_MAX = 30;

const ROOM_CODE_PATTERN = /^[\p{L}0-9_-]+$/u;

export function normalizeRoomCode(code: string): string {
  return code.trim().normalize("NFC").toLocaleUpperCase("und");
}

export function roomCodePathSegment(code: string): string {
  return encodeURIComponent(normalizeRoomCode(code));
}

export function roomCodeFromPathSegment(segment: string): string {
  let decoded = segment;
  try {
    decoded = decodeURIComponent(segment);
  } catch {
    decoded = segment;
  }
  return normalizeRoomCode(decoded);
}

export const RoomCodeSchema = z
  .string()
  .trim()
  .min(1)
  .transform((value) => value.normalize("NFC"))
  .refine((value) => ROOM_CODE_PATTERN.test(value), {
    message: "Use letters, digits, underscore, or hyphen",
  })
  .transform((value) => normalizeRoomCode(value))
  .refine((value) => value.length >= 3 && value.length <= 24, {
    message: "Room code must be 3–24 characters",
  });
export type RoomCode = z.infer<typeof RoomCodeSchema>;

export const GmPinSchema = z
  .string()
  .regex(/^\d{4,8}$/, "PIN must be 4–8 digits");
export type GmPin = z.infer<typeof GmPinSchema>;

export function hpToQuarter(hpCurrent: number | null, hpMax: number | null): number | null {
  if (hpCurrent === null && hpMax === null) {
    return null;
  }
  if (hpMax === null || hpMax <= 0) {
    if (hpCurrent === null) {
      return null;
    }
    return hpCurrent <= 0 ? 0 : 4;
  }
  const current = hpCurrent ?? 0;
  if (current <= 0) {
    return 0;
  }
  const ratio = current / hpMax;
  if (ratio <= 0.25) {
    return 1;
  }
  if (ratio <= 0.5) {
    return 2;
  }
  if (ratio <= 0.75) {
    return 3;
  }
  return 4;
}

export const CameraStateSchema = z.object({
  x: z.number(),
  y: z.number(),
  zoom: z.number().positive(),
});
export type CameraState = z.infer<typeof CameraStateSchema>;

export const InitiativeEntrySchema = z.object({
  tokenId: z.string(),
  label: z.string(),
  initiative: z.number(),
  kind: CharacterKindSchema.optional(),
  image: z.string().nullable().optional(),
});
export type InitiativeEntry = z.infer<typeof InitiativeEntrySchema>;

export const TurnStartSchema = z.object({
  x: z.number(),
  y: z.number(),
});
export type TurnStart = z.infer<typeof TurnStartSchema>;

export const InitiativeStateSchema = z.object({
  order: z.array(InitiativeEntrySchema),
  activeIndex: z.number().int().nonnegative(),
  round: z.number().int().positive(),
  turnStart: TurnStartSchema.nullable().optional(),
  remainingCells: z.number().int().nonnegative().nullable().optional(),
});
export type InitiativeState = z.infer<typeof InitiativeStateSchema>;

export const SpawnPointSchema = z.object({
  id: z.string().min(1),
  mapId: z.string().min(1),
  roomId: z.string().min(1),
  label: z.string().nullable(),
  x: z.number(),
  y: z.number(),
  assignedCharacterId: z.string().nullable(),
});
export type SpawnPoint = z.infer<typeof SpawnPointSchema>;

export const MovementBudgetSchema = z.object({
  tokenId: z.string().nullable(),
  turnStart: TurnStartSchema.nullable(),
  remainingCells: z.number().int().nonnegative().nullable(),
  active: z.boolean(),
});
export type MovementBudget = z.infer<typeof MovementBudgetSchema>;

export const RoomStateSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
});
export type RoomState = z.infer<typeof RoomStateSchema>;

export const SessionEventTypeSchema = z.enum([
  "battle_start",
  "battle_end",
  "map_change",
  "token_move",
  "initiative_set",
  "initiative_next",
  "round_advance",
  "visibility_set",
  "dice_roll",
  "spawn_applied",
]);
export type SessionEventType = z.infer<typeof SessionEventTypeSchema>;

export const SessionEventSchema = z.object({
  id: z.number().int(),
  roomId: z.string(),
  battleId: z.string().nullable(),
  type: SessionEventTypeSchema,
  summary: z.string(),
  payload: z.record(z.string(), z.unknown()),
  createdAt: z.string(),
});
export type SessionEvent = z.infer<typeof SessionEventSchema>;

export const BattleStateSchema = z.object({
  id: z.string(),
  roomId: z.string(),
  startedAt: z.string(),
  endedAt: z.string().nullable(),
});
export type BattleState = z.infer<typeof BattleStateSchema>;

export const FogPaintModeSchema = z.enum(["reveal", "hide"]);
export type FogPaintMode = z.infer<typeof FogPaintModeSchema>;

export const FogPointSchema = z.object({
  x: z.number(),
  y: z.number(),
});
export type FogPoint = z.infer<typeof FogPointSchema>;

export const FogBrushStrokeSchema = z.object({
  id: z.string().min(1),
  kind: z.literal("brush"),
  mode: FogPaintModeSchema,
  radius: z.number().min(4).max(256),
  points: z.array(FogPointSchema).min(1).max(240),
});
export type FogBrushStroke = z.infer<typeof FogBrushStrokeSchema>;

export const FogRectStrokeSchema = z.object({
  id: z.string().min(1),
  kind: z.literal("rect"),
  mode: FogPaintModeSchema,
  x: z.number(),
  y: z.number(),
  w: z.number(),
  h: z.number(),
});
export type FogRectStroke = z.infer<typeof FogRectStrokeSchema>;

export const FogStrokeSchema = z.discriminatedUnion("kind", [
  FogBrushStrokeSchema,
  FogRectStrokeSchema,
]);
export type FogStroke = z.infer<typeof FogStrokeSchema>;

export const FogBrushStrokeInputSchema = FogBrushStrokeSchema.omit({ id: true });
export const FogRectStrokeInputSchema = FogRectStrokeSchema.omit({ id: true });
export const FogStrokeInputSchema = z.discriminatedUnion("kind", [
  FogBrushStrokeInputSchema,
  FogRectStrokeInputSchema,
]);
export type FogStrokeInput = z.infer<typeof FogStrokeInputSchema>;

export const FogStateSchema = z.object({
  mapId: z.string(),
  baseCovered: z.boolean(),
  strokes: z.array(FogStrokeSchema),
  losEnabled: z.boolean().default(false),
});
export type FogState = z.infer<typeof FogStateSchema>;

export const SnapshotSchema = z.object({
  room: RoomStateSchema,
  map: MapStateSchema.nullable(),
  maps: z.array(MapStateSchema),
  tokens: z.array(TokenStateSchema),
  characters: z.array(CharacterStateSchema),
  visibility: VisibilityStateSchema,
  settings: RoomSettingsSchema,
  camera: CameraStateSchema.nullable(),
  initiative: InitiativeStateSchema.nullable(),
  eventLog: z.array(SessionEventSchema),
  battle: BattleStateSchema.nullable(),
  fog: FogStateSchema.nullable(),
  spawnPoints: z.array(SpawnPointSchema).default([]),
  movement: MovementBudgetSchema.nullable().default(null),
  role: RoleSchema,
  playerName: z.string().nullable(),
  characterId: z.string().nullable(),
});
export type Snapshot = z.infer<typeof SnapshotSchema>;

export const RoomJoinPayloadSchema = z.object({
  code: RoomCodeSchema,
  role: RoleSchema,
  name: z.string().min(1).max(64).optional(),
  characterId: z.string().min(1).optional(),
  pin: GmPinSchema.optional(),
  invite: z.string().min(8).max(128).optional(),
});
export type RoomJoinPayload = z.infer<typeof RoomJoinPayloadSchema>;

export const RoomCreatePayloadSchema = z.object({
  name: z.string().trim().min(1).max(64).optional(),
  code: RoomCodeSchema,
  pin: GmPinSchema,
});
export type RoomCreatePayload = z.infer<typeof RoomCreatePayloadSchema>;

export const SettingsSetPayloadSchema = z.object({
  screenHpQuarters: z.boolean().optional(),
  physicalCellCm: z
    .number()
    .min(PHYSICAL_CELL_CM_MIN)
    .max(PHYSICAL_CELL_CM_MAX)
    .nullable()
    .optional(),
});
export type SettingsSetPayload = z.infer<typeof SettingsSetPayloadSchema>;

export const ScreenCommandPayloadSchema = z.object({
  type: z.literal("open-calibration"),
});
export type ScreenCommandPayload = z.infer<typeof ScreenCommandPayloadSchema>;

export const GmChangePinPayloadSchema = z.object({
  currentPin: GmPinSchema,
  newPin: GmPinSchema,
  invalidateInvites: z.boolean().optional(),
});
export type GmChangePinPayload = z.infer<typeof GmChangePinPayloadSchema>;

export const TokenMovePayloadSchema = z.object({
  tokenId: z.string().min(1),
  x: z.number(),
  y: z.number(),
});
export type TokenMovePayload = z.infer<typeof TokenMovePayloadSchema>;

export const TokenCreatePayloadSchema = z.object({
  label: z.string().min(1).max(64),
  image: z.string().nullable().optional(),
  x: z.number(),
  y: z.number(),
  isPlayer: z.boolean().optional(),
  sizeCells: z.number().positive().optional(),
  characterId: z.string().optional(),
  mapId: z.string().optional(),
});
export type TokenCreatePayload = z.infer<typeof TokenCreatePayloadSchema>;

export const TokenRemovePayloadSchema = z.object({
  tokenId: z.string().min(1),
});
export type TokenRemovePayload = z.infer<typeof TokenRemovePayloadSchema>;

export const DiceRollPayloadSchema = z.object({
  expr: z.string().min(1).max(64),
});
export type DiceRollPayload = z.infer<typeof DiceRollPayloadSchema>;

export const CameraSetPayloadSchema = CameraStateSchema;
export type CameraSetPayload = z.infer<typeof CameraSetPayloadSchema>;

export const InitiativeSetPayloadSchema = z.object({
  order: z.array(
    z.object({
      tokenId: z.string().min(1),
      initiative: z.number(),
    }),
  ),
});
export type InitiativeSetPayload = z.infer<typeof InitiativeSetPayloadSchema>;

export const MapActivatePayloadSchema = z.object({
  mapId: z.string().min(1),
});
export type MapActivatePayload = z.infer<typeof MapActivatePayloadSchema>;

export const MapUpdateGridPayloadSchema = z.object({
  mapId: z.string().min(1),
  gridPx: z.number().int().min(8).max(512),
});
export type MapUpdateGridPayload = z.infer<typeof MapUpdateGridPayloadSchema>;

export const MapRemovePayloadSchema = z.object({
  mapId: z.string().min(1),
});
export type MapRemovePayload = z.infer<typeof MapRemovePayloadSchema>;

export const CharacterUpsertPayloadSchema = z.object({
  id: z.string().min(1).optional(),
  name: z.string().min(1).max(64),
  kind: CharacterKindSchema,
  image: z.string().nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
  sizeCells: z.number().positive().optional(),
  speedCells: z.number().int().positive().max(50).optional(),
  mapIds: z.array(z.string().min(1)).optional(),
  hpCurrent: z.number().int().min(0).nullable().optional(),
  hpMax: z.number().int().min(0).nullable().optional(),
  ac: z.number().int().min(0).max(99).nullable().optional(),
});
export type CharacterUpsertPayload = z.infer<typeof CharacterUpsertPayloadSchema>;

export const CharacterSetSpeedPayloadSchema = z.object({
  characterId: z.string().min(1),
  speedCells: z.number().int().positive().max(50),
});
export type CharacterSetSpeedPayload = z.infer<typeof CharacterSetSpeedPayloadSchema>;

export const SpawnPointInputSchema = z.object({
  id: z.string().min(1),
  label: z.string().max(64).nullable().optional(),
  x: z.number(),
  y: z.number(),
  assignedCharacterId: z.string().min(1).nullable(),
});
export type SpawnPointInput = z.infer<typeof SpawnPointInputSchema>;

export const SpawnSetPayloadSchema = z.object({
  mapId: z.string().min(1),
  points: z.array(SpawnPointInputSchema),
});
export type SpawnSetPayload = z.infer<typeof SpawnSetPayloadSchema>;

export const SpawnApplyPayloadSchema = z.object({
  mapId: z.string().min(1),
});
export type SpawnApplyPayload = z.infer<typeof SpawnApplyPayloadSchema>;

export const SpawnUpdatedPayloadSchema = z.object({
  mapId: z.string().min(1),
  points: z.array(SpawnPointSchema),
});
export type SpawnUpdatedPayload = z.infer<typeof SpawnUpdatedPayloadSchema>;

export const MovementUpdatedPayloadSchema = MovementBudgetSchema;
export type MovementUpdatedPayload = z.infer<typeof MovementUpdatedPayloadSchema>;

export const MovementRejectedPayloadSchema = z.object({
  tokenId: z.string().min(1),
  reason: z.string().min(1),
});
export type MovementRejectedPayload = z.infer<typeof MovementRejectedPayloadSchema>;

export const CharacterRemovePayloadSchema = z.object({
  characterId: z.string().min(1),
});
export type CharacterRemovePayload = z.infer<typeof CharacterRemovePayloadSchema>;

export const CharacterSetHpPayloadSchema = z
  .object({
    characterId: z.string().min(1),
    hpCurrent: z.number().int().min(0).nullable().optional(),
    hpMax: z.number().int().min(0).nullable().optional(),
    delta: z.number().int().optional(),
  })
  .refine(
    (value) =>
      value.hpCurrent !== undefined || value.hpMax !== undefined || value.delta !== undefined,
    { message: "Provide hpCurrent, hpMax, or delta" },
  );
export type CharacterSetHpPayload = z.infer<typeof CharacterSetHpPayloadSchema>;

export const CharacterSetConditionsPayloadSchema = z.object({
  characterId: z.string().min(1),
  conditions: z.array(ConditionIdSchema).max(CONDITION_IDS.length),
});
export type CharacterSetConditionsPayload = z.infer<typeof CharacterSetConditionsPayloadSchema>;

export const VisibilitySetPayloadSchema = z.object({
  showPcs: z.boolean().optional(),
  showNpcs: z.boolean().optional(),
});
export type VisibilitySetPayload = z.infer<typeof VisibilitySetPayloadSchema>;

export const FogPaintPayloadSchema = z.object({
  mapId: z.string().min(1),
  stroke: FogStrokeInputSchema,
});
export type FogPaintPayload = z.infer<typeof FogPaintPayloadSchema>;

export const FogResetPayloadSchema = z.object({
  mapId: z.string().min(1),
  baseCovered: z.boolean(),
});
export type FogResetPayload = z.infer<typeof FogResetPayloadSchema>;

export const FogSetLosPayloadSchema = z.object({
  mapId: z.string().min(1),
  enabled: z.boolean(),
});
export type FogSetLosPayload = z.infer<typeof FogSetLosPayloadSchema>;

export const PortalSetClosedPayloadSchema = z.object({
  mapId: z.string().min(1),
  portalId: z.string().min(1),
  closed: z.boolean(),
});
export type PortalSetClosedPayload = z.infer<typeof PortalSetClosedPayloadSchema>;

export const DiceRolledSchema = z.object({
  id: z.number().int(),
  playerName: z.string(),
  expr: z.string(),
  results: z.array(z.number()),
  total: z.number(),
  createdAt: z.string(),
});
export type DiceRolled = z.infer<typeof DiceRolledSchema>;

export const ClientEvents = {
  RoomJoin: "room:join",
  TokenMove: "token:move",
  TokenCreate: "token:create",
  TokenRemove: "token:remove",
  DiceRoll: "dice:roll",
  CameraSet: "camera:set",
  InitiativeSet: "initiative:set",
  InitiativeNext: "initiative:next",
  MapActivate: "map:activate",
  MapUpdateGrid: "map:updateGrid",
  MapRemove: "map:remove",
  CharacterUpsert: "character:upsert",
  CharacterRemove: "character:remove",
  CharacterSetHp: "character:setHp",
  CharacterSetConditions: "character:setConditions",
  CharacterSetSpeed: "character:setSpeed",
  SpawnSet: "spawn:set",
  SpawnApply: "spawn:apply",
  VisibilitySet: "visibility:set",
  SettingsSet: "settings:set",
  ScreenCommand: "screen:command",
  GmMintInvite: "gm:mintInvite",
  GmChangePin: "gm:changePin",
  BattleStart: "battle:start",
  BattleEnd: "battle:end",
  FogPaint: "fog:paint",
  FogReset: "fog:reset",
  FogSetLos: "fog:setLos",
  PortalSetClosed: "portal:setClosed",
} as const;

export const ServerEvents = {
  Snapshot: "snapshot",
  MapSet: "map:set",
  MapsUpdated: "maps:updated",
  TokensSynced: "tokens:synced",
  CharactersUpdated: "characters:updated",
  VisibilityUpdated: "visibility:updated",
  SettingsUpdated: "settings:updated",
  ScreenCommand: "screen:command",
  TokenMoved: "token:moved",
  TokenCreated: "token:created",
  TokenRemoved: "token:removed",
  DiceRolled: "dice:rolled",
  CameraSet: "camera:set",
  InitiativeUpdated: "initiative:updated",
  LogAppended: "log:appended",
  BattleUpdated: "battle:updated",
  FogUpdated: "fog:updated",
  SpawnUpdated: "spawn:updated",
  MovementUpdated: "movement:updated",
  MovementRejected: "movement:rejected",
  Error: "error",
} as const;

export type RoomJoinResult =
  | { ok: true; snapshot: Snapshot; uploadToken?: string }
  | { ok: false; error: string };

export type GmMintInviteResult =
  | { ok: true; invite: string; gmInviteUrl: string }
  | { ok: false; error: string };

export type GmChangePinResult =
  | { ok: true; inviteInvalidated: boolean }
  | { ok: false; error: string };

export type ClientToServerEvents = {
  [ClientEvents.RoomJoin]: (
    payload: RoomJoinPayload,
    callback?: (result: RoomJoinResult) => void,
  ) => void;
  [ClientEvents.TokenMove]: (payload: TokenMovePayload) => void;
  [ClientEvents.TokenCreate]: (payload: TokenCreatePayload) => void;
  [ClientEvents.TokenRemove]: (payload: TokenRemovePayload) => void;
  [ClientEvents.DiceRoll]: (payload: DiceRollPayload) => void;
  [ClientEvents.CameraSet]: (payload: CameraSetPayload) => void;
  [ClientEvents.InitiativeSet]: (payload: InitiativeSetPayload) => void;
  [ClientEvents.InitiativeNext]: () => void;
  [ClientEvents.MapActivate]: (payload: MapActivatePayload) => void;
  [ClientEvents.MapUpdateGrid]: (payload: MapUpdateGridPayload) => void;
  [ClientEvents.MapRemove]: (payload: MapRemovePayload) => void;
  [ClientEvents.CharacterUpsert]: (payload: CharacterUpsertPayload) => void;
  [ClientEvents.CharacterRemove]: (payload: CharacterRemovePayload) => void;
  [ClientEvents.CharacterSetHp]: (payload: CharacterSetHpPayload) => void;
  [ClientEvents.CharacterSetConditions]: (payload: CharacterSetConditionsPayload) => void;
  [ClientEvents.CharacterSetSpeed]: (payload: CharacterSetSpeedPayload) => void;
  [ClientEvents.SpawnSet]: (payload: SpawnSetPayload) => void;
  [ClientEvents.SpawnApply]: (payload: SpawnApplyPayload) => void;
  [ClientEvents.VisibilitySet]: (payload: VisibilitySetPayload) => void;
  [ClientEvents.SettingsSet]: (payload: SettingsSetPayload) => void;
  [ClientEvents.ScreenCommand]: (payload: ScreenCommandPayload) => void;
  [ClientEvents.GmMintInvite]: (
    callback?: (result: GmMintInviteResult) => void,
  ) => void;
  [ClientEvents.GmChangePin]: (
    payload: GmChangePinPayload,
    callback?: (result: GmChangePinResult) => void,
  ) => void;
  [ClientEvents.BattleStart]: () => void;
  [ClientEvents.BattleEnd]: () => void;
  [ClientEvents.FogPaint]: (payload: FogPaintPayload) => void;
  [ClientEvents.FogReset]: (payload: FogResetPayload) => void;
  [ClientEvents.FogSetLos]: (payload: FogSetLosPayload) => void;
  [ClientEvents.PortalSetClosed]: (payload: PortalSetClosedPayload) => void;
};

export type ServerToClientEvents = {
  [ServerEvents.Snapshot]: (snapshot: Snapshot) => void;
  [ServerEvents.MapSet]: (map: MapState | null) => void;
  [ServerEvents.MapsUpdated]: (maps: MapState[]) => void;
  [ServerEvents.TokensSynced]: (tokens: TokenState[]) => void;
  [ServerEvents.CharactersUpdated]: (characters: CharacterState[]) => void;
  [ServerEvents.VisibilityUpdated]: (visibility: VisibilityState) => void;
  [ServerEvents.SettingsUpdated]: (settings: RoomSettings) => void;
  [ServerEvents.ScreenCommand]: (payload: ScreenCommandPayload) => void;
  [ServerEvents.TokenMoved]: (token: TokenState) => void;
  [ServerEvents.TokenCreated]: (token: TokenState) => void;
  [ServerEvents.TokenRemoved]: (payload: { tokenId: string }) => void;
  [ServerEvents.DiceRolled]: (payload: DiceRolled) => void;
  [ServerEvents.CameraSet]: (camera: CameraState) => void;
  [ServerEvents.InitiativeUpdated]: (initiative: InitiativeState) => void;
  [ServerEvents.LogAppended]: (event: SessionEvent) => void;
  [ServerEvents.BattleUpdated]: (battle: BattleState | null) => void;
  [ServerEvents.FogUpdated]: (fog: FogState | null) => void;
  [ServerEvents.SpawnUpdated]: (payload: SpawnUpdatedPayload) => void;
  [ServerEvents.MovementUpdated]: (payload: MovementUpdatedPayload) => void;
  [ServerEvents.MovementRejected]: (payload: MovementRejectedPayload) => void;
  [ServerEvents.Error]: (payload: { message: string }) => void;
};
