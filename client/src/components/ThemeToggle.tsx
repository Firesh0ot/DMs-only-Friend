import { useThemeStore } from "../state/themeStore";

type Props = {
  className?: string;
};

export function ThemeToggle({ className }: Props) {
  const colorScheme = useThemeStore((state) => state.colorScheme);
  const toggleColorScheme = useThemeStore((state) => state.toggleColorScheme);
  const arcane = colorScheme === "arcane";

  return (
    <button
      type="button"
      className={`theme-toggle ${arcane ? "theme-toggle--arcane" : "theme-toggle--tavern"}${
        className ? ` ${className}` : ""
      }`}
      onClick={toggleColorScheme}
      aria-pressed={arcane}
      aria-label={
        arcane ? "Theme: Arcane (dark). Switch to Tavern (light)." : "Theme: Tavern (light). Switch to Arcane (dark)."
      }
      title={arcane ? "Arcane mode — click for Tavern" : "Tavern mode — click for Arcane"}
    >
      <span className="theme-toggle__label">{arcane ? "Arcane" : "Tavern"}</span>
      <span className="theme-toggle__track" aria-hidden="true">
        <span className="theme-toggle__thumb" />
      </span>
    </button>
  );
}
