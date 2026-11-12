import type { ClientToServerEvents, ServerToClientEvents } from "@dms/shared";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Server } from "socket.io";
import { openDb } from "./db.js";
import { registerSocketHandlers } from "./events/handlers.js";
import { createHttpApp } from "./http.js";
import { RoomStore } from "./rooms.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT ?? 3001);
const host = process.env.HOST ?? "0.0.0.0";
const publicOrigin = process.env.PUBLIC_ORIGIN ?? "http://localhost:5173";
const dataDir = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : undefined;
const uploadsDir =
  process.env.UPLOADS_DIR ??
  (dataDir ? path.join(dataDir, "uploads") : path.resolve(__dirname, "../uploads"));
const dbPath =
  process.env.DMS_DB_PATH ?? (dataDir ? path.join(dataDir, "dms.sqlite") : undefined);
const clientDist =
  process.env.CLIENT_DIST ?? path.resolve(__dirname, "../../client/dist");

const db = openDb(dbPath);
const rooms = new RoomStore(db);

const httpServer = http.createServer();
const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: { origin: "*" },
});

const app = createHttpApp({ rooms, uploadsDir, io, publicOrigin, clientDist });
httpServer.on("request", app);

registerSocketHandlers(io, rooms);

httpServer.listen(port, host, () => {
  console.log(`DMs-only-Friend server listening on http://${host}:${port}`);
});
