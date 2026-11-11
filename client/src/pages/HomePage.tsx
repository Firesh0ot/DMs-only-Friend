import { useState } from "react";

type CreatedRoom = {
  code: string;
  gmUrl: string;
  screenUrl: string;
  playerUrl: string;
};

export function HomePage() {
  const [name, setName] = useState("Friday Table");
  const [joinCode, setJoinCode] = useState("");
  const [playerName, setPlayerName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreatedRoom | null>(null);

  async function createRoom() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!response.ok) {
        throw new Error("Could not create room");
      }
      const data = (await response.json()) as CreatedRoom;
      setCreated(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setBusy(false);
    }
  }

  function openRoom(role: "gm" | "screen" | "player") {
    const code = (created?.code ?? joinCode).trim().toUpperCase();
    if (!code) {
      setError("Enter a room code");
      return;
    }
    const params = new URLSearchParams({ role });
    if (role === "player" && playerName.trim()) {
      params.set("name", playerName.trim());
    }
    window.location.hash = `/room/${code}?${params.toString()}`;
  }

  return (
    <main className="app-shell">
      <p className="muted">Self-hosted tabletop board</p>
      <h1 className="brand">DMs-only-Friend</h1>
      <p className="lede">
        Open a room for the GM laptop, cast the same map to a TV screen, and keep tokens in sync
        over the LAN.
      </p>

      <div className="room-layout">
        <section className="panel stack">
          <h2>Create room</h2>
          <label className="stack">
            <span className="muted">Table name</span>
            <input value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          <button disabled={busy} onClick={() => void createRoom()}>
            {busy ? "Creating…" : "Create room"}
          </button>
          {created ? (
            <div className="stack">
              <p>
                Code <span className="mono">{created.code}</span>
              </p>
              <div className="row">
                <button onClick={() => openRoom("gm")}>Open as GM</button>
                <button className="secondary" onClick={() => openRoom("screen")}>
                  Open screen
                </button>
              </div>
              <p className="muted mono">{created.screenUrl}</p>
            </div>
          ) : null}
        </section>

        <section className="panel stack">
          <h2>Join room</h2>
          <label className="stack">
            <span className="muted">Room code</span>
            <input
              value={joinCode}
              onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
              placeholder="ABC123"
            />
          </label>
          <label className="stack">
            <span className="muted">Player name (remote)</span>
            <input
              value={playerName}
              onChange={(event) => setPlayerName(event.target.value)}
              placeholder="Aria"
            />
          </label>
          <div className="row">
            <button onClick={() => openRoom("screen")}>Join screen</button>
            <button className="secondary" onClick={() => openRoom("player")}>
              Join as player
            </button>
            <button className="secondary" onClick={() => openRoom("gm")}>
              Join as GM
            </button>
          </div>
        </section>
      </div>

      {error ? <p className="error">{error}</p> : null}
    </main>
  );
}
