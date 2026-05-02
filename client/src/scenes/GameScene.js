import Phaser from 'phaser';
import { GAME, PLAYER, WORLD } from '@boxfury/shared';
import { Player } from '../entities/Player.js';
import { RemotePlayer } from '../entities/RemotePlayer.js';
import { Arrow } from '../entities/Arrow.js';
import { Level } from '../entities/Level.js';
import { NetworkManager } from '../network/NetworkManager.js';

export class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
    this.remotes = new Map();
    this.arrows = [];
  }

  async create() {
    this.cursors = this.input.keyboard.createCursorKeys();
    this.level = new Level(this);
    if (this.level.flag) {
      this.physics.add.collider(this.level.flag.pole, this.level.platforms);
    }
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

    this.events.once('shutdown', () => this.network?.disconnect());

    const connectOptions = this.registry.get('connectOptions') ?? {};
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

    const handleAdd = (player, sessionId) => {
      if (sessionId === room.sessionId) {
        if (!this.player) this.spawnLocalPlayer(player.color, player.team);
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
      });
      this.remotes.set(sessionId, remote);
      $(player).onChange(() => remote.applyState({
        x: player.x,
        y: player.y,
        facing: player.facing,
        bowAngle: player.bowAngle,
      }));
    };

    $(room.state).players.onAdd(handleAdd);

    $(room.state).players.onRemove((_player, sessionId) => {
      const remote = this.remotes.get(sessionId);
      if (!remote) return;
      remote.destroy();
      this.remotes.delete(sessionId);
    });

    this.network.onShoot(({ id, x, y, vx, vy }) => {
      this.spawnArrow({ x, y, vx, vy, shooterId: id });
    });
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
    const flag = this.level.flag;
    if (!flag) return;
    if (this.player.carryingFlag) {
      flag.drop();
      this.player.setCarryingFlag(false);
    } else if (flag.canPickUp(this.player)) {
      flag.pickUp(this.player);
      this.player.setCarryingFlag(true);
    }
  }

  spawnArrow(shot) {
    const arrow = new Arrow(this, shot);
    this.arrows.push(arrow);

    this.physics.add.collider(arrow.sprite, this.level.platforms, () => arrow.stickTo());

    if (this.player && this.player.id !== arrow.shooterId) {
      this.physics.add.overlap(arrow.sprite, this.player.sprite, () => arrow.stickTo(this.player));
    }
    for (const remote of this.remotes.values()) {
      if (remote.id !== arrow.shooterId) {
        this.physics.add.overlap(arrow.sprite, remote.sprite, () => arrow.stickTo(remote));
      }
    }
  }

  update(_time, delta) {
    const dt = delta / 1000;
    if (this.player) {
      this.player.move({
        left: this.cursors.left.isDown,
        right: this.cursors.right.isDown,
      });
      if (this.cursors.up.isDown) this.player.jump();

      if (Phaser.Input.Keyboard.JustDown(this.cursors.down)) {
        this.toggleFlag();
      }

      if (this.cursors.space.isDown) {
        this.player.chargeBow();
      } else {
        const shot = this.player.releaseBow();
        if (shot) {
          this.spawnArrow({ ...shot, shooterId: this.player.id });
          this.network.sendShoot(shot);
        }
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

    this.level.flag?.update();

    for (const r of this.remotes.values()) r.update();

    for (let i = this.arrows.length - 1; i >= 0; i--) {
      const a = this.arrows[i];
      a.update();
      if (!a.alive) this.arrows.splice(i, 1);
    }
  }
}
