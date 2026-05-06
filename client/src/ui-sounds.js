const SELECTOR = [
  'button',
  '.chip',
  '.map-card',
  '.skin-picker__chip',
  '.team-pick__btn',
  '.team-pick__spectate',
  '.menu__skin-trigger',
  '.map-trigger',
  '.lobby__list .room:not(.room--full)',
  '#match-end-team-1',
  '#match-end-team-2',
].join(', ');

const HOVER_DEBOUNCE_MS = 60;

let hoverAudio = null;
let clickAudio = null;
let lastHoverAt = 0;
let lastHoverEl = null;

export function setupUiSounds() {
  hoverAudio = new Audio('/assets/audio/option-hover.wav');
  hoverAudio.volume = 0.25;
  hoverAudio.muted = !!window.boxfuryMuted;

  clickAudio = new Audio('/assets/audio/option-clicked.wav');
  clickAudio.volume = 0.4;
  clickAudio.muted = !!window.boxfuryMuted;

  document.addEventListener('mouseover', onMouseOver, { passive: true });
  document.addEventListener('mouseout', onMouseOut, { passive: true });
  document.addEventListener('click', onClick, { passive: true });

  window.addEventListener('boxfury:mute', (e) => {
    const m = !!e.detail?.muted;
    hoverAudio.muted = m;
    clickAudio.muted = m;
  });
}

function onMouseOver(e) {
  const target = e.target?.closest?.(SELECTOR);
  if (!target || target === lastHoverEl) return;
  lastHoverEl = target;
  if (target.disabled) return;
  const now = performance.now();
  if (now - lastHoverAt < HOVER_DEBOUNCE_MS) return;
  lastHoverAt = now;
  play(hoverAudio);
}

function onMouseOut(e) {
  const left = e.target?.closest?.(SELECTOR);
  if (left && left === lastHoverEl) {
    const moved = e.relatedTarget?.closest?.(SELECTOR);
    if (moved !== left) lastHoverEl = null;
  }
}

function onClick(e) {
  const target = e.target?.closest?.(SELECTOR);
  if (!target || target.disabled) return;
  play(clickAudio);
}

function play(audio) {
  if (!audio) return;
  try {
    audio.currentTime = 0;
    audio.play().catch(() => {});
  } catch {
    // ignore
  }
}
