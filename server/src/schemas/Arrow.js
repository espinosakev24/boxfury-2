import { Schema, defineTypes } from '@colyseus/schema';

export class Arrow extends Schema {
  constructor() {
    super();
    this.x = 0;
    this.y = 0;
    this.vx = 0;
    this.vy = 0;
    this.shooterId = '';
    this.stuck = false;
    this.spawnedAt = 0;
  }
}

defineTypes(Arrow, {
  x: 'number',
  y: 'number',
  vx: 'number',
  vy: 'number',
  shooterId: 'string',
  stuck: 'boolean',
  spawnedAt: 'number',
});
