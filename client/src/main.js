import './style.css';
import Phaser from 'phaser';
import { COLORS, WORLD } from '@boxfury/shared';
import { BootScene } from './scenes/BootScene.js';
import { PreloadScene } from './scenes/PreloadScene.js';
import { GameScene } from './scenes/GameScene.js';
import { setupMenu } from './menu.js';
import { setupGameMenu } from './game-menu.js';
import { setupSettings } from './settings.js';
import { openCreateRoom, setupCreateRoom } from './create-room.js';
import { setupMapPicker } from './map-picker.js';
import { setupUiSounds } from './ui-sounds.js';
import { setupTouchControls } from './touch-controls.js';
import { setupSoloPicker, openSoloPicker } from './solo-picker.js';
import { applyLocale } from './i18n.js';
import { getUsername } from './username.js';
import { getSkin } from './skin.js';

let game = null;

applyLocale();
setupSettings();
setupMapPicker();
setupUiSounds();
setupTouchControls();
setupSoloPicker();

const bgMusic = new Audio('/assets/audio/arena-drift.ogg');
bgMusic.loop = true;
bgMusic.volume = 0.18;
bgMusic.muted = !!window.boxfuryMuted;
let bgMusicWanted = true;

function tryPlayBgMusic() {
  if (!bgMusicWanted) return;
  bgMusic.play().catch(() => {});
}

function pauseBgMusic() {
  bgMusicWanted = false;
  bgMusic.pause();
}

function resumeBgMusic() {
  bgMusicWanted = true;
  tryPlayBgMusic();
}

tryPlayBgMusic();
const unlockBgMusic = () => {
  if (bgMusicWanted && bgMusic.paused) tryPlayBgMusic();
  if (!bgMusic.paused) {
    window.removeEventListener('pointerdown', unlockBgMusic);
    window.removeEventListener('keydown', unlockBgMusic);
  }
};
window.addEventListener('pointerdown', unlockBgMusic);
window.addEventListener('keydown', unlockBgMusic);

window.addEventListener('boxfury:mute', (e) => {
  bgMusic.muted = !!e.detail?.muted;
});

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
  pauseBgMusic();
  document.getElementById('menu').classList.add('hidden');
  document.getElementById('game').classList.remove('hidden');
  game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    backgroundColor: COLORS.ARENA,
    pixelArt: true,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: WORLD.WIDTH,
      height: WORLD.HEIGHT,
    },
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
  resumeBgMusic();
  // Belt-and-suspenders: ensure all in-game DOM overlays are hidden
  ['hud', 'death-overlay', 'team-picker', 'scoreboard', 'match-end', 'reconnect-overlay', 'capture-banner', 'chat-input-wrap']
    .forEach((id) => document.getElementById(id)?.classList.add('hidden'));
}

setupCreateRoom({
  onSubmit: (cfg) => startGame({ mode: 'create', options: cfg }),
});

setupMenu({
  onJoin: (roomId) => startGame({ mode: 'join', roomId }),
  onCreate: () => openCreateRoom(),
  onSolo: () => openSoloPicker((mode) => {
    if (mode === 'bee') {
      startGame({
        mode: 'create',
        options: {
          roomName: 'BEE WARS',
          mode: 'bee',
          mapId: 'default',
          maxPlayers: 2,
          maxPoints: 5,
        },
      });
    }
  }),
  onTest: () => startGame({
    mode: 'create',
    autoTeam: 1,
    options: {
      roomName: 'TEST',
      mode: 'ctf',
      maxPlayers: 8,
      maxPoints: 1,
    },
  }),
});
setupGameMenu({
  onLeave: leaveGame,
  onJoinTeam: () => game?.scene.getScene('GameScene')?.joinTeam?.(),
});
