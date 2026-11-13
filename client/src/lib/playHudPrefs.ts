export type HudSectionId = "dice" | "initiative" | "spawn" | "fog" | "log";

export type PlayHudPrefs = {
  v: 1;
  collapsed: Partial<Record<HudSectionId, boolean>>;
};

const ALL_SECTIONS: HudSectionId[] = ["dice", "initiative", "spawn", "fog", "log"];

const STORAGE_PREFIX = "dms-play-hud:v1:";
const LEGACY_ISLAND_PREFIX = "dms-islands:";
const LEGACY_ISLAND_V2_PREFIX = "dms-islands:v2:";

function storageKey(roomCode: string): string {
  return `${STORAGE_PREFIX}${roomCode}`;
}

export function defaultPlayHudPrefs(): PlayHudPrefs {
  return { v: 1, collapsed: { log: true } };
}

export function normalizePlayHudPrefs(raw: unknown): PlayHudPrefs {
  const fallback = defaultPlayHudPrefs();
  if (!raw || typeof raw !== "object") {
    return fallback;
  }
  const parsed = raw as Partial<PlayHudPrefs>;
  if (parsed.v !== 1) {
    return fallback;
  }
  const collapsed: Partial<Record<HudSectionId, boolean>> = {};
  if (parsed.collapsed && typeof parsed.collapsed === "object") {
    for (const id of ALL_SECTIONS) {
      if (parsed.collapsed[id] === true) {
        collapsed[id] = true;
      }
    }
  }
  return { v: 1, collapsed };
}

export function clearObsoleteIslandLayout(roomCode: string): void {
  try {
    localStorage.removeItem(`${LEGACY_ISLAND_PREFIX}${roomCode}`);
    localStorage.removeItem(`${LEGACY_ISLAND_V2_PREFIX}${roomCode}`);
  } catch {
    /* ignore */
  }
}

export function loadPlayHudPrefs(roomCode: string): PlayHudPrefs {
  clearObsoleteIslandLayout(roomCode);
  try {
    const raw = localStorage.getItem(storageKey(roomCode));
    if (!raw) {
      return defaultPlayHudPrefs();
    }
    return normalizePlayHudPrefs(JSON.parse(raw) as unknown);
  } catch {
    return defaultPlayHudPrefs();
  }
}

export function savePlayHudPrefs(roomCode: string, prefs: PlayHudPrefs): void {
  clearObsoleteIslandLayout(roomCode);
  localStorage.setItem(storageKey(roomCode), JSON.stringify(prefs));
}

export function toggleHudCollapsed(prefs: PlayHudPrefs, id: HudSectionId): PlayHudPrefs {
  const collapsed = { ...prefs.collapsed };
  if (collapsed[id]) {
    delete collapsed[id];
  } else {
    collapsed[id] = true;
  }
  return { ...prefs, collapsed };
}

export function isHudCollapsed(prefs: PlayHudPrefs, id: HudSectionId): boolean {
  return prefs.collapsed[id] === true;
}
