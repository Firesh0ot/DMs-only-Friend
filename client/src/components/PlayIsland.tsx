import type { ReactNode } from "react";
import { cornerClass, type Corner } from "../lib/islandLayout";

type Props = {
  title: string;
  corner: Corner;
  onCycleCorner: () => void;
  children: ReactNode;
};

export function PlayIsland({ title, corner, onCycleCorner, children }: Props) {
  return (
    <aside className={`play-island ${cornerClass(corner)}`}>
      <header className="play-island__header">
        <h2>{title}</h2>
        <button
          type="button"
          className="secondary play-island__snap"
          onClick={onCycleCorner}
          title="Snap to next corner"
          aria-label={`Move ${title} island to next corner`}
        >
          Snap
        </button>
      </header>
      <div className="play-island__body stack">{children}</div>
    </aside>
  );
}
