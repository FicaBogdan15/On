import Phaser from 'phaser';
import { PAWN_COLORS, type Biome, type TileType } from '../../types/contracts';
import * as S from '../art/sprites';
import { makeCircle, makeRing, renderCastle, renderMountain, renderSprite, renderTile } from '../art/textures';

const BIOMES: Biome[] = ['forest', 'village', 'desert', 'snow'];
const TILE_TYPES: TileType[] = ['start', 'empty', 'mystery', 'shield', 'swap', 'plusTwo', 'minusOne', 'doubleMovement', 'portal', 'finish'];

/** Generates every texture from the sprite definitions so no image files need to be downloaded. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  private add1(key: string, canvas: HTMLCanvasElement) {
    if (!this.textures.exists(key)) this.textures.addCanvas(key, canvas);
  }

  async create() {
    for (const c of PAWN_COLORS) this.add1(`pawn-${c}`, renderSprite(S.pawnSprite(c)));
    for (const [name, def] of Object.entries(S.ICONS)) this.add1(`icon-${name}`, renderSprite(def, 1, S.OUTLINE));

    for (const b of BIOMES) for (const t of TILE_TYPES) for (let v = 0; v < 3; v++) this.add1(`tile-${b}-${t}-${v}`, renderTile(b, t, v + 1));

    const sprites: Record<string, S.SpriteDef> = {
      treeRound: S.TREE_ROUND,
      treeTall: S.TREE_TALL,
      pine: S.PINE,
      pineSnow: S.PINE_SNOW,
      bush: S.BUSH,
      berryBush: S.BERRY_BUSH,
      rockForest: S.rock('#b8bcb0', '#8c9286', '#5e645a'),
      rockDesert: S.rock('#e0b080', '#b8875a', '#86603c'),
      rockSnow: S.rock('#a8b4c4', '#7c8aa0', '#56627a', '#ffffff'),
      flowerPink: S.flower('#ff8fc8'),
      flowerYellow: S.flower('#ffe14a'),
      flowerBlue: S.flower('#8fc8ff'),
      flowerWhite: S.flower('#ffffff'),
      mushroom: S.MUSHROOM,
      grass: S.GRASS,
      lilypad: S.LILYPAD,
      butterfly0: S.BUTTERFLY[0],
      butterfly1: S.BUTTERFLY[1],
      cloud: S.CLOUD,
      cloudSmall: S.CLOUD_SMALL,
      houseRed: S.house('#c8483a', '#8e2e26', '#f3e3c3'),
      houseBlue: S.house('#4a6ac8', '#2e4690', '#efe6d2'),
      houseGreen: S.house('#4a9a5a', '#2e6a3a', '#f6ead0'),
      fence: S.FENCE,
      lamp: S.LAMP,
      barrel: S.BARREL,
      crate: S.CRATE,
      well: S.WELL,
      cactus: S.CACTUS,
      cactusRound: S.CACTUS_ROUND,
      bones: S.BONES,
      pillar: S.PILLAR,
      pillarBroken: S.PILLAR_BROKEN,
      tentRed: S.tent('#d0443a'),
      tentBlue: S.tent('#3a6ad0'),
      tumbleweed: S.TUMBLEWEED,
      iceCrystal: S.ICE_CRYSTAL,
      snowman: S.SNOWMAN,
      sparkle: S.SPARKLE,
      leaf: S.LEAF,
      dot: S.DOT,
      dot2: S.DOT2,
      smoke: S.SMOKE,
    };
    for (const [key, def] of Object.entries(sprites)) this.add1(key, renderSprite(def));

    S.banner('#e53935', '#a02020').forEach((d, i) => this.add1(`bannerRed${i}`, renderSprite(d)));
    S.banner('#f2c21b', '#b08a10').forEach((d, i) => this.add1(`bannerYellow${i}`, renderSprite(d)));
    S.banner('#3a8de0', '#2060a0').forEach((d, i) => this.add1(`bannerBlue${i}`, renderSprite(d)));

    for (let i = 0; i < 3; i++) {
      this.add1(`mountainSnow${i}`, renderMountain(70 + i * 14, 46 + i * 8, i + 10, true));
      this.add1(`mesa${i}`, renderMountain(54 + i * 10, 26 + i * 6, i + 20, false));
    }
    this.add1('castle', renderCastle());
    this.add1('shadow', makeCircle(8, '#000000', 1));
    this.add1('glowRing', makeRing(14, 2, '#ffffff'));
    this.add1('portalRing', makeRing(10, 2, '#ff8cff'));
    this.add1('softGlow', makeCircle(10, '#ffffff', 1));

    // Pixel font must be ready before Phaser text objects are created.
    try {
      await Promise.race([document.fonts.load('16px "Press Start 2P"'), new Promise((r) => setTimeout(r, 1500))]);
    } catch {
      /* fallback font is fine */
    }
    // The game may have been destroyed while we waited for the font.
    if (!this.sys.game || !this.sys.isActive()) return;
    this.scene.start('Board');
  }
}
