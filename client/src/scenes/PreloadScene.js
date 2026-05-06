import Phaser from 'phaser';

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super('PreloadScene');
  }

  preload() {
    this.load.audio('bow-aiming', '/assets/audio/bow-aiming.wav');
    this.load.audio('arrow-shoot', '/assets/audio/arrow-shoot.wav');
    this.load.audio('arrow-hit', '/assets/audio/arrow-hit.wav');
    this.load.audio('arrow-vibration', '/assets/audio/arrow-vibration.wav');
  }

  create() {
    this.scene.start('GameScene');
  }
}
