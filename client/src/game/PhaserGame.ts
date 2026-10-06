import Phaser from 'phaser';
import { BoardScene } from './scenes/BoardScene';
import { BootScene } from './scenes/BootScene';

export function createPhaserGame(parent: HTMLElement): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    backgroundColor: '#3a7a3a',
    pixelArt: true,
    roundPixels: true,
    antialias: false,
    scale: {
      mode: Phaser.Scale.RESIZE,
      width: parent.clientWidth || 800,
      height: parent.clientHeight || 600,
    },
    fps: { target: 60, smoothStep: true },
    input: { activePointers: 2 },
    scene: [BootScene, BoardScene],
    banner: false,
  });
}
