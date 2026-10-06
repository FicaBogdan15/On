// TypeScript mirrors of the server DTOs (server/GameServer/Models/Dtos.cs). Enums arrive as camelCase strings.

export type GamePhase =
  | 'lobby'
  | 'rollingForOrder'
  | 'showingTurnOrder'
  | 'waitingForDiceRoll'
  | 'diceRolling'
  | 'miniGamePreparing'
  | 'miniGamePlaying'
  | 'miniGameResults'
  | 'movingPlayers'
  | 'waitingForSwapChoice'
  | 'gameFinished';

export const PAWN_COLORS = ['red', 'blue', 'green', 'yellow', 'purple', 'orange', 'cyan', 'pink'] as const;
export type PawnColor = (typeof PAWN_COLORS)[number];

export type MiniGameType = 'wordle' | 'chain' | 'higherLower' | 'nameX' | 'pixelGuess' | 'logic';

export type TileType =
  | 'start'
  | 'empty'
  | 'mystery'
  | 'shield'
  | 'swap'
  | 'plusTwo'
  | 'minusOne'
  | 'doubleMovement'
  | 'portal'
  | 'finish';

export type Biome = 'forest' | 'village' | 'desert' | 'snow';

export interface PlayerDto {
  playerId: string;
  name: string;
  color: PawnColor | null;
  isReady: boolean;
  isHost: boolean;
  isConnected: boolean;
  hasLeft: boolean;
  position: number;
  hasShield: boolean;
  doubleMovement: boolean;
  initialRoll: number | null;
  turnOrderIndex: number | null;
}

export interface OrderRollDto {
  round: number;
  rolling: string[];
  rolls: Record<string, number>;
  history: Record<string, number[]>;
  roundComplete: boolean;
  groups: string[][];
}

export interface SwapDto {
  chooserId: string;
  deadline: number;
  candidates: string[];
}

export interface MiniGameDto<TState = unknown> {
  type: MiniGameType;
  title: string;
  stage: 'preparing' | 'playing';
  startAt: number;
  endAt: number;
  state: TState | null;
}

export interface ResultEntryDto {
  playerId: string;
  rank: number;
  eligible: boolean;
  detail: string;
  movement: number;
  doubled: boolean;
}

export interface ResultsDto {
  type: MiniGameType;
  title: string;
  entries: ResultEntryDto[];
  reveal: Record<string, unknown> | null;
}

export interface Snapshot {
  code: string;
  hostPlayerId: string;
  phase: GamePhase;
  phaseEndsAt: number | null;
  serverNow: number;
  maxPlayers: number;
  minPlayers: number;
  finishIndex: number;
  players: PlayerDto[];
  turnOrder: string[];
  currentTurnPlayerId: string | null;
  turnNumber: number;
  lastDice: number | null;
  diceMiniGame: MiniGameType | null;
  orderRoll: OrderRollDto | null;
  miniGame: MiniGameDto | null;
  results: ResultsDto | null;
  swap: SwapDto | null;
  winnerId: string | null;
  finalRanking: string[] | null;
}

export interface BoardAction {
  type: 'move' | 'portal' | 'swap' | 'effect' | 'shieldBlock' | 'finish';
  playerId?: string;
  targetPlayerId?: string;
  from?: number;
  to?: number;
  path?: number[];
  effect?: string;
  outcome?: string;
  durationMs: number;
}

export interface BoardActionsDto {
  sequence: number;
  actions: BoardAction[];
}

export interface BoardTileDto {
  index: number;
  type: TileType;
  biome: Biome;
  x: number;
  y: number;
}

export interface BoardData {
  world: { width: number; height: number };
  biomes: { id: Biome; x0: number; x1: number }[];
  tiles: BoardTileDto[];
  finishIndex: number;
}

export interface CommandResult<T = unknown> {
  ok: boolean;
  error: string | null;
  data: T | null;
}

export interface SubmitResult {
  accepted: boolean;
  correct: boolean | null;
  message: string | null;
  lockedUntil: number | null;
}

export interface JoinResult {
  ok: boolean;
  error: string | null;
  code: string | null;
  playerId: string | null;
}

export interface NoticeDto {
  kind: string;
  message: string;
}

// ---- Mini-game public states (snapshot.miniGame.state) ----

export type LetterMark = 'correct' | 'present' | 'absent';

export interface WordlePublic {
  wordLength: number;
  maxGuesses: number;
  progress: Record<string, { patterns: LetterMark[][]; solved: boolean; done: boolean }>;
}

export interface ChainPublic {
  left: string;
  right: string;
  difficulty: string;
  length: number | null;
  hint: string | null;
  hintAt: number;
  solved: string[];
}

export interface HigherLowerPublic {
  index: number;
  count: number;
  category: string;
  prompt: string;
  optionA: string;
  optionB: string;
  questionEndsAt: number;
  revealing: boolean;
  reveal: { valueA: number; valueB: number; unit: string | null; correct: number } | null;
  answered: string[];
  scores: Record<string, number>;
}

export interface NameXPublic {
  prompt: string;
  category: string;
  letter: string;
  solved: string[];
}

export interface PixelPublic {
  level: number;
  levelCount: number;
  columns: number;
  rows: number;
  pixels: string[];
  nextLevelAt: number | null;
  category: string;
  solved: string[];
}

export interface LogicPublic {
  puzzleType: 'sequence' | 'shape' | 'oddOneOut' | 'grid';
  prompt: string;
  grid: string[][] | null;
  items: string[] | null;
  choices: string[];
  answered: string[];
}

// ---- Mini-game private states (MiniGamePrivate message) ----

export interface WordlePrivate {
  type: 'wordle';
  guesses: { word: string; marks: LetterMark[] }[];
  solved: boolean;
  done: boolean;
}
export interface ChainPrivate {
  type: 'chain';
  solved: boolean;
  attempts: number;
  lockedUntil: number;
}
export interface HigherLowerPrivate {
  type: 'higherLower';
  answers: { choice: number | null; correct: boolean | null }[];
}
export interface NameXPrivate {
  type: 'nameX';
  solved: boolean;
  answer: string | null;
  wrong: string[];
  lockedUntil: number;
}
export interface PixelPrivate {
  type: 'pixelGuess';
  solved: boolean;
  wrongGuesses: number;
  lockedUntil: number;
}
export interface LogicPrivate {
  type: 'logic';
  choice: number | null;
}

export type MiniGamePrivate = WordlePrivate | ChainPrivate | HigherLowerPrivate | NameXPrivate | PixelPrivate | LogicPrivate;
