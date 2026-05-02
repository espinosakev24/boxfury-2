export const MAPS = {
  default: {
    id: 'default',
    name: 'DEFAULT',
    tileSize: 32,
    width: 40,
    height: 22,
    tiles: [
      '........................................', //  0
      '........................................', //  1
      '........................................', //  2
      '........................................', //  3
      '........................................', //  4
      '====................................====', //  5
      '........................................', //  6
      '........================================', //  7
      '........................................', //  8
      '........................................', //  9
      '............=======F========............', // 10
      '........................................', // 11
      '........................................', // 12
      '........================================', // 13
      '........................................', // 14
      '====................................====', // 15
      '........................................', // 16
      '........................................', // 17
      '..J.J............................C.C...', // 18
      '########################################', // 19
      '##############^^^^^^^^^^^^##############', // 20
      '########################################', // 21
    ],
  },
};

export const DEFAULT_MAP_ID = 'default';

export function parseMap(map) {
  const { tileSize, width, height, tiles } = map;
  const grid = tiles.map((row) => row.split(''));

  const spawns = { jade: [], crimson: [] };
  const hazards = [];
  let flagBase = null;

  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      const ch = grid[row][col];
      switch (ch) {
        case 'J':
          spawns.jade.push({
            tileX: col,
            tileY: row,
            x: col * tileSize + tileSize / 2,
            y: (row + 1) * tileSize,
          });
          break;
        case 'C':
          spawns.crimson.push({
            tileX: col,
            tileY: row,
            x: col * tileSize + tileSize / 2,
            y: (row + 1) * tileSize,
          });
          break;
        case 'F':
          flagBase = {
            tileX: col,
            tileY: row,
            x: col * tileSize + tileSize / 2,
            y: row * tileSize + tileSize / 2,
          };
          break;
        case '^':
          hazards.push({
            x: col * tileSize,
            y: row * tileSize,
            w: tileSize,
            h: tileSize,
          });
          break;
      }
    }
  }

  return {
    tileSize,
    width,
    height,
    spawns,
    flagBase,
    hazards,
    solidRects: mergeRects(grid, '#', tileSize),
    oneWayRects: mergeRects(grid, '=', tileSize),
  };
}

function mergeRects(grid, glyph, tileSize) {
  const rows = grid.length;
  const cols = grid[0].length;
  const visited = Array.from({ length: rows }, () => new Uint8Array(cols));
  const rects = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (visited[r][c] || grid[r][c] !== glyph) continue;

      let endC = c;
      while (endC + 1 < cols && grid[r][endC + 1] === glyph && !visited[r][endC + 1]) endC++;

      let endR = r;
      grow: while (endR + 1 < rows) {
        for (let cc = c; cc <= endC; cc++) {
          if (grid[endR + 1][cc] !== glyph || visited[endR + 1][cc]) break grow;
        }
        endR++;
      }

      for (let rr = r; rr <= endR; rr++) {
        for (let cc = c; cc <= endC; cc++) visited[rr][cc] = 1;
      }

      rects.push({
        x: c * tileSize,
        y: r * tileSize,
        w: (endC - c + 1) * tileSize,
        h: (endR - r + 1) * tileSize,
      });
    }
  }

  return rects;
}
