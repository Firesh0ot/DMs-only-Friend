import type { ReactNode } from "react";

type Props = {
  title: string;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  children: ReactNode;
  className?: string;
};

export function HudPanel({ title, collapsed, onToggleCollapsed, children, className }: Props) {
  return (
    <section
      className={`hud-panel${collapsed ? " hud-panel--collapsed" : ""}${className ? ` ${className}` : ""}`}
    >
      <header className="hud-panel__header">
        <button
          type="button"
          className="hud-panel__collapse"
          onClick={onToggleCollapsed}
          aria-expanded={!collapsed}
          aria-label={collapsed ? `Expand ${title}` : `Collapse ${title}`}
          title={collapsed ? "Expand" : "Collapse"}
        >
          <span aria-hidden="true">{collapsed ? "▸" : "▾"}</span>
          <h2>{title}</h2>
        </button>
      </header>
      {collapsed ? null : <div className="hud-panel__body">{children}</div>}
    </section>
  );
}
