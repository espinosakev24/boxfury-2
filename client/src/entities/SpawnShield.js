import { PLAYER } from '@boxfury/shared';

const HALO_W = PLAYER.WIDTH + 14;
const HALO_H = PLAYER.HEIGHT + 14;
const BRACKET_LEN = 6;
const BRACKET_OFFSET = 4;

export class SpawnShield {
  constructor(scene, color = 0xf5f5f0) {
    this.scene = scene;
    this.color = color;
    this.gfx = scene.add.graphics();
    this.gfx.setDepth(15);
    this.gfx.setVisible(false);
    this.active = false;
    this.t = 0;
  }

  setColor(color) {
    this.color = color;
  }

  setActive(active) {
    if (this.active === active) return;
    this.active = active;
    this.gfx.setVisible(active);
    if (!active) this.gfx.clear();
  }

  update(dt, x, y) {
    if (!this.active) return;
    this.t += dt;
    const g = this.gfx;
    g.clear();

    const pulse = 0.5 + 0.5 * Math.sin(this.t * 6);
    const halfW = HALO_W / 2 + pulse * 1.5;
    const halfH = HALO_H / 2 + pulse * 1.5;

    g.lineStyle(1, this.color, 0.18 + pulse * 0.15);
    g.strokeRect(x - halfW, y - halfH, halfW * 2, halfH * 2);

    const rot = (this.t * 1.4) % (Math.PI * 2);
    const orbitR = Math.max(halfW, halfH) + 3;
    const cx = x;
    const cy = y;
    const corners = [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2];
    g.lineStyle(2, this.color, 0.85);
    for (const base of corners) {
      const a = base + rot;
      const px = cx + Math.cos(a) * orbitR;
      const py = cy + Math.sin(a) * orbitR;
      g.beginPath();
      g.moveTo(px - BRACKET_LEN, py);
      g.lineTo(px, py);
      g.lineTo(px, py - BRACKET_LEN);
      g.strokePath();
    }

    g.fillStyle(this.color, 0.6 + pulse * 0.4);
    for (let i = 0; i < 3; i++) {
      const a = (this.t * 2 + (i * Math.PI * 2) / 3) % (Math.PI * 2);
      const r = orbitR + BRACKET_OFFSET;
      const sx = cx + Math.cos(a) * r;
      const sy = cy + Math.sin(a) * r;
      g.fillRect(sx - 1, sy - 1, 2, 2);
    }
  }

  destroy() {
    this.gfx?.destroy();
    this.gfx = null;
  }
}
