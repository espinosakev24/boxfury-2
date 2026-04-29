import { Schema, MapSchema, defineTypes } from '@colyseus/schema';
import { Player } from './Player.js';

export class GameState extends Schema {
  constructor() {
    super();
    this.players = new MapSchema();
  }
}

defineTypes(GameState, {
  players: { map: Player },
});
