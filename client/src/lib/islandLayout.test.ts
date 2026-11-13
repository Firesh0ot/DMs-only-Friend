import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  defaultIslandLayout,
  dockIsland,
  isIslandCollapsed,
  loadIslandLayout,
  moveIslandInSide,
  normalizeIslandLayout,
  saveIslandLayout,
  sideOfIsland,
  toggleIslandCollapsed,
} from "./islandLayout";

function installMemoryLocalStorage() {
  const store = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem(key: string) {
        return store.has(key) ? store.get(key)! : null;
      },
      setItem(key: string, value: string) {
        store.set(key, String(value));
      },
      removeItem(key: string) {
        store.delete(key);
      },
      clear() {
        store.clear();
      },
    },
  });
}

beforeEach(() => {
  installMemoryLocalStorage();
});

afterEach(() => {
  localStorage.clear();
});

describe("islandLayout", () => {
  it("defaults to non-overlapping left/right columns", () => {
    const layout = defaultIslandLayout();
    expect(layout.left).toEqual(["map", "dice", "log"]);
    expect(layout.right).toEqual(["initiative", "fog", "npcs"]);
    expect(new Set([...layout.left, ...layout.right]).size).toBe(6);
  });

  it("rejects legacy v1 corner layouts and resets to default", () => {
    const layout = normalizeIslandLayout({
      map: "tl",
      initiative: "tr",
      fog: "mr",
      npcs: "br",
      log: "bl",
      dice: "ml",
    });
    expect(layout).toEqual(defaultIslandLayout());
  });

  it("clears legacy storage and persists v2 per room", () => {
    localStorage.setItem(
      "dms-islands:TABLE1",
      JSON.stringify({ map: "tr", initiative: "tr", fog: "tr", npcs: "tr", log: "tr", dice: "tr" }),
    );
    const loaded = loadIslandLayout("TABLE1");
    expect(loaded.v).toBe(2);
    expect(localStorage.getItem("dms-islands:TABLE1")).toBeNull();

    const next = dockIsland(loaded, "fog", "left");
    saveIslandLayout("TABLE1", next);
    expect(JSON.parse(localStorage.getItem("dms-islands:v2:TABLE1") ?? "{}")).toMatchObject({
      v: 2,
      left: expect.arrayContaining(["fog"]),
    });
    expect(localStorage.getItem("dms-islands:TABLE1")).toBeNull();
    expect(loadIslandLayout("TABLE1").left).toContain("fog");
  });

  it("docks, reorders, and collapses islands", () => {
    let layout = defaultIslandLayout();
    expect(sideOfIsland(layout, "initiative")).toBe("right");

    layout = dockIsland(layout, "initiative", "left");
    expect(layout.left.at(-1)).toBe("initiative");
    expect(layout.right).not.toContain("initiative");

    layout = moveIslandInSide(layout, "initiative", -1);
    expect(layout.left.indexOf("initiative")).toBe(layout.left.length - 2);

    layout = toggleIslandCollapsed(layout, "initiative");
    expect(isIslandCollapsed(layout, "initiative")).toBe(true);
    layout = toggleIslandCollapsed(layout, "initiative");
    expect(isIslandCollapsed(layout, "initiative")).toBe(false);
  });

  it("fills missing island ids onto the left rail", () => {
    const layout = normalizeIslandLayout({
      v: 2,
      left: ["map"],
      right: ["fog"],
      collapsed: { fog: true, bog: true },
    });
    expect(layout.left).toEqual(["map", "initiative", "npcs", "log", "dice"]);
    expect(layout.right).toEqual(["fog"]);
    expect(layout.collapsed).toEqual({ fog: true });
  });
});
