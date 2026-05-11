import { BEE, NETWORK } from '@boxfury/shared';

export class Bee {
  constructor(scene, { id, x, y }) {
    this.scene = scene;
    this.id = id;
    this.x = x;
    this.y = y;
    this.color = BEE.COLOR;
    this._lastSyncX = x;
    this._lastSyncY = y;

    this.sprite = scene.add.rectangle(x, y, BEE.WIDTH, BEE.HEIGHT, BEE.COLOR);
    this.sprite.setStrokeStyle(1.5, 0x15151f);
    this.sprite.setDepth(11);

    this.detailGfx = scene.add.graphics();
    this.detailGfx.setDepth(13);
    this._drawDetails();

    this.buffer = [{ t: performance.now(), x, y }];
    this.dead = false;

    this.buzz = null;
    if (scene.cache?.audio?.exists('bee-buzz')) {
      this.buzz = scene.sound.add('bee-buzz', { loop: true, volume: 0 });
      this.buzz.play();
    }
  }

  setDamageFromHp(_hp) {
    // no-op: bee doesn't render damage cracks
  }

  setCarryingFlag(_carrying) {
    // no-op
  }

  _drawDetails() {
    const g = this.detailGfx;
    g.clear();
    const cx = this.x;
    const cy = this.y;
    const w = BEE.WIDTH;
    const h = BEE.HEIGHT;
    g.lineStyle(1, 0x15151f, 1);
    g.beginPath();
    g.moveTo(cx - w / 4, cy - h / 2);
    g.lineTo(cx - w / 4, cy - h / 2 - 4);
    g.moveTo(cx + w / 4, cy - h / 2);
    g.lineTo(cx + w / 4, cy - h / 2 - 4);
    g.strokePath();
    g.fillStyle(0x15151f, 1);
    g.fillCircle(cx - w / 4, cy - h / 2 - 4, 1.2);
    g.fillCircle(cx + w / 4, cy - h / 2 - 4, 1.2);
    g.fillStyle(0x15151f, 1);
    g.fillRect(cx - w / 2 - 2, cy - 2, 3, 4);
    g.fillRect(cx + w / 2 - 1, cy - 2, 3, 4);
    g.fillStyle(0x15151f, 1);
    g.fillRect(cx - 5, cy - 1, 2, 2);
    g.fillRect(cx + 3, cy - 1, 2, 2);
  }

  applyState(state) {
    const t = performance.now();
    this.buffer.push({ t, x: state.x, y: state.y });
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
      const k = span > 0 ? Math.max(0, Math.min(1, (renderTime - a.t) / span)) : 1;
      this.x = a.x + (b.x - a.x) * k;
      this.y = a.y + (b.y - a.y) * k;
    } else {
      this.x = this.buffer[0].x;
      this.y = this.buffer[0].y;
    }
    this.sprite.setPosition(this.x, this.y);
    this._drawDetails();
    this._updateBuzz();
  }

  _updateBuzz() {
    if (!this.buzz) return;
    if (this.dead) {
      this.buzz.setVolume(0);
      return;
    }
    const listener = this.scene.player?.sprite ?? this.scene.cameras?.main?.midPoint;
    let proximity = 1;
    if (listener) {
      const dx = (listener.x ?? 0) - this.x;
      const dy = (listener.y ?? 0) - this.y;
      const dist = Math.hypot(dx, dy);
      const near = 80;
      const far = 520;
      proximity = 1 - Math.min(1, Math.max(0, (dist - near) / (far - near)));
    }
    const t = performance.now() / 1000;
    const wave = 0.5 + 0.5 * Math.sin((t * 2 * Math.PI) / 2.0);
    const envelope = 0.4 + 0.6 * wave;
    const baseVol = 0.2;
    this.buzz.setVolume(baseVol * envelope * proximity);
  }

  flashHit() {
    this.sprite.setFillStyle(0xffffff);
    this.scene.time.delayedCall(80, () => {
      if (this.sprite?.active) this.sprite.setFillStyle(BEE.COLOR);
    });
  }

  playDeathAnim() {
    this.dead = true;
    this.sprite.setVisible(false);
    this.detailGfx.setVisible(false);
    if (this.buzz) this.buzz.setVolume(0);
  }

  resetVisual() {
    this.dead = false;
    this.sprite.setVisible(true);
    this.detailGfx.setVisible(true);
  }

  destroy() {
    this.sprite?.destroy();
    this.detailGfx?.destroy();
    if (this.buzz) {
      try { this.buzz.stop(); } catch {}
      try { this.buzz.destroy(); } catch {}
      this.buzz = null;
    }
    this.sprite = null;
    this.detailGfx = null;
  }
}
