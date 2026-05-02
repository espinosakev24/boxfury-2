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

    this.sprite = scene.add.rectangle(state.x, state.y, ARROW.LENGTH, ARROW.THICKNESS, 0xffffff);
    this.sprite.setOrigin(1, 0.5);
    this.sprite.rotation = Math.atan2(state.vy, state.vx);
  }

  applyState(state) {
    this.stuck = !!state.stuck;
    if (this.stuck) {
      this.x = state.x;
      this.y = state.y;
      this.vx = 0;
      this.vy = 0;
      this.sprite.setPosition(state.x, state.y);
      return;
    }
    const dx = state.x - this.x;
    const dy = state.y - this.y;
    const drift = Math.hypot(dx, dy);
    if (drift > 60) {
      this.x = state.x;
      this.y = state.y;
    }
    this.vx = state.vx;
    this.vy = state.vy;
  }

  update(dt) {
    if (this.stuck) return;
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
