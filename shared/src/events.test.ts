import { describe, expect, it } from "vitest";
import {
  BattleStateSchema,
  CharacterSetConditionsPayloadSchema,
  CharacterSetHpPayloadSchema,
  CharacterUpsertPayloadSchema,
  FogPaintPayloadSchema,
  FogStateSchema,
  GmChangePinPayloadSchema,
  MapActivatePayloadSchema,
  MapStateSchema,
  PortalSetClosedPayloadSchema,
  RoomCodeSchema,
  RoomCreatePayloadSchema,
  RoomJoinPayloadSchema,
  SessionEventSchema,
  SettingsSetPayloadSchema,
  SnapshotSchema,
  TokenMovePayloadSchema,
  VisibilitySetPayloadSchema,
  hpToQuarter,
  normalizeRoomCode,
  roomCodeFromPathSegment,
  roomCodePathSegment,
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
    expect(parsed.code).toBe("ABC123");
  });

  it("accepts room create payloads and rejects bad codes", () => {
    expect(
      RoomCreatePayloadSchema.parse({ code: "Friday-Table", pin: "2468", name: "Quest" }).code,
    ).toBe("FRIDAY-TABLE");
    expect(() => RoomCreatePayloadSchema.parse({ code: "ab", pin: "1234" })).toThrow();
    expect(() => RoomCreatePayloadSchema.parse({ code: "GOOD", pin: "12" })).toThrow();
  });

  it("allows Unicode letters including German umlauts and ß in room codes", () => {
    expect(RoomCodeSchema.parse("dörfer")).toBe("DÖRFER");
    expect(RoomCodeSchema.parse("Märchen")).toBe("MÄRCHEN");
    expect(RoomCodeSchema.parse("straße")).toBe("STRASSE");
    expect(RoomCodeSchema.parse("über_den-hügel")).toBe("ÜBER_DEN-HÜGEL");
    expect(normalizeRoomCode("a\u0308ok")).toBe("ÄOK");
    expect(RoomCodeSchema.parse("a\u0308ok")).toBe("ÄOK");
    expect(roomCodePathSegment("dörfer")).toBe(encodeURIComponent("DÖRFER"));
    expect(roomCodeFromPathSegment(encodeURIComponent("DÖRFER"))).toBe("DÖRFER");
    expect(roomCodeFromPathSegment("friday-table")).toBe("FRIDAY-TABLE");
    expect(() => RoomCodeSchema.parse("bad code")).toThrow();
    expect(() => RoomCodeSchema.parse("code/slash")).toThrow();
    expect(() => RoomCodeSchema.parse("emoji😀")).toThrow();
    expect(() => RoomCodeSchema.parse("xx")).toThrow();
  });

  it("accepts GM PIN change payloads", () => {
    const parsed = GmChangePinPayloadSchema.parse({
      currentPin: "1234",
      newPin: "987654",
      invalidateInvites: true,
    });
    expect(parsed.newPin).toBe("987654");
    expect(parsed.invalidateInvites).toBe(true);
    expect(() =>
      GmChangePinPayloadSchema.parse({ currentPin: "12", newPin: "3456" }),
    ).toThrow();
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
      settings: { screenHpQuarters: false, physicalCellCm: null },
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
    expect(snapshot.settings.physicalCellCm).toBeNull();
    expect(snapshot.characterId).toBeNull();
  });

  it("accepts physicalCellCm on settings:set", () => {
    const parsed = SettingsSetPayloadSchema.parse({ physicalCellCm: 3 });
    expect(parsed.physicalCellCm).toBe(3);
    expect(SettingsSetPayloadSchema.parse({ physicalCellCm: null }).physicalCellCm).toBeNull();
    expect(() => SettingsSetPayloadSchema.parse({ physicalCellCm: 0.1 })).toThrow();
    expect(() => SettingsSetPayloadSchema.parse({ physicalCellCm: 50 })).toThrow();
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
    expect(fog.losEnabled).toBe(false);

    const withLos = FogStateSchema.parse({
      mapId: "map-1",
      baseCovered: false,
      strokes: [],
      losEnabled: true,
    });
    expect(withLos.losEnabled).toBe(true);
  });

  it("accepts map portals and portal toggle payloads", () => {
    const map = MapStateSchema.parse({
      id: "map-1",
      roomId: "room-1",
      name: "Dungeon",
      filename: "dungeon.png",
      width: 100,
      height: 100,
      gridPx: 70,
      offsetX: 0,
      offsetY: 0,
      walls: [],
      portals: [
        {
          id: "portal-0",
          bounds: [
            { x: 1, y: 1 },
            { x: 1, y: 2 },
          ],
          closed: true,
        },
      ],
      lights: [
        {
          id: "light-0",
          position: { x: 2, y: 2 },
          range: 3,
          intensity: 0.75,
          color: "ffcc88",
        },
      ],
    });
    expect(map.portals[0]?.freestanding).toBe(false);
    expect(map.portals[0]?.closed).toBe(true);
    expect(map.lights[0]?.shadows).toBe(true);
    expect(map.lights[0]?.color).toBe("ffcc88");

    const payload = PortalSetClosedPayloadSchema.parse({
      mapId: "map-1",
      portalId: "portal-0",
      closed: false,
    });
    expect(payload.closed).toBe(false);
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
