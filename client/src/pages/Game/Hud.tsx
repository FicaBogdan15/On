import { useState } from 'react';
import { Modal } from '../../components/Overlays';
import { PawnIcon, StatusIcons } from '../../components/PawnIcon';
import { PixelButton } from '../../components/PixelButton';
import { api } from '../../multiplayer/signalr';
import { secondsLeft, useServerNow } from '../../state/clock';
import { store, useStore } from '../../state/store';
import type { Biome, PlayerDto, Snapshot } from '../../types/contracts';

const BIOME_LABEL: Record<Biome, string> = { forest: 'FOREST', village: 'VILLAGE', desert: 'DESERT', snow: 'SNOW PEAKS' };

export function orderedPlayers(s: Snapshot): PlayerDto[] {
  if (s.turnOrder.length === 0) return s.players;
  return [...s.players].sort((a, b) => s.turnOrder.indexOf(a.playerId) - s.turnOrder.indexOf(b.playerId));
}

export function Hud({ snapshot, biome }: { snapshot: Snapshot; biome: Biome }) {
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const myId = useStore((s) => s.playerId);
  const players = orderedPlayers(snapshot);
  const showTurnPanel = snapshot.phase === 'waitingForDiceRoll' || snapshot.phase === 'movingPlayers';

  return (
    <>
      <aside className={`hud-players ${collapsed ? 'collapsed' : ''}`} aria-label="Players">
        <button type="button" className="hud-collapse" onClick={() => setCollapsed((c) => !c)} aria-label="Toggle player list">
          {collapsed ? '▶' : '◀'}
        </button>
        {players.map((p, i) => (
          <div
            key={p.playerId}
            className={`hud-player ${p.playerId === snapshot.currentTurnPlayerId ? 'active' : ''} ${p.isConnected ? '' : 'offline'} ${p.playerId === myId ? 'me' : ''}`}
          >
            <span className="hud-order">{snapshot.turnOrder.length ? i + 1 : ''}</span>
            <PawnIcon color={p.color} size={34} />
            <div className="hud-player-info">
              <div className="hud-player-name">
                {p.name}
                {p.playerId === myId && <span className="you-tag">YOU</span>}
              </div>
              <div className="hud-player-pos">
                SPACE {p.position}/{snapshot.finishIndex}
                {!p.isConnected && <span className="chip red">{p.hasLeft ? 'LEFT' : 'OFFLINE'}</span>}
              </div>
              <div className="hud-progress">
                <span style={{ width: `${(p.position / snapshot.finishIndex) * 100}%` }} />
              </div>
            </div>
            <div className="hud-status">
              <StatusIcons shield={p.hasShield} double={p.doubleMovement} />
            </div>
          </div>
        ))}
      </aside>

      <div className="hud-top">
        <span className="chip">ROOM {snapshot.code}</span>
        <span className={`chip biome-${biome}`}>{BIOME_LABEL[biome]}</span>
        {snapshot.turnNumber > 0 && <span className="chip">TURN {snapshot.turnNumber}</span>}
        <PixelButton variant="ghost" size="small" onClick={() => store.set({ settingsOpen: true })} aria-label="Settings">
          ⚙
        </PixelButton>
        <PixelButton variant="ghost" size="small" onClick={() => store.set({ howToOpen: true })} aria-label="How to play">
          ?
        </PixelButton>
        <PixelButton variant="red" size="small" onClick={() => setConfirmLeave(true)}>
          LEAVE
        </PixelButton>
      </div>

      {showTurnPanel && <TurnPanel snapshot={snapshot} myId={myId} />}

      {confirmLeave && (
        <Modal title="LEAVE MATCH?" onClose={() => setConfirmLeave(false)}>
          <p style={{ textAlign: 'center' }}>Your pawn will stay on the board but you won't be able to rejoin this match.</p>
          <div className="form-actions">
            <PixelButton variant="ghost" onClick={() => setConfirmLeave(false)}>
              STAY
            </PixelButton>
            <PixelButton variant="red" onClick={() => void api.leaveLobby()}>
              LEAVE
            </PixelButton>
          </div>
        </Modal>
      )}
    </>
  );
}

function TurnPanel({ snapshot, myId }: { snapshot: Snapshot; myId: string | null }) {
  const now = useServerNow(250);
  const [rolling, setRolling] = useState(false);
  const current = snapshot.players.find((p) => p.playerId === snapshot.currentTurnPlayerId);
  if (!current) return null;
  const mine = current.playerId === myId;
  const moving = snapshot.phase === 'movingPlayers';

  return (
    <div className={`turn-panel px-panel ${mine && !moving ? 'mine' : ''}`} key={`${snapshot.turnNumber}-${snapshot.phase}`}>
      <div className="turn-title">
        <PawnIcon color={current.color} size={36} />
        <span>{moving ? 'MOVING PAWNS' : mine ? 'YOUR TURN!' : `${current.name.toUpperCase()}'S TURN`}</span>
      </div>
      {moving ? (
        <div className="turn-sub">Watch the board!</div>
      ) : mine ? (
        <>
          <PixelButton
            variant="gold"
            size="big"
            pulse
            disabled={rolling}
            onClick={async () => {
              setRolling(true);
              await api.rollTurnDice();
              setRolling(false);
            }}
          >
            ROLL DICE
          </PixelButton>
          <div className="turn-sub">Auto-roll in {secondsLeft(snapshot.phaseEndsAt, now)}s</div>
        </>
      ) : (
        <div className="turn-sub">
          Waiting for {current.name}…{!current.isConnected && ' (offline – auto-rolling soon)'}
        </div>
      )}
    </div>
  );
}
