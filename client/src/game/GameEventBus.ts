import type { BoardActionsDto, BoardData, Biome, PawnColor } from '../types/contracts';

/**
 * The only channel between React and Phaser. React never touches Phaser objects; it publishes
 * authoritative state and server animation sequences here, and the BoardScene reacts.
 */
export interface PawnInfo {
  playerId: string;
  name: string;
  color: PawnColor;
  position: number;
  isConnected: boolean;
  hasShield: boolean;
  doubleMovement: boolean;
}

export interface BusEvents {
  /** React → Phaser: board layout + initial pawns. Sticky (late subscribers receive the last value). */
  BOARD_INITIALIZED: { board: BoardData; players: PawnInfo[]; currentTurnPlayerId: string | null };
  /** React → Phaser: authoritative positions/status from the latest snapshot. Sticky. */
  PLAYER_POSITION_UPDATED: { players: PawnInfo[]; currentTurnPlayerId: string | null };
  /** React → Phaser: server-produced movement/effect sequence (move, portal, swap, effect, shieldBlock, finish). */
  PLAY_BOARD_ACTIONS: BoardActionsDto;
  /** React → Phaser: sweep the camera over the whole board. */
  CAMERA_OVERVIEW: Record<string, never>;
  /** Phaser → React */
  SCENE_READY: Record<string, never>;
  BIOME_CHANGED: { biome: Biome };
  ACTIONS_FINISHED: { sequence: number };
  /** Phaser → React: sound hooks so audio stays in one place. */
  SFX: { name: string };
}

type Handler<K extends keyof BusEvents> = (payload: BusEvents[K]) => void;

const STICKY: (keyof BusEvents)[] = ['BOARD_INITIALIZED', 'PLAYER_POSITION_UPDATED'];

class EventBus {
  private handlers = new Map<keyof BusEvents, Set<Handler<never>>>();
  private last = new Map<keyof BusEvents, unknown>();

  on<K extends keyof BusEvents>(event: K, handler: Handler<K>, replaySticky = true) {
    if (!this.handlers.has(event)) this.handlers.set(event, new Set());
    this.handlers.get(event)!.add(handler as Handler<never>);
    if (replaySticky && this.last.has(event)) handler(this.last.get(event) as BusEvents[K]);
    return () => {
      this.handlers.get(event)?.delete(handler as Handler<never>);
    };
  }

  emit<K extends keyof BusEvents>(event: K, payload: BusEvents[K]) {
    if (STICKY.includes(event)) this.last.set(event, payload);
    this.handlers.get(event)?.forEach((h) => (h as Handler<K>)(payload));
  }

  /** Forget cached sticky payloads (between matches). Handlers stay: each owner unsubscribes itself. */
  clearSticky() {
    this.last.clear();
  }
}

export const GameEventBus = new EventBus();
