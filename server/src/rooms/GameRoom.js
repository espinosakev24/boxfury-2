import { Room } from 'colyseus';
import { COLORS, MESSAGES, NETWORK } from '@boxfury/shared';
import { GameState } from '../schemas/GameState.js';
import { Player } from '../schemas/Player.js';

export class GameRoom extends Room {
  maxClients = 16;
  patchRate = 1000 / NETWORK.PATCH_RATE;
  state = new GameState();

  onCreate() {
    this.joinCount = 0;

    this.onMessage(MESSAGES.STATE, (client, payload) => {
      const player = this.state.players.get(client.sessionId);
      if (!player) return;
      if (typeof payload.x === 'number') player.x = payload.x;
      if (typeof payload.y === 'number') player.y = payload.y;
      if (typeof payload.vx === 'number') player.vx = payload.vx;
      if (typeof payload.vy === 'number') player.vy = payload.vy;
      if (typeof payload.facing === 'number') player.facing = payload.facing;
      if (typeof payload.bowAngle === 'number') player.bowAngle = payload.bowAngle;
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
