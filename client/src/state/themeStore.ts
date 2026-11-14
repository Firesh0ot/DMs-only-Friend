import { create } from "zustand";
import {
  applyLanternMode,
  readLanternMode,
  writeLanternMode,
  type LanternMode,
} from "../theme/lantern";
import {
  applyColorScheme,
  readColorScheme,
  writeColorScheme,
  type ColorScheme,
} from "../theme/scheme";

type ThemeStore = {
  lantern: LanternMode;
  colorScheme: ColorScheme;
  setLantern: (mode: LanternMode) => void;
  toggleLantern: () => void;
  setColorScheme: (scheme: ColorScheme) => void;
  toggleColorScheme: () => void;
};

export const useThemeStore = create<ThemeStore>((set, get) => ({
  lantern: readLanternMode(),
  colorScheme: readColorScheme(),
  setLantern: (mode) => {
    const previous = get().lantern;
    applyLanternMode(mode, { animate: previous !== mode });
    writeLanternMode(mode);
    set({ lantern: mode });
  },
  toggleLantern: () => {
    const next: LanternMode = get().lantern === "on" ? "off" : "on";
    get().setLantern(next);
  },
  setColorScheme: (scheme) => {
    applyColorScheme(scheme);
    writeColorScheme(scheme);
    set({ colorScheme: scheme });
  },
  toggleColorScheme: () => {
    const next: ColorScheme = get().colorScheme === "arcane" ? "tavern" : "arcane";
    get().setColorScheme(next);
  },
}));
