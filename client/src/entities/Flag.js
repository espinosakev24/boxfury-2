import { COLORS, PLAYER, TILE } from '@boxfury/shared';

const POLE_HEIGHT = TILE.HEIGHT * 0.7;
const POLE_WIDTH = 2;
const FLAG_OFFSET_X = 6;
const FLAG_OFFSET_Y = -POLE_HEIGHT / 2 + 4;

export class Flag {
  constructor(scene, pos) {
    this.scene = scene;
    this.home = { x: pos.x, y: pos.y };
    this.carrier = null;

    this.pole = scene.add.rectangle(pos.x, pos.y, POLE_WIDTH, POLE_HEIGHT, COLORS.BONE);
    scene.physics.add.existing(this.pole);
    this.pole.body.setCollideWorldBounds(true);
    this.pole.body.setSize(POLE_WIDTH, POLE_HEIGHT);

    this.cloth = scene.add.rectangle(
      pos.x + FLAG_OFFSET_X,
      pos.y + FLAG_OFFSET_Y,
      10, 8,
      COLORS.P2_CRIMSON,
    );
  }

  get x() { return this.pole.x; }
  get y() { return this.pole.y; }

  canPickUp(player) {
    if (this.carrier) return false;
    const dx = player.sprite.x - this.pole.x;
    const dy = player.sprite.y - this.pole.y;
    return Math.hypot(dx, dy) <= PLAYER.PICKUP_RADIUS;
  }

  pickUp(player) {
    this.carrier = player;
    this.pole.body.setAllowGravity(false);
    this.pole.body.setVelocity(0, 0);
    this.pole.body.enable = false;
  }

  drop() {
    this.carrier = null;
    this.pole.body.enable = true;
    this.pole.body.setAllowGravity(true);
    this.pole.body.setVelocity(0, 0);
  }

  update() {
    if (this.carrier) {
      this.pole.setPosition(
        this.carrier.sprite.x,
        this.carrier.sprite.y - PLAYER.HEIGHT / 2 - POLE_HEIGHT / 2,
      );
    }
    this.cloth.setPosition(
      this.pole.x + FLAG_OFFSET_X,
      this.pole.y + FLAG_OFFSET_Y,
    );
  }
}
