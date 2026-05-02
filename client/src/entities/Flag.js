import { COLORS, FLAG } from '@boxfury/shared';

const FLAG_OFFSET_X = 6;
const FLAG_OFFSET_Y = -FLAG.POLE_HEIGHT / 2 + 4;

export class Flag {
  constructor(scene, pos) {
    this.scene = scene;
    this.x = pos.x;
    this.y = pos.y;

    this.pole = scene.add.rectangle(pos.x, pos.y, FLAG.POLE_WIDTH, FLAG.POLE_HEIGHT, COLORS.BONE);
    this.cloth = scene.add.rectangle(
      pos.x + FLAG_OFFSET_X,
      pos.y + FLAG_OFFSET_Y,
      10, 8,
      COLORS.P2_CRIMSON,
    );
  }

  applyState(state) {
    this.x = state.x;
    this.y = state.y;
    this.pole.setPosition(state.x, state.y);
    this.cloth.setPosition(state.x + FLAG_OFFSET_X, state.y + FLAG_OFFSET_Y);
  }

  destroy() {
    this.pole.destroy();
    this.cloth.destroy();
  }
}
