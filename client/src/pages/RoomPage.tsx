import { useEffect, useMemo } from "react";
import { ClientEvents, type CameraState, type Role } from "@dms/shared";
import { MapCanvas } from "../canvas/MapCanvas";
import { GmToolbar } from "../components/GmToolbar";
import { InitiativeBanner } from "../components/InitiativeBanner";
import { InitiativePanel } from "../components/InitiativePanel";
import { getSocket } from "../socket/socket";
import { useRoomStore } from "../state/roomStore";

type Props = {
  code: string;
  role: Role;
  name: string | null;
};

export function RoomPage({ code, role, name }: Props) {
  const joinRoom = useRoomStore((state) => state.joinRoom);
  const snapshot = useRoomStore((state) => state.snapshot);
  const optimisticTokens = useRoomStore((state) => state.optimisticTokens);
  const joining = useRoomStore((state) => state.joining);
  const error = useRoomStore((state) => state.error);
  const connected = useRoomStore((state) => state.connected);
  const moveTokenOptimistic = useRoomStore((state) => state.moveTokenOptimistic);

  const tokens = useMemo(() => {
    if (!snapshot) {
      return [];
    }
    return snapshot.tokens.map((token) => optimisticTokens[token.id] ?? token);
  }, [snapshot, optimisticTokens]);

  useEffect(() => {
    void joinRoom(code, role, name ?? undefined);
  }, [code, role, name, joinRoom]);

  const activeTokenId = useMemo(() => {
    const initiative = snapshot?.initiative;
    if (!initiative || initiative.order.length === 0) {
      return null;
    }
    return initiative.order[initiative.activeIndex]?.tokenId ?? null;
  }, [snapshot?.initiative]);

  function onTokenMove(tokenId: string, x: number, y: number) {
    moveTokenOptimistic(tokenId, x, y);
    getSocket().emit(ClientEvents.TokenMove, { tokenId, x, y });
  }

  function onCameraChange(camera: CameraState) {
    if (role !== "gm") {
      return;
    }
    getSocket().emit(ClientEvents.CameraSet, camera);
  }

  return (
    <main className="app-shell">
      <p className="muted">
        {connected ? "Connected" : "Connecting…"} · role <strong>{role}</strong>
        {snapshot?.playerName ? ` · ${snapshot.playerName}` : ""}
      </p>
      <h1 className="brand">Room {code}</h1>
      {joining ? <p className="lede">Joining room…</p> : null}
      {error ? <p className="error">{error}</p> : null}

      {snapshot ? (
        <div className="room-layout">
          <div className="stack">
            {role === "gm" ? (
              <>
                <GmToolbar code={code} tokens={tokens} gridPx={snapshot.map?.gridPx ?? 70} />
                <InitiativePanel tokens={tokens} initiative={snapshot.initiative} />
              </>
            ) : (
              <section className="panel stack">
                <h2>{role === "screen" ? "Player screen" : "Player view"}</h2>
                <p className="muted">
                  Camera follows the GM.{" "}
                  {role === "player"
                    ? "Drag only your own token (matching your name)."
                    : "Watch-only tokens."}
                </p>
                <a href="#/">Back home</a>
              </section>
            )}
          </div>

          <section className="stack">
            <InitiativeBanner initiative={snapshot.initiative} />
            {!snapshot.map ? (
              <p className="lede">Waiting for the GM to upload a map…</p>
            ) : null}
            <MapCanvas
              map={snapshot.map}
              tokens={tokens}
              camera={snapshot.camera}
              role={role}
              playerName={snapshot.playerName}
              activeTokenId={activeTokenId}
              onTokenMove={onTokenMove}
              onCameraChange={onCameraChange}
            />
          </section>
        </div>
      ) : null}
    </main>
  );
}
