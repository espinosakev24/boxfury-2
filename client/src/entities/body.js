import { PLAYER } from '@boxfury/shared';

export const BODY_RATIO = 2 / 3;
export const BODY_HEIGHT = PLAYER.HEIGHT * BODY_RATIO;
export const LEG_LENGTH = PLAYER.HEIGHT - BODY_HEIGHT;

const LEG_WIDTH = 2;
const HIP_HALF = 4;
const STRIDE = 5;
const LIFT = 4;
const KNEE_FWD = 3;
const KNEE_UP = 2;
const BOB_AMP = 3;
const MAX_TILT = 0.07;

export function computeWalkBob(phase) {
  return -Math.abs(Math.sin(phase * 0.5)) * BOB_AMP;
}

export function computeLean(vx, maxSpeed) {
  if (!vx) return 0;
  const ratio = Math.min(1, Math.abs(vx) / maxSpeed);
  return Math.sign(vx) * ratio * MAX_TILT;
}

export function drawBody(gfx, fillColor, { stroke = false } = {}) {
  gfx.clear();
  const halfW = PLAYER.WIDTH / 2;
  const halfH = PLAYER.HEIGHT / 2;
  const top = -halfH;
  gfx.fillStyle(fillColor, 1);
  gfx.fillRect(-halfW, top, PLAYER.WIDTH, BODY_HEIGHT);
  if (stroke) {
    gfx.lineStyle(1, 0xffffff, 0.4);
    gfx.strokeRect(-halfW, top, PLAYER.WIDTH, BODY_HEIGHT);
  }
}

export function drawLegs(gfx, color, phase, { isMoving, isGrounded, facing = 1, vyNorm = 0, walkAmp = 1 }) {
  gfx.clear();
  const halfH = PLAYER.HEIGHT / 2;
  const hipY = -halfH + BODY_HEIGHT;
  const footRestY = halfH;
  const dir = facing >= 0 ? 1 : -1;

  gfx.lineStyle(LEG_WIDTH, color, 1);

  if (!isGrounded) {
    drawAirborneLeg(gfx, -HIP_HALF, hipY, footRestY, dir, vyNorm, 0);
    drawAirborneLeg(gfx, HIP_HALF, hipY, footRestY, dir, vyNorm, 1);
    return;
  }

  const amp = Math.max(0, Math.min(1, walkAmp));
  if (!isMoving || amp < 0.05) {
    drawStraightLeg(gfx, -HIP_HALF, hipY, footRestY);
    drawStraightLeg(gfx, HIP_HALF, hipY, footRestY);
    return;
  }

  drawWalkLeg(gfx, -HIP_HALF, hipY, footRestY, phase, dir, amp);
  drawWalkLeg(gfx, HIP_HALF, hipY, footRestY, phase + Math.PI, dir, amp);
}

function drawStraightLeg(gfx, x, hipY, footY) {
  gfx.beginPath();
  gfx.moveTo(x, hipY);
  gfx.lineTo(x, footY);
  gfx.strokePath();
}

function drawWalkLeg(gfx, hipX, hipY, footRestY, p, dir, amp = 1) {
  const cx = Math.cos(p);
  const sn = Math.sin(p);
  const stride = cx * STRIDE * dir * amp;
  const lifted = Math.max(0, -sn) * amp;
  const footX = hipX + stride;
  const footY = footRestY - lifted * LIFT;
  const baseKneeX = (hipX + footX) / 2;
  const baseKneeY = (hipY + footY) / 2;
  const kneeX = baseKneeX + dir * lifted * KNEE_FWD;
  const kneeY = baseKneeY - lifted * KNEE_UP;
  gfx.beginPath();
  gfx.moveTo(hipX, hipY);
  gfx.lineTo(kneeX, kneeY);
  gfx.lineTo(footX, footY);
  gfx.strokePath();
}

function drawAirborneLeg(gfx, hipX, hipY, footRestY, dir, vyNorm, side) {
  const v = clamp(vyNorm, -1, 1);
  const tuck = clamp(0.55 - v * 0.45, 0.15, 0.95);
  const sideOffset = side === 0 ? -0.5 : 0.5;
  const footY = footRestY - LIFT * 1.4 * tuck;
  const footX = hipX + dir * 1.2 + sideOffset;
  const kneeX = hipX + dir * (KNEE_FWD + 1) * tuck;
  const kneeY = (hipY + footY) / 2 - KNEE_UP * tuck;
  gfx.beginPath();
  gfx.moveTo(hipX, hipY);
  gfx.lineTo(kneeX, kneeY);
  gfx.lineTo(footX, footY);
  gfx.strokePath();
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}
