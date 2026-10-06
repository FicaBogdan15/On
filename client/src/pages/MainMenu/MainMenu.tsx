import { useState } from 'react';
import { ColorPicker } from '../../components/ColorPicker';
import { MenuBackground } from '../../components/MenuBackground';
import { PawnIcon } from '../../components/PawnIcon';
import { PixelButton } from '../../components/PixelButton';
import { api } from '../../multiplayer/signalr';
import { getSavedName, saveName } from '../../state/session';
import { store, useStore } from '../../state/store';
import type { PawnColor } from '../../types/contracts';
import '../pages.css';

export function MainMenu() {
  const screen = useStore((s) => s.menuScreen);
  return (
    <div className="menu-screen">
      <MenuBackground />
      <div className="menu-content">
        <Logo compact={screen !== 'menu'} />
        {screen === 'menu' && <MenuButtons />}
        {screen === 'host' && <HostForm />}
        {screen === 'join' && <JoinForm />}
      </div>
    </div>
  );
}

function Logo({ compact }: { compact: boolean }) {
  return (
    <div className={`logo ${compact ? 'compact' : ''}`}>
      <div className="logo-pawns">
        {(['red', 'blue', 'green', 'yellow'] as const).map((c, i) => (
          <span key={c} className="bob" style={{ animationDelay: `${i * 0.18}s` }}>
            <PawnIcon color={c} size={compact ? 34 : 56} />
          </span>
        ))}
      </div>
      <h1 className="logo-title">
        PIXEL<br />PAWNS
      </h1>
      {!compact && <p className="logo-sub">A party board game of quick puzzles</p>}
    </div>
  );
}

function MenuButtons() {
  return (
    <div className="menu-buttons fade-in">
      <PixelButton variant="green" size="big" onClick={() => store.set({ menuScreen: 'host' })}>
        HOST LOBBY
      </PixelButton>
      <PixelButton variant="blue" size="big" onClick={() => store.set({ menuScreen: 'join' })}>
        JOIN LOBBY
      </PixelButton>
      <div className="menu-small">
        <PixelButton variant="ghost" size="small" onClick={() => store.set({ settingsOpen: true })}>
          SETTINGS
        </PixelButton>
        <PixelButton variant="ghost" size="small" onClick={() => store.set({ howToOpen: true })}>
          HOW TO PLAY
        </PixelButton>
      </div>
    </div>
  );
}

function HostForm() {
  const [name, setName] = useState(getSavedName);
  const [color, setColor] = useState<PawnColor>('red');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!name.trim()) return store.toast('Pick a name first!');
    setBusy(true);
    saveName(name.trim());
    await api.createLobby(name.trim(), color);
    setBusy(false);
  };

  return (
    <form
      className="px-panel menu-form pop-in"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <h2 className="px-panel-title">HOST A LOBBY</h2>
      <label className="px-field">
        <span className="px-label">DISPLAY NAME</span>
        <input className="px-input" value={name} maxLength={16} autoFocus onChange={(e) => setName(e.target.value)} placeholder="Your name" />
      </label>
      <div className="px-field">
        <span className="px-label">PAWN COLOUR</span>
        <ColorPicker value={color} onChange={setColor} />
      </div>
      <div className="form-actions">
        <PixelButton variant="ghost" onClick={() => store.set({ menuScreen: 'menu' })}>
          BACK
        </PixelButton>
        <PixelButton variant="green" type="submit" disabled={busy}>
          {busy ? 'CREATING…' : 'CREATE LOBBY'}
        </PixelButton>
      </div>
    </form>
  );
}

function JoinForm() {
  const params = new URLSearchParams(window.location.search);
  const [code, setCode] = useState(params.get('join')?.toUpperCase() ?? '');
  const [name, setName] = useState(getSavedName);
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(false);

  const submit = async () => {
    if (code.trim().length < 4) {
      setShake(true);
      window.setTimeout(() => setShake(false), 400);
      return store.toast('Room codes have 4 to 6 letters.');
    }
    if (!name.trim()) return store.toast('Pick a name first!');
    setBusy(true);
    saveName(name.trim());
    const ok = await api.joinLobby(code, name.trim());
    if (!ok) {
      setShake(true);
      window.setTimeout(() => setShake(false), 400);
    }
    setBusy(false);
  };

  return (
    <form
      className="px-panel menu-form pop-in"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <h2 className="px-panel-title">JOIN A LOBBY</h2>
      <label className="px-field">
        <span className="px-label">ROOM CODE</span>
        <input
          className={`px-input code ${shake ? 'shake' : ''}`}
          value={code}
          maxLength={6}
          autoFocus={!code}
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
          placeholder="AB7K"
        />
      </label>
      <label className="px-field">
        <span className="px-label">PLAYER NAME</span>
        <input className="px-input" value={name} maxLength={16} autoFocus={!!code} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
      </label>
      <p className="form-hint">You'll pick your pawn colour in the lobby.</p>
      <div className="form-actions">
        <PixelButton variant="ghost" onClick={() => store.set({ menuScreen: 'menu' })}>
          BACK
        </PixelButton>
        <PixelButton variant="blue" type="submit" disabled={busy}>
          {busy ? 'JOINING…' : 'JOIN'}
        </PixelButton>
      </div>
    </form>
  );
}
