import { Schema, defineTypes } from '@colyseus/schema';

export class Flag extends Schema {
  constructor() {
    super();
    this.x = 0;
    this.y = 0;
    this.vx = 0;
    this.vy = 0;
    this.carrierId = '';
    this.homeX = 0;
    this.homeY = 0;
  }
}

defineTypes(Flag, {
  x: 'number',
  y: 'number',
  vx: 'number',
  vy: 'number',
  carrierId: 'string',
  homeX: 'number',
  homeY: 'number',
});
