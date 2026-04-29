import { ARROW } from '@boxfury/shared';

export class Arrow {
  constructor(scene, { x, y, vx, vy, shooterId = null }) {
    this.scene = scene;
    this.alive = true;
    this.stuck = false;
    this.shooterId = shooterId;
    this.attachedTo = null;
    this.attachOffset = { x: 0, y: 0 };
    this.attachRotation = 0;
    this.deadAt = performance.now() + ARROW.LIFETIME_MS;
    this.sprite = scene.add.rectangle(x, y, ARROW.LENGTH, ARROW.THICKNESS, 0xffffff);
    scene.physics.add.existing(this.sprite);
    this.sprite.body.setVelocity(vx, vy);
    this.sprite.rotation = Math.atan2(vy, vx);
  }

  stickTo(target = null) {
    if (this.stuck) return;
    this.stuck = true;
    const body = this.sprite.body;
    // Snap visual to the body's post-step position; the sprite is one frame behind
    // because Phaser syncs sprite.x in postUpdate, which runs after this callback.
    this.sprite.x = body.center.x;
    this.sprite.y = body.center.y;
    body.setVelocity(0, 0);
    body.setAllowGravity(false);
    if (target) {
      this.attachedTo = target;
      this.attachOffset = {
        x: this.sprite.x - target.sprite.x,
        y: this.sprite.y - target.sprite.y,
      };
    }
    this.attachRotation = this.sprite.rotation;
    body.enable = false;
  }

  update() {
    if (!this.alive) return;
    if (performance.now() >= this.deadAt) {
      this.destroy();
      return;
    }
    if (this.stuck) {
      if (this.attachedTo && this.attachedTo.sprite?.active) {
        this.sprite.x = this.attachedTo.sprite.x + this.attachOffset.x;
        this.sprite.y = this.attachedTo.sprite.y + this.attachOffset.y;
      }
      this.sprite.rotation = this.attachRotation;
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
