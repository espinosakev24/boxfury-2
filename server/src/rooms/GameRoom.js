import { Room } from 'colyseus';
import {
  ARROW,
  BOW,
  DEFAULT_MAP_ID,
  MAPS,
  MESSAGES,
  NETWORK,
  PLAYER,
  PLAYER_COLORS,
  TEAM,
  TICK_RATE,
  parseMap,
} from '@boxfury/shared';
import { GameState } from '../schemas/GameState.js';
import { Player } from '../schemas/Player.js';
import { Arrow } from '../schemas/Arrow.js';
import {
  arrowHitsPlayer,
  flagOverlapsHazard,
  flagPlayerOverlap,
  stepArrow,
  stepFlag,
  stepPlayer,
} from '../sim/physics.js';

const FLAG_CARRY_OFFSET = PLAYER.HEIGHT / 2 + 14;
const CAPTURE_RADIUS_TILES = 2;
const ARROW_LIFETIME_S = ARROW.LIFETIME_MS / 1000;

const emptyInput = () => ({ left: false, right: false, jump: false, down: false, charging: false });

export class GameRoom extends Room {
  maxClients = 16;
  patchRate = 1000 / NETWORK.PATCH_RATE;
  state = new GameState();

  onCreate(options = {}) {
    const mapId = options.mapId && MAPS[options.mapId] ? options.mapId : DEFAULT_MAP_ID;
    this.mapData = parseMap(MAPS[mapId]);
    this.state.mapId = mapId;

    this.runtime = new Map();
    this.spawnIndex = { jade: 0, crimson: 0 };
    this.joinCount = 0;
    this.captureRadiusPx = CAPTURE_RADIUS_TILES * this.mapData.tileSize;
    this.arrowSeq = 0;
    this.arrowAge = new Map();

    this.resetFlag();

    this.onMessage(MESSAGES.INPUT, (client, payload) => {
      const r = this.runtime.get(client.sessionId);
      if (!r) return;
      r.input = {
        left: !!payload.left,
        right: !!payload.right,
        jump: !!payload.jump,
        down: !!payload.down,
        charging: !!payload.charging,
      };
    });

    this.setSimulationInterval((dt) => this.tick(dt / 1000), 1000 / TICK_RATE);
  }

  onJoin(client) {
    const team = (this.joinCount % 2 === 0) ? TEAM.JADE : TEAM.CRIMSON;
    const color = PLAYER_COLORS[this.joinCount % PLAYER_COLORS.length];
    this.joinCount++;

    const player = new Player({ color, team });
    this.spawnPlayerAt(player, team);
    this.state.players.set(client.sessionId, player);
    this.runtime.set(client.sessionId, {
      input: emptyInput(),
      prevInput: emptyInput(),
      grounded: false,
      groundedOnOneWay: false,
    });
    console.log(`[room] +${client.sessionId} (${team}, ${this.state.players.size} online)`);
  }

  onLeave(client) {
    if (this.state.flag.carrierId === client.sessionId) {
      this.dropFlagAt(this.state.players.get(client.sessionId));
    }
    this.state.players.delete(client.sessionId);
    this.runtime.delete(client.sessionId);
    console.log(`[room] -${client.sessionId} (${this.state.players.size} online)`);
  }

  spawnPlayerAt(player, team) {
    const list = this.mapData.spawns[team];
    if (!list || list.length === 0) {
      player.x = 100;
      player.y = 100;
    } else {
      const idx = this.spawnIndex[team] % list.length;
      this.spawnIndex[team]++;
      const spawn = list[idx];
      player.x = spawn.x;
      player.y = spawn.y - PLAYER.HEIGHT / 2;
    }
    player.vx = 0;
    player.vy = 0;
    player.bowAngle = BOW.MIN_ANGLE;
  }

  resetFlag() {
    const base = this.mapData.flagBase;
    this.state.flag.x = base ? base.x : 100;
    this.state.flag.y = base ? base.y : 100;
    this.state.flag.vx = 0;
    this.state.flag.vy = 0;
    this.state.flag.carrierId = '';
    this.state.flag.team = '';
  }

  dropFlagAt(player) {
    if (!player) return this.resetFlag();
    this.state.flag.x = player.x;
    this.state.flag.y = player.y;
    this.state.flag.vx = 0;
    this.state.flag.vy = -100;
    this.state.flag.carrierId = '';
    this.state.flag.team = '';
  }

  spawnArrow(player, angleDeg = player.bowAngle) {
    const rad = ((90 - angleDeg) * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const facingMul = player.facing > 0 ? 1 : -1;
    const muzzle = BOW.LENGTH + 6;
    const arrow = new Arrow({
      x: player.x + cos * facingMul * muzzle,
      y: player.y + sin * muzzle,
      vx: cos * facingMul * ARROW.SPEED,
      vy: sin * ARROW.SPEED,
      shooterId: this.getShooterIdForPlayer(player),
    });
    arrow.rotation = Math.atan2(arrow.vy, arrow.vx);
    const id = `a${this.arrowSeq++}`;
    this.state.arrows.set(id, arrow);
    this.arrowAge.set(id, 0);
  }

  getShooterIdForPlayer(player) {
    for (const [sid, p] of this.state.players) {
      if (p === player) return sid;
    }
    return '';
  }

  tick(dt) {
    const flag = this.state.flag;
    const players = this.state.players;
    const runtimes = this.runtime;

    for (const [sid, player] of players) {
      const r = runtimes.get(sid);
      if (!r) continue;

      Object.assign(player, { grounded: r.grounded, groundedOnOneWay: r.groundedOnOneWay });
      stepPlayer(player, r.input, r.prevInput, dt, this.mapData);
      r.grounded = player.grounded;
      r.groundedOnOneWay = player.groundedOnOneWay;

      if (r.input.charging) {
        player.bowAngle = Math.min(BOW.MAX_ANGLE, player.bowAngle + BOW.CHARGE_RATE * dt);
      } else {
        player.bowAngle = BOW.MIN_ANGLE;
      }

      const chargingFalling = r.prevInput.charging && !r.input.charging;
      if (chargingFalling && flag.carrierId !== sid) {
        const launchAngle = Math.max(BOW.MIN_ANGLE, r.lastChargedAngle ?? BOW.MIN_ANGLE);
        this.spawnArrow(player, launchAngle);
      }
      if (r.input.charging) r.lastChargedAngle = player.bowAngle;

      r.prevInput = { ...r.input };

      if (player.hitHazard) {
        if (flag.carrierId === sid) this.dropFlagAt(player);
        this.spawnPlayerAt(player, player.team);
      }
    }

    for (const [sid, player] of players) {
      const r = runtimes.get(sid);
      if (!r) continue;
      const downRising = r.input.down && !(r._prevDownToggle ?? false);
      r._prevDownToggle = r.input.down;
      if (!downRising) continue;

      if (flag.carrierId === sid) {
        this.dropFlagAt(player);
      } else if (!flag.carrierId && flagPlayerOverlap(flag, player)) {
        flag.carrierId = sid;
        flag.team = player.team;
      }
    }

    if (flag.carrierId) {
      const carrier = players.get(flag.carrierId);
      if (carrier) {
        flag.x = carrier.x;
        flag.y = carrier.y - FLAG_CARRY_OFFSET;
        flag.vx = 0;
        flag.vy = 0;

        const enemyTeam = carrier.team === TEAM.JADE ? TEAM.CRIMSON : TEAM.JADE;
        const enemySpawns = this.mapData.spawns[enemyTeam];
        for (const spawn of enemySpawns) {
          const dx = carrier.x - spawn.x;
          const dy = carrier.y - spawn.y;
          if (Math.hypot(dx, dy) <= this.captureRadiusPx) {
            if (carrier.team === TEAM.JADE) this.state.jadeScore++;
            else this.state.crimsonScore++;
            console.log(`[capture] ${carrier.team} → ${this.state.jadeScore}/${this.state.crimsonScore}`);
            this.resetFlag();
            break;
          }
        }
      } else {
        this.resetFlag();
      }
    } else {
      stepFlag(flag, dt, this.mapData);
      if (flagOverlapsHazard(flag, this.mapData.hazards) || flag.y > this.mapData.height * this.mapData.tileSize + 200) {
        this.resetFlag();
      }
    }

    const arrowsToRemove = [];
    for (const [aid, arrow] of this.state.arrows) {
      const result = stepArrow(arrow, dt, this.mapData);
      let removed = !!result;
      if (!removed) {
        for (const [sid, target] of players) {
          if (sid === arrow.shooterId) continue;
          if (arrowHitsPlayer(arrow, target)) {
            if (flag.carrierId === sid) this.dropFlagAt(target);
            this.spawnPlayerAt(target, target.team);
            removed = true;
            break;
          }
        }
      }
      const age = (this.arrowAge.get(aid) ?? 0) + dt;
      this.arrowAge.set(aid, age);
      if (age > ARROW_LIFETIME_S) removed = true;
      if (removed) arrowsToRemove.push(aid);
    }
    for (const aid of arrowsToRemove) {
      this.state.arrows.delete(aid);
      this.arrowAge.delete(aid);
    }
  }
}
