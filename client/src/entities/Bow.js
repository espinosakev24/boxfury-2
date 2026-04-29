import { BOW } from '@boxfury/shared';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export class Bow {
  constructor(scene, owner) {
    this.scene = scene;
    this.owner = owner;
    this.angle = BOW.MIN_ANGLE;
    this.sprite = scene.add.rectangle(0, 0, BOW.LENGTH, BOW.THICKNESS, 0xffffff);
    this.sprite.setOrigin(0, 0.5);
  }

  setAngle(deg) {
    this.angle = clamp(deg, BOW.MIN_ANGLE, BOW.MAX_ANGLE);
  }

  getRotation() {
    const dirRad = ((90 - this.angle) * Math.PI) / 180;
    return this.owner.facing > 0 ? dirRad : Math.PI - dirRad;
  }

  update() {
    this.sprite.x = this.owner.sprite.x;
    this.sprite.y = this.owner.sprite.y;
    const dirRad = ((90 - this.angle) * Math.PI) / 180;
    this.sprite.rotation = this.owner.facing > 0 ? dirRad : Math.PI - dirRad;
  }

  destroy() {
    this.sprite.destroy();
  }
}
