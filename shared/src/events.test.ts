import { describe, expect, it } from "vitest";
import {
  BattleStateSchema,
  CharacterSetConditionsPayloadSchema,
  CharacterSetHpPayloadSchema,
  CharacterUpsertPayloadSchema,
  FogPaintPayloadSchema,
  FogStateSchema,
  MapActivatePayloadSchema,
  RoomCreatePayloadSchema,
  RoomJoinPayloadSchema,
  SessionEventSchema,
  SnapshotSchema,
  TokenMovePayloadSchema,
  VisibilitySetPayloadSchema,
  hpToQuarter,
} from "./events.js";

describe("event schemas", () => {
  it("accepts a valid room join payload", () => {
    const parsed = RoomJoinPayloadSchema.parse({
      code: "ABC123",
      role: "gm",
      pin: "1234",
      invite: "invite-token-value",
    });
    expect(parsed.role).toBe("gm");
    expect(parsed.pin).toBe("1234");
  });

  it("accepts room create payloads and rejects bad codes", () => {
    expect(
      RoomCreatePayloadSchema.parse({ code: "Friday-Table", pin: "2468", name: "Quest" }).code,
    ).toBe("Friday-Table");
    expect(() => RoomCreatePayloadSchema.parse({ code: "ab", pin: "1234" })).toThrow();
    expect(() => RoomCreatePayloadSchema.parse({ code: "GOOD", pin: "12" })).toThrow();
  });

  it("maps HP into quarter steps", () => {
    expect(hpToQuarter(0, 100)).toBe(0);
    expect(hpToQuarter(25, 100)).toBe(1);
    expect(hpToQuarter(50, 100)).toBe(2);
    expect(hpToQuarter(75, 100)).toBe(3);
    expect(hpToQuarter(100, 100)).toBe(4);
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
      hpCurrent: 18,
      hpMax: 24,
      ac: 15,
    });
    expect(character.kind).toBe("pc");
    expect(character.notes).toBe("Scout");
    expect(character.hpMax).toBe(24);
    expect(character.ac).toBe(15);
    expect(VisibilitySetPayloadSchema.parse({ showNpcs: false }).showNpcs).toBe(false);
  });

  it("accepts character HP adjust payloads", () => {
    expect(CharacterSetHpPayloadSchema.parse({ characterId: "c1", delta: -3 }).delta).toBe(-3);
    expect(
      CharacterSetHpPayloadSchema.parse({ characterId: "c1", hpCurrent: 10, hpMax: 20 }).hpCurrent,
    ).toBe(10);
    expect(() => CharacterSetHpPayloadSchema.parse({ characterId: "c1" })).toThrow();
  });

  it("accepts character condition payloads", () => {
    expect(
      CharacterSetConditionsPayloadSchema.parse({
        characterId: "c1",
        conditions: ["prone", "frightened"],
      }).conditions,
    ).toEqual(["prone", "frightened"]);
    expect(
      CharacterSetConditionsPayloadSchema.parse({ characterId: "c1", conditions: [] }).conditions,
    ).toEqual([]);
    expect(() =>
      CharacterSetConditionsPayloadSchema.parse({
        characterId: "c1",
        conditions: ["flying"],
      }),
    ).toThrow();
  });

  it("accepts a prep/play snapshot shape", () => {
    const snapshot = SnapshotSchema.parse({
      room: { id: "r1", code: "ABC123", name: "Table" },
      map: null,
      maps: [],
      tokens: [],
      characters: [],
      visibility: { showPcs: true, showNpcs: true },
      settings: { screenHpQuarters: false },
      camera: null,
      initiative: { order: [], activeIndex: 0, round: 1 },
      eventLog: [],
      battle: null,
      fog: null,
      role: "gm",
      playerName: null,
      characterId: null,
    });
    expect(snapshot.visibility.showPcs).toBe(true);
    expect(snapshot.settings.screenHpQuarters).toBe(false);
    expect(snapshot.characterId).toBeNull();
  });

  it("accepts player join with characterId claim", () => {
    const parsed = RoomJoinPayloadSchema.parse({
      code: "ABC123",
      role: "player",
      characterId: "char-1",
    });
    expect(parsed.characterId).toBe("char-1");
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
    const diceEvent = SessionEventSchema.parse({
      id: 2,
      roomId: "r1",
      battleId: null,
      type: "dice_roll",
      summary: "GM: 2d6+3 → 11",
      payload: { expr: "2d6+3", total: 11, results: [4, 4] },
      createdAt: "2026-11-11T18:01:00.000Z",
    });
    expect(diceEvent.type).toBe("dice_roll");
    const battle = BattleStateSchema.parse({
      id: "b1",
      roomId: "r1",
      startedAt: "2026-11-11T18:00:00.000Z",
      endedAt: null,
    });
    expect(battle.endedAt).toBeNull();
  });
});
