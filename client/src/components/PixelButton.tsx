import type { ButtonHTMLAttributes } from 'react';
import { audio } from '../audio/AudioManager';

type Variant = 'blue' | 'green' | 'orange' | 'red' | 'gold' | 'purple' | 'ghost';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: 'small' | 'normal' | 'big';
  block?: boolean;
  pulse?: boolean;
}

export function PixelButton({ variant = 'blue', size = 'normal', block, pulse, className = '', onClick, onMouseEnter, ...rest }: Props) {
  const classes = ['px-btn', variant, size !== 'normal' ? size : '', block ? 'block' : '', pulse ? 'pulse' : '', className]
    .filter(Boolean)
    .join(' ');
  return (
    <button
      type="button"
      className={classes}
      onMouseEnter={(e) => {
        if (!rest.disabled) audio.play('hover');
        onMouseEnter?.(e);
      }}
      onClick={(e) => {
        audio.play('click');
        onClick?.(e);
      }}
      {...rest}
    />
  );
}
