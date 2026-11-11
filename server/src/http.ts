import { ServerEvents } from "@dms/shared";
import cors from "cors";
import express, { type Express, type Request, type Response } from "express";
import multer from "multer";
import fs from "node:fs";
import path from "node:path";
import type { Server as IoServer } from "socket.io";
import { isDd2vttUpload, parseDd2vtt } from "./dd2vtt.js";
import { emitCharactersUpdated } from "./events/handlers.js";
import { readImageSize } from "./imageSize.js";
import { roomChannel, type RoomStore } from "./rooms.js";

const ALLOWED_IMAGE_MIME = new Set(["image/png", "image/jpeg", "image/webp"]);

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
      if (isDd2vttUpload(file) || ALLOWED_IMAGE_MIME.has(file.mimetype)) {
        cb(null, true);
        return;
      }
      cb(new Error("Only png/jpg/webp or .dd2vtt uploads are allowed"));
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

      const displayName =
        typeof req.body?.name === "string" && req.body.name.trim()
          ? req.body.name.trim()
          : path.parse(req.file.originalname).name || "Map";

      try {
        const previousActive = deps.rooms.getActiveMap(room.id);
        const stored = materializeUploadedMap(req.file, deps.uploadsDir, req.body);
        const map = deps.rooms.addMap(room.id, {
          name: displayName,
          filename: stored.filename,
          width: stored.width,
          height: stored.height,
          gridPx: stored.gridPx,
          offsetX: stored.offsetX,
          offsetY: stored.offsetY,
          walls: stored.walls,
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
        if (req.file && fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
        const message = error instanceof Error ? error.message : "Upload failed";
        res.status(400).json({ error: message });
      }
    },
  );

  const portraitUpload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      if (!ALLOWED_IMAGE_MIME.has(file.mimetype)) {
        cb(new Error("Only png/jpg/webp uploads are allowed"));
        return;
      }
      cb(null, true);
    },
  });

  app.post(
    "/api/rooms/:code/characters/:characterId/portrait",
    (req, res, next) => {
      portraitUpload.single("portrait")(req, res, (error) => {
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
      const characterId = req.params.characterId ?? "";
      const character = deps.rooms.getCharacter(characterId);
      if (!character || character.roomId !== room.id) {
        if (req.file) {
          fs.unlinkSync(req.file.path);
        }
        res.status(404).json({ error: "Character not found" });
        return;
      }
      if (!req.file) {
        res.status(400).json({ error: "Missing portrait file" });
        return;
      }

      try {
        readImageSize(req.file.path, req.file.mimetype);
        const imageUrl = `/uploads/${req.file.filename}`;
        const updated = deps.rooms.setCharacterPortrait(characterId, imageUrl);
        const initiative = deps.rooms.getInitiative(room.id);
        emitCharactersUpdated(deps.io, deps.rooms, room.id);
        deps.io
          .to(roomChannel(room.id))
          .emit(ServerEvents.TokensSynced, deps.rooms.listVisibleTokens(room.id));
        if (initiative) {
          deps.io.to(roomChannel(room.id)).emit(ServerEvents.InitiativeUpdated, initiative);
        }
        res.status(201).json({ character: updated });
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

function materializeUploadedMap(
  file: { path: string; filename: string; originalname: string; mimetype: string },
  uploadsDir: string,
  body: { gridPx?: string; grid_px?: string },
): {
  filename: string;
  width: number;
  height: number;
  gridPx: number;
  offsetX: number;
  offsetY: number;
  walls: Array<Array<{ x: number; y: number }>>;
} {
  if (isDd2vttUpload(file)) {
    const parsed = parseDd2vtt(fs.readFileSync(file.path));
    const imageName = `${path.parse(file.filename).name}${parsed.imageExt}`;
    const imagePath = path.join(uploadsDir, imageName);
    fs.writeFileSync(imagePath, parsed.imageBuffer);
    fs.unlinkSync(file.path);
    const size = readImageSize(imagePath, parsed.mime);
    return {
      filename: imageName,
      width: size.width,
      height: size.height,
      gridPx: parsed.gridPx,
      offsetX: parsed.offsetX,
      offsetY: parsed.offsetY,
      walls: parsed.walls,
    };
  }

  const gridPxRaw = body?.gridPx ?? body?.grid_px ?? "70";
  const gridPx = Number(gridPxRaw);
  if (!Number.isInteger(gridPx) || gridPx < 8 || gridPx > 512) {
    throw new Error("gridPx must be an integer between 8 and 512");
  }
  const size = readImageSize(file.path, file.mimetype);
  return {
    filename: file.filename,
    width: size.width,
    height: size.height,
    gridPx,
    offsetX: 0,
    offsetY: 0,
    walls: [],
  };
}
