import {
  ClientEvents,
  ServerEvents,
  type CameraState,
  type CharacterState,
  type DiceRolled,
  type InitiativeState,
  type MapState,
  type Role,
  type Snapshot,
  type TokenState,
  type VisibilityState,
} from "@dms/shared";
import { create } from "zustand";
import { getSocket } from "../socket/socket";

type RoomStore = {
  connected: boolean;
  joining: boolean;
  error: string | null;
  snapshot: Snapshot | null;
  lastDice: DiceRolled | null;
  optimisticTokens: Record<string, TokenState>;
  joinRoom: (code: string, role: Role, name?: string) => Promise<void>;
  applySnapshot: (snapshot: Snapshot) => void;
  setMap: (map: MapState | null) => void;
  setMaps: (maps: MapState[]) => void;
  setTokens: (tokens: TokenState[]) => void;
  setCharacters: (characters: CharacterState[]) => void;
  setVisibility: (visibility: VisibilityState) => void;
  upsertToken: (token: TokenState) => void;
  removeToken: (tokenId: string) => void;
  setCamera: (camera: CameraState) => void;
  setInitiative: (initiative: InitiativeState) => void;
  moveTokenOptimistic: (tokenId: string, x: number, y: number) => void;
  clearError: () => void;
};

export const useRoomStore = create<RoomStore>((set, get) => ({
  connected: false,
  joining: false,
  error: null,
  snapshot: null,
  lastDice: null,
  optimisticTokens: {},

  clearError: () => set({ error: null }),

  applySnapshot: (snapshot) =>
    set({
      snapshot,
      optimisticTokens: {},
      error: null,
      joining: false,
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

  joinRoom: async (code, role, name) => {
    const socket = getSocket();
    set({ joining: true, error: null });

    await new Promise<void>((resolve, reject) => {
      socket.emit(ClientEvents.RoomJoin, { code, role, name }, (result) => {
        if (!result?.ok) {
          const message = result?.error ?? "Join failed";
          set({ joining: false, error: message });
          reject(new Error(message));
          return;
        }
        get().applySnapshot(result.snapshot);
        resolve();
      });
    });
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

  socket.on(ServerEvents.Snapshot, (snapshot) => store().applySnapshot(snapshot));
  socket.on(ServerEvents.MapSet, (map) => store().setMap(map));
  socket.on(ServerEvents.MapsUpdated, (maps) => store().setMaps(maps));
  socket.on(ServerEvents.TokensSynced, (tokens) => store().setTokens(tokens));
  socket.on(ServerEvents.CharactersUpdated, (characters) => store().setCharacters(characters));
  socket.on(ServerEvents.VisibilityUpdated, (visibility) => store().setVisibility(visibility));
  socket.on(ServerEvents.TokenCreated, (token) => store().upsertToken(token));
  socket.on(ServerEvents.TokenMoved, (token) => store().upsertToken(token));
  socket.on(ServerEvents.TokenRemoved, ({ tokenId }) => store().removeToken(tokenId));
  socket.on(ServerEvents.CameraSet, (camera) => store().setCamera(camera));
  socket.on(ServerEvents.InitiativeUpdated, (initiative) => store().setInitiative(initiative));
  socket.on(ServerEvents.DiceRolled, (dice) => useRoomStore.setState({ lastDice: dice }));
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
