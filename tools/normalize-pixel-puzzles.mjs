// Pads every pixel puzzle in GameData/pixel-puzzles.json to a centered 16x16 grid in place.
// Lets you draw art with ragged rows; run `node tools/normalize-pixel-puzzles.mjs` afterwards.
import fs from 'node:fs';
import path from 'node:path';

const SIZE = 16;
const file = path.resolve(import.meta.dirname, '../server/GameServer/GameData/pixel-puzzles.json');
const puzzles = JSON.parse(fs.readFileSync(file, 'utf8'));

for (const p of puzzles) {
  let rows = p.rows.map((r) => r.replace(/\s+$/, ''));
  while (rows.length && /^\.*$/.test(rows.at(-1))) rows.pop();
  while (rows.length && /^\.*$/.test(rows[0])) rows.shift();
  if (rows.length > SIZE) throw new Error(`${p.id}: too many rows (${rows.length})`);

  const width = Math.max(...rows.map((r) => r.length));
  rows = rows.map((r) => r.padEnd(width, '.'));

  // Trim shared empty columns, then centre.
  let left = 0, right = width;
  while (left < right && rows.every((r) => r[left] === '.')) left++;
  while (right > left && rows.every((r) => r[right - 1] === '.')) right--;
  rows = rows.map((r) => r.slice(left, right));
  if (right - left > SIZE) throw new Error(`${p.id}: drawing too wide (${right - left})`);
  const w = right - left, padL = Math.floor((SIZE - w) / 2), padT = Math.floor((SIZE - rows.length) / 2);
  rows = rows.map((r) => '.'.repeat(padL) + r + '.'.repeat(SIZE - w - padL));
  const blank = '.'.repeat(SIZE);
  p.rows = [...Array(padT).fill(blank), ...rows, ...Array(SIZE - rows.length - padT).fill(blank)];

  const used = new Set(p.rows.join('').replace(/\./g, ''));
  for (const c of used) if (!p.palette[c]) throw new Error(`${p.id}: palette missing '${c}'`);
}

const out = '[\n' + puzzles.map((p) => {
  const { rows, ...rest } = p;
  const head = JSON.stringify(rest).slice(0, -1);
  return `  ${head},\n    "rows": [\n${rows.map((r) => `      "${r}"`).join(',\n')}\n    ]}`;
}).join(',\n') + '\n]\n';
fs.writeFileSync(file, out);
console.log(`normalized ${puzzles.length} pixel puzzles`);
