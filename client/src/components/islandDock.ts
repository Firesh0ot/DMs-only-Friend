import type { DockSide } from "../lib/islandLayout";

export type IslandDockProps = {
  side: DockSide;
  collapsed: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onToggleCollapsed: () => void;
  onDockSide: (side: DockSide) => void;
  onMoveInSide: (direction: -1 | 1) => void;
};
