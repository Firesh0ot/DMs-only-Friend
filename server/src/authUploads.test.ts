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

describe("room auth and upload gates", () => {
  it("creates a named room code and returns a single-use GM invite", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dms-auth-"));
    tempDirs.push(dir);
    const rooms = new RoomStore(openDb(path.join(dir, "test.sqlite")));
    const httpServer = http.createServer();
    const io = new Server(httpServer);
    const app = createHttpApp({
      rooms,
      uploadsDir: path.join(dir, "uploads"),
      io,
      publicOrigin: "http://localhost:5173",
    });

    const created = await request(app).post("/api/rooms").send({
      name: "Friday",
      code: "friday-table",
      pin: "2468",
    });
    expect(created.status).toBe(201);
    expect(created.body.code).toBe("FRIDAY-TABLE");
    expect(created.body.gmInviteUrl).toContain("role=gm&invite=");
    expect(created.body.gmUrl).toBeUndefined();

    const conflict = await request(app).post("/api/rooms").send({
      name: "Other",
      code: "FRIDAY-TABLE",
      pin: "9999",
    });
    expect(conflict.status).toBe(409);

    const links = await request(app).get("/api/rooms/FRIDAY-TABLE/links");
    expect(links.status).toBe(200);
    expect(links.body.screenUrl).toContain("role=screen");
    expect(links.body.playerUrl).toContain("role=player");
    expect(links.body.gmUrl).toBeUndefined();
    expect(links.body.gmInvitePending).toBe(true);
    expect(links.body.gmInviteRequired).toBe(true);
  });

  it("creates rooms with German umlaut codes and serves encoded links", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dms-umlaut-"));
    tempDirs.push(dir);
    const rooms = new RoomStore(openDb(path.join(dir, "test.sqlite")));
    const httpServer = http.createServer();
    const io = new Server(httpServer);
    const app = createHttpApp({
      rooms,
      uploadsDir: path.join(dir, "uploads"),
      io,
      publicOrigin: "http://localhost:5173",
    });

    const created = await request(app).post("/api/rooms").send({
      name: "Taverne",
      code: "dörfer",
      pin: "2468",
    });
    expect(created.status).toBe(201);
    expect(created.body.code).toBe("DÖRFER");
    expect(created.body.gmInviteUrl).toContain(`/room/${encodeURIComponent("DÖRFER")}?`);

    const rejected = await request(app).post("/api/rooms").send({
      name: "Bad",
      code: "kein raum",
      pin: "2468",
    });
    expect(rejected.status).toBe(400);

    const links = await request(app).get(`/api/rooms/${encodeURIComponent("DÖRFER")}/links`);
    expect(links.status).toBe(200);
    expect(links.body.code).toBe("DÖRFER");
  });

  it("rejects map upload without a GM upload token", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dms-upauth-"));
    tempDirs.push(dir);
    const rooms = new RoomStore(openDb(path.join(dir, "test.sqlite")));
    const { code } = rooms.createRoom({ name: "Upload", code: "UPLOAD1", pin: "1111" });
    const httpServer = http.createServer();
    const io = new Server(httpServer);
    const app = createHttpApp({
      rooms,
      uploadsDir: path.join(dir, "uploads"),
      io,
      publicOrigin: "http://localhost:5173",
    });
    const fixture = path.resolve(process.cwd(), "../fixtures/tiny-map-for-unit-tests.png");
    const denied = await request(app)
      .post(`/api/rooms/${code}/map`)
      .field("gridPx", "70")
      .attach("map", fixture);
    expect(denied.status).toBe(401);
  });
});
