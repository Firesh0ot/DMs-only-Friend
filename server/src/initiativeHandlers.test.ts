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
  type InitiativeState,
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

async function startServer(): Promise<{
  url: string;
  rooms: RoomStore;
}> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dms-init-sock-"));
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

type TestSocket = ClientSocket<ServerToClientEvents, ClientToServerEvents>;

function connect(url: string): TestSocket {
  return ioc(url, { transports: ["websocket"], forceNew: true });
}

async function waitConnected(socket: TestSocket): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    socket.on("connect", () => resolve());
    socket.on("connect_error", reject);
  });
}

async function join(
  socket: TestSocket,
  payload: {
    code: string;
    role: "gm" | "screen" | "player";
    name?: string;
    characterId?: string;
    pin?: string;
    invite?: string;
  },
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    socket.emit(ClientEvents.RoomJoin, payload, (result) => {
      if (!result.ok) {
        reject(new Error(result.error));
        return;
      }
      resolve();
    });
  });
}

function nextInitiative(socket: TestSocket): Promise<InitiativeState> {
  return new Promise((resolve) => {
    socket.once(ServerEvents.InitiativeUpdated, (initiative) => resolve(initiative));
  });
}

function nextError(socket: TestSocket): Promise<string> {
  return new Promise((resolve) => {
    socket.once(ServerEvents.Error, (payload) => resolve(payload.message));
  });
}

describe("initiative socket handlers", () => {
  it("sets sorted order and advances turns for GM", async () => {
    const { url, rooms } = await startServer();
    const { room, code, gmInviteToken } = rooms.createRoom();
    const aria = rooms.createToken({ roomId: room.id, label: "Aria", x: 1, y: 1 });
    const goblin = rooms.createToken({ roomId: room.id, label: "Goblin", x: 2, y: 2 });

    const gm = connect(url);
    await waitConnected(gm);
    await join(gm, { code, role: "gm", pin: "1234", invite: gmInviteToken });

    const updated = nextInitiative(gm);
    gm.emit(ClientEvents.InitiativeSet, {
      order: [
        { tokenId: goblin.id, initiative: 10 },
        { tokenId: aria.id, initiative: 20 },
      ],
    });
    const first = await updated;
    expect(first.order.map((entry) => entry.label)).toEqual(["Aria", "Goblin"]);
    expect(first.activeIndex).toBe(0);
    expect(first.activeActionUsed).toBe(false);
    expect(first.activeBonusUsed).toBe(false);

    const next = nextInitiative(gm);
    gm.emit(ClientEvents.InitiativeNext);
    const second = await next;
    expect(second.activeIndex).toBe(1);
    expect(second.order[1]?.label).toBe("Goblin");
    expect(second.activeActionUsed).toBe(false);

    gm.close();
  });

  it("rolls initiative for all tokens on the active map", async () => {
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
      initiativeBonus: 3,
    });
    rooms.upsertCharacter({
      roomId: room.id,
      name: "Goblin",
      kind: "npc",
      mapIds: [map.id],
      initiativeBonus: 2,
    });
    rooms.setActiveMap(room.id, map.id);
    expect(rooms.listAllTokensOnActiveMap(room.id).length).toBe(2);

    const gm = connect(url);
    await waitConnected(gm);
    await join(gm, { code, role: "gm", pin: "1234", invite: gmInviteToken });

    const updated = nextInitiative(gm);
    gm.emit(ClientEvents.InitiativeRoll);
    const initiative = await updated;
    expect(initiative.order).toHaveLength(2);
    expect(initiative.activeIndex).toBe(0);
    expect(initiative.order.every((entry) => Number.isFinite(entry.initiative))).toBe(true);
    expect(rooms.getCharacter(aria.id)?.initiativeBonus).toBe(3);

    gm.close();
  });

  it("lets a player roll only their own character and rejects screen", async () => {
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
      initiativeBonus: 1,
    });
    const bolt = rooms.upsertCharacter({
      roomId: room.id,
      name: "Bolt",
      kind: "pc",
      mapIds: [map.id],
      initiativeBonus: 2,
    });
    rooms.setActiveMap(room.id, map.id);
    const ariaToken = rooms.listAllTokensOnActiveMap(room.id).find((token) => token.characterId === aria.id)!;
    const boltToken = rooms.listAllTokensOnActiveMap(room.id).find((token) => token.characterId === bolt.id)!;
    rooms.setInitiative(room.id, {
      order: [
        { tokenId: boltToken.id, label: "Bolt", initiative: 12, kind: "pc" },
        { tokenId: ariaToken.id, label: "Aria", initiative: 8, kind: "pc" },
      ],
      activeIndex: 0,
      round: 1,
      activeActionUsed: false,
      activeBonusUsed: false,
    });

    const gm = connect(url);
    await waitConnected(gm);
    await join(gm, { code, role: "gm", pin: "1234", invite: gmInviteToken });

    const player = connect(url);
    await waitConnected(player);
    await join(player, { code, role: "player", characterId: aria.id });

    const updated = nextInitiative(gm);
    player.emit(ClientEvents.InitiativeRollSelf);
    const after = await updated;
    const ariaEntry = after.order.find((entry) => entry.tokenId === ariaToken.id);
    expect(ariaEntry).toBeTruthy();
    expect(ariaEntry?.initiative).not.toBe(8);

    const screen = connect(url);
    await waitConnected(screen);
    await join(screen, { code, role: "screen" });
    const screenDenied = nextError(screen);
    screen.emit(ClientEvents.InitiativeRollSelf);
    await expect(screenDenied).resolves.toMatch(/Players only/);

    gm.close();
    player.close();
    screen.close();
  });

  it("resets turn flags on next and allows active player to end turn", async () => {
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
      speedCells: 6,
    });
    const goblin = rooms.upsertCharacter({
      roomId: room.id,
      name: "Goblin",
      kind: "npc",
      mapIds: [map.id],
    });
    const bolt = rooms.upsertCharacter({
      roomId: room.id,
      name: "Bolt",
      kind: "pc",
      mapIds: [map.id],
    });
    rooms.setActiveMap(room.id, map.id);
    const ariaToken = rooms.listAllTokensOnActiveMap(room.id).find((token) => token.characterId === aria.id)!;
    const goblinToken = rooms
      .listAllTokensOnActiveMap(room.id)
      .find((token) => token.characterId === goblin.id)!;
    rooms.setInitiative(room.id, {
      order: [
        { tokenId: ariaToken.id, label: "Aria", initiative: 20, kind: "pc" },
        { tokenId: goblinToken.id, label: "Goblin", initiative: 10, kind: "npc" },
      ],
      activeIndex: 0,
      round: 1,
      activeActionUsed: false,
      activeBonusUsed: false,
    });

    const gm = connect(url);
    await waitConnected(gm);
    await join(gm, { code, role: "gm", pin: "1234", invite: gmInviteToken });

    const player = connect(url);
    await waitConnected(player);
    await join(player, { code, role: "player", characterId: aria.id });

    const other = connect(url);
    await waitConnected(other);
    await join(other, { code, role: "player", characterId: bolt.id });

    const flagged = nextInitiative(gm);
    player.emit(ClientEvents.TurnAction, { used: true });
    const afterAction = await flagged;
    expect(afterAction.activeActionUsed).toBe(true);

    const bonusFlag = nextInitiative(gm);
    gm.emit(ClientEvents.TurnBonus, { used: true });
    expect((await bonusFlag).activeBonusUsed).toBe(true);

    const otherDenied = nextError(other);
    other.emit(ClientEvents.InitiativeNext);
    await expect(otherDenied).resolves.toMatch(/Not your turn/);

    const advanced = nextInitiative(gm);
    player.emit(ClientEvents.InitiativeNext);
    const next = await advanced;
    expect(next.activeIndex).toBe(1);
    expect(next.activeActionUsed).toBe(false);
    expect(next.activeBonusUsed).toBe(false);
    expect(next.activeMovementRemaining).toBe(6);

    const inactiveDenied = nextError(player);
    player.emit(ClientEvents.InitiativeNext);
    await expect(inactiveDenied).resolves.toMatch(/Not your turn/);

    gm.close();
    player.close();
    other.close();
  });
});
