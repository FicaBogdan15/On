import { useEffect, useRef, useState } from 'react';
import { audio } from '../audio/AudioManager';

const PIPS: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

export function Die({ value, rolling, landed, small }: { value: number; rolling?: boolean; landed?: boolean; small?: boolean }) {
  return (
    <div className={`die ${small ? 'small' : ''} ${rolling ? 'rolling' : ''} ${landed ? 'landed' : ''}`} aria-label={`Die showing ${value}`}>
      {Array.from({ length: 9 }, (_, i) => (
        <span key={i} className={PIPS[value]?.includes(i) ? 'pip' : ''} />
      ))}
    </div>
  );
}

/**
 * Shows a tumbling die until `rollMs` has passed, then lands on `value`.
 * The value always comes from the server; the animation is purely cosmetic.
 */
export function RollingDie({ value, rollMs = 1200, small, onLanded }: { value: number | null; rollMs?: number; small?: boolean; onLanded?: () => void }) {
  const [face, setFace] = useState(1);
  const [landed, setLanded] = useState(false);
  const landedRef = useRef(onLanded);
  landedRef.current = onLanded;

  useEffect(() => {
    if (value === null) {
      setLanded(false);
      return;
    }
    setLanded(false);
    audio.play('diceRoll');
    const spin = window.setInterval(() => setFace((f) => ((f + Math.floor(Math.random() * 5)) % 6) + 1), 80);
    const stop = window.setTimeout(() => {
      window.clearInterval(spin);
      setFace(value);
      setLanded(true);
      audio.play('diceLand');
      landedRef.current?.();
    }, rollMs);
    return () => {
      window.clearInterval(spin);
      window.clearTimeout(stop);
    };
  }, [value, rollMs]);

  if (value === null) return <Die value={face} small={small} />;
  return <Die value={landed ? value : face} rolling={!landed} landed={landed} small={small} />;
}
