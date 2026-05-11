import { BEE, PLAYER } from '@boxfury/shared';

const HALF_W = BEE.WIDTH / 2;
const HALF_H = BEE.HEIGHT / 2;

export class BeeController {
  constructor(room, sessionId, bee) {
    this.room = room;
    this.sessionId = sessionId;
    this.bee = bee;
    this.spawnedAt = Date.now();
    this.attackState = 'idle';
    this.attackEndedAt = 0;
    this.attackStartedAt = 0;
    this.lungeTargetId = null;
    this.lungeDirX = 0;
    this.lungeDirY = 0;
    this.recoverDirX = 0;
    this.recoverDirY = 0;
    this.recoverStartedAt = 0;
  }

  findTarget() {
    let best = null;
    let bestId = null;
    let bestDist = Infinity;
    this.room.state.players.forEach((p, id) => {
      if (p === this.bee) return;
      if (p.kind === 'bee') return;
      if (!p.alive) return;
      if (p.team === 0) return;
      const d = Math.hypot(p.x - this.bee.x, p.y - this.bee.y);
      if (d < bestDist) {
        best = p;
        bestId = id;
        bestDist = d;
      }
    });
    if (!best || bestDist > BEE.SIGHT_RANGE) return null;
    return { player: best, id: bestId, dist: bestDist };
  }

  tick(dt, _now) {
    const bee = this.bee;
    const now = Date.now();
    if (!bee.alive) {
      bee.vx = 0;
      bee.vy = 0;
      this.attackState = 'idle';
      return;
    }

    if (this.attackState === 'lunge') {
      this._tickLunge(dt, now);
      this._clampToMap();
      return;
    }
    if (this.attackState === 'recover') {
      this._tickRecover(dt, now);
      this._clampToMap();
      return;
    }

    const found = this.findTarget();
    const target = found?.player ?? null;

    if (target && now - this.attackEndedAt >= BEE.ATTACK_COOLDOWN_MS) {
      const dx = target.x - bee.x;
      const dy = target.y - bee.y;
      const dist = Math.hypot(dx, dy);
      if (dist <= BEE.ATTACK_TRIGGER_RANGE) {
        this._beginLunge(target, found.id, now);
        return;
      }
    }

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

    this._clampToMap();
  }

  _clampToMap() {
    const bee = this.bee;
    const map = this.room.map;
    if (bee.x < HALF_W) { bee.x = HALF_W; bee.vx = 0; }
    if (bee.x > map.pixelWidth - HALF_W) { bee.x = map.pixelWidth - HALF_W; bee.vx = 0; }
    if (bee.y < HALF_H) { bee.y = HALF_H; bee.vy = 0; }
    if (bee.y > map.pixelHeight - HALF_H) { bee.y = map.pixelHeight - HALF_H; bee.vy = 0; }
  }

  _beginLunge(target, targetId, now) {
    const bee = this.bee;
    const dx = target.x - bee.x;
    const dy = (target.y - PLAYER.HEIGHT * 0.3) - bee.y;
    const dist = Math.hypot(dx, dy) || 1;
    this.lungeDirX = dx / dist;
    this.lungeDirY = dy / dist;
    this.lungeTargetId = targetId;
    this.attackState = 'lunge';
    this.attackStartedAt = now;
    bee.facing = dx >= 0 ? 1 : -1;
    bee.vx = this.lungeDirX * BEE.LUNGE_SPEED;
    bee.vy = this.lungeDirY * BEE.LUNGE_SPEED;
  }

  _tickLunge(dt, now) {
    const bee = this.bee;
    bee.vx = this.lungeDirX * BEE.LUNGE_SPEED;
    bee.vy = this.lungeDirY * BEE.LUNGE_SPEED;
    bee.x += bee.vx * dt;
    bee.y += bee.vy * dt;

    const target = this.lungeTargetId
      ? this.room.state.players.get(this.lungeTargetId)
      : null;

    if (
      target &&
      target.alive &&
      target.kind !== 'bee' &&
      (!target.spawnProtectionUntil || now >= target.spawnProtectionUntil) &&
      now - target.lastHitAt >= 60
    ) {
      const reachW = (PLAYER.WIDTH + BEE.WIDTH) / 2;
      const reachH = (PLAYER.HEIGHT + BEE.HEIGHT) / 2;
      const dx = target.x - bee.x;
      const dy = target.y - bee.y;
      if (Math.abs(dx) <= reachW && Math.abs(dy) <= reachH) {
        const hitDirX = bee.x <= target.x ? 1 : -1;
        const knockX = hitDirX * BEE.LUNGE_KNOCK_X;
        const knockY = -BEE.LUNGE_KNOCK_UP;
        this.room.applyBeeMelee(this.sessionId, target, this.lungeTargetId, knockX, knockY);
        this._beginRecover(now, hitDirX);
        return;
      }
    }

    if (now - this.attackStartedAt >= BEE.LUNGE_TIMEOUT_MS) {
      const fallbackDir = this.lungeDirX >= 0 ? 1 : -1;
      this._beginRecover(now, fallbackDir);
    }
  }

  _beginRecover(now, hitDirX) {
    const bee = this.bee;
    this.attackState = 'recover';
    this.recoverStartedAt = now;
    this.recoverDirX = -hitDirX;
    this.recoverDirY = -0.6;
    bee.vx = this.recoverDirX * BEE.RECOVER_SPEED;
    bee.vy = this.recoverDirY * BEE.RECOVER_SPEED;
    this.lungeTargetId = null;
  }

  _tickRecover(dt, now) {
    const bee = this.bee;
    bee.vx -= bee.vx * BEE.DAMPING * dt * 1.6;
    bee.vy -= bee.vy * BEE.DAMPING * dt * 1.6;
    bee.x += bee.vx * dt;
    bee.y += bee.vy * dt;

    if (now - this.recoverStartedAt >= BEE.RECOVER_MS) {
      this.attackState = 'idle';
      this.attackEndedAt = now;
    }
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
