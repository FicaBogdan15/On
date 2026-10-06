import Phaser from 'phaser';
import { PX } from '../board/layout';
import type { AmbientSystem } from './AmbientSystem';

/** Drifting sand grains, a shimmering heat haze and tumbleweeds rolling across the desert. */
export class SandSystem implements AmbientSystem {
  private emitter: Phaser.GameObjects.Particles.ParticleEmitter;
  private haze: Phaser.GameObjects.Rectangle[] = [];
  private weeds: { sprite: Phaser.GameObjects.Image; speed: number; baseY: number }[] = [];
  private active = true;

  constructor(scene: Phaser.Scene, readonly region: Phaser.Geom.Rectangle) {
    const zone = new Phaser.Geom.Rectangle(region.x - 60, region.y, 40, region.height);
    this.emitter = scene.add.particles(0, 0, 'dot', {
      emitZone: { type: 'random', source: zone, quantity: 1 } as Phaser.Types.GameObjects.Particles.EmitZoneData,
      lifespan: 9000,
      speedX: { min: 110, max: 190 },
      speedY: { min: -12, max: 12 },
      scale: { min: PX * 0.7, max: PX * 1.2 },
      alpha: { start: 0.75, end: 0 },
      tint: [0xf6dc9c, 0xd9b066, 0xffffff],
      frequency: 55,
      quantity: 1,
    });
    this.emitter.setDepth(95_000);

    for (let i = 0; i < 10; i++) {
      const line = scene.add
        .rectangle(region.x + Math.random() * region.width, region.y + Math.random() * region.height, 140 + Math.random() * 120, PX, 0xffffff, 0)
        .setDepth(94_999);
      this.haze.push(line);
      scene.tweens.add({
        targets: line,
        alpha: { from: 0, to: 0.18 },
        x: line.x + 40,
        duration: 1400 + Math.random() * 1200,
        yoyo: true,
        repeat: -1,
        delay: Math.random() * 2000,
        ease: 'Sine.easeInOut',
      });
    }

    for (let i = 0; i < 3; i++) {
      const baseY = region.y + 200 + Math.random() * (region.height - 400);
      const sprite = scene.add.image(region.x + Math.random() * region.width, baseY, 'tumbleweed').setScale(PX).setDepth(baseY + 5);
      this.weeds.push({ sprite, speed: 60 + Math.random() * 50, baseY });
    }
  }

  setActive(active: boolean) {
    this.active = active;
    this.emitter.setVisible(active);
    if (active) this.emitter.resume();
    else this.emitter.pause();
  }

  update(time: number, delta: number) {
    if (!this.active) return;
    for (const w of this.weeds) {
      w.sprite.x += (w.speed * delta) / 1000;
      w.sprite.angle += (w.speed * delta) / 60;
      w.sprite.y = w.baseY - Math.abs(Math.sin(time * 0.006 + w.baseY)) * 18;
      if (w.sprite.x > this.region.right + 40) w.sprite.x = this.region.x - 40;
    }
  }
}
