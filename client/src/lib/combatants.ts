import {
  shouldShowTokenForAudience,
  type CharacterState,
  type FogState,
  type MapState,
  type TokenState,
} from "@dms/shared";

export function isTokenDiscoveredForDefaults(
  token: TokenState,
  character: CharacterState | undefined,
  map: MapState | null,
  fog: FogState | null,
  tokens: TokenState[],
): boolean {
  const isPc = character?.kind === "pc" || token.isPlayer;
  if (isPc) {
    return true;
  }
  if (token.discovered) {
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
}

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
      return isTokenDiscoveredForDefaults(token, character, map, fog, tokens);
    })
    .map((token) => token.id);
}
