import Phaser from 'phaser';
import type { Biome, BoardData } from '../../types/contracts';
import { HOUSE_CHIMNEY } from '../art/sprites';
import { mulberry32 } from '../art/textures';
import { biomeRect, PX, type PathIndex, type Point } from '../board/layout';
import type { AmbientSystem } from './AmbientSystem';

interface Rule {
  keys: string[];
  count: number;
  /** Distance band from the trail centre, in world px. */
  near: [number, number];
  spacing: number;
  scale?: number;
  sway?: boolean;
}

const RULES: Record<Biome, Rule[]> = {
  forest: [
    { keys: ['treeRound', 'treeTall'], count: 70, near: [95, 9999], spacing: 46, sway: true },
    { keys: ['pine'], count: 12, near: [110, 9999], spacing: 40, sway: true },
    { keys: ['bush', 'berryBush'], count: 30, near: [70, 9999], spacing: 30 },
    { keys: ['rockForest'], count: 12, near: [60, 9999], spacing: 30 },
    { keys: ['mushroom'], count: 18, near: [55, 400], spacing: 14 },
    { keys: ['flowerPink', 'flowerYellow', 'flowerBlue', 'flowerWhite'], count: 90, near: [45, 9999], spacing: 10 },
    { keys: ['grass'], count: 90, near: [45, 9999], spacing: 12 },
  ],
  village: [
    { keys: ['houseRed', 'houseBlue', 'houseGreen'], count: 10, near: [150, 340], spacing: 120 },
    { keys: ['fence'], count: 16, near: [62, 85], spacing: 34 },
    { keys: ['lamp'], count: 10, near: [58, 76], spacing: 120 },
    { keys: ['barrel', 'crate'], count: 18, near: [70, 260], spacing: 24 },
    { keys: ['bannerRed0', 'bannerYellow0', 'bannerBlue0'], count: 7, near: [65, 110], spacing: 160 },
    { keys: ['well'], count: 2, near: [120, 300], spacing: 200 },
    { keys: ['treeRound'], count: 14, near: [130, 9999], spacing: 50, sway: true },
    { keys: ['bush'], count: 14, near: [70, 9999], spacing: 30 },
    { keys: ['flowerPink', 'flowerYellow', 'flowerWhite'], count: 40, near: [45, 9999], spacing: 10 },
    { keys: ['grass'], count: 50, near: [45, 9999], spacing: 12 },
  ],
  desert: [
    { keys: ['mesa0', 'mesa1', 'mesa2'], count: 4, near: [300, 9999], spacing: 260, scale: PX * 1.6 },
    { keys: ['cactus'], count: 26, near: [70, 9999], spacing: 40, sway: false },
    { keys: ['cactusRound'], count: 16, near: [55, 9999], spacing: 20 },
    { keys: ['rockDesert'], count: 18, near: [60, 9999], spacing: 30 },
    { keys: ['pillar', 'pillarBroken'], count: 14, near: [90, 9999], spacing: 36 },
    { keys: ['bones'], count: 5, near: [60, 9999], spacing: 60 },
    { keys: ['tentRed', 'tentBlue'], count: 4, near: [120, 280], spacing: 140 },
  ],
  snow: [
    { keys: ['mountainSnow0', 'mountainSnow1', 'mountainSnow2'], count: 7, near: [260, 9999], spacing: 230, scale: PX * 1.8 },
    { keys: ['pineSnow'], count: 55, near: [80, 9999], spacing: 34, sway: true },
    { keys: ['rockSnow'], count: 16, near: [60, 9999], spacing: 30 },
    { keys: ['iceCrystal'], count: 16, near: [55, 9999], spacing: 28 },
    { keys: ['snowman'], count: 2, near: [80, 300], spacing: 200 },
  ],
};

/** Places biome decorations deterministically (same layout for every player) and wires up their idle motion. */
export function placeDecorations(
  scene: Phaser.Scene,
  board: BoardData,
  path: PathIndex,
  pond: Point | null,
): AmbientSystem[] {
  const rand = mulberry32(2024);
  const placed: { x: number; y: number; r: number }[] = [];
  const systems: AmbientSystem[] = [];
  const chimneys: Point[] = [];
  const banners: { img: Phaser.GameObjects.Image; base: string }[] = [];
  const finish = board.tiles[board.tiles.length - 1];

  // Castle at the finish line.
  scene.add.image(finish.x + 4, finish.y - 30, 'castle').setOrigin(0.5, 1).setScale(PX * 1.5).setDepth(finish.y - 40);
  placed.push({ x: finish.x, y: finish.y - 80, r: 120 });

  for (const biome of ['forest', 'village', 'desert', 'snow'] as Biome[]) {
    const rect = biomeRect(board, biome);
    for (const rule of RULES[biome]) {
      let made = 0;
      for (let attempt = 0; attempt < rule.count * 40 && made < rule.count; attempt++) {
        const x = rect.x + 40 + rand() * (rect.width - 80);
        const y = 70 + rand() * (board.world.height - 100);
        const d = path.distance(x, y);
        if (d < rule.near[0] || d > rule.near[1]) continue;
        if (pond && Math.hypot((x - pond.x) / 1.8, y - pond.y) < 70) continue;
        if (placed.some((p) => Math.hypot(p.x - x, p.y - y) < Math.max(p.r, rule.spacing))) continue;
        placed.push({ x, y, r: rule.spacing });
        made++;

        const key = rule.keys[Math.floor(rand() * rule.keys.length)];
        const img = scene.add
          .image(Math.round(x), Math.round(y), key)
          .setOrigin(0.5, 1)
          .setScale(rule.scale ?? PX)
          .setDepth(rule.scale ? y - 400 : y);
        if (rand() < 0.5 && !key.startsWith('house') && !key.startsWith('banner')) img.setFlipX(true);

        if (rule.sway) {
          scene.tweens.add({
            targets: img,
            angle: { from: -1.4, to: 1.4 },
            duration: 1600 + rand() * 1400,
            delay: rand() * 1500,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut',
          });
        }
        if (key.startsWith('house')) {
          chimneys.push({ x: img.x - img.displayWidth / 2 + (HOUSE_CHIMNEY.x + 1) * PX, y: img.y - img.displayHeight + HOUSE_CHIMNEY.y * PX });
        }
        if (key.startsWith('banner')) banners.push({ img, base: key.slice(0, -1) });
        if (key === 'lamp') {
          const glow = scene.add.image(img.x, img.y - 12 * PX, 'softGlow').setTint(0xffe08a).setAlpha(0.22).setScale(PX * 1.4).setDepth(y + 1);
          scene.tweens.add({ targets: glow, alpha: { from: 0.12, to: 0.3 }, duration: 260 + rand() * 300, yoyo: true, repeat: -1 });
        }
      }
    }
  }

  // Lily pads + a sparkle on the pond
  if (pond) {
    for (let i = 0; i < 5; i++) {
      const pad = scene.add.image(pond.x - 50 + rand() * 100, pond.y - 20 + rand() * 40, 'lilypad').setScale(PX).setDepth(6);
      scene.tweens.add({ targets: pad, y: pad.y + 3, duration: 1500 + rand() * 800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
  }

  // Waving banners: swap between the two cloth frames.
  scene.time.addEvent({
    delay: 280,
    loop: true,
    callback: () => banners.forEach((b, i) => b.img.setTexture(`${b.base}${(Math.floor(scene.time.now / 280) + i) % 2}`)),
  });

  systems.push(new SmokeSystem(scene, biomeRect(board, 'village'), chimneys));
  systems.push(new LeafSystem(scene, biomeRect(board, 'forest')));
  return systems;
}

/** Chimney smoke for every village house. */
class SmokeSystem implements AmbientSystem {
  readonly region: Phaser.Geom.Rectangle;
  private emitters: Phaser.GameObjects.Particles.ParticleEmitter[] = [];

  constructor(scene: Phaser.Scene, rect: { x: number; y: number; width: number; height: number }, chimneys: Point[]) {
    this.region = new Phaser.Geom.Rectangle(rect.x, rect.y, rect.width, rect.height);
    for (const c of chimneys) {
      const e = scene.add.particles(c.x, c.y, 'smoke', {
        speedY: { min: -30, max: -18 },
        speedX: { min: 4, max: 16 },
        lifespan: 2800,
        scale: { start: PX * 0.5, end: PX * 1.8 },
        alpha: { start: 0.55, end: 0 },
        tint: 0xe6e6ea,
        frequency: 420,
      });
      e.setDepth(c.y + 200);
      this.emitters.push(e);
    }
  }

  setActive(active: boolean) {
    for (const e of this.emitters) {
      e.setVisible(active);
      if (active) e.resume();
      else e.pause();
    }
  }
}

/** A few leaves drifting down through the forest. */
class LeafSystem implements AmbientSystem {
  readonly region: Phaser.Geom.Rectangle;
  private emitter: Phaser.GameObjects.Particles.ParticleEmitter;

  constructor(scene: Phaser.Scene, rect: { x: number; y: number; width: number; height: number }) {
    this.region = new Phaser.Geom.Rectangle(rect.x, rect.y, rect.width, rect.height);
    const zone = new Phaser.Geom.Rectangle(rect.x, rect.y - 20, rect.width, rect.height * 0.8);
    this.emitter = scene.add.particles(0, 0, 'leaf', {
      emitZone: { type: 'random', source: zone, quantity: 1 } as Phaser.Types.GameObjects.Particles.EmitZoneData,
      lifespan: 5000,
      speedY: { min: 20, max: 45 },
      speedX: { min: -25, max: 25 },
      rotate: { min: 0, max: 360 },
      scale: PX,
      alpha: { start: 1, end: 0 },
      frequency: 260,
    });
    this.emitter.setDepth(92_000);
  }

  setActive(active: boolean) {
    this.emitter.setVisible(active);
    if (active) this.emitter.resume();
    else this.emitter.pause();
  }
}
