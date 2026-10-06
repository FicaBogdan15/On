// Renders sprite grids to canvases (used by Phaser via addCanvas and by React for icons),
// plus procedural pixel textures: board tiles, mountains and the finish castle.
import type { Biome, PawnColor, TileType } from '../../types/contracts';
import { ICONS, OUTLINE, pawnSprite, type SpriteDef } from './sprites';

export function createCanvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  return c;
}

/** Draw a sprite grid at the given integer scale. `outline` adds a 1px border around opaque pixels. */
export function renderSprite(def: SpriteDef, scale = 1, outline?: string): HTMLCanvasElement {
  const width = Math.max(...def.rows.map((r) => r.length));
  const height = def.rows.length;
  const pad = outline ? 1 : 0;
  const canvas = createCanvas((width + pad * 2) * scale, (height + pad * 2) * scale);
  const ctx = canvas.getContext('2d')!;

  const filled = (x: number, y: number) => {
    const ch = def.rows[y]?.[x];
    return !!ch && ch !== '.' && !!def.palette[ch];
  };

  if (outline) {
    ctx.fillStyle = outline;
    for (let y = -1; y <= height; y++)
      for (let x = -1; x <= width; x++) {
        if (filled(x, y)) continue;
        if (filled(x - 1, y) || filled(x + 1, y) || filled(x, y - 1) || filled(x, y + 1))
          ctx.fillRect((x + pad) * scale, (y + pad) * scale, scale, scale);
      }
  }

  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const ch = def.rows[y][x];
      const color = ch && ch !== '.' ? def.palette[ch] : undefined;
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect((x + pad) * scale, (y + pad) * scale, scale, scale);
    }
  return canvas;
}

// ---------------------------------------------------------------- cached data URLs for React

const urlCache = new Map<string, string>();

function cachedUrl(key: string, make: () => HTMLCanvasElement) {
  let url = urlCache.get(key);
  if (!url) {
    url = make().toDataURL();
    urlCache.set(key, url);
  }
  return url;
}

export const pawnDataUrl = (color: PawnColor) => cachedUrl(`pawn-${color}`, () => renderSprite(pawnSprite(color), 4));
export const iconDataUrl = (name: keyof typeof ICONS) => cachedUrl(`icon-${name}`, () => renderSprite(ICONS[name], 4, OUTLINE));

// ---------------------------------------------------------------- deterministic RNG

export function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------- board tiles

export const TILE_W = 26;
export const TILE_H = 19;

interface Material {
  top: string;
  light: string;
  dark: string;
  side: string;
  speck: string;
}

const MATERIALS: Record<Biome, Material> = {
  forest: { top: '#a7b39a', light: '#cbd5bd', dark: '#76826c', side: '#5d6656', speck: '#8b977f' },
  village: { top: '#c8a77a', light: '#e2c69c', dark: '#94744c', side: '#6e5436', speck: '#a8885c' },
  desert: { top: '#e2b979', light: '#f5d69e', dark: '#b88a4c', side: '#8e6634', speck: '#c99c5c' },
  snow: { top: '#bfe1f2', light: '#eaf8ff', dark: '#86b4cf', side: '#5f8aa6', speck: '#a4cfe6' },
};

export const TILE_COLORS: Record<TileType, string | null> = {
  start: '#3fbf5f',
  empty: null,
  mystery: '#9b59d0',
  shield: '#3a8de0',
  swap: '#f08a24',
  plusTwo: '#3fbf5f',
  minusOne: '#e04848',
  doubleMovement: '#e8b820',
  portal: '#d04ad0',
  finish: '#ffc820',
};

/** Circular board tile seen at a slight angle: an elliptical top face over a darker cylinder side. */
export function renderTile(biome: Biome, type: TileType, seed: number): HTMLCanvasElement {
  const m = MATERIALS[biome];
  const ring = TILE_COLORS[type];
  const canvas = createCanvas(TILE_W, TILE_H);
  const ctx = canvas.getContext('2d')!;
  const rand = mulberry32(seed * 7919 + biome.length);
  const cx = (TILE_W - 1) / 2, cy = 7, rx = 12.4, ry = 7.2, depth = 3;

  const inEllipse = (x: number, y: number, ox = 0, oy = 0, sx = 1) =>
    ((x - cx - ox) / (rx * sx)) ** 2 + ((y - cy - oy) / (ry * sx)) ** 2 <= 1;

  for (let y = 0; y < TILE_H; y++)
    for (let x = 0; x < TILE_W; x++) {
      const top = inEllipse(x, y);
      let side = false;
      for (let d = 1; d <= depth && !top; d++) if (inEllipse(x, y, 0, d)) side = true;
      if (!top && !side) {
        // Outline ring around the whole token.
        let near = false;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]])
          if (inEllipse(x + dx, y + dy) || [1, 2, 3].some((d) => inEllipse(x + dx, y + dy, 0, d))) near = true;
        if (near) {
          ctx.fillStyle = OUTLINE;
          ctx.fillRect(x, y, 1, 1);
        }
        continue;
      }
      let color: string;
      if (side) color = y % 2 === 0 ? m.side : shade(m.side, -12);
      else {
        const edge = !inEllipse(x, y, 0, 0, 0.86);
        const highlight = edge && y < cy && x < cx + 4;
        color = edge ? (highlight ? m.light : m.dark) : m.top;
        if (!edge && rand() < 0.12) color = m.speck;
        if (ring && inEllipse(x, y, 0, 0, 0.66)) {
          const innerEdge = !inEllipse(x, y, 0, 0, 0.56);
          color = innerEdge ? shade(ring, -40) : y < cy - 1 ? shade(ring, 25) : ring;
        }
      }
      ctx.fillStyle = color;
      ctx.fillRect(x, y, 1, 1);
    }
  return canvas;
}

export function shade(hex: string, amount: number) {
  const n = parseInt(hex.slice(1), 16);
  const clamp = (v: number) => Math.max(0, Math.min(255, v));
  const r = clamp((n >> 16) + amount), g = clamp(((n >> 8) & 255) + amount), b = clamp((n & 255) + amount);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

// ---------------------------------------------------------------- big procedural pieces

export function renderMountain(w: number, h: number, seed: number, snowy: boolean): HTMLCanvasElement {
  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext('2d')!;
  const rand = mulberry32(seed);
  const peak = Math.floor(w * (0.4 + rand() * 0.2));
  for (let y = 0; y < h; y++) {
    const t = y / h;
    const left = Math.round(peak - t * peak - Math.sin(y * 0.4) * 1.2);
    const right = Math.round(peak + t * (w - peak) + Math.cos(y * 0.33) * 1.2);
    for (let x = Math.max(0, left); x < Math.min(w, right); x++) {
      const lit = x < peak - (y * 0.15);
      const capLine = h * (0.28 + Math.sin(x * 0.7) * 0.04);
      let color = lit ? (snowy ? '#8fa6c4' : '#c4986a') : (snowy ? '#62789a' : '#9c704a');
      if (snowy && y < capLine) color = lit ? '#ffffff' : '#d6e6f5';
      if (x === left || x === right - 1) color = '#2a3048';
      ctx.fillStyle = color;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  return canvas;
}

/** Small castle that marks the finish line. */
export function renderCastle(): HTMLCanvasElement {
  const w = 46, h = 40;
  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext('2d')!;
  const px = (x: number, y: number, ww: number, hh: number, c: string) => {
    ctx.fillStyle = c;
    ctx.fillRect(x, y, ww, hh);
  };
  const stone = '#c9d3e0', stoneDark = '#8d9ab0', outline = '#262a3a', roof = '#4a5ad0', roofDark = '#2e3a9a';

  const tower = (x: number, top: number, tw: number) => {
    px(x - 1, top - 1, tw + 2, h - top + 1, outline);
    px(x, top, tw, h - top, stone);
    px(x + tw - 2, top, 2, h - top, stoneDark);
    for (let i = 0; i < tw; i += 2) px(x + i, top - 3, 1, 3, stone);
    px(x - 1, top - 9, tw + 2, 1, outline);
    // Pointed roof
    for (let r = 0; r < 8; r++) {
      const inset = Math.floor((8 - r) * (tw / 16));
      px(x + inset - 1, top - 9 - (7 - r) * 1, tw - inset * 2 + 2, 1, outline);
      px(x + inset, top - 9 - (7 - r) * 1, Math.max(1, tw - inset * 2), 1, r < 4 ? roof : roofDark);
    }
    px(x + Math.floor(tw / 2) - 1, top + 5, 2, 3, '#2a2040');
  };

  // Wall
  px(5, 17, 36, 23, outline);
  px(6, 18, 34, 22, stone);
  for (let x = 6; x < 40; x += 3) px(x, 15, 2, 3, stone);
  for (let y = 20; y < 40; y += 4) for (let x = 7 + ((y / 4) % 2) * 2; x < 39; x += 5) px(x, y, 3, 1, stoneDark);
  // Gate
  px(18, 26, 10, 14, outline);
  px(19, 27, 8, 13, '#5a3a22');
  px(19, 27, 8, 1, '#3a2414');
  for (let x = 20; x < 27; x += 2) px(x, 28, 1, 12, '#3a2414');
  tower(1, 12, 8);
  tower(37, 12, 8);
  tower(19, 6, 8);
  // Flags
  px(22, 0, 1, 6, outline);
  px(23, 0, 5, 3, '#e53935');
  return canvas;
}

export function makeCircle(radius: number, color: string, alpha = 1) {
  const c = createCanvas(radius * 2, radius * 2);
  const ctx = c.getContext('2d')!;
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  for (let y = 0; y < radius * 2; y++)
    for (let x = 0; x < radius * 2; x++)
      if ((x - radius + 0.5) ** 2 + (y - radius + 0.5) ** 2 <= radius * radius) ctx.fillRect(x, y, 1, 1);
  return c;
}

export function makeRing(radius: number, thickness: number, color: string) {
  const c = createCanvas(radius * 2, radius * 2);
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = color;
  for (let y = 0; y < radius * 2; y++)
    for (let x = 0; x < radius * 2; x++) {
      const d = Math.hypot(x - radius + 0.5, y - radius + 0.5);
      if (d <= radius && d >= radius - thickness) ctx.fillRect(x, y, 1, 1);
    }
  return c;
}
