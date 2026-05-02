import './style.css';
import Phaser from 'phaser';
import { COLORS, WORLD } from '@boxfury/shared';
import { BootScene } from './scenes/BootScene.js';
import { PreloadScene } from './scenes/PreloadScene.js';
import { GameScene } from './scenes/GameScene.js';
import { setupMenu } from './menu.js';
import { setupGameMenu } from './game-menu.js';

let game = null;

const hudEl = () => document.getElementById('hud');

window.addEventListener('boxfury:hud', (e) => {
  const { map, jade, crimson } = e.detail || {};
  if (typeof map === 'string') document.getElementById('hud-map').textContent = map.toUpperCase();
  if (typeof jade === 'number') document.getElementById('hud-jade').textContent = String(jade);
  if (typeof crimson === 'number') document.getElementById('hud-crimson').textContent = String(crimson);
});

function startGame() {
  document.getElementById('game').classList.remove('hidden');
  hudEl().classList.remove('hidden');
  game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    width: WORLD.WIDTH,
    height: WORLD.HEIGHT,
    backgroundColor: COLORS.ARENA,
    pixelArt: true,
    scene: [BootScene, PreloadScene, GameScene],
  });
  window.__bf = game;
}

async function leaveGame() {
  if (game) {
    const scene = game.scene.getScene('GameScene');
    try { await scene?.network?.disconnect(); } catch {}
    game.destroy(true);
    game = null;
  }
  document.getElementById('game').classList.add('hidden');
  hudEl().classList.add('hidden');
  document.getElementById('menu').classList.remove('hidden');
}

setupMenu(startGame);
setupGameMenu({ onLeave: leaveGame });
