import { iconDataUrl, pawnDataUrl } from '../game/art/textures';
import type { PawnColor } from '../types/contracts';

export function PawnIcon({ color, size = 40, className = '' }: { color: PawnColor | null; size?: number; className?: string }) {
  if (!color) return <span className={`pawn-icon empty ${className}`} style={{ width: size * 0.64, height: size }} />;
  return (
    <img
      className={`pawn-icon ${className}`}
      src={pawnDataUrl(color)}
      width={Math.round(size * (14 / 22))}
      height={size}
      alt={`${color} pawn`}
      draggable={false}
    />
  );
}

export function StatusIcons({ shield, double }: { shield: boolean; double: boolean }) {
  return (
    <>
      {shield && <img className="status-icon" src={iconDataUrl('shield')} alt="Shield" title="Shield: blocks one negative effect" />}
      {double && (
        <img className="status-icon" src={iconDataUrl('doubleMovement')} alt="Double movement" title="2× movement on next top-3 finish" style={{ width: 30 }} />
      )}
    </>
  );
}
