import { PLAYER } from '@boxfury/shared';

export class Player {
  constructor(scene, { x, y, color = 0x4ade80 }) {
    this.scene = scene;
    this.facing = 1;
    this.sprite = scene.add.rectangle(x, y, PLAYER.SIZE, PLAYER.SIZE, color);
    scene.physics.add.existing(this.sprite);
    this.sprite.body.setCollideWorldBounds(true);
  }

  move({ left, right }) {
    const vx = (right ? 1 : 0) - (left ? 1 : 0);
    this.sprite.body.setVelocityX(vx * PLAYER.SPEED);
    if (vx !== 0) this.facing = vx;
  }

  jump() {
    if (this.sprite.body.blocked.down || this.sprite.body.touching.down) {
      this.sprite.body.setVelocityY(-PLAYER.JUMP_SPEED);
    }
  }

  getState() {
    const b = this.sprite.body;
    return {
      x: this.sprite.x,
      y: this.sprite.y,
      vx: b.velocity.x,
      vy: b.velocity.y,
      facing: this.facing,
    };
  }

  destroy() {
    this.sprite.destroy();
  }
}
