import Phaser from 'phaser';

// Trauma-based camera feel. One controller owns all followOffset and zoom
// writes so shake, kick, and (later) aim-lookahead compose instead of
// fighting. The offset rides on top of the existing startFollow lerp.
const TRAUMA_DECAY_PER_S = 1.4;
const KICK_HALF_LIFE_MS = 90;
// Shake intensity at full trauma. Screen px ≈ intensity * viewWidth * zoom²
// (~16 px at 1280/zoom 1.8) — well under the old shake's ±25 px, by design.
const SHAKE_INTENSITY = 0.004;
// followOffset passes through the 0.12 follow lerp (one step = kick * 0.12)
// AND camera roundPixels floors scroll to integers — a raw 8px kick steps
// 0.96px/frame and gets floored away in the positive direction. The gain
// keeps the lerp step above 1px so the kick survives in both directions.
const KICK_GAIN = 2;

export class CameraFx {
  constructor(scene) {
    this.scene = scene;
    this.trauma = 0;
    this.kickX = 0;
    this.kickY = 0;
    this.baseZoom = null;
    this._zoomPunching = false;
    // Mobile gets half-strength offsets; reduced-motion disables them.
    this._scale = document.body.classList.contains('is-mobile') ? 0.5 : 1;
    if (
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      this._scale = 0;
    }
  }

  /** Add screen-shake energy, 0..1. Stacks and caps; decays linearly. */
  addTrauma(amount) {
    this.trauma = Math.min(1, this.trauma + amount);
  }

  /** Directional camera kick (hit knockback, shot recoil). Decays fast. */
  kick(dirX, dirY, px) {
    const len = Math.hypot(dirX, dirY) || 1;
    this.kickX += (dirX / len) * px;
    this.kickY += (dirY / len) * px;
  }

  /** The resting zoom to return to after punches (set on spawn/respawn). */
  setBaseZoom(zoom) {
    this.baseZoom = zoom;
  }

  /** Brief zoom punch (kill confirm). Self-canceling, never stacks. */
  punchZoom(mult, inMs = 60, outMs = 180) {
    const cam = this.scene.cameras.main;
    if (!cam || this._zoomPunching) return;
    if (this._scale === 0) return; // reduced-motion: zoom pumps off too
    const base = this.baseZoom ?? cam.zoom;
    this._zoomPunching = true;
    // Chain via ZOOM_COMPLETE: restarting the shared zoom effect from inside
    // its own onUpdate callback gets killed by the trailing effectComplete().
    // The handler is kept so reset() can cancel a punch caught mid-flight.
    this._onZoomDone = () => {
      this._onZoomDone = null;
      this._zoomPunching = false;
      cam.zoomTo(base, outMs, 'Sine.easeIn', true);
    };
    cam.once(Phaser.Cameras.Scene2D.Events.ZOOM_COMPLETE, this._onZoomDone);
    cam.zoomTo(base * mult, inMs, 'Sine.easeOut', true);
  }

  /** Tick at the top of GameScene.update. dt in seconds. */
  update(dt) {
    const cam = this.scene.cameras.main;
    if (!cam) return;
    this.trauma = Math.max(0, this.trauma - TRAUMA_DECAY_PER_S * dt);
    const kickDecay = Math.pow(0.5, (dt * 1000) / KICK_HALF_LIFE_MS);
    this.kickX *= kickDecay;
    this.kickY *= kickDecay;
    if (this._scale === 0) return;
    // Trauma rumble rides the engine shake effect: it translates the camera
    // matrix AFTER the follow lerp and the roundPixels floor, both of which
    // reduce a sub-pixel followOffset sine to nothing. Restarted each frame
    // so amplitude tracks trauma²; expires on its own when trauma drains.
    if (this.trauma > 0.05) {
      cam.shake(80, this.trauma * this.trauma * SHAKE_INTENSITY * this._scale, true);
    }
    // Directional kick stays on followOffset so it composes with the follow.
    if (!cam._follow) return;
    const gx = this.kickX * KICK_GAIN * this._scale;
    const gy = this.kickY * KICK_GAIN * this._scale;
    if (Math.abs(gx) < 0.1 && Math.abs(gy) < 0.1) {
      cam.setFollowOffset(0, 0);
      return;
    }
    cam.setFollowOffset(-gx, -gy);
  }

  /** Zero everything — respawn, spectator entry, team switch, teardown. */
  reset() {
    this.trauma = 0;
    this.kickX = 0;
    this.kickY = 0;
    const cam = this.scene.cameras?.main;
    if (!cam) return;
    cam.setFollowOffset(0, 0);
    // Cancel any in-flight zoom punch: the running zoom effect would
    // override a caller's setZoom every frame, and the pending listener
    // would re-zoom to a stale base (e.g. spectator camera stuck at 1.8).
    if (this._onZoomDone) {
      cam.off(Phaser.Cameras.Scene2D.Events.ZOOM_COMPLETE, this._onZoomDone);
      this._onZoomDone = null;
    }
    if (cam.zoomEffect?.isRunning) cam.zoomEffect.reset();
    this._zoomPunching = false;
    this.baseZoom = null;
  }
}
