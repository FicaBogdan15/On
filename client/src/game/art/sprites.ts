// Original pixel-art sprites defined as character grids. '.' is transparent; every other character
// is looked up in the sprite's palette. Rendered to canvases at boot (see textures.ts).
import type { PawnColor } from '../../types/contracts';

export interface SpriteDef {
  rows: string[];
  palette: Record<string, string>;
}

export const OUTLINE = '#1a1426';

// ---------------------------------------------------------------- pawn

/** Classic board-game pawn. h = highlight, l = light, m = mid, d = dark, o = outline. */
export const PAWN_ROWS = [
  '.....oooo.....',
  '....ohhmmo....',
  '...ohhlmmdo...',
  '...ohlmmmdo...',
  '...olmmmmdo...',
  '...olmmmmdo...',
  '....olmmdo....',
  '.....oddo.....',
  '...oooooooo...',
  '...ohlmmmdo...',
  '....oooooo....',
  '.....olmdo....',
  '.....olmdo....',
  '....olmmmdo...',
  '....olmmmdo...',
  '...olmmmmmdo..',
  '...olmmmmmdo..',
  '..olmmmmmmmdo.',
  '.oohllmmmmmddo',
  '.olllmmmmmmddo',
  '.odddddddddddo',
  '..oooooooooo..',
];

export const PAWN_SHADES: Record<PawnColor, { h: string; l: string; m: string; d: string; css: string; label: string }> = {
  red: { h: '#ffd0c8', l: '#ff7a68', m: '#e03a3a', d: '#9c1f2a', css: '#e03a3a', label: 'Red' },
  blue: { h: '#d0e8ff', l: '#62b0ff', m: '#2f6fe0', d: '#1d3f8f', css: '#2f6fe0', label: 'Blue' },
  green: { h: '#dcffc8', l: '#79dc62', m: '#3a9e3a', d: '#1f6b2a', css: '#3a9e3a', label: 'Green' },
  yellow: { h: '#fffbd0', l: '#ffe85c', m: '#f2c21b', d: '#b3870d', css: '#f2c21b', label: 'Yellow' },
  purple: { h: '#f0dcff', l: '#c08aff', m: '#8a4fe0', d: '#5a2a9e', css: '#8a4fe0', label: 'Purple' },
  orange: { h: '#ffe6c8', l: '#ffad5c', m: '#f07f1b', d: '#a8520d', css: '#f07f1b', label: 'Orange' },
  cyan: { h: '#d8fdff', l: '#6aeaf2', m: '#1bb8c9', d: '#0d7a87', css: '#1bb8c9', label: 'Cyan' },
  pink: { h: '#ffe0f0', l: '#ff98d2', m: '#f052a8', d: '#a82a6e', css: '#f052a8', label: 'Pink' },
};

export function pawnSprite(color: PawnColor): SpriteDef {
  const s = PAWN_SHADES[color];
  return { rows: PAWN_ROWS, palette: { o: OUTLINE, h: s.h, l: s.l, m: s.m, d: s.d } };
}

// ---------------------------------------------------------------- icons (auto-outlined)

export const ICONS: Record<string, SpriteDef> = {
  mystery: {
    rows: ['.xxxx.', 'xx..xx', '....xx', '...xx.', '..xx..', '......', '..xx..'],
    palette: { x: '#ffffff' },
  },
  shield: {
    rows: ['xxxxxxx', 'xhhyyyx', 'xhyyyyx', 'xhyyyyx', '.xyyyx.', '..xyx..', '...x...'],
    palette: { x: '#e8f4ff', y: '#4a9cff', h: '#bfe0ff' },
  },
  swap: {
    rows: ['..x....', '.xxxxxx', '..x....', '.......', '....x..', 'xxxxxx.', '....x..'],
    palette: { x: '#ffffff' },
  },
  plusTwo: {
    rows: ['.......xxx.', '.x....x...x', 'xxx......x.', '.x.....x...', '......xxxxx'],
    palette: { x: '#ffffff' },
  },
  minusOne: {
    rows: ['.......x.', '......xx.', 'xxx....x.', '.......x.', '......xxx'],
    palette: { x: '#ffffff' },
  },
  doubleMovement: {
    rows: ['x...x..xxx.', '.x.x..x...x', '..x.....xx.', '.x.x..xx...', 'x...x.xxxxx'],
    palette: { x: '#ffffff' },
  },
  portal: {
    rows: ['..xxx..', '.x...x.', 'x..x..x', 'x.x.x.x', 'x..xx.x', '.x....x', '..xxxx.'],
    palette: { x: '#ffffff' },
  },
  start: {
    rows: ['xff....', 'xffffff', 'xffffff', 'xfff...', 'x......', 'x......', 'x......'],
    palette: { x: '#ffffff', f: '#ffffff' },
  },
  finish: {
    rows: ['y.yyyyy.y', 'y.yyyyy.y', '.yyyyyyy.', '..yyyyy..', '...yyy...', '....y....', '...yyy...', '..yyyyy..'],
    palette: { y: '#ffd23f' },
  },
  crown: {
    rows: ['x..x..x', 'xx.x.xx', 'xxxxxxx', 'xrxxxrx', 'xxxxxxx'],
    palette: { x: '#ffd23f', r: '#e53935' },
  },
};

// ---------------------------------------------------------------- forest

const FOREST = { o: '#1f2a1a', g: '#8fd16a', G: '#4fa043', D: '#2f6b33', b: '#8a5a32', B: '#5e3a1f' };

export const TREE_ROUND: SpriteDef = {
  palette: FOREST,
  rows: [
    '......oooooo......',
    '....ooggggggoo....',
    '...oggggggGGGGo...',
    '..oggggGGGGGGGDo..',
    '.ogggggGGGGGGGDDo.',
    '.oggggGGGGGGGGDDo.',
    'ogggGGGGGGGGGDDDDo',
    'oggGGGGgGGGGGGDDDo',
    'ogGGGGggGGGGGDDDDo',
    'oGGGGGGGGGGGDDDDDo',
    'oGGGGGGGGGGDDDDDDo',
    '.oGGGGGGGGDDDDDDo.',
    '.oDGGGGGDDDDDDDDo.',
    '..oDDDDDDDDDDDDo..',
    '...ooDDDDDDDDoo...',
    '.....oooobBoo.....',
    '.......obBBo......',
    '.......obBBo......',
    '.......obBBo......',
    '......obbBBBo.....',
    '......oooooo......',
  ],
};

export const TREE_TALL: SpriteDef = {
  palette: FOREST,
  rows: [
    '.....oooo.....',
    '....oggGGo....',
    '...ogggGGDo...',
    '...oggGGGDo...',
    '..ogggGGGDDo..',
    '..oggGGGGDDo..',
    '.ogggGGGGDDDo.',
    '.oggGGGGGGDDo.',
    '.ogGGGgGGGDDo.',
    'ogggGGGGGGDDDo',
    'oggGGGGGGGDDDo',
    'oGGGGGGGGDDDDo',
    '.oGGGGGGDDDDo.',
    '..ooDDDDDDoo..',
    '....oobBoo....',
    '.....obBo.....',
    '.....obBo.....',
    '.....obBo.....',
    '....obbBBo....',
    '....oooooo....',
  ],
};

export const PINE_ROWS = [
  '.....oo.....',
  '....owPo....',
  '....owPo....',
  '...owwPPo...',
  '...owpPPo...',
  '..owwppPPo..',
  '..oppppPPo..',
  '...oopPoo...',
  '..owwppPPo..',
  '.owwpppPPPo.',
  '.opppppPPPo.',
  '..ooppPPoo..',
  '.owwppppPPo.',
  'owwpppppPPPo',
  'oppppppPPPPo',
  '.oooopPoooo.',
  '.....bB.....',
  '.....bB.....',
  '....obBo....',
  '....oooo....',
];

export const PINE: SpriteDef = { rows: PINE_ROWS, palette: { o: '#14261a', w: '#5cae58', p: '#2f7d3d', P: '#1d5a2c', b: '#7a4a28', B: '#4e2e18' } };
export const PINE_SNOW: SpriteDef = { rows: PINE_ROWS, palette: { o: '#1b2a3a', w: '#ffffff', p: '#2b6b54', P: '#1c4a3c', b: '#6b4a32', B: '#45301f' } };

export const BUSH: SpriteDef = {
  palette: FOREST,
  rows: ['...oooo.....', '..oggGGooo..', '.oggGGGGgGo.', 'ogggGGGGGGDo', 'oGGGGGGGDDDo', '.oDDDDDDDDo.', '..oooooooo..'],
};

export const BERRY_BUSH: SpriteDef = {
  palette: { ...FOREST, r: '#e8344e' },
  rows: ['...oooo.....', '..oggGrooo..', '.ogrGGGGgGo.', 'ogggGGrGGGDo', 'oGrGGGGGDrDo', '.oDDDrDDDDo.', '..oooooooo..'],
};

export const rock = (light: string, mid: string, dark: string, snow?: string): SpriteDef => ({
  palette: { o: '#1d1b26', r: light, R: mid, k: dark, s: snow ?? light },
  rows: snow
    ? ['...oooo...', '..ossssoo.', '.osssRssoo', 'orRRRRRRko', 'oRRRRRkkko', '.oooooooo.']
    : ['...oooo...', '..orrRRo..', '.orrRRRRoo', 'orRRRRRRko', 'oRRRRRkkko', '.oooooooo.'],
});

export const flower = (petal: string): SpriteDef => ({
  palette: { f: petal, y: '#ffe066', g: '#3f8f3a' },
  rows: ['.f.', 'fyf', '.f.', '.g.'],
});

export const MUSHROOM: SpriteDef = {
  palette: { r: '#e53935', w: '#ffffff', s: '#f3e3c3', o: '#2a1a1a' },
  rows: ['.ooo.', 'orwro', 'orrwo', '.sso.', '.sso.'],
};

export const GRASS: SpriteDef = {
  palette: { g: '#7cc95a', G: '#4f9a3e' },
  rows: ['g..g.g', 'gG.gGg', '.GGGG.'],
};

export const BUTTERFLY = [
  { rows: ['w.k.w', 'wwkww', '.wkw.', 'w.k.w'], palette: { w: '#ffffff', k: '#2a1a2a' } },
  { rows: ['..k..', '.wkw.', '.wkw.', '..k..'], palette: { w: '#ffffff', k: '#2a1a2a' } },
];

export const LILYPAD: SpriteDef = { palette: { g: '#5fb04a', G: '#3d7f34', p: '#ffb3d1' }, rows: ['.gggg.', 'gggGgg', 'gGgg.g', '.gggg.'] };

// ---------------------------------------------------------------- sky

export const CLOUD: SpriteDef = {
  palette: { w: '#ffffff', c: '#dfe8f5' },
  rows: [
    '......wwww..........',
    '....wwwwwwww..ww....',
    '..wwwwwwwwwwwwwwww..',
    '.wwwwwwwwwwwwwwwwwww',
    'wwwwwwwwwwwwwwwwwwww',
    'cwwwwwwwwwwwwwwwwwwc',
    '.cccwwwwwwwwwwwwccc.',
    '....cccccccccccc....',
  ],
};

export const CLOUD_SMALL: SpriteDef = {
  palette: { w: '#ffffff', c: '#dfe8f5' },
  rows: ['...wwww.....', '.wwwwwwwww..', 'wwwwwwwwwwww', 'cwwwwwwwwwwc', '.cccccccccc.'],
};

// ---------------------------------------------------------------- village

export const house = (roof: string, roofDark: string, wall: string): SpriteDef => ({
  palette: { o: '#2a1a14', r: roof, R: roofDark, w: wall, W: '#c9b48e', b: '#7a4a28', d: '#5a3420', c: '#ffe08a', k: '#8a8a94' },
  rows: [
    '................kk....',
    '................kk....',
    '..........oo...okko...',
    '.........orro..okko...',
    '........orrRRo.okko...',
    '.......orrrRRRookko...',
    '......orrrrRRRRoko....',
    '.....orrrrrRRRRRo.....',
    '....orrrrrrRRRRRRo....',
    '...orrrrrrrRRRRRRRo...',
    '..orrrrrrrrRRRRRRRRo..',
    '.oooooooooooooooooooo.',
    '..owwwwwwwwwwwwwwWWo..',
    '..owccwwwwwwwwwccWWo..',
    '..owccwwwwbbwwwccWWo..',
    '..owwwwwwbddbwwwwWWo..',
    '..owwwwwwbddbwwwwWWo..',
    '..owwwwwwbddbwwwwWWo..',
    '..owwwwwwbddbwwwwWWo..',
    '..oooooooooooooooooo..',
  ],
});

/** Chimney top position inside the house sprite, in sprite pixels. */
export const HOUSE_CHIMNEY = { x: 17, y: 0 };

export const FENCE: SpriteDef = {
  palette: { b: '#9a6a3a', B: '#5e3a1f' },
  rows: ['B..B..B.', 'b..b..b.', 'bbbbbbbb', 'b..b..b.', 'bbbbbbbb', 'b..b..b.'],
};

export const LAMP: SpriteDef = {
  palette: { o: '#22202a', y: '#ffe08a', k: '#3a3640' },
  rows: ['.ooo.', 'oyyyo', 'oyyyo', '.ooo.', '..k..', '..k..', '..k..', '..k..', '..k..', '..k..', '..k..', '..k..', '.kkk.', 'kkkkk'],
};

export const BARREL: SpriteDef = {
  palette: { o: '#2a1a14', b: '#a8743e', B: '#6e4522', k: '#4a4a52' },
  rows: ['.ooooo.', 'obbbbBo', 'okkkkko', 'obbbbBo', 'obbbbBo', 'okkkkko', 'obbbbBo', '.ooooo.'],
};

export const CRATE: SpriteDef = {
  palette: { o: '#2a1a14', b: '#c08a4e', B: '#7a5028' },
  rows: ['ooooooo', 'oBbbbBo', 'obBbBbo', 'obbBbbo', 'obBbBbo', 'oBbbbBo', 'ooooooo'],
};

export const banner = (cloth: string, dark: string): SpriteDef[] => [
  {
    palette: { k: '#3a3640', f: cloth, F: dark },
    rows: ['k.......', 'kffffff.', 'kfffffff', 'kffFFff.', 'kfffffff', 'kffffff.', 'k.......', 'k.......', 'k.......', 'k.......', 'k.......', 'kk......'],
  },
  {
    palette: { k: '#3a3640', f: cloth, F: dark },
    rows: ['k.......', 'kfffff..', 'kffffff.', 'kfFFfff.', 'kffffff.', 'kfffff..', 'k.......', 'k.......', 'k.......', 'k.......', 'k.......', 'kk......'],
  },
];

export const WELL: SpriteDef = {
  palette: { o: '#22202a', s: '#9a9aa6', S: '#6a6a78', b: '#7a4a28', r: '#b03a2e', c: '#3a78c8' },
  rows: [
    '...rrrrrr...',
    '..rrrrrrrr..',
    '..b......b..',
    '..b......b..',
    '.ossssssSSo.',
    'osccccccccSo',
    'osssssssSSSo',
    'oSsSsSsSsSSo',
    '.oooooooooo.',
  ],
};

// ---------------------------------------------------------------- desert

const SAND = { o: '#3a2a1a', c: '#5aa04a', C: '#3a7a3a', p: '#ff7aa8' };

export const CACTUS: SpriteDef = {
  palette: SAND,
  rows: [
    '....oo....',
    '...occo...',
    '...ocCo...',
    '.o.ocCo...',
    'ococcCo.o.',
    'ococcCooco',
    'occccCocCo',
    '.oocccccCo',
    '...occCoo.',
    '...occCo..',
    '...occCo..',
    '...occCo..',
    '..oooooo..',
  ],
};

export const CACTUS_ROUND: SpriteDef = {
  palette: SAND,
  rows: ['..pp..', '.occo.', 'occCco', 'ocCCco', 'occCco', '.oooo.'],
};

export const BONES: SpriteDef = { palette: { w: '#f4efe2', k: '#3a2a1a' }, rows: ['.www.', 'wkwkw', 'wwwww', '.w.w.', '.....', 'w...w', 'wwwww', 'w...w'] };

export const PILLAR: SpriteDef = {
  palette: { o: '#4a3020', s: '#e8c890', S: '#b8905a' },
  rows: ['.oooo.', 'osssSo', 'oooooo', '.osSo.', '.osSo.', '.osSo.', '.osSo.', '.osSo.', '.osSo.', '.osSo.', '.osSo.', 'oooooo', 'osssSo', 'oooooo'],
};

export const PILLAR_BROKEN: SpriteDef = {
  palette: { o: '#4a3020', s: '#e8c890', S: '#b8905a' },
  rows: ['.oo...', '.osoo.', '.osSo.', '.osSo.', '.osSo.', 'oooooo', 'osssSo', 'oooooo'],
};

export const tent = (stripe: string): SpriteDef => ({
  palette: { o: '#3a2a1a', f: stripe, w: '#f6ecd8', k: '#5a3a22' },
  rows: [
    '.......k........',
    '......ofo.......',
    '.....offfo......',
    '....offwffo.....',
    '...offwwwffo....',
    '..offwwwwwffo...',
    '.offwwwwwwwffo..',
    'offfwwwkwwwfffo.',
    'offwwwkkkwwwffo.',
    'ooooookkkoooooo.',
  ],
});

export const TUMBLEWEED: SpriteDef = {
  palette: { b: '#a8804a', B: '#7a5a30' },
  rows: ['..bbb..', '.b.B.b.', 'bBb.bBb', 'b.bBb.b', 'bBb.bBb', '.b.B.b.', '..bbb..'],
};

// ---------------------------------------------------------------- snow

export const ICE_CRYSTAL: SpriteDef = {
  palette: { w: '#ffffff', c: '#9ee8ff', C: '#5ab8e8' },
  rows: ['..w..', '.wcw.', 'wcccw', '.cCc.', 'wcccw', '.wcw.', '..w..'],
};

export const SNOWMAN: SpriteDef = {
  palette: { o: '#2a3040', w: '#ffffff', s: '#cfe0f0', k: '#222', n: '#ff8a2a', r: '#d0343a' },
  rows: [
    '...ooo...',
    '..owwwo..',
    '..okwko..',
    '..owwnno.',
    '.orrrrro.',
    '.owwkwso.',
    'owwwwwwso',
    'owwwkwwso',
    'owwwwwsso',
    '.ooooooo.',
  ],
};

// ---------------------------------------------------------------- particles

export const SPARKLE: SpriteDef = { palette: { w: '#ffffff', y: '#fff3a0' }, rows: ['.y.', 'ywy', '.y.'] };
export const LEAF: SpriteDef = { palette: { g: '#9ad65a', G: '#5f9e3a' }, rows: ['gg.', '.gG'] };
export const DOT: SpriteDef = { palette: { w: '#ffffff' }, rows: ['w'] };
export const DOT2: SpriteDef = { palette: { w: '#ffffff' }, rows: ['ww', 'ww'] };
export const SMOKE: SpriteDef = { palette: { w: '#ffffff' }, rows: ['.ww.', 'wwww', 'wwww', '.ww.'] };
