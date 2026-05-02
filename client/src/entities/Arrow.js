import { ARROW, PHYSICS } from '@boxfury/shared';

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
      this.x = state.x;
      this.y = state.y;
      this.vx = 0;
      this.vy = 0;
      this.snapToAnchor();
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
    if (this.stuck) {
      this.snapToAnchor();
      return;
    }
    this.vy += PHYSICS.GRAVITY * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.sprite.setPosition(this.x, this.y);
    this.sprite.rotation = Math.atan2(this.vy, this.vx);
  }

  destroy() {
    this.sprite.destroy();
  }
}
