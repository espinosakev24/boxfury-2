import Phaser from 'phaser';
import { BOW } from '@boxfury/shared';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

const ARC_STEPS = 14;
const ARC_BULGE = 5;
const ARC_CHORD = BOW.LENGTH * 0.7;
const ARC_CENTER_X = BOW.LENGTH * 0.5;
const STRING_PULL_MAX = ARC_BULGE + 5;

export class Bow {
  constructor(scene, owner) {
    this.scene = scene;
    this.owner = owner;
    this.angle = BOW.MIN_ANGLE;
    this.pull = 0;
    this._stringOvershoot = 0;
    this._recoil = 0;
    this.sprite = scene.add.graphics();
    this._draw();
  }

  triggerSnap(pull = 0.6) {
    this._stringOvershoot = 0.45;
    this.scene.tweens.add({
      targets: this,
      _stringOvershoot: 0,
      duration: 160,
      ease: 'Sine.easeOut',
    });
    // Rotation recoil scaled by draw strength, eased back over 120ms.
    this._recoil = -0.1 * clamp(pull, 0, 1);
    this.scene.tweens.add({
      targets: this,
      _recoil: 0,
      duration: 120,
      ease: 'Expo.easeOut',
    });
  }

  setAngle(deg) {
    this.angle = clamp(deg, BOW.MIN_ANGLE, BOW.MAX_ANGLE);
  }

  getRotation() {
    const dirRad = ((90 - this.angle) * Math.PI) / 180;
    return this.owner.facing > 0 ? dirRad : Math.PI - dirRad;
  }

  update() {
    this.sprite.x = this.owner.sprite.x;
    this.sprite.y =
      this.owner.sprite.y +
      (this.owner._bobY ?? 0) +
      (this.owner._crouchAmp ?? 0) * 7;
    // Recoil sign follows facing so the kick always reads "back from the shot".
    const recoil = (this._recoil ?? 0) * (this.owner.facing > 0 ? 1 : -1);
    this.sprite.rotation = this.getRotation() + recoil;
    this._draw();
    this._updateChargeFx();
  }

  _draw() {
    const gfx = this.sprite;
    gfx.clear();
    const pull = clamp(this.pull ?? 0, 0, 1);

    gfx.lineStyle(1, 0xffffff, 0.35);
    gfx.beginPath();
    gfx.moveTo(0, 0);
    gfx.lineTo(BOW.LENGTH, 0);
    gfx.strokePath();

    // Limb tension: the arc flattens and the stroke thickens as draw
    // weight builds — the bow itself telegraphs the charge.
    const bulge = ARC_BULGE * (1 - 0.3 * pull);
    gfx.lineStyle(2 + pull, 0xffffff, 1);
    gfx.beginPath();
    for (let i = 0; i <= ARC_STEPS; i++) {
      const t = i / ARC_STEPS;
      const a = Math.PI * (t - 0.5);
      const y = (ARC_CHORD / 2) * Math.sin(a);
      const x = ARC_CENTER_X + bulge * Math.cos(a);
      if (i === 0) gfx.moveTo(x, y);
      else gfx.lineTo(x, y);
    }
    gfx.strokePath();

    const effectivePull = pull - (this._stringOvershoot ?? 0);
    const midX = ARC_CENTER_X - effectivePull * STRING_PULL_MAX;
    gfx.lineStyle(1, 0xffffff, 0.85);
    gfx.beginPath();
    gfx.moveTo(ARC_CENTER_X, -ARC_CHORD / 2);
    gfx.lineTo(midX, 0);
    gfx.lineTo(ARC_CENTER_X, ARC_CHORD / 2);
    gfx.strokePath();

    // Full-charge tell: blinking bone nock dot (2 blinks/s, on at every
    // tier). Offset behind the string vertex so it reads against the deep
    // background instead of vanishing into the white string. Owner-only
    // until pull is networked (Phase 3 charge telegraphy).
    if (pull >= 0.97 && Math.floor(performance.now() / 250) % 2 === 0) {
      gfx.fillStyle(0xf5f5f0, 1);
      gfx.fillRect(midX - 5, -1.5, 3, 3);
    }
  }

  /** Hide transient charge FX immediately (death, despawn). */
  hideFx() {
    this._glow?.setVisible(false);
  }

  _updateChargeFx() {
    const scene = this.scene;
    const pull = clamp(this.pull ?? 0, 0, 1);
    // Mid-match governor demotion drops the ornament, like FxManager does.
    if (this._glow && scene.quality === 'low') {
      this._glow.destroy();
      this._glow = null;
    }
    // Created lazily on first actual charge — remote bows sit at pull 0
    // (until charge telegraphy ships) and never allocate one.
    if (
      !this._glow &&
      pull > 0.05 &&
      scene.quality &&
      scene.quality !== 'low' &&
      scene.textures?.exists('fx-glow')
    ) {
      this._glow = scene.add
        .image(0, 0, 'fx-glow')
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDepth(14)
        .setTint(this.owner.color ?? 0xf5f5f0)
        .setVisible(false);
    }
    const rot = this.sprite.rotation;
    const midX = ARC_CENTER_X - pull * STRING_PULL_MAX;
    const nx = this.sprite.x + Math.cos(rot) * midX;
    const ny = this.sprite.y + Math.sin(rot) * midX;
    if (this._glow) {
      if (pull > 0.05 && this.sprite.visible) {
        this._glow
          .setVisible(true)
          .setPosition(nx, ny)
          .setScale(0.15 + 0.45 * pull)
          .setAlpha(0.3 * pull);
      } else if (this._glow.visible) {
        this._glow.setVisible(false);
      }
    }
    // Full-charge sparks at the nock (HIGH only), timestamp-throttled.
    if (pull >= 0.95 && scene.quality === 'high' && scene.fx) {
      const now = performance.now();
      if (!this._lastSparkAt || now - this._lastSparkAt > 130) {
        this._lastSparkAt = now;
        scene.fx.sparks(nx, ny, Phaser.Math.RadToDeg(rot), 2, this.owner.color ?? 0xffffff);
      }
    }
  }

  destroy() {
    this.scene.tweens.killTweensOf(this);
    this._glow?.destroy();
    this._glow = null;
    this.sprite.destroy();
  }
}
