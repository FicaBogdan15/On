import type Phaser from 'phaser';

/**
 * Lightweight looping environment animation. The BoardScene pauses systems whose region is off-screen
 * so invisible particles and tweens cost nothing.
 */
export interface AmbientSystem {
  /** World-space area this system lives in; null = always active (e.g. clouds). */
  readonly region: Phaser.Geom.Rectangle | null;
  setActive(active: boolean): void;
  update?(time: number, delta: number): void;
}
