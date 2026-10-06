import type { BoardActionsDto } from '../types/contracts';

/** Server → client event names (see GameHub.cs). */
export const ServerEvents = {
  StateUpdated: 'StateUpdated',
  MiniGamePrivate: 'MiniGamePrivate',
  BoardActions: 'BoardActions',
  Notice: 'Notice',
} as const;

type EventMap = {
  boardActions: BoardActionsDto;
};

type Handler<T> = (payload: T) => void;

/** Fan-out for one-shot server events that are not part of the snapshot (animation sequences). */
class ServerEventEmitter {
  private handlers = new Map<keyof EventMap, Set<Handler<never>>>();

  on<K extends keyof EventMap>(event: K, handler: Handler<EventMap[K]>) {
    if (!this.handlers.has(event)) this.handlers.set(event, new Set());
    this.handlers.get(event)!.add(handler as Handler<never>);
    return () => this.handlers.get(event)!.delete(handler as Handler<never>);
  }

  emit<K extends keyof EventMap>(event: K, payload: EventMap[K]) {
    this.handlers.get(event)?.forEach((h) => (h as Handler<EventMap[K]>)(payload));
  }
}

export const serverEvents = new ServerEventEmitter();
