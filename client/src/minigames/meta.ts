import type { MiniGameType } from '../types/contracts';

export interface MiniGameMeta {
  face: number;
  title: string;
  rules: string;
  color: string;
}

export const MINI_GAMES: Record<MiniGameType, MiniGameMeta> = {
  wordle: { face: 1, title: 'WORDLE RUSH', rules: 'Everyone gets the same 5-letter word. 6 guesses. Fewest guesses wins, then fastest.', color: '#46c35a' },
  chain: { face: 2, title: 'CHAIN', rules: 'Find the word that links both sides: BLACK → KEY → BOARD.', color: '#3a8de0' },
  higherLower: { face: 3, title: 'HIGHER OR LOWER', rules: '5 quick questions. Pick the right option before time runs out!', color: '#f08a24' },
  nameX: { face: 4, title: 'NAME X WITH Y', rules: 'Type a valid answer as fast as you can. Wrong answers lock you briefly.', color: '#e04848' },
  pixelGuess: { face: 5, title: 'GUESS FROM PIXELS', rules: 'The picture sharpens over time. Guess early! Wrong guesses lock you for 2s.', color: '#8a4fe0' },
  logic: { face: 6, title: 'LOGIC & PATTERNS', rules: 'One puzzle, one answer. Correct and fast wins.', color: '#1bb8c9' },
};
