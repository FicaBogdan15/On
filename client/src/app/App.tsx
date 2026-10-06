import { useEffect } from 'react';
import { ConnectionBanner, Toasts } from '../components/Overlays';
import { HowToPlayModal, SettingsModal } from '../components/SettingsModal';
import { startConnection } from '../multiplayer/signalr';
import { useStore } from '../state/store';
import { GamePage } from '../pages/Game/GamePage';
import { LobbyPage } from '../pages/Lobby/LobbyPage';
import { MainMenu } from '../pages/MainMenu/MainMenu';

/** Screen routing is driven by the server snapshot: no lobby → menus, lobby phase → lobby, otherwise → board. */
export function App() {
  const phase = useStore((s) => s.snapshot?.phase ?? null);
  const inLobby = useStore((s) => !!s.snapshot && !!s.playerId && s.snapshot.players.some((p) => p.playerId === s.playerId));
  const settingsOpen = useStore((s) => s.settingsOpen);
  const howToOpen = useStore((s) => s.howToOpen);

  useEffect(() => {
    void startConnection();
    // Escape must never leave a match; just close dialogs.
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  let screen;
  if (!inLobby || !phase) screen = <MainMenu />;
  else if (phase === 'lobby') screen = <LobbyPage />;
  else screen = <GamePage />;

  return (
    <>
      {screen}
      <ConnectionBanner />
      <Toasts />
      {settingsOpen && <SettingsModal />}
      {howToOpen && <HowToPlayModal />}
    </>
  );
}
