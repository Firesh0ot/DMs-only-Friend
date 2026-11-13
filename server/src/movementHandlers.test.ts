import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { io as ioc, type Socket as ClientSocket } from "socket.io-client";
import { Server } from "socket.io";
import {
  ClientEvents,
  ServerEvents,
  type ClientToServerEvents,
  type MovementBudget,
  type ServerToClientEvents,
  type TokenState,
} from "@dms/shared";
import { openDb } from "./db.js";
import { registerSocketHandlers } from "./events/handlers.js";
import { RoomStore } from "./rooms.js";

const tempDirs: string[] = [];
const servers: http.Server[] = [];

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise<void>((resolve) => {
          server.close(() => resolve());
        }),
    ),
  );
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function makeStore(): RoomStore {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dms-move-"));
  tempDirs.push(dir);
  return new RoomStore(openDb(path.join(dir, "test.sqlite")));
}

async function startServer(): Promise<{ url: string; rooms: RoomStore }> {
  const rooms = makeStore();
  const httpServer = http.createServer();
  const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    cors: { origin: "*" },
  });
  registerSocketHandlers(io, rooms);
  await new Promise<void>((resolve) => {
    httpServer.listen(0, () => resolve());
  });
  servers.push(httpServer);
  const address = httpServer.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to bind test server");
  }
  return { url: `http://127.0.0.1:${address.port}`, rooms };
}

function connect(url: string): ClientSocket<ServerToClientEvents, ClientToServerEvents> {
  return ioc(url, { transports: ["websocket"], forceNew: true });
}

async function waitConnected(
  socket: ClientSocket<ServerToClientEvents, ClientToServerEvents>,
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    socket.on("connect", () => resolve());
    socket.on("connect_error", reject);
  });
}

async function join(
  socket: ClientSocket<ServerToClientEvents, ClientToServerEvents>,
  payload: {
    code: string;
    role: "gm" | "screen" | "player";
    name?: string;
    characterId?: string;
    pin?: string;
    invite?: string;
  },
) {
  return new Promise<Extract<import("@dms/shared").RoomJoinResult, { ok: true }>>(
    (resolve, reject) => {
      socket.emit(ClientEvents.RoomJoin, payload, (result) => {
        if (!result?.ok) {
          reject(new Error(result?.error ?? "Join failed"));
          return;
        }
        resolve(result);
      });
    },
  );
}

describe("spawn and movement budget", () => {
  it("applies assigned and free spawn points without moving extras", async () => {
    const { url, rooms } = await startServer();
    const created = rooms.createRoom({ code: "SPAWN1", pin: "1234" });
    const map = rooms.addMap(created.room.id, {
      name: "Hall",
      filename: "hall.png",
      width: 700,
      height: 700,
      gridPx: 70,
    });
    rooms.setActiveMap(created.room.id, map.id);
    const pcs = [1, 2, 3, 4, 5].map((n) =>
      rooms.upsertCharacter({
        roomId: created.room.id,
        name: `PC${n}`,
        kind: "pc",
        mapIds: [map.id],
      }),
    );
    for (const pc of pcs) {
      rooms.moveToken(
        rooms.listAllTokensOnActiveMap(created.room.id).find((t) => t.characterId === pc.id)!.id,
        9,
        9,
      );
    }

    const gm = connect(url);
    await waitConnected(gm);
    await join(gm, { code: created.code, role: "gm", pin: "1234", invite: created.gmInviteToken });

    const points = [
      { id: "sp1", x: 1, y: 1, assignedCharacterId: pcs[1].id, label: "Door" },
      { id: "sp2", x: 2, y: 1, assignedCharacterId: null },
      { id: "sp3", x: 3, y: 1, assignedCharacterId: null },
      { id: "sp4", x: 4, y: 1, assignedCharacterId: null },
    ];
    const updated = new Promise<{ mapId: string; points: unknown[] }>((resolve) => {
      gm.once(ServerEvents.SpawnUpdated, resolve);
    });
    gm.emit(ClientEvents.SpawnSet, { mapId: map.id, points });
    await updated;

    gm.emit(ClientEvents.SpawnApply, { mapId: map.id });
    await new Promise((resolve) => setTimeout(resolve, 50));

    const tokens = rooms.listAllTokensOnActiveMap(created.room.id);
    const pos = (characterId: string) =>
      tokens.find((token) => token.characterId === characterId)!;
    expect(pos(pcs[1].id)).toMatchObject({ x: 1, y: 1 });
    expect(pos(pcs[0].id)).toMatchObject({ x: 2, y: 1 });
    expect(pos(pcs[2].id)).toMatchObject({ x: 3, y: 1 });
    expect(pos(pcs[3].id)).toMatchObject({ x: 4, y: 1 });
    expect(pos(pcs[4].id)).toMatchObject({ x: 9, y: 9 });
    gm.close();
  });

  it("enforces Chebyshev budget for active player and lets GM bypass", async () => {
    const { url, rooms } = await startServer();
    const created = rooms.createRoom({ code: "MOVE1", pin: "1234" });
    const map = rooms.addMap(created.room.id, {
      name: "Cave",
      filename: "cave.png",
      width: 700,
      height: 700,
      gridPx: 70,
    });
    rooms.setActiveMap(created.room.id, map.id);
    const aria = rooms.upsertCharacter({
      roomId: created.room.id,
      name: "Aria",
      kind: "pc",
      speedCells: 6,
      mapIds: [map.id],
    });
    const token = rooms
      .listAllTokensOnActiveMap(created.room.id)
      .find((entry) => entry.characterId === aria.id)!;
    rooms.moveToken(token.id, 0, 0);

    const gm = connect(url);
    const player = connect(url);
    await waitConnected(gm);
    await waitConnected(player);
    await join(gm, { code: created.code, role: "gm", pin: "1234", invite: created.gmInviteToken });
    await join(player, { code: created.code, role: "player", characterId: aria.id });

    gm.emit(ClientEvents.InitiativeSet, {
      order: [{ tokenId: token.id, initiative: 15 }],
    });
    await new Promise((resolve) => setTimeout(resolve, 30));
    const movementPromise = new Promise<MovementBudget>((resolve) => {
      player.once(ServerEvents.MovementUpdated, resolve);
    });
    gm.emit(ClientEvents.InitiativeNext);
    const budget = await movementPromise;
    expect(budget.remainingCells).toBe(6);
    expect(budget.tokenId).toBe(token.id);

    const rejected = new Promise<{ tokenId: string; reason: string }>((resolve) => {
      player.once(ServerEvents.MovementRejected, resolve);
    });
    player.emit(ClientEvents.TokenMove, { tokenId: token.id, x: 7, y: 0 });
    await expect(rejected).resolves.toMatchObject({ tokenId: token.id });

    const moved = new Promise<TokenState>((resolve) => {
      player.once(ServerEvents.TokenMoved, resolve);
    });
    const updated = new Promise<MovementBudget>((resolve) => {
      player.once(ServerEvents.MovementUpdated, resolve);
    });
    player.emit(ClientEvents.TokenMove, { tokenId: token.id, x: 3, y: 0 });
    await expect(moved).resolves.toMatchObject({ x: 3, y: 0 });
    await expect(updated).resolves.toMatchObject({ remainingCells: 3 });

    player.emit(ClientEvents.TokenMove, { tokenId: token.id, x: 5, y: 0 });
    await new Promise((resolve) => setTimeout(resolve, 40));
    expect(rooms.getMovementBudget(created.room.id).remainingCells).toBe(1);

    gm.emit(ClientEvents.TokenMove, { tokenId: token.id, x: 20, y: 20 });
    await new Promise((resolve) => setTimeout(resolve, 40));
    expect(rooms.getToken(token.id)).toMatchObject({ x: 20, y: 20 });

    gm.close();
    player.close();
  });
});
