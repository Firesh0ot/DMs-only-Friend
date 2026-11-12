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
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dms-tok-"));
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
  return new Promise<Extract<
    import("@dms/shared").RoomJoinResult,
    { ok: true }
  >>((resolve, reject) => {
    socket.emit(ClientEvents.RoomJoin, payload, (result) => {
      if (!result?.ok) {
        reject(new Error(result?.error ?? "Join failed"));
        return;
      }
      resolve(result);
    });
  });
}

describe("token ownership helpers", () => {
  it("binds player move rights to claimed character id, not label", () => {
    const store = makeStore();
    const { room } = store.createRoom();
    const map = store.addMap(room.id, {
      name: "Cave",
      filename: "cave.png",
      width: 700,
      height: 700,
      gridPx: 70,
    });
    store.setActiveMap(room.id, map.id);
    const aria = store.upsertCharacter({
      roomId: room.id,
      name: "Aria",
      kind: "pc",
      mapIds: [map.id],
    });
    const twin = store.upsertCharacter({
      roomId: room.id,
      name: "Aria",
      kind: "pc",
      mapIds: [map.id],
    });
    store.setActiveMap(room.id, map.id);
    const tokens = store.listVisibleTokens(room.id);
    const ariaToken = tokens.find((token) => token.characterId === aria.id);
    const twinToken = tokens.find((token) => token.characterId === twin.id);
    expect(ariaToken?.label).toBe("Aria");
    expect(twinToken?.label).toBe("Aria");

    const session = store.bindSession("sock-1", {
      roomId: room.id,
      role: "player",
      playerName: aria.name,
      characterId: aria.id,
    });
    expect(store.canSessionMoveToken(session, ariaToken as TokenState)).toBe(true);
    expect(store.canSessionMoveToken(session, twinToken as TokenState)).toBe(false);

    const gm = store.bindSession("sock-gm", {
      roomId: room.id,
      role: "gm",
      playerName: null,
      characterId: null,
    });
    expect(store.canSessionMoveToken(gm, twinToken as TokenState)).toBe(true);
  });

  it("claims a PC by characterId or unique name and rejects collisions", () => {
    const store = makeStore();
    const { room } = store.createRoom();
    const aria = store.upsertCharacter({
      roomId: room.id,
      name: "Aria",
      kind: "pc",
      mapIds: [],
    });
    store.upsertCharacter({
      roomId: room.id,
      name: "Goblin",
      kind: "npc",
      mapIds: [],
    });

    const byId = store.claimCharacterForPlayer(room.id, {
      characterId: aria.id,
      socketId: "a",
    });
    expect(byId).toEqual({ characterId: aria.id, playerName: "Aria" });

    const byName = store.claimCharacterForPlayer(room.id, {
      name: "Aria",
      socketId: "b",
    });
    expect(byName.characterId).toBe(aria.id);

    store.bindSession("a", {
      roomId: room.id,
      role: "player",
      playerName: "Aria",
      characterId: aria.id,
    });
    expect(() =>
      store.claimCharacterForPlayer(room.id, {
        characterId: aria.id,
        socketId: "c",
      }),
    ).toThrow(/already claimed/);

    expect(() =>
      store.claimCharacterForPlayer(room.id, {
        name: "Goblin",
        socketId: "d",
      }),
    ).toThrow(/No PC named/);

    store.upsertCharacter({
      roomId: room.id,
      name: "Aria",
      kind: "pc",
      mapIds: [],
    });
    expect(() =>
      store.claimCharacterForPlayer(room.id, {
        name: "Aria",
        socketId: "e",
      }),
    ).toThrow(/Ambiguous PC name/);
  });
});

describe("token move ownership over sockets", () => {
  it("lets a claimed player move only their linked token", async () => {
    const { url, rooms } = await startServer();
    const { room, code, gmInviteToken } = rooms.createRoom();
    const map = rooms.addMap(room.id, {
      name: "Cave",
      filename: "cave.png",
      width: 700,
      height: 700,
      gridPx: 70,
    });
    const aria = rooms.upsertCharacter({
      roomId: room.id,
      name: "Aria",
      kind: "pc",
      mapIds: [map.id],
    });
    const bolt = rooms.upsertCharacter({
      roomId: room.id,
      name: "Bolt",
      kind: "pc",
      mapIds: [map.id],
    });
    rooms.setActiveMap(room.id, map.id);
    const tokens = rooms.listVisibleTokens(room.id);
    const ariaToken = tokens.find((token) => token.characterId === aria.id)!;
    const boltToken = tokens.find((token) => token.characterId === bolt.id)!;

    const gm = connect(url);
    await waitConnected(gm);
    await join(gm, { code, role: "gm", pin: "1234", invite: gmInviteToken });

    const player = connect(url);
    await waitConnected(player);
    const joined = await join(player, { code, role: "player", characterId: aria.id });
    expect(joined.snapshot.characterId).toBe(aria.id);
    expect(joined.snapshot.playerName).toBe("Aria");

    const moved = new Promise<TokenState>((resolve) => {
      player.once(ServerEvents.TokenMoved, resolve);
    });
    player.emit(ClientEvents.TokenMove, { tokenId: ariaToken.id, x: 4, y: 5 });
    const ownMove = await moved;
    expect(ownMove.x).toBe(4);
    expect(ownMove.y).toBe(5);

    const denied = new Promise<string>((resolve) => {
      player.once(ServerEvents.Error, (payload) => resolve(payload.message));
    });
    player.emit(ClientEvents.TokenMove, { tokenId: boltToken.id, x: 9, y: 9 });
    await expect(denied).resolves.toMatch(/Not allowed/);

    const gmMoved = new Promise<TokenState>((resolve) => {
      gm.once(ServerEvents.TokenMoved, resolve);
    });
    gm.emit(ClientEvents.TokenMove, { tokenId: boltToken.id, x: 3, y: 3 });
    const other = await gmMoved;
    expect(other.characterId).toBe(bolt.id);
    expect(other.x).toBe(3);

    gm.close();
    player.close();
  });

  it("rejects player join without a claimable PC", async () => {
    const { url, rooms } = await startServer();
    const { code } = rooms.createRoom();
    const player = connect(url);
    await waitConnected(player);
    await expect(join(player, { code, role: "player", name: "Aria" })).rejects.toThrow(
      /No PC named|Select a PC/,
    );
    player.close();
  });
});
