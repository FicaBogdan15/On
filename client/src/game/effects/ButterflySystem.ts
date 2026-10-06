import Phaser from 'phaser';
import { PX } from '../board/layout';
import type { AmbientSystem } from './AmbientSystem';

const TINTS = [0xff8fc8, 0xffe14a, 0x8fc8ff, 0xffffff, 0xffa64d];

interface Butterfly {
  sprite: Phaser.GameObjects.Image;
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  speed: number;
  phase: number;
}

/** Butterflies fluttering along lissajous loops with a two-frame wing flap. */
export class ButterflySystem implements AmbientSystem {
  private butterflies: Butterfly[] = [];
  private active = true;
  private flap = 0;

  constructor(scene: Phaser.Scene, readonly region: Phaser.Geom.Rectangle, count = 10) {
    for (let i = 0; i < count; i++) {
      const sprite = scene.add
        .image(0, 0, 'butterfly0')
        .setScale(PX)
        .setTint(TINTS[i % TINTS.length])
        .setDepth(90_000);
      this.butterflies.push({
        sprite,
        cx: region.x + 80 + Math.random() * (region.width - 160),
        cy: region.y + 120 + Math.random() * (region.height - 240),
        rx: 60 + Math.random() * 120,
        ry: 30 + Math.random() * 60,
        speed: 0.0004 + Math.random() * 0.0005,
        phase: Math.random() * Math.PI * 2,
      });
    }
  }

  setActive(active: boolean) {
    this.active = active;
    this.butterflies.forEach((b) => b.sprite.setVisible(active));
  }

  update(time: number, delta: number) {
    if (!this.active) return;
    this.flap += delta;
    const frame = Math.floor(this.flap / 110) % 2;
    for (const b of this.butterflies) {
      const t = time * b.speed + b.phase;
      b.sprite.setPosition(b.cx + Math.sin(t) * b.rx, b.cy + Math.sin(t * 2.3) * b.ry + Math.sin(time * 0.01) * 3);
      b.sprite.setTexture(frame ? 'butterfly1' : 'butterfly0');
    }
  }
}
