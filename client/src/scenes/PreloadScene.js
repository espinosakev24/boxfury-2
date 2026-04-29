import Phaser from 'phaser';

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super('PreloadScene');
  }

  preload() {
    // Load sprites, audio, maps from /public/assets here.
  }

  create() {
    this.scene.start('GameScene');
  }
}
