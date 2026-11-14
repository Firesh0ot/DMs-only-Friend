import {
  RoomCreatePayloadSchema,
  ServerEvents,
  normalizeRoomCode,
  roomCodePathSegment,
} from "@dms/shared";
import cors from "cors";
import express, { type Express, type NextFunction, type Request, type Response } from "express";
import multer from "multer";
import fs from "node:fs";
import path from "node:path";
import type { Server as IoServer } from "socket.io";
import { isDd2vttUpload, parseDd2vtt } from "./dd2vtt.js";
import { generateDungeonDd2vtt } from "./dungeon/toDd2vtt.js";
import { emitCharactersUpdated } from "./events/handlers.js";
import { readImageSize } from "./imageSize.js";
import {
  basenamesMatch,
  isAllowedImageUpload,
  isMapPackageUpload,
  isWebmUpload,
  parseMapPackageManifest,
} from "./mapPackage.js";
import { roomChannel, type RoomStore } from "./rooms.js";

const ALLOWED_IMAGE_MIME = new Set(["image/png", "image/jpeg", "image/webp"]);

type UploadedFile = {
  path: string;
  filename: string;
  originalname: string;
  mimetype: string;
};

type MulterFiles = Partial<Record<string, UploadedFile[]>>;

export type HttpDeps = {
  rooms: RoomStore;
  uploadsDir: string;
  io: IoServer;
  publicOrigin: string;
  clientDist?: string;
};

type AuthedRequest = Request & { dmsRoomId?: string };

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
      if (
        isDd2vttUpload(file) ||
        isWebmUpload(file) ||
        isMapPackageUpload(file) ||
        isAllowedImageUpload(file)
      ) {
        cb(null, true);
        return;
      }
      cb(new Error("Only png/jpg/webp/.dd2vtt/.webm or .dmsmap.json/.map.json uploads are allowed"));
    },
  });

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.post("/api/rooms", (req, res) => {
    try {
      const parsed = RoomCreatePayloadSchema.parse(req.body ?? {});
      const { room, code, gmInviteToken } = deps.rooms.createRoom({
        name: parsed.name?.trim() || "Table",
        code: parsed.code,
        pin: parsed.pin,
      });
      const origin = deps.publicOrigin.replace(/\/$/, "");
      const pathCode = roomCodePathSegment(code);
      res.status(201).json({
        id: room.id,
        code,
        name: room.name,
        gmInviteUrl: `${origin}/#/room/${pathCode}?role=gm&invite=${encodeURIComponent(gmInviteToken)}`,
        screenUrl: `${origin}/#/room/${pathCode}?role=screen`,
        playerUrl: `${origin}/#/room/${pathCode}?role=player`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not create room";
      const status = message.includes("already taken") ? 409 : 400;
      res.status(status).json({ error: message });
    }
  });

  app.get("/api/rooms/:code/links", (req, res) => {
    const room = deps.rooms.getRoomByCode(req.params.code ?? "");
    if (!room) {
      res.status(404).json({ error: "Room not found" });
      return;
    }
    const origin = deps.publicOrigin.replace(/\/$/, "");
    const pathCode = roomCodePathSegment(room.code);
    res.json({
      code: room.code,
      screenUrl: `${origin}/#/room/${pathCode}?role=screen`,
      playerUrl: `${origin}/#/room/${pathCode}?role=player`,
      gmInvitePending: deps.rooms.hasPendingGmInvite(room.id),
      gmInviteRequired: deps.rooms.requiresGmInvite(room.id),
    });
  });

  app.post("/api/rooms/:code/gm-invite", (req, res) => {
    const room = deps.rooms.getRoomByCode(req.params.code ?? "");
    if (!room) {
      res.status(404).json({ error: "Room not found" });
      return;
    }
    const pin = typeof req.body?.pin === "string" ? req.body.pin : "";
    try {
      const invite = deps.rooms.mintGmInviteWithPin(room.id, pin);
      const origin = deps.publicOrigin.replace(/\/$/, "");
      const pathCode = roomCodePathSegment(room.code);
      res.status(201).json({
        code: room.code,
        gmInviteUrl: `${origin}/#/room/${pathCode}?role=gm&invite=${encodeURIComponent(invite)}`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not mint invite";
      res.status(401).json({ error: message });
    }
  });

  const requireGmUpload = (req: AuthedRequest, res: Response, next: NextFunction) => {
    const room = deps.rooms.getRoomByCode(normalizeRoomCode(req.params.code ?? ""));
    if (!room) {
      res.status(404).json({ error: "Room not found" });
      return;
    }
    const header = req.header("x-dms-upload-token") ?? "";
    if (!header || !deps.rooms.validateUploadToken(header, room.id)) {
      res.status(401).json({ error: "GM upload token required" });
      return;
    }
    req.dmsRoomId = room.id;
    next();
  };

  app.post(
    "/api/rooms/:code/map",
    requireGmUpload,
    (req, res, next) => {
      upload.fields([
        { name: "map", maxCount: 1 },
        { name: "dd2vtt", maxCount: 1 },
        { name: "image", maxCount: 1 },
        { name: "animated", maxCount: 1 },
        { name: "webm", maxCount: 1 },
      ])(req, res, (error) => {
        if (error) {
          res.status(400).json({ error: error.message });
          return;
        }
        next();
      });
    },
    (req: AuthedRequest, res: Response) => {
      const roomId = req.dmsRoomId;
      if (!roomId) {
        res.status(401).json({ error: "GM upload token required" });
        return;
      }
      const room = deps.rooms.getRoomById(roomId);
      if (!room) {
        res.status(404).json({ error: "Room not found" });
        return;
      }

      const files = (req.files ?? {}) as MulterFiles;
      const uploaded = collectUploadedFiles(files);
      const mapFile = files.map?.[0];
      if (!mapFile) {
        cleanupUploadedFiles(uploaded);
        res.status(400).json({ error: "Missing map file" });
        return;
      }

      try {
        const resolved = resolveMapUpload({
          mapFile,
          files,
          uploadsDir: deps.uploadsDir,
          body: req.body ?? {},
        });
        const previousActive = deps.rooms.getActiveMap(room.id);
        const map = deps.rooms.addMap(room.id, {
          name: resolved.name,
          filename: resolved.filename,
          animatedFilename: resolved.animatedFilename,
          width: resolved.width,
          height: resolved.height,
          gridPx: resolved.gridPx,
          offsetX: resolved.offsetX,
          offsetY: resolved.offsetY,
          walls: resolved.walls,
          portals: resolved.portals,
          lights: resolved.lights,
        });
        deps.rooms.syncTokensForActiveMap(room.id);
        const active = deps.rooms.getActiveMap(room.id);
        deps.io.to(roomChannel(room.id)).emit(ServerEvents.MapsUpdated, deps.rooms.listMaps(room.id));
        deps.io.to(roomChannel(room.id)).emit(ServerEvents.MapSet, active);
        deps.io
          .to(roomChannel(room.id))
          .emit(ServerEvents.TokensSynced, deps.rooms.listVisibleTokens(room.id));
        deps.io
          .to(roomChannel(room.id))
          .emit(ServerEvents.FogUpdated, deps.rooms.getActiveFog(room.id));
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
        cleanupUploadedFiles(uploaded);
        const message = error instanceof Error ? error.message : "Upload failed";
        res.status(400).json({ error: message });
      }
    },
  );

  app.post("/api/rooms/:code/map/generate", requireGmUpload, (req: AuthedRequest, res: Response) => {
    const roomId = req.dmsRoomId;
    if (!roomId) {
      res.status(401).json({ error: "GM upload token required" });
      return;
    }
    const room = deps.rooms.getRoomById(roomId);
    if (!room) {
      res.status(404).json({ error: "Room not found" });
      return;
    }

    try {
      const body = (req.body ?? {}) as {
        width?: number;
        height?: number;
        seed?: number;
        gridPx?: number;
        name?: string;
      };
      const generated = generateDungeonDd2vtt({
        width: body.width,
        height: body.height,
        seed: body.seed,
        gridPx: body.gridPx,
      });
      const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`;
      fs.writeFileSync(path.join(deps.uploadsDir, filename), generated.imageBuffer);
      const displayName =
        typeof body.name === "string" && body.name.trim()
          ? body.name.trim()
          : `Generated dungeon (${generated.seed})`;
      const previousActive = deps.rooms.getActiveMap(room.id);
      const map = deps.rooms.addMap(room.id, {
        name: displayName,
        filename,
        width: generated.widthPx,
        height: generated.heightPx,
        gridPx: generated.gridPx,
        offsetX: 0,
        offsetY: 0,
        walls: generated.walls,
        portals: [],
        lights: parseDd2vtt(generated.dd2vttJson).lights,
      });
      deps.rooms.syncTokensForActiveMap(room.id);
      const active = deps.rooms.getActiveMap(room.id);
      deps.io.to(roomChannel(room.id)).emit(ServerEvents.MapsUpdated, deps.rooms.listMaps(room.id));
      deps.io.to(roomChannel(room.id)).emit(ServerEvents.MapSet, active);
      deps.io
        .to(roomChannel(room.id))
        .emit(ServerEvents.TokensSynced, deps.rooms.listVisibleTokens(room.id));
      deps.io
        .to(roomChannel(room.id))
        .emit(ServerEvents.FogUpdated, deps.rooms.getActiveFog(room.id));
      if (active && previousActive?.id !== active.id) {
        const event = deps.rooms.appendEvent({
          roomId: room.id,
          type: "map_change",
          summary: `Map: ${active.name}`,
          payload: {
            mapId: active.id,
            name: active.name,
            generated: true,
            seed: generated.seed,
          },
        });
        deps.io.to(roomChannel(room.id)).emit(ServerEvents.LogAppended, event);
      }
      res.status(201).json({
        map,
        maps: deps.rooms.listMaps(room.id),
        seed: generated.seed,
        roomCount: generated.roomCount,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Generate failed";
      res.status(400).json({ error: message });
    }
  });

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
    requireGmUpload,
    (req, res, next) => {
      portraitUpload.single("portrait")(req, res, (error) => {
        if (error) {
          res.status(400).json({ error: error.message });
          return;
        }
        next();
      });
    },
    (req: AuthedRequest, res: Response) => {
      const roomId = req.dmsRoomId;
      if (!roomId) {
        res.status(401).json({ error: "GM upload token required" });
        return;
      }
      const room = deps.rooms.getRoomById(roomId);
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

  if (deps.clientDist && fs.existsSync(deps.clientDist)) {
    app.use(express.static(deps.clientDist));
    app.get("*", (req, res, next) => {
      if (req.method !== "GET" && req.method !== "HEAD") {
        next();
        return;
      }
      if (req.path.startsWith("/api") || req.path.startsWith("/uploads")) {
        next();
        return;
      }
      res.sendFile(path.join(deps.clientDist!, "index.html"));
    });
  }

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
    case "video/webm":
      return ".webm";
    case "application/json":
      return ".json";
    default:
      return "";
  }
}

type MaterializedMap = {
  filename: string;
  width: number;
  height: number;
  gridPx: number;
  offsetX: number;
  offsetY: number;
  walls: Array<Array<{ x: number; y: number }>>;
  portals: Array<{
    id: string;
    bounds: [{ x: number; y: number }, { x: number; y: number }];
    closed: boolean;
    freestanding: boolean;
  }>;
  lights: Array<{
    id: string;
    position: { x: number; y: number };
    range: number;
    intensity: number;
    color: string;
    shadows: boolean;
  }>;
};

type ResolvedMapUpload = MaterializedMap & {
  name: string;
  animatedFilename: string | null;
};

function collectUploadedFiles(files: MulterFiles): UploadedFile[] {
  return Object.values(files).flatMap((entries) => entries ?? []);
}

function cleanupUploadedFiles(files: UploadedFile[]): void {
  for (const file of files) {
    if (fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }
  }
}

function optionalWebm(files: MulterFiles): UploadedFile | null {
  const candidate = files.animated?.[0] ?? files.webm?.[0] ?? null;
  if (!candidate) {
    return null;
  }
  if (!isWebmUpload(candidate)) {
    throw new Error("Animated layer must be a .webm file");
  }
  return candidate;
}

function resolveMapUpload(input: {
  mapFile: UploadedFile;
  files: MulterFiles;
  uploadsDir: string;
  body: { name?: string; gridPx?: string; grid_px?: string };
}): ResolvedMapUpload {
  const bodyName =
    typeof input.body?.name === "string" && input.body.name.trim()
      ? input.body.name.trim()
      : null;

  if (isMapPackageUpload(input.mapFile)) {
    const manifest = parseMapPackageManifest(fs.readFileSync(input.mapFile.path));
    fs.unlinkSync(input.mapFile.path);

    const baseFile = manifest.dd2vtt ? input.files.dd2vtt?.[0] : input.files.image?.[0];
    if (!baseFile) {
      throw new Error(
        manifest.dd2vtt
          ? "Map package requires a dd2vtt multipart field"
          : "Map package requires an image multipart field",
      );
    }
    const expectedBase = manifest.dd2vtt ?? manifest.image;
    if (!expectedBase || !basenamesMatch(expectedBase, baseFile.originalname)) {
      throw new Error(`Map package base file must be named ${expectedBase}`);
    }
    if (manifest.dd2vtt && !isDd2vttUpload(baseFile)) {
      throw new Error("Map package dd2vtt field must be a .dd2vtt/.uvtt file");
    }
    if (manifest.image && !isAllowedImageUpload(baseFile)) {
      throw new Error("Map package image field must be png/jpg/webp");
    }

    const gridBody = {
      gridPx:
        manifest.gridPx !== undefined
          ? String(manifest.gridPx)
          : (input.body.gridPx ?? input.body.grid_px),
      grid_px: input.body.grid_px,
    };
    const stored = materializeUploadedMap(baseFile, input.uploadsDir, gridBody);

    let animatedFilename: string | null = null;
    const webm = optionalWebm(input.files);
    if (manifest.webm) {
      if (!webm) {
        throw new Error("Map package lists webm but no animated/webm file was uploaded");
      }
      if (!basenamesMatch(manifest.webm, webm.originalname)) {
        throw new Error(`Map package webm file must be named ${manifest.webm}`);
      }
      animatedFilename = webm.filename;
    } else if (webm) {
      throw new Error("Unexpected webm upload; omit it or list it in the map package manifest");
    }

    const packageFallback = path.parse(expectedBase).name || "Map";
    return {
      ...stored,
      name: bodyName ?? manifest.name ?? packageFallback,
      animatedFilename,
    };
  }

  if (isWebmUpload(input.mapFile)) {
    throw new Error("Upload a base map (or .dmsmap.json package) and attach WebM as animated/webm");
  }

  const stored = materializeUploadedMap(input.mapFile, input.uploadsDir, input.body);
  const webm = optionalWebm(input.files);
  const fallbackName = path.parse(input.mapFile.originalname).name || "Map";
  return {
    ...stored,
    name: bodyName ?? fallbackName,
    animatedFilename: webm?.filename ?? null,
  };
}

function materializeUploadedMap(
  file: UploadedFile,
  uploadsDir: string,
  body: { gridPx?: string; grid_px?: string },
): MaterializedMap {
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
      portals: parsed.portals,
      lights: parsed.lights,
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
    portals: [],
    lights: [],
  };
}
