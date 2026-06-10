import Phaser from 'phaser';

const KEY = 'boxfury.quality';
const EVENT = 'boxfury:quality';

export const TIERS = ['high', 'medium', 'low'];

function demote(tier) {
  const i = TIERS.indexOf(tier);
  return TIERS[Math.min(i + 1, TIERS.length - 1)];
}

/** Manual override picked in settings, or null for auto-detect. */
export function getSavedQuality() {
  try {
    const v = localStorage.getItem(KEY);
    return TIERS.includes(v) ? v : null;
  } catch {
    return null;
  }
}

export function setSavedQuality(value) {
  try {
    if (TIERS.includes(value)) localStorage.setItem(KEY, value);
    else localStorage.removeItem(KEY);
  } catch {}
  window.dispatchEvent(new CustomEvent(EVENT, { detail: value ?? null }));
}

/**
 * Resolve the quality tier for a new game start.
 * Manual override wins; otherwise derive from the device classes set by
 * detectDevice() in main.js plus hardware hints. Canvas-renderer demotion
 * happens later in GameScene.create, once the renderer exists.
 */
export function detectQualityTier() {
  const saved = getSavedQuality();
  if (saved) return saved;
  if (
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ) {
    return 'low';
  }
  let tier = document.body.classList.contains('is-mobile') ? 'medium' : 'high';
  const cores = navigator.hardwareConcurrency;
  const mem = navigator.deviceMemory;
  if ((cores && cores <= 4) || (mem && mem <= 4)) tier = demote(tier);
  return tier;
}

/** PostFX (vignette, kill shock) is HIGH-tier WebGL only. */
export function canAddPostFX(scene) {
  return (
    scene.renderer?.type === Phaser.WEBGL &&
    (scene.quality ?? scene.registry?.get('quality')) === 'high'
  );
}
