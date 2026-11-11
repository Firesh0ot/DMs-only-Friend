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

describe("map upload", () => {
  it("stores a PNG map and returns map state", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dms-map-"));
    tempDirs.push(dir);
    const db = openDb(path.join(dir, "test.sqlite"));
    const rooms = new RoomStore(db);
    const { code } = rooms.createRoom("Upload Table");
    const uploadsDir = path.join(dir, "uploads");
    const httpServer = http.createServer();
    const io = new Server(httpServer);
    const app = createHttpApp({
      rooms,
      uploadsDir,
      io,
      publicOrigin: "http://localhost:5173",
    });

    const fixture = path.resolve(process.cwd(), "../fixtures/tiny-map-for-unit-tests.png");
    const response = await request(app)
      .post(`/api/rooms/${code}/map`)
      .field("gridPx", "70")
      .attach("map", fixture);

    expect(response.status).toBe(201);
    expect(response.body.map.gridPx).toBe(70);
    expect(response.body.map.width).toBe(140);
    expect(response.body.map.height).toBe(70);
    expect(response.body.map.walls).toEqual([]);
    expect(rooms.getMap(rooms.getRoomByCode(code)!.id)?.filename).toBeTruthy();
  });

  it("imports a .dd2vtt map with embedded grid and walls", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dms-dd2vtt-"));
    tempDirs.push(dir);
    const db = openDb(path.join(dir, "test.sqlite"));
    const rooms = new RoomStore(db);
    const { code } = rooms.createRoom("UVTT Table");
    const uploadsDir = path.join(dir, "uploads");
    const httpServer = http.createServer();
    const io = new Server(httpServer);
    const app = createHttpApp({
      rooms,
      uploadsDir,
      io,
      publicOrigin: "http://localhost:5173",
    });

    const fixture = path.resolve(process.cwd(), "../fixtures/tiny-map-for-unit-tests.dd2vtt");
    const response = await request(app)
      .post(`/api/rooms/${code}/map`)
      .field("gridPx", "40")
      .attach("map", fixture);

    expect(response.status).toBe(201);
    expect(response.body.map.gridPx).toBe(70);
    expect(response.body.map.width).toBe(140);
    expect(response.body.map.height).toBe(70);
    expect(response.body.map.walls).toHaveLength(2);
    expect(response.body.map.filename).toMatch(/\.png$/);
    const stored = rooms.getMap(rooms.getRoomByCode(code)!.id);
    expect(stored?.walls[0]?.length).toBeGreaterThanOrEqual(2);
    expect(fs.existsSync(path.join(uploadsDir, stored!.filename))).toBe(true);
  });
});
