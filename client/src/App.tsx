import { useEffect, useMemo, useState } from "react";
import { HomePage } from "./pages/HomePage";
import { RoomPage } from "./pages/RoomPage";
import { bindSocketListeners } from "./state/roomStore";
import type { Role } from "@dms/shared";

type Route =
  | { kind: "home" }
  | { kind: "room"; code: string; role: Role; name: string | null };

function parseHash(hash: string): Route {
  const raw = hash.replace(/^#/, "") || "/";
  const url = new URL(raw, "http://local");
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts[0] === "room" && parts[1]) {
    const roleParam = url.searchParams.get("role");
    const role: Role =
      roleParam === "gm" || roleParam === "screen" || roleParam === "player"
        ? roleParam
        : "screen";
    return {
      kind: "room",
      code: parts[1].toUpperCase(),
      role,
      name: url.searchParams.get("name"),
    };
  }
  return { kind: "home" };
}

export function App() {
  const [hash, setHash] = useState(() => window.location.hash);
  const route = useMemo(() => parseHash(hash), [hash]);

  useEffect(() => {
    bindSocketListeners();
    const onHash = () => setHash(window.location.hash);
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  if (route.kind === "room") {
    return <RoomPage code={route.code} role={route.role} name={route.name} />;
  }

  return <HomePage />;
}
