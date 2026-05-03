import { normalizeSkin } from '@boxfury/shared';

const STROKE = 0xffffff;
const STROKE_W = 1;

export function drawFace(gfx, skinId, width, height) {
  gfx.clear();
  const id = normalizeSkin(skinId);
  const halfW = width / 2;
  const halfH = height / 2;

  const eyeY = -halfH * 0.45;
  const eyeX = halfW * 0.42;
  const mouthY = halfH * 0.05;

  gfx.lineStyle(STROKE_W, STROKE, 1);
  gfx.fillStyle(STROKE, 1);

  switch (id) {
    case 'smile':
      eyeDots(gfx, eyeX, eyeY);
      arc(gfx, 0, mouthY, halfW * 0.45, halfH * 0.18, true);
      break;
    case 'neutral':
      eyeDots(gfx, eyeX, eyeY);
      hLine(gfx, 0, mouthY, halfW * 0.45);
      break;
    case 'sad':
      eyeDots(gfx, eyeX, eyeY);
      arc(gfx, 0, mouthY + halfH * 0.1, halfW * 0.45, halfH * 0.18, false);
      break;
    case 'surprised':
      eyeDots(gfx, eyeX, eyeY, 1.5);
      gfx.strokeCircle(0, mouthY + halfH * 0.05, halfW * 0.22);
      break;
    case 'cool':
      shades(gfx, eyeX, eyeY, halfW, halfH);
      arc(gfx, 0, mouthY, halfW * 0.45, halfH * 0.16, true);
      break;
    case 'angry':
      brows(gfx, eyeX, eyeY, halfW, halfH);
      eyeDots(gfx, eyeX, eyeY + halfH * 0.08);
      hLine(gfx, 0, mouthY + halfH * 0.05, halfW * 0.4);
      break;
  }
}

function eyeDots(gfx, x, y, r = 1) {
  gfx.fillRect(Math.round(-x - r / 2), Math.round(y - r / 2), Math.max(1, Math.round(r)), Math.max(1, Math.round(r)));
  gfx.fillRect(Math.round(x - r / 2), Math.round(y - r / 2), Math.max(1, Math.round(r)), Math.max(1, Math.round(r)));
}

function hLine(gfx, x, y, len) {
  gfx.beginPath();
  gfx.moveTo(x - len / 2, y);
  gfx.lineTo(x + len / 2, y);
  gfx.strokePath();
}

function arc(gfx, cx, cy, w, h, smile) {
  const steps = 8;
  gfx.beginPath();
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const px = cx - w / 2 + w * t;
    const offset = Math.sin(t * Math.PI) * h;
    const py = smile ? cy + offset : cy - offset;
    if (i === 0) gfx.moveTo(px, py);
    else gfx.lineTo(px, py);
  }
  gfx.strokePath();
}

function shades(gfx, eyeX, eyeY, halfW, halfH) {
  const w = halfW * 0.42;
  const h = halfH * 0.12;
  gfx.fillRect(Math.round(-eyeX - w / 2), Math.round(eyeY - h / 2), Math.round(w), Math.round(h));
  gfx.fillRect(Math.round(eyeX - w / 2), Math.round(eyeY - h / 2), Math.round(w), Math.round(h));
  gfx.beginPath();
  gfx.moveTo(-eyeX + w / 2, eyeY);
  gfx.lineTo(eyeX - w / 2, eyeY);
  gfx.strokePath();
}

function brows(gfx, eyeX, eyeY, halfW, halfH) {
  const len = halfW * 0.4;
  const browY = eyeY - halfH * 0.05;
  gfx.beginPath();
  gfx.moveTo(-eyeX - len / 2, browY - halfH * 0.05);
  gfx.lineTo(-eyeX + len / 2, browY + halfH * 0.05);
  gfx.moveTo(eyeX - len / 2, browY + halfH * 0.05);
  gfx.lineTo(eyeX + len / 2, browY - halfH * 0.05);
  gfx.strokePath();
}

export function drawFaceCanvas(ctx, skinId, width, height) {
  const id = normalizeSkin(skinId);
  const halfW = width / 2;
  const halfH = height / 2;
  const eyeY = -halfH * 0.45;
  const eyeX = halfW * 0.42;
  const mouthY = halfH * 0.05;
  const dotR = Math.max(2, Math.round(width * 0.06));
  const lineW = Math.max(1, Math.round(width / 60));

  ctx.strokeStyle = '#ffffff';
  ctx.fillStyle = '#ffffff';
  ctx.lineWidth = lineW;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  switch (id) {
    case 'smile':
      eyeDotsC(ctx, eyeX, eyeY, dotR);
      arcC(ctx, 0, mouthY, halfW * 0.45, halfH * 0.18, true);
      break;
    case 'neutral':
      eyeDotsC(ctx, eyeX, eyeY, dotR);
      hLineC(ctx, 0, mouthY, halfW * 0.45);
      break;
    case 'sad':
      eyeDotsC(ctx, eyeX, eyeY, dotR);
      arcC(ctx, 0, mouthY + halfH * 0.1, halfW * 0.45, halfH * 0.18, false);
      break;
    case 'surprised':
      eyeDotsC(ctx, eyeX, eyeY, dotR * 1.5);
      ctx.beginPath();
      ctx.arc(0, mouthY + halfH * 0.05, halfW * 0.22, 0, Math.PI * 2);
      ctx.stroke();
      break;
    case 'cool':
      shadesC(ctx, eyeX, eyeY, halfW, halfH);
      arcC(ctx, 0, mouthY, halfW * 0.45, halfH * 0.16, true);
      break;
    case 'angry':
      browsC(ctx, eyeX, eyeY, halfW, halfH);
      eyeDotsC(ctx, eyeX, eyeY + halfH * 0.08, dotR);
      hLineC(ctx, 0, mouthY + halfH * 0.05, halfW * 0.4);
      break;
  }
}

function eyeDotsC(ctx, x, y, r) {
  ctx.fillRect(-x - r / 2, y - r / 2, r, r);
  ctx.fillRect(x - r / 2, y - r / 2, r, r);
}

function hLineC(ctx, x, y, len) {
  ctx.beginPath();
  ctx.moveTo(x - len / 2, y);
  ctx.lineTo(x + len / 2, y);
  ctx.stroke();
}

function arcC(ctx, cx, cy, w, h, smile) {
  const steps = 16;
  ctx.beginPath();
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const px = cx - w / 2 + w * t;
    const offset = Math.sin(t * Math.PI) * h;
    const py = smile ? cy + offset : cy - offset;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.stroke();
}

function shadesC(ctx, eyeX, eyeY, halfW, halfH) {
  const w = halfW * 0.42;
  const h = halfH * 0.12;
  ctx.fillRect(-eyeX - w / 2, eyeY - h / 2, w, h);
  ctx.fillRect(eyeX - w / 2, eyeY - h / 2, w, h);
  ctx.beginPath();
  ctx.moveTo(-eyeX + w / 2, eyeY);
  ctx.lineTo(eyeX - w / 2, eyeY);
  ctx.stroke();
}

function browsC(ctx, eyeX, eyeY, halfW, halfH) {
  const len = halfW * 0.4;
  const browY = eyeY - halfH * 0.05;
  ctx.beginPath();
  ctx.moveTo(-eyeX - len / 2, browY - halfH * 0.05);
  ctx.lineTo(-eyeX + len / 2, browY + halfH * 0.05);
  ctx.moveTo(eyeX - len / 2, browY + halfH * 0.05);
  ctx.lineTo(eyeX + len / 2, browY - halfH * 0.05);
  ctx.stroke();
}
