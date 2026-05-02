import './style.css';
import Phaser from 'phaser';
import { COLORS, WORLD } from '@boxfury/shared';
import { BootScene } from './scenes/BootScene.js';
import { PreloadScene } from './scenes/PreloadScene.js';
import { GameScene } from './scenes/GameScene.js';
import { setupMenu } from './menu.js';
import { setupGameMenu } from './game-menu.js';

let game = null;

function startGame(connectOptions = {}) {
  document.getElementById('game').classList.remove('hidden');
  game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    width: WORLD.WIDTH,
    height: WORLD.HEIGHT,
    backgroundColor: COLORS.ARENA,
    pixelArt: true,
    physics: {
      default: 'arcade',
      arcade: { gravity: { y: 900 }, debug: false },
    },
    scene: [BootScene, PreloadScene, GameScene],
  });
  game.registry.set('connectOptions', connectOptions);
}

async function leaveGame() {
  if (game) {
    const scene = game.scene.getScene('GameScene');
    try { await scene?.network?.disconnect(); } catch {}
    game.destroy(true);
    game = null;
  }
  document.getElementById('game').classList.add('hidden');
  document.getElementById('menu').classList.remove('hidden');
}

setupMenu({
  onJoin: (roomId) => startGame({ mode: 'join', roomId }),
  onCreate: () => startGame({ mode: 'create' }),
});
setupGameMenu({ onLeave: leaveGame });
