import { PLAYER } from '@boxfury/shared';

const CRACK_COLOR = 0x15151f;
const LINES_BY_STAGE = [0, 2, 4, 7];

export function damageStageFromHp(hp) {
  const ratio = Math.max(0, Math.min(1, hp / PLAYER.MAX_HP));
  if (ratio > 0.75) return 0;
  if (ratio > 0.5) return 1;
  if (ratio > 0.25) return 2;
  return 3;
}

export function hashSeed(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function drawCracks(gfx, stage, width, height, seedBase) {
  gfx.clear();
  if (stage <= 0) return;

  const halfW = width / 2;
  const halfH = height / 2;
  const lineCount = LINES_BY_STAGE[stage] ?? 0;

  gfx.lineStyle(1, CRACK_COLOR, 0.9);
  for (let i = 0; i < lineCount; i++) {
    const rng = mulberry32((seedBase ^ Math.imul(i + 1, 0x9E3779B1)) >>> 0);
    drawCrackLine(gfx, halfW, halfH, rng);
  }

  if (stage >= 2) {
    const chipCount = stage === 2 ? 2 : 4;
    gfx.fillStyle(CRACK_COLOR, 0.9);
    for (let i = 0; i < chipCount; i++) {
      const rng = mulberry32((seedBase ^ Math.imul(i + 100, 0x85EBCA77)) >>> 0);
      const cx = (rng() * 2 - 1) * halfW * 0.65;
      const cy = (rng() * 2 - 1) * halfH * 0.65;
      gfx.fillRect(Math.round(cx), Math.round(cy), 2, 2);
    }
  }
}

function drawCrackLine(gfx, halfW, halfH, rng) {
  const startEdge = Math.floor(rng() * 4);
  let sx;
  let sy;
  if (startEdge === 0) { sx = (rng() * 2 - 1) * halfW; sy = -halfH; }
  else if (startEdge === 1) { sx = halfW; sy = (rng() * 2 - 1) * halfH; }
  else if (startEdge === 2) { sx = (rng() * 2 - 1) * halfW; sy = halfH; }
  else { sx = -halfW; sy = (rng() * 2 - 1) * halfH; }

  gfx.beginPath();
  gfx.moveTo(sx, sy);

  const segs = 2 + Math.floor(rng() * 2);
  let cx = sx;
  let cy = sy;
  for (let s = 0; s < segs; s++) {
    cx = clamp(cx + (rng() * 2 - 1) * halfW * 0.7, -halfW + 1, halfW - 1);
    cy = clamp(cy + (rng() * 2 - 1) * halfH * 0.5, -halfH + 1, halfH - 1);
    gfx.lineTo(cx, cy);
  }
  gfx.strokePath();
}

function mulberry32(seed) {
  let s = seed >>> 0;
  return function next() {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}
