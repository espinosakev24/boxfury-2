import { Room } from 'colyseus';
import {
  ARROW,
  COLORS,
  FLAG,
  GAME,
  HIT,
  MESSAGES,
  NETWORK,
  PHYSICS,
  PLAYER,
  PLAYER_COLORS,
  RESPAWN,
  ROOM,
  SCORE,
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
  maxClients = ROOM.MAX_CLIENTS;
  patchRate = 1000 / NETWORK.PATCH_RATE;
  state = new GameState();

  onCreate(options = {}) {
    this.joinCount = 0;
    this.arrowSeq = 0;
    this.displayName = (options?.name && String(options.name).slice(0, 24)) || randomName();
    this.createdAt = Date.now();
    this.map = parseMap();
    this.bases = {
      1: this.map.bases.team1,
      2: this.map.bases.team2,
    };
    if (this.map.flag) {
      this.state.flag.x = this.map.flag.x;
      this.state.flag.y = this.map.flag.y;
      this.state.flag.homeX = this.map.flag.x;
      this.state.flag.homeY = this.map.flag.y;
    }
    this.updateMetadata();

    this.onMessage(MESSAGES.STATE, (client, payload) => {
      if (this.matchEnded) return;
      const player = this.state.players.get(client.sessionId);
      if (!player || !player.alive) return;
      if (typeof payload.x === 'number') player.x = payload.x;
      if (typeof payload.y === 'number') player.y = payload.y;
      if (typeof payload.vx === 'number') player.vx = payload.vx;
      if (typeof payload.vy === 'number') player.vy = payload.vy;
      if (typeof payload.facing === 'number') player.facing = payload.facing;
      if (typeof payload.bowAngle === 'number') player.bowAngle = payload.bowAngle;
    });

    this.onMessage(MESSAGES.CHOOSE_TEAM, (client, payload) => {
      if (this.matchEnded) return;
      const player = this.state.players.get(client.sessionId);
      if (!player || player.team !== 0) return;
      const team = payload?.team;
      if (team !== 1 && team !== 2) return;
      const cap = Math.floor(ROOM.MAX_CLIENTS / 2);
      let count = 0;
      this.state.players.forEach((p) => { if (p.team === team) count++; });
      if (count >= cap) {
        console.log(`[room ${this.displayName}] ${player.name} rejected team ${team}: full (${count}/${cap})`);
        return;
      }
      player.team = team;
      player.color = team === 1 ? PLAYER_COLORS[0] : PLAYER_COLORS[1];
      player.alive = true;
      this.updateMetadata();
      console.log(`[room ${this.displayName}] ${player.name} chose team ${team} (${count + 1}/${cap})`);
    });

    this.onMessage(MESSAGES.FLAG_TOGGLE, (client) => {
      if (this.matchEnded) return;
      const flag = this.state.flag;
      const player = this.state.players.get(client.sessionId);
      if (!player || !player.alive) {
        console.log('[flag] toggle rejected: player missing or dead', client.sessionId);
        return;
      }
      if (flag.carrierId === client.sessionId) {
        const base = this.bases?.[player.team];
        const distToBase = base ? Math.hypot(player.x - base.x, player.y - base.y) : Infinity;
        if (base && distToBase <= SCORE.CAPTURE_RADIUS) {
          if (player.team === 1) this.state.scoreTeam1++;
          else if (player.team === 2) this.state.scoreTeam2++;
          player.captures++;
          flag.carrierId = '';
          flag.x = flag.homeX;
          flag.y = flag.homeY;
          flag.vx = 0;
          flag.vy = 0;
          console.log(
            `[room ${this.displayName}] SCORE team ${player.team} by ${player.name} | JADE ${this.state.scoreTeam1} — ${this.state.scoreTeam2} CRIMSON`,
          );
          if (this.state.scoreTeam1 >= SCORE.TARGET || this.state.scoreTeam2 >= SCORE.TARGET) {
            this.endMatch();
          }
        } else {
          flag.carrierId = '';
          flag.x = player.x;
          flag.y = player.y;
          flag.vx = 0;
          flag.vy = 0;
          console.log('[flag] dropped by', client.sessionId, 'at', player.x.toFixed(0), player.y.toFixed(0));
        }
      } else if (!flag.carrierId) {
        const dx = player.x - flag.x;
        const dy = player.y - flag.y;
        const dist = Math.hypot(dx, dy);
        if (dist <= PLAYER.PICKUP_RADIUS) {
          flag.carrierId = client.sessionId;
          flag.vx = 0;
          flag.vy = 0;
          console.log('[flag] picked up by', client.sessionId, 'dist', dist.toFixed(1));
        } else {
          console.log('[flag] pickup too far', client.sessionId, 'dist', dist.toFixed(1), 'radius', PLAYER.PICKUP_RADIUS);
        }
      } else {
        console.log('[flag] held by', flag.carrierId, '— request from', client.sessionId, 'ignored');
      }
    });

    this.onMessage(MESSAGES.SHOOT, (client, payload) => {
      if (this.matchEnded) return;
      const shooter = this.state.players.get(client.sessionId);
      if (!shooter || !shooter.alive) return;
      const arrow = new Arrow();
      arrow.x = Number(payload.x) || 0;
      arrow.y = Number(payload.y) || 0;
      arrow.vx = Number(payload.vx) || 0;
      arrow.vy = Number(payload.vy) || 0;
      arrow.shooterId = client.sessionId;
      arrow.shooterTeam = shooter.team || 0;
      arrow.spawnedAt = Date.now();
      const id = `${client.sessionId}-${++this.arrowSeq}`;
      this.state.arrows.set(id, arrow);
    });

    this.setSimulationInterval((dtMs) => this.tick(dtMs), 1000 / PHYSICS.TICK_HZ);

    if (GAME.DEBUG_DUMMY) this.spawnDummy();
  }

  endMatch() {
    if (this.matchEnded) return;
    this.matchEnded = true;
    const winnerTeam = this.state.scoreTeam1 > this.state.scoreTeam2 ? 1
      : this.state.scoreTeam2 > this.state.scoreTeam1 ? 2 : 0;
    const players = [];
    this.state.players.forEach((p) => {
      players.push({
        name: p.name,
        team: p.team,
        captures: p.captures,
        deaths: p.deaths,
        kills: p.kills,
      });
    });
    const payload = {
      winnerTeam,
      scoreTeam1: this.state.scoreTeam1,
      scoreTeam2: this.state.scoreTeam2,
      players,
    };
    this.broadcast(MESSAGES.MATCH_END, payload);
    console.log(
      `[room ${this.displayName}] MATCH END — winner: team ${winnerTeam} | JADE ${this.state.scoreTeam1} — ${this.state.scoreTeam2} CRIMSON`,
    );
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
        if (arrow.shooterTeam !== 0 && target.team === arrow.shooterTeam) continue;
        if (now - target.lastHitAt < HIT.IFRAMES_MS) continue;
        if (this.hitsPlayer(arrow, target)) {
          arrow.stuckToId = pid;
          arrow.stuckOffsetX = arrow.x - target.x;
          arrow.stuckOffsetY = arrow.y - target.y;
          arrow.stuckFacing = target.facing || 1;
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

    this.tickFlag(dt);
    this.tickRespawns(now);
  }

  tickRespawns(now) {
    this.state.players.forEach((p) => {
      if (p.alive) return;
      if (p.team === 0) return;
      if (!p.respawnAt || now < p.respawnAt) return;
      const base = this.bases?.[p.team];
      if (base) {
        p.x = base.x;
        p.y = base.y;
      }
      p.vx = 0;
      p.vy = 0;
      p.hp = PLAYER.MAX_HP;
      p.alive = true;
      p.respawnAt = 0;
    });
  }

  tickFlag(dt) {
    const flag = this.state.flag;
    if (flag.carrierId) {
      const carrier = this.state.players.get(flag.carrierId);
      if (!carrier || !carrier.alive) {
        flag.carrierId = '';
        if (carrier) {
          flag.x = carrier.x;
          flag.y = carrier.y;
        }
        flag.vx = 0;
        flag.vy = 0;
        return;
      }
      flag.x = carrier.x;
      flag.y = carrier.y + FLAG.CARRY_OFFSET_Y;
      flag.vx = 0;
      flag.vy = 0;
      return;
    }

    flag.vy += PHYSICS.GRAVITY * dt;
    flag.x += flag.vx * dt;
    flag.y += flag.vy * dt;

    if (flag.y > WORLD.HEIGHT + 80) {
      flag.x = flag.homeX;
      flag.y = flag.homeY;
      flag.vx = 0;
      flag.vy = 0;
      return;
    }

    const flagBottom = flag.y + FLAG.POLE_HEIGHT / 2;
    for (const wall of this.map.walls) {
      const top = wall.y - wall.h / 2;
      const left = wall.x - wall.w / 2;
      const right = wall.x + wall.w / 2;
      if (
        flag.vy > 0 &&
        flag.x >= left &&
        flag.x <= right &&
        flagBottom >= top &&
        flagBottom <= top + TILE.WALL_THICKNESS + Math.abs(flag.vy * dt) + 4
      ) {
        flag.y = top - FLAG.POLE_HEIGHT / 2;
        flag.vy = 0;
        flag.vx *= 0.4;
        break;
      }
    }
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
    const wasAlive = target.alive;
    target.hp = Math.max(0, target.hp - damage);
    target.lastHitAt = Date.now();
    if (target.hp <= 0 && wasAlive) {
      target.alive = false;
      target.deaths++;
      target.respawnAt = Date.now() + RESPAWN.COOLDOWN_MS;
      const shooter = this.state.players.get(arrow.shooterId);
      if (shooter) shooter.kills++;
    }

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
    const name = (options?.name && String(options.name).slice(0, 16)) || defaultPlayerName(client.sessionId);
    const player = new Player(0);
    player.name = name;
    player.team = 0;
    player.alive = false;
    this.state.players.set(client.sessionId, player);
    this.joinCount++;
    this.updateMetadata();
    console.log(`[room ${this.displayName}] +${name} (waiting for team, ${this.state.players.size}/${this.maxClients})`);
  }

  onLeave(client) {
    if (this.state.flag.carrierId === client.sessionId) {
      const player = this.state.players.get(client.sessionId);
      this.state.flag.carrierId = '';
      this.state.flag.vx = 0;
      this.state.flag.vy = 0;
      if (player) {
        this.state.flag.x = player.x;
        this.state.flag.y = player.y;
      }
    }
    this.state.players.delete(client.sessionId);
    this.updateMetadata();
    console.log(`[room ${this.displayName}] -${client.sessionId} (${this.state.players.size}/${this.maxClients})`);
  }


  updateMetadata() {
    const team1 = [];
    const team2 = [];
    const spectators = [];
    for (const p of this.state.players.values()) {
      if (p.team === 1) team1.push({ name: p.name, color: p.color });
      else if (p.team === 2) team2.push({ name: p.name, color: p.color });
      else spectators.push({ name: p.name });
    }
    this.setMetadata({
      name: this.displayName,
      team1,
      team2,
      spectators,
      createdAt: this.createdAt,
    });
  }
}
