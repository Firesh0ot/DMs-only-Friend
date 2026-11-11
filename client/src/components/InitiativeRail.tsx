import type { InitiativeState } from "@dms/shared";

type Props = {
  initiative: InitiativeState | null;
};

export function InitiativeRail({ initiative }: Props) {
  if (!initiative || initiative.order.length === 0) {
    return (
      <aside className="initiative-rail" aria-label="Initiative">
        <p className="muted">Waiting for initiative…</p>
      </aside>
    );
  }

  const active = initiative.order[initiative.activeIndex];

  return (
    <aside className="initiative-rail" aria-label="Initiative order">
      <div className="initiative-rail__round">
        <span className="muted">Round</span>
        <strong>{initiative.round}</strong>
      </div>
      {active ? (
        <div className="initiative-rail__active-turn">
          {active.image ? (
            <img src={active.image} alt="" className="initiative-rail__active-art" />
          ) : (
            <div className="initiative-rail__active-placeholder" aria-hidden>
              {active.label.trim().charAt(0).toUpperCase() || "?"}
            </div>
          )}
          <p className="initiative-rail__turn">
            Turn: <strong>{active.label}</strong>
          </p>
        </div>
      ) : null}
      <ol className="initiative-rail__list">
        {initiative.order.map((entry, index) => {
          const isActive = index === initiative.activeIndex;
          const initial = entry.label.trim().charAt(0).toUpperCase() || "?";
          return (
            <li key={`${entry.tokenId}-${index}`} className={isActive ? "is-active" : undefined}>
              <div className="tcg-card" data-kind={entry.kind ?? "npc"}>
                {entry.image ? (
                  <img src={entry.image} alt="" className="tcg-card__art" />
                ) : (
                  <div className="tcg-card__placeholder" aria-hidden>
                    {initial}
                  </div>
                )}
                <div className="tcg-card__meta">
                  <span className="tcg-card__name">{entry.label}</span>
                  <span className="tcg-card__init">{entry.initiative}</span>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </aside>
  );
}
