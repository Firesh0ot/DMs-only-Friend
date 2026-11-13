import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { Server } from "socket.io";
import request from "supertest";
import { openDb } from "./db.js";
import { createHttpApp } from "./http.js";
import { RoomStore } from "./rooms.js";

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe("map generate", () => {
  it("creates a procedural dungeon map for GM upload token", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dms-gen-"));
    tempDirs.push(dir);
    const db = openDb(path.join(dir, "test.sqlite"));
    const rooms = new RoomStore(db);
    const { room, code } = rooms.createRoom("Gen Table");
    const uploadToken = rooms.issueUploadToken(room.id);
    const uploadsDir = path.join(dir, "uploads");
    const httpServer = http.createServer();
    const io = new Server(httpServer);
    const app = createHttpApp({
      rooms,
      uploadsDir,
      io,
      publicOrigin: "http://localhost:5173",
    });

    const response = await request(app)
      .post(`/api/rooms/${code}/map/generate`)
      .set("X-Dms-Upload-Token", uploadToken)
      .send({ width: 20, height: 16, seed: 11, gridPx: 24, name: "Crypt" });

    expect(response.status).toBe(201);
    expect(response.body.map.name).toBe("Crypt");
    expect(response.body.map.gridPx).toBe(24);
    expect(response.body.map.walls.length).toBeGreaterThan(0);
    expect(response.body.seed).toBe(11);
    expect(response.body.roomCount).toBeGreaterThan(0);
    expect(rooms.listMaps(room.id)).toHaveLength(1);
  });
});
