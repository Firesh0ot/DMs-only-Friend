import {
  CameraSetPayloadSchema,
  CharacterRemovePayloadSchema,
  CharacterUpsertPayloadSchema,
  ClientEvents,
  DiceRollPayloadSchema,
  InitiativeSetPayloadSchema,
  MapActivatePayloadSchema,
  MapRemovePayloadSchema,
  MapUpdateGridPayloadSchema,
  RoomJoinPayloadSchema,
  ServerEvents,
  TokenCreatePayloadSchema,
  TokenMovePayloadSchema,
  TokenRemovePayloadSchema,
  VisibilitySetPayloadSchema,
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
        const room = rooms.getRoomByCode(data.code);
        if (!room) {
          callback?.({ ok: false, error: "Room not found" });
          return;
        }

        const playerName =
          data.role === "player" ? (data.name?.trim() || "Player") : (data.name?.trim() ?? null);

        rooms.bindSession(socket.id, {
          roomId: room.id,
          role: data.role,
          playerName,
        });

        void socket.join(roomChannel(room.id));
        const snapshot = rooms.getSnapshot(room.id, data.role, playerName);
        callback?.({ ok: true, snapshot });
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
        io.to(roomChannel(session.roomId)).emit(
          ServerEvents.CharactersUpdated,
          rooms.listCharacters(session.roomId),
        );
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
        io.to(roomChannel(session.roomId)).emit(
          ServerEvents.CharactersUpdated,
          rooms.listCharacters(session.roomId),
        );
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
        if (session.role !== "gm") {
          if (session.role !== "player" || !token.isPlayer || token.label !== session.playerName) {
            emitError(socket, new Error("Not allowed to move this token"));
            return;
          }
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
        const logged = rooms.logDice({
          roomId: session.roomId,
          playerName: session.playerName ?? session.role.toUpperCase(),
          expr: rolled.parsed.expr,
          results: rolled.results,
          total: rolled.total,
        });
        io.to(roomChannel(session.roomId)).emit(ServerEvents.DiceRolled, {
          id: logged.id,
          playerName: session.playerName ?? session.role.toUpperCase(),
          expr: rolled.parsed.expr,
          results: rolled.results,
          total: rolled.total,
          createdAt: logged.createdAt,
        });
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
        io.to(roomChannel(session.roomId)).emit(
          ServerEvents.CharactersUpdated,
          rooms.listCharacters(session.roomId),
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
          sizeCells: data.sizeCells,
          mapIds: data.mapIds,
        });
        io.to(roomChannel(session.roomId)).emit(
          ServerEvents.CharactersUpdated,
          rooms.listCharacters(session.roomId),
        );
        io.to(roomChannel(session.roomId)).emit(
          ServerEvents.TokensSynced,
          rooms.listVisibleTokens(session.roomId),
        );
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
        io.to(roomChannel(session.roomId)).emit(
          ServerEvents.CharactersUpdated,
          rooms.listCharacters(session.roomId),
        );
        io.to(roomChannel(session.roomId)).emit(
          ServerEvents.TokensSynced,
          rooms.listVisibleTokens(session.roomId),
        );
      } catch (error) {
        emitError(socket, error);
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
