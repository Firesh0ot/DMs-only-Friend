import { useEffect, useState } from "react";
import {
  type BattleState,
  type CharacterState,
  type DiceRolled,
  type FogPaintMode,
  type InitiativeState,
  type MapState,
  type PortalState,
  type SessionEvent,
  type TokenState,
  type VisibilityState,
} from "@dms/shared";
import type { FogToolMode } from "../canvas/useMapScene";
import {
  isHudCollapsed,
  loadPlayHudPrefs,
  savePlayHudPrefs,
  toggleHudCollapsed,
  type HudSectionId,
  type PlayHudPrefs,
} from "../lib/playHudPrefs";
import { HudBottomStrip } from "./HudBottomStrip";
import { HudDice } from "./HudDice";
import { HudFog } from "./HudFog";
import { HudInitiative } from "./HudInitiative";
import { HudPanel } from "./HudPanel";

type Props = {
  roomCode: string;
  maps: MapState[];
  activeMap: MapState | null;
  visibility: VisibilityState;
  tokens: TokenState[];
  characters: CharacterState[];
  initiative: InitiativeState | null;
  events: SessionEvent[];
  battle: BattleState | null;
  lastDice: DiceRolled | null;
  recentDice: DiceRolled[];
  hasLosGeometry: boolean;
  portals: PortalState[];
  losEnabled: boolean;
  fogTool: FogToolMode;
  fogPaintMode: FogPaintMode;
  fogBrushRadius: number;
  onFogToolChange: (tool: FogToolMode) => void;
  onFogPaintModeChange: (mode: FogPaintMode) => void;
  onFogBrushRadiusChange: (radius: number) => void;
  onPortalToggle: (portalId: string, closed: boolean) => void;
};

export function PlayHud({
  roomCode,
  maps,
  activeMap,
  visibility,
  tokens,
  characters,
  initiative,
  events,
  battle,
  lastDice,
  recentDice,
  hasLosGeometry,
  portals,
  losEnabled,
  fogTool,
  fogPaintMode,
  fogBrushRadius,
  onFogToolChange,
  onFogPaintModeChange,
  onFogBrushRadiusChange,
  onPortalToggle,
}: Props) {
  const [prefs, setPrefs] = useState<PlayHudPrefs | null>(null);

  useEffect(() => {
    setPrefs(loadPlayHudPrefs(roomCode));
  }, [roomCode]);

  if (!prefs) {
    return null;
  }

  function patch(next: PlayHudPrefs) {
    setPrefs(next);
    savePlayHudPrefs(roomCode, next);
  }

  function toggle(id: HudSectionId) {
    patch(toggleHudCollapsed(prefs!, id));
  }

  return (
    <div className="play-hud" aria-label="GM play HUD">
      <div className="play-hud__left stack">
        <HudPanel
          title="Dice"
          collapsed={isHudCollapsed(prefs, "dice")}
          onToggleCollapsed={() => toggle("dice")}
        >
          <HudDice lastDice={lastDice} recent={recentDice} />
        </HudPanel>
        <HudPanel
          title="Initiative"
          collapsed={isHudCollapsed(prefs, "initiative")}
          onToggleCollapsed={() => toggle("initiative")}
        >
          <HudInitiative
            tokens={tokens}
            characters={characters}
            initiative={initiative}
            visibility={visibility}
          />
        </HudPanel>
      </div>

      <div className="play-hud__right">
        <HudFog
          mapId={activeMap?.id ?? null}
          hasLosGeometry={hasLosGeometry}
          portals={portals}
          losEnabled={losEnabled}
          tool={fogTool}
          paintMode={fogPaintMode}
          brushRadius={fogBrushRadius}
          onToolChange={onFogToolChange}
          onPaintModeChange={onFogPaintModeChange}
          onBrushRadiusChange={onFogBrushRadiusChange}
          onPortalToggle={onPortalToggle}
        />
      </div>

      <div className="play-hud__bottom">
        <HudBottomStrip
          maps={maps}
          activeMap={activeMap}
          events={events}
          battle={battle}
          logCollapsed={isHudCollapsed(prefs, "log")}
          onToggleLog={() => toggle("log")}
          canNext={Boolean(initiative?.order.length)}
        />
      </div>
    </div>
  );
}
