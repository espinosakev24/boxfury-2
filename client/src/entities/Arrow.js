import { ARROW } from '@boxfury/shared';

export class Arrow {
  constructor(scene, { x, y, vx, vy }) {
    this.scene = scene;
    this.alive = true;
    this.deadAt = performance.now() + ARROW.LIFETIME_MS;
    this.sprite = scene.add.rectangle(x, y, ARROW.LENGTH, ARROW.THICKNESS, 0xffffff);
    scene.physics.add.existing(this.sprite);
    this.sprite.body.setVelocity(vx, vy);
    this.sprite.rotation = Math.atan2(vy, vx);
  }

  update() {
    if (!this.alive) return;
    if (performance.now() >= this.deadAt) {
      this.destroy();
      return;
    }
    const { x: vx, y: vy } = this.sprite.body.velocity;
    this.sprite.rotation = Math.atan2(vy, vx);
  }

  destroy() {
    if (!this.alive) return;
    this.alive = false;
    this.sprite.destroy();
  }
}
