import { ARROW, PHYSICS } from '@boxfury/shared';

const TRAIL_MAX = 8;
const TRAIL_INTERVAL_MS = 22;
const TRAIL_LIFETIME_MS = 220;
const STUCK_VIBRATE_MS = 240;

export class Arrow {
  constructor(scene, state) {
    this.scene = scene;
    this.shooterId = state.shooterId;
    this.x = state.x;
    this.y = state.y;
    this.vx = state.vx;
    this.vy = state.vy;
    this.stuck = !!state.stuck;
    this.stuckToId = state.stuckToId || '';
    this.stuckOffsetX = state.stuckOffsetX || 0;
    this.stuckOffsetY = state.stuckOffsetY || 0;
    this.stuckFacing = state.stuckFacing || 1;
    this.stuckRotation = 0;
    this._stuckAt = 0;
    this._lastTrailAt = 0;
    this._trail = [];

    this.trailGfx = scene.add.graphics();
    this.sprite = scene.add.rectangle(state.x, state.y, ARROW.LENGTH, ARROW.THICKNESS, 0xffffff);
    this.sprite.setOrigin(1, 0.5);
    this.sprite.rotation = Math.atan2(state.vy, state.vx);

    if (this.stuck) {
      this.stuckRotation = this.sprite.rotation;
      this.snapToAnchor();
    }
  }

  applyState(state) {
    const wasStuck = this.stuck;
    this.stuck = !!state.stuck;

    if (this.stuck && !wasStuck) {
      this.stuckToId = state.stuckToId || '';
      this.stuckOffsetX = state.stuckOffsetX || 0;
      this.stuckOffsetY = state.stuckOffsetY || 0;
      this.stuckFacing = state.stuckFacing || 1;
      this.stuckRotation = this.sprite.rotation;
      const hitVx = this.vx;
      const hitVy = this.vy;
      this.x = state.x;
      this.y = state.y;
      this.vx = 0;
      this.vy = 0;
      this.snapToAnchor();
      if (!this.stuckToId) {
        this._stuckAt = performance.now();
        this.scene.spawnArrowSplash?.(state.x, state.y, hitVx, hitVy);
      }
      this._trail.length = 0;
      this.trailGfx?.clear();
      return;
    }

    if (this.stuck) return;

    const dx = state.x - this.x;
    const dy = state.y - this.y;
    if (Math.hypot(dx, dy) > 60) {
      this.x = state.x;
      this.y = state.y;
    }
    this.vx = state.vx;
    this.vy = state.vy;
  }

  snapToAnchor() {
    if (this.stuckToId) {
      const target = this.scene.findPlayer?.(this.stuckToId);
      if (target?.sprite) {
        const flip = (target.facing || 1) !== this.stuckFacing ? -1 : 1;
        this.sprite.setPosition(
          target.sprite.x + this.stuckOffsetX * flip,
          target.sprite.y + this.stuckOffsetY,
        );
        this.sprite.rotation = flip === -1 ? Math.PI - this.stuckRotation : this.stuckRotation;
        return;
      }
    }
    this.sprite.setPosition(this.x, this.y);
  }

  update(dt) {
    if (this._destroyed) return;
    if (this.stuck) {
      this.snapToAnchor();
      this._applyStuckVibration();
      return;
    }
    this.vy += PHYSICS.GRAVITY * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.sprite.setPosition(this.x, this.y);
    this.sprite.rotation = Math.atan2(this.vy, this.vx);
    this._updateTrail();
  }

  _updateTrail() {
    const now = performance.now();
    if (now - this._lastTrailAt >= TRAIL_INTERVAL_MS) {
      this._trail.push({ x: this.x, y: this.y, t: now });
      this._lastTrailAt = now;
      if (this._trail.length > TRAIL_MAX) this._trail.shift();
    }
    const gfx = this.trailGfx;
    if (!gfx) return;
    gfx.clear();
    for (const p of this._trail) {
      const age = now - p.t;
      if (age > TRAIL_LIFETIME_MS) continue;
      const a = 1 - age / TRAIL_LIFETIME_MS;
      gfx.fillStyle(0xffffff, a * 0.55);
      gfx.fillRect(Math.round(p.x) - 1, Math.round(p.y) - 1, 2, 2);
    }
  }

  _applyStuckVibration() {
    if (!this._stuckAt) return;
    const elapsed = performance.now() - this._stuckAt;
    if (elapsed > STUCK_VIBRATE_MS) return;
    const t = elapsed / 1000;
    const decay = Math.exp(-elapsed / 80);
    const wobble = Math.sin(t * 60) * 2 * decay;
    const perpX = -Math.sin(this.sprite.rotation);
    const perpY = Math.cos(this.sprite.rotation);
    this.sprite.x += wobble * perpX;
    this.sprite.y += wobble * perpY;
  }

  destroy() {
    if (this._destroyed) return;
    this._destroyed = true;
    const sprite = this.sprite;
    const trail = this.trailGfx;
    this.sprite = null;
    this.trailGfx = null;
    if (sprite?.active) {
      this.scene.tweens.add({
        targets: sprite,
        alpha: 0,
        duration: 150,
        ease: 'Cubic.easeOut',
        onComplete: () => sprite.destroy(),
      });
    } else {
      sprite?.destroy?.();
    }
    if (trail?.active) {
      this.scene.tweens.add({
        targets: trail,
        alpha: 0,
        duration: 150,
        onComplete: () => trail.destroy(),
      });
    } else {
      trail?.destroy?.();
    }
  }
}
