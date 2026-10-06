import { useCallback, useEffect, useState } from 'react';
import { audio } from '../../audio/AudioManager';
import { PawnIcon } from '../../components/PawnIcon';
import { api } from '../../multiplayer/signalr';
import type { LetterMark, PlayerDto, WordlePrivate, WordlePublic } from '../../types/contracts';

const ROWS = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];
const RANK: Record<LetterMark, number> = { correct: 3, present: 2, absent: 1 };
const MARK_TEXT: Record<LetterMark, string> = { correct: 'correct spot', present: 'in the word, wrong spot', absent: 'not in the word' };

interface Props {
  pub: WordlePublic;
  priv: WordlePrivate | null;
  me: PlayerDto;
  players: PlayerDto[];
}

export function WordleGame({ pub, priv, me, players }: Props) {
  const [current, setCurrent] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [shake, setShake] = useState(false);
  const [busy, setBusy] = useState(false);
  const guesses = priv?.guesses ?? [];
  const done = priv?.done ?? false;

  const flash = (text: string) => {
    setMessage(text);
    setShake(true);
    window.setTimeout(() => setShake(false), 380);
  };

  const submit = useCallback(async () => {
    if (busy || done) return;
    if (current.length < pub.wordLength) return flash('Not enough letters');
    setBusy(true);
    const res = await api.submitWordleGuess(current);
    setBusy(false);
    if (res?.ok) {
      setCurrent('');
      setMessage(res.data?.message ?? null);
      audio.play(res.data?.correct ? 'correct' : 'type');
    } else {
      audio.play('wrong');
      flash(res?.error ?? 'Try again');
    }
  }, [busy, done, current, pub.wordLength]);

  const press = useCallback(
    (key: string) => {
      if (done) return;
      if (key === 'ENTER') return void submit();
      if (key === 'BACK') return setCurrent((c) => c.slice(0, -1));
      if (/^[A-Z]$/.test(key)) {
        setCurrent((c) => (c.length < pub.wordLength ? c + key : c));
        audio.play('type');
      }
    },
    [done, submit, pub.wordLength],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'Enter') press('ENTER');
      else if (e.key === 'Backspace') press('BACK');
      else if (/^[a-zA-Z]$/.test(e.key)) press(e.key.toUpperCase());
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [press]);

  const keyStates = new Map<string, LetterMark>();
  for (const g of guesses)
    g.word.split('').forEach((ch, i) => {
      const prev = keyStates.get(ch);
      if (!prev || RANK[g.marks[i]] > RANK[prev]) keyStates.set(ch, g.marks[i]);
    });

  const rows = Array.from({ length: pub.maxGuesses }, (_, r) => {
    if (r < guesses.length) return { letters: guesses[r].word.split(''), marks: guesses[r].marks, live: false };
    if (r === guesses.length && !done) return { letters: current.padEnd(pub.wordLength).split(''), marks: null, live: true };
    return { letters: Array(pub.wordLength).fill(' '), marks: null, live: false };
  });

  const others = players.filter((p) => p.playerId !== me.playerId);

  return (
    <div className="wordle">
      <div className="wordle-main">
        <div className={`wordle-grid ${shake ? 'shake' : ''}`}>
          {rows.map((row, r) => (
            <div key={r} className="wordle-row">
              {row.letters.map((ch, i) => {
                const mark = row.marks?.[i];
                return (
                  <div
                    key={i}
                    className={`wordle-tile ${mark ?? ''} ${row.live && ch.trim() ? 'filled' : ''}`}
                    style={mark ? { animationDelay: `${i * 90}ms` } : undefined}
                    aria-label={mark ? `${ch} ${MARK_TEXT[mark]}` : ch.trim() || 'empty'}
                  >
                    {ch.trim()}
                    {mark === 'correct' && <span className="mark-glyph">●</span>}
                    {mark === 'present' && <span className="mark-glyph">◆</span>}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
        <div className="wordle-message">{priv?.solved ? 'SOLVED! Waiting for others…' : done ? 'Out of guesses!' : (message ?? ' ')}</div>
        <div className="keyboard" aria-label="On-screen keyboard">
          {ROWS.map((row, i) => (
            <div key={row} className="key-row">
              {i === 2 && (
                <button type="button" className="key wide" onClick={() => press('ENTER')}>
                  ENTER
                </button>
              )}
              {row.split('').map((k) => (
                <button type="button" key={k} className={`key ${keyStates.get(k) ?? ''}`} onClick={() => press(k)}>
                  {k}
                </button>
              ))}
              {i === 2 && (
                <button type="button" className="key wide" onClick={() => press('BACK')} aria-label="Backspace">
                  ⌫
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
      {others.length > 0 && (
        <aside className="wordle-opponents" aria-label="Opponents' progress">
          {others.map((p) => {
            const prog = pub.progress[p.playerId];
            return (
              <div key={p.playerId} className={`opponent ${prog?.solved ? 'solved' : ''}`}>
                <div className="opponent-head">
                  <PawnIcon color={p.color} size={24} />
                  <span>{p.name}</span>
                </div>
                <div className="mini-grid">
                  {Array.from({ length: pub.maxGuesses }, (_, r) => (
                    <div key={r} className="mini-row">
                      {Array.from({ length: pub.wordLength }, (_, i) => (
                        <span key={i} className={`mini-cell ${prog?.patterns[r]?.[i] ?? ''}`} />
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </aside>
      )}
    </div>
  );
}
