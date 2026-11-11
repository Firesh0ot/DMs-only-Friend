import { useThemeStore } from "../state/themeStore";

type Props = {
  className?: string;
};

export function LanternToggle({ className }: Props) {
  const lantern = useThemeStore((state) => state.lantern);
  const toggleLantern = useThemeStore((state) => state.toggleLantern);
  const lit = lantern === "on";

  return (
    <button
      type="button"
      className={`lantern-toggle ${lit ? "lantern-toggle--on" : "lantern-toggle--off"}${
        className ? ` ${className}` : ""
      }`}
      onClick={toggleLantern}
      aria-pressed={lit}
      aria-label={lit ? "Lantern on — candlelit tavern" : "Lantern off — smoky dungeon-tavern"}
      title={lit ? "Candlelit tavern (click for smoky dungeon)" : "Smoky dungeon (click for candlelit)"}
    >
      <span className="lantern-toggle__icon" aria-hidden="true">
        <svg viewBox="0 0 32 40" width="22" height="28" fill="none">
          <path
            d="M10 8h12v3.5c0 1.2-.5 2.3-1.4 3.1L18 17v2h-4v-2l-2.6-2.4A4.2 4.2 0 0 1 10 11.5V8Z"
            className="lantern-toggle__cage"
          />
          <path d="M14 4h4v4h-4V4Z" className="lantern-toggle__cage" />
          <path d="M12 8h8" strokeWidth="1.5" className="lantern-toggle__cage" />
          <ellipse cx="16" cy="12.5" rx="3.2" ry="4.2" className="lantern-toggle__flame" />
          <path d="M11 19h10v14a5 5 0 0 1-10 0V19Z" className="lantern-toggle__glass" />
          <path d="M10 33h12v3H10v-3Z" className="lantern-toggle__cage" />
        </svg>
      </span>
      <span className="lantern-toggle__label">{lit ? "Lantern" : "Smoky"}</span>
    </button>
  );
}
