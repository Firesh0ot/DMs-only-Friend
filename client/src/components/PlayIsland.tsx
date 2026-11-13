import type { ReactNode } from "react";
import type { DockSide } from "../lib/islandLayout";

type Props = {
  title: string;
  side: DockSide;
  collapsed: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onToggleCollapsed: () => void;
  onDockSide: (side: DockSide) => void;
  onMoveInSide: (direction: -1 | 1) => void;
  children: ReactNode;
};

export function PlayIsland({
  title,
  side,
  collapsed,
  canMoveUp,
  canMoveDown,
  onToggleCollapsed,
  onDockSide,
  onMoveInSide,
  children,
}: Props) {
  return (
    <aside className={`play-island${collapsed ? " play-island--collapsed" : ""}`}>
      <header className="play-island__header">
        <button
          type="button"
          className="play-island__collapse"
          onClick={onToggleCollapsed}
          aria-expanded={!collapsed}
          aria-label={collapsed ? `Expand ${title}` : `Collapse ${title}`}
          title={collapsed ? "Expand" : "Collapse"}
        >
          <span aria-hidden="true">{collapsed ? "▸" : "▾"}</span>
          <h2>{title}</h2>
        </button>
        <div className="play-island__docks" role="group" aria-label={`${title} dock`}>
          <button
            type="button"
            className="secondary play-island__dock"
            onClick={() => onMoveInSide(-1)}
            disabled={!canMoveUp}
            title="Move up in this column"
            aria-label={`Move ${title} up`}
          >
            ↑
          </button>
          <button
            type="button"
            className="secondary play-island__dock"
            onClick={() => onMoveInSide(1)}
            disabled={!canMoveDown}
            title="Move down in this column"
            aria-label={`Move ${title} down`}
          >
            ↓
          </button>
          <button
            type="button"
            className={`secondary play-island__dock${side === "left" ? " is-active" : ""}`}
            onClick={() => onDockSide("left")}
            disabled={side === "left"}
            title="Dock left"
            aria-label={`Dock ${title} on the left`}
            aria-pressed={side === "left"}
          >
            Left
          </button>
          <button
            type="button"
            className={`secondary play-island__dock${side === "right" ? " is-active" : ""}`}
            onClick={() => onDockSide("right")}
            disabled={side === "right"}
            title="Dock right"
            aria-label={`Dock ${title} on the right`}
            aria-pressed={side === "right"}
          >
            Right
          </button>
        </div>
      </header>
      {collapsed ? null : <div className="play-island__body stack">{children}</div>}
    </aside>
  );
}
