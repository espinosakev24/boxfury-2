import Phaser from 'phaser';
import { GAME, TILE, WORLD } from '@boxfury/shared';
import { mulberry32 } from './cracks.js';

// Parallax backdrop: gradient sky + seeded geometric silhouette bands +
// per-theme ambient weather. Everything is drawn ONCE per build — the only
// per-frame work is recentering the weather emit zone on the camera.
//
// Band sizing: Phaser clamps scrollX in unzoomed screen units anchored at
// the camera CENTER, so the coverage anchor at zoom z is (W/2)*(1 + 1/z),
// NOT W/z. We size for the widest in-bounds view (zoom 1 -> anchor = W) so
// bands also cover the spectator/team-0 camera; extreme wheel zoom-out
// already shows past the world edge, where nothing can cover anyway.

const SKY_DEPTH = -100;
const BAND_DEPTH = -30;
const DRESSING_DEPTH = -8;
const WEATHER_DEPTH = -5;
const EMIT_W = 800;
const EMIT_H = 520;

export class Backdrop {
  constructor(scene, map, theme, quality = 'high') {
    this.scene = scene;
    this.theme = theme;
    this.quality = quality;
    this._objects = [];
    this._tweens = [];
    this._emitter = null;
    this._emitZone = null;
    // LOW tier: camera background color only (set by Level) — no backdrop.
    if (quality === 'low') return;
    this._build(map);
  }

  _build(map) {
    const scene = this.scene;
    const theme = this.theme;
    const mapW = map.pixelWidth;
    const mapH = map.pixelHeight;
    const zoom = GAME.ZOOM_ENABLED ? GAME.ZOOM : 1;
    const coverW = Math.max((WORLD.WIDTH / 2) * (1 + 1 / zoom), WORLD.WIDTH);
    const high = this.quality === 'high';

    // -- Gradient sky quad (the one sanctioned full-coverage layer) --------
    // Non-WebGL renderers always run at LOW quality (no backdrop), so the
    // gradient path is the only live one.
    const sky = scene.add.graphics().setDepth(SKY_DEPTH);
    sky.fillGradientStyle(
      theme.sky.top, theme.sky.top, theme.sky.bottom, theme.sky.bottom, 1,
    );
    sky.fillRect(0, 0, mapW, mapH);
    this._objects.push(sky);

    // -- Silhouette bands (drawn once, never per-frame) --------------------
    // MEDIUM skips the farthest band and all ambient tweens.
    const layers = high || theme.layers.length <= 1
      ? theme.layers
      : theme.layers.slice(1);
    layers.forEach((layer, i) => {
      const sf = layer.scrollFactor;
      // Drift accents move the band by ±px, shaving edge coverage — pad it.
      const driftPad = (layer.drift?.px ?? 0) * 2;
      const w = coverW + (mapW - coverW) * sf + driftPad;
      const g = scene.add
        .graphics()
        .setDepth(BAND_DEPTH + i)
        .setScrollFactor(sf, 1);
      const rng = mulberry32(layer.seed >>> 0);
      drawBand(g, layer, w, mapH, rng);
      this._objects.push(g);

      // Blink accent: amber window dots on the skyline, stepped alpha yoyo.
      if (high && layer.blink) {
        const dots = scene.add
          .graphics()
          .setDepth(BAND_DEPTH + i + 0.5)
          .setScrollFactor(sf, 1);
        drawBlinkDots(dots, layer, w, mapH, mulberry32((layer.seed + 7) >>> 0));
        this._objects.push(dots);
        // Square-wave blink via hold/repeatDelay: a 'Stepped' ease with the
        // default steps=1 returns 1 for ALL interior progress — it never
        // actually blinks.
        const blinkMs = layer.blink.ms ?? 800;
        this._tweens.push(
          scene.tweens.add({
            targets: dots,
            alpha: { from: 0.2, to: 1 },
            duration: 60,
            hold: blinkMs,
            yoyo: true,
            repeatDelay: blinkMs,
            repeat: -1,
          }),
        );
      }

      // Drift accent: the whole cloud band sways a few px over many seconds.
      if (high && layer.drift) {
        this._tweens.push(
          scene.tweens.add({
            targets: g,
            x: { from: -layer.drift.px, to: layer.drift.px },
            duration: layer.drift.ms ?? 12000,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut',
          }),
        );
      }
    });

    // -- Dressing: rising heat band (mantle) --------------------------------
    if (theme.dressing?.glowBand) {
      const band = theme.dressing.glowBand;
      const bandH = TILE.HEIGHT * 6;
      const g = scene.add.graphics().setDepth(DRESSING_DEPTH);
      // Per-corner alphas: fades to nothing as it rises from the floor.
      g.fillGradientStyle(
        band.color, band.color, band.color, band.color,
        0, 0, band.alpha, band.alpha,
      );
      g.fillRect(0, mapH - bandH, mapW, bandH);
      this._objects.push(g);
      if (high) {
        // Heat shimmer: object alpha multiplies the gradient corner alphas,
        // so 0.6->1 over a 0.1 band pulses the spec'd 0.06<->0.1.
        this._tweens.push(
          scene.tweens.add({
            targets: g,
            alpha: { from: 0.6, to: 1 },
            duration: 2400,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut',
          }),
        );
      }
    }

    // -- Ambient weather (snow / embers / motes) ----------------------------
    const ambient = theme.ambient;
    if (ambient && ambient.kind) {
      const count = high ? ambient.count : Math.ceil(ambient.count * 0.4);
      if (count > 0 && scene.textures.exists('fx-px')) {
        this._emitZone = new Phaser.Geom.Rectangle(
          -EMIT_W / 2, -EMIT_H / 2, EMIT_W, EMIT_H,
        );
        this._emitter = scene.add
          .particles(0, 0, 'fx-px', {
            emitZone: { type: 'random', source: this._emitZone },
            frequency: ambient.lifespan / count,
            lifespan: ambient.lifespan,
            speedX: { min: ambient.speedX[0], max: ambient.speedX[1] },
            speedY: { min: ambient.speedY[0], max: ambient.speedY[1] },
            alpha: { start: ambient.alpha, end: 0 },
            scale: ambient.shrink
              ? { start: 0.75, end: 0.25 }
              : { min: 0.25, max: 0.5 },
            tint: ambient.color,
            maxAliveParticles: count + 4,
          })
          .setDepth(WEATHER_DEPTH);
      }
    }
  }

  /** Per-frame: one rectangle resize+recenter. Called from GameScene.update.
   *  Sized to the live camera view so spectator zoom keeps weather coverage. */
  update() {
    if (!this._emitZone) return;
    const cam = this.scene.cameras.main;
    const w = Math.max(EMIT_W, cam.displayWidth + 120);
    const h = Math.max(EMIT_H, cam.displayHeight + 120);
    this._emitZone.width = w;
    this._emitZone.height = h;
    this._emitZone.x = cam.midPoint.x - w / 2;
    this._emitZone.y = cam.midPoint.y - h / 2;
  }

  destroy() {
    for (const t of this._tweens) t.remove();
    this._tweens.length = 0;
    for (const o of this._objects) o.destroy();
    this._objects.length = 0;
    this._emitter?.destroy();
    this._emitter = null;
    this._emitZone = null;
  }
}

// ---------------------------------------------------------------------------

function drawBand(g, layer, w, mapH, rng) {
  const { kind, color, alpha } = layer;
  switch (kind) {
    case 'grid': {
      // Blueprint grid: 2px lines (1px shimmers under pixelArt at zoom 1.8).
      g.lineStyle(2, color, alpha);
      const step = 72;
      for (let x = 0; x <= w; x += step) {
        g.lineBetween(x, 0, x, mapH);
      }
      for (let y = 0; y <= mapH; y += step) {
        g.lineBetween(0, y, w, y);
      }
      break;
    }
    case 'skyline': {
      g.fillStyle(color, alpha);
      let x = 0;
      while (x < w) {
        const bw = 40 + rng() * 50;
        const bh = 60 + rng() * 180;
        g.fillRect(x, mapH - bh, bw, bh);
        x += bw + 14 + rng() * 50;
      }
      break;
    }
    case 'ridge': {
      g.fillStyle(color, alpha);
      let x = -60;
      while (x < w) {
        const base = 160 + rng() * 220;
        const h = mapH * (0.16 + rng() * 0.2);
        const apex = x + base * (0.35 + rng() * 0.3);
        g.fillTriangle(x, mapH, x + base, mapH, apex, mapH - h);
        x += base * (0.45 + rng() * 0.3);
      }
      break;
    }
    case 'clouds': {
      g.fillStyle(color, alpha);
      const n = 3;
      for (let i = 0; i < n; i++) {
        const len = 80 + rng() * 120;
        const ch = 10 + rng() * 6;
        const cx = rng() * (w - len);
        const cy = mapH * (0.18 + rng() * 0.27);
        g.fillRoundedRect(cx, cy, len, ch, 2);
      }
      break;
    }
    case 'stalactites': {
      g.fillStyle(color, alpha);
      let x = -20;
      while (x < w) {
        const base = 50 + rng() * 70;
        const len = 60 + rng() * 100;
        g.fillTriangle(x, 0, x + base, 0, x + base / 2, len);
        x += base * (0.7 + rng() * 0.5);
      }
      let bx = -30;
      while (bx < w) {
        const base = 60 + rng() * 80;
        const len = 40 + rng() * 80;
        g.fillTriangle(bx, mapH, bx + base, mapH, bx + base / 2, mapH - len);
        bx += base * (0.9 + rng() * 0.6);
      }
      break;
    }
    case 'islands': {
      g.fillStyle(color, alpha);
      let x = 10;
      while (x < w) {
        const iw = 60 + rng() * 80;
        const ih = 14 + rng() * 12;
        const iy = mapH * (0.15 + rng() * 0.4);
        g.fillRoundedRect(x, iy, iw, ih, 2);
        // Inverted-triangle underside — the floating-rock read.
        const tail = 18 + rng() * 24;
        g.fillTriangle(
          x + 6, iy + ih,
          x + iw - 6, iy + ih,
          x + iw / 2, iy + ih + tail,
        );
        x += iw + 70 + rng() * 120;
      }
      break;
    }
    default:
      break;
  }
}

function drawBlinkDots(g, layer, w, mapH, rng) {
  // 2x2 window dots scattered low over the skyline band.
  g.fillStyle(layer.blink.color, layer.blink.alpha);
  const n = Math.max(4, Math.floor(w / 180));
  for (let i = 0; i < n; i++) {
    const x = rng() * w;
    const y = mapH - (30 + rng() * 150);
    g.fillRect(Math.round(x), Math.round(y), 2, 2);
  }
}

