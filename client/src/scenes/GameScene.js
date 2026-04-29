import Phaser from 'phaser';
import { WORLD } from '@boxfury/shared';
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
    this.network = new NetworkManager();

    const room = await this.network.connect();
    const $ = this.network.$;

    $(room.state).players.onAdd((player, sessionId) => {
      if (sessionId === room.sessionId) {
        this.spawnLocalPlayer(player.color);
        return;
      }
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
    });

    $(room.state).players.onRemove((_player, sessionId) => {
      const remote = this.remotes.get(sessionId);
      if (!remote) return;
      remote.destroy();
      this.remotes.delete(sessionId);
    });

    this.network.onShoot((shot) => this.spawnArrow(shot));
  }

  spawnLocalPlayer(color) {
    this.player = new Player(this, {
      x: WORLD.WIDTH / 2,
      y: WORLD.HEIGHT / 2 - 100,
      color,
    });
    this.physics.add.collider(this.player.sprite, this.level.platforms);
  }

  spawnArrow(shot) {
    const arrow = new Arrow(this, shot);
    this.physics.add.collider(arrow.sprite, this.level.platforms, () => arrow.destroy());
    this.arrows.push(arrow);
  }

  update(_time, delta) {
    const dt = delta / 1000;
    if (this.player) {
      this.player.move({
        left: this.cursors.left.isDown,
        right: this.cursors.right.isDown,
      });
      if (this.cursors.up.isDown) this.player.jump();

      if (this.cursors.space.isDown) {
        this.player.chargeBow();
      } else {
        const shot = this.player.releaseBow();
        if (shot) {
          this.spawnArrow(shot);
          this.network.sendShoot(shot);
        }
      }

      this.player.update(dt);
      this.network.sendState(this.player.getState());
    }

    for (const r of this.remotes.values()) r.update();

    for (let i = this.arrows.length - 1; i >= 0; i--) {
      const a = this.arrows[i];
      a.update();
      if (!a.alive) this.arrows.splice(i, 1);
    }
  }
}
