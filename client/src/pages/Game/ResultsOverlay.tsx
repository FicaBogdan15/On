import { PawnIcon } from '../../components/PawnIcon';
import { formatValue } from '../../minigames/higherLower/HigherLowerGame';
import { MINI_GAMES } from '../../minigames/meta';
import { PixelCanvas } from '../../minigames/pixelGuess/PixelGuessGame';
import { secondsLeft, useServerNow } from '../../state/clock';
import { useStore } from '../../state/store';
import type { ResultsDto, Snapshot } from '../../types/contracts';

const MEDALS = ['🥇', '🥈', '🥉'];

export function ResultsOverlay({ snapshot }: { snapshot: Snapshot }) {
  const results = snapshot.results!;
  const meta = MINI_GAMES[results.type];
  const now = useServerNow(250);
  const myId = useStore((s) => s.playerId);

  return (
    <div className="overlay">
      <div className="px-panel overlay-panel results pop-in" style={{ ['--accent' as string]: meta.color }}>
        <h2 className="px-panel-title">{meta.title} RESULTS</h2>
        <Reveal results={results} snapshot={snapshot} />
        <ol className="results-list">
          {results.entries.map((e, i) => {
            const p = snapshot.players.find((x) => x.playerId === e.playerId);
            if (!p) return null;
            return (
              <li
                key={e.playerId}
                className={`result-row slide-in ${e.movement > 0 ? 'scored' : ''} ${e.playerId === myId ? 'me' : ''}`}
                style={{ animationDelay: `${i * 120}ms` }}
              >
                <span className="result-rank">{e.movement > 0 ? MEDALS[i] ?? `${e.rank}.` : `${e.rank}.`}</span>
                <PawnIcon color={p.color} size={36} />
                <span className="result-name">{p.name}</span>
                <span className="result-detail">{e.detail}</span>
                <span className={`result-move ${e.movement > 0 ? 'plus' : ''}`}>
                  {e.movement > 0 ? `+${e.movement}` : '+0'}
                  {e.doubled && <span className="chip gold">2×</span>}
                </span>
              </li>
            );
          })}
        </ol>
        <p className="form-hint">Back to the board in {secondsLeft(snapshot.phaseEndsAt, now)}s…</p>
      </div>
    </div>
  );
}

function Reveal({ results, snapshot }: { results: ResultsDto; snapshot: Snapshot }) {
  const r = (results.reveal ?? {}) as Record<string, unknown>;
  const name = (id: string) => snapshot.players.find((p) => p.playerId === id)?.name ?? '?';
  switch (results.type) {
    case 'wordle':
      return (
        <div className="reveal">
          The word was <strong className="reveal-word">{String(r.answer)}</strong>
        </div>
      );
    case 'chain':
      return (
        <div className="reveal">
          {String(r.left)} → <strong className="reveal-word">{(r.answers as string[]).join(' / ')}</strong> → {String(r.right)}
        </div>
      );
    case 'higherLower': {
      const qs = r.questions as { optionA: string; optionB: string; valueA: number; valueB: number; unit: string | null; correct: number }[];
      return (
        <div className="reveal hl-reveal">
          {qs.map((q, i) => (
            <div key={i} className="hl-reveal-row">
              <span className={q.correct === 0 ? 'win' : ''}>
                {q.optionA} ({formatValue(q.valueA, q.unit)})
              </span>
              <span>vs</span>
              <span className={q.correct === 1 ? 'win' : ''}>
                {q.optionB} ({formatValue(q.valueB, q.unit)})
              </span>
            </div>
          ))}
        </div>
      );
    }
    case 'nameX': {
      const answers = Object.entries((r.playerAnswers as Record<string, string>) ?? {});
      return (
        <div className="reveal">
          {answers.length > 0 && (
            <div className="reveal-answers">
              {answers.map(([id, a]) => (
                <span key={id} className="chip green">
                  {name(id)}: {a.toUpperCase()}
                </span>
              ))}
            </div>
          )}
          <div className="reveal-small">Some valid answers: {(r.examples as string[]).join(', ')}</div>
        </div>
      );
    }
    case 'pixelGuess':
      return (
        <div className="reveal pixel-reveal">
          <PixelCanvas columns={r.columns as number} rows={r.rows as number} pixels={r.pixels as string[]} size={120} />
          <div>
            It was <strong className="reveal-word">{String(r.answer)}</strong>
          </div>
        </div>
      );
    case 'logic':
      return (
        <div className="reveal">
          <div>{String(r.prompt)}</div>
          Answer: <strong className="reveal-word">{String(r.answer)}</strong>
          {typeof r.explanation === 'string' && <div className="reveal-small">{r.explanation}</div>}
        </div>
      );
  }
}
