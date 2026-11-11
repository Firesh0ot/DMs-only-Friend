import { ServerEvents } from "@dms/shared";
import cors from "cors";
import express, { type Express, type Request, type Response } from "express";
import multer from "multer";
import fs from "node:fs";
import path from "node:path";
import type { Server as IoServer } from "socket.io";
import { readImageSize } from "./imageSize.js";
import { roomChannel, type RoomStore } from "./rooms.js";

const ALLOWED_MIME = new Set(["image/png", "image/jpeg", "image/webp"]);

export type HttpDeps = {
  rooms: RoomStore;
  uploadsDir: string;
  io: IoServer;
  publicOrigin: string;
};

export function createHttpApp(deps: HttpDeps): Express {
  const app = express();
  app.use(cors());
  app.use(express.json());
  fs.mkdirSync(deps.uploadsDir, { recursive: true });
  app.use("/uploads", express.static(deps.uploadsDir));

  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, deps.uploadsDir),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase() || mimeToExt(file.mimetype);
      cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`);
    },
  });

  const upload = multer({
    storage,
    limits: { fileSize: 50 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      if (!ALLOWED_MIME.has(file.mimetype)) {
        cb(new Error("Only png/jpg/webp uploads are allowed"));
        return;
      }
      cb(null, true);
    },
  });

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.post("/api/rooms", (req, res) => {
    const name =
      typeof req.body?.name === "string" && req.body.name.trim()
        ? req.body.name.trim()
        : "Table";
    const { room, code } = deps.rooms.createRoom(name);
    const origin = deps.publicOrigin.replace(/\/$/, "");
    res.status(201).json({
      id: room.id,
      code,
      name: room.name,
      gmUrl: `${origin}/#/room/${code}?role=gm`,
      screenUrl: `${origin}/#/room/${code}?role=screen`,
      playerUrl: `${origin}/#/room/${code}?role=player`,
    });
  });

  app.get("/api/rooms/:code/links", (req, res) => {
    const room = deps.rooms.getRoomByCode(req.params.code ?? "");
    if (!room) {
      res.status(404).json({ error: "Room not found" });
      return;
    }
    const origin = deps.publicOrigin.replace(/\/$/, "");
    res.json({
      code: room.code,
      gmUrl: `${origin}/#/room/${room.code}?role=gm`,
      screenUrl: `${origin}/#/room/${room.code}?role=screen`,
      playerUrl: `${origin}/#/room/${room.code}?role=player`,
    });
  });

  app.post(
    "/api/rooms/:code/map",
    (req, res, next) => {
      upload.single("map")(req, res, (error) => {
        if (error) {
          res.status(400).json({ error: error.message });
          return;
        }
        next();
      });
    },
    (req: Request, res: Response) => {
      const room = deps.rooms.getRoomByCode(req.params.code ?? "");
      if (!room) {
        res.status(404).json({ error: "Room not found" });
        return;
      }
      if (!req.file) {
        res.status(400).json({ error: "Missing map file" });
        return;
      }

      const gridPxRaw = req.body?.gridPx ?? req.body?.grid_px ?? "70";
      const gridPx = Number(gridPxRaw);
      if (!Number.isInteger(gridPx) || gridPx < 8 || gridPx > 512) {
        fs.unlinkSync(req.file.path);
        res.status(400).json({ error: "gridPx must be an integer between 8 and 512" });
        return;
      }

      const displayName =
        typeof req.body?.name === "string" && req.body.name.trim()
          ? req.body.name.trim()
          : path.parse(req.file.originalname).name || "Map";

      try {
        const previousActive = deps.rooms.getActiveMap(room.id);
        const size = readImageSize(req.file.path, req.file.mimetype);
        const map = deps.rooms.addMap(room.id, {
          name: displayName,
          filename: req.file.filename,
          width: size.width,
          height: size.height,
          gridPx,
        });
        deps.rooms.syncTokensForActiveMap(room.id);
        const active = deps.rooms.getActiveMap(room.id);
        deps.io.to(roomChannel(room.id)).emit(ServerEvents.MapsUpdated, deps.rooms.listMaps(room.id));
        deps.io.to(roomChannel(room.id)).emit(ServerEvents.MapSet, active);
        deps.io
          .to(roomChannel(room.id))
          .emit(ServerEvents.TokensSynced, deps.rooms.listVisibleTokens(room.id));
        if (active && previousActive?.id !== active.id) {
          const event = deps.rooms.appendEvent({
            roomId: room.id,
            type: "map_change",
            summary: `Map: ${active.name}`,
            payload: { mapId: active.id, name: active.name },
          });
          deps.io.to(roomChannel(room.id)).emit(ServerEvents.LogAppended, event);
        }
        res.status(201).json({ map, maps: deps.rooms.listMaps(room.id) });
      } catch (error) {
        fs.unlinkSync(req.file.path);
        const message = error instanceof Error ? error.message : "Upload failed";
        res.status(400).json({ error: message });
      }
    },
  );

  return app;
}

function mimeToExt(mime: string): string {
  switch (mime) {
    case "image/png":
      return ".png";
    case "image/jpeg":
      return ".jpg";
    case "image/webp":
      return ".webp";
    default:
      return "";
  }
}
