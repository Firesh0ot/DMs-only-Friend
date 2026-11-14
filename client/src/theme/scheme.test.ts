import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_COLOR_SCHEME,
  THEME_STORAGE_KEY,
  applyColorScheme,
  isColorScheme,
  readColorScheme,
  writeColorScheme,
} from "./scheme";

const memory = new Map<string, string>();

function installStorage(): void {
  memory.clear();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => {
      memory.set(key, value);
    },
    removeItem: (key: string) => {
      memory.delete(key);
    },
  });
}

function installDocument(): { root: { dataset: Record<string, string>; style: { colorScheme: string } } } {
  const root = { dataset: {} as Record<string, string>, style: { colorScheme: "" } };
  vi.stubGlobal("document", {
    documentElement: root,
  });
  return { root };
}

afterEach(() => {
  vi.unstubAllGlobals();
  memory.clear();
});

describe("color scheme", () => {
  it("defaults to arcane", () => {
    installStorage();
    expect(DEFAULT_COLOR_SCHEME).toBe("arcane");
    expect(readColorScheme()).toBe("arcane");
  });

  it("validates stored values", () => {
    expect(isColorScheme("tavern")).toBe(true);
    expect(isColorScheme("arcane")).toBe(true);
    expect(isColorScheme("neon")).toBe(false);
  });

  it("persists and applies scheme", () => {
    installStorage();
    const { root } = installDocument();
    writeColorScheme("tavern");
    expect(memory.get(THEME_STORAGE_KEY)).toBe("tavern");
    expect(readColorScheme()).toBe("tavern");
    applyColorScheme("tavern");
    expect(root.dataset.theme).toBe("tavern");
    expect(root.style.colorScheme).toBe("light");
    applyColorScheme("arcane");
    expect(root.dataset.theme).toBe("arcane");
    expect(root.style.colorScheme).toBe("dark");
  });
});
