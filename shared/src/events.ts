import { z } from "zod";

export const RoleSchema = z.enum(["gm", "screen", "player"]);
export type Role = z.infer<typeof RoleSchema>;

export const CharacterKindSchema = z.enum(["pc", "npc"]);
export type CharacterKind = z.infer<typeof CharacterKindSchema>;

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
  sizeCells: z.number().positive(),
  mapIds: z.array(z.string()),
});
export type CharacterState = z.infer<typeof CharacterStateSchema>;

export const VisibilityStateSchema = z.object({
  showPcs: z.boolean(),
  showNpcs: z.boolean(),
});
export type VisibilityState = z.infer<typeof VisibilityStateSchema>;

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

export const InitiativeStateSchema = z.object({
  order: z.array(InitiativeEntrySchema),
  activeIndex: z.number().int().nonnegative(),
  round: z.number().int().positive(),
});
export type InitiativeState = z.infer<typeof InitiativeStateSchema>;

export const RoomStateSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
});
export type RoomState = z.infer<typeof RoomStateSchema>;

export const SnapshotSchema = z.object({
  room: RoomStateSchema,
  map: MapStateSchema.nullable(),
  maps: z.array(MapStateSchema),
  tokens: z.array(TokenStateSchema),
  characters: z.array(CharacterStateSchema),
  visibility: VisibilityStateSchema,
  camera: CameraStateSchema.nullable(),
  initiative: InitiativeStateSchema.nullable(),
  role: RoleSchema,
  playerName: z.string().nullable(),
});
export type Snapshot = z.infer<typeof SnapshotSchema>;

export const RoomJoinPayloadSchema = z.object({
  code: z.string().min(1).max(16),
  role: RoleSchema,
  name: z.string().min(1).max(64).optional(),
});
export type RoomJoinPayload = z.infer<typeof RoomJoinPayloadSchema>;

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
  sizeCells: z.number().positive().optional(),
  mapIds: z.array(z.string().min(1)).optional(),
});
export type CharacterUpsertPayload = z.infer<typeof CharacterUpsertPayloadSchema>;

export const CharacterRemovePayloadSchema = z.object({
  characterId: z.string().min(1),
});
export type CharacterRemovePayload = z.infer<typeof CharacterRemovePayloadSchema>;

export const VisibilitySetPayloadSchema = z.object({
  showPcs: z.boolean().optional(),
  showNpcs: z.boolean().optional(),
});
export type VisibilitySetPayload = z.infer<typeof VisibilitySetPayloadSchema>;

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
  VisibilitySet: "visibility:set",
} as const;

export const ServerEvents = {
  Snapshot: "snapshot",
  MapSet: "map:set",
  MapsUpdated: "maps:updated",
  TokensSynced: "tokens:synced",
  CharactersUpdated: "characters:updated",
  VisibilityUpdated: "visibility:updated",
  TokenMoved: "token:moved",
  TokenCreated: "token:created",
  TokenRemoved: "token:removed",
  DiceRolled: "dice:rolled",
  CameraSet: "camera:set",
  InitiativeUpdated: "initiative:updated",
  Error: "error",
} as const;

export type ClientToServerEvents = {
  [ClientEvents.RoomJoin]: (
    payload: RoomJoinPayload,
    callback?: (result: { ok: true; snapshot: Snapshot } | { ok: false; error: string }) => void,
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
  [ClientEvents.VisibilitySet]: (payload: VisibilitySetPayload) => void;
};

export type ServerToClientEvents = {
  [ServerEvents.Snapshot]: (snapshot: Snapshot) => void;
  [ServerEvents.MapSet]: (map: MapState | null) => void;
  [ServerEvents.MapsUpdated]: (maps: MapState[]) => void;
  [ServerEvents.TokensSynced]: (tokens: TokenState[]) => void;
  [ServerEvents.CharactersUpdated]: (characters: CharacterState[]) => void;
  [ServerEvents.VisibilityUpdated]: (visibility: VisibilityState) => void;
  [ServerEvents.TokenMoved]: (token: TokenState) => void;
  [ServerEvents.TokenCreated]: (token: TokenState) => void;
  [ServerEvents.TokenRemoved]: (payload: { tokenId: string }) => void;
  [ServerEvents.DiceRolled]: (payload: DiceRolled) => void;
  [ServerEvents.CameraSet]: (camera: CameraState) => void;
  [ServerEvents.InitiativeUpdated]: (initiative: InitiativeState) => void;
  [ServerEvents.Error]: (payload: { message: string }) => void;
};
