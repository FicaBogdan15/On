import { useState } from 'react';
import { PawnIcon } from '../../components/PawnIcon';
import { iconDataUrl } from '../../game/art/textures';
import { api } from '../../multiplayer/signalr';
import { secondsLeft, useServerNow } from '../../state/clock';
import { useStore } from '../../state/store';
import type { Snapshot } from '../../types/contracts';

export function SwapOverlay({ snapshot }: { snapshot: Snapshot }) {
  const swap = snapshot.swap!;
  const myId = useStore((s) => s.playerId);
  const now = useServerNow(200);
  const [busy, setBusy] = useState(false);
  const chooser = snapshot.players.find((p) => p.playerId === swap.chooserId);
  const secs = secondsLeft(swap.deadline, now);

  if (swap.chooserId !== myId) {
    return (
      <div className="swap-banner px-panel pop-in">
        <img src={iconDataUrl('swap')} alt="" className="status-icon" />
        <PawnIcon color={chooser?.color ?? null} size={30} />
        <span>
          {chooser?.name} is choosing who to swap with… {secs}s
        </span>
      </div>
    );
  }

  return (
    <div className="overlay">
      <div className="px-panel overlay-panel pop-in">
        <h2 className="px-panel-title">SWAP!</h2>
        <p className="form-hint">Pick a player to trade places with. Random pick in {secs}s.</p>
        <div className="swap-grid">
          {swap.candidates.map((id) => {
            const p = snapshot.players.find((x) => x.playerId === id);
            if (!p) return null;
            return (
              <button
                key={id}
                type="button"
                className="swap-card"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  const res = await api.chooseSwapTarget(id);
                  if (!res?.ok) setBusy(false);
                }}
              >
                <PawnIcon color={p.color} size={52} />
                <span className="order-name">{p.name}</span>
                <span className="chip">SPACE {p.position}</span>
                {p.hasShield && <span className="chip blue">SHIELDED</span>}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
