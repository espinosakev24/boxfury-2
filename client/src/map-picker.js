import { MAP_IDS, WORLD, getMap, parseMap } from '@boxfury/shared';
import { t } from './i18n.js';

const PREVIEW_W = 280;
const PREVIEW_H = Math.round(PREVIEW_W * (WORLD.HEIGHT / WORLD.WIDTH));

let onSelectCb = null;
let currentMapId = null;

export function setupMapPicker() {
  const overlay = document.getElementById('map-picker-overlay');
  if (!overlay) return;
  const close = () => overlay.classList.add('hidden');
  document.getElementById('map-picker-close')?.addEventListener('click', close);
  document.getElementById('map-picker-back')?.addEventListener('click', close);

  window.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!overlay.classList.contains('hidden')) close();
  });
}

export function openMapPicker({ mapId, onSelect }) {
  onSelectCb = onSelect ?? null;
  currentMapId = mapId;
  render();
  document.getElementById('map-picker-overlay')?.classList.remove('hidden');
}

export function closeMapPicker() {
  document.getElementById('map-picker-overlay')?.classList.add('hidden');
}

function render() {
  const grid = document.getElementById('map-picker-grid');
  if (!grid) return;
  grid.innerHTML = '';
  for (const id of MAP_IDS) {
    grid.appendChild(makeCard(id));
  }
}

function makeCard(id) {
  const card = document.createElement('button');
  card.type = 'button';
  card.className = 'map-card' + (id === currentMapId ? ' is-selected' : '');
  card.innerHTML = `
    <div class="map-card__preview">
      <canvas width="${PREVIEW_W}" height="${PREVIEW_H}"></canvas>
    </div>
    <div class="map-card__name">${escapeHtml(t(`map.${id}`))}</div>
  `;
  const canvas = card.querySelector('canvas');
  drawPreview(canvas, id);
  card.addEventListener('click', () => {
    closeMapPicker();
    onSelectCb?.(id);
  });
  return card;
}

function drawPreview(canvas, mapId) {
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  if (canvas.width !== PREVIEW_W * dpr) {
    canvas.width = PREVIEW_W * dpr;
    canvas.height = PREVIEW_H * dpr;
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, PREVIEW_W, PREVIEW_H);

  const data = parseMap(getMap(mapId));
  const sx = PREVIEW_W / WORLD.WIDTH;
  const sy = PREVIEW_H / WORLD.HEIGHT;

  ctx.fillStyle = '#15151f';
  ctx.fillRect(0, 0, PREVIEW_W, PREVIEW_H);

  ctx.fillStyle = '#f5f5f0';
  for (const wall of data.walls) {
    const x = (wall.x - wall.w / 2) * sx;
    const y = (wall.y - wall.h / 2) * sy;
    const w = Math.max(1, wall.w * sx);
    const h = Math.max(1.5, wall.h * sy);
    ctx.fillRect(x, y, w, h);
  }

  if (data.bases.team1) drawBase(ctx, data.bases.team1, '#4ee08a', sx, sy);
  if (data.bases.team2) drawBase(ctx, data.bases.team2, '#ff5470', sx, sy);
  if (data.flag) drawFlag(ctx, data.flag, sx, sy);
}

function drawBase(ctx, pos, color, sx, sy) {
  const size = 6;
  const x = pos.x * sx - size / 2;
  const y = pos.y * sy - size / 2;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x, y, size, size);
}

function drawFlag(ctx, pos, sx, sy) {
  const x = pos.x * sx;
  const y = pos.y * sy;
  ctx.strokeStyle = '#ffd84e';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x, y - 5);
  ctx.lineTo(x, y + 3);
  ctx.stroke();
  ctx.fillStyle = '#ffd84e';
  ctx.beginPath();
  ctx.moveTo(x, y - 5);
  ctx.lineTo(x + 5, y - 3);
  ctx.lineTo(x, y - 1);
  ctx.closePath();
  ctx.fill();
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
