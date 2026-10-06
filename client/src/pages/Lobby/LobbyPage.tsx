import { useState } from 'react';
import { ColorPicker } from '../../components/ColorPicker';
import { MenuBackground } from '../../components/MenuBackground';
import { PawnIcon } from '../../components/PawnIcon';
import { PixelButton } from '../../components/PixelButton';
import { iconDataUrl } from '../../game/art/textures';
import { api } from '../../multiplayer/signalr';
import { store, useMe, useStore } from '../../state/store';
import type { PawnColor, PlayerDto, Snapshot } from '../../types/contracts';
import '../pages.css';

/** Mirrors the server rule only to grey out the button; the server re-validates on StartGame. */
function startBlocker(s: Snapshot): string | null {
  if (s.players.length < s.minPlayers) return `Need at least ${s.minPlayers} player${s.minPlayers === 1 ? '' : 's'}`;
  if (s.players.some((p) => !p.isConnected)) return 'Waiting for a disconnected player';
  if (s.players.some((p) => !p.isReady || !p.color)) return 'Waiting for everyone to be ready';
  return null;
}

export function LobbyPage() {
  const snapshot = useStore((s) => s.snapshot)!;
  const me = useMe();
  const [copied, setCopied] = useState(false);
  const isHost = snapshot.hostPlayerId === me?.playerId;
  const taken = snapshot.players.filter((p) => p.color && p.playerId !== me?.playerId).map((p) => p.color as PawnColor);
  const blocker = startBlocker(snapshot);

  const copyInvite = async () => {
    const url = `${window.location.origin}/?join=${snapshot.code}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      store.toast(`Share this link: ${url}`, 'info');
    }
  };

  return (
    <div className="menu-screen">
      <MenuBackground />
      <div className="lobby-layout">
        <section className="px-panel lobby-code pop-in">
          <span className="px-label">ROOM CODE</span>
          <div className="room-code" aria-label={`Room code ${snapshot.code.split('').join(' ')}`}>
            {snapshot.code}
          </div>
          <PixelButton variant="ghost" size="small" onClick={copyInvite}>
            {copied ? 'COPIED!' : 'COPY INVITE LINK'}
          </PixelButton>
          <div className="player-count">
            PLAYERS {snapshot.players.length} / {snapshot.maxPlayers}
          </div>
        </section>

        <section className="px-panel lobby-players pop-in">
          <h2 className="px-panel-title">PLAYERS</h2>
          <div className="player-grid">
            {Array.from({ length: snapshot.maxPlayers }, (_, i) => snapshot.players[i]).map((p, i) =>
              p ? <PlayerCard key={p.playerId} player={p} isMe={p.playerId === me?.playerId} /> : <EmptySlot key={`empty-${i}`} />,
            )}
          </div>
        </section>

        {me && (
          <section className="px-panel lobby-controls pop-in">
            <h2 className="px-panel-title">YOUR PAWN</h2>
            <ColorPicker value={me.color} taken={taken} onChange={(c) => void api.chooseColor(c)} />
            <div className="lobby-actions">
              <PixelButton variant={me.isReady ? 'orange' : 'green'} onClick={() => void api.setReady(!me.isReady)} disabled={!me.color} pulse={!me.isReady && !!me.color}>
                {me.isReady ? 'NOT READY' : 'READY'}
              </PixelButton>
              {isHost && (
                <PixelButton variant="gold" disabled={!!blocker} onClick={() => void api.startGame()} pulse={!blocker}>
                  START GAME
                </PixelButton>
              )}
            </div>
            <p className="form-hint">
              {!me.color
                ? 'Pick a pawn colour, then press READY.'
                : isHost
                  ? (blocker ?? 'Everyone is ready – start the game!')
                  : `Waiting for the host to start… ${blocker ? `(${blocker.toLowerCase()})` : ''}`}
            </p>
            <div className="lobby-actions">
              <PixelButton variant="ghost" size="small" onClick={() => void api.leaveLobby()}>
                LEAVE LOBBY
              </PixelButton>
              <PixelButton variant="ghost" size="small" onClick={() => store.set({ howToOpen: true })}>
                HOW TO PLAY
              </PixelButton>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function PlayerCard({ player, isMe }: { player: PlayerDto; isMe: boolean }) {
  return (
    <div className={`player-card ${player.isReady ? 'ready' : ''} ${player.isConnected ? '' : 'offline'} ${isMe ? 'me' : ''} pop-in`}>
      {player.isHost && <img className="host-crown" src={iconDataUrl('crown')} alt="Host" title="Host" />}
      <PawnIcon color={player.color} size={48} />
      <div className="player-card-name">
        {player.name}
        {isMe && <span className="you-tag">YOU</span>}
      </div>
      <span className={`chip ${player.isReady ? 'green' : ''}`}>{!player.isConnected ? 'OFFLINE' : player.isReady ? '✔ READY' : 'NOT READY'}</span>
    </div>
  );
}

function EmptySlot() {
  return (
    <div className="player-card empty">
      <span className="dots">WAITING…</span>
    </div>
  );
}
