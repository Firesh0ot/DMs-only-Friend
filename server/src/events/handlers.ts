import {
  applyMove,
  CameraSetPayloadSchema,
  CharacterRemovePayloadSchema,
  CharacterSetConditionsPayloadSchema,
  CharacterSetHpPayloadSchema,
  CharacterSetSpeedPayloadSchema,
  CharacterUpsertPayloadSchema,
  ClientEvents,
  DiceRollPayloadSchema,
  FogPaintPayloadSchema,
  FogResetPayloadSchema,
  FogSetLosPayloadSchema,
  PortalSetClosedPayloadSchema,
  GmChangePinPayloadSchema,
  InitiativeSetPayloadSchema,
  MapActivatePayloadSchema,
  MapRemovePayloadSchema,
  MapUpdateGridPayloadSchema,
  mapGridBounds,
  moveBlockedByWalls,
  movementBlockerSegments,
  RoomJoinPayloadSchema,
  ScreenCommandPayloadSchema,
  ServerEvents,
  SettingsSetPayloadSchema,
  SpawnApplyPayloadSchema,
  SpawnSetPayloadSchema,
  TokenCreatePayloadSchema,
  TokenMovePayloadSchema,
  TokenRemovePayloadSchema,
  TurnFlagPayloadSchema,
  VisibilitySetPayloadSchema,
  normalizeRoomCode,
  roomCodePathSegment,
  roll,
  rollInitiative,
  sortInitiativeEntries,
  type ClientToServerEvents,
  type ServerToClientEvents,
  type SessionEvent,
} from "@dms/shared";
import type { Server, Socket } from "socket.io";
import { roomChannel, type RoomStore, type Session } from "../rooms.js";

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
        const initiative = rooms.removeToken(data.tokenId);
        io.to(roomChannel(session.roomId)).emit(ServerEvents.TokenRemoved, {
          tokenId: data.tokenId,
        });
        emitCharactersUpdated(io, rooms, session.roomId);
        if (initiative) {
          io.to(roomChannel(session.roomId)).emit(ServerEvents.InitiativeUpdated, initiative);
        }
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

        const map = token.mapId
          ? rooms.getMapById(token.mapId)
          : rooms.getActiveMap(session.roomId);
        const blockers = map ? movementBlockerSegments(map.walls, map.portals) : [];
        const bounds = map ? mapGridBounds(map) : null;
        if (map && blockers.length > 0) {
          if (
            moveBlockedByWalls({ x: token.x, y: token.y }, { x: data.x, y: data.y }, blockers)
          ) {
            socket.emit(ServerEvents.MovementRejected, {
              tokenId: token.id,
              reason: "Blocked by wall",
            });
            return;
          }
        }

        let movement = rooms.getMovementBudget(session.roomId);
        if (session.role === "player" && rooms.playerMovementLocked(session.roomId)) {
          const initiative = rooms.getInitiative(session.roomId);
          const active = initiative?.order[initiative.activeIndex];
          if (!active || active.tokenId !== token.id) {
            socket.emit(ServerEvents.MovementRejected, {
              tokenId: token.id,
              reason: "Not your turn",
            });
            return;
          }
          if (
            !movement.active ||
            movement.tokenId !== token.id ||
            movement.remainingCells === null
          ) {
            socket.emit(ServerEvents.MovementRejected, {
              tokenId: token.id,
              reason: "No movement budget",
            });
            return;
          }
          const result = applyMove({
            from: { x: token.x, y: token.y },
            to: { x: data.x, y: data.y },
            remainingCells: movement.remainingCells,
            turnStart: movement.turnStart,
            budgetCells: movement.budgetCells ?? movement.remainingCells,
            blockers,
            bounds,
          });
          if (!result.ok) {
            socket.emit(ServerEvents.MovementRejected, {
              tokenId: token.id,
              reason: result.reason,
            });
            return;
          }
          movement = rooms.setMovementBudget(session.roomId, {
            tokenId: token.id,
            turnStart: movement.turnStart,
            remainingCells: result.remainingCells,
            budgetCells: movement.budgetCells ?? movement.remainingCells,
            active: true,
          });
        }

        const moved = rooms.moveToken(data.tokenId, data.x, data.y);
        io.to(roomChannel(session.roomId)).emit(ServerEvents.TokenMoved, moved);
        if (session.role === "player" && movement.active && movement.tokenId === moved.id) {
          io.to(roomChannel(session.roomId)).emit(ServerEvents.MovementUpdated, movement);
        }
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
        const order = sortInitiativeEntries(
          data.order
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
                bonus: character?.initiativeBonus ?? 0,
              };
            })
            .filter((entry): entry is NonNullable<typeof entry> => entry !== null),
        ).map((entry) => ({
          tokenId: entry.tokenId,
          label: entry.label,
          initiative: entry.initiative,
          kind: entry.kind,
          image: entry.image,
        }));

        const previous = rooms.getInitiative(session.roomId);
        const initiative = rooms.setInitiative(session.roomId, {
          order,
          activeIndex: 0,
          round: previous?.round ?? 0,
          turnStart: null,
          remainingCells: null,
          activeActionUsed: false,
          activeBonusUsed: false,
          activeMovementRemaining: null,
        });
        const movement = rooms.clearMovementBudget(session.roomId);
        io.to(roomChannel(session.roomId)).emit(ServerEvents.InitiativeUpdated, initiative);
        io.to(roomChannel(session.roomId)).emit(ServerEvents.MovementUpdated, movement);
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

    socket.on(ClientEvents.InitiativeRoll, () => {
      const session = requireGm(socket, rooms);
      if (!session) {
        return;
      }
      try {
        const tokens = rooms.listAllTokensOnActiveMap(session.roomId);
        if (tokens.length === 0) {
          emitError(socket, new Error("No tokens on the active map"));
          return;
        }
        const characters = rooms.listCharacters(session.roomId);
        const byCharacter = new Map(characters.map((character) => [character.id, character]));
        const rolled = rollInitiative(
          tokens.map((token) => {
            const character = token.characterId
              ? byCharacter.get(token.characterId)
              : undefined;
            return {
              tokenId: token.id,
              label: token.label,
              kind: character?.kind ?? (token.isPlayer ? ("pc" as const) : ("npc" as const)),
              image: character?.image ?? token.image,
              initiativeBonus: character?.initiativeBonus ?? 0,
            };
          }),
        );
        const order = rolled.map((entry) => ({
          tokenId: entry.tokenId,
          label: entry.label,
          initiative: entry.initiative,
          kind: entry.kind,
          image: entry.image,
        }));
        const previous = rooms.getInitiative(session.roomId);
        const initiative = rooms.setInitiative(session.roomId, {
          order,
          activeIndex: 0,
          round: previous?.round ?? 0,
          turnStart: null,
          remainingCells: null,
          activeActionUsed: false,
          activeBonusUsed: false,
          activeMovementRemaining: null,
        });
        const movement = rooms.clearMovementBudget(session.roomId);
        io.to(roomChannel(session.roomId)).emit(ServerEvents.InitiativeUpdated, initiative);
        io.to(roomChannel(session.roomId)).emit(ServerEvents.MovementUpdated, movement);
        for (const entry of rolled) {
          const expr =
            entry.bonus >= 0 ? `1d20+${entry.bonus}` : `1d20${entry.bonus}`;
          emitLog(
            io,
            session.roomId,
            rooms.appendEvent({
              roomId: session.roomId,
              type: "dice_roll",
              summary: `${entry.label}: ${expr} → ${entry.initiative}`,
              payload: {
                tokenId: entry.tokenId,
                label: entry.label,
                expr,
                die: entry.die,
                bonus: entry.bonus,
                total: entry.initiative,
                source: "initiative_roll",
              },
            }),
          );
        }
        emitLog(
          io,
          session.roomId,
          rooms.appendEvent({
            roomId: session.roomId,
            type: "initiative_roll",
            summary: `Initiative rolled (${order.length})`,
            payload: { count: order.length },
          }),
        );
      } catch (error) {
        emitError(socket, error);
      }
    });

    socket.on(ClientEvents.InitiativeRollSelf, () => {
      const session = rooms.getSession(socket.id);
      if (!session) {
        emitError(socket, new Error("Not joined"));
        return;
      }
      if (session.role !== "player" || !session.characterId) {
        emitError(socket, new Error("Players only"));
        return;
      }
      try {
        const character = rooms.getCharacter(session.characterId);
        if (!character || character.roomId !== session.roomId) {
          emitError(socket, new Error("Character not found"));
          return;
        }
        const tokens = rooms.listAllTokensOnActiveMap(session.roomId);
        const token = tokens.find((entry) => entry.characterId === session.characterId);
        if (!token) {
          emitError(socket, new Error("Kein Token auf der aktiven Karte"));
          return;
        }
        const rolled = rollInitiative([
          {
            tokenId: token.id,
            label: token.label,
            kind: character.kind,
            image: character.image ?? token.image,
            initiativeBonus: character.initiativeBonus,
          },
        ])[0];
        if (!rolled) {
          emitError(socket, new Error("Roll failed"));
          return;
        }
        const previous = rooms.getInitiative(session.roomId);
        const existingOrder = previous?.order ?? [];
        const withoutSelf = existingOrder.filter((entry) => entry.tokenId !== token.id);
        const nextEntry = {
          tokenId: rolled.tokenId,
          label: rolled.label,
          initiative: rolled.initiative,
          kind: rolled.kind,
          image: rolled.image ?? null,
        };
        const withBonus = [
          ...withoutSelf.map((entry) => {
            const entryToken = tokens.find((candidate) => candidate.id === entry.tokenId);
            const entryCharacter = entryToken?.characterId
              ? rooms.getCharacter(entryToken.characterId)
              : null;
            return { ...entry, bonus: entryCharacter?.initiativeBonus ?? 0 };
          }),
          { ...nextEntry, bonus: rolled.bonus },
        ];
        const order = sortInitiativeEntries(withBonus).map((entry) => ({
          tokenId: entry.tokenId,
          label: entry.label,
          initiative: entry.initiative,
          kind: entry.kind,
          image: entry.image,
        }));
        const activeTokenId = previous?.order[previous.activeIndex]?.tokenId;
        let activeIndex = 0;
        if (activeTokenId) {
          const kept = order.findIndex((entry) => entry.tokenId === activeTokenId);
          activeIndex = kept >= 0 ? kept : 0;
        }
        const initiative = rooms.setInitiative(session.roomId, {
          order,
          activeIndex,
          round: previous?.round ?? 0,
          activeActionUsed: previous?.activeActionUsed ?? false,
          activeBonusUsed: previous?.activeBonusUsed ?? false,
        });
        io.to(roomChannel(session.roomId)).emit(ServerEvents.InitiativeUpdated, initiative);
        const expr =
          rolled.bonus >= 0 ? `1d20+${rolled.bonus}` : `1d20${rolled.bonus}`;
        emitLog(
          io,
          session.roomId,
          rooms.appendEvent({
            roomId: session.roomId,
            type: "dice_roll",
            summary: `${rolled.label}: ${expr} → ${rolled.initiative}`,
            payload: {
              tokenId: rolled.tokenId,
              label: rolled.label,
              expr,
              die: rolled.die,
              bonus: rolled.bonus,
              total: rolled.initiative,
              source: "initiative_roll_self",
            },
          }),
        );
      } catch (error) {
        emitError(socket, error);
      }
    });

    socket.on(ClientEvents.InitiativeNext, () => {
      const session = rooms.getSession(socket.id);
      if (!session) {
        emitError(socket, new Error("Not joined"));
        return;
      }
      try {
        const current = rooms.getInitiative(session.roomId);
        if (!current || current.order.length === 0) {
          emitError(socket, new Error("No initiative order"));
          return;
        }
        if (!canAdvanceTurn(session, rooms, current)) {
          emitError(socket, new Error("Not your turn"));
          return;
        }
        const ensured = rooms.ensureBattleForNextTurn(session.roomId);
        if (ensured.started) {
          io.to(roomChannel(session.roomId)).emit(ServerEvents.BattleUpdated, ensured.battle);
          emitLog(io, session.roomId, ensured.startEvent);
        }
        const baseRound =
          ensured.started && ensured.initiative
            ? ensured.initiative.round
            : current.round;
        const wrapping = current.activeIndex + 1 >= current.order.length;
        const activeIndex = wrapping ? 0 : current.activeIndex + 1;
        const round = wrapping ? baseRound + 1 : baseRound;
        rooms.setInitiative(session.roomId, {
          order: current.order,
          activeIndex,
          round,
          activeActionUsed: false,
          activeBonusUsed: false,
          remainingCells: null,
          turnStart: null,
          activeMovementRemaining: null,
        });
        const active = current.order[activeIndex];
        const movement = active
          ? rooms.beginTurnMovement(session.roomId, active.tokenId)
          : rooms.clearMovementBudget(session.roomId);
        const initiative = rooms.getInitiative(session.roomId);
        if (!initiative) {
          emitError(socket, new Error("No initiative order"));
          return;
        }
        io.to(roomChannel(session.roomId)).emit(ServerEvents.InitiativeUpdated, initiative);
        io.to(roomChannel(session.roomId)).emit(ServerEvents.MovementUpdated, movement);
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

    socket.on(ClientEvents.TurnAction, (payload) => {
      handleTurnFlag(socket, io, rooms, payload, "action");
    });

    socket.on(ClientEvents.TurnBonus, (payload) => {
      handleTurnFlag(socket, io, rooms, payload, "bonus");
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
        if (result.initiative) {
          io.to(roomChannel(session.roomId)).emit(
            ServerEvents.InitiativeUpdated,
            result.initiative,
          );
        }
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
          speedCells: data.speedCells,
          initiativeBonus: data.initiativeBonus,
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
        const removed = rooms.removeCharacter(data.characterId);
        emitCharactersUpdated(io, rooms, session.roomId);
        io.to(roomChannel(session.roomId)).emit(
          ServerEvents.TokensSynced,
          rooms.listVisibleTokens(session.roomId),
        );
        if (removed.initiative) {
          io.to(roomChannel(session.roomId)).emit(
            ServerEvents.InitiativeUpdated,
            removed.initiative,
          );
        }
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

    socket.on(ClientEvents.CharacterSetSpeed, (payload) => {
      const session = requireGm(socket, rooms);
      if (!session) {
        return;
      }
      try {
        const data = CharacterSetSpeedPayloadSchema.parse(payload);
        const character = rooms.getCharacter(data.characterId);
        if (!character || character.roomId !== session.roomId) {
          emitError(socket, new Error("Character not found"));
          return;
        }
        rooms.setCharacterSpeed(data.characterId, data.speedCells);
        emitCharactersUpdated(io, rooms, session.roomId);
      } catch (error) {
        emitError(socket, error);
      }
    });

    socket.on(ClientEvents.SpawnSet, (payload) => {
      const session = requireGm(socket, rooms);
      if (!session) {
        return;
      }
      try {
        const data = SpawnSetPayloadSchema.parse(payload);
        const points = rooms.setSpawnPoints(session.roomId, data.mapId, data.points);
        io.to(roomChannel(session.roomId)).emit(ServerEvents.SpawnUpdated, {
          mapId: data.mapId,
          points,
        });
      } catch (error) {
        emitError(socket, error);
      }
    });

    socket.on(ClientEvents.SpawnApply, (payload) => {
      const session = requireGm(socket, rooms);
      if (!session) {
        return;
      }
      try {
        const data = SpawnApplyPayloadSchema.parse(payload);
        const result = rooms.applySpawn(session.roomId, data.mapId);
        const active = rooms.getActiveMap(session.roomId);
        broadcastMapView(io, rooms, session.roomId, active);
        emitCharactersUpdated(io, rooms, session.roomId);
        io.to(roomChannel(session.roomId)).emit(ServerEvents.SpawnUpdated, {
          mapId: data.mapId,
          points: result.points,
        });
        emitLog(
          io,
          session.roomId,
          rooms.appendEvent({
            roomId: session.roomId,
            type: "spawn_applied",
            summary: `Spawn applied (${result.placed.length})`,
            payload: {
              mapId: data.mapId,
              placed: result.placed,
            },
          }),
        );
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

    socket.on(ClientEvents.ScreenCommand, (payload) => {
      const session = requireGm(socket, rooms);
      if (!session) {
        return;
      }
      try {
        const data = ScreenCommandPayloadSchema.parse(payload);
        for (const peer of rooms.listSessionsInRoom(session.roomId)) {
          if (peer.role !== "screen") {
            continue;
          }
          io.to(peer.socketId).emit(ServerEvents.ScreenCommand, data);
        }
      } catch (error) {
        emitError(socket, error);
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
          gmInviteUrl: `#/room/${roomCodePathSegment(room.code)}?role=gm&invite=${encodeURIComponent(invite)}`,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Could not mint invite";
        callback?.({ ok: false, error: message });
      }
    });

    socket.on(ClientEvents.GmChangePin, (payload, callback) => {
      const session = requireGm(socket, rooms);
      if (!session) {
        callback?.({ ok: false, error: "GM only" });
        return;
      }
      try {
        const data = GmChangePinPayloadSchema.parse(payload);
        const result = rooms.changeGmPin(session.roomId, {
          currentPin: data.currentPin,
          newPin: data.newPin,
          invalidateInvites: data.invalidateInvites,
        });
        callback?.({ ok: true, inviteInvalidated: result.inviteInvalidated });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Could not change PIN";
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
        const { battle, event, initiative } = rooms.startBattle(session.roomId);
        io.to(roomChannel(session.roomId)).emit(ServerEvents.BattleUpdated, battle);
        if (initiative) {
          io.to(roomChannel(session.roomId)).emit(ServerEvents.InitiativeUpdated, initiative);
        }
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
        io.to(roomChannel(session.roomId)).emit(
          ServerEvents.MovementUpdated,
          rooms.getMovementBudget(session.roomId),
        );
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

    socket.on(ClientEvents.FogSetLos, (payload) => {
      const session = requireGm(socket, rooms);
      if (!session) {
        return;
      }
      try {
        const data = FogSetLosPayloadSchema.parse(payload);
        const fog = rooms.setFogLos(session.roomId, data.mapId, data.enabled);
        io.to(roomChannel(session.roomId)).emit(ServerEvents.FogUpdated, fog);
      } catch (error) {
        emitError(socket, error);
      }
    });

    socket.on(ClientEvents.PortalSetClosed, (payload) => {
      const session = requireGm(socket, rooms);
      if (!session) {
        return;
      }
      try {
        const data = PortalSetClosedPayloadSchema.parse(payload);
        const map = rooms.setPortalClosed(
          session.roomId,
          data.mapId,
          data.portalId,
          data.closed,
        );
        io.to(roomChannel(session.roomId)).emit(ServerEvents.MapsUpdated, rooms.listMaps(session.roomId));
        const active = rooms.getActiveMap(session.roomId);
        if (active?.id === map.id) {
          io.to(roomChannel(session.roomId)).emit(ServerEvents.MapSet, map);
        }
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
  const initiative = rooms.pruneStaleInitiative(roomId);
  if (initiative) {
    io.to(roomChannel(roomId)).emit(ServerEvents.InitiativeUpdated, initiative);
  }
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

function canAdvanceTurn(
  session: Session,
  rooms: RoomStore,
  initiative: NonNullable<ReturnType<RoomStore["getInitiative"]>>,
): boolean {
  if (session.role === "gm") {
    return true;
  }
  if (session.role !== "player" || !session.characterId) {
    return false;
  }
  const active = initiative.order[initiative.activeIndex];
  if (!active) {
    return false;
  }
  const token = rooms.getToken(active.tokenId);
  return token?.characterId === session.characterId;
}

function handleTurnFlag(
  socket: AppSocket,
  io: AppServer,
  rooms: RoomStore,
  payload: unknown,
  flag: "action" | "bonus",
): void {
  const session = rooms.getSession(socket.id);
  if (!session) {
    emitError(socket, new Error("Not joined"));
    return;
  }
  try {
    const data = TurnFlagPayloadSchema.parse(payload);
    const current = rooms.getInitiative(session.roomId);
    if (!current || current.order.length === 0) {
      emitError(socket, new Error("No initiative order"));
      return;
    }
    if (!canAdvanceTurn(session, rooms, current)) {
      emitError(socket, new Error("Not your turn"));
      return;
    }
    const initiative = rooms.setTurnFlags(
      session.roomId,
      flag === "action" ? { actionUsed: data.used } : { bonusUsed: data.used },
    );
    if (!initiative) {
      emitError(socket, new Error("No initiative order"));
      return;
    }
    io.to(roomChannel(session.roomId)).emit(ServerEvents.InitiativeUpdated, initiative);
    emitLog(
      io,
      session.roomId,
      rooms.appendEvent({
        roomId: session.roomId,
        type: flag === "action" ? "turn_action" : "turn_bonus",
        summary: `${flag === "action" ? "Action" : "Bonus"} ${data.used ? "used" : "ready"}`,
        payload: { used: data.used, flag },
      }),
    );
  } catch (error) {
    emitError(socket, error);
  }
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
