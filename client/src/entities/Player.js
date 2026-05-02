import { BOW, NETWORK, PLAYER } from '@boxfury/shared';
import { Bow } from './Bow.js';

const lerp = (a, b, t) => a + (b - a) * t;

export class Player {
  constructor(scene, { id, x, y, color, facing = 1, bowAngle = BOW.MIN_ANGLE, isLocal = false }) {
    this.id = id;
    this.scene = scene;
    this.facing = facing;
    this.isLocal = isLocal;
    this.sprite = scene.add.rectangle(x, y, PLAYER.WIDTH, PLAYER.HEIGHT, color).setDepth(4);
    if (!isLocal) this.sprite.setStrokeStyle(2, 0xffffff, 0.4);
    this.bow = new Bow(scene, this);
    this.bow.setAngle(bowAngle);
    this.buffer = [{ t: performance.now(), x, y, facing, bowAngle }];
  }

  applyState({ x, y, facing, bowAngle }) {
    if (this.isLocal) {
      if (typeof x === 'number') this.sprite.x = x;
      if (typeof y === 'number') this.sprite.y = y;
      if (typeof facing === 'number') this.facing = facing;
      // Local bow is driven by local input in GameScene — ignore server bowAngle.
      return;
    }
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
    if (this.isLocal) {
      this.bow.update();
      return;
    }
    const renderTime = performance.now() - NETWORK.INTERP_DELAY_MS;
    while (this.buffer.length > 2 && this.buffer[1].t <= renderTime) this.buffer.shift();

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
