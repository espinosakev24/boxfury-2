import { Schema, defineTypes } from '@colyseus/schema';
import { BOW } from '@boxfury/shared';

export class Player extends Schema {
  constructor(color = 0) {
    super();
    this.x = 0;
    this.y = 0;
    this.vx = 0;
    this.vy = 0;
    this.facing = 1;
    this.color = color;
    this.bowAngle = BOW.MIN_ANGLE;
    this.name = '';
    this.team = 0;
  }
}

defineTypes(Player, {
  x: 'number',
  y: 'number',
  vx: 'number',
  vy: 'number',
  facing: 'number',
  color: 'number',
  bowAngle: 'number',
  name: 'string',
  team: 'number',
});
