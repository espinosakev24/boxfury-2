import { Schema, defineTypes } from '@colyseus/schema';
import { BOW, DEFAULT_SKIN, PLAYER } from '@boxfury/shared';

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
    this.skin = DEFAULT_SKIN;
    this.team = 0;
    this.hp = PLAYER.MAX_HP;
    this.alive = true;
    this.lastHitAt = 0;
    this.deaths = 0;
    this.captures = 0;
    this.kills = 0;
    this.respawnAt = 0;
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
  skin: 'string',
  team: 'number',
  hp: 'number',
  alive: 'boolean',
  lastHitAt: 'number',
  deaths: 'number',
  captures: 'number',
  kills: 'number',
  respawnAt: 'number',
});
