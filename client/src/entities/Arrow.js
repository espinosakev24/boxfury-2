import { ARROW, GRAVITY, WORLD } from '@boxfury/shared';

const lerp = (a, b, t) => a + (b - a) * t;

export class Arrow {
  constructor(scene, { x, y, rotation = 0, vx = 0, vy = 0, local = false }) {
    this.scene = scene;
    this.local = local;
    this.alive = true;
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.targetX = x;
    this.targetY = y;
    this.targetRotation = rotation;
    this.deadAt = performance.now() + ARROW.LIFETIME_MS;
    this.sprite = scene.add.rectangle(x, y, ARROW.LENGTH, ARROW.THICKNESS, 0xffffff).setDepth(6);
    this.sprite.rotation = rotation;
  }

  applyState({ x, y, rotation }) {
    this.targetX = x;
    this.targetY = y;
    this.targetRotation = rotation;
  }

  update(dt) {
    if (!this.alive) return;
    if (this.local) {
      this.vy += GRAVITY * 0.6 * dt;
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      this.sprite.x = this.x;
      this.sprite.y = this.y;
      this.sprite.rotation = Math.atan2(this.vy, this.vx);
      if (
        performance.now() >= this.deadAt
        || this.y > WORLD.HEIGHT + 200
        || this.x < -200 || this.x > WORLD.WIDTH + 200
      ) {
        this.destroy();
      }
    } else {
      this.sprite.x = lerp(this.sprite.x, this.targetX, 0.5);
      this.sprite.y = lerp(this.sprite.y, this.targetY, 0.5);
      this.sprite.rotation = this.targetRotation;
    }
  }

  destroy() {
    if (!this.alive) return;
    this.alive = false;
    this.sprite.destroy();
  }
}
