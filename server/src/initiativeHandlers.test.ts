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

function connect(url: string): ClientSocket<ServerToClientEvents, ClientToServerEvents> {
  return ioc(url, { transports: ["websocket"], forceNew: true });
}

describe("initiative socket handlers", () => {
  it("sets sorted order and advances turns for GM", async () => {
    const { url, rooms } = await startServer();
    const { room, code, gmInviteToken } = rooms.createRoom();
    const aria = rooms.createToken({ roomId: room.id, label: "Aria", x: 1, y: 1 });
    const goblin = rooms.createToken({ roomId: room.id, label: "Goblin", x: 2, y: 2 });

    const gm = connect(url);
    await new Promise<void>((resolve, reject) => {
      gm.on("connect", () => resolve());
      gm.on("connect_error", reject);
    });

    await new Promise<void>((resolve, reject) => {
      gm.emit(
        ClientEvents.RoomJoin,
        { code, role: "gm", pin: "1234", invite: gmInviteToken },
        (result) => {
          if (!result.ok) {
            reject(new Error(result.error));
            return;
          }
          resolve();
        },
      );
    });

    const updated = new Promise((resolve) => {
      gm.once(ServerEvents.InitiativeUpdated, resolve);
    });
    gm.emit(ClientEvents.InitiativeSet, {
      order: [
        { tokenId: goblin.id, initiative: 10 },
        { tokenId: aria.id, initiative: 20 },
      ],
    });
    const first = (await updated) as {
      order: Array<{ label: string }>;
      activeIndex: number;
    };
    expect(first.order.map((entry) => entry.label)).toEqual(["Aria", "Goblin"]);
    expect(first.activeIndex).toBe(0);

    const next = new Promise((resolve) => {
      gm.once(ServerEvents.InitiativeUpdated, resolve);
    });
    gm.emit(ClientEvents.InitiativeNext);
    const second = (await next) as { activeIndex: number; order: Array<{ label: string }> };
    expect(second.activeIndex).toBe(1);
    expect(second.order[1]?.label).toBe("Goblin");

    gm.close();
  });
});
