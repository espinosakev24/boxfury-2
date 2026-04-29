import Phaser from 'phaser';
import { WORLD } from '@boxfury/shared';
import { BootScene } from './scenes/BootScene.js';
import { PreloadScene } from './scenes/PreloadScene.js';
import { GameScene } from './scenes/GameScene.js';

const config = {
  type: Phaser.AUTO,
  parent: 'game',
  width: WORLD.WIDTH,
  height: WORLD.HEIGHT,
  backgroundColor: '#1d1d2b',
  pixelArt: true,
  physics: {
    default: 'arcade',
    arcade: { gravity: { y: 900 }, debug: false },
  },
  scene: [BootScene, PreloadScene, GameScene],
};

new Phaser.Game(config);
