import {
  CameraSetPayloadSchema,
  ClientEvents,
  DiceRollPayloadSchema,
  InitiativeSetPayloadSchema,
  RoomJoinPayloadSchema,
  ServerEvents,
  TokenCreatePayloadSchema,
  TokenMovePayloadSchema,
  TokenRemovePayloadSchema,
  roll,
  type ClientToServerEvents,
  type ServerToClientEvents,
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
        const token = rooms.createToken({
          roomId: session.roomId,
          label: data.label,
          image: data.image ?? null,
          x: data.x,
          y: data.y,
          sizeCells: data.sizeCells,
          isPlayer: data.isPlayer,
        });
        io.to(roomChannel(session.roomId)).emit(ServerEvents.TokenCreated, token);
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
        const tokens = rooms.listTokens(session.roomId);
        const byId = new Map(tokens.map((token) => [token.id, token]));
        const order = data.order
          .map((entry) => {
            const token = byId.get(entry.tokenId);
            if (!token) {
              return null;
            }
            return {
              tokenId: token.id,
              label: token.label,
              initiative: entry.initiative,
            };
          })
          .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
          .sort((a, b) => b.initiative - a.initiative || a.label.localeCompare(b.label));

        const initiative = rooms.setInitiative(session.roomId, {
          order,
          activeIndex: 0,
        });
        io.to(roomChannel(session.roomId)).emit(ServerEvents.InitiativeUpdated, initiative);
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
        const activeIndex = (current.activeIndex + 1) % current.order.length;
        const initiative = rooms.setInitiative(session.roomId, {
          order: current.order,
          activeIndex,
        });
        io.to(roomChannel(session.roomId)).emit(ServerEvents.InitiativeUpdated, initiative);
      } catch (error) {
        emitError(socket, error);
      }
    });

    socket.on("disconnect", () => {
      rooms.removeSession(socket.id);
    });
  });
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

function emitError(socket: AppSocket, error: unknown): void {
  const message = error instanceof Error ? error.message : "Request failed";
  socket.emit(ServerEvents.Error, { message });
}
