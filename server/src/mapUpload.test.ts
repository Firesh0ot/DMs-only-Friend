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
    const { room, code } = rooms.createRoom("Upload Table");
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

    const fixture = path.resolve(process.cwd(), "../fixtures/tiny-map-for-unit-tests.png");
    const response = await request(app)
      .post(`/api/rooms/${code}/map`)
      .set("X-Dms-Upload-Token", uploadToken)
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
    const { room, code } = rooms.createRoom("UVTT Table");
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

    const fixture = path.resolve(process.cwd(), "../fixtures/tiny-map-for-unit-tests.dd2vtt");
    const response = await request(app)
      .post(`/api/rooms/${code}/map`)
      .set("X-Dms-Upload-Token", uploadToken)
      .field("gridPx", "40")
      .attach("map", fixture);

    expect(response.status).toBe(201);
    expect(response.body.map.gridPx).toBe(70);
    expect(response.body.map.width).toBe(140);
    expect(response.body.map.height).toBe(70);
    expect(response.body.map.walls).toHaveLength(2);
    expect(response.body.map.portals).toEqual([]);
    expect(response.body.map.lights).toHaveLength(1);
    expect(response.body.map.lights[0]).toMatchObject({
      id: "light-0",
      color: "eccd8b",
      range: 1.5,
      intensity: 0.8,
    });
    expect(response.body.map.filename).toMatch(/\.png$/);
    const stored = rooms.getMap(rooms.getRoomByCode(code)!.id);
    expect(stored?.walls[0]?.length).toBeGreaterThanOrEqual(2);
    expect(stored?.portals).toEqual([]);
    expect(stored?.lights).toHaveLength(1);
    expect(fs.existsSync(path.join(uploadsDir, stored!.filename))).toBe(true);
  });

  it("stores an optional WebM animated layer with a PNG map", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dms-webm-"));
    tempDirs.push(dir);
    const db = openDb(path.join(dir, "test.sqlite"));
    const rooms = new RoomStore(db);
    const { room, code } = rooms.createRoom("WebM Table");
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

    const image = path.resolve(process.cwd(), "../fixtures/tiny-map-for-unit-tests.png");
    const webm = path.resolve(process.cwd(), "../fixtures/tiny-map-for-unit-tests.webm");
    const response = await request(app)
      .post(`/api/rooms/${code}/map`)
      .set("X-Dms-Upload-Token", uploadToken)
      .field("gridPx", "70")
      .attach("map", image)
      .attach("animated", webm);

    expect(response.status).toBe(201);
    expect(response.body.map.animatedFilename).toMatch(/\.webm$/);
    expect(fs.existsSync(path.join(uploadsDir, response.body.map.animatedFilename))).toBe(true);
    expect(fs.existsSync(path.join(uploadsDir, response.body.map.filename))).toBe(true);
  });

  it("imports a map package manifest with dd2vtt + webm", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dms-package-"));
    tempDirs.push(dir);
    const db = openDb(path.join(dir, "test.sqlite"));
    const rooms = new RoomStore(db);
    const { room, code } = rooms.createRoom("Package Table");
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

    const manifest = path.resolve(
      process.cwd(),
      "../fixtures/tiny-map-package-for-unit-tests.dmsmap.json",
    );
    const dd2vtt = path.resolve(process.cwd(), "../fixtures/tiny-map-for-unit-tests.dd2vtt");
    const webm = path.resolve(process.cwd(), "../fixtures/tiny-map-for-unit-tests.webm");
    const response = await request(app)
      .post(`/api/rooms/${code}/map`)
      .set("X-Dms-Upload-Token", uploadToken)
      .attach("map", manifest)
      .attach("dd2vtt", dd2vtt)
      .attach("animated", webm);

    expect(response.status).toBe(201);
    expect(response.body.map.name).toBe("Tiny animated package");
    expect(response.body.map.filename).toMatch(/\.png$/);
    expect(response.body.map.animatedFilename).toMatch(/\.webm$/);
    expect(response.body.map.walls).toHaveLength(2);
    expect(fs.existsSync(path.join(uploadsDir, response.body.map.animatedFilename))).toBe(true);
  });

  it("imports portals from the dungeon .dd2vtt fixture", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dms-dd2vtt-portals-"));
    tempDirs.push(dir);
    const db = openDb(path.join(dir, "test.sqlite"));
    const rooms = new RoomStore(db);
    const { room, code } = rooms.createRoom("Portal Table");
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

    const fixture = path.resolve(process.cwd(), "../fixtures/dungeon-map-for-testing.dd2vtt");
    const response = await request(app)
      .post(`/api/rooms/${code}/map`)
      .set("X-Dms-Upload-Token", uploadToken)
      .attach("map", fixture);

    expect(response.status).toBe(201);
    expect(response.body.map.portals.length).toBe(5);
    expect(response.body.map.portals[0].closed).toBe(true);
    const toggled = rooms.setPortalClosed(
      room.id,
      response.body.map.id,
      response.body.map.portals[0].id,
      false,
    );
    expect(toggled.portals[0]?.closed).toBe(false);
  });
});
