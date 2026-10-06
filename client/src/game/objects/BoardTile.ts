import Phaser from 'phaser';
import type { BoardTileDto } from '../../types/contracts';
import { PX } from '../board/layout';

const ICON_FOR: Partial<Record<BoardTileDto['type'], string>> = {
  start: 'icon-start',
  finish: 'icon-finish',
  mystery: 'icon-mystery',
  shield: 'icon-shield',
  swap: 'icon-swap',
  plusTwo: 'icon-plusTwo',
  minusOne: 'icon-minusOne',
  doubleMovement: 'icon-doubleMovement',
  portal: 'icon-portal',
};

/** One circular board space; special spaces get a floating icon, portals a spinning ring. */
export class BoardTile {
  readonly base: Phaser.GameObjects.Image;
  readonly icon?: Phaser.GameObjects.Image;
  private ring?: Phaser.GameObjects.Image;

  constructor(scene: Phaser.Scene, readonly tile: BoardTileDto) {
    const variant = tile.index % 3;
    this.base = scene.add.image(tile.x, tile.y, `tile-${tile.biome}-${tile.type}-${variant}`).setScale(PX).setDepth(tile.y - 30);

    const iconKey = ICON_FOR[tile.type];
    if (iconKey) {
      this.icon = scene.add.image(tile.x, tile.y - 6, iconKey).setScale(PX * 0.85).setDepth(tile.y - 29);
      scene.tweens.add({
        targets: this.icon,
        y: tile.y - 12,
        duration: 1100 + (tile.index % 5) * 90,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }

    if (tile.type === 'portal') {
      this.ring = scene.add.image(tile.x, tile.y - 4, 'portalRing').setScale(PX * 1.1, PX * 0.6).setDepth(tile.y - 29).setAlpha(0.8);
      scene.tweens.add({ targets: this.ring, angle: 360, duration: 3000, repeat: -1 });
      scene.tweens.add({ targets: this.ring, alpha: 0.3, duration: 800, yoyo: true, repeat: -1 });
    }

    if (tile.type === 'finish') {
      const glow = scene.add.image(tile.x, tile.y, 'softGlow').setScale(PX * 4, PX * 2).setTint(0xffe27a).setAlpha(0.35).setDepth(tile.y - 31);
      scene.tweens.add({ targets: glow, alpha: 0.12, scaleX: PX * 5, duration: 1200, yoyo: true, repeat: -1 });
    }
  }

  /** Brief pulse when a pawn lands here. */
  pulse(scene: Phaser.Scene) {
    scene.tweens.add({ targets: this.base, scaleX: PX * 1.12, scaleY: PX * 0.9, duration: 90, yoyo: true });
  }
}
