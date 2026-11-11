import { useState } from "react";
import { ClientEvents, type TokenState } from "@dms/shared";
import { getSocket } from "../socket/socket";

type Props = {
  code: string;
  tokens: TokenState[];
  gridPx: number;
};

export function GmToolbar({ code, tokens, gridPx }: Props) {
  const [label, setLabel] = useState("Hero");
  const [isPlayer, setIsPlayer] = useState(true);
  const [uploadGridPx, setUploadGridPx] = useState(String(gridPx || 70));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function onUpload(file: File | null) {
    if (!file) {
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const body = new FormData();
      body.append("map", file);
      body.append("gridPx", uploadGridPx);
      const response = await fetch(`/api/rooms/${code}/map`, {
        method: "POST",
        body,
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? "Upload failed");
      }
      setMessage(`Uploaded ${file.name}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  function createToken() {
    const socket = getSocket();
    socket.emit(ClientEvents.TokenCreate, {
      label: label.trim() || "Token",
      x: 1,
      y: 1,
      isPlayer,
    });
  }

  function removeToken(tokenId: string) {
    getSocket().emit(ClientEvents.TokenRemove, { tokenId });
  }

  return (
    <section className="panel stack">
      <h2>GM tools</h2>
      <label className="stack">
        <span className="muted">Map PNG/JPG (grid px)</span>
        <div className="row">
          <input
            style={{ maxWidth: "6rem" }}
            value={uploadGridPx}
            onChange={(event) => setUploadGridPx(event.target.value)}
          />
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            disabled={busy}
            onChange={(event) => void onUpload(event.target.files?.[0] ?? null)}
          />
        </div>
      </label>

      <label className="stack">
        <span className="muted">New token</span>
        <input value={label} onChange={(event) => setLabel(event.target.value)} />
      </label>
      <label className="row">
        <input
          type="checkbox"
          checked={isPlayer}
          onChange={(event) => setIsPlayer(event.target.checked)}
        />
        <span>Player-owned (label = player name)</span>
      </label>
      <button onClick={createToken}>Add token</button>

      <ul className="token-list">
        {tokens.map((token) => (
          <li key={token.id}>
            <span>
              {token.label}{" "}
              <span className="muted">
                ({token.x},{token.y})
              </span>
            </span>
            <button className="secondary" onClick={() => removeToken(token.id)}>
              Remove
            </button>
          </li>
        ))}
      </ul>

      {message ? <p className="muted">{message}</p> : null}
      <p className="muted">Pan/zoom here; screen and players follow your camera.</p>
    </section>
  );
}
