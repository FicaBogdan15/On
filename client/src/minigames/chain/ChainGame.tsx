import { api } from '../../multiplayer/signalr';
import type { ChainPrivate, ChainPublic, PlayerDto } from '../../types/contracts';
import { AnswerForm, ProgressRow } from '../shared/shared';

export function ChainGame({ pub, priv, players }: { pub: ChainPublic; priv: ChainPrivate | null; players: PlayerDto[] }) {
  const boxes = pub.length ?? 4;
  return (
    <div className="chain">
      <div className="chain-row">
        <div className="chain-word">{pub.left}</div>
        <div className="chain-arrow">→</div>
        <div className="chain-mystery" aria-label={pub.length ? `${pub.length} letter word` : 'mystery word'}>
          {Array.from({ length: boxes }, (_, i) => (
            <span key={i} className="chain-box">
              {i === 0 && pub.hint ? pub.hint : pub.length ? '' : '?'}
            </span>
          ))}
        </div>
        <div className="chain-arrow">→</div>
        <div className="chain-word">{pub.right}</div>
      </div>
      <p className="mini-hint">
        {pub.hint ? `Hint: starts with ${pub.hint}` : 'A word that follows the first and comes before the second.'}
      </p>
      <AnswerForm
        submit={api.submitChainAnswer}
        lockedUntil={priv?.lockedUntil}
        placeholder="The missing link…"
        doneText={priv?.solved ? 'LINKED! ✔ Waiting for others…' : null}
      />
      <ProgressRow players={players} done={(id) => pub.solved.includes(id)} label="✔" />
    </div>
  );
}
