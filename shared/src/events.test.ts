import { describe, expect, it } from "vitest";
import { RoomJoinPayloadSchema, TokenMovePayloadSchema } from "./events.js";

describe("event schemas", () => {
  it("accepts a valid room join payload", () => {
    const parsed = RoomJoinPayloadSchema.parse({
      code: "ABC123",
      role: "gm",
    });
    expect(parsed.role).toBe("gm");
  });

  it("rejects invalid roles", () => {
    expect(() =>
      RoomJoinPayloadSchema.parse({
        code: "ABC123",
        role: "admin",
      }),
    ).toThrow();
  });

  it("accepts token move coordinates", () => {
    const parsed = TokenMovePayloadSchema.parse({
      tokenId: "tok-1",
      x: 3.5,
      y: 2,
    });
    expect(parsed.x).toBe(3.5);
  });
});
