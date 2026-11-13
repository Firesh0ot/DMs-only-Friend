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

async function startServer(): Promise<{ url: string; rooms: RoomStore }> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dms-map-session-"));
  tempDirs.push(dir);
  const rooms = new RoomStore(openDb(path.join(dir, "test.sqlite")));
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
  return ioc(url, { transports: ["websocket"], forceNew: true, reconnection: false });
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
    pin?: string;
    invite?: string;
  },
) {
  return new Promise<void>((resolve, reject) => {
    socket.emit(ClientEvents.RoomJoin, payload, (result) => {
      if (!result?.ok) {
        reject(new Error(result?.error ?? "Join failed"));
        return;
      }
      resolve();
    });
  });
}

function nextError(
  socket: ClientSocket<ServerToClientEvents, ClientToServerEvents>,
  ms = 400,
): Promise<string | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), ms);
    socket.once(ServerEvents.Error, (payload) => {
      clearTimeout(timer);
      resolve(payload.message);
    });
  });
}

async function waitSessionGone(rooms: RoomStore, socketId: string): Promise<void> {
  await new Promise<void>((resolve) => {
    const timer = setInterval(() => {
      if (!rooms.getSession(socketId)) {
        clearInterval(timer);
        resolve();
      }
    }, 10);
  });
}

describe("map ops and socket session", () => {
  it("lets GM activate and remove maps while joined", async () => {
    const { url, rooms } = await startServer();
    const { room, code, gmInviteToken } = rooms.createRoom({ pin: "1234" });
    const mapA = rooms.addMap(room.id, {
      name: "A",
      filename: "a.png",
      width: 100,
      height: 100,
      gridPx: 70,
    });
    const mapB = rooms.addMap(room.id, {
      name: "B",
      filename: "b.png",
      width: 100,
      height: 100,
      gridPx: 70,
    });
    rooms.setActiveMap(room.id, mapA.id);

    const gm = connect(url);
    await waitConnected(gm);
    await join(gm, { code, role: "gm", pin: "1234", invite: gmInviteToken });

    const activateError = nextError(gm);
    gm.emit(ClientEvents.MapActivate, { mapId: mapB.id });
    await expect(activateError).resolves.toBeNull();
    expect(rooms.getActiveMap(room.id)?.id).toBe(mapB.id);

    const removeError = nextError(gm);
    gm.emit(ClientEvents.MapRemove, { mapId: mapA.id });
    await expect(removeError).resolves.toBeNull();
    expect(rooms.listMaps(room.id).map((map) => map.id)).toEqual([mapB.id]);

    gm.close();
  });

  it("returns Not joined for map:activate after reconnect without rejoin", async () => {
    const { url, rooms } = await startServer();
    const { room, code, gmInviteToken } = rooms.createRoom({ pin: "1234" });
    const mapA = rooms.addMap(room.id, {
      name: "A",
      filename: "a.png",
      width: 100,
      height: 100,
      gridPx: 70,
    });
    const mapB = rooms.addMap(room.id, {
      name: "B",
      filename: "b.png",
      width: 100,
      height: 100,
      gridPx: 70,
    });
    rooms.setActiveMap(room.id, mapA.id);

    const gm = connect(url);
    await waitConnected(gm);
    await join(gm, { code, role: "gm", pin: "1234", invite: gmInviteToken });
    const oldId = gm.id;
    expect(oldId).toBeTruthy();

    gm.disconnect();
    await waitSessionGone(rooms, oldId!);
    gm.connect();
    await waitConnected(gm);
    expect(gm.id).toBeTruthy();
    expect(rooms.getSession(gm.id!)).toBeUndefined();

    const denied = nextError(gm);
    gm.emit(ClientEvents.MapActivate, { mapId: mapB.id });
    await expect(denied).resolves.toBe("Not joined");
    expect(rooms.getActiveMap(room.id)?.id).toBe(mapA.id);

    gm.close();
  });

  it("allows map:activate after reconnect when client rejoins with PIN", async () => {
    const { url, rooms } = await startServer();
    const { room, code, gmInviteToken } = rooms.createRoom({ pin: "1234" });
    const mapA = rooms.addMap(room.id, {
      name: "A",
      filename: "a.png",
      width: 100,
      height: 100,
      gridPx: 70,
    });
    const mapB = rooms.addMap(room.id, {
      name: "B",
      filename: "b.png",
      width: 100,
      height: 100,
      gridPx: 70,
    });
    rooms.setActiveMap(room.id, mapA.id);

    const gm = connect(url);
    await waitConnected(gm);
    await join(gm, { code, role: "gm", pin: "1234", invite: gmInviteToken });
    const oldId = gm.id;
    expect(oldId).toBeTruthy();

    gm.disconnect();
    await waitSessionGone(rooms, oldId!);
    gm.connect();
    await waitConnected(gm);
    await join(gm, { code, role: "gm", pin: "1234" });
    expect(gm.id).toBeTruthy();
    expect(rooms.getSession(gm.id!)?.role).toBe("gm");

    const activateError = nextError(gm);
    gm.emit(ClientEvents.MapActivate, { mapId: mapB.id });
    await expect(activateError).resolves.toBeNull();
    expect(rooms.getActiveMap(room.id)?.id).toBe(mapB.id);

    const removeError = nextError(gm);
    gm.emit(ClientEvents.MapRemove, { mapId: mapA.id });
    await expect(removeError).resolves.toBeNull();
    expect(rooms.getMapById(mapA.id)).toBeNull();

    gm.close();
  });
});
