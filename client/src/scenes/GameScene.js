import Phaser from 'phaser';
import { ARROW, BOW } from '@boxfury/shared';
import { Player } from '../entities/Player.js';
import { Flag } from '../entities/Flag.js';
import { Arrow } from '../entities/Arrow.js';
import { GameMap } from '../entities/Map.js';
import { NetworkManager } from '../network/NetworkManager.js';

export class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
    this.players = new Map();
    this.arrows = new Map();
    this.localArrows = [];
    this.localPlayer = null;
    this._wasCharging = false;
  }

  async create() {
    this.cursors = this.input.keyboard.createCursorKeys();
    this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.network = new NetworkManager();

    this.statusText = this.add
      .text(640, 360, 'Connecting…', {
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: '14px',
        color: '#8a8a9e',
      })
      .setOrigin(0.5)
      .setDepth(20);

    this.events.once('shutdown', () => this.network?.disconnect());

    let room;
    try {
      room = await this.network.connect();
    } catch (err) {
      this.statusText.setText(`Connection failed: ${err.message}`);
      this.statusText.setColor('#ff5470');
      return;
    }

    this.statusText.destroy();
    this.statusText = null;

    const $ = this.network.$;

    this.gameMap = new GameMap(this, room.state.mapId || 'default');
    this.emitHud({
      map: this.gameMap.name,
      jade: room.state.jadeScore || 0,
      crimson: room.state.crimsonScore || 0,
    });

    $(room.state).listen('mapId', (id) => {
      if (this.gameMap?.def?.id === id) return;
      this.emitHud({ map: id?.toUpperCase?.() ?? 'DEFAULT' });
    });
    $(room.state).listen('jadeScore', (v) => this.emitHud({ jade: v }));
    $(room.state).listen('crimsonScore', (v) => this.emitHud({ crimson: v }));

    const setupFlag = () => {
      const f = room.state.flag;
      if (!f || this.flag) return;
      this.flag = new Flag(this, { x: f.x || 0, y: f.y || 0 });
      this.flag.applyState({ x: f.x, y: f.y, carrierId: f.carrierId, team: f.team });
      $(f).onChange(() => {
        this.flag.applyState({ x: f.x, y: f.y, carrierId: f.carrierId, team: f.team });
      });
    };
    setupFlag();
    $(room.state).listen('flag', setupFlag);

    $(room.state).players.onAdd((p, sid) => {
      if (this.players.has(sid)) return;
      const sprite = new Player(this, {
        id: sid,
        x: p.x,
        y: p.y,
        color: p.color,
        facing: p.facing,
        bowAngle: p.bowAngle,
        isLocal: sid === room.sessionId,
      });
      this.players.set(sid, sprite);
      if (sid === room.sessionId) this.localPlayer = sprite;
      $(p).onChange(() => sprite.applyState({
        x: p.x, y: p.y, facing: p.facing, bowAngle: p.bowAngle,
      }));
    });

    $(room.state).players.onRemove((_p, sid) => {
      const s = this.players.get(sid);
      if (!s) return;
      if (this.localPlayer === s) this.localPlayer = null;
      s.destroy();
      this.players.delete(sid);
    });

    $(room.state).arrows.onAdd((a, aid) => {
      if (a.shooterId === room.sessionId) return; // local prediction owns this
      if (this.arrows.has(aid)) return;
      const arrow = new Arrow(this, { x: a.x, y: a.y, rotation: a.rotation });
      this.arrows.set(aid, arrow);
      $(a).onChange(() => arrow.applyState({ x: a.x, y: a.y, rotation: a.rotation }));
    });
    $(room.state).arrows.onRemove((_a, aid) => {
      const arrow = this.arrows.get(aid);
      if (!arrow) return;
      arrow.destroy();
      this.arrows.delete(aid);
    });
  }

  spawnLocalArrow(angleDeg) {
    if (!this.localPlayer) return;
    const rad = ((90 - angleDeg) * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const facingMul = this.localPlayer.facing > 0 ? 1 : -1;
    const muzzle = BOW.LENGTH + 6;
    const vx = cos * facingMul * ARROW.SPEED;
    const vy = sin * ARROW.SPEED;
    const arrow = new Arrow(this, {
      x: this.localPlayer.sprite.x + cos * facingMul * muzzle,
      y: this.localPlayer.sprite.y + sin * muzzle,
      rotation: Math.atan2(vy, vx),
      vx,
      vy,
      local: true,
    });
    this.localArrows.push(arrow);
  }

  emitHud(detail) {
    window.dispatchEvent(new CustomEvent('boxfury:hud', { detail }));
  }

  update(_time, delta) {
    const dt = delta / 1000;

    if (this.network?.room && this.cursors) {
      const charging = this.spaceKey.isDown;

      if (this.localPlayer) {
        if (charging) {
          this.localPlayer.bow.angle = Math.min(
            BOW.MAX_ANGLE,
            this.localPlayer.bow.angle + BOW.CHARGE_RATE * dt,
          );
        } else {
          if (this._wasCharging) {
            const launchAngle = this.localPlayer.bow.angle;
            const carrying = this.network.room.state.flag?.carrierId === this.network.sessionId;
            if (!carrying) this.spawnLocalArrow(launchAngle);
          }
          this.localPlayer.bow.setAngle(BOW.MIN_ANGLE);
        }
      }
      this._wasCharging = charging;

      this.network.sendInput({
        left: this.cursors.left.isDown,
        right: this.cursors.right.isDown,
        jump: this.cursors.up.isDown,
        down: this.cursors.down.isDown,
        charging,
      });
    }

    for (const p of this.players.values()) p.update();
    for (const a of this.arrows.values()) a.update(dt);
    for (let i = this.localArrows.length - 1; i >= 0; i--) {
      const a = this.localArrows[i];
      a.update(dt);
      if (!a.alive) this.localArrows.splice(i, 1);
    }
    this.flag?.update();
  }
}
