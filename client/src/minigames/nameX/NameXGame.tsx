import { api } from '../../multiplayer/signalr';
import type { NameXPrivate, NameXPublic, PlayerDto } from '../../types/contracts';
import { AnswerForm, ProgressRow } from '../shared/shared';

export function NameXGame({ pub, priv, players }: { pub: NameXPublic; priv: NameXPrivate | null; players: PlayerDto[] }) {
  return (
    <div className="namex">
      <div className="namex-letter pop-in">{pub.letter}</div>
      <h3 className="namex-prompt">{pub.prompt}</h3>
      <AnswerForm
        submit={api.submitNameXAnswer}
        lockedUntil={priv?.lockedUntil}
        placeholder={`${pub.category} starting with ${pub.letter}…`}
        doneText={priv?.solved ? `${priv.answer?.toUpperCase()} ✔ Nice!` : null}
      />
      {priv && priv.wrong.length > 0 && !priv.solved && (
        <div className="wrong-list">
          {priv.wrong.map((w, i) => (
            <span key={i} className="chip red">
              {w}
            </span>
          ))}
        </div>
      )}
      <ProgressRow players={players} done={(id) => pub.solved.includes(id)} label="✔" />
    </div>
  );
}
