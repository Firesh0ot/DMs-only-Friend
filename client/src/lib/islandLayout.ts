export type Corner = "tl" | "tr" | "bl" | "br" | "ml" | "mr";

export type IslandId = "map" | "initiative" | "npcs" | "log" | "dice" | "fog";

export type IslandLayout = Record<IslandId, Corner>;

const DEFAULT_LAYOUT: IslandLayout = {
  map: "tl",
  initiative: "tr",
  fog: "mr",
  log: "bl",
  dice: "ml",
  npcs: "br",
};

const CORNER_ORDER: Corner[] = ["tl", "tr", "mr", "br", "bl", "ml"];

function storageKey(roomCode: string): string {
  return `dms-islands:${roomCode}`;
}

function isCorner(value: unknown): value is Corner {
  return typeof value === "string" && (CORNER_ORDER as string[]).includes(value);
}

export function defaultIslandLayout(): IslandLayout {
  return { ...DEFAULT_LAYOUT };
}

export function loadIslandLayout(roomCode: string): IslandLayout {
  try {
    const raw = localStorage.getItem(storageKey(roomCode));
    if (!raw) {
      return defaultIslandLayout();
    }
    const parsed = JSON.parse(raw) as Partial<IslandLayout>;
    return {
      map: isCorner(parsed.map) ? parsed.map : DEFAULT_LAYOUT.map,
      initiative: isCorner(parsed.initiative) ? parsed.initiative : DEFAULT_LAYOUT.initiative,
      npcs: isCorner(parsed.npcs) ? parsed.npcs : DEFAULT_LAYOUT.npcs,
      log: isCorner(parsed.log) ? parsed.log : DEFAULT_LAYOUT.log,
      dice: isCorner(parsed.dice) ? parsed.dice : DEFAULT_LAYOUT.dice,
      fog: isCorner(parsed.fog) ? parsed.fog : DEFAULT_LAYOUT.fog,
    };
  } catch {
    return defaultIslandLayout();
  }
}

export function saveIslandLayout(roomCode: string, layout: IslandLayout): void {
  localStorage.setItem(storageKey(roomCode), JSON.stringify(layout));
}

export function nextCorner(current: Corner): Corner {
  const index = CORNER_ORDER.indexOf(current);
  return CORNER_ORDER[(index + 1) % CORNER_ORDER.length] ?? "tl";
}

export function cornerClass(corner: Corner): string {
  return `island-dock island-dock--${corner}`;
}
