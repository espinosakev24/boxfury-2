import Phaser from 'phaser';
import { ARROW, BOW, FLAG, GAME, PLAYER, ROOM, TILE, WORLD } from '@boxfury/shared';
import { openMapPicker } from '../map-picker.js';
import { Player } from '../entities/Player.js';
import { RemotePlayer } from '../entities/RemotePlayer.js';
import { Bee } from '../entities/Bee.js';
import { Arrow } from '../entities/Arrow.js';
import { Level } from '../entities/Level.js';
import { NetworkManager } from '../network/NetworkManager.js';
import { LOG_EVENTS } from '@boxfury/shared';
import { pushEvent, setupEventLog, teardownEventLog } from '../event-log.js';
import { getKeyScheme } from '../keyscheme.js';
import { t } from '../i18n.js';
import { detectQualityTier } from '../fx/quality.js';
import { ensureFxTextures } from '../fx/textures.js';
import { FxManager } from '../fx/FxManager.js';
import { CameraFx } from '../fx/CameraFx.js';
import { PerfMonitor } from '../fx/perf.js';

export class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
    this.remotes = new Map();
    this.bees = new Map();
    this.arrows = new Map();
  }

  async create() {
    this._buildKeyMap();
    this._bindMouseAim();
    // Resolved once per game start (Canvas renderer always demotes to low);
    // no per-frame branching beyond integer compares downstream.
    this.quality = this.registry.get('quality') ?? detectQualityTier();
    if (this.renderer?.type !== Phaser.WEBGL) this.quality = 'low';
    ensureFxTextures(this);
    this.fx = new FxManager(this, this.quality);
    this.camFx = new CameraFx(this);
    this.perf = new PerfMonitor(this, {
      onDemote: (tier) => {
        this.quality = tier;
        this.fx?.setQuality(tier);
        // Rebuild the backdrop at the new tier — bands, tweens, and the
        // weather emitter are otherwise baked at construction.
        this.level?.rebuildBackdrop?.();
        if (this.renderer?.type === Phaser.WEBGL) this.cameras.main?.postFX?.clear();
      },
    });
    this.level = new Level(this);
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
      if (this._chatOpen) return;
      if (e.key !== 'Tab') return;
      e.preventDefault();
      if (e.repeat) return;
      this.showScoreboard();
    };
    this._tabKeyup = (e) => {
      if (this._chatOpen) return;
      if (e.key !== 'Tab') return;
      e.preventDefault();
      this.hideScoreboard();
    };
    window.addEventListener('keydown', this._tabKeydown);
    window.addEventListener('keyup', this._tabKeyup);

    this._chatKeydown = (e) => {
      if (this._chatOpen) {
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopImmediatePropagation();
          this._closeChat();
        }
        return;
      }
      if (e.key !== 't' && e.key !== 'T') return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      e.preventDefault();
      this._openChat();
    };
    window.addEventListener('keydown', this._chatKeydown);

    const chatInput = document.getElementById('chat-input');
    chatInput?.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') {
        const text = chatInput.value.trim();
        if (text) this.network?.sendChat(text);
        this._closeChat();
      } else if (e.key === 'Escape') {
        this._closeChat();
      }
    });
    chatInput?.addEventListener('blur', () => {
      if (this._chatOpen) this._closeChat();
    });

    this._visibilityHandler = () => {
      if (document.hidden) this._onTabHidden();
      else this._onTabVisible();
    };
    document.addEventListener('visibilitychange', this._visibilityHandler);

    const cleanup = () => {
      if (this._cleanedUp) return;
      this._cleanedUp = true;
      this.hideTeamPicker();
      this.hideHud();
      this.hideScoreboard();
      this.hideMatchEnd();
      this.hideDeathOverlay();
      teardownEventLog();
      window.removeEventListener('keydown', this._tabKeydown);
      window.removeEventListener('keyup', this._tabKeyup);
      if (this._chatKeydown)
        window.removeEventListener('keydown', this._chatKeydown);
      if (this._muteListener)
        window.removeEventListener('boxfury:mute', this._muteListener);
      if (this._keysListener)
        window.removeEventListener('boxfury:keys', this._keysListener);
      if (this._visibilityHandler)
        document.removeEventListener('visibilitychange', this._visibilityHandler);
      this.perf?.destroy();
      this.perf = null;
      this.camFx?.reset();
      this.camFx = null;
      this.fx?.destroy();
      this.fx = null;
      this.network?.disconnect();
    };
    // The app's only teardown path is leaveGame() -> game.destroy(true),
    // which emits 'destroy' WITHOUT a prior 'shutdown' — registering on
    // shutdown alone leaks every window/document listener across matches.
    this.events.once('shutdown', cleanup);
    this.events.once('destroy', cleanup);

    const connectOptions = this.registry.get('connectOptions') ?? {};
    this.autoTeam = connectOptions.autoTeam ?? 0;
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

    this.sound.mute = !!window.boxfuryMuted;
    this._muteListener = (e) => {
      this.sound.mute = !!e.detail?.muted;
    };
    window.addEventListener('boxfury:mute', this._muteListener);

    this._keysListener = () => this._rebuildKeyMap();
    window.addEventListener('boxfury:keys', this._keysListener);

    this.network.onStatusChange((status, newRoom) => {
      if (status === 'disconnected') this._showReconnectOverlay();
      else if (status === 'reconnected') this._handleReconnected(newRoom);
      else if (status === 'failed') this._handleReconnectFailed();
    });

    this._bindRoomState(room);
  }

  _bindRoomState(room) {
    // Colyseus onAdd callbacks fire immediately (synchronously) for every
    // item already in the state snapshot — on initial join AND on reconnect.
    // Suppress one-shot release FX during that replay; cleared at the end.
    this._suppressJoinFx = true;
    const $ = this.network.$;

    const spawnRemote = (sessionId, player) => {
      if (player.kind === 'bee') {
        if (this.bees.has(sessionId)) return;
        const bee = new Bee(this, { id: sessionId, x: player.x, y: player.y });
        this.bees.set(sessionId, bee);
        return;
      }
      if (this.remotes.has(sessionId)) return;
      const remote = new RemotePlayer(this, {
        id: sessionId,
        x: player.x,
        y: player.y,
        color: player.color,
        facing: player.facing,
        bowAngle: player.bowAngle,
        name: player.name,
        skin: player.skin,
      });
      this.remotes.set(sessionId, remote);
      if (this.flagCarrierId === sessionId) remote.setCarryingFlag(true);
    };

    const handleAdd = (player, sessionId) => {
      const isLocal = sessionId === room.sessionId;
      const trySpawn = () => {
        if (player.team === 0) {
          if (isLocal && this.player) {
            this.player.destroy();
            this.player = null;
            this.deathState = null;
            const cam = this.cameras.main;
            this.camFx?.reset();
            cam.stopFollow();
            cam.setZoom(1);
            const m = this.level.map;
            cam.centerOn(m.pixelWidth / 2, m.pixelHeight / 2);
            this.hideDeathOverlay();
          } else if (!isLocal) {
            const remote = this.remotes.get(sessionId);
            if (remote) {
              remote.destroy();
              this.remotes.delete(sessionId);
            }
          }
          return;
        }
        if (isLocal) {
          if (this.player) return;
          this.hideTeamPicker();
          this.spawnLocalPlayer(
            player.color,
            player.team,
            player.name,
            player.skin,
          );
          if (room.state.flag?.carrierId === sessionId)
            this.player.setCarryingFlag(true);
        } else {
          spawnRemote(sessionId, player);
        }
      };

      if (isLocal && player.team === 0 && !this.isSpectator) {
        if (this.autoTeam) this.network.sendChooseTeam(this.autoTeam);
        else this.showTeamPicker();
      }
      trySpawn();
      this.updateTeamCounts();

      $(player).onChange(() => {
        trySpawn();
        const remote = this.remotes.get(sessionId);
        if (remote) {
          remote.applyState({
            x: player.x,
            y: player.y,
            vy: player.vy,
            facing: player.facing,
            bowAngle: player.bowAngle,
            crouching: player.crouching,
          });
        }
        const bee = this.bees.get(sessionId);
        if (bee) {
          bee.applyState({ x: player.x, y: player.y });
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
      const bee = this.bees.get(sessionId);
      if (bee) {
        bee.destroy();
        this.bees.delete(sessionId);
      }
      this.updateTeamCounts();
    });

    $(room.state).arrows.onAdd((arrowState, id) => {
      // Remote shooters get the same release package the local player plays
      // in releaseBow, with recoil scaled by the pull reconstructed from the
      // arrow speed (exact inverse of the release formula). The local
      // shooter's package (snap, recoil, muzzle) already played at input
      // time — replaying it ~RTT later would detach it from the moving bow.
      if (
        !this._suppressJoinFx &&
        !arrowState.stuck &&
        arrowState.shooterId !== this.network.sessionId
      ) {
        const shooter = this.findPlayer(arrowState.shooterId);
        const speed = Math.hypot(arrowState.vx, arrowState.vy);
        const pull = Math.max(
          0,
          Math.min(1, (speed - ARROW.SPEED_MIN) / (ARROW.SPEED_MAX - ARROW.SPEED_MIN)),
        );
        shooter?.bow?.triggerSnap?.(pull);
        shooter?.playShotRecoil?.();
        const deg = Phaser.Math.RadToDeg(Math.atan2(arrowState.vy, arrowState.vx));
        this.fx?.muzzle(arrowState.x, arrowState.y, deg, shooter?.color ?? 0xffd84e);
      }
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
    this.network.onMatchEnd((payload) => this.showMatchEnd(payload));
    this.network.onMapChanged((payload) => this.handleMapChanged(payload));
    setupEventLog();
    this.network.onLog((payload) => {
      pushEvent(payload);
      if (payload?.type === LOG_EVENTS.CAPTURE)
        this._showCaptureBanner(payload);
    });
    this.network.onChat((payload) => this._handleChat(payload));

    $(room.state).listen('mapId', (newId) => {
      if (!newId || !this.level) return;
      if (this.level.mapId === newId) return;
      this.level.rebuild(newId);
      this.updateMatchEndMapTrigger?.();
    });

    this.flagCarrierId = '';
    if (this.level.flag && room.state.flag) this.level.flag.applyState(room.state.flag);
    this._suppressJoinFx = false;
  }

  _showReconnectOverlay() {
    document.getElementById('reconnect-overlay')?.classList.remove('hidden');
  }

  _hideReconnectOverlay() {
    document.getElementById('reconnect-overlay')?.classList.add('hidden');
  }

  _teardownEntities() {
    if (this.player) {
      this.player.destroy();
      this.player = null;
    }
    for (const remote of this.remotes.values()) remote.destroy();
    this.remotes.clear();
    for (const bee of this.bees.values()) bee.destroy();
    this.bees.clear();
    for (const arrow of this.arrows.values()) arrow.destroy();
    this.arrows.clear();
    this.flagCarrierId = '';
    this.deathState = null;
    this.hideDeathOverlay();
  }

  _handleReconnected(newRoom) {
    this._hideReconnectOverlay();
    this._teardownEntities();
    this._bindRoomState(newRoom);
  }

  _handleReconnectFailed() {
    this._hideReconnectOverlay();
    this.registry.get('leaveGame')?.();
  }

  _openChat() {
    const wrap = document.getElementById('chat-input-wrap');
    const input = document.getElementById('chat-input');
    if (!wrap || !input) return;
    this._chatOpen = true;
    if (this.player?.sprite?.body) {
      this.player.sprite.body.setVelocityX(0);
    }
    if (this.player) {
      this.player.charging = false;
      this.player.setCrouching?.(false);
    }
    if (this.input?.keyboard) {
      this.input.keyboard.resetKeys();
      this.input.keyboard.enabled = false;
    }
    wrap.classList.remove('hidden');
    input.value = '';
    input.focus();
  }

  _closeChat() {
    const wrap = document.getElementById('chat-input-wrap');
    const input = document.getElementById('chat-input');
    if (input) {
      input.value = '';
      input.blur();
    }
    if (wrap) wrap.classList.add('hidden');
    this._chatOpen = false;
    if (this.input?.keyboard) {
      this.input.keyboard.enabled = true;
      this.input.keyboard.resetKeys();
    }
    if (this.player?.sprite?.body) {
      this.player.sprite.body.setVelocityX(0);
    }
  }

  _onTabHidden() {
    this.player?._stopWalkSfx?.();
    this.player?._stopChargeSfx?.();
    if (this.input?.keyboard) this.input.keyboard.resetKeys();
    if (this.sound) this.sound.mute = true;
  }

  _onTabVisible() {
    if (this.input?.keyboard) this.input.keyboard.resetKeys();
    this.time.delayedCall(200, () => {
      if (this.sound) this.sound.mute = !!window.boxfuryMuted;
    });
  }

  _handleChat(payload) {
    if (!payload?.text) return;
    const target = this.findPlayer(payload.sessionId);
    target?.showChatBubble?.(payload.text);
  }

  _playDeathSound(volume = 0.5) {
    if (this.cache?.audio?.exists('player-death')) {
      this.sound.play('player-death', { volume });
    }
  }

  _playFlagDropSound() {
    const now = performance.now();
    if (this._lastFlagDropAt && now - this._lastFlagDropAt < 220) return;
    this._lastFlagDropAt = now;
    if (this.cache?.audio?.exists('flag-drop')) {
      this.sound.play('flag-drop', { volume: 0.45 });
    }
  }

  _showCaptureBanner({ name, team }) {
    const el = document.getElementById('capture-banner');
    if (!el) return;
    if (this.cache?.audio?.exists('score')) {
      this.sound.play('score', { volume: 0.55 });
    }
    const teamName = team === 1 ? 'JADE' : team === 2 ? 'CRIMSON' : '';
    const teamCls =
      team === 1
        ? 'capture-banner__team--p1'
        : team === 2
          ? 'capture-banner__team--p2'
          : '';
    const safeName = String(name ?? '?').replace(
      /[&<>"']/g,
      (c) =>
        ({
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#39;',
        })[c],
    );
    el.innerHTML = `<span class="${teamCls}">${teamName}</span> ${t('capture.banner')} <span style="opacity:0.7">· ${safeName}</span>`;
    el.classList.remove('hidden');
    requestAnimationFrame(() => el.classList.add('is-visible'));
    if (this._captureBannerTimer) clearTimeout(this._captureBannerTimer);
    this._captureBannerTimer = setTimeout(() => {
      el.classList.remove('is-visible');
      setTimeout(() => el.classList.add('hidden'), 240);
    }, 1700);
  }

  _buildKeyMap() {
    const kb = this.input.keyboard;
    const KC = Phaser.Input.Keyboard.KeyCodes;
    const scheme = getKeyScheme();
    const useArrows = scheme === 'arrows' || scheme === 'both';
    const useWasd = scheme === 'wasd' || scheme === 'both';
    const make = (codes) => codes.map((c) => kb.addKey(c));
    this.keyMap = {
      left: make([...(useArrows ? [KC.LEFT] : []), ...(useWasd ? [KC.A] : [])]),
      right: make([
        ...(useArrows ? [KC.RIGHT] : []),
        ...(useWasd ? [KC.D] : []),
      ]),
      up: make([...(useArrows ? [KC.UP] : []), ...(useWasd ? [KC.W] : [])]),
      down: make([...(useArrows ? [KC.DOWN] : []), ...(useWasd ? [KC.S] : [])]),
      space: make([KC.SPACE]),
      flag: make([KC.X]),
      zoomIn: make([KC.PLUS, KC.NUMPAD_ADD, KC.E]),
      zoomOut: make([KC.MINUS, KC.NUMPAD_SUBTRACT, KC.Q]),
      follow: make([KC.F]),
    };
  }

  _rebuildKeyMap() {
    const kb = this.input.keyboard;
    for (const action of Object.keys(this.keyMap || {})) {
      for (const key of this.keyMap[action]) kb.removeKey(key);
    }
    this._buildKeyMap();
  }

  isDown(action) {
    const keys = this.keyMap?.[action];
    if (!keys) return false;
    for (const k of keys) if (k.isDown) return true;
    return false;
  }

  justDown(action) {
    const keys = this.keyMap?.[action];
    if (!keys) return false;
    for (const k of keys) if (Phaser.Input.Keyboard.JustDown(k)) return true;
    return false;
  }

  _bindMouseAim() {
    this._mouseAiming = false;
    const canvas = this.game.canvas;
    if (!canvas) return;

    const screenToWorld = (clientX, clientY) => {
      const rect = canvas.getBoundingClientRect();
      const cam = this.cameras.main;
      const localX = ((clientX - rect.left) / rect.width) * canvas.width;
      const localY = ((clientY - rect.top) / rect.height) * canvas.height;
      return cam.getWorldPoint(localX, localY);
    };

    const onDown = (e) => {
      if (e.button !== 0) return;
      if (this._chatOpen || this.deathState) return;
      if (e.target !== canvas) return;
      this._mouseAiming = true;
      const wp = screenToWorld(e.clientX, e.clientY);
      this._mouseClientX = e.clientX;
      this._mouseClientY = e.clientY;
      this._mouseAimWorldX = wp.x;
      this._mouseAimWorldY = wp.y;
    };
    const onMove = (e) => {
      this._mouseClientX = e.clientX;
      this._mouseClientY = e.clientY;
    };
    const onUp = (e) => {
      if (e.button !== 0) return;
      if (!this._mouseAiming) return;
      this._mouseAiming = false;
    };
    this._mouseAimDown = onDown;
    this._mouseAimMove = onMove;
    this._mouseAimUp = onUp;
    this._mouseAimScreenToWorld = screenToWorld;

    window.addEventListener('mousedown', onDown);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    this.events.once('shutdown', () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    });
  }

  _hasAimInput() {
    return !!window.boxfuryTouchAim || this._mouseAiming;
  }

  _applyAim() {
    if (!this.player) return;

    let dx = null;
    let dy = null;
    let facingThreshold = 0;

    const touchAim = window.boxfuryTouchAim;
    if (touchAim) {
      dx = touchAim.dx;
      dy = touchAim.dy;
      facingThreshold = 0.18;
    } else if (this._mouseAiming && this._mouseClientX != null) {
      const wp = this._mouseAimScreenToWorld(this._mouseClientX, this._mouseClientY);
      dx = wp.x - this.player.sprite.x;
      dy = wp.y - this.player.sprite.y;
      facingThreshold = 6;
    } else {
      const touchDir = window.boxfuryAimDir;
      if (touchDir) {
        dx = touchDir.dx;
        dy = touchDir.dy;
        facingThreshold = 0.18;
      } else if (this._mouseClientX != null && this._mouseAimScreenToWorld) {
        const wp = this._mouseAimScreenToWorld(this._mouseClientX, this._mouseClientY);
        dx = wp.x - this.player.sprite.x;
        dy = wp.y - this.player.sprite.y;
        facingThreshold = 6;
      }
    }

    if (dx == null) return;

    if (Math.abs(dx) > facingThreshold) {
      this.player.facing = dx >= 0 ? 1 : -1;
    }

    const adx = Math.max(Math.abs(dx), 1e-3);
    const theta = Math.atan2(dy, adx);
    let angle = 90 - (theta * 180) / Math.PI;
    if (angle < BOW.MIN_ANGLE) angle = BOW.MIN_ANGLE;
    if (angle > BOW.MAX_ANGLE) angle = BOW.MAX_ANGLE;
    this.player.bow.setAngle(angle);
    this.player.bow.update();
  }

  _handleDownTap() {
    const now = performance.now();
    if (this._lastDownTapAt && now - this._lastDownTapAt < 350) {
      this._lastDownTapAt = 0;
      this._tryDropThrough();
    } else {
      this._lastDownTapAt = now;
    }
  }

  _tryDropThrough() {
    if (!this.player) return;
    const body = this.player.sprite.body;
    if (!(body.blocked.down || body.touching.down)) return;
    const walls = this.level?.map?.walls ?? [];
    if (!walls.length) return;
    const floorWallY = walls.reduce((m, w) => Math.max(m, w.y), -Infinity);
    const floorTop = floorWallY - TILE.WALL_THICKNESS / 2;
    const playerBottom = this.player.sprite.y + PLAYER.HEIGHT / 2;
    if (Math.abs(playerBottom - floorTop) < 6) return;
    this.player.dropThrough();
  }

  syncFlag() {
    const flagState = this.network?.room?.state?.flag;
    if (!flagState || !this.level.flag) return;
    const carrierId = flagState.carrierId || '';
    if (carrierId !== this.flagCarrierId) {
      const prev = this.flagCarrierId;
      this.flagCarrierId = carrierId;
      if (prev) this.findPlayer(prev)?.setCarryingFlag?.(false);
      if (carrierId) {
        this.findPlayer(carrierId)?.setCarryingFlag?.(true);
        if (this.cache?.audio?.exists('flag-captured')) {
          this.sound.play('flag-captured', { volume: 0.4 });
        }
      }
    }
    const lastVy = this._lastFlagVy ?? 0;
    const currVy = flagState.vy ?? 0;
    if (!carrierId && lastVy > 60 && Math.abs(currVy) < 20) {
      this._playFlagDropSound();
    }
    this._lastFlagVy = currVy;
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

  handleHit({ targetId, shooterId, knockX, knockY, hp, alive }) {
    const target = this.findPlayer(targetId);
    if (!target) return;
    if (!target.dead) target.flashHit(knockX, knockY);
    this.spawnHitParticles(target.sprite.x, target.sprite.y, target.color);
    if (typeof hp === 'number') target.setDamageFromHp(hp);
    const isBee = this.bees.has(targetId);
    if (this.cache?.audio?.exists('body-hit')) {
      this.sound.play('body-hit', { volume: 0.6 });
    }
    if (isBee) {
      if (this.cache?.audio?.exists('bee-chirp')) {
        this.sound.play('bee-chirp', { volume: 0.5 });
      }
    } else if (this.cache?.audio?.exists('player-moan')) {
      this.time.delayedCall(40, () => {
        this.sound.play('player-moan', { volume: 0.3 });
      });
    }
    if (target === this.player) {
      this.player.applyKnockback(knockX, knockY);
      this.camFx?.addTrauma(0.35);
      this.camFx?.kick(knockX, knockY, 8);
    }
    if (alive === false && shooterId === this.network.sessionId && targetId !== shooterId) {
      this.playKillConfirm(target);
    }
  }

  playKillConfirm(target) {
    const now = this.time.now;
    const streak =
      this._lastKillAt != null && now - this._lastKillAt < 5000
        ? (this._killStreak ?? 0) + 1
        : 1;
    this._killStreak = streak;
    this._lastKillAt = now;
    const s = Math.min(streak, 3);
    this.camFx?.addTrauma(0.25 + (s - 1) * 0.08);
    this.camFx?.punchZoom(1.045);
    if (target?.sprite) {
      this.spawnRing(target.sprite.x, target.sprite.y, target.color, {
        scale: 2.2,
        duration: 280,
      });
    }
  }

  // Legacy signatures preserved — entity call sites are untouched; the
  // pooled FxManager emitters replace per-burst rectangle + tween churn.
  spawnArrowSplash(x, y, vx = 0, vy = 0) {
    const deg = Phaser.Math.RadToDeg(Math.atan2(-vy, -vx));
    this.fx?.cone(x, y, deg, 6, 0xffffff);
  }

  spawnLandingDust(x, y, color, intensity = 1) {
    const count = 4 + Math.round(intensity * 4);
    this.fx?.dust(x, y - 1, count, color, intensity);
  }

  spawnHitParticles(x, y, color) {
    this.fx?.burst(x, y, 8, color);
  }

  findPlayer(id) {
    if (this.player?.id === id) return this.player;
    return this.remotes.get(id) ?? this.bees.get(id) ?? null;
  }

  spawnLocalPlayer(color, team = 1, name = '', skin = undefined) {
    this.statusText?.destroy();
    this.statusText = null;
    this.isSpectator = false;
    this._spectatorFollowId = null;
    document.getElementById('touch-controls')?.classList.remove('is-spectator');
    const baseKey = team === 2 ? 'team2' : 'team1';
    const map = this.level.map;
    const spawn = map.bases[baseKey] ??
      map.bases.team1 ??
      map.bases.team2 ?? {
        x: map.pixelWidth / 2,
        y: map.pixelHeight / 2 - 100,
      };
    console.log('[spawn]', {
      team,
      x: spawn.x,
      y: spawn.y,
      color: '0x' + color.toString(16),
    });
    this.player = new Player(this, {
      id: this.network.sessionId,
      x: spawn.x,
      y: spawn.y,
      color,
      name,
      skin,
    });
    this.player._platformCollider = this.physics.add.collider(this.player.sprite, this.level.platforms);
    if (this.level.solids) this.physics.add.collider(this.player.sprite, this.level.solids);

    const cam = this.cameras.main;
    const mapBiggerThanViewport =
      map.pixelWidth > cam.width || map.pixelHeight > cam.height;
    if (GAME.ZOOM_ENABLED) {
      cam.setZoom(GAME.ZOOM);
      cam.startFollow(
        this.player.sprite,
        true,
        GAME.CAMERA_LERP,
        GAME.CAMERA_LERP,
      );
    } else if (mapBiggerThanViewport) {
      cam.setZoom(1);
      cam.startFollow(
        this.player.sprite,
        true,
        GAME.CAMERA_LERP ?? 0.1,
        GAME.CAMERA_LERP ?? 0.1,
      );
    } else {
      cam.setZoom(1);
      cam.centerOn(this.player.sprite.x, this.player.sprite.y);
    }
    this.camFx?.setBaseZoom(cam.zoom);

    this.spawnPulse(spawn.x, spawn.y, color);
    this.showHud();
  }

  spawnPulse(x, y, color) {
    this.spawnRing(x, y, color);
    const r = Math.round(((color >> 16) & 0xff) * 0.35);
    const g = Math.round(((color >> 8) & 0xff) * 0.35);
    const b = Math.round((color & 0xff) * 0.35);
    this.cameras.main.flash(220, r, g, b);
  }

  spawnRing(x, y, color, opts) {
    this.fx?.ring(x, y, color, opts);
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
    this.camFx?.reset();
    const cam = this.cameras.main;
    cam.stopFollow();
    this._spectatorZoom = 1;
    this._spectatorFollowId = null;
    cam.setZoom(this._spectatorZoom);
    const m = this.level.map;
    cam.centerOn(m.pixelWidth / 2, m.pixelHeight / 2);
    this._bindSpectatorWheel();
    document.getElementById('touch-controls')?.classList.add('is-spectator');
    this.showHud();
  }

  _bindSpectatorWheel() {
    if (this._spectatorWheelBound) return;
    this._spectatorWheelBound = true;
    this.input.on('wheel', (_pointer, _gameObjects, _dx, dy) => {
      if (!this.isSpectator || this.player) return;
      const step = dy > 0 ? -0.1 : 0.1;
      this._setSpectatorZoom((this._spectatorZoom ?? 1) + step);
    });
  }

  _setSpectatorZoom(z) {
    const clamped = Math.max(0.35, Math.min(2.5, z));
    this._spectatorZoom = clamped;
    this.cameras.main.setZoom(clamped);
  }

  _cycleSpectatorFollow() {
    const players = this.network?.room?.state?.players;
    if (!players) return;
    const ids = [];
    players.forEach((p, id) => {
      if (p.team !== 0) ids.push(id);
    });
    if (ids.length === 0) {
      this._spectatorFollowId = null;
      this.cameras.main.stopFollow();
      return;
    }
    const idx = this._spectatorFollowId ? ids.indexOf(this._spectatorFollowId) : -1;
    const nextIdx = idx + 1;
    if (nextIdx >= ids.length) {
      this._spectatorFollowId = null;
      this.cameras.main.stopFollow();
    } else {
      this._spectatorFollowId = ids[nextIdx];
    }
  }

  _updateSpectator(dt) {
    if (this._chatOpen) return;
    const cam = this.cameras.main;

    if (this.justDown('follow')) this._cycleSpectatorFollow();
    if (this.isDown('zoomIn')) this._setSpectatorZoom((this._spectatorZoom ?? 1) + 1.2 * dt);
    if (this.isDown('zoomOut')) this._setSpectatorZoom((this._spectatorZoom ?? 1) - 1.2 * dt);

    if (this._spectatorFollowId) {
      const target = this.findPlayer(this._spectatorFollowId);
      if (target?.sprite) {
        if (cam._follow !== target.sprite) {
          cam.startFollow(target.sprite, true, 0.12, 0.12);
        }
        return;
      }
      this._spectatorFollowId = null;
      cam.stopFollow();
    }

    const PAN_SPEED = 600 / (this._spectatorZoom ?? 1);
    const dx = ((this.isDown('right') ? 1 : 0) - (this.isDown('left') ? 1 : 0)) * PAN_SPEED * dt;
    const dy = ((this.isDown('down') ? 1 : 0) - (this.isDown('up') ? 1 : 0)) * PAN_SPEED * dt;
    if (dx !== 0 || dy !== 0) {
      cam.scrollX += dx;
      cam.scrollY += dy;
    }
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
    document
      .getElementById('team-pick-1')
      ?.addEventListener('click', this._teamPick1);
    document
      .getElementById('team-pick-2')
      ?.addEventListener('click', this._teamPick2);
    document
      .getElementById('team-pick-spectate')
      ?.addEventListener('click', this._teamPickSpec);
    this.updateTeamCounts();
  }

  hideTeamPicker() {
    const overlay = document.getElementById('team-picker');
    if (!overlay) return;
    overlay.classList.add('hidden');
    if (this._teamPick1)
      document
        .getElementById('team-pick-1')
        ?.removeEventListener('click', this._teamPick1);
    if (this._teamPick2)
      document
        .getElementById('team-pick-2')
        ?.removeEventListener('click', this._teamPick2);
    if (this._teamPickSpec)
      document
        .getElementById('team-pick-spectate')
        ?.removeEventListener('click', this._teamPickSpec);
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

  // Restart a one-shot CSS animation class (remove -> reflow -> add).
  // The class is stripped again on animationend: the HUD DOM outlives the
  // per-match Phaser.Game, and a lingering class would replay its animation
  // when .hidden flips display back on next session.
  _retriggerAnim(el, cls) {
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
    el.addEventListener('animationend', () => el.classList.remove(cls), {
      once: true,
    });
  }

  syncScores() {
    const state = this.network?.room?.state;
    if (!state) return;
    const s1 = state.scoreTeam1 ?? 0;
    const s2 = state.scoreTeam2 ?? 0;
    if (s1 !== this._score1) {
      const pop = this._score1 !== undefined; // no pop on initial paint
      this._score1 = s1;
      const el = document.getElementById('score-1');
      if (el) {
        el.textContent = String(s1);
        if (pop) this._retriggerAnim(el, 'score-pop');
      }
    }
    if (s2 !== this._score2) {
      const pop = this._score2 !== undefined;
      this._score2 = s2;
      const el = document.getElementById('score-2');
      if (el) {
        el.textContent = String(s2);
        if (pop) this._retriggerAnim(el, 'score-pop');
      }
    }
    let specCount = 0;
    state.players?.forEach?.((p) => {
      if (p.team === 0) specCount++;
    });
    if (specCount !== this._specCount) {
      this._specCount = specCount;
      const el = document.getElementById('hud-spectators');
      if (el)
        el.textContent =
          specCount === 0 ? 'no spectators' : `${specCount} watching`;
    }
  }

  syncDeath() {
    const players = this.network?.room?.state?.players;
    if (!players) return;
    const myId = this.network.sessionId;
    players.forEach((p, sessionId) => {
      if (sessionId === myId) {
        if (!this.player) return;
        if (!p.alive && !this.deathState) this.enterDeath(p);
        else if (p.alive && this.deathState) this.exitDeath(p);
        else if (this.deathState) this.updateDeathTimer(p.respawnAt);
        return;
      }
      const remote = this.remotes.get(sessionId);
      if (remote) {
        if (!p.alive && !remote.dead) {
          remote.playDeathAnim();
          this._playDeathSound(0.35);
        } else if (p.alive && remote.dead) remote.resetVisual();
        return;
      }
      const bee = this.bees.get(sessionId);
      if (bee) {
        if (!p.alive && !bee.dead) {
          // No extra burst here: the lethal HIT broadcast already triggers
          // spawnHitParticles in handleHit for this same death.
          bee.playDeathAnim();
          if (this.cache?.audio?.exists('bee-death')) {
            this.sound.play('bee-death', { volume: 0.55 });
          }
        } else if (p.alive && bee.dead) bee.resetVisual();
      }
    });
  }

  syncSpawnShields() {
    const players = this.network?.room?.state?.players;
    if (!players) return;
    const myId = this.network.sessionId;
    const now = Date.now();
    players.forEach((p, sessionId) => {
      const protectedNow = !!(p.alive && p.spawnProtectionUntil && now < p.spawnProtectionUntil);
      if (sessionId === myId) {
        this.player?.spawnShield?.setActive(protectedNow);
      } else {
        this.remotes.get(sessionId)?.spawnShield?.setActive(protectedNow);
      }
    });
  }

  enterDeath(me) {
    this.deathState = { respawnAt: me.respawnAt };
    this.camFx?.addTrauma(0.5);
    this.player.playDeathAnim();
    this._playDeathSound(0.6);
    this.player.sprite.body.setVelocityX(0);
    document.getElementById('death-overlay')?.classList.remove('hidden');
    this.updateDeathTimer(me.respawnAt);
  }

  exitDeath(me) {
    this.deathState = null;
    this.player.resetVisual();
    this.player.sprite.body.enable = true;
    this.player.sprite.body.setVelocity(0, 0);
    this.player.sprite.setPosition(me.x, me.y);
    const cam = this.cameras.main;
    const map = this.level.map;
    const mapBiggerThanViewport =
      map.pixelWidth > cam.width || map.pixelHeight > cam.height;
    if (GAME.ZOOM_ENABLED) {
      cam.setZoom(GAME.ZOOM);
      cam.startFollow(
        this.player.sprite,
        true,
        GAME.CAMERA_LERP,
        GAME.CAMERA_LERP,
      );
    } else if (mapBiggerThanViewport) {
      cam.setZoom(1);
      cam.startFollow(
        this.player.sprite,
        true,
        GAME.CAMERA_LERP ?? 0.1,
        GAME.CAMERA_LERP ?? 0.1,
      );
    } else {
      cam.setZoom(1);
      cam.centerOn(this.player.sprite.x, this.player.sprite.y);
    }
    this.camFx?.reset();
    this.camFx?.setBaseZoom(cam.zoom);
    this.spawnPulse(me.x, me.y, this.player.color);
    document.getElementById('death-overlay')?.classList.add('hidden');
  }

  updateDeathTimer(respawnAt) {
    const remaining = Math.max(0, Math.ceil((respawnAt - Date.now()) / 1000));
    const el = document.getElementById('death-timer');
    if (el && el.textContent !== String(remaining)) {
      el.textContent = String(remaining);
      this._retriggerAnim(el, 'death-timer-tick');
    }
  }

  hideDeathOverlay() {
    document.getElementById('death-overlay')?.classList.add('hidden');
  }

  showMatchEnd(payload) {
    const overlay = document.getElementById('match-end');
    if (!overlay) return;
    this.hideTeamPicker();
    this.hideScoreboard();
    this.hideDeathOverlay();
    this._pickedTeam = 0;
    const titleEl = document.getElementById('match-end-title');
    const winLabel =
      payload.winnerTeam === 1
        ? '<span style="color:var(--p1)">JADE</span> WINS'
        : payload.winnerTeam === 2
          ? '<span style="color:var(--p2)">CRIMSON</span> WINS'
          : 'TIE';
    if (titleEl) titleEl.innerHTML = winLabel;
    const setText = (id, txt) => {
      const el = document.getElementById(id);
      if (el) el.textContent = String(txt);
    };
    setText('match-end-s1', payload.scoreTeam1 ?? 0);
    setText('match-end-s2', payload.scoreTeam2 ?? 0);
    const team1Rows = [];
    const team2Rows = [];
    for (const p of payload.players ?? []) {
      const row = `<div class="scoreboard__row"><span>${escapeHtml(p.name || '?')}</span><span>${p.kills || 0}</span><span>${p.captures || 0}</span><span>${p.deaths || 0}</span></div>`;
      if (p.team === 1) team1Rows.push(row);
      else if (p.team === 2) team2Rows.push(row);
    }
    const setHtml = (sel, html) => {
      const el = document.querySelector(sel);
      if (el) el.innerHTML = html;
    };
    setHtml('[data-me-roster="1"]', team1Rows.join(''));
    setHtml('[data-me-roster="2"]', team2Rows.join(''));

    document
      .getElementById('match-end-team-1')
      ?.classList.remove('is-selected');
    document
      .getElementById('match-end-team-2')
      ?.classList.remove('is-selected');

    this.renderMatchEndSummary();
    this.updateMatchEndMapTrigger();
    this.updateMatchEndTeamCounts();
    overlay.classList.remove('hidden');

    if (!this._matchEndBound) {
      this._matchEndBound = true;
      document
        .getElementById('match-end-back')
        ?.addEventListener('click', () => {
          overlay.classList.add('hidden');
          this.registry.get('leaveGame')?.();
        });
      document
        .getElementById('match-end-map-trigger')
        ?.addEventListener('click', () => {
          const currentMapId =
            this.network?.room?.state?.mapId ?? this.level?.mapId ?? 'default';
          openMapPicker({
            mapId: currentMapId,
            onSelect: (id) => {
              if (id === currentMapId) return;
              this.network.sendChangeMap(id);
            },
          });
        });
      document
        .getElementById('match-end-team-1')
        ?.addEventListener('click', () => {
          this._pickedTeam = 1;
          this._highlightMatchEndTeam(1);
        });
      document
        .getElementById('match-end-team-2')
        ?.addEventListener('click', () => {
          this._pickedTeam = 2;
          this._highlightMatchEndTeam(2);
        });
      document
        .getElementById('match-end-spectate')
        ?.addEventListener('click', () => {
          this._pickedTeam = 0;
          overlay.classList.add('hidden');
          this._enterSpectatorView();
        });
      document
        .getElementById('match-end-play')
        ?.addEventListener('click', () => {
          overlay.classList.add('hidden');
          if (this._pickedTeam) {
            this.network.sendChooseTeam(this._pickedTeam);
          } else {
            this._enterSpectatorView();
          }
        });
    }
  }

  _enterSpectatorView() {
    if (!this.player) {
      this.isSpectator = true;
      this.setupSpectatorCamera();
    } else {
      this.showHud();
    }
  }

  _highlightMatchEndTeam(team) {
    const btn1 = document.getElementById('match-end-team-1');
    const btn2 = document.getElementById('match-end-team-2');
    btn1?.classList.toggle('is-selected', team === 1);
    btn2?.classList.toggle('is-selected', team === 2);
  }

  renderMatchEndSummary() {
    const root = document.getElementById('match-end-summary');
    if (!root) return;
    const meta = this.network?.room?.metadata ?? {};
    const state = this.network?.room?.state;
    const mapId = state?.mapId ?? meta.mapId ?? 'default';
    const items = [
      { label: t('createRoom.mode'), value: t(`mode.${meta.mode ?? 'ctf'}`) },
      { label: t('createRoom.map'), value: t(`map.${mapId}`) },
      {
        label: t('createRoom.maxPlayers'),
        value: String(meta.maxPlayers ?? '—'),
      },
      {
        label: t('createRoom.maxPoints'),
        value: String(meta.scoreTarget ?? state?.scoreTarget ?? '—'),
      },
    ];
    root.innerHTML = items
      .map(
        (it) => `
      <div class="match-end__summary-item">
        <span class="match-end__summary-label">${escapeHtml(it.label)}</span>
        <span class="match-end__summary-value">${escapeHtml(it.value)}</span>
      </div>
    `,
      )
      .join('');
  }

  updateMatchEndTeamCounts() {
    const players = this.network?.room?.state?.players;
    if (!players) return;
    let t1 = 0;
    let t2 = 0;
    players.forEach((p) => {
      if (p.team === 1) t1++;
      else if (p.team === 2) t2++;
    });
    const cap = Math.floor((this.network?.room?.metadata?.maxPlayers ?? 8) / 2);
    const fmt = (n) =>
      `${n}/${cap} ${n === 1 ? t('team.player') : t('team.players')}`;
    const e1 = document.querySelector('[data-me-team="1"]');
    const e2 = document.querySelector('[data-me-team="2"]');
    if (e1) e1.textContent = fmt(t1);
    if (e2) e2.textContent = fmt(t2);
  }

  hideMatchEnd() {
    document.getElementById('match-end')?.classList.add('hidden');
  }

  handleMapChanged(payload) {
    const mapId = payload?.mapId;
    if (!mapId || !this.level) return;
    if (this.level.mapId === mapId) return;
    this.level.rebuild(mapId);
    this.updateMatchEndMapTrigger();
    this.renderMatchEndSummary();
  }

  updateMatchEndMapTrigger() {
    const label = document.getElementById('match-end-map-current');
    const currentMapId =
      this.network?.room?.state?.mapId ?? this.level?.mapId ?? 'default';
    if (label) label.textContent = t(`map.${currentMapId}`);
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
      const row = `<div class="scoreboard__row${sessionId === myId ? ' scoreboard__row--self' : ''}"><span>${escapeHtml(p.name || '?')}</span><span>${p.kills || 0}</span><span>${p.captures || 0}</span><span>${p.deaths || 0}</span></div>`;
      if (p.team === 1) team1Rows.push(row);
      else if (p.team === 2) team2Rows.push(row);
      else spectatorNames.push(p.name || '?');
    });
    // Hold-Tab calls this every frame; skip the innerHTML rebuild (full DOM
    // teardown + reparse) unless the rendered content actually changed.
    const sig = [
      team1Rows.join(''),
      team2Rows.join(''),
      state.scoreTeam1 ?? 0,
      state.scoreTeam2 ?? 0,
      spectatorNames.join(','),
    ].join('');
    if (sig === this._scoreboardSig) return;
    this._scoreboardSig = sig;
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
    set(
      '[data-sb-spectators]',
      spectatorNames.map((n) => `<span>${escapeHtml(n)}</span>`).join(''),
    );
  }

  updateTeamCounts() {
    const matchEndOverlay = document.getElementById('match-end');
    if (matchEndOverlay && !matchEndOverlay.classList.contains('hidden')) {
      this.updateMatchEndTeamCounts();
    }
    if (!this.teamPickerOpen) return;
    const players = this.network?.room?.state?.players;
    if (!players) return;
    let t1 = 0;
    let t2 = 0;
    players.forEach((p) => {
      if (p.team === 1) t1++;
      else if (p.team === 2) t2++;
    });
    const cap = Math.floor(
      (this.network?.room?.metadata?.maxPlayers ?? ROOM.MAX_CLIENTS) / 2,
    );
    const apply = (team, count) => {
      const countEl = document.querySelector(
        `.team-pick__count[data-team="${team}"]`,
      );
      const btn = document.getElementById(`team-pick-${team}`);
      const full = count >= cap;
      if (countEl)
        countEl.textContent = full
          ? `FULL · ${count}/${cap}`
          : `${count}/${cap} player${count === 1 ? '' : 's'}`;
      if (btn) btn.disabled = full;
    };
    apply(1, t1);
    apply(2, t2);
  }

  update(_time, delta) {
    const dt = delta / 1000;
    this.camFx?.update(dt);
    this.level?.backdrop?.update();
    this.syncDeath();
    this.syncSpawnShields();
    if (!this.player && this.isSpectator) {
      this._updateSpectator(dt);
    }

    if (this.player) {
      if (!this.deathState) {
        if (!this._chatOpen) {
          const aimInput = this._hasAimInput();
          this.player.setCrouching(this.isDown('down'));
          if (this.justDown('down')) this._handleDownTap();
          this.player.move({
            left: this.isDown('left'),
            right: this.isDown('right'),
            lockFacing: true,
          });
          if (this.isDown('up')) this.player.jump();

          if (this.justDown('flag')) {
            this.toggleFlag();
          }
          if (this.isDown('space') || aimInput) {
            this.player.chargeBow();
          } else {
            const shot = this.player.releaseBow();
            if (shot) {
              this.network.sendShoot(shot);
              // Local muzzle flash fires at input time with exact coords —
              // waiting for the server echo would detach it from the bow.
              const deg = Phaser.Math.RadToDeg(Math.atan2(shot.vy, shot.vx));
              this.fx?.muzzle(shot.x, shot.y, deg, this.player.color);
              // Camera nudge opposite the shot; full-charge shots rumble.
              this.camFx?.kick(-shot.vx, -shot.vy, 3);
              const speed = Math.hypot(shot.vx, shot.vy);
              const pull =
                (speed - ARROW.SPEED_MIN) / (ARROW.SPEED_MAX - ARROW.SPEED_MIN);
              if (pull >= 0.95) this.camFx?.addTrauma(0.06);
            }
          }
        } else {
          this.player.sprite.body.setVelocityX(0);
        }
        this.player.update(dt);
        this._applyAim();
      }
      this.network.sendState(this.player.getState());
      if (this.player.nameText) {
        const bob = this.player._bobY ?? 0;
        this.player.nameText.setPosition(
          this.player.sprite.x,
          this.player.sprite.y - PLAYER.HEIGHT / 2 - 6 + bob,
        );
      }
      if (this.player.chatBubble?.visible) {
        const bob = this.player._bobY ?? 0;
        this.player.chatBubble.setPosition(
          this.player.sprite.x,
          this.player.sprite.y - PLAYER.HEIGHT / 2 - 22 + bob,
        );
      }
    }

    this.syncFlag();
    this.syncScores();
    if (this.scoreboardOpen) this.renderScoreboard();
    for (const r of this.remotes.values()) r.update();
    for (const b of this.bees.values()) b.update();
    for (const a of this.arrows.values()) a.update(dt);
  }
}

function escapeHtml(s) {
  return String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[c],
  );
}
