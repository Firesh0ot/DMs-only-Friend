export type LanternMode = "on" | "off";
export type LanternFx = "blow-out" | "light";

const STORAGE_KEY = "dms-lantern";
export const LANTERN_FX_MS = 560;

let fxSwitchTimer: ReturnType<typeof setTimeout> | null = null;
let fxClearTimer: ReturnType<typeof setTimeout> | null = null;

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

export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function clearLanternFxTimers(): void {
  if (fxSwitchTimer !== null) {
    clearTimeout(fxSwitchTimer);
    fxSwitchTimer = null;
  }
  if (fxClearTimer !== null) {
    clearTimeout(fxClearTimer);
    fxClearTimer = null;
  }
}

function clearLanternFx(root: HTMLElement): void {
  delete root.dataset.lanternFx;
}

export function applyLanternMode(
  mode: LanternMode,
  options?: { animate?: boolean },
): void {
  const root = document.documentElement;
  const previous = root.dataset.lantern as LanternMode | undefined;
  const shouldAnimate =
    options?.animate === true &&
    previous !== undefined &&
    previous !== mode &&
    !prefersReducedMotion();

  clearLanternFxTimers();

  if (!shouldAnimate) {
    root.dataset.lantern = mode;
    clearLanternFx(root);
    return;
  }

  if (mode === "off") {
    root.dataset.lanternFx = "blow-out";
    fxSwitchTimer = setTimeout(() => {
      root.dataset.lantern = "off";
      fxSwitchTimer = null;
    }, Math.round(LANTERN_FX_MS * 0.42));
  } else {
    root.dataset.lantern = "on";
    root.dataset.lanternFx = "light";
  }

  fxClearTimer = setTimeout(() => {
    clearLanternFx(root);
    fxClearTimer = null;
  }, LANTERN_FX_MS);
}
