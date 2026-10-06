import { useState } from 'react';
import { audio, type VolumeSettings } from '../audio/AudioManager';
import { store } from '../state/store';
import { Modal } from './Overlays';
import { PixelButton } from './PixelButton';

export function SettingsModal() {
  const [v, setV] = useState<VolumeSettings>(audio.settings);
  const close = () => store.set({ settingsOpen: false });
  const update = (patch: Partial<VolumeSettings>) => {
    const next = { ...v, ...patch };
    setV(next);
    audio.setVolumes(next);
  };

  return (
    <Modal title="SETTINGS" onClose={close}>
      {(
        [
          ['master', 'MASTER'],
          ['music', 'MUSIC'],
          ['sfx', 'SFX'],
        ] as const
      ).map(([key, label]) => (
        <label key={key} className="slider-row">
          <span>{label}</span>
          <input
            className="px-range"
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={v[key]}
            onChange={(e) => update({ [key]: Number(e.target.value) })}
            onMouseUp={() => audio.play('click')}
          />
          <span>{Math.round(v[key] * 100)}</span>
        </label>
      ))}
      <div style={{ textAlign: 'center', marginTop: 20 }}>
        <PixelButton variant="green" onClick={close}>
          DONE
        </PixelButton>
      </div>
    </Modal>
  );
}

export function HowToPlayModal() {
  const close = () => store.set({ howToOpen: false });
  return (
    <Modal title="HOW TO PLAY" onClose={close}>
      <div className="howto">
        <p>Race your pawn along the winding trail through the Forest, Village, Desert and Snow. First to the castle wins!</p>
        <h3>EACH TURN</h3>
        <ul>
          <li>The active player rolls the die – the number picks the mini-game.</li>
          <li>EVERYONE plays the mini-game at the same time.</li>
          <li>1st place moves +3, 2nd +2, 3rd +1. Everyone else stays.</li>
        </ul>
        <h3>MINI-GAMES</h3>
        <ul>
          <li>1 Wordle Rush · 2 Chain · 3 Higher or Lower</li>
          <li>4 Name X with Y · 5 Guess From Pixels · 6 Logic &amp; Patterns</li>
        </ul>
        <h3>SPECIAL SPACES</h3>
        <ul>
          <li>+2 / -1 – move forward or back.</li>
          <li>Shield – blocks the next bad effect.</li>
          <li>2× – doubles your next top-3 reward.</li>
          <li>Portal – warp 5 spaces ahead.</li>
          <li>Swap – trade places with a player you choose.</li>
          <li>? Mystery – a surprise!</li>
        </ul>
      </div>
      <div style={{ textAlign: 'center', marginTop: 16 }}>
        <PixelButton variant="green" onClick={close}>
          GOT IT!
        </PixelButton>
      </div>
    </Modal>
  );
}
