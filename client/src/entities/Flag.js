import { COLORS, FLAG } from '@boxfury/shared';

const CLOTH_W = 10;
const CLOTH_H = 8;
const CLOTH_OFFSET_X = 1;
const CLOTH_OFFSET_Y = -FLAG.POLE_HEIGHT / 2;
const WAVE_SPEED = 0.008;
const WAVE_AMP = 1.6;

export class Flag {
  constructor(scene, pos) {
    this.scene = scene;
    this.x = pos.x;
    this.y = pos.y;

    this.pole = scene.add.rectangle(pos.x, pos.y, FLAG.POLE_WIDTH, FLAG.POLE_HEIGHT, COLORS.BONE);
    this.cloth = scene.add.graphics();
    this._postUpdateBound = () => this._drawCloth();
    scene.events.on('postupdate', this._postUpdateBound);
    this._drawCloth();
  }

  applyState(state) {
    this.x = state.x;
    this.y = state.y;
    this.pole.setPosition(state.x, state.y);
  }

  _drawCloth() {
    if (!this.cloth?.active) return;
    const t = this.scene.time?.now ?? 0;
    const phase = t * WAVE_SPEED;
    const waveTop = Math.sin(phase) * WAVE_AMP;
    const waveBot = Math.sin(phase + 0.7) * WAVE_AMP;
    const dipMid = Math.sin(phase + 0.35) * (WAVE_AMP * 0.4);
    const x = this.x + CLOTH_OFFSET_X;
    const y = this.y + CLOTH_OFFSET_Y;
    const gfx = this.cloth;
    gfx.clear();
    gfx.fillStyle(COLORS.P4_AMBER, 1);
    gfx.beginPath();
    gfx.moveTo(x, y);
    gfx.lineTo(x + CLOTH_W + waveTop, y + dipMid);
    gfx.lineTo(x + CLOTH_W + waveBot, y + CLOTH_H + dipMid);
    gfx.lineTo(x, y + CLOTH_H);
    gfx.closePath();
    gfx.fillPath();
  }

  destroy() {
    if (this._postUpdateBound) {
      this.scene.events.off('postupdate', this._postUpdateBound);
      this._postUpdateBound = null;
    }
    this.pole.destroy();
    this.cloth.destroy();
  }
}
