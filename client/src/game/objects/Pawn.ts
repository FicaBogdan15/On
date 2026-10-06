import Phaser from 'phaser';
import type { PawnColor } from '../../types/contracts';
import { PAWN_SHADES } from '../art/sprites';
import { PX } from '../board/layout';

export type PawnState = 'idle' | 'moving' | 'landing' | 'positive' | 'negative' | 'teleport';

const FONT = '"Press Start 2P", monospace';

/** A classic board-game pawn: sprite + shadow + active glow + status badges + name tag. */
export class Pawn extends Phaser.GameObjects.Container {
  readonly playerId: string;
  tileIndex: number;
  pawnState: PawnState = 'idle';

  private readonly figure: Phaser.GameObjects.Image;
  private readonly shadow: Phaser.GameObjects.Image;
  private readonly glow: Phaser.GameObjects.Image;
  private readonly shieldBadge: Phaser.GameObjects.Image;
  private readonly doubleBadge: Phaser.GameObjects.Image;
  private readonly nameTag: Phaser.GameObjects.Text;
  private glowTween?: Phaser.Tweens.Tween;
  private idleTween?: Phaser.Tweens.Tween;

  constructor(scene: Phaser.Scene, playerId: string, name: string, color: PawnColor, tileIndex: number) {
    super(scene, 0, 0);
    this.playerId = playerId;
    this.tileIndex = tileIndex;

    this.glow = scene.add.image(0, 0, 'glowRing').setScale(PX * 0.9, PX * 0.45).setTint(0xfff27a).setVisible(false);
    this.shadow = scene.add.image(0, 2, 'shadow').setScale(PX * 0.9, PX * 0.35).setAlpha(0.28).setTint(0x000000);
    this.figure = scene.add.image(0, 4, `pawn-${color}`).setOrigin(0.5, 1).setScale(PX);
    this.shieldBadge = scene.add.image(-24, -50, 'icon-shield').setScale(PX * 0.6).setVisible(false);
    this.doubleBadge = scene.add.image(24, -50, 'icon-doubleMovement').setScale(PX * 0.45).setVisible(false);
    this.nameTag = scene.add
      .text(0, 14, name.toUpperCase(), {
        fontFamily: FONT,
        fontSize: '9px',
        color: '#ffffff',
        stroke: PAWN_SHADES[color].d,
        strokeThickness: 4,
      })
      .setOrigin(0.5, 0)
      .setResolution(2);

    this.add([this.glow, this.shadow, this.figure, this.shieldBadge, this.doubleBadge, this.nameTag]);
    scene.add.existing(this);

    this.startIdle();
  }

  /** Gentle breathing loop. Recreated after stopAllTweens(), which also kills it. */
  private startIdle() {
    this.idleTween = this.scene.tweens.add({
      targets: this.figure,
      scaleY: PX * 1.03,
      duration: 900 + Math.random() * 300,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  placeAt(x: number, y: number) {
    this.setPosition(x, y);
    this.setDepth(y + 10);
  }

  setActiveTurn(active: boolean) {
    this.glow.setVisible(active);
    this.glowTween?.stop();
    if (active) {
      this.glowTween = this.scene.tweens.add({
        targets: this.glow,
        alpha: { from: 1, to: 0.35 },
        scaleX: { from: PX * 0.9, to: PX * 1.15 },
        scaleY: { from: PX * 0.45, to: PX * 0.58 },
        duration: 700,
        yoyo: true,
        repeat: -1,
      });
    }
  }

  /** Name tags overlap when pawns share a tile, so only lone pawns show them. */
  setNameVisible(visible: boolean) {
    this.nameTag.setVisible(visible);
  }

  setStatus(hasShield: boolean, doubleMovement: boolean, connected: boolean) {
    this.shieldBadge.setVisible(hasShield);
    this.doubleBadge.setVisible(doubleMovement);
    this.figure.setAlpha(connected ? 1 : 0.45);
    this.nameTag.setAlpha(connected ? 1 : 0.5);
  }

  /** One step of movement: a small hop with squash & stretch on landing. */
  hopTo(x: number, y: number, duration: number): Promise<void> {
    this.pawnState = 'moving';
    this.idleTween?.pause();
    const startX = this.x, startY = this.y;
    const arc = 34;
    return new Promise((resolve) => {
      this.scene.tweens.addCounter({
        from: 0,
        to: 1,
        duration,
        ease: 'Linear',
        onUpdate: (t) => {
          const v = t.getValue() ?? 0;
          this.placeAt(startX + (x - startX) * v, startY + (y - startY) * v);
          this.figure.y = 4 - Math.sin(v * Math.PI) * arc;
          this.figure.scaleY = PX * (1 + Math.sin(v * Math.PI) * 0.12);
          this.figure.scaleX = PX * (1 - Math.sin(v * Math.PI) * 0.06);
          this.shadow.setScale(PX * (0.9 - Math.sin(v * Math.PI) * 0.3), PX * 0.35);
        },
        onComplete: () => {
          this.figure.y = 4;
          this.land().then(resolve);
        },
      });
    });
  }

  land(): Promise<void> {
    this.pawnState = 'landing';
    return new Promise((resolve) => {
      this.scene.tweens.add({
        targets: this.figure,
        scaleY: { from: PX * 0.78, to: PX },
        scaleX: { from: PX * 1.18, to: PX },
        duration: 160,
        ease: 'Back.easeOut',
        onComplete: () => {
          this.pawnState = 'idle';
          this.idleTween?.resume();
          resolve();
        },
      });
    });
  }

  /** Long arcing jump (used for swaps). */
  arcTo(x: number, y: number, duration: number, height = 140): Promise<void> {
    const sx = this.x, sy = this.y;
    return new Promise((resolve) => {
      this.scene.tweens.addCounter({
        from: 0,
        to: 1,
        duration,
        ease: 'Sine.easeInOut',
        onUpdate: (t) => {
          const v = t.getValue() ?? 0;
          this.placeAt(sx + (x - sx) * v, sy + (y - sy) * v);
          this.figure.y = 4 - Math.sin(v * Math.PI) * height;
          this.figure.angle = Math.sin(v * Math.PI * 2) * 12;
        },
        onComplete: () => {
          this.figure.y = 4;
          this.figure.angle = 0;
          this.land().then(resolve);
        },
      });
    });
  }

  vanish(duration: number): Promise<void> {
    this.pawnState = 'teleport';
    return new Promise((resolve) =>
      this.scene.tweens.add({
        targets: this.figure,
        scaleX: 0,
        scaleY: PX * 1.6,
        angle: 180,
        alpha: 0,
        duration,
        ease: 'Back.easeIn',
        onComplete: () => resolve(),
      }),
    );
  }

  appear(duration: number): Promise<void> {
    this.figure.setAngle(-180).setAlpha(0).setScale(0, PX * 1.6);
    return new Promise((resolve) =>
      this.scene.tweens.add({
        targets: this.figure,
        scaleX: PX,
        scaleY: PX,
        angle: 0,
        alpha: 1,
        duration,
        ease: 'Back.easeOut',
        onComplete: () => {
          this.pawnState = 'idle';
          resolve();
        },
      }),
    );
  }

  /** Quick celebratory bounce or sad shake. */
  react(kind: 'positive' | 'negative'): Promise<void> {
    this.pawnState = kind;
    return new Promise((resolve) => {
      const tween =
        kind === 'positive'
          ? { targets: this.figure, y: { from: 4, to: -22 }, duration: 200, yoyo: true, repeat: 1, ease: 'Quad.easeOut' }
          : { targets: this.figure, x: { from: -5, to: 5 }, duration: 60, yoyo: true, repeat: 4 };
      this.scene.tweens.add({
        ...tween,
        onComplete: () => {
          this.figure.setPosition(0, 4);
          this.pawnState = 'idle';
          resolve();
        },
      });
    });
  }

  stopAllTweens() {
    this.scene.tweens.killTweensOf([this, this.figure, this.shadow]);
    this.figure.setPosition(0, 4).setAngle(0).setAlpha(1).setScale(PX);
    this.shadow.setScale(PX * 0.9, PX * 0.35);
    this.pawnState = 'idle';
    // killTweensOf destroyed the idle loop too; pausing/resuming a destroyed tween throws.
    this.startIdle();
  }
}
