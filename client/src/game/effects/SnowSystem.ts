import Phaser from 'phaser';
import { PX } from '../board/layout';
import type { AmbientSystem } from './AmbientSystem';

/** Falling snow pushed by a gentle wind, plus occasional wind streaks and a faint aurora. */
export class SnowSystem implements AmbientSystem {
  private emitters: Phaser.GameObjects.Particles.ParticleEmitter[] = [];
  private streaks: Phaser.GameObjects.Rectangle[] = [];
  private aurora: Phaser.GameObjects.Rectangle[] = [];

  constructor(scene: Phaser.Scene, readonly region: Phaser.Geom.Rectangle) {
    const zone = new Phaser.Geom.Rectangle(region.x - 100, region.y - 40, region.width + 200, 40);
    const flakes = scene.add.particles(0, 0, 'dot2', {
      emitZone: { type: 'random', source: zone, quantity: 1 } as Phaser.Types.GameObjects.Particles.EmitZoneData,
      lifespan: 14000,
      speedY: { min: 50, max: 95 },
      speedX: { min: -40, max: -10 },
      scale: { min: PX * 0.5, max: PX * 1.1 },
      alpha: { start: 0.95, end: 0.6 },
      frequency: 45,
      quantity: 1,
    });
    flakes.setDepth(95_000);
    this.emitters.push(flakes);

    for (let i = 0; i < 6; i++) {
      const s = scene.add
        .rectangle(region.x + Math.random() * region.width, region.y + Math.random() * region.height, 90, 2, 0xffffff, 0.4)
        .setDepth(95_001);
      this.streaks.push(s);
      scene.tweens.add({
        targets: s,
        x: s.x - 400,
        alpha: { from: 0, to: 0.45 },
        duration: 1800 + Math.random() * 1200,
        delay: Math.random() * 4000,
        repeat: -1,
        repeatDelay: 2000 + Math.random() * 4000,
        yoyo: false,
        onRepeat: () => s.setPosition(region.x + Math.random() * region.width, region.y + Math.random() * region.height),
      });
    }

    const colors = [0x6affc8, 0x7ad8ff, 0xb58aff];
    for (let i = 0; i < 3; i++) {
      const band = scene.add
        .rectangle(region.centerX + (i - 1) * 260, region.y + 40 + i * 26, region.width * 0.8, 22, colors[i], 0.08)
        .setDepth(4);
      this.aurora.push(band);
      scene.tweens.add({ targets: band, alpha: 0.2, x: band.x + 60, duration: 3000 + i * 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
  }

  setActive(active: boolean) {
    for (const e of this.emitters) {
      e.setVisible(active);
      if (active) e.resume();
      else e.pause();
    }
    this.streaks.forEach((s) => s.setVisible(active));
  }
}
