import { useEffect } from "react";
import type { Role } from "@dms/shared";
import { useRoomStore } from "../state/roomStore";

type Props = {
  code: string;
  role: Role;
  name: string | null;
};

export function RoomPage({ code, role, name }: Props) {
  const joinRoom = useRoomStore((state) => state.joinRoom);
  const snapshot = useRoomStore((state) => state.snapshot);
  const joining = useRoomStore((state) => state.joining);
  const error = useRoomStore((state) => state.error);
  const connected = useRoomStore((state) => state.connected);

  useEffect(() => {
    void joinRoom(code, role, name ?? undefined);
  }, [code, role, name, joinRoom]);

  return (
    <main className="app-shell">
      <p className="muted">
        {connected ? "Connected" : "Connecting…"} · role <strong>{role}</strong>
      </p>
      <h1 className="brand">Room {code}</h1>
      {joining ? <p className="lede">Joining room…</p> : null}
      {error ? <p className="error">{error}</p> : null}

      {snapshot ? (
        <section className="panel stack">
          <h2>{snapshot.room.name}</h2>
          <p className="muted">
            Snapshot loaded. Map and tokens arrive in the next cut; for now this confirms room
            create/join persistence.
          </p>
          <dl className="stack">
            <div>
              <dt className="muted">Room id</dt>
              <dd className="mono">{snapshot.room.id}</dd>
            </div>
            <div>
              <dt className="muted">Map</dt>
              <dd>{snapshot.map ? snapshot.map.filename : "none yet"}</dd>
            </div>
            <div>
              <dt className="muted">Tokens</dt>
              <dd>{snapshot.tokens.length}</dd>
            </div>
            <div>
              <dt className="muted">Camera</dt>
              <dd>
                {snapshot.camera
                  ? `${snapshot.camera.x.toFixed(1)}, ${snapshot.camera.y.toFixed(1)} @ ${snapshot.camera.zoom.toFixed(2)}`
                  : "default"}
              </dd>
            </div>
          </dl>
          <a href="#/">Back home</a>
        </section>
      ) : null}
    </main>
  );
}
