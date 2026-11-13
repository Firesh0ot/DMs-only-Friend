import { describe, expect, it } from "vitest";
import { toReconnectCredentials } from "./joinCredentials";

describe("toReconnectCredentials", () => {
  it("drops single-use invite but keeps PIN and claim fields", () => {
    expect(
      toReconnectCredentials({
        code: "TABLE1",
        role: "gm",
        pin: "1234",
        invite: "used-once",
      }),
    ).toEqual({
      code: "TABLE1",
      role: "gm",
      name: undefined,
      characterId: undefined,
      pin: "1234",
    });
  });

  it("keeps player character claim for reconnect", () => {
    expect(
      toReconnectCredentials({
        code: "TABLE1",
        role: "player",
        name: "Aria",
        characterId: "char-1",
      }),
    ).toEqual({
      code: "TABLE1",
      role: "player",
      name: "Aria",
      characterId: "char-1",
      pin: undefined,
    });
  });
});
