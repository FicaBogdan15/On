import { useState } from 'react';
import { RollingDie } from '../../components/Dice';
import { MINI_GAMES } from '../../minigames/meta';
import type { Snapshot } from '../../types/contracts';

/** The turn die: tumbles, lands on the server's value, then reveals which mini-game everyone plays. */
export function DiceOverlay({ snapshot }: { snapshot: Snapshot }) {
  const [landed, setLanded] = useState(false);
  const roller = snapshot.players.find((p) => p.playerId === snapshot.currentTurnPlayerId);
  const meta = snapshot.diceMiniGame ? MINI_GAMES[snapshot.diceMiniGame] : null;

  return (
    <div className="overlay dim-light">
      <div className="dice-stage">
        <div className="dice-roller pixel-title">{roller?.name.toUpperCase()} ROLLS…</div>
        <div className="big-die">
          <RollingDie value={snapshot.lastDice} rollMs={1300} onLanded={() => setLanded(true)} />
        </div>
        {landed && meta && (
          <div className="dice-result slide-in" style={{ ['--accent' as string]: meta.color }}>
            <span className="dice-face-num">{snapshot.lastDice}</span>
            <span className="dice-game-title">{meta.title}</span>
          </div>
        )}
      </div>
    </div>
  );
}
