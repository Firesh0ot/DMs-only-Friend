import { useState } from "react";
import { normalizeRoomCode, roomCodePathSegment } from "@dms/shared";
import { LanternToggle } from "../components/LanternToggle";

type CreatedRoom = {
  code: string;
  gmInviteUrl: string;
  screenUrl: string;
  playerUrl: string;
};

export function HomePage() {
  const [name, setName] = useState("Friday Table");
  const [code, setCode] = useState("");
  const [pin, setPin] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [joinPin, setJoinPin] = useState("");
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
        body: JSON.stringify({ name, code, pin }),
      });
      const payload = (await response.json().catch(() => null)) as
        | (CreatedRoom & { error?: string })
        | null;
      if (!response.ok) {
        throw new Error(payload?.error ?? "Could not create room");
      }
      if (!payload?.code || !payload.gmInviteUrl) {
        throw new Error("Could not create room");
      }
      setCreated(payload);
      sessionStorage.setItem(
        `dms-gm-pin:${payload.code}`,
        pin,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setBusy(false);
    }
  }

  function openCreatedGm() {
    if (!created) {
      return;
    }
    const hashPart = created.gmInviteUrl.split("#")[1];
    if (hashPart) {
      window.location.hash = hashPart.startsWith("/") ? hashPart : `/${hashPart}`;
    }
  }

  async function openRoom(role: "gm" | "screen" | "player") {
    const roomCode = normalizeRoomCode(created?.code ?? joinCode);
    if (!roomCode) {
      setError("Enter a room code");
      return;
    }
    if (role === "gm") {
      const pinValue =
        (created ? pin : joinPin).trim() || sessionStorage.getItem(`dms-gm-pin:${roomCode}`) || "";
      if (!pinValue) {
        setError("Enter the GM PIN");
        return;
      }
      sessionStorage.setItem(`dms-gm-pin:${roomCode}`, pinValue);
      if (created?.gmInviteUrl) {
        openCreatedGm();
        return;
      }
      setBusy(true);
      setError(null);
      try {
        const response = await fetch(`/api/rooms/${roomCodePathSegment(roomCode)}/links`);
        const payload = (await response.json().catch(() => null)) as {
          gmInviteRequired?: boolean;
          error?: string;
        } | null;
        if (!response.ok) {
          throw new Error(payload?.error ?? "Room not found");
        }
        if (payload?.gmInviteRequired) {
          setError(
            "First GM claim needs the single-use invite URL — mint one with the PIN below, then open it.",
          );
          return;
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not check room");
        return;
      } finally {
        setBusy(false);
      }
    }
    const params = new URLSearchParams({ role });
    if (role === "player" && playerName.trim()) {
      params.set("name", playerName.trim());
    }
    window.location.hash = `/room/${roomCodePathSegment(roomCode)}?${params.toString()}`;
  }

  async function mintInvite() {
    const roomCode = normalizeRoomCode(joinCode);
    if (!roomCode || !joinPin.trim()) {
      setError("Enter room code and PIN to mint a GM invite");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/rooms/${roomCodePathSegment(roomCode)}/gm-invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: joinPin.trim() }),
      });
      const payload = (await response.json().catch(() => null)) as {
        gmInviteUrl?: string;
        error?: string;
      } | null;
      if (!response.ok || !payload?.gmInviteUrl) {
        throw new Error(payload?.error ?? "Could not mint GM invite");
      }
      sessionStorage.setItem(`dms-gm-pin:${roomCode}`, joinPin.trim());
      const pathCode = roomCodePathSegment(roomCode);
      setCreated({
        code: roomCode,
        gmInviteUrl: payload.gmInviteUrl,
        screenUrl: `${window.location.origin}/#/room/${pathCode}?role=screen`,
        playerUrl: `${window.location.origin}/#/room/${pathCode}?role=player`,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Mint invite failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="app-shell">
      <div className="chrome-bar">
        <LanternToggle />
      </div>
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
            <span className="muted">Room code</span>
            <input
              value={code}
              onChange={(event) =>
                setCode(event.target.value.normalize("NFC").toLocaleUpperCase("und"))
              }
              placeholder="FRIDAY-TABLE"
              autoComplete="off"
            />
          </label>
          <label className="stack">
            <span className="muted">Table name</span>
            <input value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          <label className="stack">
            <span className="muted">GM PIN (4–8 digits)</span>
            <input
              value={pin}
              onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 8))}
              inputMode="numeric"
              autoComplete="new-password"
              placeholder="••••"
            />
          </label>
          <button disabled={busy} onClick={() => void createRoom()}>
            {busy ? "Creating…" : "Create room"}
          </button>
          {created ? (
            <div className="stack">
              <p>
                Code <span className="mono">{created.code}</span>
              </p>
              <p className="muted">
                Copy the single-use GM invite now — it works once, then only the PIN rejoins GM.
              </p>
              <label className="stack">
                <span className="muted">GM invite (single-use)</span>
                <input
                  readOnly
                  value={created.gmInviteUrl}
                  onFocus={(event) => event.target.select()}
                />
              </label>
              <div className="row">
                <button disabled={busy} onClick={() => void openRoom("gm")}>
                  Open as GM
                </button>
                <button
                  className="secondary"
                  disabled={busy}
                  onClick={() => void openRoom("screen")}
                >
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
              onChange={(event) =>
                setJoinCode(event.target.value.normalize("NFC").toLocaleUpperCase("und"))
              }
              placeholder="FRIDAY-TABLE"
            />
          </label>
          <label className="stack">
            <span className="muted">GM PIN (for GM join / new invite)</span>
            <input
              value={joinPin}
              onChange={(event) => setJoinPin(event.target.value.replace(/\D/g, "").slice(0, 8))}
              inputMode="numeric"
              autoComplete="current-password"
              placeholder="••••"
            />
          </label>
          <label className="stack">
            <span className="muted">PC name to claim (remote)</span>
            <input
              value={playerName}
              onChange={(event) => setPlayerName(event.target.value)}
              placeholder="Aria"
            />
          </label>
          <div className="row">
            <button disabled={busy} onClick={() => void openRoom("screen")}>
              Join screen
            </button>
            <button
              className="secondary"
              onClick={() => void openRoom("player")}
              disabled={busy || !playerName.trim()}
            >
              Join as player
            </button>
            <button className="secondary" disabled={busy} onClick={() => void openRoom("gm")}>
              Join as GM
            </button>
          </div>
          <button className="secondary" disabled={busy} onClick={() => void mintInvite()}>
            Mint new GM invite
          </button>
        </section>
      </div>

      {error ? <p className="error">{error}</p> : null}
    </main>
  );
}
