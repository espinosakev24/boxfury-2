import { PLAYER } from '@boxfury/shared';

const LERP = 0.25;

export class RemotePlayer {
  constructor(scene, { id, x, y, color }) {
    this.id = id;
    this.scene = scene;
    this.targetX = x;
    this.targetY = y;
    this.sprite = scene.add.rectangle(x, y, PLAYER.SIZE, PLAYER.SIZE, color);
    this.sprite.setStrokeStyle(2, 0xffffff, 0.4);
  }

  applyState({ x, y }) {
    this.targetX = x;
    this.targetY = y;
  }

  update() {
    this.sprite.x += (this.targetX - this.sprite.x) * LERP;
    this.sprite.y += (this.targetY - this.sprite.y) * LERP;
  }

  destroy() {
    this.sprite.destroy();
  }
}
