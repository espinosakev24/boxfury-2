import { HIT, NETWORK, PLAYER } from '@boxfury/shared';
import { Bow } from './Bow.js';

const lerp = (a, b, t) => a + (b - a) * t;

export class RemotePlayer {
  constructor(scene, { id, x, y, color, facing = 1, bowAngle = 45 }) {
    this.id = id;
    this.scene = scene;
    this.color = color;
    this.facing = facing;
    this.sprite = scene.add.rectangle(x, y, PLAYER.WIDTH, PLAYER.HEIGHT, color);
    this.sprite.setStrokeStyle(2, 0xffffff, 0.4);
    scene.physics.add.existing(this.sprite);
    this.sprite.body.setAllowGravity(false);
    this.sprite.body.setImmovable(true);
    this.bow = new Bow(scene, this);
    this.bow.setAngle(bowAngle);
    this.buffer = [{ t: performance.now(), x, y, facing, bowAngle }];
  }

  setCarryingFlag(carrying) {
    this.bow.sprite.setVisible(!carrying);
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

  applyState({ x, y, facing, bowAngle }) {
    const last = this.buffer[this.buffer.length - 1];
    this.buffer.push({
      t: performance.now(),
      x: typeof x === 'number' ? x : last.x,
      y: typeof y === 'number' ? y : last.y,
      facing: typeof facing === 'number' ? facing : last.facing,
      bowAngle: typeof bowAngle === 'number' ? bowAngle : last.bowAngle,
    });
    if (this.buffer.length > 30) this.buffer.shift();
  }

  update() {
    const renderTime = performance.now() - NETWORK.INTERP_DELAY_MS;

    while (this.buffer.length > 2 && this.buffer[1].t <= renderTime) {
      this.buffer.shift();
    }

    if (this.buffer.length >= 2) {
      const a = this.buffer[0];
      const b = this.buffer[1];
      const span = b.t - a.t;
      const t = span > 0 ? Math.max(0, Math.min(1, (renderTime - a.t) / span)) : 1;
      this.sprite.x = lerp(a.x, b.x, t);
      this.sprite.y = lerp(a.y, b.y, t);
      this.facing = b.facing;
      this.bow.setAngle(lerp(a.bowAngle, b.bowAngle, t));
    } else {
      const s = this.buffer[0];
      this.sprite.x = s.x;
      this.sprite.y = s.y;
      this.facing = s.facing;
      this.bow.setAngle(s.bowAngle);
    }

    this.bow.update();
  }

  destroy() {
    this.bow.destroy();
    this.sprite.destroy();
  }
}
