import { Schema, MapSchema, defineTypes } from '@colyseus/schema';
import { Player } from './Player.js';
import { Arrow } from './Arrow.js';
import { Flag } from './Flag.js';

export class GameState extends Schema {
  constructor() {
    super();
    this.players = new MapSchema();
    this.arrows = new MapSchema();
    this.flag = new Flag();
  }
}

defineTypes(GameState, {
  players: { map: Player },
  arrows: { map: Arrow },
  flag: Flag,
});
