export type Corner = "tl" | "tr" | "bl" | "br";

export type IslandId = "map" | "initiative" | "npcs" | "log" | "dice";

export type IslandLayout = Record<IslandId, Corner>;

const DEFAULT_LAYOUT: IslandLayout = {
  map: "tl",
  initiative: "tr",
  npcs: "br",
  log: "bl",
  dice: "br",
};

function storageKey(roomId: string): string {
  return `dms-islands:${roomId}`;
}

export function loadIslandLayout(roomId: string): IslandLayout {
  try {
    const raw = localStorage.getItem(storageKey(roomId));
    if (!raw) {
      return { ...DEFAULT_LAYOUT };
    }
    const parsed = JSON.parse(raw) as Partial<IslandLayout>;
    return {
      map: parsed.map ?? DEFAULT_LAYOUT.map,
      initiative: parsed.initiative ?? DEFAULT_LAYOUT.initiative,
      npcs: parsed.npcs ?? DEFAULT_LAYOUT.npcs,
      log: parsed.log ?? DEFAULT_LAYOUT.log,
      dice: parsed.dice ?? DEFAULT_LAYOUT.dice,
    };
  } catch {
    return { ...DEFAULT_LAYOUT };
  }
}

export function saveIslandLayout(roomId: string, layout: IslandLayout): void {
  localStorage.setItem(storageKey(roomId), JSON.stringify(layout));
}

export function nextCorner(current: Corner): Corner {
  const order: Corner[] = ["tl", "tr", "br", "bl"];
  const index = order.indexOf(current);
  return order[(index + 1) % order.length] ?? "tl";
}

export function cornerClass(corner: Corner): string {
  return `island-dock island-dock--${corner}`;
}
