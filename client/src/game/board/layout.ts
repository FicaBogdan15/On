import type { Biome, BoardData } from '../../types/contracts';

export interface Point {
  x: number;
  y: number;
}

/** World pixels per art pixel. Every sprite and the ground are drawn at this scale. */
export const PX = 3;

/** Catmull-Rom spline through the tile centres so the drawn trail curves naturally. */
export function smoothPath(points: Point[], samplesPerSegment = 24): Point[] {
  const out: Point[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)], p1 = points[i], p2 = points[i + 1], p3 = points[Math.min(points.length - 1, i + 2)];
    for (let s = 0; s < samplesPerSegment; s++) {
      const t = s / samplesPerSegment, t2 = t * t, t3 = t2 * t;
      out.push({
        x: 0.5 * (2 * p1.x + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
        y: 0.5 * (2 * p1.y + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
      });
    }
  }
  out.push(points[points.length - 1]);
  return out;
}

/** Spatial hash over path samples for fast "how far is this from the trail" queries. */
export class PathIndex {
  private cells = new Map<string, Point[]>();
  private readonly cell = 120;

  constructor(readonly samples: Point[]) {
    for (const p of samples) {
      const k = this.key(p.x, p.y);
      if (!this.cells.has(k)) this.cells.set(k, []);
      this.cells.get(k)!.push(p);
    }
  }

  private key(x: number, y: number) {
    return `${Math.floor(x / this.cell)},${Math.floor(y / this.cell)}`;
  }

  /** Distance to the nearest path sample (capped at ~2 cells for far-away points). */
  distance(x: number, y: number): number {
    const cx = Math.floor(x / this.cell), cy = Math.floor(y / this.cell);
    let best = Number.POSITIVE_INFINITY;
    for (let dx = -2; dx <= 2; dx++)
      for (let dy = -2; dy <= 2; dy++) {
        const list = this.cells.get(`${cx + dx},${cy + dy}`);
        if (!list) continue;
        for (const p of list) best = Math.min(best, (p.x - x) ** 2 + (p.y - y) ** 2);
      }
    return Math.sqrt(best);
  }
}

export function biomeAt(board: BoardData, x: number): Biome {
  for (const b of board.biomes) if (x >= b.x0 && x < b.x1) return b.id;
  return x < board.biomes[0].x0 ? board.biomes[0].id : board.biomes[board.biomes.length - 1].id;
}

export function biomeRect(board: BoardData, biome: Biome) {
  const b = board.biomes.find((r) => r.id === biome)!;
  return { x: b.x0, y: 0, width: b.x1 - b.x0, height: board.world.height };
}

/** Offsets so several pawns on the same tile stand side by side instead of overlapping. */
export function clusterOffset(index: number, count: number): Point {
  if (count <= 1) return { x: 0, y: 0 };
  const layouts: Point[][] = [
    [],
    [{ x: 0, y: 0 }],
    [{ x: -14, y: 0 }, { x: 14, y: 0 }],
    [{ x: -18, y: 4 }, { x: 18, y: 4 }, { x: 0, y: -8 }],
    [{ x: -18, y: -6 }, { x: 18, y: -6 }, { x: -18, y: 8 }, { x: 18, y: 8 }],
  ];
  if (count < layouts.length) return layouts[count][index];
  const angle = (index / count) * Math.PI * 2;
  return { x: Math.cos(angle) * 24, y: Math.sin(angle) * 12 };
}
