import { BEE, PLAYER, TILE } from '@boxfury/shared';

const HALF_W = BEE.WIDTH / 2;
const HALF_H = BEE.HEIGHT / 2;

const PATH_REPLAN_MS = 380;
const TARGET_DRIFT_REPLAN = 56;
const ASTAR_MAX_NODES = 1200;
const WAYPOINT_REACH = Math.max(HALF_W, HALF_H) + 6;

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
    this.knockedStartedAt = 0;
    this.path = null;
    this.pathIndex = 0;
    this.lastPathAt = 0;
    this.lastPlanTargetX = 0;
    this.lastPlanTargetY = 0;
    this.wobblePhase = Math.random() * Math.PI * 2;
    this.wobbleFreqJitter = 0.85 + Math.random() * 0.3;
  }

  applyKnockback(knockX, knockY) {
    if (!this.bee.alive) return;
    this.bee.vx = knockX * BEE.KNOCKBACK_MULT;
    this.bee.vy = knockY * BEE.KNOCKBACK_MULT;
    this.attackState = 'knocked';
    this.knockedStartedAt = Date.now();
    this.lungeTargetId = null;
    this.path = null;
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
      this.path = null;
      return;
    }

    if (this.attackState === 'knocked') {
      this._tickKnocked(dt, now);
      this._postMove();
      return;
    }
    if (this.attackState === 'lunge') {
      this._tickLunge(dt, now);
      this._postMove();
      return;
    }
    if (this.attackState === 'recover') {
      this._tickRecover(dt, now);
      this._postMove();
      return;
    }

    const found = this.findTarget();
    const target = found?.player ?? null;

    if (target && now - this.attackEndedAt >= BEE.ATTACK_COOLDOWN_MS) {
      const dx = target.x - bee.x;
      const dy = target.y - bee.y;
      const dist = Math.hypot(dx, dy);
      if (dist <= BEE.ATTACK_TRIGGER_RANGE && !this._segmentHitsObstacles(bee.x, bee.y, target.x, target.y)) {
        this._beginLunge(target, found.id, now);
        return;
      }
    }

    let ax = 0;
    let ay = 0;

    if (target) {
      this._maybeReplan(target, now);
      const aimY = target.y - PLAYER.HEIGHT * 0.4;
      const wp = this._currentWaypoint(target.x, aimY);
      const goalX = wp ? wp.x : target.x;
      const goalY = wp ? wp.y : aimY;

      const dx = goalX - bee.x;
      const dy = goalY - bee.y;
      const dist = Math.hypot(dx, dy) || 1;
      const desiredDist = wp ? 0 : BEE.HOVER_DISTANCE;
      const overshoot = dist - desiredDist;
      const dirX = dx / dist;
      const dirY = dy / dist;
      const intensity = wp
        ? 1
        : Math.tanh(Math.abs(overshoot) / 80) * Math.sign(overshoot);
      ax = dirX * BEE.ACCEL * intensity;
      ay = dirY * BEE.ACCEL * intensity;
      bee.facing = (target.x - bee.x) >= 0 ? 1 : -1;

      const tightness = wp ? 0.35 : 1;
      const wob = this._wobbleAccel(now, dirX, dirY, tightness);
      ax += wob.ax;
      ay += wob.ay;

      if (!wp) {
        const elapsed = (now - this.spawnedAt) / 1000;
        const bob = Math.sin(elapsed * BEE.BOB_FREQUENCY) * BEE.BOB_AMPLITUDE;
        ay += bob * 0.6;
      }
    } else {
      this.path = null;
      const t = (now - this.spawnedAt) / 1000;
      const wx = Math.cos(t * BEE.WANDER_FREQ_X + this.wobblePhase) * BEE.WANDER_FORCE;
      const wy = Math.sin(t * BEE.WANDER_FREQ_Y + this.wobblePhase * 1.7) * BEE.WANDER_FORCE * 0.55;
      ax = wx - bee.vx * BEE.DAMPING * 0.4;
      ay = wy - bee.vy * BEE.DAMPING * 0.4;
    }

    const sep = this._separationAccel();
    ax += sep.ax;
    ay += sep.ay;

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

    this._postMove();
  }

  _postMove() {
    this._clampToMap();
    this._resolveObstacleCollision();
    this._resolveBeeOverlap();
    if (this.attackState !== 'lunge') {
      this._resolvePlayerOverlap();
    }
    this._resolveObstacleCollision();
    this._clampToMap();
  }

  _wobbleAccel(now, dirX, dirY, tightness) {
    const phase = this.wobblePhase + (now / 1000) * BEE.WOBBLE_FREQUENCY * this.wobbleFreqJitter;
    const sway = Math.sin(phase);
    const perpX = -dirY;
    const perpY = dirX;
    const amp = BEE.WOBBLE_AMPLITUDE * tightness;
    return { ax: perpX * sway * amp, ay: perpY * sway * amp };
  }

  _separationAccel() {
    const others = this.room.bees;
    if (!others || others.size <= 1) return { ax: 0, ay: 0 };
    const bee = this.bee;
    const radius = BEE.SEPARATION_RADIUS;
    const radiusSq = radius * radius;
    let ax = 0;
    let ay = 0;
    others.forEach((ctrl) => {
      if (ctrl === this) return;
      const o = ctrl.bee;
      if (!o || !o.alive) return;
      const dx = bee.x - o.x;
      const dy = bee.y - o.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < 1 || d2 > radiusSq) return;
      const d = Math.sqrt(d2);
      const k = 1 - d / radius;
      ax += (dx / d) * k * BEE.SEPARATION_FORCE;
      ay += (dy / d) * k * BEE.SEPARATION_FORCE;
    });
    return { ax, ay };
  }

  _resolvePlayerOverlap() {
    const bee = this.bee;
    const now = Date.now();
    const minDX = HALF_W + PLAYER.WIDTH / 2;
    const minDY = HALF_H + PLAYER.HEIGHT / 2;
    this.room.state.players.forEach((p) => {
      if (p === bee) return;
      if (p.kind === 'bee') return;
      if (!p.alive) return;
      if (p.team === 0) return;
      if (p.spawnProtectionUntil && now < p.spawnProtectionUntil) return;
      const dx = bee.x - p.x;
      const dy = bee.y - p.y;
      const overlapX = minDX - Math.abs(dx);
      const overlapY = minDY - Math.abs(dy);
      if (overlapX <= 0 || overlapY <= 0) return;
      if (overlapX < overlapY) {
        const sign = dx >= 0 ? 1 : -1;
        bee.x += sign * overlapX;
        if ((sign > 0 && bee.vx < 0) || (sign < 0 && bee.vx > 0)) bee.vx = 0;
      } else {
        const sign = dy >= 0 ? 1 : -1;
        bee.y += sign * overlapY;
        if ((sign > 0 && bee.vy < 0) || (sign < 0 && bee.vy > 0)) bee.vy = 0;
      }
    });
  }

  _resolveBeeOverlap() {
    const others = this.room.bees;
    if (!others || others.size <= 1) return;
    const bee = this.bee;
    const minDist = BEE.WIDTH;
    others.forEach((ctrl) => {
      if (ctrl === this) return;
      const o = ctrl.bee;
      if (!o || !o.alive) return;
      const dx = bee.x - o.x;
      const dy = bee.y - o.y;
      const d2 = dx * dx + dy * dy;
      if (d2 >= minDist * minDist) return;
      const d = Math.sqrt(d2) || 0.001;
      const overlap = (minDist - d) * 0.5;
      const nx = dx / d;
      const ny = dy / d;
      bee.x += nx * overlap;
      bee.y += ny * overlap;
    });
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
    this.path = null;
  }

  _tickLunge(dt, now) {
    const bee = this.bee;
    bee.vx = this.lungeDirX * BEE.LUNGE_SPEED;
    bee.vy = this.lungeDirY * BEE.LUNGE_SPEED;
    bee.x += bee.vx * dt;
    bee.y += bee.vy * dt;

    if (this._isInsideAnyObstacle()) {
      const fallbackDir = this.lungeDirX >= 0 ? 1 : -1;
      this._beginRecover(now, fallbackDir);
      return;
    }

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

  _tickKnocked(dt, now) {
    const bee = this.bee;
    bee.vx -= bee.vx * BEE.DAMPING * dt * 0.7;
    bee.vy -= bee.vy * BEE.DAMPING * dt * 0.7;
    bee.x += bee.vx * dt;
    bee.y += bee.vy * dt;
    if (now - this.knockedStartedAt >= BEE.KNOCKED_MS) {
      this.attackState = 'idle';
      this.attackEndedAt = now;
    }
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

  _getObstacles() {
    if (this._obstaclesCache) return this._obstaclesCache;
    const map = this.room.map;
    const list = [];
    if (map.solidWalls) for (const w of map.solidWalls) list.push(w);
    if (map.walls) for (const w of map.walls) list.push(w);
    this._obstaclesCache = list;
    return list;
  }

  _isInsideAnyObstacle() {
    const bee = this.bee;
    const left = bee.x - HALF_W;
    const right = bee.x + HALF_W;
    const top = bee.y - HALF_H;
    const bottom = bee.y + HALF_H;
    for (const w of this._getObstacles()) {
      const wLeft = w.x - w.w / 2;
      const wRight = w.x + w.w / 2;
      const wTop = w.y - w.h / 2;
      const wBottom = w.y + w.h / 2;
      if (right > wLeft && left < wRight && bottom > wTop && top < wBottom) {
        return true;
      }
    }
    return false;
  }

  _resolveObstacleCollision() {
    const bee = this.bee;
    for (const w of this._getObstacles()) {
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

  _segmentHitsObstacles(x1, y1, x2, y2) {
    let best = null;
    for (const w of this._getObstacles()) {
      const left = w.x - w.w / 2 - HALF_W;
      const right = w.x + w.w / 2 + HALF_W;
      const top = w.y - w.h / 2 - HALF_H;
      const bottom = w.y + w.h / 2 + HALF_H;
      const hit = this._segmentVsAabb(x1, y1, x2, y2, left, top, right, bottom);
      if (hit && (!best || hit.t < best.t)) best = { wall: w, t: hit.t };
    }
    return best;
  }

  _segmentVsAabb(x1, y1, x2, y2, left, top, right, bottom) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    let tmin = 0;
    let tmax = 1;
    if (Math.abs(dx) < 1e-9) {
      if (x1 < left || x1 > right) return null;
    } else {
      const t1 = (left - x1) / dx;
      const t2 = (right - x1) / dx;
      tmin = Math.max(tmin, Math.min(t1, t2));
      tmax = Math.min(tmax, Math.max(t1, t2));
    }
    if (Math.abs(dy) < 1e-9) {
      if (y1 < top || y1 > bottom) return null;
    } else {
      const t1 = (top - y1) / dy;
      const t2 = (bottom - y1) / dy;
      tmin = Math.max(tmin, Math.min(t1, t2));
      tmax = Math.min(tmax, Math.max(t1, t2));
    }
    if (tmax < tmin || tmax < 0 || tmin > 1) return null;
    return { t: Math.max(0, tmin) };
  }

  _getNavGrid() {
    if (this.room.__beeNavGrid) return this.room.__beeNavGrid;
    const map = this.room.map;
    const cols = map.width;
    const rows = map.height;
    const blocked = new Uint8Array(cols * rows);
    const obstacles = this._getObstacles();
    for (let cy = 0; cy < rows; cy++) {
      for (let cx = 0; cx < cols; cx++) {
        const px = cx * TILE.WIDTH + TILE.WIDTH / 2;
        const py = cy * TILE.HEIGHT + TILE.HEIGHT / 2;
        const left = px - HALF_W;
        const right = px + HALF_W;
        const top = py - HALF_H;
        const bottom = py + HALF_H;
        let isBlocked = 0;
        for (const w of obstacles) {
          const wLeft = w.x - w.w / 2;
          const wRight = w.x + w.w / 2;
          const wTop = w.y - w.h / 2;
          const wBottom = w.y + w.h / 2;
          if (right > wLeft && left < wRight && bottom > wTop && top < wBottom) {
            isBlocked = 1;
            break;
          }
        }
        blocked[cy * cols + cx] = isBlocked;
      }
    }
    this.room.__beeNavGrid = { blocked, cols, rows };
    return this.room.__beeNavGrid;
  }

  _pxToCell(x, y) {
    return {
      cx: Math.max(0, Math.min(this._getNavGrid().cols - 1, Math.floor(x / TILE.WIDTH))),
      cy: Math.max(0, Math.min(this._getNavGrid().rows - 1, Math.floor(y / TILE.HEIGHT))),
    };
  }

  _cellToPx(cx, cy) {
    return {
      x: cx * TILE.WIDTH + TILE.WIDTH / 2,
      y: cy * TILE.HEIGHT + TILE.HEIGHT / 2,
    };
  }

  _findNearestFreeCell(cx, cy, maxRing = 6) {
    const grid = this._getNavGrid();
    if (!grid.blocked[cy * grid.cols + cx]) return { cx, cy };
    for (let r = 1; r <= maxRing; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
          const ncx = cx + dx;
          const ncy = cy + dy;
          if (ncx < 0 || ncy < 0 || ncx >= grid.cols || ncy >= grid.rows) continue;
          if (!grid.blocked[ncy * grid.cols + ncx]) return { cx: ncx, cy: ncy };
        }
      }
    }
    return null;
  }

  _maybeReplan(target, now) {
    const moved = Math.hypot(target.x - this.lastPlanTargetX, target.y - this.lastPlanTargetY);
    const stale = now - this.lastPathAt > PATH_REPLAN_MS;
    if (this.path && !stale && moved < TARGET_DRIFT_REPLAN) return;
    const aimY = target.y - PLAYER.HEIGHT * 0.4;
    const path = this._planPath(this.bee.x, this.bee.y, target.x, aimY);
    this.path = path;
    this.pathIndex = 0;
    this.lastPathAt = now;
    this.lastPlanTargetX = target.x;
    this.lastPlanTargetY = target.y;
  }

  _planPath(sx, sy, gx, gy) {
    const grid = this._getNavGrid();
    const startCell = this._pxToCell(sx, sy);
    const startFree = grid.blocked[startCell.cy * grid.cols + startCell.cx]
      ? this._findNearestFreeCell(startCell.cx, startCell.cy)
      : startCell;
    if (!startFree) return null;
    const goalCell = this._pxToCell(gx, gy);
    const goalFree = grid.blocked[goalCell.cy * grid.cols + goalCell.cx]
      ? this._findNearestFreeCell(goalCell.cx, goalCell.cy)
      : goalCell;
    if (!goalFree) return null;
    const cells = aStar(grid, startFree.cx, startFree.cy, goalFree.cx, goalFree.cy);
    if (!cells) return null;
    return cells.map((c) => this._cellToPx(c.cx, c.cy));
  }

  _currentWaypoint(targetX, targetY) {
    if (!this.path || this.path.length === 0) return null;
    const bee = this.bee;
    while (
      this.pathIndex < this.path.length - 1 &&
      Math.hypot(this.path[this.pathIndex].x - bee.x, this.path[this.pathIndex].y - bee.y) < WAYPOINT_REACH
    ) {
      this.pathIndex++;
    }
    let bestIdx = this.pathIndex;
    for (let i = this.path.length - 1; i > this.pathIndex; i--) {
      const wp = this.path[i];
      if (!this._segmentHitsObstacles(bee.x, bee.y, wp.x, wp.y)) {
        bestIdx = i;
        break;
      }
    }
    this.pathIndex = bestIdx;
    if (!this._segmentHitsObstacles(bee.x, bee.y, targetX, targetY)) return null;
    return this.path[bestIdx];
  }
}

function aStar(grid, startCx, startCy, goalCx, goalCy) {
  if (startCx === goalCx && startCy === goalCy) {
    return [{ cx: startCx, cy: startCy }];
  }
  const cols = grid.cols;
  const rows = grid.rows;
  const blocked = grid.blocked;

  const heuristic = (cx, cy) => {
    const dx = Math.abs(cx - goalCx);
    const dy = Math.abs(cy - goalCy);
    return Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy);
  };

  const open = new Map();
  const closed = new Set();
  const startKey = startCy * cols + startCx;
  open.set(startKey, {
    cx: startCx,
    cy: startCy,
    g: 0,
    h: heuristic(startCx, startCy),
    parent: null,
  });
  open.get(startKey).f = open.get(startKey).h;

  const dirs = [
    [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
    [1, 1, Math.SQRT2], [1, -1, Math.SQRT2],
    [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2],
  ];

  let iter = 0;
  while (open.size > 0 && iter < ASTAR_MAX_NODES) {
    iter++;
    let bestKey = null;
    let bestNode = null;
    for (const [k, n] of open) {
      if (!bestNode || n.f < bestNode.f) {
        bestNode = n;
        bestKey = k;
      }
    }
    if (!bestNode) break;
    open.delete(bestKey);
    closed.add(bestKey);

    if (bestNode.cx === goalCx && bestNode.cy === goalCy) {
      const path = [];
      let cur = bestNode;
      while (cur) {
        path.push({ cx: cur.cx, cy: cur.cy });
        cur = cur.parent;
      }
      path.reverse();
      return path;
    }

    for (const [dx, dy, cost] of dirs) {
      const ncx = bestNode.cx + dx;
      const ncy = bestNode.cy + dy;
      if (ncx < 0 || ncy < 0 || ncx >= cols || ncy >= rows) continue;
      const nKey = ncy * cols + ncx;
      if (blocked[nKey]) continue;
      if (dx !== 0 && dy !== 0) {
        if (blocked[bestNode.cy * cols + ncx]) continue;
        if (blocked[ncy * cols + bestNode.cx]) continue;
      }
      if (closed.has(nKey)) continue;
      const tentativeG = bestNode.g + cost;
      const existing = open.get(nKey);
      if (existing && existing.g <= tentativeG) continue;
      open.set(nKey, {
        cx: ncx,
        cy: ncy,
        g: tentativeG,
        h: heuristic(ncx, ncy),
        f: tentativeG + heuristic(ncx, ncy),
        parent: bestNode,
      });
    }
  }
  return null;
}
