import Phaser from 'phaser';
import { PX } from '../board/layout';
import type { AmbientSystem } from './AmbientSystem';

/** Slow clouds drifting across the whole board, each with a faint ground shadow. */
export class CloudSystem implements AmbientSystem {
  readonly region = null;
  private clouds: { cloud: Phaser.GameObjects.Image; shadow: Phaser.GameObjects.Image; speed: number }[] = [];

  constructor(scene: Phaser.Scene, private readonly worldWidth: number, worldHeight: number, count = 14) {
    for (let i = 0; i < count; i++) {
      const small = i % 3 === 0;
      const x = Math.random() * worldWidth;
      const y = 60 + Math.random() * (worldHeight - 200);
      const scale = PX * (small ? 1.6 : 2 + Math.random() * 0.8);
      const cloud = scene.add.image(x, y, small ? 'cloudSmall' : 'cloud').setScale(scale).setAlpha(0.88).setDepth(100_000);
      const shadow = scene.add
        .image(x + 60, y + 260, small ? 'cloudSmall' : 'cloud')
        .setScale(scale)
        .setTint(0x000000)
        .setAlpha(0.07)
        .setDepth(5);
      this.clouds.push({ cloud, shadow, speed: 6 + Math.random() * 10 });
    }
  }

  setActive() {}

  update(_time: number, delta: number) {
    for (const c of this.clouds) {
      c.cloud.x += (c.speed * delta) / 1000;
      if (c.cloud.x > this.worldWidth + 200) c.cloud.x = -200;
      c.shadow.x = c.cloud.x + 60;
    }
  }
}
