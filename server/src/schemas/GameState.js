import { Schema, MapSchema, defineTypes } from '@colyseus/schema';
import { Player } from './Player.js';
import { Flag } from './Flag.js';
import { Arrow } from './Arrow.js';

export class GameState extends Schema {
  constructor() {
    super();
    this.players = new MapSchema();
    this.arrows = new MapSchema();
    this.flag = new Flag();
    this.mapId = 'default';
    this.jadeScore = 0;
    this.crimsonScore = 0;
  }
}

defineTypes(GameState, {
  players: { map: Player },
  arrows: { map: Arrow },
  flag: Flag,
  mapId: 'string',
  jadeScore: 'number',
  crimsonScore: 'number',
});
