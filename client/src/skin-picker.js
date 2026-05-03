import { SKINS } from '@boxfury/shared';
import { drawFaceCanvas } from './entities/faces.js';
import { t } from './i18n.js';
import { getSkin, setSkin } from './skin.js';

const PREVIEW_BOX_W = 160;
const PREVIEW_BOX_H = 320;
const PREVIEW_COLOR = '#4ee08a';

let onSavedCb = null;
let pickedSkin = null;
let canvas = null;
let nameLabel = null;
let listRoot = null;

export function setupSkinPicker({ onSaved } = {}) {
  onSavedCb = onSaved ?? null;
  const overlay = document.getElementById('skin-overlay');
  const closeBtn = document.getElementById('skin-picker-close');
  const cancelBtn = document.getElementById('skin-picker-cancel');
  const saveBtn = document.getElementById('skin-picker-save');
  canvas = document.getElementById('skin-picker-canvas');
  nameLabel = document.getElementById('skin-picker-name');
  listRoot = document.getElementById('skin-picker-list');

  const close = () => overlay.classList.add('hidden');

  closeBtn.addEventListener('click', close);
  cancelBtn.addEventListener('click', close);
  saveBtn.addEventListener('click', () => {
    setSkin(pickedSkin);
    close();
    onSavedCb?.(pickedSkin);
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !overlay.classList.contains('hidden')) close();
  });
}

export function openSkinPicker() {
  pickedSkin = getSkin();
  renderList();
  renderPreview();
  document.getElementById('skin-overlay').classList.remove('hidden');
}

function renderList() {
  listRoot.innerHTML = '';
  for (const id of SKINS) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'skin-picker__chip' + (id === pickedSkin ? ' is-selected' : '');
    btn.dataset.skin = id;
    btn.textContent = t(`skin.${id}`);
    btn.addEventListener('click', () => {
      pickedSkin = id;
      renderList();
      renderPreview();
    });
    listRoot.appendChild(btn);
  }
}

function renderPreview() {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const cssW = canvas.clientWidth || canvas.width;
  const cssH = canvas.clientHeight || canvas.height;
  if (canvas.width !== Math.round(cssW * dpr) || canvas.height !== Math.round(cssH * dpr)) {
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
  }

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.scale(dpr, dpr);

  const cx = cssW / 2;
  const cy = cssH / 2;

  ctx.fillStyle = PREVIEW_COLOR;
  ctx.fillRect(cx - PREVIEW_BOX_W / 2, cy - PREVIEW_BOX_H / 2, PREVIEW_BOX_W, PREVIEW_BOX_H);

  ctx.save();
  ctx.translate(cx, cy);
  drawFaceCanvas(ctx, pickedSkin, PREVIEW_BOX_W, PREVIEW_BOX_H);
  ctx.restore();

  if (nameLabel) nameLabel.textContent = t(`skin.${pickedSkin}`).toUpperCase();
}

export function currentSkinLabel() {
  return t(`skin.${getSkin()}`);
}
