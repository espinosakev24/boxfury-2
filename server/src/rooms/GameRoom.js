import { Room } from 'colyseus';
import {
  ARROW,
  BEE,
  DEATHMATCH,
  FLAG,
  HIT,
  MESSAGES,
  NETWORK,
  PHYSICS,
  PLAYER,
  PLAYER_COLORS,
  RESPAWN,
  SCORE,
  SPAWN_PROTECTION,
  TILE,
  LOG_EVENTS,
  getMap,
  normalizeMapId,
  normalizeMaxPlayers,
  normalizeMaxPoints,
  normalizeMode,
  normalizeSkin,
  parseMap,
} from '@boxfury/shared';
import { GameState } from '../schemas/GameState.js';
import { Player } from '../schemas/Player.js';
import { Arrow } from '../schemas/Arrow.js';
import { BeeController } from './BeeController.js';

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
  maxClients = 999;
  patchRate = 1000 / NETWORK.PATCH_RATE;
  state = new GameState();

  onCreate(options = {}) {
    this.joinCount = 0;
    this.arrowSeq = 0;
    this.displayName = (options?.roomName && String(options.roomName).slice(0, 24)) || randomName();
    this.playerCap = normalizeMaxPlayers(options?.maxPlayers);
    this.scoreTarget = normalizeMaxPoints(options?.maxPoints);
    this.mode = normalizeMode(options?.mode);
    this.mapId = normalizeMapId(options?.mapId);
    this.state.scoreTarget = this.scoreTarget;
    this.state.mapId = this.mapId;
    this.createdAt = Date.now();
    this.map = parseMap(getMap(this.mapId));
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
    this.state.flag.disabled = this.mode === 'dm' || this.mode === 'bee';
    this.updateMetadata();

    this.onMessage(MESSAGES.STATE, (client, payload) => {
      const player = this.state.players.get(client.sessionId);
      if (!player) return;
      const clientWantsAlive = !payload.dead;
      if (player.alive !== clientWantsAlive) return;
      if (typeof payload.x === 'number') player.x = payload.x;
      if (typeof payload.y === 'number') player.y = payload.y;
      if (typeof payload.vx === 'number') player.vx = payload.vx;
      if (typeof payload.vy === 'number') player.vy = payload.vy;
      if (typeof payload.facing === 'number') player.facing = payload.facing;
      if (typeof payload.bowAngle === 'number') player.bowAngle = payload.bowAngle;
      if (typeof payload.crouching === 'boolean') player.crouching = payload.crouching;
    });

    this.onMessage(MESSAGES.CHOOSE_TEAM, (client, payload) => {
      const player = this.state.players.get(client.sessionId);
      if (!player || player.team !== 0) return;
      const team = payload?.team;
      if (team !== 1 && team !== 2) return;
      const cap = Math.floor(this.playerCap / 2);
      let count = 0;
      this.state.players.forEach((p) => { if (p.team === team) count++; });
      if (count >= cap) {
        console.log(`[room ${this.displayName}] ${player.name} rejected team ${team}: full (${count}/${cap})`);
        return;
      }
      player.team = team;
      player.color = team === 1 ? PLAYER_COLORS[0] : PLAYER_COLORS[1];
      player.alive = true;
      player.hp = PLAYER.MAX_HP;
      player.respawnAt = 0;
      player.spawnProtectionUntil = Date.now() + SPAWN_PROTECTION.DURATION_MS;
      const base = this.bases?.[team];
      if (base) {
        player.x = base.x;
        player.y = base.y;
        player.vx = 0;
        player.vy = 0;
      }
      this.updateMetadata();
      this.logEvent(LOG_EVENTS.JOIN_TEAM, { name: player.name, team });
      console.log(`[room ${this.displayName}] ${player.name} chose team ${team} (${count + 1}/${cap})`);
    });

    this.onMessage(MESSAGES.FLAG_TOGGLE, (client) => {
      if (this.mode === 'dm') return;
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
          this.logEvent(LOG_EVENTS.CAPTURE, { name: player.name, team: player.team });
          console.log(
            `[room ${this.displayName}] SCORE team ${player.team} by ${player.name} | JADE ${this.state.scoreTeam1} — ${this.state.scoreTeam2} CRIMSON`,
          );
          if (this.state.scoreTeam1 >= this.scoreTarget || this.state.scoreTeam2 >= this.scoreTarget) {
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
      const shooter = this.state.players.get(client.sessionId);
      if (!shooter || !shooter.alive) return;
      const now = Date.now();
      const last = this._lastShotAt?.get(client.sessionId) ?? 0;
      if (now - last < ARROW.COOLDOWN_MS) return;
      if (!this._lastShotAt) this._lastShotAt = new Map();
      this._lastShotAt.set(client.sessionId, now);
      shooter.spawnProtectionUntil = 0;
      const arrow = new Arrow();
      arrow.x = Number(payload.x) || 0;
      arrow.y = Number(payload.y) || 0;
      arrow.vx = Number(payload.vx) || 0;
      arrow.vy = Number(payload.vy) || 0;
      arrow.shooterId = client.sessionId;
      arrow.shooterTeam = shooter.team || 0;
      arrow.spawnedAt = now;
      const id = `${client.sessionId}-${++this.arrowSeq}`;
      this.state.arrows.set(id, arrow);
    });

    this.onMessage(MESSAGES.CHAT, (client, payload) => {
      const player = this.state.players.get(client.sessionId);
      if (!player) return;
      const now = Date.now();
      const last = this._lastChatAt?.get(client.sessionId) ?? 0;
      if (now - last < 500) return;
      if (!this._lastChatAt) this._lastChatAt = new Map();
      this._lastChatAt.set(client.sessionId, now);
      const text = String(payload?.text ?? '').replace(/[\r\n\t]/g, ' ').trim().slice(0, 40);
      if (!text) return;
      this.broadcast(MESSAGES.CHAT, { sessionId: client.sessionId, text });
    });

    this.onMessage(MESSAGES.CHANGE_MAP, (client, payload) => {
      let anyOnTeam = false;
      this.state.players.forEach((p) => { if (p.team !== 0) anyOnTeam = true; });
      if (anyOnTeam) return;
      const newMapId = normalizeMapId(payload?.mapId);
      if (newMapId === this.mapId) return;
      this.mapId = newMapId;
      this.state.mapId = newMapId;
      this.map = parseMap(getMap(newMapId));
      this.bases = {
        1: this.map.bases.team1,
        2: this.map.bases.team2,
      };
      if (this.map.flag) {
        this.state.flag.x = this.map.flag.x;
        this.state.flag.y = this.map.flag.y;
        this.state.flag.homeX = this.map.flag.x;
        this.state.flag.homeY = this.map.flag.y;
        this.state.flag.carrierId = '';
        this.state.flag.vx = 0;
        this.state.flag.vy = 0;
      }
      const arrowIds = Array.from(this.state.arrows.keys());
      for (const id of arrowIds) this.state.arrows.delete(id);
      this.broadcast(MESSAGES.MAP_CHANGED, { mapId: newMapId });
      const requester = this.state.players.get(client.sessionId);
      this.logEvent(LOG_EVENTS.MAP_CHANGED, { mapId: newMapId, name: requester?.name ?? '?' });
      this.updateMetadata();
      console.log(`[room ${this.displayName}] MAP changed to ${newMapId}`);
    });

    this.setSimulationInterval((dtMs) => this.tick(dtMs), 1000 / PHYSICS.TICK_HZ);

    if (this.mode === 'bee') {
      this.setPrivate(true);
      this.beeWave = 1;
      this.nextWaveAt = 0;
      this.spawnBeeWave(this.beeWave);
    }
  }

  spawnBeeWave(count) {
    const map = this.map;
    if (!this.bees) this.bees = new Map();
    for (let i = 0; i < count; i++) {
      const t = (i + 1) / (count + 1);
      const x = map.pixelWidth * t;
      const y = Math.max(60, Math.min(120, map.pixelHeight * 0.15));
      this._spawnSingleBee(x, y);
    }
  }

  _spawnSingleBee(x, y) {
    const sessionId = `bee-${Math.random().toString(36).slice(2, 8)}`;
    const bee = new Player(BEE.COLOR);
    bee.name = 'BEE';
    bee.team = 2;
    bee.kind = 'bee';
    bee.alive = true;
    bee.hp = BEE.HP;
    bee.x = x;
    bee.y = y;
    bee.vx = 0;
    bee.vy = 0;
    bee.spawnProtectionUntil = 0;
    this.state.players.set(sessionId, bee);
    this.bees.set(sessionId, new BeeController(this, sessionId, bee));
  }

  endMatch() {
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
    this.broadcast(MESSAGES.MATCH_END, {
      winnerTeam,
      scoreTeam1: this.state.scoreTeam1,
      scoreTeam2: this.state.scoreTeam2,
      players,
    });
    this.logEvent(LOG_EVENTS.MATCH_END, { winnerTeam });
    console.log(
      `[room ${this.displayName}] MATCH END — winner: team ${winnerTeam} | JADE ${this.state.scoreTeam1} — ${this.state.scoreTeam2} CRIMSON`,
    );

    this.state.scoreTeam1 = 0;
    this.state.scoreTeam2 = 0;
    const arrowIds = Array.from(this.state.arrows.keys());
    for (const id of arrowIds) this.state.arrows.delete(id);
    if (this.map.flag) {
      this.state.flag.x = this.map.flag.x;
      this.state.flag.y = this.map.flag.y;
      this.state.flag.carrierId = '';
      this.state.flag.vx = 0;
      this.state.flag.vy = 0;
    }
    this.state.players.forEach((p) => {
      p.team = 0;
      p.color = 0;
      p.alive = false;
      p.hp = PLAYER.MAX_HP;
      p.respawnAt = 0;
      p.kills = 0;
      p.deaths = 0;
      p.captures = 0;
    });
    this.updateMetadata();
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

      const prevX = arrow.x;
      const prevY = arrow.y;

      arrow.vy += PHYSICS.GRAVITY * dt;
      arrow.x += arrow.vx * dt;
      arrow.y += arrow.vy * dt;

      if (arrow.x < 0 || arrow.x > this.map.pixelWidth || arrow.y > this.map.pixelHeight + 80) {
        remove.push(id);
        return;
      }

      const playerHit = this.sweepArrowAgainstPlayers(arrow, prevX, prevY, now);
      const wallHit = this.sweepArrowAgainstWalls(prevX, prevY, arrow.x, arrow.y);

      if (playerHit && (!wallHit || playerHit.t <= wallHit.t)) {
        const { target, pid, x, y } = playerHit;
        arrow.x = x;
        arrow.y = y;
        arrow.stuckToId = pid;
        arrow.stuckOffsetX = x - target.x;
        arrow.stuckOffsetY = y - target.y;
        arrow.stuckFacing = target.facing || 1;
        this.applyHit(arrow, target, pid);
        arrow.stuck = true;
        arrow.vx = 0;
        arrow.vy = 0;
        arrow.spawnedAt = now;
        return;
      }

      if (wallHit) {
        arrow.x = wallHit.x;
        arrow.y = wallHit.y;
        arrow.stuck = true;
        arrow.vx = 0;
        arrow.vy = 0;
        arrow.spawnedAt = now;
      }
    });

    for (const id of remove) this.state.arrows.delete(id);

    if (this.bees) {
      this.bees.forEach((ctrl) => ctrl.tick(dt, now));
    }

    if (this._beeRemovals?.length) {
      for (let i = this._beeRemovals.length - 1; i >= 0; i--) {
        if (now >= this._beeRemovals[i].at) {
          const { id } = this._beeRemovals[i];
          this.state.players.delete(id);
          this.bees?.delete(id);
          this._beeRemovals.splice(i, 1);
        }
      }
    }

    if (this.mode === 'bee') this.tickBeeWaves(now);
    if (this.mode !== 'dm' && this.mode !== 'bee') this.tickFlag(dt);
    this.tickRespawns(now);
    if (this.mode === 'dm') this.tickDeathmatch();
  }

  tickBeeWaves(now) {
    if (!this.bees || this.bees.size > 0) {
      this.nextWaveAt = 0;
      return;
    }
    const hasHumans = Array.from(this.state.players.values()).some(
      (p) => p.kind !== 'bee' && p.team !== 0,
    );
    if (!hasHumans) {
      this.nextWaveAt = 0;
      return;
    }
    if (!this.nextWaveAt) {
      this.nextWaveAt = now + 2000;
      return;
    }
    if (now >= this.nextWaveAt) {
      this.beeWave = (this.beeWave ?? 0) + 1;
      this.spawnBeeWave(this.beeWave);
      this.nextWaveAt = 0;
    }
  }

  tickDeathmatch() {
    if (this._matchEnded) return;
    let team1Kills = 0;
    let team2Kills = 0;
    this.state.players.forEach((p) => {
      if (p.team === 1) team1Kills += p.kills;
      else if (p.team === 2) team2Kills += p.kills;
    });
    this.state.scoreTeam1 = team1Kills;
    this.state.scoreTeam2 = team2Kills;
    if (team1Kills >= DEATHMATCH.KILLS_TO_WIN || team2Kills >= DEATHMATCH.KILLS_TO_WIN) {
      this._matchEnded = true;
      this.endMatch();
      this._matchEnded = false;
    }
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
      p.hp = p.kind === 'bee' ? BEE.HP : PLAYER.MAX_HP;
      p.alive = true;
      p.respawnAt = 0;
      p.spawnProtectionUntil = p.kind === 'bee' ? 0 : now + SPAWN_PROTECTION.DURATION_MS;
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

    if (flag.y > this.map.pixelHeight + 80) {
      flag.x = flag.homeX;
      flag.y = flag.homeY;
      flag.vx = 0;
      flag.vy = 0;
      return;
    }

    const flagBottom = flag.y + FLAG.POLE_HEIGHT / 2;
    const flagTop = flag.y - FLAG.POLE_HEIGHT / 2;
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

    if (this.map.solidWalls) {
      for (const w of this.map.solidWalls) {
        const wTop = w.y - w.h / 2;
        const wBottom = w.y + w.h / 2;
        const wLeft = w.x - w.w / 2;
        const wRight = w.x + w.w / 2;
        const overlapY = flagBottom > wTop && flagTop < wBottom;
        const overlapX = flag.x > wLeft && flag.x < wRight;

        if (
          flag.vy > 0 &&
          overlapX &&
          flagBottom >= wTop &&
          flagBottom <= wTop + Math.abs(flag.vy * dt) + 6
        ) {
          flag.y = wTop - FLAG.POLE_HEIGHT / 2;
          flag.vy = 0;
          flag.vx *= 0.4;
          continue;
        }

        if (
          flag.vy < 0 &&
          overlapX &&
          flagTop <= wBottom &&
          flagTop >= wBottom - Math.abs(flag.vy * dt) - 6
        ) {
          flag.y = wBottom + FLAG.POLE_HEIGHT / 2;
          flag.vy = 0;
          continue;
        }

        if (overlapY && overlapX) {
          if (flag.vx > 0) {
            flag.x = wLeft;
            flag.vx = 0;
          } else if (flag.vx < 0) {
            flag.x = wRight;
            flag.vx = 0;
          }
        }
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
    if (this.map.solidWalls) {
      for (const w of this.map.solidWalls) {
        const top = w.y - w.h / 2;
        const bottom = w.y + w.h / 2;
        const left = w.x - w.w / 2;
        const right = w.x + w.w / 2;
        if (x >= left && x <= right && y >= top && y <= bottom) return true;
      }
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

  sweepArrowAgainstWalls(x1, y1, x2, y2) {
    let best = null;
    for (const wall of this.map.walls) {
      const top = wall.y - wall.h / 2;
      const bottom = top + TILE.WALL_THICKNESS;
      const left = wall.x - wall.w / 2;
      const right = wall.x + wall.w / 2;
      const hit = segmentVsAabb(x1, y1, x2, y2, left, top, right, bottom);
      if (hit && (!best || hit.t < best.t)) best = hit;
    }
    if (this.map.solidWalls) {
      for (const w of this.map.solidWalls) {
        const top = w.y - w.h / 2;
        const bottom = w.y + w.h / 2;
        const left = w.x - w.w / 2;
        const right = w.x + w.w / 2;
        const hit = segmentVsAabb(x1, y1, x2, y2, left, top, right, bottom);
        if (hit && (!best || hit.t < best.t)) best = hit;
      }
    }
    return best;
  }

  sweepArrowAgainstPlayers(arrow, prevX, prevY, now) {
    let best = null;
    for (const [pid, target] of this.state.players) {
      if (pid === arrow.shooterId) continue;
      if (!target.alive) continue;
      if (arrow.shooterTeam !== 0 && target.team === arrow.shooterTeam) continue;
      if (target.spawnProtectionUntil && now < target.spawnProtectionUntil) continue;
      if (now - target.lastHitAt < HIT.IFRAMES_MS) continue;
      const halfW = (target.kind === 'bee' ? BEE.WIDTH : PLAYER.WIDTH) / 2;
      const halfH = (target.kind === 'bee' ? BEE.HEIGHT : PLAYER.HEIGHT) / 2;
      const hit = segmentVsAabb(
        prevX, prevY,
        arrow.x, arrow.y,
        target.x - halfW,
        target.y - halfH,
        target.x + halfW,
        target.y + halfH,
      );
      if (hit && (!best || hit.t < best.t)) best = { target, pid, x: hit.x, y: hit.y, t: hit.t };
    }
    return best;
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
      this.logEvent(LOG_EVENTS.KILL, {
        shooter: shooter?.name ?? '?',
        shooterTeam: shooter?.team ?? 0,
        victim: target.name,
        victimTeam: target.team,
      });
      if (target.kind === 'bee') {
        const stuckIds = [];
        this.state.arrows.forEach((a, id) => {
          if (a.stuckToId === targetId) stuckIds.push(id);
        });
        for (const id of stuckIds) this.state.arrows.delete(id);
        this.state.scoreTeam1 = (this.state.scoreTeam1 ?? 0) + 1;
        if (!this._beeRemovals) this._beeRemovals = [];
        this._beeRemovals.push({ id: targetId, at: Date.now() + 250 });
      }
    }

    if (this.mode !== 'dm' && this.state.flag.carrierId === targetId) {
      this.state.flag.carrierId = '';
      this.state.flag.x = target.x;
      this.state.flag.y = target.y;
      this.state.flag.vx = arrow.vx * 0.35;
      this.state.flag.vy = -220;
    }

    const knockX = arrow.vx * ARROW.KNOCKBACK_MULT;
    const knockY = arrow.vy * ARROW.KNOCKBACK_MULT - ARROW.KNOCKBACK_UP;

    if (target.kind === 'bee' && target.alive) {
      this.bees?.get(targetId)?.applyKnockback(knockX, knockY);
    }

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

  applyBeeMelee(attackerId, target, targetId, knockX, knockY) {
    const damage = BEE.MELEE_DAMAGE;
    const wasAlive = target.alive;
    target.hp = Math.max(0, target.hp - damage);
    target.lastHitAt = Date.now();
    if (target.hp <= 0 && wasAlive) {
      target.alive = false;
      target.deaths++;
      target.respawnAt = Date.now() + RESPAWN.COOLDOWN_MS;
      const attacker = this.state.players.get(attackerId);
      if (attacker) attacker.kills++;
      this.logEvent(LOG_EVENTS.KILL, {
        shooter: attacker?.name ?? '?',
        shooterTeam: attacker?.team ?? 0,
        victim: target.name,
        victimTeam: target.team,
      });
    }
    if (this.mode !== 'dm' && this.mode !== 'bee' && this.state.flag.carrierId === targetId) {
      this.state.flag.carrierId = '';
      this.state.flag.x = target.x;
      this.state.flag.y = target.y;
      this.state.flag.vx = knockX * 0.5;
      this.state.flag.vy = -220;
    }
    this.broadcast(MESSAGES.HIT, {
      targetId,
      shooterId: attackerId,
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
    player.skin = normalizeSkin(options?.skin);
    player.team = 0;
    player.alive = false;
    this.state.players.set(client.sessionId, player);
    this.joinCount++;
    if (this.mode === 'bee') this._autoAssignBee(player);
    this.updateMetadata();
    this.logEvent(LOG_EVENTS.JOIN, { name });
    console.log(`[room ${this.displayName}] +${name} (waiting for team, ${this.state.players.size})`);
  }

  _autoAssignBee(player) {
    player.team = 1;
    player.color = PLAYER_COLORS[0];
    player.alive = true;
    player.hp = PLAYER.MAX_HP;
    player.respawnAt = 0;
    player.kills = 0;
    player.deaths = 0;
    player.spawnProtectionUntil = Date.now() + SPAWN_PROTECTION.DURATION_MS;
    const base = this.bases?.[1] ?? { x: 80, y: this.map.pixelHeight - 100 };
    player.x = base.x;
    player.y = base.y;
    player.vx = 0;
    player.vy = 0;
  }

  async onLeave(client, consented) {
    const player = this.state.players.get(client.sessionId);
    if (consented || !player || this.mode === 'bee') {
      this._cleanupClient(client);
      return;
    }
    try {
      await this.allowReconnection(client, 15);
      console.log(`[room ${this.displayName}] reconnected ${player.name}`);
    } catch (e) {
      this._cleanupClient(client);
    }
  }

  _cleanupClient(client) {
    const player = this.state.players.get(client.sessionId);
    if (this.state.flag.carrierId === client.sessionId) {
      this.state.flag.carrierId = '';
      this.state.flag.vx = 0;
      this.state.flag.vy = 0;
      if (player) {
        this.state.flag.x = player.x;
        this.state.flag.y = player.y;
      }
    }
    this.state.players.delete(client.sessionId);
    this._lastShotAt?.delete(client.sessionId);
    this._lastChatAt?.delete(client.sessionId);
    this.updateMetadata();
    if (player) this.logEvent(LOG_EVENTS.LEAVE, { name: player.name });
    console.log(`[room ${this.displayName}] -${client.sessionId} (${this.state.players.size})`);
  }

  logEvent(type, payload = {}) {
    this.broadcast(MESSAGES.LOG, { type, t: Date.now(), ...payload });
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
      maxPlayers: this.playerCap,
      scoreTarget: this.scoreTarget,
      mode: this.mode,
      mapId: this.mapId,
    });
  }
}

function segmentVsAabb(x1, y1, x2, y2, left, top, right, bottom) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  let tmin = 0;
  let tmax = 1;

  if (Math.abs(dx) < 1e-9) {
    if (x1 < left || x1 > right) return null;
  } else {
    const t1 = (left - x1) / dx;
    const t2 = (right - x1) / dx;
    const lo = Math.min(t1, t2);
    const hi = Math.max(t1, t2);
    if (lo > tmin) tmin = lo;
    if (hi < tmax) tmax = hi;
    if (tmin > tmax) return null;
  }

  if (Math.abs(dy) < 1e-9) {
    if (y1 < top || y1 > bottom) return null;
  } else {
    const t1 = (top - y1) / dy;
    const t2 = (bottom - y1) / dy;
    const lo = Math.min(t1, t2);
    const hi = Math.max(t1, t2);
    if (lo > tmin) tmin = lo;
    if (hi < tmax) tmax = hi;
    if (tmin > tmax) return null;
  }

  if (tmin < 0) tmin = 0;
  if (tmin > 1) return null;

  return {
    t: tmin,
    x: x1 + tmin * dx,
    y: y1 + tmin * dy,
  };
}
