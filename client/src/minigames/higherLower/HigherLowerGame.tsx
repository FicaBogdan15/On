import { audio } from '../../audio/AudioManager';
import { PawnIcon } from '../../components/PawnIcon';
import { api } from '../../multiplayer/signalr';
import { useServerNow } from '../../state/clock';
import type { HigherLowerPrivate, HigherLowerPublic, PlayerDto } from '../../types/contracts';
import { useEffect, useRef } from 'react';

export function formatValue(value: number, unit: string | null) {
  if (unit === 'year') return String(value);
  const formatted = new Intl.NumberFormat('en', { maximumFractionDigits: 1, notation: value >= 1e7 ? 'compact' : 'standard' }).format(value);
  return unit ? `${formatted} ${unit}` : formatted;
}

export function HigherLowerGame({ pub, priv, players }: { pub: HigherLowerPublic; priv: HigherLowerPrivate | null; players: PlayerDto[] }) {
  const now = useServerNow(100);
  const mine = priv?.answers[pub.index];
  const choice = mine?.choice ?? null;
  const secs = Math.max(0, Math.ceil((pub.questionEndsAt - now) / 1000));
  const revealed = useRef(-1);

  useEffect(() => {
    if (pub.revealing && revealed.current !== pub.index) {
      revealed.current = pub.index;
      if (choice !== null) audio.play(choice === pub.reveal?.correct ? 'correct' : 'wrong');
    }
  }, [pub.revealing, pub.index, choice, pub.reveal]);

  const pick = (c: number) => {
    if (choice !== null || pub.revealing) return;
    void api.submitHigherLowerAnswer(pub.index, c);
  };

  const card = (c: 0 | 1, name: string) => {
    const isCorrect = pub.revealing && pub.reveal?.correct === c;
    const isWrongPick = pub.revealing && choice === c && !isCorrect;
    const value = pub.reveal ? (c === 0 ? pub.reveal.valueA : pub.reveal.valueB) : null;
    return (
      <button
        type="button"
        className={`hl-option ${choice === c ? 'picked' : ''} ${isCorrect ? 'correct' : ''} ${isWrongPick ? 'wrong' : ''}`}
        disabled={choice !== null || pub.revealing}
        onClick={() => pick(c)}
      >
        <span className="hl-letter">{c === 0 ? 'A' : 'B'}</span>
        <span className="hl-name">{name}</span>
        {value !== null && <span className="hl-value pop-in">{formatValue(value, pub.reveal!.unit)}</span>}
        {isCorrect && <span className="hl-badge">✔ CORRECT</span>}
        {isWrongPick && <span className="hl-badge">✘</span>}
      </button>
    );
  };

  return (
    <div className="hl">
      <div className="hl-dots" aria-label={`Question ${pub.index + 1} of ${pub.count}`}>
        {Array.from({ length: pub.count }, (_, i) => {
          const a = priv?.answers[i];
          const cls = a?.correct === true ? 'good' : a?.correct === false ? 'bad' : i === pub.index ? 'current' : '';
          return <span key={i} className={`hl-dot ${cls}`}>{i + 1}</span>;
        })}
      </div>
      <h3 className="hl-prompt">{pub.prompt}</h3>
      <div className="hl-timer">{pub.revealing ? 'REVEAL!' : `${secs}s`}</div>
      <div className="hl-options">
        {card(0, pub.optionA)}
        <span className="hl-vs">VS</span>
        {card(1, pub.optionB)}
      </div>
      <div className="hl-scores">
        {players.map((p) => (
          <div key={p.playerId} className={`hl-score ${pub.answered.includes(p.playerId) ? 'answered' : ''}`} title={p.name}>
            <PawnIcon color={p.color} size={26} />
            <span>{pub.scores[p.playerId] ?? 0}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
