import { applyLanternMode, readLanternMode } from "./lantern";
import { applyColorScheme, readColorScheme } from "./scheme";

applyColorScheme(readColorScheme());
applyLanternMode(readLanternMode());
