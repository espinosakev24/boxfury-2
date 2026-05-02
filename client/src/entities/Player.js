import { ARROW, BOW, HIT, PLAYER } from '@boxfury/shared';
import { Bow } from './Bow.js';

export class Player {
  constructor(scene, { id, x, y, color = 0x4ade80 }) {
    this.scene = scene;
    this.id = id;
    this.color = color;
    this.facing = 1;
    this.charging = false;
    this.carryingFlag = false;
    this.inputLockedUntil = 0;
    this.sprite = scene.add.rectangle(x, y, PLAYER.WIDTH, PLAYER.HEIGHT, color);
    scene.physics.add.existing(this.sprite);
    this.sprite.body.setCollideWorldBounds(true);
    this.bow = new Bow(scene, this);
  }

  move({ left, right }) {
    if (performance.now() < this.inputLockedUntil) return;
    const vx = (right ? 1 : 0) - (left ? 1 : 0);
    const speed = this.carryingFlag ? PLAYER.CARRY_SPEED : PLAYER.SPEED;
    this.sprite.body.setVelocityX(vx * speed);
    if (vx !== 0) this.facing = vx;
  }

  applyKnockback(vx, vy) {
    this.sprite.body.setVelocity(vx, vy);
    this.inputLockedUntil = performance.now() + HIT.INPUT_LOCK_MS;
    this.charging = false;
    this.bow.setAngle(BOW.MIN_ANGLE);
  }

  flashHit() {
    const sprite = this.sprite;
    if (!sprite?.active) return;
    const original = this.color;
    sprite.setFillStyle(0xffffff);
    this.scene.time.delayedCall(HIT.FLASH_MS, () => {
      if (sprite.active) sprite.setFillStyle(original);
    });
    this.scene.tweens.add({
      targets: sprite,
      scaleX: 1.25,
      scaleY: 0.8,
      duration: 90,
      yoyo: true,
      ease: 'Cubic.easeOut',
    });
  }

  setCarryingFlag(carrying) {
    this.carryingFlag = carrying;
    if (carrying) {
      this.charging = false;
      this.bow.setAngle(BOW.MIN_ANGLE);
    }
    this.bow.sprite.setVisible(!carrying);
  }

  jump() {
    if (this.sprite.body.blocked.down || this.sprite.body.touching.down) {
      this.sprite.body.setVelocityY(-PLAYER.JUMP_SPEED);
    }
  }

  chargeBow() {
    if (this.carryingFlag) return;
    this.charging = true;
  }

  releaseBow() {
    if (this.carryingFlag || !this.charging) return null;
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
