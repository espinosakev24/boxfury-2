import { ARROW, BOW, PLAYER } from '@boxfury/shared';
import { Bow } from './Bow.js';

export class Player {
  constructor(scene, { x, y, color = 0x4ade80 }) {
    this.scene = scene;
    this.facing = 1;
    this.charging = false;
    this.sprite = scene.add.rectangle(x, y, PLAYER.WIDTH, PLAYER.HEIGHT, color);
    scene.physics.add.existing(this.sprite);
    this.sprite.body.setCollideWorldBounds(true);
    this.bow = new Bow(scene, this);
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

  chargeBow() {
    this.charging = true;
  }

  releaseBow() {
    if (!this.charging) return null;
    this.charging = false;
    const rot = this.bow.getRotation();
    const cos = Math.cos(rot);
    const sin = Math.sin(rot);
    const shot = {
      x: this.sprite.x + cos * BOW.LENGTH,
      y: this.sprite.y + sin * BOW.LENGTH,
      vx: cos * ARROW.SPEED,
      vy: sin * ARROW.SPEED,
    };
    this.bow.setAngle(BOW.MIN_ANGLE);
    return shot;
  }

  update(dt) {
    if (this.charging) {
      this.bow.setAngle(this.bow.angle + BOW.CHARGE_RATE * dt);
    } else {
      this.bow.setAngle(BOW.MIN_ANGLE);
    }
    this.bow.update();
  }

  getState() {
    const b = this.sprite.body;
    return {
      x: this.sprite.x,
      y: this.sprite.y,
      vx: b.velocity.x,
      vy: b.velocity.y,
      facing: this.facing,
      bowAngle: this.bow.angle,
    };
  }

  destroy() {
    this.bow.destroy();
    this.sprite.destroy();
  }
}
