import {
  ClientEvents,
  ServerEvents,
  type BattleState,
  type CameraState,
  type CharacterState,
  type DiceRolled,
  type FogState,
  type InitiativeState,
  type MapState,
  type MovementBudget,
  type Role,
  type RoomSettings,
  type SessionEvent,
  type Snapshot,
  type SpawnPoint,
  type TokenState,
  type VisibilityState,
} from "@dms/shared";
import { create } from "zustand";
import { getSocket } from "../socket/socket";
import { toReconnectCredentials, type JoinCredentials } from "./joinCredentials";

type JoinOptions = {
  code: string;
  role: Role;
  name?: string;
  characterId?: string;
  pin?: string;
  invite?: string;
};

type RoomStore = {
  connected: boolean;
  joining: boolean;
  error: string | null;
  snapshot: Snapshot | null;
  uploadToken: string | null;
  joinCredentials: JoinCredentials | null;
  lastDice: DiceRolled | null;
  recentDice: DiceRolled[];
  optimisticTokens: Record<string, TokenState>;
  joinRoom: (options: JoinOptions) => Promise<void>;
  clearJoinCredentials: () => void;
  applySnapshot: (snapshot: Snapshot) => void;
  setMap: (map: MapState | null) => void;
  setMaps: (maps: MapState[]) => void;
  setTokens: (tokens: TokenState[]) => void;
  setCharacters: (characters: CharacterState[]) => void;
  setVisibility: (visibility: VisibilityState) => void;
  setSettings: (settings: RoomSettings) => void;
  upsertToken: (token: TokenState) => void;
  removeToken: (tokenId: string) => void;
  setCamera: (camera: CameraState) => void;
  setInitiative: (initiative: InitiativeState) => void;
  appendEvent: (event: SessionEvent) => void;
  setBattle: (battle: BattleState | null) => void;
  pushDice: (dice: DiceRolled) => void;
  setFog: (fog: FogState | null) => void;
  setSpawnPoints: (mapId: string, points: SpawnPoint[]) => void;
  setMovement: (movement: MovementBudget | null) => void;
  moveTokenOptimistic: (tokenId: string, x: number, y: number) => void;
  clearError: () => void;
  lastMovementReject: { tokenId: string; reason: string } | null;
  clearMovementReject: () => void;
};

export const useRoomStore = create<RoomStore>((set, get) => ({
  connected: false,
  joining: false,
  error: null,
  snapshot: null,
  uploadToken: null,
  joinCredentials: null,
  lastDice: null,
  recentDice: [],
  optimisticTokens: {},
  lastMovementReject: null,

  clearError: () => set({ error: null }),
  clearMovementReject: () => set({ lastMovementReject: null }),
  clearJoinCredentials: () => set({ joinCredentials: null, uploadToken: null }),

  applySnapshot: (snapshot) =>
    set({
      snapshot,
      optimisticTokens: {},
      error: null,
      joining: false,
      lastDice: null,
      recentDice: [],
    }),

  setMap: (map) => {
    const snapshot = get().snapshot;
    if (!snapshot) {
      return;
    }
    set({ snapshot: { ...snapshot, map } });
  },

  setMaps: (maps) => {
    const snapshot = get().snapshot;
    if (!snapshot) {
      return;
    }
    set({ snapshot: { ...snapshot, maps } });
  },

  setTokens: (tokens) => {
    const snapshot = get().snapshot;
    if (!snapshot) {
      return;
    }
    set({ snapshot: { ...snapshot, tokens }, optimisticTokens: {} });
  },

  setCharacters: (characters) => {
    const snapshot = get().snapshot;
    if (!snapshot) {
      return;
    }
    set({ snapshot: { ...snapshot, characters } });
  },

  setVisibility: (visibility) => {
    const snapshot = get().snapshot;
    if (!snapshot) {
      return;
    }
    set({ snapshot: { ...snapshot, visibility } });
  },

  setSettings: (settings) => {
    const snapshot = get().snapshot;
    if (!snapshot) {
      return;
    }
    set({ snapshot: { ...snapshot, settings } });
  },

  upsertToken: (token) => {
    const snapshot = get().snapshot;
    if (!snapshot) {
      return;
    }
    const tokens = snapshot.tokens.filter((entry) => entry.id !== token.id);
    tokens.push(token);
    const optimisticTokens = { ...get().optimisticTokens };
    delete optimisticTokens[token.id];
    set({
      snapshot: { ...snapshot, tokens },
      optimisticTokens,
    });
  },

  removeToken: (tokenId) => {
    const snapshot = get().snapshot;
    if (!snapshot) {
      return;
    }
    const optimisticTokens = { ...get().optimisticTokens };
    delete optimisticTokens[tokenId];
    set({
      snapshot: {
        ...snapshot,
        tokens: snapshot.tokens.filter((token) => token.id !== tokenId),
      },
      optimisticTokens,
    });
  },

  setCamera: (camera) => {
    const snapshot = get().snapshot;
    if (!snapshot) {
      return;
    }
    set({ snapshot: { ...snapshot, camera } });
  },

  setInitiative: (initiative) => {
    const snapshot = get().snapshot;
    if (!snapshot) {
      return;
    }
    set({ snapshot: { ...snapshot, initiative } });
  },

  appendEvent: (event) => {
    const snapshot = get().snapshot;
    if (!snapshot) {
      return;
    }
    const without = snapshot.eventLog.filter((entry) => entry.id !== event.id);
    const eventLog = [...without, event].slice(-120);
    set({ snapshot: { ...snapshot, eventLog } });
  },

  setBattle: (battle) => {
    const snapshot = get().snapshot;
    if (!snapshot) {
      return;
    }
    set({ snapshot: { ...snapshot, battle } });
  },

  pushDice: (dice) => {
    const without = get().recentDice.filter((entry) => entry.id !== dice.id);
    set({
      lastDice: dice,
      recentDice: [dice, ...without].slice(0, 12),
    });
  },

  setFog: (fog) => {
    const snapshot = get().snapshot;
    if (!snapshot) {
      return;
    }
    set({ snapshot: { ...snapshot, fog } });
  },

  setSpawnPoints: (mapId, points) => {
    const snapshot = get().snapshot;
    if (!snapshot) {
      return;
    }
    const others = snapshot.spawnPoints.filter((point) => point.mapId !== mapId);
    set({ snapshot: { ...snapshot, spawnPoints: [...others, ...points] } });
  },

  setMovement: (movement) => {
    const snapshot = get().snapshot;
    if (!snapshot) {
      return;
    }
    set({ snapshot: { ...snapshot, movement } });
  },

  moveTokenOptimistic: (tokenId, x, y) => {
    const snapshot = get().snapshot;
    if (!snapshot) {
      return;
    }
    const current =
      get().optimisticTokens[tokenId] ?? snapshot.tokens.find((token) => token.id === tokenId);
    if (!current) {
      return;
    }
    set({
      optimisticTokens: {
        ...get().optimisticTokens,
        [tokenId]: { ...current, x, y },
      },
    });
  },

  joinRoom: async ({ code, role, name, characterId, pin, invite }) => {
    const socket = getSocket();
    set({ joining: true, error: null, uploadToken: null });

    try {
      if (!socket.connected) {
        await new Promise<void>((resolve, reject) => {
          const timer = window.setTimeout(() => {
            reject(new Error("Could not connect to server"));
          }, 12_000);
          const onConnect = () => {
            window.clearTimeout(timer);
            socket.off("connect_error", onError);
            resolve();
          };
          const onError = (err: Error) => {
            window.clearTimeout(timer);
            socket.off("connect", onConnect);
            reject(err);
          };
          socket.once("connect", onConnect);
          socket.once("connect_error", onError);
        });
      }

      await new Promise<void>((resolve, reject) => {
        socket.emit(
          ClientEvents.RoomJoin,
          { code, role, name, characterId, pin, invite },
          (result) => {
            if (!result?.ok) {
              const message = result?.error ?? "Join failed";
              set({ joining: false, error: message });
              reject(new Error(message));
              return;
            }
            get().applySnapshot(result.snapshot);
            set({
              uploadToken: result.uploadToken ?? null,
              joinCredentials: toReconnectCredentials({
                code,
                role,
                name,
                characterId,
                pin,
              }),
            });
            resolve();
          },
        );
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Join failed";
      set({ joining: false, error: message });
      throw error instanceof Error ? error : new Error(message);
    }
  },
}));

let listenersBound = false;

export function bindSocketListeners(): void {
  if (listenersBound) {
    return;
  }
  listenersBound = true;
  const socket = getSocket();
  const store = useRoomStore.getState;

  socket.on("connect", () => useRoomStore.setState({ connected: true }));
  socket.on("disconnect", () => useRoomStore.setState({ connected: false }));
  socket.io.on("reconnect", () => {
    const { joinCredentials, joining, joinRoom } = store();
    if (!joinCredentials || joining) {
      return;
    }
    void joinRoom(joinCredentials).catch(() => undefined);
  });

  socket.on(ServerEvents.Snapshot, (snapshot) => store().applySnapshot(snapshot));
  socket.on(ServerEvents.MapSet, (map) => store().setMap(map));
  socket.on(ServerEvents.MapsUpdated, (maps) => store().setMaps(maps));
  socket.on(ServerEvents.TokensSynced, (tokens) => store().setTokens(tokens));
  socket.on(ServerEvents.CharactersUpdated, (characters) => store().setCharacters(characters));
  socket.on(ServerEvents.VisibilityUpdated, (visibility) => store().setVisibility(visibility));
  socket.on(ServerEvents.SettingsUpdated, (settings) => store().setSettings(settings));
  socket.on(ServerEvents.TokenCreated, (token) => store().upsertToken(token));
  socket.on(ServerEvents.TokenMoved, (token) => store().upsertToken(token));
  socket.on(ServerEvents.TokenRemoved, ({ tokenId }) => store().removeToken(tokenId));
  socket.on(ServerEvents.CameraSet, (camera) => store().setCamera(camera));
  socket.on(ServerEvents.InitiativeUpdated, (initiative) => store().setInitiative(initiative));
  socket.on(ServerEvents.LogAppended, (event) => store().appendEvent(event));
  socket.on(ServerEvents.BattleUpdated, (battle) => store().setBattle(battle));
  socket.on(ServerEvents.FogUpdated, (fog) => store().setFog(fog));
  socket.on(ServerEvents.SpawnUpdated, ({ mapId, points }) => store().setSpawnPoints(mapId, points));
  socket.on(ServerEvents.MovementUpdated, (movement) => store().setMovement(movement));
  socket.on(ServerEvents.MovementRejected, ({ tokenId, reason }) => {
    const optimisticTokens = { ...store().optimisticTokens };
    delete optimisticTokens[tokenId];
    useRoomStore.setState({
      optimisticTokens,
      lastMovementReject: { tokenId, reason },
    });
  });
  socket.on(ServerEvents.DiceRolled, (dice) => store().pushDice(dice));
  socket.on(ServerEvents.Error, ({ message }) => useRoomStore.setState({ error: message }));
}

const EMPTY_TOKENS: TokenState[] = [];

export function selectVisibleTokens(state: RoomStore): TokenState[] {
  const snapshot = state.snapshot;
  if (!snapshot) {
    return EMPTY_TOKENS;
  }
  if (Object.keys(state.optimisticTokens).length === 0) {
    return snapshot.tokens;
  }
  return snapshot.tokens.map((token) => state.optimisticTokens[token.id] ?? token);
}
