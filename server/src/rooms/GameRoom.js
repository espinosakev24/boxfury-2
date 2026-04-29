import { Room } from 'colyseus';
import { COLORS } from '@boxfury/shared';
import { GameState } from '../schemas/GameState.js';
import { Player } from '../schemas/Player.js';
import { MESSAGES } from '@boxfury/shared';

export class GameRoom extends Room {
  maxClients = 16;

  onCreate() {
    this.setState(new GameState());
    this.joinCount = 0;

    this.onMessage(MESSAGES.STATE, (client, payload) => {
      const player = this.state.players.get(client.sessionId);
      if (!player) return;
      if (typeof payload.x === 'number') player.x = payload.x;
      if (typeof payload.y === 'number') player.y = payload.y;
      if (typeof payload.vx === 'number') player.vx = payload.vx;
      if (typeof payload.vy === 'number') player.vy = payload.vy;
      if (typeof payload.facing === 'number') player.facing = payload.facing;
    });

    this.onMessage(MESSAGES.SHOOT, (client, payload) => {
      this.broadcast(MESSAGES.SHOOT, { id: client.sessionId, ...payload }, { except: client });
    });
  }

  onJoin(client) {
    const color = COLORS[this.joinCount++ % COLORS.length];
    this.state.players.set(client.sessionId, new Player(color));
    console.log(`[room] +${client.sessionId} (${this.state.players.size} online)`);
  }

  onLeave(client) {
    this.state.players.delete(client.sessionId);
    console.log(`[room] -${client.sessionId} (${this.state.players.size} online)`);
  }
}
