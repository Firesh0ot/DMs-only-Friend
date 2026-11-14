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
  remainingCells = null,
  movement = null,
}: Props) {
  const budget =
    movement ??
    (remainingCells !== null && remainingCells !== undefined
      ? { tokenId: null, turnStart: null, remainingCells, active: true }
      : null);

  return (
    <TurnCarousel
      role="gm"
      initiative={initiative}
      tokens={tokens}
      characters={characters}
      visibility={visibility}
      movement={budget}
      compact
    />
  );
}
