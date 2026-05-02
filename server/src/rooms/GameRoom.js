import { Room } from 'colyseus';
import { MESSAGES, NETWORK, PLAYER_COLORS } from '@boxfury/shared';
import { GameState } from '../schemas/GameState.js';
import { Player } from '../schemas/Player.js';

const ADJECTIVES = ['Jade', 'Crimson', 'Azure', 'Amber', 'Bone', 'Void', 'Deep', 'Mute', 'Neon', 'Hollow'];
const NOUNS = ['Arena', 'Drift', 'Lab', 'Vault', 'Cell', 'Spire', 'Gate', 'Yard', 'Crater', 'Stack'];

function randomName() {
  const a = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const n = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  return `${a} ${n}`;
}

function defaultPlayerName(sessionId) {
  return `P-${sessionId.slice(-3).toUpperCase()}`;
}

export class GameRoom extends Room {
  maxClients = 8;
  patchRate = 1000 / NETWORK.PATCH_RATE;
  state = new GameState();

  onCreate(options = {}) {
    this.joinCount = 0;
    this.displayName = (options?.name && String(options.name).slice(0, 24)) || randomName();
    this.createdAt = Date.now();
    this.updateMetadata();

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

  onJoin(client, options = {}) {
    const team = this.pickBalancedTeam();
    const color = team === 1 ? PLAYER_COLORS[0] : PLAYER_COLORS[1];
    const name = (options?.name && String(options.name).slice(0, 16)) || defaultPlayerName(client.sessionId);
    const player = new Player(color);
    player.name = name;
    player.team = team;
    this.state.players.set(client.sessionId, player);
    this.joinCount++;
    this.updateMetadata();
    console.log(`[room ${this.displayName}] +${name} (team ${team}, ${this.state.players.size}/${this.maxClients})`);
  }

  onLeave(client) {
    this.state.players.delete(client.sessionId);
    this.updateMetadata();
    console.log(`[room ${this.displayName}] -${client.sessionId} (${this.state.players.size}/${this.maxClients})`);
  }

  pickBalancedTeam() {
    let t1 = 0;
    let t2 = 0;
    for (const p of this.state.players.values()) {
      if (p.team === 1) t1++;
      else if (p.team === 2) t2++;
    }
    return t1 <= t2 ? 1 : 2;
  }

  updateMetadata() {
    const team1 = [];
    const team2 = [];
    for (const p of this.state.players.values()) {
      const entry = { name: p.name, color: p.color };
      if (p.team === 1) team1.push(entry);
      else if (p.team === 2) team2.push(entry);
    }
    this.setMetadata({
      name: this.displayName,
      team1,
      team2,
      createdAt: this.createdAt,
    });
  }
}
