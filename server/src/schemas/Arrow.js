import { Schema, defineTypes } from '@colyseus/schema';

export class Arrow extends Schema {
  constructor({ x = 0, y = 0, vx = 0, vy = 0, shooterId = '' } = {}) {
    super();
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.rotation = 0;
    this.shooterId = shooterId;
  }
}

defineTypes(Arrow, {
  x: 'number',
  y: 'number',
  vx: 'number',
  vy: 'number',
  rotation: 'number',
  shooterId: 'string',
});
