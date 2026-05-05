import { BOW } from '@boxfury/shared';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

const ARC_STEPS = 14;
const ARC_BULGE = 5;
const ARC_CHORD = BOW.LENGTH * 0.7;
const ARC_CENTER_X = BOW.LENGTH * 0.5;

export class Bow {
  constructor(scene, owner) {
    this.scene = scene;
    this.owner = owner;
    this.angle = BOW.MIN_ANGLE;
    this._stringOvershoot = 0;
    this.sprite = scene.add.graphics();
    this._draw();
  }

  triggerSnap() {
    this._stringOvershoot = 0.45;
    this.scene.tweens.add({
      targets: this,
      _stringOvershoot: 0,
      duration: 160,
      ease: 'Sine.easeOut',
    });
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
    this.sprite.y = this.owner.sprite.y + (this.owner._bobY ?? 0);
    this.sprite.rotation = this.getRotation();
    this._draw();
  }

  _draw() {
    const gfx = this.sprite;
    gfx.clear();
    const range = BOW.MAX_ANGLE - BOW.MIN_ANGLE;
    const pull = range > 0 ? Math.max(0, Math.min(1, (this.angle - BOW.MIN_ANGLE) / range)) : 0;

    gfx.lineStyle(1, 0xffffff, 0.35);
    gfx.beginPath();
    gfx.moveTo(0, 0);
    gfx.lineTo(BOW.LENGTH, 0);
    gfx.strokePath();

    gfx.lineStyle(2, 0xffffff, 1);
    gfx.beginPath();
    for (let i = 0; i <= ARC_STEPS; i++) {
      const t = i / ARC_STEPS;
      const a = Math.PI * (t - 0.5);
      const y = (ARC_CHORD / 2) * Math.sin(a);
      const x = ARC_CENTER_X + ARC_BULGE * Math.cos(a);
      if (i === 0) gfx.moveTo(x, y);
      else gfx.lineTo(x, y);
    }
    gfx.strokePath();

    const STRING_PULL_MAX = ARC_BULGE + 5;
    const effectivePull = pull - (this._stringOvershoot ?? 0);
    const midX = ARC_CENTER_X - effectivePull * STRING_PULL_MAX;
    gfx.lineStyle(1, 0xffffff, 0.85);
    gfx.beginPath();
    gfx.moveTo(ARC_CENTER_X, -ARC_CHORD / 2);
    gfx.lineTo(midX, 0);
    gfx.lineTo(ARC_CENTER_X, ARC_CHORD / 2);
    gfx.strokePath();
  }

  destroy() {
    this.sprite.destroy();
  }
}
