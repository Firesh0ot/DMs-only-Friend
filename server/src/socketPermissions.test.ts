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
  type GmChangePinResult,
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
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dms-sock-perm-"));
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

function nextError(
  socket: ClientSocket<ServerToClientEvents, ClientToServerEvents>,
): Promise<string> {
  return new Promise((resolve) => {
    socket.once(ServerEvents.Error, (payload) => resolve(payload.message));
  });
}

describe("socket permission negatives", () => {
  it("rejects non-GM map, token, fog, and PIN change attempts", async () => {
    const { url, rooms } = await startServer();
    const { room, code } = rooms.createRoom({ pin: "1234" });
    const map = rooms.addMap(room.id, {
      name: "Keep",
      filename: "keep.png",
      width: 700,
      height: 700,
      gridPx: 70,
    });
    rooms.setActiveMap(room.id, map.id);
    const token = rooms.createToken({
      roomId: room.id,
      label: "Goblin",
      x: 2,
      y: 2,
      mapId: map.id,
    });

    const screen = connect(url);
    await waitConnected(screen);
    await join(screen, { code, role: "screen" });

    const mapDenied = nextError(screen);
    screen.emit(ClientEvents.MapActivate, { mapId: map.id });
    await expect(mapDenied).resolves.toBe("GM only");

    const gridDenied = nextError(screen);
    screen.emit(ClientEvents.MapUpdateGrid, { mapId: map.id, gridPx: 80 });
    await expect(gridDenied).resolves.toBe("GM only");

    const removeMapDenied = nextError(screen);
    screen.emit(ClientEvents.MapRemove, { mapId: map.id });
    await expect(removeMapDenied).resolves.toBe("GM only");

    const createDenied = nextError(screen);
    screen.emit(ClientEvents.TokenCreate, { label: "Wolf", x: 1, y: 1 });
    await expect(createDenied).resolves.toBe("GM only");

    const removeTokenDenied = nextError(screen);
    screen.emit(ClientEvents.TokenRemove, { tokenId: token.id });
    await expect(removeTokenDenied).resolves.toBe("GM only");

    const fogPaintDenied = nextError(screen);
    screen.emit(ClientEvents.FogPaint, {
      mapId: map.id,
      stroke: { kind: "rect", mode: "reveal", x: 10, y: 10, w: 40, h: 40 },
    });
    await expect(fogPaintDenied).resolves.toBe("GM only");

    const fogResetDenied = nextError(screen);
    screen.emit(ClientEvents.FogReset, { mapId: map.id, baseCovered: true });
    await expect(fogResetDenied).resolves.toBe("GM only");

    const fogLosDenied = nextError(screen);
    screen.emit(ClientEvents.FogSetLos, { mapId: map.id, enabled: true });
    await expect(fogLosDenied).resolves.toBe("GM only");

    const pinResult = await new Promise<GmChangePinResult>((resolve) => {
      screen.emit(
        ClientEvents.GmChangePin,
        { currentPin: "1234", newPin: "9999" },
        (result) => resolve(result ?? { ok: false, error: "no callback" }),
      );
    });
    expect(pinResult).toEqual({ ok: false, error: "GM only" });
    expect(rooms.verifyGmPin(room.id, "1234")).toBe(true);

    expect(rooms.getActiveMap(room.id)?.id).toBe(map.id);
    expect(rooms.getMapById(map.id)?.gridPx).toBe(70);
    expect(rooms.getToken(token.id)?.label).toBe("Goblin");
    expect(rooms.getFog(map.id).strokes).toHaveLength(0);

    screen.close();
  });

  it("rejects a player moving another player's token", async () => {
    const { url, rooms } = await startServer();
    const { room, code, gmInviteToken } = rooms.createRoom({ pin: "1234" });
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
    const boltToken = rooms.listVisibleTokens(room.id).find((token) => token.characterId === bolt.id)!;

    const gm = connect(url);
    await waitConnected(gm);
    await join(gm, { code, role: "gm", pin: "1234", invite: gmInviteToken });

    const player = connect(url);
    await waitConnected(player);
    await join(player, { code, role: "player", characterId: aria.id });

    const denied = nextError(player);
    player.emit(ClientEvents.TokenMove, { tokenId: boltToken.id, x: 8, y: 8 });
    await expect(denied).resolves.toMatch(/Not allowed/);
    expect(rooms.getToken(boltToken.id)?.x).toBe(boltToken.x);
    expect(rooms.getToken(boltToken.id)?.y).toBe(boltToken.y);

    gm.close();
    player.close();
  });

  it("lets GM set physicalCellCm and open calibration on screens only", async () => {
    const { url, rooms } = await startServer();
    const { room, code, gmInviteToken } = rooms.createRoom({ pin: "1234" });
    rooms.upsertCharacter({
      roomId: room.id,
      name: "Remy",
      kind: "pc",
      mapIds: [],
    });

    const gm = connect(url);
    await waitConnected(gm);
    await join(gm, { code, role: "gm", pin: "1234", invite: gmInviteToken });

    const screen = connect(url);
    await waitConnected(screen);
    await join(screen, { code, role: "screen" });

    const player = connect(url);
    await waitConnected(player);
    await join(player, { code, role: "player", name: "Remy" });

    const settingsPromise = new Promise<{ physicalCellCm: number | null }>((resolve) => {
      screen.once(ServerEvents.SettingsUpdated, (settings) => resolve(settings));
    });
    gm.emit(ClientEvents.SettingsSet, { physicalCellCm: 3 });
    await expect(settingsPromise).resolves.toMatchObject({ physicalCellCm: 3 });
    expect(rooms.getSettings(room.id).physicalCellCm).toBe(3);

    const screenCommand = new Promise<{ type: string }>((resolve) => {
      screen.once(ServerEvents.ScreenCommand, (payload) => resolve(payload));
    });
    const playerSawCommand = new Promise<boolean>((resolve) => {
      const timer = setTimeout(() => resolve(false), 200);
      player.once(ServerEvents.ScreenCommand, () => {
        clearTimeout(timer);
        resolve(true);
      });
    });
    gm.emit(ClientEvents.ScreenCommand, { type: "open-calibration" });
    await expect(screenCommand).resolves.toEqual({ type: "open-calibration" });
    await expect(playerSawCommand).resolves.toBe(false);

    const denied = nextError(screen);
    screen.emit(ClientEvents.ScreenCommand, { type: "open-calibration" });
    await expect(denied).resolves.toBe("GM only");

    gm.close();
    screen.close();
    player.close();
  });
});
