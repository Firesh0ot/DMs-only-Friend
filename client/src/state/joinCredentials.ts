import type { Role } from "@dms/shared";

export type JoinCredentials = {
  code: string;
  role: Role;
  name?: string;
  characterId?: string;
  pin?: string;
};

export function toReconnectCredentials(options: {
  code: string;
  role: Role;
  name?: string;
  characterId?: string;
  pin?: string;
  invite?: string;
}): JoinCredentials {
  return {
    code: options.code,
    role: options.role,
    name: options.name,
    characterId: options.characterId,
    pin: options.pin,
  };
}
