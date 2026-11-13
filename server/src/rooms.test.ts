import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { openDb } from "./db.js";
import { RoomStore } from "./rooms.js";

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function createStore(): RoomStore {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dms-rooms-"));
  tempDirs.push(dir);
  const db = openDb(path.join(dir, "test.sqlite"));
  return new RoomStore(db);
}

describe("RoomStore", () => {
  it("creates a room and returns a snapshot on join data", () => {
    const store = createStore();
    const { room, code, gmInviteToken } = store.createRoom({
      name: "Forest Table",
      code: "Forest1",
      pin: "4242",
    });
    expect(code).toBe("FOREST1");
    expect(gmInviteToken.length).toBeGreaterThan(8);
    expect(store.getRoomByCode(code)?.id).toBe(room.id);
    expect(() =>
      store.createRoom({ name: "Dup", code: "forest1", pin: "9999" }),
    ).toThrow(/already taken/);

    const snapshot = store.getSnapshot(room.id, "gm", null);
    expect(snapshot.room.name).toBe("Forest Table");
    expect(snapshot.map).toBeNull();
    expect(snapshot.maps).toEqual([]);
    expect(snapshot.characters).toEqual([]);
    expect(snapshot.visibility).toEqual({ showPcs: true, showNpcs: true });
    expect(snapshot.settings).toEqual({ screenHpQuarters: false, physicalCellCm: null });
    expect(snapshot.tokens).toEqual([]);
    expect(snapshot.eventLog).toEqual([]);
    expect(snapshot.battle).toBeNull();
  });

  it("persists physicalCellCm via settings", () => {
    const store = createStore();
    const { room } = store.createRoom({ name: "Table", code: "PHYS1", pin: "4242" });
    expect(store.getSettings(room.id).physicalCellCm).toBeNull();
    const updated = store.setSettings(room.id, { physicalCellCm: 3 });
    expect(updated.physicalCellCm).toBe(3);
    expect(store.getSettings(room.id).physicalCellCm).toBe(3);
    expect(store.setSettings(room.id, { physicalCellCm: null }).physicalCellCm).toBeNull();
  });

  it("accepts Unicode room codes and keeps uniqueness after normalization", () => {
    const store = createStore();
    const { code } = store.createRoom({
      name: "Märchenstunde",
      code: "dörfer",
      pin: "4242",
    });
    expect(code).toBe("DÖRFER");
    expect(store.getRoomByCode("dörfer")?.code).toBe("DÖRFER");
    expect(store.getRoomByCode("DÖRFER")?.code).toBe("DÖRFER");
    expect(() =>
      store.createRoom({ name: "Dup", code: "DÖRFER", pin: "9999" }),
    ).toThrow(/already taken/);

    const sharp = store.createRoom({
      name: "Alley",
      code: "straße",
      pin: "1357",
    });
    expect(sharp.code).toBe("STRASSE");
    expect(() =>
      store.createRoom({ name: "Dup2", code: "strasse", pin: "2468" }),
    ).toThrow(/already taken/);
  });

  it("requires PIN and single-use invite for first GM claim", () => {
    const store = createStore();
    const { room, gmInviteToken } = store.createRoom({
      name: "Gate",
      code: "GATE-ROOM",
      pin: "1357",
    });
    expect(store.requiresGmInvite(room.id)).toBe(true);
    expect(() => store.assertGmJoin(room.id, undefined, gmInviteToken)).toThrow(/PIN/);
    expect(() => store.assertGmJoin(room.id, "1357", undefined)).toThrow(/invite/);
    expect(() => store.assertGmJoin(room.id, "0000", gmInviteToken)).toThrow(/Invalid GM PIN/);
    store.assertGmJoin(room.id, "1357", gmInviteToken);
    expect(store.hasPendingGmInvite(room.id)).toBe(false);
    expect(store.requiresGmInvite(room.id)).toBe(false);
    expect(store.isGmClaimed(room.id)).toBe(true);
    store.assertGmJoin(room.id, "1357", undefined);
    const upload = store.issueUploadToken(room.id);
    expect(store.validateUploadToken(upload, room.id)).toBe(true);
    expect(store.validateUploadToken("nope", room.id)).toBe(false);
  });

  it("allows PIN-only GM rejoin after claim even when a reminted invite is pending", () => {
    const store = createStore();
    const { room, gmInviteToken } = store.createRoom({
      name: "Rejoin",
      code: "REJOIN1",
      pin: "2468",
    });
    store.assertGmJoin(room.id, "2468", gmInviteToken);
    expect(store.isGmClaimed(room.id)).toBe(true);

    const reminted = store.mintGmInvite(room.id);
    expect(store.hasPendingGmInvite(room.id)).toBe(true);
    expect(store.requiresGmInvite(room.id)).toBe(false);
    store.assertGmJoin(room.id, "2468", undefined);
    expect(store.hasPendingGmInvite(room.id)).toBe(true);

    store.assertGmJoin(room.id, "2468", reminted);
    expect(store.hasPendingGmInvite(room.id)).toBe(false);
    store.assertGmJoin(room.id, "2468", undefined);
  });

  it("lets an authenticated flow change the PIN and optionally clear invites", () => {
    const store = createStore();
    const { room, gmInviteToken } = store.createRoom({
      name: "PinChange",
      code: "PIN-ROOM",
      pin: "1111",
    });
    expect(store.hasPendingGmInvite(room.id)).toBe(true);

    expect(() =>
      store.changeGmPin(room.id, {
        currentPin: "0000",
        newPin: "2222",
      }),
    ).toThrow(/Invalid GM PIN/);

    const kept = store.changeGmPin(room.id, {
      currentPin: "1111",
      newPin: "2222",
      invalidateInvites: false,
    });
    expect(kept.inviteInvalidated).toBe(false);
    expect(store.hasPendingGmInvite(room.id)).toBe(true);
    expect(store.verifyGmPin(room.id, "1111")).toBe(false);
    expect(store.verifyGmPin(room.id, "2222")).toBe(true);
    store.assertGmJoin(room.id, "2222", gmInviteToken);
    expect(store.hasPendingGmInvite(room.id)).toBe(false);

    store.mintGmInvite(room.id);
    expect(store.hasPendingGmInvite(room.id)).toBe(true);
    const cleared = store.changeGmPin(room.id, {
      currentPin: "2222",
      newPin: "3333",
      invalidateInvites: true,
    });
    expect(cleared.inviteInvalidated).toBe(true);
    expect(store.hasPendingGmInvite(room.id)).toBe(false);
    expect(store.verifyGmPin(room.id, "3333")).toBe(true);
    expect(store.verifyGmPin(room.id, "2222")).toBe(false);
    store.assertGmJoin(room.id, "3333", undefined);
  });

  it("persists tokens and camera", () => {
    const store = createStore();
    const { room } = store.createRoom();
    const token = store.createToken({
      roomId: room.id,
      label: "Aria",
      x: 2,
      y: 3,
      isPlayer: true,
    });
    store.setCamera(room.id, { x: 10, y: 20, zoom: 1.5 });

    const snapshot = store.getSnapshot(room.id, "screen", null);
    expect(snapshot.tokens).toHaveLength(1);
    expect(snapshot.tokens[0]?.label).toBe("Aria");
    expect(snapshot.camera).toEqual({ x: 10, y: 20, zoom: 1.5 });

    const moved = store.moveToken(token.id, 4, 5);
    expect(moved.x).toBe(4);
    expect(moved.y).toBe(5);
  });
});
