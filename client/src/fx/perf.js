import Phaser from 'phaser';
import { TIERS } from './quality.js';

const SAMPLE_MS = 250; // 4Hz tick (HUD refresh)
// actualFps is a 1Hz EMA, so the demotion window holds one sample per
// second — 3 distinct values over 3s. Sampling it faster buys nothing.
const FPS_TICKS_PER_SAMPLE = 4;
const WINDOW = 3;
const DEMOTE_BELOW_FPS = 50;

/**
 * Frame governor + optional ?perf=1 diagnostic HUD.
 * Demotes the live quality tier one step when mean fps stays under 50 for a
 * full 3s window. Never promotes — a session that dipped once stays demoted
 * (promotion mid-match would oscillate).
 */
export class PerfMonitor {
  constructor(scene, { onDemote } = {}) {
    this.scene = scene;
    this.onDemote = onDemote;
    this.samples = [];
    this.postMs = 0;
    this._post0 = 0;
    this._hud = null;

    // Approximate the entity postupdate redraw cost: this POST_UPDATE
    // listener registers before any entity exists so it records t0 first;
    // PRE_RENDER fires after the remaining postupdate listeners (the entity
    // redraws) plus game POST_STEP/renderer.preRender/depthSort overhead,
    // but BEFORE the camera render submission — closing at RENDER would
    // fold the entire draw cost into the number.
    this._onPost = () => {
      this._post0 = performance.now();
    };
    this._onPreRender = () => {
      if (this._post0) this.postMs = performance.now() - this._post0;
    };
    scene.events.on(Phaser.Scenes.Events.POST_UPDATE, this._onPost);
    scene.events.on(Phaser.Scenes.Events.PRE_RENDER, this._onPreRender);

    this.timer = scene.time.addEvent({
      delay: SAMPLE_MS,
      loop: true,
      callback: () => this._sample(),
    });

    if (new URLSearchParams(window.location.search).get('perf') === '1') {
      this._mountHud();
    }
  }

  _sample() {
    const fps = this.scene.game.loop.actualFps;
    // Browsers throttle rAF on occluded/unfocused windows and in energy-
    // saver modes with NO visibilitychange event — indistinguishable from
    // real load by fps alone (Phaser's TimeStep docs say as much). Only
    // judge frames produced while the window is visible AND focused, and
    // drop the partial window whenever that stops being true.
    if (document.visibilityState !== 'visible' || !document.hasFocus()) {
      this.samples.length = 0;
      this._ticks = 0;
    } else {
      this._ticks = (this._ticks ?? 0) + 1;
      if (this._ticks % FPS_TICKS_PER_SAMPLE === 0) {
        this.samples.push(fps);
        if (this.samples.length > WINDOW) this.samples.shift();
        if (this.samples.length === WINDOW) {
          const mean = this.samples.reduce((a, b) => a + b, 0) / WINDOW;
          if (mean < DEMOTE_BELOW_FPS) this._demote(mean);
        }
      }
    }
    if (this._hud) this._updateHud(fps);
  }

  _demote(meanFps) {
    const cur = this.scene.quality;
    const next = TIERS[Math.min(TIERS.indexOf(cur) + 1, TIERS.length - 1)];
    if (next === cur) return;
    console.info(
      '[perf] demoting quality %s -> %s (mean fps %s)',
      cur,
      next,
      meanFps.toFixed(1),
    );
    this.samples.length = 0; // fresh window before judging the new tier
    this.onDemote?.(next);
    // Namespaced apart from 'boxfury:quality' (the SAVED preference event
    // from settings): this is a transient live demotion, not a choice.
    window.dispatchEvent(new CustomEvent('boxfury:quality:live', { detail: next }));
  }

  _mountHud() {
    const el = document.createElement('div');
    el.id = 'perf-hud';
    el.style.cssText = [
      'position:fixed',
      'top:8px',
      'right:8px',
      'z-index:9999',
      'pointer-events:none',
      "font-family:'JetBrains Mono',monospace",
      'font-size:11px',
      'line-height:1.5',
      'color:#f5f5f0',
      'background:rgba(21,21,31,0.85)',
      'border:1px solid #2a2a3a',
      'border-radius:2px',
      'padding:6px 8px',
      'white-space:pre',
      'text-align:right',
    ].join(';');
    document.body.appendChild(el);
    this._hud = el;
  }

  _updateHud(fps) {
    const counts = this.scene.fx?.aliveCounts?.() ?? {};
    const parts = Object.entries(counts)
      .map(([k, v]) => `${k}:${v}`)
      .join(' ');
    this._hud.textContent =
      `${fps.toFixed(0)} fps  [${this.scene.quality}]\n` +
      `post ${this.postMs.toFixed(2)}ms\n` +
      `${parts}`;
  }

  destroy() {
    this.timer?.remove();
    this.timer = null;
    this.scene.events.off(Phaser.Scenes.Events.POST_UPDATE, this._onPost);
    this.scene.events.off(Phaser.Scenes.Events.PRE_RENDER, this._onPreRender);
    this._hud?.remove();
    this._hud = null;
  }
}
