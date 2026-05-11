import { BEE, PLAYER } from '@boxfury/shared';

const HALF_W = BEE.WIDTH / 2;
const HALF_H = BEE.HEIGHT / 2;

export class BeeController {
  constructor(room, sessionId, bee) {
    this.room = room;
    this.sessionId = sessionId;
    this.bee = bee;
    this.spawnedAt = Date.now();
  }

  findTarget() {
    let best = null;
    let bestDist = Infinity;
    this.room.state.players.forEach((p) => {
      if (p === this.bee) return;
      if (p.kind === 'bee') return;
      if (!p.alive) return;
      if (p.team === 0) return;
      const d = Math.hypot(p.x - this.bee.x, p.y - this.bee.y);
      if (d < bestDist) {
        best = p;
        bestDist = d;
      }
    });
    if (!best || bestDist > BEE.SIGHT_RANGE) return null;
    return best;
  }

  tick(dt, _now) {
    const bee = this.bee;
    if (!bee.alive) {
      bee.vx = 0;
      bee.vy = 0;
      return;
    }

    const target = this.findTarget();

    let ax = 0;
    let ay = 0;

    if (target) {
      const dx = target.x - bee.x;
      const dy = (target.y - PLAYER.HEIGHT * 0.4) - bee.y;
      const dist = Math.hypot(dx, dy) || 1;
      const desiredDist = BEE.HOVER_DISTANCE;
      const overshoot = dist - desiredDist;
      const dirX = dx / dist;
      const dirY = dy / dist;
      const intensity = Math.tanh(Math.abs(overshoot) / 80) * Math.sign(overshoot);
      ax = dirX * BEE.ACCEL * intensity;
      ay = dirY * BEE.ACCEL * intensity;
      bee.facing = dx >= 0 ? 1 : -1;

      const elapsed = (Date.now() - this.spawnedAt) / 1000;
      const bob = Math.sin(elapsed * BEE.BOB_FREQUENCY) * BEE.BOB_AMPLITUDE;
      ay += bob * 0.6;
    } else {
      ax = -bee.vx * BEE.DAMPING;
      ay = -bee.vy * BEE.DAMPING;
    }

    bee.vx += ax * dt;
    bee.vy += ay * dt;

    bee.vx -= bee.vx * BEE.DAMPING * dt * 0.6;
    bee.vy -= bee.vy * BEE.DAMPING * dt * 0.6;

    const speed = Math.hypot(bee.vx, bee.vy);
    if (speed > BEE.SPEED) {
      const k = BEE.SPEED / speed;
      bee.vx *= k;
      bee.vy *= k;
    }

    bee.x += bee.vx * dt;
    bee.y += bee.vy * dt;

    const map = this.room.map;
    if (bee.x < HALF_W) { bee.x = HALF_W; bee.vx = 0; }
    if (bee.x > map.pixelWidth - HALF_W) { bee.x = map.pixelWidth - HALF_W; bee.vx = 0; }
    if (bee.y < HALF_H) { bee.y = HALF_H; bee.vy = 0; }
    if (bee.y > map.pixelHeight - HALF_H) { bee.y = map.pixelHeight - HALF_H; bee.vy = 0; }
  }

  _resolveSolidCollision(solids) {
    const bee = this.bee;
    for (const w of solids) {
      const wLeft = w.x - w.w / 2;
      const wRight = w.x + w.w / 2;
      const wTop = w.y - w.h / 2;
      const wBottom = w.y + w.h / 2;
      const left = bee.x - HALF_W;
      const right = bee.x + HALF_W;
      const top = bee.y - HALF_H;
      const bottom = bee.y + HALF_H;
      if (right <= wLeft || left >= wRight || bottom <= wTop || top >= wBottom) continue;

      const overlapL = right - wLeft;
      const overlapR = wRight - left;
      const overlapT = bottom - wTop;
      const overlapB = wBottom - top;
      const minOverlap = Math.min(overlapL, overlapR, overlapT, overlapB);

      if (minOverlap === overlapL) {
        bee.x = wLeft - HALF_W;
        if (bee.vx > 0) bee.vx = 0;
      } else if (minOverlap === overlapR) {
        bee.x = wRight + HALF_W;
        if (bee.vx < 0) bee.vx = 0;
      } else if (minOverlap === overlapT) {
        bee.y = wTop - HALF_H;
        if (bee.vy > 0) bee.vy = 0;
      } else {
        bee.y = wBottom + HALF_H;
        if (bee.vy < 0) bee.vy = 0;
      }
    }
  }
}
