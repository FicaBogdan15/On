import { useEffect, useRef, useState, type FormEvent } from 'react';
import { audio } from '../../audio/AudioManager';
import { PawnIcon } from '../../components/PawnIcon';
import { PixelButton } from '../../components/PixelButton';
import { useServerNow } from '../../state/clock';
import type { CommandResult, PlayerDto, SubmitResult } from '../../types/contracts';

export function TimerBar({ start, end, label }: { start: number; end: number; label?: string }) {
  const now = useServerNow(100);
  const total = Math.max(1, end - start);
  const left = Math.max(0, end - now);
  const pct = Math.min(100, (left / total) * 100);
  const secs = Math.ceil(left / 1000);
  return (
    <div className={`timer-bar ${secs <= 5 ? 'urgent' : ''}`} role="timer" aria-label={`${secs} seconds left`}>
      <div className="timer-fill" style={{ width: `${pct}%` }} />
      <span className="timer-text">
        {label ? `${label} ` : ''}
        {secs}s
      </span>
    </div>
  );
}

/** Row of pawn icons showing who has finished. */
export function ProgressRow({ players, done, label = 'DONE' }: { players: PlayerDto[]; done: (id: string) => boolean; label?: string }) {
  return (
    <div className="progress-row">
      {players.map((p) => (
        <div key={p.playerId} className={`progress-pawn ${done(p.playerId) ? 'done' : ''}`} title={p.name}>
          <PawnIcon color={p.color} size={30} />
          <span>{done(p.playerId) ? label : p.name.slice(0, 6).toUpperCase()}</span>
        </div>
      ))}
    </div>
  );
}

/** Seconds left on a server-side answer lock. */
export function useLock(lockedUntil: number | null | undefined) {
  const now = useServerNow(100);
  const left = lockedUntil ? Math.max(0, lockedUntil - now) : 0;
  return { locked: left > 0, secondsLeft: Math.ceil(left / 1000) };
}

/**
 * Text answer box shared by Chain, Name X and Pixel Guess. Submits to the server and shows
 * inline feedback; the server decides correctness and lockouts.
 */
export function AnswerForm({
  submit,
  lockedUntil,
  disabled,
  placeholder,
  doneText,
}: {
  submit: (text: string) => Promise<CommandResult<SubmitResult> | null>;
  lockedUntil?: number | null;
  disabled?: boolean;
  placeholder: string;
  doneText?: string | null;
}) {
  const [text, setText] = useState('');
  const [feedback, setFeedback] = useState<{ text: string; good: boolean } | null>(null);
  const [shake, setShake] = useState(false);
  const [localLock, setLocalLock] = useState<number | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const lock = useLock(Math.max(lockedUntil ?? 0, localLock ?? 0));

  useEffect(() => {
    if (!lock.locked && !disabled) input.current?.focus();
  }, [lock.locked, disabled]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim() || lock.locked || disabled) return;
    const res = await submit(text.trim());
    const result = res?.data;
    if (res?.ok && result?.correct) {
      audio.play('correct');
      setFeedback({ text: result.message ?? 'Correct!', good: true });
      setText('');
    } else {
      audio.play('wrong');
      setShake(true);
      window.setTimeout(() => setShake(false), 380);
      setFeedback({ text: result?.message ?? res?.error ?? 'Nope!', good: false });
      if (result?.lockedUntil) setLocalLock(result.lockedUntil);
      setText('');
    }
  };

  if (doneText) return <div className="answer-done pop-in">{doneText}</div>;

  return (
    <form className={`answer-form ${shake ? 'shake' : ''}`} onSubmit={onSubmit}>
      <input
        ref={input}
        className="px-input"
        value={text}
        maxLength={40}
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
        placeholder={lock.locked ? `LOCKED ${lock.secondsLeft}s…` : placeholder}
        disabled={lock.locked || disabled}
        onChange={(e) => setText(e.target.value)}
        aria-label="Your answer"
      />
      <PixelButton variant="green" type="submit" disabled={lock.locked || disabled || !text.trim()}>
        {lock.locked ? `${lock.secondsLeft}s` : 'SUBMIT'}
      </PixelButton>
      {feedback && <div className={`answer-feedback ${feedback.good ? 'good' : 'bad'}`}>{feedback.text}</div>}
    </form>
  );
}
