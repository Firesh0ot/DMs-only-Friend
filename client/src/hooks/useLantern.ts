import { useThemeStore } from "../state/themeStore";

export function useLantern() {
  const mode = useThemeStore((state) => state.lantern);
  const toggle = useThemeStore((state) => state.toggleLantern);
  const setMode = useThemeStore((state) => state.setLantern);
  return { mode, toggle, setMode };
}
