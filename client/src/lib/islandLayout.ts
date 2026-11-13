export type DockSide = "left" | "right";

export type IslandId = "map" | "initiative" | "npcs" | "log" | "dice" | "fog";

export type IslandLayout = {
  v: 2;
  left: IslandId[];
  right: IslandId[];
  collapsed: Partial<Record<IslandId, boolean>>;
};

const ALL_IDS: IslandId[] = ["map", "initiative", "npcs", "log", "dice", "fog"];

const DEFAULT_LAYOUT: IslandLayout = {
  v: 2,
  left: ["map", "dice", "log"],
  right: ["initiative", "fog", "npcs"],
  collapsed: {},
};

const LEGACY_STORAGE_PREFIX = "dms-islands:";
const STORAGE_PREFIX = "dms-islands:v2:";

function storageKey(roomCode: string): string {
  return `${STORAGE_PREFIX}${roomCode}`;
}

function legacyStorageKey(roomCode: string): string {
  return `${LEGACY_STORAGE_PREFIX}${roomCode}`;
}

function isIslandId(value: unknown): value is IslandId {
  return typeof value === "string" && (ALL_IDS as string[]).includes(value);
}

function normalizeSide(ids: unknown, used: Set<IslandId>): IslandId[] {
  if (!Array.isArray(ids)) {
    return [];
  }
  const next: IslandId[] = [];
  for (const id of ids) {
    if (!isIslandId(id) || used.has(id)) {
      continue;
    }
    used.add(id);
    next.push(id);
  }
  return next;
}

export function defaultIslandLayout(): IslandLayout {
  return {
    v: 2,
    left: [...DEFAULT_LAYOUT.left],
    right: [...DEFAULT_LAYOUT.right],
    collapsed: {},
  };
}

export function normalizeIslandLayout(raw: unknown): IslandLayout {
  const fallback = defaultIslandLayout();
  if (!raw || typeof raw !== "object") {
    return fallback;
  }
  const parsed = raw as Partial<IslandLayout>;
  if (parsed.v !== 2) {
    return fallback;
  }
  const used = new Set<IslandId>();
  const left = normalizeSide(parsed.left, used);
  const right = normalizeSide(parsed.right, used);
  for (const id of ALL_IDS) {
    if (!used.has(id)) {
      left.push(id);
      used.add(id);
    }
  }
  const collapsed: Partial<Record<IslandId, boolean>> = {};
  if (parsed.collapsed && typeof parsed.collapsed === "object") {
    for (const id of ALL_IDS) {
      if (parsed.collapsed[id] === true) {
        collapsed[id] = true;
      }
    }
  }
  return { v: 2, left, right, collapsed };
}

export function loadIslandLayout(roomCode: string): IslandLayout {
  try {
    const raw = localStorage.getItem(storageKey(roomCode));
    if (raw) {
      return normalizeIslandLayout(JSON.parse(raw) as unknown);
    }
    localStorage.removeItem(legacyStorageKey(roomCode));
    return defaultIslandLayout();
  } catch {
    return defaultIslandLayout();
  }
}

export function saveIslandLayout(roomCode: string, layout: IslandLayout): void {
  localStorage.setItem(storageKey(roomCode), JSON.stringify(layout));
  localStorage.removeItem(legacyStorageKey(roomCode));
}

export function sideOfIsland(layout: IslandLayout, id: IslandId): DockSide {
  return layout.right.includes(id) ? "right" : "left";
}

export function dockIsland(layout: IslandLayout, id: IslandId, side: DockSide): IslandLayout {
  const left = layout.left.filter((entry) => entry !== id);
  const right = layout.right.filter((entry) => entry !== id);
  if (side === "left") {
    left.push(id);
  } else {
    right.push(id);
  }
  return { ...layout, left, right };
}

export function moveIslandInSide(
  layout: IslandLayout,
  id: IslandId,
  direction: -1 | 1,
): IslandLayout {
  const side = sideOfIsland(layout, id);
  const list = [...layout[side]];
  const index = list.indexOf(id);
  if (index < 0) {
    return layout;
  }
  const target = index + direction;
  if (target < 0 || target >= list.length) {
    return layout;
  }
  const swap = list[target]!;
  list[target] = id;
  list[index] = swap;
  return { ...layout, [side]: list };
}

export function toggleIslandCollapsed(layout: IslandLayout, id: IslandId): IslandLayout {
  const collapsed = { ...layout.collapsed };
  if (collapsed[id]) {
    delete collapsed[id];
  } else {
    collapsed[id] = true;
  }
  return { ...layout, collapsed };
}

export function isIslandCollapsed(layout: IslandLayout, id: IslandId): boolean {
  return layout.collapsed[id] === true;
}
