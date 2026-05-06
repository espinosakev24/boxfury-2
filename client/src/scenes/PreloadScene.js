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
    this.load.audio('body-hit', '/assets/audio/body-hit.wav');
    this.load.audio('player-moan', '/assets/audio/player-moan.wav');
    this.load.audio('flag-captured', '/assets/audio/flag-captured.wav');
    this.load.audio('flag-drop', '/assets/audio/flag-drop.wav');
    this.load.audio('score', '/assets/audio/score.wav');
    this.load.audio('jump', '/assets/audio/jump.wav');
    this.load.audio('player-landing', '/assets/audio/player-landing.wav');
    this.load.audio('player-walking', '/assets/audio/player-walking.wav');
  }

  create() {
    this.scene.start('GameScene');
  }
}
