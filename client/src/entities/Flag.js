const SIZE = 16;
const PULSE_MS = 200;

export class Flag {
  constructor(scene, { x, y }) {
    this.scene = scene;
    this.targetX = x;
    this.targetY = y;
    this.color = 0xffffff;
    this.sprite = scene.add.rectangle(x, y, SIZE, SIZE, this.color).setDepth(5);
    this.lastCarrierId = '';
  }

  applyState({ x, y, carrierId, team }) {
    this.targetX = x;
    this.targetY = y;
    if (team === 'jade') this.color = 0x4ee08a;
    else if (team === 'crimson') this.color = 0xff5470;
    else this.color = 0xffffff;
    this.sprite.fillColor = this.color;
    if (carrierId !== this.lastCarrierId) {
      this.pulse();
      this.lastCarrierId = carrierId;
    }
  }

  update() {
    this.sprite.x += (this.targetX - this.sprite.x) * 0.4;
    this.sprite.y += (this.targetY - this.sprite.y) * 0.4;
  }

  pulse() {
    this.sprite.setScale(1.6);
    this.scene.tweens.add({
      targets: this.sprite,
      scale: 1,
      duration: PULSE_MS,
      ease: 'Cubic.Out',
    });
  }

  destroy() {
    this.sprite.destroy();
  }
}
