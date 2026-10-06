import { PAWN_SHADES } from '../game/art/sprites';
import { PAWN_COLORS, type PawnColor } from '../types/contracts';
import { audio } from '../audio/AudioManager';
import { PawnIcon } from './PawnIcon';

interface Props {
  value: PawnColor | null;
  taken?: PawnColor[];
  onChange: (c: PawnColor) => void;
  disabled?: boolean;
}

/** Pawn colour chooser. Taken colours are shown but disabled (the server still has the final say). */
export function ColorPicker({ value, taken = [], onChange, disabled }: Props) {
  return (
    <div className="color-picker" role="radiogroup" aria-label="Pawn colour">
      {PAWN_COLORS.map((c) => {
        const isTaken = taken.includes(c) && c !== value;
        const selected = c === value;
        return (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={`${PAWN_SHADES[c].label}${isTaken ? ' (taken)' : ''}`}
            className={`color-swatch ${selected ? 'selected' : ''} ${isTaken ? 'taken' : ''}`}
            style={{ ['--swatch' as string]: PAWN_SHADES[c].css }}
            disabled={disabled || isTaken}
            onMouseEnter={() => !isTaken && audio.play('hover')}
            onClick={() => {
              audio.play('click');
              onChange(c);
            }}
          >
            <PawnIcon color={c} size={44} />
            <span className="swatch-label">{isTaken ? 'TAKEN' : PAWN_SHADES[c].label.toUpperCase()}</span>
          </button>
        );
      })}
    </div>
  );
}
