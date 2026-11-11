export type LanternMode = "on" | "off";

const STORAGE_KEY = "dms-lantern";

export function readLanternMode(): LanternMode {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === "off" ? "off" : "on";
  } catch {
    return "on";
  }
}

export function writeLanternMode(mode: LanternMode): void {
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    /* ignore quota / private mode */
  }
}

export function applyLanternMode(mode: LanternMode): void {
  document.documentElement.dataset.lantern = mode;
}
