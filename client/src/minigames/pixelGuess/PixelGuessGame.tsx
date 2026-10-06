import { useEffect, useRef } from 'react';
import { api } from '../../multiplayer/signalr';
import type { PixelPrivate, PixelPublic, PlayerDto } from '../../types/contracts';
import { AnswerForm, ProgressRow } from '../shared/shared';

/** Draws a server-supplied (already pixelated) colour grid. */
export function PixelCanvas({ columns, rows, pixels, size = 288 }: { columns: number; rows: number; pixels: string[]; size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current!;
    const ctx = c.getContext('2d')!;
    c.width = columns;
    c.height = rows;
    pixels.forEach((color, i) => {
      ctx.fillStyle = color;
      ctx.fillRect(i % columns, Math.floor(i / columns), 1, 1);
    });
  }, [columns, rows, pixels]);
  return <canvas ref={ref} className="pixel-canvas" style={{ width: size, height: size * (rows / columns) }} aria-label="Pixelated picture" />;
}

export function PixelGuessGame({ pub, priv, players }: { pub: PixelPublic; priv: PixelPrivate | null; players: PlayerDto[] }) {
  return (
    <div className="pixel-guess">
      <div className="pixel-frame">
        <PixelCanvas columns={pub.columns} rows={pub.rows} pixels={pub.pixels} />
        <div className="pixel-level">
          {Array.from({ length: pub.levelCount }, (_, i) => (
            <span key={i} className={i <= pub.level ? 'on' : ''} />
          ))}
        </div>
      </div>
      <p className="mini-hint">Category: {pub.category.toUpperCase()}</p>
      <AnswerForm
        submit={api.submitPixelGuess}
        lockedUntil={priv?.lockedUntil}
        placeholder="What is it?"
        doneText={priv?.solved ? 'GOT IT! ✔ Waiting for others…' : null}
      />
      <ProgressRow players={players} done={(id) => pub.solved.includes(id)} label="✔" />
    </div>
  );
}
