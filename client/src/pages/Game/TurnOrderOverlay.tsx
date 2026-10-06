import { useState } from 'react';
import { Die, RollingDie } from '../../components/Dice';
import { PawnIcon } from '../../components/PawnIcon';
import { PixelButton } from '../../components/PixelButton';
import { api } from '../../multiplayer/signalr';
import { secondsLeft, useServerNow } from '../../state/clock';
import { useStore } from '../../state/store';
import type { Snapshot } from '../../types/contracts';

export function TurnOrderOverlay({ snapshot }: { snapshot: Snapshot }) {
  const myId = useStore((s) => s.playerId);
  const now = useServerNow(250);
  const [busy, setBusy] = useState(false);
  const order = snapshot.orderRoll;

  if (snapshot.phase === 'showingTurnOrder') {
    return (
      <div className="overlay">
        <div className="px-panel overlay-panel pop-in">
          <h2 className="px-panel-title">TURN ORDER</h2>
          <ol className="turn-order-list">
            {snapshot.turnOrder.map((id, i) => {
              const p = snapshot.players.find((x) => x.playerId === id)!;
              return (
                <li key={id} className="slide-in" style={{ animationDelay: `${i * 160}ms` }}>
                  <span className="order-num">{i + 1}.</span>
                  <PawnIcon color={p.color} size={40} />
                  <span className="order-name">{p.name}</span>
                  <Die value={order?.history[id]?.at(-1) ?? 1} small />
                </li>
              );
            })}
          </ol>
          <p className="form-hint">Highest roll goes first. Get ready!</p>
        </div>
      </div>
    );
  }

  if (!order) return null;
  const rolling = new Set(order.rolling);
  const iMustRoll = !!myId && rolling.has(myId) && order.rolls[myId] === undefined && !order.roundComplete;
  const tied = order.round > 1;

  return (
    <div className="overlay">
      <div className="px-panel overlay-panel pop-in">
        <h2 className="px-panel-title">{tied ? 'TIE! ROLL AGAIN' : 'ROLL FOR TURN ORDER'}</h2>
        <p className="form-hint">{tied ? 'Only the tied players roll this time.' : 'Everyone rolls one die. Highest goes first!'}</p>
        <div className="order-grid">
          {snapshot.players.map((p) => {
            const value = order.rolls[p.playerId];
            const isRolling = rolling.has(p.playerId);
            const settled = !isRolling ? order.history[p.playerId]?.at(-1) : undefined;
            return (
              <div key={p.playerId} className={`order-card ${isRolling ? '' : 'settled'}`}>
                <PawnIcon color={p.color} size={44} />
                <span className="order-name">{p.name}</span>
                {value !== undefined ? (
                  <RollingDie key={`${order.round}-${value}`} value={value} rollMs={900} small />
                ) : settled !== undefined ? (
                  <Die value={settled} small />
                ) : (
                  <div className="die-waiting bob">?</div>
                )}
              </div>
            );
          })}
        </div>
        {iMustRoll ? (
          <div className="overlay-actions">
            <PixelButton
              variant="gold"
              size="big"
              pulse
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                await api.rollInitialDice();
                setBusy(false);
              }}
            >
              ROLL!
            </PixelButton>
            <div className="turn-sub">Auto-roll in {secondsLeft(snapshot.phaseEndsAt, now)}s</div>
          </div>
        ) : (
          <p className="form-hint">{order.roundComplete ? 'Sorting out the order…' : 'Waiting for the others to roll…'}</p>
        )}
      </div>
    </div>
  );
}
