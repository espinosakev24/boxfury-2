export const SKINS = ['smile', 'neutral', 'sad', 'surprised', 'cool', 'angry'];

export const DEFAULT_SKIN = 'smile';

export function isValidSkin(id) {
  return typeof id === 'string' && SKINS.includes(id);
}

export function normalizeSkin(id) {
  return isValidSkin(id) ? id : DEFAULT_SKIN;
}
