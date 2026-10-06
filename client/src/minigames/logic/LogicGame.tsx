import { useEffect, useState } from 'react';
import { audio } from '../../audio/AudioManager';
import { api } from '../../multiplayer/signalr';
import type { LogicPrivate, LogicPublic, PlayerDto } from '../../types/contracts';
import { ProgressRow } from '../shared/shared';

export function LogicGame({ pub, priv, players }: { pub: LogicPublic; priv: LogicPrivate | null; players: PlayerDto[] }) {
  const [pending, setPending] = useState<number | null>(null);
  const chosen = priv?.choice ?? pending;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const n = Number(e.key);
      if (n >= 1 && n <= pub.choices.length) choose(n - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const choose = async (i: number) => {
    if (chosen !== null && chosen !== undefined) return;
    setPending(i);
    audio.play('click');
    const res = await api.submitLogicAnswer(i);
    if (!res?.ok) setPending(null);
  };

  return (
    <div className="logic">
      {pub.puzzleType === 'grid' && pub.grid ? (
        <>
          <h3 className="logic-prompt small">{pub.prompt}</h3>
          <table className="logic-grid">
            <tbody>
              {pub.grid.map((row, r) => (
                <tr key={r}>
                  {row.map((cell, c) => (
                    <td key={c} className={cell === '?' ? 'missing' : ''}>
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : pub.puzzleType === 'oddOneOut' ? (
        <>
          <h3 className="logic-prompt small">{pub.prompt}</h3>
        </>
      ) : (
        <h3 className={`logic-prompt ${pub.puzzleType === 'shape' ? 'shapes' : ''}`}>{pub.prompt}</h3>
      )}

      <div className="logic-choices">
        {pub.choices.map((c, i) => (
          <button
            key={i}
            type="button"
            className={`logic-choice ${chosen === i ? 'picked' : ''} ${pub.puzzleType === 'shape' ? 'shapes' : ''}`}
            disabled={chosen !== null && chosen !== undefined}
            onClick={() => void choose(i)}
          >
            <span className="choice-key">{i + 1}</span>
            {c}
          </button>
        ))}
      </div>
      <p className="mini-hint">{chosen !== null && chosen !== undefined ? 'LOCKED IN! Waiting for the reveal…' : 'One try only – think fast!'}</p>
      <ProgressRow players={players} done={(id) => pub.answered.includes(id)} label="✔" />
    </div>
  );
}
