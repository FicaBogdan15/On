import { HubConnectionBuilder, HubConnectionState, LogLevel } from '@microsoft/signalr';
import { recordClockSample, resetClock } from '../state/clock';
import { getSavedLobby, getSessionToken, saveLobby } from '../state/session';
import { store } from '../state/store';
import type {
  BoardActionsDto,
  BoardData,
  CommandResult,
  JoinResult,
  MiniGamePrivate,
  NoticeDto,
  PawnColor,
  Snapshot,
  SubmitResult,
} from '../types/contracts';
import { ServerEvents, serverEvents } from './events';

const connection = new HubConnectionBuilder()
  .withUrl('/gameHub')
  .withAutomaticReconnect([0, 1000, 2000, 4000, 8000, 10000, 10000, 15000, 15000])
  .configureLogging(LogLevel.Warning)
  .build();

// Dev only: a hot-replaced copy of this module would hold a second, never-started connection. Reload instead.
if (import.meta.hot) import.meta.hot.accept(() => window.location.reload());

connection.on(ServerEvents.StateUpdated, (snapshot: Snapshot) => {
  const prev = store.get().snapshot;
  // A new mini-game round invalidates the previous private state.
  const miniChanged = prev?.miniGame?.startAt !== snapshot.miniGame?.startAt;
  store.set({ snapshot, ...(miniChanged || !snapshot.miniGame ? { privateState: null } : {}) });
});

connection.on(ServerEvents.MiniGamePrivate, (state: MiniGamePrivate) => store.set({ privateState: state }));

connection.on(ServerEvents.BoardActions, (dto: BoardActionsDto) => serverEvents.emit('boardActions', dto));

connection.on(ServerEvents.Notice, (notice: NoticeDto) => {
  if (notice.kind === 'sessionMoved') {
    store.leaveLobbyLocally();
    store.toast(notice.message, 'info');
  }
});

connection.onreconnecting(() => store.set({ connection: 'reconnecting' }));
connection.onreconnected(async () => {
  store.set({ connection: 'connected' });
  resetClock();
  await syncClock();
  await resumeSession();
});
connection.onclose(() => {
  store.set({ connection: 'disconnected' });
  // Automatic reconnect gave up (e.g. server restart took a while) – keep trying slowly.
  window.setTimeout(() => void startConnection(), 5000);
});

async function syncClock() {
  for (let i = 0; i < 4; i++) {
    const t0 = Date.now();
    const server = await connection.invoke<number>('GetServerTime');
    recordClockSample(t0, server, Date.now());
  }
}

async function loadBoard() {
  if (store.get().board) return;
  try {
    const res = await fetch('/api/board');
    const board = (await res.json()) as BoardData;
    store.set({ board });
  } catch {
    store.toast('Could not load the board. Retrying…');
    window.setTimeout(loadBoard, 3000);
  }
}

/** Rejoin a saved lobby after refresh or network reconnect. */
async function resumeSession() {
  const code = store.get().snapshot?.code ?? getSavedLobby();
  if (!code) return;
  store.set({ resuming: true });
  try {
    const res = await connection.invoke<JoinResult>('ReconnectLobby', code, getSessionToken());
    if (res.ok) {
      store.set({ playerId: res.playerId });
    } else {
      saveLobby(null);
      // Only reset the UI if we were actually in a lobby; a stale saved code on page load is silently dropped.
      if (store.get().snapshot) {
        store.toast(res.error ?? 'Your lobby is gone.');
        store.leaveLobbyLocally();
      }
    }
  } finally {
    store.set({ resuming: false });
  }
}

let starting = false;
export async function startConnection() {
  if (starting || connection.state !== HubConnectionState.Disconnected) return;
  starting = true;
  store.set({ connection: 'connecting' });
  void loadBoard();
  try {
    await connection.start();
    store.set({ connection: 'connected' });
    await syncClock();
    await resumeSession();
  } catch {
    store.set({ connection: 'disconnected' });
    window.setTimeout(() => void startConnection(), 3000);
  } finally {
    starting = false;
  }
}

async function invoke<T>(method: string, ...args: unknown[]): Promise<T | null> {
  if (connection.state !== HubConnectionState.Connected) {
    store.toast('Not connected to the server yet…');
    return null;
  }
  try {
    return await connection.invoke<T>(method, ...args);
  } catch (err) {
    console.error(method, err);
    store.toast('The server did not understand that. Try again!');
    return null;
  }
}

/** Invokes a command and shows its error as a toast. Returns the result (or null when the call failed). */
async function command<T = unknown>(method: string, ...args: unknown[]): Promise<CommandResult<T> | null> {
  const res = await invoke<CommandResult<T>>(method, ...args);
  if (res && !res.ok && res.error) store.toast(res.error);
  return res;
}

async function enter(res: JoinResult | null): Promise<boolean> {
  if (!res) return false;
  if (!res.ok) {
    store.toast(res.error ?? 'Could not join.');
    return false;
  }
  saveLobby(res.code);
  store.set({ playerId: res.playerId });
  return true;
}

/** Client → server API. Every call expresses intent only; the server decides outcomes. */
export const api = {
  createLobby: async (name: string, color: PawnColor) =>
    enter(await invoke<JoinResult>('CreateLobby', name, color, getSessionToken())),
  joinLobby: async (code: string, name: string) =>
    enter(await invoke<JoinResult>('JoinLobby', code.trim().toUpperCase(), name, getSessionToken())),
  leaveLobby: async () => {
    await invoke('LeaveLobby');
    saveLobby(null);
    store.leaveLobbyLocally();
  },
  chooseColor: (color: PawnColor) => command('ChooseColor', color),
  setReady: (ready: boolean) => command('SetReady', ready),
  startGame: () => command('StartGame'),
  returnToLobby: () => command('ReturnToLobby'),
  rollInitialDice: () => command('RollInitialDice'),
  rollTurnDice: () => command('RollTurnDice'),
  chooseSwapTarget: (playerId: string) => command('ChooseSwapTarget', playerId),

  // Submissions return the SubmitResult in `data` without auto-toasting so mini-games can show inline feedback.
  submitWordleGuess: (guess: string) => invoke<CommandResult<SubmitResult>>('SubmitWordleGuess', guess),
  submitChainAnswer: (answer: string) => invoke<CommandResult<SubmitResult>>('SubmitChainAnswer', answer),
  submitHigherLowerAnswer: (questionIndex: number, choice: number) =>
    invoke<CommandResult<SubmitResult>>('SubmitHigherLowerAnswer', questionIndex, choice),
  submitNameXAnswer: (answer: string) => invoke<CommandResult<SubmitResult>>('SubmitNameXAnswer', answer),
  submitPixelGuess: (guess: string) => invoke<CommandResult<SubmitResult>>('SubmitPixelGuess', guess),
  submitLogicAnswer: (choice: number) => invoke<CommandResult<SubmitResult>>('SubmitLogicAnswer', choice),
};
