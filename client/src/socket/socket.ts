import type { ClientToServerEvents, ServerToClientEvents } from "@dms/shared";
import { io, type Socket } from "socket.io-client";

export type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: AppSocket | null = null;

export function getSocket(): AppSocket {
  if (!socket) {
    socket = io("/", {
      autoConnect: true,
      transports: ["websocket", "polling"],
    });
  }
  return socket;
}
