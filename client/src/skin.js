import { DEFAULT_SKIN, normalizeSkin } from '@boxfury/shared';

const KEY = 'boxfury:skin';

export function getSkin() {
  return normalizeSkin(localStorage.getItem(KEY) ?? DEFAULT_SKIN);
}

export function setSkin(id) {
  const v = normalizeSkin(id);
  localStorage.setItem(KEY, v);
}
