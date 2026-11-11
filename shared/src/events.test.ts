import { describe, expect, it } from "vitest";
import {
  CharacterUpsertPayloadSchema,
  MapActivatePayloadSchema,
  RoomJoinPayloadSchema,
  SnapshotSchema,
  TokenMovePayloadSchema,
  VisibilitySetPayloadSchema,
} from "./events.js";

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

  it("accepts map activate and character upsert payloads", () => {
    expect(MapActivatePayloadSchema.parse({ mapId: "map-1" }).mapId).toBe("map-1");
    const character = CharacterUpsertPayloadSchema.parse({
      name: "Aria",
      kind: "pc",
      mapIds: ["map-1"],
    });
    expect(character.kind).toBe("pc");
    expect(VisibilitySetPayloadSchema.parse({ showNpcs: false }).showNpcs).toBe(false);
  });

  it("accepts a prep/play snapshot shape", () => {
    const snapshot = SnapshotSchema.parse({
      room: { id: "r1", code: "ABC123", name: "Table" },
      map: null,
      maps: [],
      tokens: [],
      characters: [],
      visibility: { showPcs: true, showNpcs: true },
      camera: null,
      initiative: { order: [], activeIndex: 0, round: 1 },
      role: "gm",
      playerName: null,
    });
    expect(snapshot.visibility.showPcs).toBe(true);
  });
});
