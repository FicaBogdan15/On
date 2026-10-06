import { useEffect, useMemo, useRef, useState } from 'react';
import type Phaser from 'phaser';
import { audio } from '../../audio/AudioManager';
import { GameEventBus, type PawnInfo } from '../../game/GameEventBus';
import { createPhaserGame } from '../../game/PhaserGame';
import { serverEvents } from '../../multiplayer/events';
import { useStore } from '../../state/store';
import type { Biome, Snapshot } from '../../types/contracts';
import { DiceOverlay } from './DiceOverlay';
import { Hud } from './Hud';
import { MiniGameOverlay } from './MiniGameOverlay';
import { ResultsOverlay } from './ResultsOverlay';
import { SwapOverlay } from './SwapOverlay';
import { TurnOrderOverlay } from './TurnOrderOverlay';
import { WinnerOverlay } from './WinnerOverlay';
import './game.css';
import '../../minigames/minigames.css';

const toPawns = (s: Snapshot): PawnInfo[] =>
  s.players
    .filter((p) => p.color)
    .map((p) => ({
      playerId: p.playerId,
      name: p.name,
      color: p.color!,
      position: p.position,
      isConnected: p.isConnected,
      hasShield: p.hasShield,
      doubleMovement: p.doubleMovement,
    }));

/** Hosts the Phaser board and bridges authoritative state into it via the GameEventBus. */
export function GamePage() {
  const snapshot = useStore((s) => s.snapshot)!;
  const board = useStore((s) => s.board);
  const host = useRef<HTMLDivElement>(null);
  const game = useRef<Phaser.Game | null>(null);
  const [biome, setBiome] = useState<Biome>('forest');
  const phase = snapshot.phase;
  const prevPhase = useRef(phase);

  const snapshotRef = useRef(snapshot);
  snapshotRef.current = snapshot;

  // Phaser lifecycle. Created once the board layout has loaded; the scene receives the board + pawns via the bus.
  useEffect(() => {
    if (!board) return;
    const offBiome = GameEventBus.on('BIOME_CHANGED', ({ biome }) => setBiome(biome));
    const offSfx = GameEventBus.on('SFX', ({ name }) => audio.play(name));
    const offActions = serverEvents.on('boardActions', (dto) => GameEventBus.emit('PLAY_BOARD_ACTIONS', dto));
    // Created one tick later so React StrictMode's throwaway mount/unmount never spins up a second
    // Phaser instance (a half-destroyed duplicate would sit on top and never receive updates).
    const timer = window.setTimeout(() => {
      GameEventBus.clearSticky();
      game.current = createPhaserGame(host.current!);
      if (import.meta.env.DEV) (window as unknown as { __phaser?: Phaser.Game }).__phaser = game.current;
      const s = snapshotRef.current;
      GameEventBus.emit('BOARD_INITIALIZED', { board, players: toPawns(s), currentTurnPlayerId: s.currentTurnPlayerId });
    }, 0);
    return () => {
      window.clearTimeout(timer);
      offBiome();
      offSfx();
      offActions();
      game.current?.destroy(true);
      game.current = null;
      host.current?.replaceChildren();
      // Scenes remove their own handlers on shutdown; only drop cached sticky state here.
      GameEventBus.clearSticky();
    };
  }, [board]);

  // Authoritative positions/status
  const pawnKey = useMemo(
    () => JSON.stringify([snapshot.currentTurnPlayerId, toPawns(snapshot)]),
    [snapshot],
  );
  useEffect(() => {
    GameEventBus.emit('PLAYER_POSITION_UPDATED', { players: toPawns(snapshot), currentTurnPlayerId: snapshot.currentTurnPlayerId });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pawnKey]);

  // Phase transition hooks: camera sweep at match start, sounds.
  useEffect(() => {
    const prev = prevPhase.current;
    prevPhase.current = phase;
    if (prev === phase) return;
    if (prev === 'showingTurnOrder' && phase === 'waitingForDiceRoll') GameEventBus.emit('CAMERA_OVERVIEW', {});
    if (phase === 'miniGamePreparing') audio.play('miniGameStart');
    if (phase === 'gameFinished') audio.play('winner');
  }, [phase]);

  // Warn before leaving a running match.
  useEffect(() => {
    if (phase === 'gameFinished') return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [phase]);

  return (
    <div className="game-screen">
      <div ref={host} className="phaser-host" />
      <Hud snapshot={snapshot} biome={biome} />
      {(phase === 'rollingForOrder' || phase === 'showingTurnOrder') && <TurnOrderOverlay snapshot={snapshot} />}
      {phase === 'diceRolling' && <DiceOverlay snapshot={snapshot} />}
      {(phase === 'miniGamePreparing' || phase === 'miniGamePlaying') && snapshot.miniGame && <MiniGameOverlay snapshot={snapshot} />}
      {phase === 'miniGameResults' && snapshot.results && <ResultsOverlay snapshot={snapshot} />}
      {phase === 'waitingForSwapChoice' && snapshot.swap && <SwapOverlay snapshot={snapshot} />}
      {phase === 'gameFinished' && <WinnerOverlay snapshot={snapshot} />}
    </div>
  );
}
