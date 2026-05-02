import { GRAVITY, PLAYER, WORLD } from '@boxfury/shared';

const HALF_W = PLAYER.WIDTH / 2;
const HALF_H = PLAYER.HEIGHT / 2;
const FLAG_HALF = 8;

function aabb(ax, ay, aw, ah, bx, by, bw, bh) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

export function stepPlayer(player, input, prevInput, dt, map) {
  const { solidRects, oneWayRects, hazards, tileSize } = map;

  const dirX = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  player.vx = dirX * PLAYER.SPEED;
  if (dirX !== 0) player.facing = dirX;

  const jumpRising = input.jump && !prevInput.jump;
  if (jumpRising && player.grounded) {
    player.vy = -PLAYER.JUMP_SPEED;
    player.grounded = false;
  }

  const downRising = input.down && !prevInput.down;
  let droppedThrough = false;
  if (downRising && player.grounded && player.groundedOnOneWay) {
    player.y += 2;
    player.grounded = false;
    player.groundedOnOneWay = false;
    droppedThrough = true;
  }

  player.vy += GRAVITY * dt;

  player.x += player.vx * dt;
  resolveSolidsX(player, solidRects);

  const prevBottom = player.y + HALF_H;
  player.y += player.vy * dt;
  resolveSolidsY(player, solidRects);

  if (player.vy >= 0 && !input.down) {
    resolveOneWaysY(player, oneWayRects, prevBottom);
  } else {
    player.groundedOnOneWay = false;
  }

  if (player.x < HALF_W) { player.x = HALF_W; player.vx = 0; }
  const maxX = map.width * tileSize - HALF_W;
  if (player.x > maxX) { player.x = maxX; player.vx = 0; }

  player.hitHazard = false;
  const px = player.x - HALF_W;
  const py = player.y - HALF_H;
  for (const h of hazards) {
    if (aabb(px, py, PLAYER.WIDTH, PLAYER.HEIGHT, h.x, h.y, h.w, h.h)) {
      player.hitHazard = true;
      break;
    }
  }

  if (player.y > WORLD.HEIGHT + 200) player.hitHazard = true;

  return { droppedThrough };
}

function resolveSolidsX(player, solids) {
  const px = player.x - HALF_W;
  const py = player.y - HALF_H;
  for (const r of solids) {
    if (!aabb(px, py, PLAYER.WIDTH, PLAYER.HEIGHT, r.x, r.y, r.w, r.h)) continue;
    if (player.vx > 0) player.x = r.x - HALF_W;
    else if (player.vx < 0) player.x = r.x + r.w + HALF_W;
    player.vx = 0;
    return;
  }
}

function resolveSolidsY(player, solids) {
  player.grounded = false;
  const px = player.x - HALF_W;
  const py = player.y - HALF_H;
  for (const r of solids) {
    if (!aabb(px, py, PLAYER.WIDTH, PLAYER.HEIGHT, r.x, r.y, r.w, r.h)) continue;
    if (player.vy > 0) {
      player.y = r.y - HALF_H;
      player.grounded = true;
    } else if (player.vy < 0) {
      player.y = r.y + r.h + HALF_H;
    }
    player.vy = 0;
    return;
  }
}

function resolveOneWaysY(player, oneWays, prevBottom) {
  player.groundedOnOneWay = false;
  const px = player.x - HALF_W;
  const py = player.y - HALF_H;
  for (const r of oneWays) {
    if (!aabb(px, py, PLAYER.WIDTH, PLAYER.HEIGHT, r.x, r.y, r.w, r.h)) continue;
    if (prevBottom <= r.y + 0.001) {
      player.y = r.y - HALF_H;
      player.vy = 0;
      player.grounded = true;
      player.groundedOnOneWay = true;
      return;
    }
  }
}

export function stepFlag(flag, dt, map) {
  if (flag.carrierId) return;
  flag.vy += GRAVITY * dt;
  flag.x += flag.vx * dt;
  flag.y += flag.vy * dt;

  const fx = flag.x - FLAG_HALF;
  const fy = flag.y - FLAG_HALF;
  for (const r of map.solidRects) {
    if (!aabb(fx, fy, FLAG_HALF * 2, FLAG_HALF * 2, r.x, r.y, r.w, r.h)) continue;
    if (flag.vy > 0) {
      flag.y = r.y - FLAG_HALF;
      flag.vy = 0;
      flag.vx *= 0.5;
    } else if (flag.vy < 0) {
      flag.y = r.y + r.h + FLAG_HALF;
      flag.vy = 0;
    }
  }

  if (flag.x < FLAG_HALF) { flag.x = FLAG_HALF; flag.vx = 0; }
  const maxX = map.width * map.tileSize - FLAG_HALF;
  if (flag.x > maxX) { flag.x = maxX; flag.vx = 0; }
}

export function flagOverlapsHazard(flag, hazards) {
  const fx = flag.x - FLAG_HALF;
  const fy = flag.y - FLAG_HALF;
  for (const h of hazards) {
    if (aabb(fx, fy, FLAG_HALF * 2, FLAG_HALF * 2, h.x, h.y, h.w, h.h)) return true;
  }
  return false;
}

export function flagPlayerOverlap(flag, player) {
  const fx = flag.x - FLAG_HALF;
  const fy = flag.y - FLAG_HALF;
  const px = player.x - HALF_W;
  const py = player.y - HALF_H;
  return aabb(fx, fy, FLAG_HALF * 2, FLAG_HALF * 2, px, py, PLAYER.WIDTH, PLAYER.HEIGHT);
}

const ARROW_HALF = 4;

export function stepArrow(arrow, dt, map) {
  arrow.vy += GRAVITY * 0.6 * dt;
  arrow.x += arrow.vx * dt;
  arrow.y += arrow.vy * dt;
  arrow.rotation = Math.atan2(arrow.vy, arrow.vx);

  const ax = arrow.x - ARROW_HALF;
  const ay = arrow.y - ARROW_HALF;
  for (const r of map.solidRects) {
    if (aabb(ax, ay, ARROW_HALF * 2, ARROW_HALF * 2, r.x, r.y, r.w, r.h)) return 'solid';
  }
  for (const h of map.hazards) {
    if (aabb(ax, ay, ARROW_HALF * 2, ARROW_HALF * 2, h.x, h.y, h.w, h.h)) return 'solid';
  }
  if (arrow.x < 0 || arrow.x > map.width * map.tileSize) return 'oob';
  if (arrow.y > map.height * map.tileSize + 100) return 'oob';
  return null;
}

export function arrowHitsPlayer(arrow, player) {
  const ax = arrow.x - ARROW_HALF;
  const ay = arrow.y - ARROW_HALF;
  const px = player.x - HALF_W;
  const py = player.y - HALF_H;
  return aabb(ax, ay, ARROW_HALF * 2, ARROW_HALF * 2, px, py, PLAYER.WIDTH, PLAYER.HEIGHT);
}
