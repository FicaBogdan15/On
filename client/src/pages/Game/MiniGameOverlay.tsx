import { useEffect, useRef } from 'react';
import { audio } from '../../audio/AudioManager';
import { ChainGame } from '../../minigames/chain/ChainGame';
import { HigherLowerGame } from '../../minigames/higherLower/HigherLowerGame';
import { LogicGame } from '../../minigames/logic/LogicGame';
import { MINI_GAMES } from '../../minigames/meta';
import { NameXGame } from '../../minigames/nameX/NameXGame';
import { PixelGuessGame } from '../../minigames/pixelGuess/PixelGuessGame';
import { TimerBar } from '../../minigames/shared/shared';
import { WordleGame } from '../../minigames/wordle/WordleGame';
import { useServerNow } from '../../state/clock';
import { useMe, useStore } from '../../state/store';
import type * as C from '../../types/contracts';
import { orderedPlayers } from './Hud';

export function MiniGameOverlay({ snapshot }: { snapshot: C.Snapshot }) {
  const mini = snapshot.miniGame!;
  const meta = MINI_GAMES[mini.type];
  return (
    <div className="overlay">
      <div className="minigame-shell px-panel" style={{ ['--accent' as string]: meta.color }}>
        <header className="minigame-header">
          <span className="minigame-badge">{meta.face}</span>
          <h2>{meta.title}</h2>
        </header>
        {mini.stage === 'preparing' ? <TitleCard mini={mini} /> : <Playing snapshot={snapshot} mini={mini} />}
      </div>
    </div>
  );
}

function TitleCard({ mini }: { mini: C.MiniGameDto }) {
  const now = useServerNow(100);
  const meta = MINI_GAMES[mini.type];
  const secs = Math.ceil((mini.startAt - now) / 1000);
  const last = useRef(secs);
  useEffect(() => {
    if (secs !== last.current && secs >= 1 && secs <= 3) audio.play('countdown');
    last.current = secs;
  }, [secs]);

  return (
    <div className="title-card">
      <p className="title-rules slide-in">{meta.rules}</p>
      <div className="countdown pop-in" key={secs}>
        {secs > 3 ? 'GET READY' : secs > 0 ? secs : 'GO!'}
      </div>
    </div>
  );
}

function Playing({ snapshot, mini }: { snapshot: C.Snapshot; mini: C.MiniGameDto }) {
  const me = useMe();
  const priv = useStore((s) => s.privateState);
  const players = orderedPlayers(snapshot).filter((p) => p.isConnected || p.playerId === me?.playerId);
  if (!mini.state || !me) return <p className="form-hint">Loading…</p>;
  const privFor = <T extends C.MiniGamePrivate>(type: C.MiniGameType) => (priv?.type === type ? (priv as T) : null);

  let body;
  switch (mini.type) {
    case 'wordle':
      body = <WordleGame pub={mini.state as C.WordlePublic} priv={privFor<C.WordlePrivate>('wordle')} me={me} players={players} />;
      break;
    case 'chain':
      body = <ChainGame pub={mini.state as C.ChainPublic} priv={privFor<C.ChainPrivate>('chain')} players={players} />;
      break;
    case 'higherLower':
      body = <HigherLowerGame pub={mini.state as C.HigherLowerPublic} priv={privFor<C.HigherLowerPrivate>('higherLower')} players={players} />;
      break;
    case 'nameX':
      body = <NameXGame pub={mini.state as C.NameXPublic} priv={privFor<C.NameXPrivate>('nameX')} players={players} />;
      break;
    case 'pixelGuess':
      body = <PixelGuessGame pub={mini.state as C.PixelPublic} priv={privFor<C.PixelPrivate>('pixelGuess')} players={players} />;
      break;
    case 'logic':
      body = <LogicGame pub={mini.state as C.LogicPublic} priv={privFor<C.LogicPrivate>('logic')} players={players} />;
      break;
  }

  return (
    <div className="minigame-body fade-in">
      {mini.type !== 'higherLower' && <TimerBar start={mini.startAt} end={mini.endAt} />}
      {body}
    </div>
  );
}
