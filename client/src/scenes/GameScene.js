import Phaser from 'phaser';
import { FLAG, GAME, PLAYER, WORLD } from '@boxfury/shared';
import { Player } from '../entities/Player.js';
import { RemotePlayer } from '../entities/RemotePlayer.js';
import { Arrow } from '../entities/Arrow.js';
import { Level } from '../entities/Level.js';
import { NetworkManager } from '../network/NetworkManager.js';

export class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
    this.remotes = new Map();
    this.arrows = new Map();
  }

  async create() {
    this.cursors = this.input.keyboard.createCursorKeys();
    this.level = new Level(this);
    this.cameras.main.setBounds(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
    this.network = new NetworkManager();

    this.statusText = this.add
      .text(WORLD.WIDTH / 2, WORLD.HEIGHT / 2, 'Connecting…', {
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: '14px',
        color: '#8a8a9e',
      })
      .setOrigin(0.5)
      .setScrollFactor(0);

    this._tabKeydown = (e) => {
      if (e.key !== 'Tab') return;
      e.preventDefault();
      if (e.repeat) return;
      this.showScoreboard();
    };
    this._tabKeyup = (e) => {
      if (e.key !== 'Tab') return;
      e.preventDefault();
      this.hideScoreboard();
    };
    window.addEventListener('keydown', this._tabKeydown);
    window.addEventListener('keyup', this._tabKeyup);

    this.events.once('shutdown', () => {
      this.hideTeamPicker();
      this.hideHud();
      this.hideScoreboard();
      window.removeEventListener('keydown', this._tabKeydown);
      window.removeEventListener('keyup', this._tabKeyup);
      this.network?.disconnect();
    });

    const connectOptions = this.registry.get('connectOptions') ?? {};
    this.isSpectator = false;
    let room;
    try {
      room = await this.network.connect(connectOptions);
    } catch (err) {
      this.statusText.setText(`Connection failed: ${err.message}`);
      this.statusText.setColor('#ff5470');
      console.error('[scene] connect failed', err);
      return;
    }

    const $ = this.network.$;

    const spawnRemote = (sessionId, player) => {
      if (this.remotes.has(sessionId)) return;
      const remote = new RemotePlayer(this, {
        id: sessionId,
        x: player.x,
        y: player.y,
        color: player.color,
        facing: player.facing,
        bowAngle: player.bowAngle,
      });
      this.remotes.set(sessionId, remote);
      if (this.flagCarrierId === sessionId) remote.setCarryingFlag(true);
    };

    const handleAdd = (player, sessionId) => {
      const isLocal = sessionId === room.sessionId;
      const trySpawn = () => {
        if (player.team === 0) return;
        if (isLocal) {
          if (this.player) return;
          this.hideTeamPicker();
          this.spawnLocalPlayer(player.color, player.team);
          if (room.state.flag?.carrierId === sessionId) this.player.setCarryingFlag(true);
        } else {
          spawnRemote(sessionId, player);
        }
      };

      if (isLocal && player.team === 0 && !this.isSpectator) this.showTeamPicker();
      trySpawn();
      this.updateTeamCounts();

      $(player).onChange(() => {
        trySpawn();
        const remote = this.remotes.get(sessionId);
        if (remote) {
          remote.applyState({
            x: player.x,
            y: player.y,
            facing: player.facing,
            bowAngle: player.bowAngle,
          });
        }
        this.updateTeamCounts();
      });
    };

    $(room.state).players.onAdd(handleAdd);

    $(room.state).players.onRemove((_player, sessionId) => {
      const remote = this.remotes.get(sessionId);
      if (remote) {
        remote.destroy();
        this.remotes.delete(sessionId);
      }
      this.updateTeamCounts();
    });

    $(room.state).arrows.onAdd((arrowState, id) => {
      const arrow = new Arrow(this, arrowState);
      this.arrows.set(id, arrow);
      $(arrowState).onChange(() => arrow.applyState(arrowState));
    });

    $(room.state).arrows.onRemove((_arrowState, id) => {
      const arrow = this.arrows.get(id);
      if (!arrow) return;
      arrow.destroy();
      this.arrows.delete(id);
    });

    this.network.onHit((payload) => this.handleHit(payload));

    this.flagCarrierId = '';
    if (this.level.flag) this.level.flag.applyState(room.state.flag);
  }

  syncFlag() {
    const flagState = this.network?.room?.state?.flag;
    if (!flagState || !this.level.flag) return;
    const carrierId = flagState.carrierId || '';
    if (carrierId !== this.flagCarrierId) {
      const prev = this.flagCarrierId;
      this.flagCarrierId = carrierId;
      if (prev) this.findPlayer(prev)?.setCarryingFlag?.(false);
      if (carrierId) this.findPlayer(carrierId)?.setCarryingFlag?.(true);
    }
    if (carrierId) {
      const carrier = this.findPlayer(carrierId);
      if (carrier?.sprite) {
        this.level.flag.applyState({
          x: carrier.sprite.x,
          y: carrier.sprite.y + FLAG.CARRY_OFFSET_Y,
        });
        return;
      }
    }
    this.level.flag.applyState(flagState);
  }

  handleHit({ targetId, knockX, knockY }) {
    const target = this.findPlayer(targetId);
    if (!target) return;
    target.flashHit();
    if (target === this.player) {
      this.player.applyKnockback(knockX, knockY);
      this.cameras.main.shake(140, 0.006);
    }
  }

  findPlayer(id) {
    if (this.player?.id === id) return this.player;
    return this.remotes.get(id) ?? null;
  }

  spawnLocalPlayer(color, team = 1) {
    this.statusText?.destroy();
    this.statusText = null;
    const baseKey = team === 2 ? 'team2' : 'team1';
    const spawn = this.level.map.bases[baseKey]
      ?? this.level.map.bases.team1
      ?? this.level.map.bases.team2
      ?? { x: WORLD.WIDTH / 2, y: WORLD.HEIGHT / 2 - 100 };
    console.log('[spawn]', { team, x: spawn.x, y: spawn.y, color: '0x' + color.toString(16) });
    this.player = new Player(this, {
      id: this.network.sessionId,
      x: spawn.x,
      y: spawn.y,
      color,
    });
    this.physics.add.collider(this.player.sprite, this.level.platforms);

    const cam = this.cameras.main;
    if (GAME.ZOOM_ENABLED) {
      cam.setZoom(GAME.ZOOM);
      cam.startFollow(this.player.sprite, true, GAME.CAMERA_LERP, GAME.CAMERA_LERP);
    } else {
      cam.setZoom(1);
      cam.centerOn(this.player.sprite.x, this.player.sprite.y);
    }

    this.spawnPulse(spawn.x, spawn.y, color);
    this.attachLocalIndicator(color);
    this.showHud();
  }

  spawnPulse(x, y, color) {
    const ring = this.add.rectangle(x, y, 60, 90);
    ring.setStrokeStyle(3, color, 1);
    this.cameras.main.flash(220, 80, 80, 80);
    this.tweens.add({
      targets: ring,
      scaleX: 2.6,
      scaleY: 2.6,
      alpha: 0,
      duration: 1100,
      ease: 'Cubic.easeOut',
      onComplete: () => ring.destroy(),
    });
  }

  attachLocalIndicator(color) {
    const caret = this.add.text(0, 0, '▼', {
      fontFamily: 'JetBrains Mono, monospace',
      fontSize: '14px',
      color: '#' + color.toString(16).padStart(6, '0'),
    }).setOrigin(0.5, 1);
    this.player.indicator = caret;
  }

  toggleFlag() {
    this.network.sendFlagToggle();
  }

  joinTeam() {
    if (this.player) return;
    this.isSpectator = false;
    this.showTeamPicker();
  }

  setupSpectatorCamera() {
    this.spectatorCameraSet = true;
    const cam = this.cameras.main;
    cam.stopFollow();
    cam.setZoom(1);
    cam.centerOn(WORLD.WIDTH / 2, WORLD.HEIGHT / 2);
    this.showHud();
  }

  showTeamPicker() {
    const overlay = document.getElementById('team-picker');
    if (!overlay || this.teamPickerOpen) return;
    this.teamPickerOpen = true;
    overlay.classList.remove('hidden');
    this._teamPick1 = () => this.network.sendChooseTeam(1);
    this._teamPick2 = () => this.network.sendChooseTeam(2);
    this._teamPickSpec = () => {
      this.hideTeamPicker();
      this.isSpectator = true;
      this.setupSpectatorCamera();
    };
    document.getElementById('team-pick-1')?.addEventListener('click', this._teamPick1);
    document.getElementById('team-pick-2')?.addEventListener('click', this._teamPick2);
    document.getElementById('team-pick-spectate')?.addEventListener('click', this._teamPickSpec);
    this.updateTeamCounts();
  }

  hideTeamPicker() {
    const overlay = document.getElementById('team-picker');
    if (!overlay) return;
    overlay.classList.add('hidden');
    if (this._teamPick1) document.getElementById('team-pick-1')?.removeEventListener('click', this._teamPick1);
    if (this._teamPick2) document.getElementById('team-pick-2')?.removeEventListener('click', this._teamPick2);
    if (this._teamPickSpec) document.getElementById('team-pick-spectate')?.removeEventListener('click', this._teamPickSpec);
    this._teamPick1 = null;
    this._teamPick2 = null;
    this._teamPickSpec = null;
    this.teamPickerOpen = false;
  }

  showHud() {
    document.getElementById('hud')?.classList.remove('hidden');
  }

  hideHud() {
    document.getElementById('hud')?.classList.add('hidden');
  }

  syncScores() {
    const state = this.network?.room?.state;
    if (!state) return;
    const s1 = state.scoreTeam1 ?? 0;
    const s2 = state.scoreTeam2 ?? 0;
    if (s1 !== this._score1) {
      this._score1 = s1;
      const el = document.getElementById('score-1');
      if (el) el.textContent = String(s1);
    }
    if (s2 !== this._score2) {
      this._score2 = s2;
      const el = document.getElementById('score-2');
      if (el) el.textContent = String(s2);
    }
    let specCount = 0;
    state.players?.forEach?.((p) => { if (p.team === 0) specCount++; });
    if (specCount !== this._specCount) {
      this._specCount = specCount;
      const el = document.getElementById('hud-spectators');
      if (el) el.textContent = specCount === 0 ? 'no spectators' : `${specCount} watching`;
    }
  }

  showScoreboard() {
    const overlay = document.getElementById('scoreboard');
    if (!overlay || this.scoreboardOpen) return;
    this.scoreboardOpen = true;
    overlay.classList.remove('hidden');
    this.renderScoreboard();
  }

  hideScoreboard() {
    const overlay = document.getElementById('scoreboard');
    if (!overlay) return;
    overlay.classList.add('hidden');
    this.scoreboardOpen = false;
  }

  renderScoreboard() {
    const state = this.network?.room?.state;
    if (!state) return;
    const myId = this.network?.sessionId;
    const team1Rows = [];
    const team2Rows = [];
    const spectatorNames = [];
    state.players?.forEach?.((p, sessionId) => {
      const row = `<div class="scoreboard__row${sessionId === myId ? ' scoreboard__row--self' : ''}"><span>${escapeHtml(p.name || '?')}</span><span>${p.captures || 0}</span><span>${p.deaths || 0}</span></div>`;
      if (p.team === 1) team1Rows.push(row);
      else if (p.team === 2) team2Rows.push(row);
      else spectatorNames.push(p.name || '?');
    });
    const set = (sel, html) => {
      const el = document.querySelector(sel);
      if (el) el.innerHTML = html;
    };
    const setText = (sel, text) => {
      const el = document.querySelector(sel);
      if (el) el.textContent = text;
    };
    set('[data-sb-roster="1"]', team1Rows.join(''));
    set('[data-sb-roster="2"]', team2Rows.join(''));
    setText('[data-sb-score="1"]', String(state.scoreTeam1 ?? 0));
    setText('[data-sb-score="2"]', String(state.scoreTeam2 ?? 0));
    setText('[data-sb-spec-count]', String(spectatorNames.length));
    set('[data-sb-spectators]', spectatorNames.map((n) => `<span>${escapeHtml(n)}</span>`).join(''));
  }

  updateTeamCounts() {
    if (!this.teamPickerOpen) return;
    const players = this.network?.room?.state?.players;
    if (!players) return;
    let t1 = 0;
    let t2 = 0;
    players.forEach((p) => {
      if (p.team === 1) t1++;
      else if (p.team === 2) t2++;
    });
    const set = (team, count) => {
      const el = document.querySelector(`.team-pick__count[data-team="${team}"]`);
      if (el) el.textContent = `${count} player${count === 1 ? '' : 's'}`;
    };
    set(1, t1);
    set(2, t2);
  }

  update(_time, delta) {
    const dt = delta / 1000;
    if (this.player) {
      this.player.move({
        left: this.cursors.left.isDown,
        right: this.cursors.right.isDown,
        lockFacing: this.cursors.up.isDown,
      });
      if (this.cursors.up.isDown) this.player.jump();

      if (Phaser.Input.Keyboard.JustDown(this.cursors.down)) {
        this.toggleFlag();
      }

      if (this.cursors.space.isDown) {
        this.player.chargeBow();
      } else {
        const shot = this.player.releaseBow();
        if (shot) this.network.sendShoot(shot);
      }

      this.player.update(dt);
      this.network.sendState(this.player.getState());
      if (this.player.indicator) {
        this.player.indicator.setPosition(
          this.player.sprite.x,
          this.player.sprite.y - PLAYER.HEIGHT / 2 - 4,
        );
      }
    }

    this.syncFlag();
    this.syncScores();
    if (this.scoreboardOpen) this.renderScoreboard();
    for (const r of this.remotes.values()) r.update();
    for (const a of this.arrows.values()) a.update(dt);
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
