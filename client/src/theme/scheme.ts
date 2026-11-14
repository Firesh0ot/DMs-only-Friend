export type ColorScheme = "tavern" | "arcane";

export const THEME_STORAGE_KEY = "dms.theme.v1";
export const DEFAULT_COLOR_SCHEME: ColorScheme = "arcane";

export function isColorScheme(value: string | null | undefined): value is ColorScheme {
  return value === "tavern" || value === "arcane";
}

export function readColorScheme(): ColorScheme {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY);
    return isColorScheme(value) ? value : DEFAULT_COLOR_SCHEME;
  } catch {
    return DEFAULT_COLOR_SCHEME;
  }
}

export function writeColorScheme(scheme: ColorScheme): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, scheme);
  } catch {
    /* ignore quota / private mode */
  }
}

export function applyColorScheme(scheme: ColorScheme): void {
  document.documentElement.dataset.theme = scheme;
  document.documentElement.style.colorScheme = scheme === "tavern" ? "light" : "dark";
}
