import {
  shouldShowTokenForAudience,
  type CharacterState,
  type FogState,
  type MapState,
  type TokenState,
} from "@dms/shared";

export function defaultCombatantTokenIds(
  tokens: TokenState[],
  characters: CharacterState[],
  map: MapState | null,
  fog: FogState | null,
): string[] {
  const byCharacter = new Map(characters.map((character) => [character.id, character]));
  return tokens
    .filter((token) => {
      const character = token.characterId ? byCharacter.get(token.characterId) : undefined;
      const isPc = character?.kind === "pc" || token.isPlayer;
      if (isPc) {
        return true;
      }
      if (!map) {
        return true;
      }
      return shouldShowTokenForAudience({
        role: "screen",
        token,
        map,
        fog,
        tokens,
      });
    })
    .map((token) => token.id);
}
