import {
  CameraSetPayloadSchema,
  CharacterRemovePayloadSchema,
  CharacterSetConditionsPayloadSchema,
  CharacterSetHpPayloadSchema,
  CharacterUpsertPayloadSchema,
  ClientEvents,
  DiceRollPayloadSchema,
  FogPaintPayloadSchema,
  FogResetPayloadSchema,
  InitiativeSetPayloadSchema,
  MapActivatePayloadSchema,
  MapRemovePayloadSchema,
  MapUpdateGridPayloadSchema,
  RoomJoinPayloadSchema,
  ServerEvents,
  SettingsSetPayloadSchema,
  TokenCreatePayloadSchema,
  TokenMovePayloadSchema,
  TokenRemovePayloadSchema,
  VisibilitySetPayloadSchema,
  normalizeRoomCode,
  roll,
  type ClientToServerEvents,
  type ServerToClientEvents,
  type SessionEvent,
} from "@dms/shared";
import type { Server, Socket } from "socket.io";
import { roomChannel, type RoomStore } from "../rooms.js";

type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents>;
type AppServer = Server<ClientToServerEvents, ServerToClientEvents>;

export function registerSocketHandlers(io: AppServer, rooms: RoomStore): void {
  io.on("connection", (socket: AppSocket) => {
    socket.on(ClientEvents.RoomJoin, (payload, callback) => {
      try {
        const data = RoomJoinPayloadSchema.parse(payload);
        const room = rooms.getRoomByCode(normalizeRoomCode(data.code));
        if (!room) {
          callback?.({ ok: false, error: "Room not found" });
          return;
        }

        if (data.role === "gm") {
          rooms.assertGmJoin(room.id, data.pin, data.invite);
        }

        let playerName = data.name?.trim() ?? null;
        let characterId: string | null = null;

        if (data.role === "player") {
          const claimed = rooms.claimCharacterForPlayer(room.id, {
            characterId: data.characterId,
            name: data.name,
            socketId: socket.id,
          });
          characterId = claimed.characterId;
          playerName = claimed.playerName;
        }

        rooms.bindSession(socket.id, {
          roomId: room.id,
          role: data.role,
          playerName,
          characterId,
        });

        void socket.join(roomChannel(room.id));
        const snapshot = rooms.getSnapshot(room.id, data.role, playerName, characterId);
        const uploadToken = data.role === "gm" ? rooms.issueUploadToken(room.id) : undefined;
        callback?.({ ok: true, snapshot, uploadToken });
        socket.emit(ServerEvents.Snapshot, snapshot);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Join failed";
        callback?.({ ok: false, error: message });
        socket.emit(ServerEvents.Error, { message });
      }
    });

    socket.on(ClientEvents.TokenCreate, (payload) => {
      const session = requireGm(socket, rooms);
      if (!session) {
        return;
      }
      try {
        const data = TokenCreatePayloadSchema.parse(payload);
        const active = rooms.getActiveMap(session.roomId);
        const token = rooms.createToken({
          roomId: session.roomId,
          label: data.label,
          image: data.image ?? null,
          x: data.x,
          y: data.y,
          sizeCells: data.sizeCells,
          isPlayer: data.isPlayer,
          mapId: data.mapId ?? active?.id ?? null,
          characterId: data.characterId ?? null,
        });
        io.to(roomChannel(session.roomId)).emit(ServerEvents.TokenCreated, token);
        emitCharactersUpdated(io, rooms, session.roomId);
      } catch (error) {
        emitError(socket, error);
      }
    });

    socket.on(ClientEvents.TokenRemove, (payload) => {
      const session = requireGm(socket, rooms);
      if (!session) {
        return;
      }
      try {
        const data = TokenRemovePayloadSchema.parse(payload);
        const token = rooms.getToken(data.tokenId);
        if (!token || token.roomId !== session.roomId) {
          emitError(socket, new Error("Token not found"));
          return;
        }
        rooms.removeToken(data.tokenId);
        io.to(roomChannel(session.roomId)).emit(ServerEvents.TokenRemoved, {
          tokenId: data.tokenId,
        });
        emitCharactersUpdated(io, rooms, session.roomId);
      } catch (error) {
        emitError(socket, error);
      }
    });

    socket.on(ClientEvents.TokenMove, (payload) => {
      const session = rooms.getSession(socket.id);
      if (!session) {
        emitError(socket, new Error("Not joined"));
        return;
      }
      try {
        const data = TokenMovePayloadSchema.parse(payload);
        const token = rooms.getToken(data.tokenId);
        if (!token || token.roomId !== session.roomId) {
          emitError(socket, new Error("Token not found"));
          return;
        }
        if (!rooms.canSessionMoveToken(session, token)) {
          emitError(socket, new Error("Not allowed to move this token"));
          return;
        }
        const moved = rooms.moveToken(data.tokenId, data.x, data.y);
        io.to(roomChannel(session.roomId)).emit(ServerEvents.TokenMoved, moved);
        const moveEvent = rooms.logTokenMove({
          roomId: session.roomId,
          tokenId: moved.id,
          label: moved.label,
          x: moved.x,
          y: moved.y,
        });
        emitLog(io, session.roomId, moveEvent);
      } catch (error) {
        emitError(socket, error);
      }
    });

    socket.on(ClientEvents.DiceRoll, (payload) => {
      const session = rooms.getSession(socket.id);
      if (!session) {
        emitError(socket, new Error("Not joined"));
        return;
      }
      try {
        const data = DiceRollPayloadSchema.parse(payload);
        const rolled = roll(data.expr);
        const playerName = session.playerName ?? session.role.toUpperCase();
        const logged = rooms.logDice({
          roomId: session.roomId,
          playerName,
          expr: rolled.parsed.expr,
          results: rolled.results,
          total: rolled.total,
        });
        const dicePayload = {
          id: logged.id,
          playerName,
          expr: rolled.parsed.expr,
          results: rolled.results,
          total: rolled.total,
          createdAt: logged.createdAt,
        };
        io.to(roomChannel(session.roomId)).emit(ServerEvents.DiceRolled, dicePayload);
        emitLog(
          io,
          session.roomId,
          rooms.appendEvent({
            roomId: session.roomId,
            type: "dice_roll",
            summary: `${playerName}: ${rolled.parsed.expr} → ${rolled.total}`,
            payload: {
              diceLogId: logged.id,
              playerName,
              expr: rolled.parsed.expr,
              results: rolled.results,
              total: rolled.total,
            },
          }),
        );
      } catch (error) {
        emitError(socket, error);
      }
    });

    socket.on(ClientEvents.CameraSet, (payload) => {
      const session = requireGm(socket, rooms);
      if (!session) {
        return;
      }
      try {
        const camera = CameraSetPayloadSchema.parse(payload);
        rooms.setCamera(session.roomId, camera);
        io.to(roomChannel(session.roomId)).emit(ServerEvents.CameraSet, camera);
      } catch (error) {
        emitError(socket, error);
      }
    });

    socket.on(ClientEvents.InitiativeSet, (payload) => {
      const session = requireGm(socket, rooms);
      if (!session) {
        return;
      }
      try {
        const data = InitiativeSetPayloadSchema.parse(payload);
        const tokens = rooms.listAllTokensOnActiveMap(session.roomId);
        const characters = rooms.listCharacters(session.roomId);
        const byToken = new Map(tokens.map((token) => [token.id, token]));
        const byCharacter = new Map(characters.map((character) => [character.id, character]));
        const order = data.order
          .map((entry) => {
            const token = byToken.get(entry.tokenId);
            if (!token) {
              return null;
            }
            const character = token.characterId
              ? byCharacter.get(token.characterId)
              : undefined;
            return {
              tokenId: token.id,
              label: token.label,
              initiative: entry.initiative,
              kind: character?.kind ?? (token.isPlayer ? ("pc" as const) : ("npc" as const)),
              image: character?.image ?? token.image,
            };
          })
          .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
          .sort((a, b) => b.initiative - a.initiative || a.label.localeCompare(b.label));

        const previous = rooms.getInitiative(session.roomId);
        const initiative = rooms.setInitiative(session.roomId, {
          order,
          activeIndex: 0,
          round: previous?.round ?? 1,
        });
        io.to(roomChannel(session.roomId)).emit(ServerEvents.InitiativeUpdated, initiative);
        emitLog(
          io,
          session.roomId,
          rooms.appendEvent({
            roomId: session.roomId,
            type: "initiative_set",
            summary: `Initiative set (${order.length})`,
            payload: { count: order.length },
          }),
        );
      } catch (error) {
        emitError(socket, error);
      }
    });

    socket.on(ClientEvents.InitiativeNext, () => {
      const session = requireGm(socket, rooms);
      if (!session) {
        return;
      }
      try {
        const current = rooms.getInitiative(session.roomId);
        if (!current || current.order.length === 0) {
          emitError(socket, new Error("No initiative order"));
          return;
        }
        const ensured = rooms.ensureBattleForNextTurn(session.roomId);
        if (ensured.started) {
          io.to(roomChannel(session.roomId)).emit(ServerEvents.BattleUpdated, ensured.battle);
          emitLog(io, session.roomId, ensured.startEvent);
        }
        const wrapping = current.activeIndex + 1 >= current.order.length;
        const activeIndex = wrapping ? 0 : current.activeIndex + 1;
        const round = wrapping ? current.round + 1 : current.round;
        const initiative = rooms.setInitiative(session.roomId, {
          order: current.order,
          activeIndex,
          round,
        });
        io.to(roomChannel(session.roomId)).emit(ServerEvents.InitiativeUpdated, initiative);
        const active = initiative.order[activeIndex];
        emitLog(
          io,
          session.roomId,
          rooms.appendEvent({
            roomId: session.roomId,
            type: "initiative_next",
            summary: active ? `Turn: ${active.label}` : "Next turn",
            payload: {
              activeIndex,
              round,
              tokenId: active?.tokenId ?? null,
              label: active?.label ?? null,
            },
          }),
        );
        if (wrapping) {
          emitLog(
            io,
            session.roomId,
            rooms.appendEvent({
              roomId: session.roomId,
              type: "round_advance",
              summary: `Round ${round}`,
              payload: { round },
            }),
          );
        }
      } catch (error) {
        emitError(socket, error);
      }
    });

    socket.on(ClientEvents.MapActivate, (payload) => {
      const session = requireGm(socket, rooms);
      if (!session) {
        return;
      }
      try {
        const data = MapActivatePayloadSchema.parse(payload);
        const previous = rooms.getActiveMap(session.roomId);
        const map = rooms.setActiveMap(session.roomId, data.mapId);
        broadcastMapView(io, rooms, session.roomId, map);
        if (previous?.id !== map.id) {
          emitLog(
            io,
            session.roomId,
            rooms.appendEvent({
              roomId: session.roomId,
              type: "map_change",
              summary: `Map: ${map.name}`,
              payload: { mapId: map.id, name: map.name },
            }),
          );
        }
      } catch (error) {
        emitError(socket, error);
      }
    });

    socket.on(ClientEvents.MapUpdateGrid, (payload) => {
      const session = requireGm(socket, rooms);
      if (!session) {
        return;
      }
      try {
        const data = MapUpdateGridPayloadSchema.parse(payload);
        const existing = rooms.getMapById(data.mapId);
        if (!existing || existing.roomId !== session.roomId) {
          emitError(socket, new Error("Map not found"));
          return;
        }
        rooms.updateMapGrid(data.mapId, data.gridPx);
        const maps = rooms.listMaps(session.roomId);
        const active = rooms.getActiveMap(session.roomId);
        io.to(roomChannel(session.roomId)).emit(ServerEvents.MapsUpdated, maps);
        io.to(roomChannel(session.roomId)).emit(ServerEvents.MapSet, active);
        io.to(roomChannel(session.roomId)).emit(
          ServerEvents.FogUpdated,
          rooms.getActiveFog(session.roomId),
        );
      } catch (error) {
        emitError(socket, error);
      }
    });

    socket.on(ClientEvents.MapRemove, (payload) => {
      const session = requireGm(socket, rooms);
      if (!session) {
        return;
      }
      try {
        const data = MapRemovePayloadSchema.parse(payload);
        const result = rooms.removeMap(session.roomId, data.mapId);
        io.to(roomChannel(session.roomId)).emit(ServerEvents.MapsUpdated, result.maps);
        io.to(roomChannel(session.roomId)).emit(ServerEvents.MapSet, result.active);
        io.to(roomChannel(session.roomId)).emit(
          ServerEvents.TokensSynced,
          rooms.listVisibleTokens(session.roomId),
        );
        emitCharactersUpdated(io, rooms, session.roomId);
        io.to(roomChannel(session.roomId)).emit(
          ServerEvents.FogUpdated,
          rooms.getActiveFog(session.roomId),
        );
      } catch (error) {
        emitError(socket, error);
      }
    });

    socket.on(ClientEvents.CharacterUpsert, (payload) => {
      const session = requireGm(socket, rooms);
      if (!session) {
        return;
      }
      try {
        const data = CharacterUpsertPayloadSchema.parse(payload);
        rooms.upsertCharacter({
          id: data.id,
          roomId: session.roomId,
          name: data.name,
          kind: data.kind,
          image: data.image,
          notes: data.notes,
          sizeCells: data.sizeCells,
          mapIds: data.mapIds,
          hpCurrent: data.hpCurrent,
          hpMax: data.hpMax,
          ac: data.ac,
        });
        const initiative = rooms.refreshInitiativePortraits(session.roomId);
        emitCharactersUpdated(io, rooms, session.roomId);
        io.to(roomChannel(session.roomId)).emit(
          ServerEvents.TokensSynced,
          rooms.listVisibleTokens(session.roomId),
        );
        if (initiative) {
          io.to(roomChannel(session.roomId)).emit(ServerEvents.InitiativeUpdated, initiative);
        }
      } catch (error) {
        emitError(socket, error);
      }
    });

    socket.on(ClientEvents.CharacterRemove, (payload) => {
      const session = requireGm(socket, rooms);
      if (!session) {
        return;
      }
      try {
        const data = CharacterRemovePayloadSchema.parse(payload);
        const character = rooms.getCharacter(data.characterId);
        if (!character || character.roomId !== session.roomId) {
          emitError(socket, new Error("Character not found"));
          return;
        }
        rooms.removeCharacter(data.characterId);
        emitCharactersUpdated(io, rooms, session.roomId);
        io.to(roomChannel(session.roomId)).emit(
          ServerEvents.TokensSynced,
          rooms.listVisibleTokens(session.roomId),
        );
      } catch (error) {
        emitError(socket, error);
      }
    });

    socket.on(ClientEvents.CharacterSetHp, (payload) => {
      const session = requireGm(socket, rooms);
      if (!session) {
        return;
      }
      try {
        const data = CharacterSetHpPayloadSchema.parse(payload);
        const character = rooms.getCharacter(data.characterId);
        if (!character || character.roomId !== session.roomId) {
          emitError(socket, new Error("Character not found"));
          return;
        }
        rooms.setCharacterHp(data.characterId, {
          hpCurrent: data.hpCurrent,
          hpMax: data.hpMax,
          delta: data.delta,
        });
        emitCharactersUpdated(io, rooms, session.roomId);
      } catch (error) {
        emitError(socket, error);
      }
    });

    socket.on(ClientEvents.CharacterSetConditions, (payload) => {
      const session = requireGm(socket, rooms);
      if (!session) {
        return;
      }
      try {
        const data = CharacterSetConditionsPayloadSchema.parse(payload);
        const character = rooms.getCharacter(data.characterId);
        if (!character || character.roomId !== session.roomId) {
          emitError(socket, new Error("Character not found"));
          return;
        }
        rooms.setCharacterConditions(data.characterId, data.conditions);
        emitCharactersUpdated(io, rooms, session.roomId);
      } catch (error) {
        emitError(socket, error);
      }
    });

    socket.on(ClientEvents.SettingsSet, (payload) => {
      const session = requireGm(socket, rooms);
      if (!session) {
        return;
      }
      try {
        const data = SettingsSetPayloadSchema.parse(payload);
        const settings = rooms.setSettings(session.roomId, data);
        io.to(roomChannel(session.roomId)).emit(ServerEvents.SettingsUpdated, settings);
        emitCharactersUpdated(io, rooms, session.roomId);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Settings update failed";
        socket.emit(ServerEvents.Error, { message });
      }
    });

    socket.on(ClientEvents.GmMintInvite, (callback) => {
      const session = requireGm(socket, rooms);
      if (!session) {
        callback?.({ ok: false, error: "GM only" });
        return;
      }
      try {
        const invite = rooms.mintGmInvite(session.roomId);
        const room = rooms.getRoomById(session.roomId);
        if (!room) {
          callback?.({ ok: false, error: "Room not found" });
          return;
        }
        callback?.({
          ok: true,
          invite,
          gmInviteUrl: `#/room/${room.code}?role=gm&invite=${encodeURIComponent(invite)}`,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Could not mint invite";
        callback?.({ ok: false, error: message });
      }
    });

    socket.on(ClientEvents.VisibilitySet, (payload) => {
      const session = requireGm(socket, rooms);
      if (!session) {
        return;
      }
      try {
        const data = VisibilitySetPayloadSchema.parse(payload);
        const visibility = rooms.setVisibility(session.roomId, data);
        io.to(roomChannel(session.roomId)).emit(ServerEvents.VisibilityUpdated, visibility);
        io.to(roomChannel(session.roomId)).emit(
          ServerEvents.TokensSynced,
          rooms.listVisibleTokens(session.roomId),
        );
        const parts: string[] = [];
        if (data.showPcs !== undefined) {
          parts.push(`PCs ${visibility.showPcs ? "shown" : "hidden"}`);
        }
        if (data.showNpcs !== undefined) {
          parts.push(`NPCs ${visibility.showNpcs ? "shown" : "hidden"}`);
        }
        emitLog(
          io,
          session.roomId,
          rooms.appendEvent({
            roomId: session.roomId,
            type: "visibility_set",
            summary: parts.join(", ") || "Visibility updated",
            payload: { ...visibility },
          }),
        );
      } catch (error) {
        emitError(socket, error);
      }
    });

    socket.on(ClientEvents.BattleStart, () => {
      const session = requireGm(socket, rooms);
      if (!session) {
        return;
      }
      try {
        const { battle, event } = rooms.startBattle(session.roomId);
        io.to(roomChannel(session.roomId)).emit(ServerEvents.BattleUpdated, battle);
        emitLog(io, session.roomId, event);
      } catch (error) {
        emitError(socket, error);
      }
    });

    socket.on(ClientEvents.BattleEnd, () => {
      const session = requireGm(socket, rooms);
      if (!session) {
        return;
      }
      try {
        const { event } = rooms.endBattle(session.roomId);
        io.to(roomChannel(session.roomId)).emit(ServerEvents.BattleUpdated, null);
        emitLog(io, session.roomId, event);
      } catch (error) {
        emitError(socket, error);
      }
    });

    socket.on(ClientEvents.FogPaint, (payload) => {
      const session = requireGm(socket, rooms);
      if (!session) {
        return;
      }
      try {
        const data = FogPaintPayloadSchema.parse(payload);
        const fog = rooms.paintFog(session.roomId, data.mapId, data.stroke);
        io.to(roomChannel(session.roomId)).emit(ServerEvents.FogUpdated, fog);
      } catch (error) {
        emitError(socket, error);
      }
    });

    socket.on(ClientEvents.FogReset, (payload) => {
      const session = requireGm(socket, rooms);
      if (!session) {
        return;
      }
      try {
        const data = FogResetPayloadSchema.parse(payload);
        const fog = rooms.resetFog(session.roomId, data.mapId, data.baseCovered);
        io.to(roomChannel(session.roomId)).emit(ServerEvents.FogUpdated, fog);
      } catch (error) {
        emitError(socket, error);
      }
    });

    socket.on("disconnect", () => {
      rooms.removeSession(socket.id);
    });
  });
}

function broadcastMapView(
  io: AppServer,
  rooms: RoomStore,
  roomId: string,
  map: ReturnType<RoomStore["getActiveMap"]>,
): void {
  io.to(roomChannel(roomId)).emit(ServerEvents.MapsUpdated, rooms.listMaps(roomId));
  io.to(roomChannel(roomId)).emit(ServerEvents.MapSet, map);
  io.to(roomChannel(roomId)).emit(ServerEvents.TokensSynced, rooms.listVisibleTokens(roomId));
  io.to(roomChannel(roomId)).emit(ServerEvents.FogUpdated, rooms.getActiveFog(roomId));
}

export function emitCharactersUpdated(io: AppServer, rooms: RoomStore, roomId: string): void {
  for (const session of rooms.listSessionsInRoom(roomId)) {
    io.to(session.socketId).emit(
      ServerEvents.CharactersUpdated,
      rooms.listCharactersForRole(roomId, session.role),
    );
  }
}

function requireGm(socket: AppSocket, rooms: RoomStore) {
  const session = rooms.getSession(socket.id);
  if (!session) {
    emitError(socket, new Error("Not joined"));
    return null;
  }
  if (session.role !== "gm") {
    emitError(socket, new Error("GM only"));
    return null;
  }
  return session;
}

function emitLog(io: AppServer, roomId: string, event: SessionEvent | null): void {
  if (!event) {
    return;
  }
  io.to(roomChannel(roomId)).emit(ServerEvents.LogAppended, event);
}

function emitError(socket: AppSocket, error: unknown): void {
  const message = error instanceof Error ? error.message : "Request failed";
  socket.emit(ServerEvents.Error, { message });
}
