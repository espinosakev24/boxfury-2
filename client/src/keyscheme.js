const STORAGE_KEY = 'boxfury:keys';

export const KEY_SCHEMES = ['arrows', 'wasd', 'both'];
export const DEFAULT_KEY_SCHEME = 'both';

export function getKeyScheme() {
  const v = localStorage.getItem(STORAGE_KEY);
  return KEY_SCHEMES.includes(v) ? v : DEFAULT_KEY_SCHEME;
}

export function setKeyScheme(scheme) {
  if (!KEY_SCHEMES.includes(scheme)) return;
  localStorage.setItem(STORAGE_KEY, scheme);
  window.dispatchEvent(new CustomEvent('boxfury:keys', { detail: { scheme } }));
}
