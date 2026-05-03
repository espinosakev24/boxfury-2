import { DEFAULT_SKIN, HIT, NETWORK, PLAYER } from '@boxfury/shared';
import { Bow } from './Bow.js';
import { damageStageFromHp, drawCracks, hashSeed } from './cracks.js';
import { drawFace } from './faces.js';

const lerp = (a, b, t) => a + (b - a) * t;

export class RemotePlayer {
  constructor(scene, { id, x, y, color, facing = 1, bowAngle = 45, name = '', skin = DEFAULT_SKIN }) {
    this.id = id;
    this.scene = scene;
    this.color = color;
    this.skin = skin;
    this.facing = facing;
    this.sprite = scene.add.rectangle(x, y, PLAYER.WIDTH, PLAYER.HEIGHT, color);
    this.sprite.setStrokeStyle(2, 0xffffff, 0.4);
    scene.physics.add.existing(this.sprite);
    this.sprite.body.setAllowGravity(false);
    this.sprite.body.setImmovable(true);
    this.damageStage = 0;
    this.damageSeed = hashSeed(String(id));
    this.damageGfx = scene.add.graphics();
    this.faceGfx = scene.add.graphics();
    drawFace(this.faceGfx, this.skin, PLAYER.WIDTH, PLAYER.HEIGHT);
    this._postUpdateBound = () => {
      this.syncDamageOverlay();
      this.syncFaceOverlay();
    };
    scene.events.on('postupdate', this._postUpdateBound);
    this.bow = new Bow(scene, this);
    this.bow.setAngle(bowAngle);
    this.nameText = scene.add.text(x, y - PLAYER.HEIGHT / 2 - 6, name, {
      fontFamily: 'JetBrains Mono, monospace',
      fontSize: '11px',
      fontStyle: 'bold',
      color: '#' + color.toString(16).padStart(6, '0'),
      stroke: '#15151f',
      strokeThickness: 3,
    }).setOrigin(0.5, 1);
    this.buffer = [{ t: performance.now(), x, y, facing, bowAngle }];
  }

  setCarryingFlag(carrying) {
    this.bow.sprite.setVisible(!carrying);
  }

  playDeathAnim() {
    if (this.dead) return;
    this.dead = true;
    this.bow.sprite.setVisible(false);
    if (this.nameText) this.nameText.setVisible(false);
    const fallDir = this.facing >= 0 ? 1 : -1;
    this.scene.tweens.killTweensOf(this.sprite);
    this.scene.tweens.add({
      targets: this.sprite,
      rotation: fallDir * Math.PI / 2,
      y: this.sprite.y + 12,
      alpha: 0.55,
      duration: 360,
      ease: 'Cubic.easeOut',
    });
  }

  resetVisual() {
    this.dead = false;
    this.scene.tweens.killTweensOf(this.sprite);
    this.sprite.rotation = 0;
    this.sprite.alpha = 1;
    this.sprite.scaleX = 1;
    this.sprite.scaleY = 1;
    this.sprite.setVisible(true);
    this.bow.sprite.setVisible(true);
    if (this.nameText) this.nameText.setVisible(true);
    this.setDamageFromHp(PLAYER.MAX_HP);
  }

  setDamageFromHp(hp) {
    const stage = damageStageFromHp(hp);
    if (stage === this.damageStage) return;
    this.damageStage = stage;
    drawCracks(this.damageGfx, stage, PLAYER.WIDTH, PLAYER.HEIGHT, this.damageSeed);
  }

  syncDamageOverlay() {
    const gfx = this.damageGfx;
    if (!gfx) return;
    gfx.setPosition(this.sprite.x, this.sprite.y);
    gfx.setRotation(this.sprite.rotation);
    gfx.setScale(this.sprite.scaleX, this.sprite.scaleY);
    gfx.setVisible(this.sprite.visible && this.damageStage > 0);
  }

  setSkin(skin) {
    if (skin === this.skin) return;
    this.skin = skin;
    drawFace(this.faceGfx, this.skin, PLAYER.WIDTH, PLAYER.HEIGHT);
  }

  syncFaceOverlay() {
    const gfx = this.faceGfx;
    if (!gfx) return;
    gfx.setPosition(this.sprite.x, this.sprite.y);
    gfx.setRotation(this.sprite.rotation);
    gfx.setScale(this.sprite.scaleX * (this.facing < 0 ? -1 : 1), this.sprite.scaleY);
    gfx.setVisible(this.sprite.visible);
    gfx.setAlpha(this.sprite.alpha);
  }

  flashHit() {
    const sprite = this.sprite;
    if (!sprite?.active) return;
    const original = this.color;
    sprite.setFillStyle(0xffffff);
    this.scene.time.delayedCall(HIT.FLASH_MS, () => {
      if (sprite.active) sprite.setFillStyle(original);
    });
    this.scene.tweens.add({
      targets: sprite,
      scaleX: 1.25,
      scaleY: 0.8,
      duration: 90,
      yoyo: true,
      ease: 'Cubic.easeOut',
    });
  }

  applyState({ x, y, facing, bowAngle }) {
    const last = this.buffer[this.buffer.length - 1];
    this.buffer.push({
      t: performance.now(),
      x: typeof x === 'number' ? x : last.x,
      y: typeof y === 'number' ? y : last.y,
      facing: typeof facing === 'number' ? facing : last.facing,
      bowAngle: typeof bowAngle === 'number' ? bowAngle : last.bowAngle,
    });
    if (this.buffer.length > 30) this.buffer.shift();
  }

  update() {
    if (this.dead) {
      this.bow.update();
      return;
    }
    const renderTime = performance.now() - NETWORK.INTERP_DELAY_MS;

    while (this.buffer.length > 2 && this.buffer[1].t <= renderTime) {
      this.buffer.shift();
    }

    if (this.buffer.length >= 2) {
      const a = this.buffer[0];
      const b = this.buffer[1];
      const span = b.t - a.t;
      const t = span > 0 ? Math.max(0, Math.min(1, (renderTime - a.t) / span)) : 1;
      this.sprite.x = lerp(a.x, b.x, t);
      this.sprite.y = lerp(a.y, b.y, t);
      this.facing = b.facing;
      this.bow.setAngle(lerp(a.bowAngle, b.bowAngle, t));
    } else {
      const s = this.buffer[0];
      this.sprite.x = s.x;
      this.sprite.y = s.y;
      this.facing = s.facing;
      this.bow.setAngle(s.bowAngle);
    }

    this.bow.update();
    if (this.nameText) {
      this.nameText.setPosition(this.sprite.x, this.sprite.y - PLAYER.HEIGHT / 2 - 6);
    }
  }

  destroy() {
    if (this._postUpdateBound) {
      this.scene.events.off('postupdate', this._postUpdateBound);
      this._postUpdateBound = null;
    }
    this.bow.destroy();
    this.sprite.destroy();
    this.nameText?.destroy();
    this.damageGfx?.destroy();
    this.faceGfx?.destroy();
  }
}
