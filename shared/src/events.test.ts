import { describe, expect, it } from "vitest";
import {
  BattleStateSchema,
  CharacterUpsertPayloadSchema,
  FogPaintPayloadSchema,
  FogStateSchema,
  MapActivatePayloadSchema,
  RoomJoinPayloadSchema,
  SessionEventSchema,
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
      notes: "Scout",
    });
    expect(character.kind).toBe("pc");
    expect(character.notes).toBe("Scout");
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
      eventLog: [],
      battle: null,
      fog: null,
      role: "gm",
      playerName: null,
    });
    expect(snapshot.visibility.showPcs).toBe(true);
  });

  it("accepts fog paint payloads and fog state", () => {
    const brush = FogPaintPayloadSchema.parse({
      mapId: "map-1",
      stroke: {
        kind: "brush",
        mode: "reveal",
        radius: 32,
        points: [{ x: 10, y: 12 }],
      },
    });
    expect(brush.stroke.kind).toBe("brush");
    const fog = FogStateSchema.parse({
      mapId: "map-1",
      baseCovered: true,
      strokes: [
        {
          id: "s1",
          kind: "rect",
          mode: "hide",
          x: 0,
          y: 0,
          w: 40,
          h: 20,
        },
      ],
    });
    expect(fog.strokes[0]?.kind).toBe("rect");
  });

  it("accepts session log and battle schemas", () => {
    const event = SessionEventSchema.parse({
      id: 1,
      roomId: "r1",
      battleId: "b1",
      type: "battle_start",
      summary: "Battle started",
      payload: { battleId: "b1" },
      createdAt: "2026-11-11T18:00:00.000Z",
    });
    expect(event.type).toBe("battle_start");
    const battle = BattleStateSchema.parse({
      id: "b1",
      roomId: "r1",
      startedAt: "2026-11-11T18:00:00.000Z",
      endedAt: null,
    });
    expect(battle.endedAt).toBeNull();
  });
});
