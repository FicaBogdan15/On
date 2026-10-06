// Generates server/GameServer/GameData/board.json: 53 evenly spaced tiles along a winding curve.
// Edit SPECIALS to rearrange tile effects, or edit board.json by hand afterwards.
import fs from 'node:fs';
import path from 'node:path';

const W = 5000, H = 1500, TILE_COUNT = 53;
const curve = (t) => ({
  x: 180 + t * (W - 480),
  y: H / 2 + 20 + 400 * Math.sin(2 * Math.PI * 3.25 * t - 0.6) + 70 * Math.sin(2 * Math.PI * 8 * t + 1),
});

// Dense sampling, then equal arc-length spacing so every hop looks the same distance.
const samples = [];
for (let i = 0; i <= 20000; i++) samples.push(curve(i / 20000));
const cum = [0];
for (let i = 1; i < samples.length; i++) cum.push(cum[i - 1] + Math.hypot(samples[i].x - samples[i - 1].x, samples[i].y - samples[i - 1].y));
const total = cum.at(-1), spacing = total / (TILE_COUNT - 1);

const points = [];
let j = 0;
for (let k = 0; k < TILE_COUNT; k++) {
  const target = k * spacing;
  while (j < cum.length - 1 && cum[j + 1] < target) j++;
  const s = samples[Math.min(j + 1, samples.length - 1)];
  points.push({ x: Math.round(s.x), y: Math.round(s.y) });
}

const SPECIALS = {
  3: 'plusTwo', 6: 'mystery', 9: 'minusOne', 11: 'shield',
  15: 'swap', 17: 'plusTwo', 19: 'mystery', 21: 'doubleMovement', 23: 'minusOne', 25: 'portal',
  28: 'shield', 30: 'mystery', 32: 'minusOne', 34: 'plusTwo', 36: 'swap', 38: 'minusOne',
  41: 'doubleMovement', 43: 'mystery', 44: 'portal', 46: 'minusOne', 48: 'shield', 50: 'minusOne',
};
const biomeOf = (i) => (i <= 13 ? 'forest' : i <= 26 ? 'village' : i <= 39 ? 'desert' : 'snow');

const tiles = points.map((p, index) => ({
  index,
  type: index === 0 ? 'start' : index === TILE_COUNT - 1 ? 'finish' : SPECIALS[index] ?? 'empty',
  biome: biomeOf(index),
  x: p.x,
  y: p.y,
}));

const mid = (a, b) => Math.round((tiles[a].x + tiles[b].x) / 2);
const biomes = [
  { id: 'forest', x0: 0, x1: mid(13, 14) },
  { id: 'village', x0: mid(13, 14), x1: mid(26, 27) },
  { id: 'desert', x0: mid(26, 27), x1: mid(39, 40) },
  { id: 'snow', x0: mid(39, 40), x1: W },
];

const board = { world: { width: W, height: H }, biomes, tiles };
const target = path.resolve(import.meta.dirname, '../server/GameServer/GameData/board.json');
fs.writeFileSync(target, JSON.stringify(board, null, 2));
const empty = tiles.filter((t) => t.type === 'empty').length;
console.log(`tiles=${tiles.length} spacing=${spacing.toFixed(1)} empty=${empty} (${Math.round((empty / 51) * 100)}% of inner tiles)`);
console.log(biomes.map((b) => `${b.id}:${b.x0}-${b.x1}`).join(' '));
