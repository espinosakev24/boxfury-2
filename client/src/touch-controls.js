const KEY_CODES = {
  ArrowLeft: 37,
  ArrowUp: 38,
  ArrowRight: 39,
  ArrowDown: 40,
  ' ': 32,
  x: 88,
  Escape: 27,
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
  document.dispatchEvent(new KeyboardEvent(type, opts));
}

function preventZoomGestures() {
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  document.addEventListener('gesturechange', (e) => e.preventDefault());
  document.addEventListener('gestureend', (e) => e.preventDefault());
  document.addEventListener('dblclick', (e) => e.preventDefault(), { passive: false });
  let lastTouchEnd = 0;
  document.addEventListener('touchend', (e) => {
    const now = Date.now();
    if (now - lastTouchEnd <= 350) e.preventDefault();
    lastTouchEnd = now;
  }, { passive: false });
}

export function setupTouchControls() {
  const wrap = document.getElementById('touch-controls');
  if (!wrap) return;

  preventZoomGestures();

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

  setupJoystick();
}

function setupJoystick() {
  const base = document.getElementById('touch-joystick');
  const knob = document.getElementById('touch-joystick-knob');
  if (!base || !knob) return;

  const DEADZONE = 14;
  const MAX_RADIUS = 44;
  const heldKeys = new Set();
  let pointerId = null;

  const setKey = (key, shouldBeDown) => {
    const isDown = heldKeys.has(key);
    if (shouldBeDown && !isDown) {
      heldKeys.add(key);
      dispatchKey('keydown', key);
    } else if (!shouldBeDown && isDown) {
      heldKeys.delete(key);
      dispatchKey('keyup', key);
    }
  };

  const releaseAll = () => {
    for (const key of Array.from(heldKeys)) setKey(key, false);
  };

  const update = (clientX, clientY) => {
    const rect = base.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let dx = clientX - cx;
    let dy = clientY - cy;
    const dist = Math.hypot(dx, dy);
    if (dist > MAX_RADIUS) {
      const k = MAX_RADIUS / dist;
      dx *= k;
      dy *= k;
    }
    knob.style.transform = `translate(${dx}px, ${dy}px)`;

    const ax = Math.abs(dx);
    const ay = Math.abs(dy);
    setKey('ArrowLeft',  dx < -DEADZONE && ax >= ay * 0.6);
    setKey('ArrowRight', dx >  DEADZONE && ax >= ay * 0.6);
    setKey('ArrowUp',    dy < -DEADZONE && ay >= ax * 0.6);
    setKey('ArrowDown',  dy >  DEADZONE && ay >= ax * 0.6);
  };

  base.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (pointerId !== null) return;
    pointerId = e.pointerId;
    base.classList.add('is-active');
    try { base.setPointerCapture(pointerId); } catch {}
    update(e.clientX, e.clientY);
  });
  base.addEventListener('pointermove', (e) => {
    if (e.pointerId !== pointerId) return;
    update(e.clientX, e.clientY);
  });
  const end = (e) => {
    if (pointerId !== null && e.pointerId !== pointerId) return;
    pointerId = null;
    base.classList.remove('is-active');
    try { base.releasePointerCapture(e.pointerId); } catch {}
    knob.style.transform = '';
    releaseAll();
  };
  base.addEventListener('pointerup', end);
  base.addEventListener('pointercancel', end);
  base.addEventListener('contextmenu', (e) => e.preventDefault());
}
