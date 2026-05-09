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
  const fit = Math.min(PREVIEW_W / data.pixelWidth, PREVIEW_H / data.pixelHeight);
  const drawW = data.pixelWidth * fit;
  const drawH = data.pixelHeight * fit;
  const ox = (PREVIEW_W - drawW) / 2;
  const oy = (PREVIEW_H - drawH) / 2;

  ctx.fillStyle = '#15151f';
  ctx.fillRect(0, 0, PREVIEW_W, PREVIEW_H);

  ctx.fillStyle = '#1f1f2c';
  ctx.fillRect(ox, oy, drawW, drawH);

  ctx.fillStyle = '#f5f5f0';
  for (const wall of data.walls) {
    const x = ox + (wall.x - wall.w / 2) * fit;
    const y = oy + (wall.y - wall.h / 2) * fit;
    const w = Math.max(1, wall.w * fit);
    const h = Math.max(1.5, wall.h * fit);
    ctx.fillRect(x, y, w, h);
  }

  if (data.solidWalls) {
    for (const w of data.solidWalls) {
      const x = ox + (w.x - w.w / 2) * fit;
      const y = oy + (w.y - w.h / 2) * fit;
      const ww = Math.max(1, w.w * fit);
      const hh = Math.max(1, w.h * fit);
      ctx.fillRect(x, y, ww, hh);
    }
  }

  if (data.bases.team1) drawBase(ctx, data.bases.team1, '#4ee08a', fit, ox, oy);
  if (data.bases.team2) drawBase(ctx, data.bases.team2, '#ff5470', fit, ox, oy);
  if (data.flag) drawFlag(ctx, data.flag, fit, ox, oy);
}

function drawBase(ctx, pos, color, fit, ox, oy) {
  const size = 6;
  const x = ox + pos.x * fit - size / 2;
  const y = oy + pos.y * fit - size / 2;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x, y, size, size);
}

function drawFlag(ctx, pos, fit, ox, oy) {
  const x = ox + pos.x * fit;
  const y = oy + pos.y * fit;
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
