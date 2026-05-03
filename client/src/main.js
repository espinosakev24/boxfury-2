import './style.css';
import Phaser from 'phaser';
import { COLORS, WORLD } from '@boxfury/shared';
import { BootScene } from './scenes/BootScene.js';
import { PreloadScene } from './scenes/PreloadScene.js';
import { GameScene } from './scenes/GameScene.js';
import { setupMenu } from './menu.js';
import { setupGameMenu } from './game-menu.js';
import { setupSettings } from './settings.js';
import { applyLocale } from './i18n.js';
import { getUsername } from './username.js';
import { getSkin } from './skin.js';

let game = null;

applyLocale();
setupSettings();

function buildOptions(extra = {}) {
  const name = getUsername();
  const skin = getSkin();
  const out = { ...extra, skin };
  if (name) out.name = name;
  return out;
}

function startGame(connectOptions = {}) {
  const enriched = {
    ...connectOptions,
    options: buildOptions(connectOptions.options),
  };
  return doStartGame(enriched);
}

function doStartGame(connectOptions) {
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
  game.registry.set('leaveGame', leaveGame);
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
  // Belt-and-suspenders: ensure all in-game DOM overlays are hidden
  ['hud', 'death-overlay', 'team-picker', 'scoreboard', 'match-end']
    .forEach((id) => document.getElementById(id)?.classList.add('hidden'));
}

setupMenu({
  onJoin: (roomId) => startGame({ mode: 'join', roomId }),
  onCreate: () => startGame({ mode: 'create' }),
});
setupGameMenu({
  onLeave: leaveGame,
  onJoinTeam: () => game?.scene.getScene('GameScene')?.joinTeam?.(),
});
