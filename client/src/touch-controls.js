const KEY_CODES = {
  ArrowLeft: 37,
  ArrowUp: 38,
  ArrowRight: 39,
  ArrowDown: 40,
  ' ': 32,
  x: 88,
};

function dispatchKey(type, key) {
  const opts = {
    key,
    code: key === ' ' ? 'Space' : key,
    keyCode: KEY_CODES[key] ?? 0,
    which: KEY_CODES[key] ?? 0,
    bubbles: true,
    cancelable: true,
  };
  window.dispatchEvent(new KeyboardEvent(type, opts));
  document.dispatchEvent(new KeyboardEvent(type, opts));
}

function isTouchDevice() {
  return matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
}

export function setupTouchControls() {
  const wrap = document.getElementById('touch-controls');
  if (!wrap) return;
  if (!isTouchDevice()) return;

  const game = document.getElementById('game');
  if (!game) return;

  const sync = () => {
    const visible = !game.classList.contains('hidden');
    wrap.classList.toggle('hidden', !visible);
  };
  sync();
  new MutationObserver(sync).observe(game, {
    attributes: true,
    attributeFilter: ['class'],
  });

  const buttons = wrap.querySelectorAll('[data-touch-key]');
  for (const btn of buttons) {
    const key = btn.dataset.touchKey;
    let active = false;

    const press = (e) => {
      e.preventDefault();
      if (active) return;
      active = true;
      btn.classList.add('is-active');
      try { btn.setPointerCapture?.(e.pointerId); } catch {}
      dispatchKey('keydown', key);
    };

    const release = (e) => {
      if (!active) return;
      active = false;
      btn.classList.remove('is-active');
      try { btn.releasePointerCapture?.(e.pointerId); } catch {}
      dispatchKey('keyup', key);
    };

    btn.addEventListener('pointerdown', press);
    btn.addEventListener('pointerup', release);
    btn.addEventListener('pointercancel', release);
    btn.addEventListener('pointerleave', release);
    btn.addEventListener('contextmenu', (e) => e.preventDefault());
  }
}
