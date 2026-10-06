import type { Biome, BoardData } from '../../types/contracts';
import { createCanvas, mulberry32 } from '../art/textures';
import { PX, type Point } from './layout';

type RGB = [number, number, number];
const hex = (h: string): RGB => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

const GROUND: Record<Biome, { base: RGB; dark: RGB; light: RGB; speck: RGB }> = {
  forest: { base: hex('#62b548'), dark: hex('#4f9a3c'), light: hex('#7fcb5a'), speck: hex('#9ee070') },
  village: { base: hex('#8cc25a'), dark: hex('#76aa4a'), light: hex('#a6d66e'), speck: hex('#c7e88a') },
  desert: { base: hex('#ecc97f'), dark: hex('#d9b066'), light: hex('#f6dc9c'), speck: hex('#c99c58') },
  snow: { base: hex('#eaf4fb'), dark: hex('#c9deef'), light: hex('#ffffff'), speck: hex('#b2cde4') },
};

const TRAIL: Record<Biome, { fill: RGB; edge: RGB; speck: RGB }> = {
  forest: { fill: hex('#c9a46a'), edge: hex('#9a7646'), speck: hex('#b28f58') },
  village: { fill: hex('#b9b1a3'), edge: hex('#857c6e'), speck: hex('#9c9486') },
  desert: { fill: hex('#d4a35e'), edge: hex('#a87a3e'), speck: hex('#c08e4c') },
  snow: { fill: hex('#cfdeea'), edge: hex('#8eaac2'), speck: hex('#b8cbdb') },
};

const WATER = { deep: hex('#3a8ad8'), light: hex('#6ab8f0'), foam: hex('#cfeaff') };
const PLANK = { a: hex('#a8743e'), b: hex('#8a5a2e'), edge: hex('#5a3a1e') };

/** Smooth value noise in [0,1]. */
function makeNoise(seed: number) {
  const rand = mulberry32(seed);
  const size = 256;
  const table = Array.from({ length: size * size }, () => rand());
  const at = (x: number, y: number) => table[((y & (size - 1)) * size + (x & (size - 1)))];
  return (x: number, y: number) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = at(xi, yi), b = at(xi + 1, yi), c = at(xi, yi + 1), d = at(xi + 1, yi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
}

export interface GroundResult {
  canvas: HTMLCanvasElement;
  pond: Point | null;
  riverX: number;
  bridgeY: number;
}

/**
 * Paints the whole world floor at 1 cell = PX world pixels: biome ground with dithered transitions,
 * the dirt/cobble/sand/snow trail, a river with a bridge between forest and village, and a pond.
 */
export function paintGround(board: BoardData, path: Point[], distance: (x: number, y: number) => number): GroundResult {
  const W = Math.ceil(board.world.width / PX), H = Math.ceil(board.world.height / PX);
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(W, H);
  const data = img.data;
  const noise = makeNoise(1337);
  const rand = mulberry32(42);
  const put = (i: number, c: RGB) => {
    data[i * 4] = c[0];
    data[i * 4 + 1] = c[1];
    data[i * 4 + 2] = c[2];
    data[i * 4 + 3] = 255;
  };

  const boundaries = board.biomes.slice(1).map((b) => b.x0);
  const biomeOfCell = (cx: number, cy: number): Biome => {
    const x = cx * PX;
    const wobble = Math.sin(cy * 0.05) * 30 + Math.sin(cy * 0.013 + 2) * 50;
    let index = 0;
    for (const bx of boundaries) {
      const jitter = (rand() - 0.5) * 36; // dithered edge
      if (x + jitter > bx + wobble) index++;
    }
    return board.biomes[Math.min(index, board.biomes.length - 1)].id;
  };

  // 1. Ground
  const biomeMap = new Uint8Array(W * H);
  const biomeIds = board.biomes.map((b) => b.id);
  for (let cy = 0; cy < H; cy++)
    for (let cx = 0; cx < W; cx++) {
      const biome = biomeOfCell(cx, cy);
      const g = GROUND[biome];
      biomeMap[cy * W + cx] = biomeIds.indexOf(biome);
      const n = noise(cx * 0.045, cy * 0.045) * 0.7 + noise(cx * 0.16, cy * 0.16) * 0.3;
      let c = n < 0.38 ? g.dark : n > 0.68 ? g.light : g.base;
      if (biome === 'desert') {
        // Dune ripples
        const ripple = Math.sin(cx * 0.09 + Math.sin(cy * 0.05) * 3 + cy * 0.02);
        if (ripple > 0.93) c = g.dark;
        else if (ripple < -0.97) c = g.light;
      }
      if (rand() < 0.012) c = g.speck;
      put(cy * W + cx, c);
    }

  // 2. River between forest and village (vertical, wobbly)
  const riverX = board.biomes[1]?.x0 ?? board.world.width / 3;
  const riverCell = Math.round(riverX / PX);
  const isRiver = (cx: number, cy: number) => Math.abs(cx - (riverCell + Math.sin(cy * 0.04) * 6 + Math.sin(cy * 0.11) * 2)) < 7;
  for (let cy = 0; cy < H; cy++)
    for (let cx = riverCell - 20; cx < riverCell + 20; cx++) {
      if (cx < 0 || cx >= W) continue;
      const centre = riverCell + Math.sin(cy * 0.04) * 6 + Math.sin(cy * 0.11) * 2;
      const d = Math.abs(cx - centre);
      if (d < 7) put(cy * W + cx, d > 5.5 ? WATER.light : (cy + Math.floor(cx * 0.5)) % 9 === 0 ? WATER.foam : WATER.deep);
      else if (d < 8) put(cy * W + cx, hex('#7a6a4a'));
    }

  // 3. Pond in the forest, placed away from the trail
  let pond: Point | null = null;
  const forest = board.biomes[0];
  for (let attempt = 0; attempt < 200 && !pond; attempt++) {
    const x = forest.x0 + 150 + rand() * (forest.x1 - forest.x0 - 400);
    const y = 150 + rand() * (board.world.height - 300);
    if (distance(x, y) > 220) pond = { x, y };
  }
  if (pond) {
    const pcx = pond.x / PX, pcy = pond.y / PX, rx = 26, ry = 14;
    for (let cy = Math.floor(pcy - ry - 2); cy < pcy + ry + 2; cy++)
      for (let cx = Math.floor(pcx - rx - 2); cx < pcx + rx + 2; cx++) {
        const d = ((cx - pcx) / rx) ** 2 + ((cy - pcy) / ry) ** 2 + noise(cx * 0.2, cy * 0.2) * 0.25;
        if (d < 1) put(cy * W + cx, d > 0.8 ? WATER.light : (cx + cy * 3) % 23 === 0 ? WATER.foam : WATER.deep);
        else if (d < 1.12) put(cy * W + cx, hex('#4f8a3a'));
      }
  }

  // 4. The trail: stamp discs along the smoothed path
  const trailRadius = 9;
  const stamped = new Uint8Array(W * H);
  let bridgeY = 0;
  for (let i = 0; i < path.length; i++) {
    const p = path[i], next = path[Math.min(path.length - 1, i + 1)];
    const steps = Math.max(1, Math.ceil(Math.hypot(next.x - p.x, next.y - p.y) / PX));
    for (let s = 0; s < steps; s++) {
      const x = (p.x + ((next.x - p.x) * s) / steps) / PX, y = (p.y + ((next.y - p.y) * s) / steps) / PX;
      for (let dy = -trailRadius - 1; dy <= trailRadius + 1; dy++)
        for (let dx = -trailRadius - 1; dx <= trailRadius + 1; dx++) {
          const cx = Math.round(x + dx), cy = Math.round(y + dy);
          if (cx < 0 || cy < 0 || cx >= W || cy >= H) continue;
          const d = Math.hypot(dx, dy);
          const k = cy * W + cx;
          if (d <= trailRadius) stamped[k] = 2;
          else if (d <= trailRadius + 1.4 && stamped[k] === 0) stamped[k] = 1;
        }
    }
  }
  for (let k = 0; k < W * H; k++) {
    if (!stamped[k]) continue;
    const cx = k % W, cy = Math.floor(k / W);
    const biome = biomeIds[biomeMap[k]];
    const t = TRAIL[biome];
    if (isRiver(cx, cy)) {
      bridgeY = cy * PX;
      put(k, stamped[k] === 1 ? PLANK.edge : cx % 3 === 0 ? PLANK.edge : cy % 2 ? PLANK.a : PLANK.b);
      continue;
    }
    if (stamped[k] === 1) put(k, t.edge);
    else if (biome === 'village' && (cx % 4 === 0 || (cy + (Math.floor(cx / 4) % 2) * 2) % 4 === 0)) put(k, t.edge); // cobbles
    else put(k, rand() < 0.08 ? t.speck : t.fill);
  }

  ctx.putImageData(img, 0, 0);
  return { canvas, pond, riverX, bridgeY };
}
