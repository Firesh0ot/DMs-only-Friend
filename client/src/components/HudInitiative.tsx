import type {
  CharacterState,
  InitiativeState,
  MovementBudget,
  TokenState,
  VisibilityState,
} from "@dms/shared";
import { TurnCarousel } from "./turn/TurnCarousel";

type Props = {
  tokens: TokenState[];
  characters: CharacterState[];
  initiative: InitiativeState | null;
  visibility: VisibilityState;
  remainingCells?: number | null;
  movement?: MovementBudget | null;
};

export function HudInitiative({
  tokens,
  characters,
  initiative,
  visibility,
  movement = null,
}: Props) {
  return (
    <TurnCarousel
      role="gm"
      initiative={initiative}
      tokens={tokens}
      characters={characters}
      visibility={visibility}
      movement={movement}
      compact
    />
  );
}
