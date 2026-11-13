import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  clearObsoleteIslandLayout,
  defaultPlayHudPrefs,
  isHudCollapsed,
  loadPlayHudPrefs,
  normalizePlayHudPrefs,
  savePlayHudPrefs,
  toggleHudCollapsed,
} from "./playHudPrefs";

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

describe("playHudPrefs", () => {
  it("defaults with log collapsed for map space", () => {
    expect(defaultPlayHudPrefs()).toEqual({ v: 1, collapsed: { log: true } });
  });

  it("rejects unknown versions", () => {
    expect(normalizePlayHudPrefs({ v: 2, collapsed: { dice: true } })).toEqual(
      defaultPlayHudPrefs(),
    );
  });

  it("clears obsolete island keys on load and save", () => {
    localStorage.setItem("dms-islands:TABLE1", JSON.stringify({ map: "tl" }));
    localStorage.setItem(
      "dms-islands:v2:TABLE1",
      JSON.stringify({ v: 2, left: ["map"], right: [], collapsed: {} }),
    );
    const prefs = loadPlayHudPrefs("TABLE1");
    expect(prefs.v).toBe(1);
    expect(localStorage.getItem("dms-islands:TABLE1")).toBeNull();
    expect(localStorage.getItem("dms-islands:v2:TABLE1")).toBeNull();

    savePlayHudPrefs("TABLE1", toggleHudCollapsed(prefs, "fog"));
    expect(localStorage.getItem("dms-play-hud:v1:TABLE1")).toContain('"fog":true');
    expect(localStorage.getItem("dms-islands:v2:TABLE1")).toBeNull();
  });

  it("toggles collapse flags", () => {
    const next = toggleHudCollapsed(defaultPlayHudPrefs(), "initiative");
    expect(isHudCollapsed(next, "initiative")).toBe(true);
    expect(isHudCollapsed(toggleHudCollapsed(next, "initiative"), "initiative")).toBe(false);
  });

  it("clearObsoleteIslandLayout is idempotent", () => {
    localStorage.setItem("dms-islands:X", "1");
    clearObsoleteIslandLayout("X");
    clearObsoleteIslandLayout("X");
    expect(localStorage.getItem("dms-islands:X")).toBeNull();
  });
});
