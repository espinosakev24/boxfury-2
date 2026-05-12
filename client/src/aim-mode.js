const KEY = 'boxfury.aimInvert';
const EVENT = 'boxfury:aimInvert';

export function getAimInvert() {
  try {
    const v = localStorage.getItem(KEY);
    if (v === null) return false;
    return v === '1';
  } catch {
    return false;
  }
}

export function setAimInvert(value) {
  try {
    localStorage.setItem(KEY, value ? '1' : '0');
  } catch {}
  window.dispatchEvent(new CustomEvent(EVENT, { detail: !!value }));
}

export function onAimInvertChange(handler) {
  const listener = (e) => handler(!!e.detail);
  window.addEventListener(EVENT, listener);
  return () => window.removeEventListener(EVENT, listener);
}
