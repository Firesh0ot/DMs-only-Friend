import { create } from "zustand";
import {
  applyLanternMode,
  readLanternMode,
  writeLanternMode,
  type LanternMode,
} from "../theme/lantern";

type ThemeStore = {
  lantern: LanternMode;
  setLantern: (mode: LanternMode) => void;
  toggleLantern: () => void;
};

export const useThemeStore = create<ThemeStore>((set, get) => ({
  lantern: readLanternMode(),
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
}));
