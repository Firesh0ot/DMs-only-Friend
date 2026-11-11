import type { InitiativeState } from "@dms/shared";

type Props = {
  initiative: InitiativeState | null;
};

export function InitiativeBanner({ initiative }: Props) {
  if (!initiative || initiative.order.length === 0) {
    return null;
  }
  const active = initiative.order[initiative.activeIndex];
  if (!active) {
    return null;
  }
  return (
    <div className="banner" role="status">
      Turn: {active.label}
    </div>
  );
}
