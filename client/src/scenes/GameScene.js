import Phaser from 'phaser';
import { WORLD } from '@boxfury/shared';
import { Player } from '../entities/Player.js';
import { RemotePlayer } from '../entities/RemotePlayer.js';
import { Level } from '../entities/Level.js';
import { NetworkManager } from '../network/NetworkManager.js';

export class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
    this.remotes = new Map();
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
      });
      this.remotes.set(sessionId, remote);
      $(player).onChange(() => remote.applyState({ x: player.x, y: player.y }));
    });

    $(room.state).players.onRemove((_player, sessionId) => {
      const remote = this.remotes.get(sessionId);
      if (!remote) return;
      remote.destroy();
      this.remotes.delete(sessionId);
    });
  }

  spawnLocalPlayer(color) {
    this.player = new Player(this, {
      x: WORLD.WIDTH / 2,
      y: WORLD.HEIGHT / 2 - 100,
      color,
    });
    this.physics.add.collider(this.player.sprite, this.level.platforms);
  }

  update() {
    if (this.player) {
      this.player.move({
        left: this.cursors.left.isDown,
        right: this.cursors.right.isDown,
      });
      if (this.cursors.space.isDown) this.player.jump();
      this.network.sendState(this.player.getState());
    }

    for (const r of this.remotes.values()) r.update();
  }
}
