import { Room } from 'colyseus';
import {
  ARROW,
  COLORS,
  GAME,
  HIT,
  MESSAGES,
  NETWORK,
  PHYSICS,
  PLAYER,
  PLAYER_COLORS,
  TILE,
  WORLD,
  parseMap,
} from '@boxfury/shared';
import { GameState } from '../schemas/GameState.js';
import { Player } from '../schemas/Player.js';
import { Arrow } from '../schemas/Arrow.js';

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
    this.arrowSeq = 0;
    this.displayName = (options?.name && String(options.name).slice(0, 24)) || randomName();
    this.createdAt = Date.now();
    this.map = parseMap();
    this.updateMetadata();

    this.onMessage(MESSAGES.STATE, (client, payload) => {
      const player = this.state.players.get(client.sessionId);
      if (!player || !player.alive) return;
      if (typeof payload.x === 'number') player.x = payload.x;
      if (typeof payload.y === 'number') player.y = payload.y;
      if (typeof payload.vx === 'number') player.vx = payload.vx;
      if (typeof payload.vy === 'number') player.vy = payload.vy;
      if (typeof payload.facing === 'number') player.facing = payload.facing;
      if (typeof payload.bowAngle === 'number') player.bowAngle = payload.bowAngle;
    });

    this.onMessage(MESSAGES.SHOOT, (client, payload) => {
      const shooter = this.state.players.get(client.sessionId);
      if (!shooter || !shooter.alive) return;
      const arrow = new Arrow();
      arrow.x = Number(payload.x) || 0;
      arrow.y = Number(payload.y) || 0;
      arrow.vx = Number(payload.vx) || 0;
      arrow.vy = Number(payload.vy) || 0;
      arrow.shooterId = client.sessionId;
      arrow.spawnedAt = Date.now();
      const id = `${client.sessionId}-${++this.arrowSeq}`;
      this.state.arrows.set(id, arrow);
    });

    this.setSimulationInterval((dtMs) => this.tick(dtMs), 1000 / PHYSICS.TICK_HZ);

    if (GAME.DEBUG_DUMMY) this.spawnDummy();
  }

  spawnDummy() {
    const dummy = new Player(COLORS.P3_AZURE);
    dummy.name = 'DUMMY';
    dummy.team = 0;
    dummy.x = 640;
    dummy.y = 648;
    dummy.facing = -1;
    this.state.players.set('dummy', dummy);
  }

  tick(dtMs) {
    const dt = dtMs / 1000;
    const now = Date.now();
    const remove = [];

    this.state.arrows.forEach((arrow, id) => {
      if (arrow.stuck) {
        if (now - arrow.spawnedAt > ARROW.LIFETIME_MS) remove.push(id);
        return;
      }

      arrow.vy += PHYSICS.GRAVITY * dt;
      arrow.x += arrow.vx * dt;
      arrow.y += arrow.vy * dt;

      if (arrow.x < 0 || arrow.x > WORLD.WIDTH || arrow.y > WORLD.HEIGHT + 80) {
        remove.push(id);
        return;
      }

      if (this.hitsWall(arrow.x, arrow.y)) {
        arrow.stuck = true;
        arrow.vx = 0;
        arrow.vy = 0;
        arrow.spawnedAt = now;
        return;
      }

      for (const [pid, target] of this.state.players) {
        if (pid === arrow.shooterId) continue;
        if (!target.alive) continue;
        if (now - target.lastHitAt < HIT.IFRAMES_MS) continue;
        if (this.hitsPlayer(arrow, target)) {
          this.applyHit(arrow, target, pid);
          arrow.stuck = true;
          arrow.vx = 0;
          arrow.vy = 0;
          arrow.spawnedAt = now;
          break;
        }
      }
    });

    for (const id of remove) this.state.arrows.delete(id);
  }

  hitsWall(x, y) {
    for (const wall of this.map.walls) {
      const top = wall.y - wall.h / 2;
      const bottom = top + TILE.WALL_THICKNESS;
      const left = wall.x - wall.w / 2;
      const right = wall.x + wall.w / 2;
      if (x >= left && x <= right && y >= top && y <= bottom) return true;
    }
    return false;
  }

  hitsPlayer(arrow, player) {
    const halfW = PLAYER.WIDTH / 2;
    const halfH = PLAYER.HEIGHT / 2;
    return (
      arrow.x >= player.x - halfW &&
      arrow.x <= player.x + halfW &&
      arrow.y >= player.y - halfH &&
      arrow.y <= player.y + halfH
    );
  }

  applyHit(arrow, target, targetId) {
    const damage = ARROW.DAMAGE;
    target.hp = Math.max(0, target.hp - damage);
    target.lastHitAt = Date.now();
    if (target.hp <= 0) target.alive = false;

    const knockX = arrow.vx * ARROW.KNOCKBACK_MULT;
    const knockY = arrow.vy * ARROW.KNOCKBACK_MULT - ARROW.KNOCKBACK_UP;

    this.broadcast(MESSAGES.HIT, {
      targetId,
      shooterId: arrow.shooterId,
      damage,
      knockX,
      knockY,
      hp: target.hp,
      alive: target.alive,
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
