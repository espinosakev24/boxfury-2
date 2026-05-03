import { PLAYER } from './constants.js';

// One tile = one player rectangle. Two map characters stacked
// (`.` over `.`) describe the player's width and height.
export const TILE = {
  WIDTH: PLAYER.WIDTH,
  HEIGHT: PLAYER.HEIGHT,
  WALL_THICKNESS: 8,
};

export const TILES = {
  EMPTY: '.',
  WALL: '=',
  TEAM1_BASE: 'J',
  TEAM2_BASE: 'C',
  FLAG: 'F',
};

// 53 cols × 15 rows ≈ 1272×720 (matches WORLD with an 8px right gutter).

export const DEFAULT_MAP = [
  '.....................................................',
  '....J............................................C...',
  '...===.........................................===...',
  '.....................................................',
  '..........====.........................====..........',
  '.....................................................',
  '................====.............====................',
  '.....................................................',
  '.........====.........................====...........',
  '.....................................................',
  '....====.................................====........',
  '.....................................................',
  '..............====.............====..................',
  '..........................F..........................',
  '=====================================================',
].join('\n');

// export const DEFAULT_MAP = [
//   '.....................................................',
//   '..........J..........................................',
//   '.......======......................======............',
//   '.....................................................',
//   '..............=======...........=======..............',
//   '.....................................................',
//   '.....................................................',
//   '.........==============.......==============.........',
//   '.....................................................',
//   '====================.............====================',
//   '.....................................................',
//   '.....................................................',
//   '.................................................C...',
//   '..===.....................F.....................===..',
//   '=====================================================',
// ].join('\n');

export function parseMap(mapString = DEFAULT_MAP) {
  const rows = mapString.split('\n');
  const height = rows.length;
  const width = rows.reduce((m, r) => Math.max(m, r.length), 0);

  const walls = [];
  const bases = { team1: null, team2: null };
  let flag = null;

  for (let y = 0; y < height; y++) {
    const row = rows[y];
    let runStart = -1;
    for (let x = 0; x <= width; x++) {
      const ch = row[x];
      if (ch === TILES.WALL) {
        if (runStart === -1) runStart = x;
        continue;
      }
      if (runStart !== -1) {
        walls.push(makeWall(runStart, x - 1, y));
        runStart = -1;
      }
      if (ch === TILES.TEAM1_BASE) bases.team1 = tileCenter(x, y);
      else if (ch === TILES.TEAM2_BASE) bases.team2 = tileCenter(x, y);
      else if (ch === TILES.FLAG) flag = tileCenter(x, y);
    }
  }

  return {
    rows,
    width,
    height,
    pixelWidth: width * TILE.WIDTH,
    pixelHeight: height * TILE.HEIGHT,
    walls,
    bases,
    flag,
  };
}

function tileCenter(tx, ty) {
  return {
    x: tx * TILE.WIDTH + TILE.WIDTH / 2,
    y: ty * TILE.HEIGHT + TILE.HEIGHT / 2,
  };
}

function makeWall(startX, endX, ty) {
  const tiles = endX - startX + 1;
  const w = tiles * TILE.WIDTH;
  const h = TILE.HEIGHT;
  return {
    x: startX * TILE.WIDTH + w / 2,
    y: ty * TILE.HEIGHT + h / 2,
    w,
    h,
  };
}
