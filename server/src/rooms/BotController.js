import {
  ARROW,
  BOT,
  BOW,
  PHYSICS,
  PLAYER,
} from '@boxfury/shared';
import { Arrow } from '../schemas/Arrow.js';

const HALF_W = PLAYER.WIDTH / 2;
const HALF_H = PLAYER.HEIGHT / 2;
const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;
const JUMP_PEAK =
  (PLAYER.JUMP_SPEED * PLAYER.JUMP_SPEED) / (2 * PHYSICS.GRAVITY);

export class BotController {
  constructor(room, sessionId, player) {
    this.room = room;
    this.sessionId = sessionId;
    this.player = player;
    this.inputX = 0;
    this.wantJump = false;
    this.grounded = false;
    this.charging = false;
    this.chargeStartAt = 0;
    this.chargeTargetMs = 0;
    this.lastShotAt = 0;
    this.lastJumpAt = 0;
    this.nextThinkAt = 0;
    this.nextStrafeAt = 0;
    this.strafeBias = 0;
    this.mode = 'engage';
    this.climbTarget = null;
  }

  findTarget() {
    let best = null;
    let bestDist = Infinity;
    this.room.state.players.forEach((p) => {
      if (p === this.player) return;
      if (!p.alive) return;
      if (p.team !== 0 && p.team === this.player.team) return;
      const d = Math.hypot(p.x - this.player.x, p.y - this.player.y);
      if (d < bestDist) {
        best = p;
        bestDist = d;
      }
    });
    return best;
  }

  tick(dt, now) {
    if (!this.player.alive) {
      this.charging = false;
      this.player.bowAngle = BOW.MIN_ANGLE;
      this.player.vx = 0;
      this.player.vy = 0;
      return;
    }

    if (now >= this.nextThinkAt) {
      this._think(now);
      this.nextThinkAt = now + 1000 / BOT.THINK_HZ;
    }

    this._stepCharge(dt, now);
    this._stepPhysics(dt);
  }

  _think(now) {
    const target = this.findTarget();
    if (!target) {
      this.inputX = 0;
      this.wantJump = false;
      this.charging = false;
      this.climbTarget = null;
      return;
    }

    const dx = target.x - this.player.x;
    const dy = target.y - this.player.y;
    const absDx = Math.abs(dx);
    this.player.facing = dx >= 0 ? 1 : -1;

    if (now >= this.nextStrafeAt) {
      this.strafeBias = Math.random() < 0.5 ? -1 : 1;
      this.nextStrafeAt =
        now + BOT.STRAFE_DECISION_MS * (0.7 + Math.random() * 0.6);
    }

    const targetFootY = target.y + HALF_H;
    const botFootY = this.player.y + HALF_H;
    const altitudeGap = botFootY - targetFootY;
    const wantsHighGround = altitudeGap < -PLAYER.HEIGHT * 0.6;

    let climb = null;
    if (wantsHighGround) {
      climb = this._findClimbTarget(target);
    }
    this.climbTarget = climb;

    if (climb) {
      this.mode = 'climb';
      this._driveClimb(climb, target, now);
    } else {
      this.mode = 'engage';
      this._driveEngage(dx, absDx, now);
    }

    if (this.player.x < 60) this.inputX = 1;
    else if (this.player.x > this.room.map.pixelWidth - 60) this.inputX = -1;

    if (this.player.spawnProtectionUntil && Date.now() < this.player.spawnProtectionUntil) {
      this.charging = false;
      return;
    }

    if (this.mode === 'engage') this._maybeStartCharge(dx, dy, now);
    if (this.charging) this._aimAt(target);
  }

  _driveEngage(dx, absDx, now) {
    if (absDx > BOT.IDEAL_GAP + 30) {
      this.inputX = Math.sign(dx);
    } else if (absDx < BOT.IDEAL_GAP - 30) {
      this.inputX = -Math.sign(dx);
    } else {
      this.inputX = this.strafeBias;
    }

    if (
      this.grounded &&
      now - this.lastJumpAt > BOT.JUMP_COOLDOWN_MS &&
      this._shouldHopForwardLedge()
    ) {
      this.wantJump = true;
    }
  }

  _driveClimb(climb, target, now) {
    const bx = this.player.x;
    const reach = jumpReach(climb.dyUp);
    const closestX = clamp(bx, climb.left + 4, climb.right - 4);
    const horizDist = Math.abs(closestX - bx);
    const inLaunchZone = reach && horizDist <= reach.horizontal * 0.85;

    if (horizDist < 2) {
      this.inputX = Math.sign(target.x - bx) || 1;
    } else {
      this.inputX = Math.sign(closestX - bx);
    }

    if (
      this.grounded &&
      inLaunchZone &&
      now - this.lastJumpAt > BOT.JUMP_COOLDOWN_MS
    ) {
      this.wantJump = true;
    }

    this.charging = false;
  }

  _maybeStartCharge(dx, dy, now) {
    const dist = Math.hypot(dx, dy);
    const inRange =
      dist < BOT.SHOOT_RANGE &&
      Math.abs(dy) < BOT.SHOOT_VERT_TOLERANCE * 1.6;
    if (
      !this.charging &&
      inRange &&
      now - this.lastShotAt > ARROW.COOLDOWN_MS + BOT.REACTION_MS
    ) {
      this.charging = true;
      this.chargeStartAt = now;
      this.chargeTargetMs =
        BOT.CHARGE_TIME_MS + (Math.random() * 2 - 1) * BOT.CHARGE_VARIANCE_MS;
    }
  }

  _shouldHopForwardLedge() {
    const p = this.player;
    if (this.inputX === 0) return false;
    const probeX = p.x + this.inputX * (HALF_W + 6);
    if (probeX <= HALF_W || probeX >= this.room.map.pixelWidth - HALF_W) return false;
    const botFoot = p.y + HALF_H;
    for (const wall of this.room.map.walls) {
      const top = wall.y - wall.h / 2;
      const left = wall.x - wall.w / 2;
      const right = wall.x + wall.w / 2;
      if (probeX <= left || probeX >= right) continue;
      const dyUp = botFoot - top;
      if (dyUp < 4) continue;
      if (dyUp > JUMP_PEAK - 8) continue;
      const reach = jumpReach(dyUp);
      if (!reach) continue;
      return Math.random() < 0.85;
    }
    return false;
  }

  _findClimbTarget(target) {
    const bx = this.player.x;
    const botFoot = this.player.y + HALF_H;
    const targetFoot = target.y + HALF_H;
    const dirToTarget = Math.sign(target.x - bx) || 1;

    let best = null;
    let bestScore = -Infinity;

    for (const wall of this.room.map.walls) {
      const top = wall.y - wall.h / 2;
      const left = wall.x - wall.w / 2;
      const right = wall.x + wall.w / 2;
      const dyUp = botFoot - top;
      if (dyUp < 6) continue;
      if (dyUp > JUMP_PEAK - 4) continue;

      const reach = jumpReach(dyUp);
      if (!reach) continue;

      const closestX = clamp(bx, left, right);
      const horizDist = Math.abs(closestX - bx);
      const horizBudget = reach.horizontal + HALF_W * 0.5;
      if (horizDist > horizBudget) continue;

      const altitudeGain = botFoot - top;
      const altitudeOvershoot = Math.max(0, top - targetFoot - PLAYER.HEIGHT);
      const platformCenter = (left + right) / 2;
      const platformDir = Math.sign(platformCenter - bx);
      const dirAlign =
        platformDir === 0 || platformDir === dirToTarget ? 60 : -25;
      const reachEase = (1 - horizDist / Math.max(1, horizBudget)) * 30;

      const score =
        altitudeGain - altitudeOvershoot * 1.2 + dirAlign + reachEase;

      if (score > bestScore) {
        bestScore = score;
        best = { top, left, right, dyUp };
      }
    }

    return best;
  }

  _aimAt(target) {
    const dx = target.x - this.player.x;
    const dy = target.y - this.player.y;
    const angleDeg = solveLaunchAngleDeg(dx, dy);
    if (angleDeg == null) {
      this.player.bowAngle = clampDeg(BOW.MIN_ANGLE);
      return;
    }
    const noise = (Math.random() * 2 - 1) * BOT.AIM_NOISE_DEG;
    this.player.bowAngle = clampDeg(angleDeg + noise);
  }

  _stepCharge(dt, now) {
    if (!this.charging) {
      this.player.bowAngle = BOW.MIN_ANGLE;
      return;
    }
    if (now - this.chargeStartAt >= this.chargeTargetMs) {
      this._fire(now);
    }
  }

  _fire(now) {
    this.charging = false;
    if (now - this.lastShotAt < ARROW.COOLDOWN_MS) return;
    this.lastShotAt = now;
    this.player.spawnProtectionUntil = 0;

    const angle = this.player.bowAngle;
    const facing = this.player.facing;
    const dirRad = (90 - angle) * RAD;
    const rot = facing > 0 ? dirRad : Math.PI - dirRad;
    const cos = Math.cos(rot);
    const sin = Math.sin(rot);

    const arrow = new Arrow();
    arrow.x = this.player.x + cos * BOW.LENGTH;
    arrow.y = this.player.y + sin * BOW.LENGTH;
    arrow.vx = cos * ARROW.SPEED;
    arrow.vy = sin * ARROW.SPEED;
    arrow.shooterId = this.sessionId;
    arrow.shooterTeam = this.player.team || 0;
    arrow.spawnedAt = now;
    const id = `${this.sessionId}-${++this.room.arrowSeq}`;
    this.room.state.arrows.set(id, arrow);
    this.player.bowAngle = BOW.MIN_ANGLE;
  }

  _stepPhysics(dt) {
    const p = this.player;
    p.vx = this.inputX * PLAYER.SPEED;

    if (this.wantJump && this.grounded) {
      p.vy = -PLAYER.JUMP_SPEED;
      this.grounded = false;
      this.lastJumpAt = Date.now();
    }
    this.wantJump = false;

    p.vy += PHYSICS.GRAVITY * dt;

    const map = this.room.map;
    const prevBottom = p.y + HALF_H;
    p.x += p.vx * dt;
    p.x = clamp(p.x, HALF_W, map.pixelWidth - HALF_W);
    p.y += p.vy * dt;

    let landed = false;

    if (p.vy >= 0) {
      for (const wall of map.walls) {
        const wTop = wall.y - wall.h / 2;
        const wLeft = wall.x - wall.w / 2;
        const wRight = wall.x + wall.w / 2;
        if (p.x + HALF_W <= wLeft || p.x - HALF_W >= wRight) continue;
        const newBottom = p.y + HALF_H;
        if (prevBottom <= wTop + 2 && newBottom >= wTop) {
          p.y = wTop - HALF_H;
          p.vy = 0;
          landed = true;
          break;
        }
      }
    }

    if (!landed && p.y + HALF_H >= map.pixelHeight) {
      p.y = map.pixelHeight - HALF_H;
      p.vy = 0;
      landed = true;
    }

    this.grounded = landed;
  }
}

function jumpReach(dyUp) {
  const j = PLAYER.JUMP_SPEED;
  const g = PHYSICS.GRAVITY;
  const disc = j * j - 2 * g * dyUp;
  if (disc < 0) return null;
  const t = (j + Math.sqrt(disc)) / g;
  return { t, horizontal: PLAYER.SPEED * t };
}

function solveLaunchAngleDeg(dx, dy) {
  const s = ARROW.SPEED;
  const g = PHYSICS.GRAVITY;
  const absDx = Math.abs(dx);
  if (absDx < 1) return dy < 0 ? 90 : -45;
  const a = (g * absDx * absDx) / (2 * s * s);
  const b = -absDx;
  const c = a + dy;
  const disc = b * b - 4 * a * c;
  if (disc < 0) return null;
  const sqrtDisc = Math.sqrt(disc);
  const u1 = (-b - sqrtDisc) / (2 * a);
  const u2 = (-b + sqrtDisc) / (2 * a);
  const u = Math.abs(u1) < Math.abs(u2) ? u1 : u2;
  const elevDeg = Math.atan(u) * DEG;
  return 90 + elevDeg;
}

function clampDeg(v) {
  if (v < BOW.MIN_ANGLE) return BOW.MIN_ANGLE;
  if (v > BOW.MAX_ANGLE) return BOW.MAX_ANGLE;
  return v;
}

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}
