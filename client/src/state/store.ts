import { useSyncExternalStore } from 'react';
import type { BoardData, MiniGamePrivate, Snapshot } from '../types/contracts';

export type ConnectionStatus = 'connecting' | 'connected' | 'reconnecting' | 'disconnected';
export type MenuScreen = 'menu' | 'host' | 'join';

export interface Toast {
  id: number;
  text: string;
  kind: 'error' | 'info' | 'success';
}

export interface AppState {
  connection: ConnectionStatus;
  menuScreen: MenuScreen;
  playerId: string | null;
  snapshot: Snapshot | null;
  privateState: MiniGamePrivate | null;
  board: BoardData | null;
  toasts: Toast[];
  settingsOpen: boolean;
  howToOpen: boolean;
  /** True while the client is trying to resume a saved session after load/reconnect. */
  resuming: boolean;
}

type Listener = () => void;

/** Tiny global store (no external state library needed). */
class Store {
  private state: AppState = {
    connection: 'connecting',
    // Invite links (?join=CODE) open the join form straight away.
    menuScreen: new URLSearchParams(window.location.search).has('join') ? 'join' : 'menu',
    playerId: null,
    snapshot: null,
    privateState: null,
    board: null,
    toasts: [],
    settingsOpen: false,
    howToOpen: false,
    resuming: false,
  };
  private listeners = new Set<Listener>();
  private toastId = 0;

  get = () => this.state;

  subscribe = (l: Listener) => {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  };

  set(patch: Partial<AppState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((l) => l());
  }

  toast(text: string, kind: Toast['kind'] = 'error') {
    const id = ++this.toastId;
    this.set({ toasts: [...this.state.toasts.slice(-3), { id, text, kind }] });
    window.setTimeout(() => this.set({ toasts: this.state.toasts.filter((t) => t.id !== id) }), 3200);
  }

  leaveLobbyLocally() {
    this.set({ snapshot: null, playerId: null, privateState: null, menuScreen: 'menu' });
  }
}

export const store = new Store();

export function useStore<T>(selector: (s: AppState) => T): T {
  return useSyncExternalStore(store.subscribe, () => selector(store.get()));
}

export function useMe() {
  return useStore((s) => s.snapshot?.players.find((p) => p.playerId === s.playerId) ?? null);
}
