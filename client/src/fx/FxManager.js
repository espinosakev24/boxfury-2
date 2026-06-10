import Phaser from 'phaser';

// All burst FX render at depth 18: above bodies (10-13), bow/name (14),
// shield (15) and bubbles (16); below arrow trail (19) and arrows (20).
const FX_DEPTH = 18;

// maxAliveParticles per category and tier. Overflow clips the burst —
// that is the intended degradation under sustained combat.
const CAPS = {
  hit: { high: 48, medium: 24, low: 12 },
  dust: { high: 32, medium: 16, low: 8 },
  splash: { high: 24, medium: 12, low: 6 },
  sparks: { high: 24, medium: 12, low: 0 },
  debris: { high: 24, medium: 12, low: 0 },
};

// Categories that vanish entirely on LOW (pure ornamentation).
const OFF_ON_LOW = new Set(['sparks', 'debris']);

const RING_POOL_MAX = 8;
// fx-ring is baked at 3x (see fx/textures.js) — render at 1/3.
const RING_BASE_SCALE = 1 / 3;

/**
 * Single facade for all combat/world particle bursts. Built once per
 * GameScene (the Phaser.Game dies every match, so emitters and their
 * textures are recreated in create()). Always sets particleTint right
 * before explode() — a stale tint sprays the wrong team color.
 */
export class FxManager {
  constructor(scene, quality = 'high') {
    this.scene = scene;
    this.quality = quality;
    this._rings = [];

    const cap = (cat) => CAPS[cat][quality] ?? CAPS[cat].high;

    // Radial hit burst: 2-4px squares flying outward, fading.
    this.hitEmitter = scene.add
      .particles(0, 0, 'fx-px', {
        emitting: false,
        speed: { min: 120, max: 360 },
        angle: { min: 0, max: 360 },
        lifespan: { min: 220, max: 360 },
        scale: { min: 0.5, max: 1 },
        alpha: { start: 1, end: 0 },
        maxAliveParticles: cap('hit'),
      })
      .setDepth(FX_DEPTH);

    // Landing/turn dust: soft 2-3px puffs drifting up then settling.
    this.dustEmitter = scene.add
      .particles(0, 0, 'fx-px', {
        emitting: false,
        speed: { min: 30, max: 90 },
        angle: { min: 200, max: 340 },
        gravityY: 120,
        lifespan: { min: 220, max: 380 },
        scale: { min: 0.5, max: 0.75 },
        alpha: { start: 0.7, end: 0 },
        maxAliveParticles: cap('dust'),
      })
      .setDepth(FX_DEPTH);

    // Directional splash (arrow impacts): 1-2px chips in a cone.
    this.splashEmitter = scene.add
      .particles(0, 0, 'fx-px', {
        emitting: false,
        speed: { min: 70, max: 200 },
        lifespan: { min: 220, max: 340 },
        scale: { min: 0.25, max: 0.5 },
        alpha: { start: 0.9, end: 0 },
        maxAliveParticles: cap('splash'),
      })
      .setDepth(FX_DEPTH);

    // Additive sparks: short lines aligned to their velocity.
    this.sparksEmitter = scene.add
      .particles(0, 0, 'fx-line', {
        emitting: false,
        speed: { min: 200, max: 420 },
        lifespan: { min: 120, max: 240 },
        alpha: { start: 1, end: 0 },
        blendMode: Phaser.BlendModes.ADD,
        // Align each line to its velocity. emitCallback fires AFTER fire()
        // computes velocity — a rotate:{onEmit} op runs before it and would
        // read 0 (fresh particle) or a stale previous-life velocity.
        emitCallback: (p) => {
          const rad = Math.atan2(p.velocityY, p.velocityX);
          p.rotation = rad;
          p.angle = Phaser.Math.RadToDeg(rad);
        },
        maxAliveParticles: Math.max(1, cap('sparks')),
      })
      .setDepth(FX_DEPTH);

    // Death debris: scattered shards under heavy gravity (each shard gets
    // one random orientation at emit; real tumble comes with Phase 3 polish).
    this.debrisEmitter = scene.add
      .particles(0, 0, 'fx-px', {
        emitting: false,
        speed: { min: 100, max: 260 },
        gravityY: 600,
        lifespan: { min: 400, max: 700 },
        scale: { min: 0.5, max: 1.25 },
        alpha: { start: 1, end: 0 },
        rotate: { min: -180, max: 180 },
        maxAliveParticles: Math.max(1, cap('debris')),
      })
      .setDepth(FX_DEPTH);
  }

  /** Live tier change from the frame governor (demote only, mid-match). */
  setQuality(quality) {
    this.quality = quality;
    const cap = (cat) => CAPS[cat][quality] ?? CAPS[cat].high;
    this.hitEmitter.maxAliveParticles = cap('hit');
    this.dustEmitter.maxAliveParticles = cap('dust');
    this.splashEmitter.maxAliveParticles = cap('splash');
    this.sparksEmitter.maxAliveParticles = Math.max(1, cap('sparks'));
    this.debrisEmitter.maxAliveParticles = Math.max(1, cap('debris'));
  }

  /** Live particle counts per category — consumed by the ?perf=1 HUD. */
  aliveCounts() {
    return {
      hit: this.hitEmitter.getAliveParticleCount(),
      dust: this.dustEmitter.getAliveParticleCount(),
      splash: this.splashEmitter.getAliveParticleCount(),
      sparks: this.sparksEmitter.getAliveParticleCount(),
      debris: this.debrisEmitter.getAliveParticleCount(),
    };
  }

  _count(category, n) {
    if (this.quality === 'low' && OFF_ON_LOW.has(category)) return 0;
    const mult = this.quality === 'high' ? 1 : 0.5;
    return Math.max(1, Math.round(n * mult));
  }

  _aimCone(emitter, deg, spread) {
    emitter.ops.angle.loadConfig({ angle: { min: deg - spread, max: deg + spread } });
  }

  /** Radial burst at (x, y), e.g. a body hit. */
  burst(x, y, count, tint) {
    const n = this._count('hit', count);
    if (!n) return;
    this.hitEmitter.particleTint = tint;
    this.hitEmitter.explode(n, x, y);
  }

  /** Directional splash cone centered on `deg` (degrees). */
  cone(x, y, deg, count, tint = 0xffffff) {
    const n = this._count('splash', count);
    if (!n) return;
    this._aimCone(this.splashEmitter, deg, 90);
    this.splashEmitter.particleTint = tint;
    this.splashEmitter.explode(n, x, y);
  }

  /** Soft dust puff (landings, direction changes). Intensity scales speed. */
  dust(x, y, count, tint = 0xffffff, intensity = 1) {
    const n = this._count('dust', count);
    if (!n) return;
    // Harder landings kick dust out faster, not just more of it.
    const i = Math.max(0.2, Math.min(1, intensity));
    this.dustEmitter.ops.speedX.loadConfig({ speedX: { min: 30 * i, max: 90 * i } });
    this.dustEmitter.particleTint = tint;
    this.dustEmitter.explode(n, x, y);
  }

  /** Additive sparks in a tight cone along `deg`. */
  sparks(x, y, deg, count, tint = 0xffffff) {
    const n = this._count('sparks', count);
    if (!n) return;
    this._aimCone(this.sparksEmitter, deg, 25);
    this.sparksEmitter.particleTint = tint;
    this.sparksEmitter.explode(n, x, y);
  }

  /** Tumbling debris biased along (dirX, dirY) — death shards. */
  debris(x, y, count, tint, dirX = 0, dirY = -1) {
    const n = this._count('debris', count);
    if (!n) return;
    const deg = Phaser.Math.RadToDeg(Math.atan2(dirY, dirX));
    this._aimCone(this.debrisEmitter, deg, 80);
    this.debrisEmitter.particleTint = tint;
    this.debrisEmitter.explode(n, x, y);
  }

  /** Pooled expanding box ring (spawn pulse, kill confirm, captures). */
  ring(x, y, tint, { scale = 2.6, duration = 1100 } = {}) {
    let img = this._rings.find((r) => !r.visible);
    if (!img) {
      if (this._rings.length >= RING_POOL_MAX) return;
      img = this.scene.add.image(0, 0, 'fx-ring').setDepth(FX_DEPTH);
      this._rings.push(img);
    }
    img
      .setPosition(x, y)
      .setTint(tint)
      .setAlpha(1)
      .setScale(RING_BASE_SCALE)
      .setVisible(true);
    this.scene.tweens.add({
      targets: img,
      scaleX: scale * RING_BASE_SCALE,
      scaleY: scale * RING_BASE_SCALE,
      alpha: 0,
      duration,
      ease: 'Cubic.easeOut',
      onComplete: () => img.setVisible(false),
    });
  }

  /** Brief additive glow pop — HIGH tier only (the sanctioned soft effect). */
  glowPop(x, y, tint, { scale = 1.1, duration = 70, alpha = 0.7 } = {}) {
    if (this.quality !== 'high') return;
    const img = this.scene.add
      .image(x, y, 'fx-glow')
      .setDepth(FX_DEPTH)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setTint(tint)
      .setAlpha(alpha)
      .setScale(0.4);
    this.scene.tweens.add({
      targets: img,
      scale,
      alpha: 0,
      duration,
      ease: 'Quad.easeOut',
      onComplete: () => img.destroy(),
    });
  }

  /** Muzzle flash on shot release: glow pop + spark cone along fire angle. */
  muzzle(x, y, deg, tint) {
    this.glowPop(x, y, tint);
    this.sparks(x, y, deg, 4, tint);
  }

  /** Death burst: debris along the kill direction + a longer glow flash. */
  deathBurst(x, y, tint, dirX = 0, dirY = -1) {
    this.debris(x, y, 12, tint, dirX, dirY);
    this.glowPop(x, y, tint, { duration: 200, scale: 1.4 });
  }

  destroy() {
    for (const e of [
      this.hitEmitter,
      this.dustEmitter,
      this.splashEmitter,
      this.sparksEmitter,
      this.debrisEmitter,
    ]) {
      e?.destroy();
    }
    for (const r of this._rings) r?.destroy();
    this._rings.length = 0;
  }
}
