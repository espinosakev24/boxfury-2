const MUTE_KEY = 'boxfury:muted';

export function setupGameMenu({ onLeave }) {
  const game = document.getElementById('game');
  const menu = document.getElementById('game-menu');
  const controls = document.getElementById('controls-overlay');

  const gameVisible = () => !game.classList.contains('hidden');
  const isMenuOpen = () => !menu.classList.contains('hidden');
  const isControlsOpen = () => !controls.classList.contains('hidden');

  const openMenu = () => menu.classList.remove('hidden');
  const closeMenu = () => menu.classList.add('hidden');
  const closeControls = () => controls.classList.add('hidden');

  window.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || !gameVisible()) return;
    if (isControlsOpen()) closeControls();
    else if (isMenuOpen()) closeMenu();
    else openMenu();
  });

  document.getElementById('opt-resume').addEventListener('click', closeMenu);

  document.getElementById('opt-controls').addEventListener('click', () => {
    controls.classList.remove('hidden');
  });
  document.getElementById('controls-close').addEventListener('click', closeControls);

  // Mute — toggles a global flag + persists. Future audio code reads window.boxfuryMuted.
  const muteBtn = document.getElementById('opt-mute');
  const muteLabel = muteBtn.querySelector('.btn__label-text');
  let muted = localStorage.getItem(MUTE_KEY) === '1';
  const renderMute = () => {
    muteLabel.textContent = muted ? 'Unmute audio' : 'Mute audio';
    window.boxfuryMuted = muted;
  };
  renderMute();
  muteBtn.addEventListener('click', () => {
    muted = !muted;
    localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
    renderMute();
  });

  // Fullscreen — target the canvas only so the chrome doesn't go fullscreen.
  document.getElementById('opt-fullscreen').addEventListener('click', () => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
      return;
    }
    const canvas = game.querySelector('canvas');
    canvas?.requestFullscreen?.();
  });

  document.getElementById('opt-leave').addEventListener('click', () => {
    closeMenu();
    closeControls();
    onLeave();
  });
}
