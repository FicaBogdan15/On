import { useMemo } from 'react';
import { PawnIcon } from '../../components/PawnIcon';
import { PixelButton } from '../../components/PixelButton';
import { PAWN_SHADES } from '../../game/art/sprites';
import { api } from '../../multiplayer/signalr';
import { useStore } from '../../state/store';
import type { Snapshot } from '../../types/contracts';

const CONFETTI_COLORS = ['#ff5a5a', '#ffe14a', '#5aff8a', '#5ab8ff', '#d45aff', '#ffffff'];

export function WinnerOverlay({ snapshot }: { snapshot: Snapshot }) {
  const myId = useStore((s) => s.playerId);
  const winner = snapshot.players.find((p) => p.playerId === snapshot.winnerId);
  const ranking = (snapshot.finalRanking ?? []).map((id) => snapshot.players.find((p) => p.playerId === id)!).filter(Boolean);
  const isHost = snapshot.hostPlayerId === myId;

  const confetti = useMemo(
    () =>
      Array.from({ length: 70 }, (_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 3,
        duration: 2.5 + Math.random() * 2.5,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        size: 6 + Math.floor(Math.random() * 3) * 4,
      })),
    [],
  );

  return (
    <div className="overlay winner-overlay">
      <div className="confetti" aria-hidden="true">
        {confetti.map((c, i) => (
          <span
            key={i}
            style={{ left: `${c.left}%`, animationDelay: `${c.delay}s`, animationDuration: `${c.duration}s`, background: c.color, width: c.size, height: c.size }}
          />
        ))}
      </div>
      <div className="px-panel overlay-panel winner-panel pop-in">
        <div className="winner-label">WINNER</div>
        {winner && (
          <>
            <div className="winner-pawn">
              <PawnIcon color={winner.color} size={120} />
            </div>
            <div className="winner-color" style={{ color: PAWN_SHADES[winner.color!].css }}>
              {PAWN_SHADES[winner.color!].label.toUpperCase()} PAWN
            </div>
            <div className="winner-name">{winner.name}</div>
          </>
        )}
        <ol className="final-ranking">
          {ranking.map((p, i) => (
            <li key={p.playerId} className={p.playerId === myId ? 'me' : ''}>
              <span className="order-num">{i + 1}.</span>
              <PawnIcon color={p.color} size={28} />
              <span className="order-name">{p.name}</span>
              <span className="chip">{p.position === snapshot.finishIndex ? 'FINISH' : `SPACE ${p.position}`}</span>
            </li>
          ))}
        </ol>
        <div className="overlay-actions row">
          {isHost ? (
            <PixelButton variant="green" onClick={() => void api.returnToLobby()}>
              PLAY AGAIN
            </PixelButton>
          ) : (
            <p className="form-hint">The host can start a new round.</p>
          )}
          <PixelButton variant="ghost" onClick={() => void api.leaveLobby()}>
            MAIN MENU
          </PixelButton>
        </div>
      </div>
    </div>
  );
}
