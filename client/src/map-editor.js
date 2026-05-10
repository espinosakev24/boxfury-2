import { TILES } from '@boxfury/shared';

const CELL = 18;
const PALETTE = [
  { ch: TILES.EMPTY,      label: '·', name: 'Empty',     color: 0x15151f, fill: '#15151f' },
  { ch: TILES.WALL,       label: '=', name: 'Platform',  color: 0xf5f5f0, fill: '#f5f5f0' },
  { ch: TILES.SOLID,      label: '#', name: 'Solid',     color: 0xf5f5f0, fill: '#f5f5f0', filled: true },
  { ch: TILES.TEAM1_BASE, label: 'J', name: 'Jade base', color: 0x4ee08a, fill: '#4ee08a' },
  { ch: TILES.TEAM2_BASE, label: 'C', name: 'Crimson',   color: 0xff5470, fill: '#ff5470' },
  { ch: TILES.FLAG,       label: 'F', name: 'Flag',      color: 0xffd84e, fill: '#ffd84e' },
];

const UNIQUE_TILES = new Set([TILES.TEAM1_BASE, TILES.TEAM2_BASE, TILES.FLAG]);
const STORAGE_KEY = 'boxfury:map-editor';

const state = {
  cols: 53,
  rows: 15,
  grid: [],
  selected: TILES.WALL,
  dragging: false,
  dragValue: null,
  mirrorX: false,
  rectMode: false,
  rectStart: null,
  rectEnd: null,
};

const canvas = document.getElementById('editor-canvas');
const ctx = canvas.getContext('2d');
const paletteEl = document.getElementById('palette');
const textareaEl = document.getElementById('map-text');

function init() {
  loadFromStorage() || newGrid();
  buildPalette();
  resizeCanvas();
  bindCanvas();
  bindButtons();
  render();
  syncTextarea();
}

function newGrid(cols = state.cols, rows = state.rows) {
  state.cols = cols;
  state.rows = rows;
  state.grid = [];
  for (let y = 0; y < rows; y++) {
    state.grid.push(new Array(cols).fill(TILES.EMPTY));
  }
}

function buildPalette() {
  paletteEl.innerHTML = '';
  for (const p of PALETTE) {
    const btn = document.createElement('button');
    btn.className = 'palette__btn';
    btn.textContent = p.label;
    btn.style.color = p.fill;
    btn.title = `${p.name} (${p.ch})`;
    if (p.ch === state.selected) btn.classList.add('is-active');
    btn.addEventListener('click', () => {
      state.selected = p.ch;
      for (const el of paletteEl.children) el.classList.remove('is-active');
      btn.classList.add('is-active');
    });
    paletteEl.appendChild(btn);
  }
}

function resizeCanvas() {
  canvas.width = state.cols * CELL;
  canvas.height = state.rows * CELL;
  canvas.style.width = `${canvas.width}px`;
  canvas.style.height = `${canvas.height}px`;
}

function paletteFor(ch) {
  return PALETTE.find((p) => p.ch === ch) ?? PALETTE[0];
}

function render() {
  ctx.fillStyle = '#1f1f2c';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(255,255,255,0.05)';
  for (let y = 0; y < state.rows; y++) {
    for (let x = 0; x < state.cols; x++) {
      ctx.strokeRect(x * CELL + 0.5, y * CELL + 0.5, CELL - 1, CELL - 1);
    }
  }
  for (let y = 0; y < state.rows; y++) {
    for (let x = 0; x < state.cols; x++) {
      const ch = state.grid[y][x];
      if (ch === TILES.EMPTY) continue;
      drawTile(ctx, x * CELL, y * CELL, ch);
    }
  }
  if (state.rectMode && state.rectStart && state.rectEnd) {
    drawRectPreview(state.rectStart, state.rectEnd, state.dragValue);
    if (state.mirrorX && state.dragValue !== TILES.FLAG) {
      const ms = { x: state.cols - 1 - state.rectStart.x, y: state.rectStart.y };
      const me = { x: state.cols - 1 - state.rectEnd.x, y: state.rectEnd.y };
      drawRectPreview(ms, me, mirrorValue(state.dragValue));
    }
  }
}

function drawRectPreview(start, end, value) {
  const x1 = Math.min(start.x, end.x);
  const y1 = Math.min(start.y, end.y);
  const x2 = Math.max(start.x, end.x);
  const y2 = Math.max(start.y, end.y);
  const p = paletteFor(value);
  const px = x1 * CELL;
  const py = y1 * CELL;
  const pw = (x2 - x1 + 1) * CELL;
  const ph = (y2 - y1 + 1) * CELL;
  ctx.save();
  ctx.globalAlpha = 0.45;
  ctx.fillStyle = p.fill;
  ctx.fillRect(px, py, pw, ph);
  ctx.restore();
  ctx.strokeStyle = p.fill;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(px + 0.5, py + 0.5, pw - 1, ph - 1);
}

function drawTile(ctx, cx, cy, ch) {
  const p = paletteFor(ch);
  if (ch === TILES.WALL) {
    ctx.fillStyle = p.fill;
    const h = 4;
    ctx.fillRect(cx, cy, CELL, h);
  } else if (ch === TILES.SOLID) {
    ctx.fillStyle = p.fill;
    ctx.fillRect(cx + 1, cy + 1, CELL - 2, CELL - 2);
  } else if (ch === TILES.TEAM1_BASE || ch === TILES.TEAM2_BASE) {
    ctx.strokeStyle = p.fill;
    ctx.setLineDash([3, 3]);
    ctx.strokeRect(cx + 2.5, cy + 2.5, CELL - 5, CELL - 5);
    ctx.setLineDash([]);
    ctx.fillStyle = p.fill;
    ctx.font = 'bold 11px JetBrains Mono, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(p.label, cx + CELL / 2, cy + CELL / 2 + 1);
  } else if (ch === TILES.FLAG) {
    ctx.fillStyle = p.fill;
    ctx.fillRect(cx + CELL / 2 - 1, cy + 2, 1.5, CELL - 4);
    ctx.fillRect(cx + CELL / 2, cy + 3, 5, 4);
  }
}

function bindCanvas() {
  const cellAt = (clientX, clientY) => {
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor(((clientX - rect.left) / rect.width) * state.cols);
    const y = Math.floor(((clientY - rect.top) / rect.height) * state.rows);
    if (x < 0 || x >= state.cols || y < 0 || y >= state.rows) return null;
    return { x, y };
  };

  const startDrag = (clientX, clientY, value) => {
    state.dragging = true;
    state.dragValue = value;
    const c = cellAt(clientX, clientY);
    if (state.rectMode) {
      if (!c) return;
      state.rectStart = c;
      state.rectEnd = c;
      render();
    } else if (c) {
      paint(c.x, c.y, value);
    }
  };

  const moveDrag = (clientX, clientY) => {
    if (!state.dragging) return;
    const c = cellAt(clientX, clientY);
    if (!c) return;
    if (state.rectMode) {
      if (state.rectEnd && state.rectEnd.x === c.x && state.rectEnd.y === c.y) return;
      state.rectEnd = c;
      render();
    } else {
      paint(c.x, c.y, state.dragValue);
    }
  };

  const endDrag = () => {
    if (state.rectMode && state.rectStart && state.rectEnd) {
      paintRect(state.rectStart.x, state.rectStart.y, state.rectEnd.x, state.rectEnd.y, state.dragValue);
    }
    state.dragging = false;
    state.dragValue = null;
    state.rectStart = null;
    state.rectEnd = null;
  };

  canvas.addEventListener('mousedown', (e) => {
    e.preventDefault();
    const value = e.button === 2 ? TILES.EMPTY : state.selected;
    startDrag(e.clientX, e.clientY, value);
  });
  canvas.addEventListener('mousemove', (e) => moveDrag(e.clientX, e.clientY));
  window.addEventListener('mouseup', endDrag);
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const t = e.touches[0];
    startDrag(t.clientX, t.clientY, state.selected);
  }, { passive: false });
  canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    const t = e.touches[0];
    moveDrag(t.clientX, t.clientY);
  }, { passive: false });
  canvas.addEventListener('touchend', endDrag);
}

function paintRect(x1, y1, x2, y2, value) {
  if (UNIQUE_TILES.has(value)) {
    paint(x1, y1, value);
    return;
  }
  const lo = { x: Math.min(x1, x2), y: Math.min(y1, y2) };
  const hi = { x: Math.max(x1, x2), y: Math.max(y1, y2) };
  let changed = false;
  for (let y = lo.y; y <= hi.y; y++) {
    for (let x = lo.x; x <= hi.x; x++) {
      if (setCell(x, y, value)) changed = true;
      if (state.mirrorX) {
        const mx = state.cols - 1 - x;
        if (mx !== x && setCell(mx, y, mirrorValue(value))) changed = true;
      }
    }
  }
  if (!changed) {
    render();
    return;
  }
  render();
  syncTextarea();
  saveToStorage();
}

function setCell(x, y, value) {
  if (state.grid[y][x] === value) return false;
  if (UNIQUE_TILES.has(value)) {
    for (let yy = 0; yy < state.rows; yy++) {
      for (let xx = 0; xx < state.cols; xx++) {
        if (state.grid[yy][xx] === value) state.grid[yy][xx] = TILES.EMPTY;
      }
    }
  }
  state.grid[y][x] = value;
  return true;
}

function mirrorValue(value) {
  if (value === TILES.TEAM1_BASE) return TILES.TEAM2_BASE;
  if (value === TILES.TEAM2_BASE) return TILES.TEAM1_BASE;
  return value;
}

function paint(x, y, value) {
  let changed = setCell(x, y, value);
  if (state.mirrorX && value !== TILES.FLAG) {
    const mx = state.cols - 1 - x;
    if (mx !== x) {
      changed = setCell(mx, y, mirrorValue(value)) || changed;
    }
  }
  if (!changed) return;
  render();
  syncTextarea();
  saveToStorage();
}

function syncTextarea() {
  textareaEl.value = exportText();
}

function exportText() {
  const rows = state.grid.map((row) => `  '${row.join('')}',`).join('\n');
  return `[\n${rows}\n].join('\\n')`;
}

function loadFromText(text) {
  let lines;
  const quoted = [...text.matchAll(/'([^'\n]*)'/g)].map((m) => m[1]);
  if (quoted.length > 0) {
    lines = quoted.filter((l) => l.length > 0);
  } else {
    lines = text.split(/\r?\n/).filter((l) => l.length > 0);
  }
  if (lines.length === 0) return false;
  const cols = Math.max(...lines.map((l) => l.length));
  const rows = lines.length;
  newGrid(cols, rows);
  document.getElementById('size-cols').value = cols;
  document.getElementById('size-rows').value = rows;
  for (let y = 0; y < rows; y++) {
    const line = lines[y];
    for (let x = 0; x < cols; x++) {
      const ch = line[x] ?? TILES.EMPTY;
      state.grid[y][x] = paletteFor(ch).ch === ch ? ch : TILES.EMPTY;
    }
  }
  resizeCanvas();
  render();
  syncTextarea();
  saveToStorage();
  return true;
}

function bindButtons() {
  document.getElementById('apply-size').addEventListener('click', () => {
    const cols = clampInt(document.getElementById('size-cols').value, 10, 120, state.cols);
    const rows = clampInt(document.getElementById('size-rows').value, 6, 40, state.rows);
    const oldGrid = state.grid;
    newGrid(cols, rows);
    for (let y = 0; y < Math.min(rows, oldGrid.length); y++) {
      for (let x = 0; x < Math.min(cols, oldGrid[y].length); x++) {
        state.grid[y][x] = oldGrid[y][x];
      }
    }
    resizeCanvas();
    render();
    syncTextarea();
    saveToStorage();
  });

  const mirrorBtn = document.getElementById('btn-mirror');
  mirrorBtn.addEventListener('click', () => {
    state.mirrorX = !state.mirrorX;
    mirrorBtn.classList.toggle('is-active', state.mirrorX);
    mirrorBtn.setAttribute('aria-pressed', String(state.mirrorX));
  });

  const rectBtn = document.getElementById('btn-rect');
  rectBtn.addEventListener('click', () => {
    state.rectMode = !state.rectMode;
    rectBtn.classList.toggle('is-active', state.rectMode);
    rectBtn.setAttribute('aria-pressed', String(state.rectMode));
  });

  document.getElementById('btn-clear').addEventListener('click', () => {
    if (!confirm('Clear the entire map?')) return;
    newGrid(state.cols, state.rows);
    render();
    syncTextarea();
    saveToStorage();
  });

  document.getElementById('btn-fill-floor').addEventListener('click', () => {
    const last = state.rows - 1;
    for (let x = 0; x < state.cols; x++) state.grid[last][x] = TILES.WALL;
    render();
    syncTextarea();
    saveToStorage();
  });

  document.getElementById('btn-load').addEventListener('click', () => {
    const txt = textareaEl.value;
    if (!txt.trim()) return;
    loadFromText(txt);
  });

  document.getElementById('btn-export').addEventListener('click', () => {
    const text = exportText();
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `boxfury-map-${Date.now()}.txt`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });

  document.getElementById('btn-copy').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(exportText());
      const btn = document.getElementById('btn-copy');
      const prev = btn.textContent;
      btn.textContent = 'Copied!';
      setTimeout(() => (btn.textContent = prev), 1200);
    } catch {}
  });
}

function clampInt(v, lo, hi, fallback) {
  const n = parseInt(v, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(lo, Math.min(hi, n));
}

function saveToStorage() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      cols: state.cols,
      rows: state.rows,
      grid: state.grid.map((r) => r.join('')),
    }));
  } catch {}
}

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);
    if (!data?.grid?.length) return false;
    state.cols = data.cols;
    state.rows = data.rows;
    state.grid = data.grid.map((s) => s.split(''));
    document.getElementById('size-cols').value = state.cols;
    document.getElementById('size-rows').value = state.rows;
    return true;
  } catch {
    return false;
  }
}

init();
