import { DEFAULT_SKIN, HIT, NETWORK, PLAYER } from '@boxfury/shared';
import { Bow } from './Bow.js';
import { SpawnShield } from './SpawnShield.js';
import { computeIdleBob, computeLean, computeWalkBob, drawBody, drawLegs } from './body.js';
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
    this.sprite.setFillStyle(color, 0);
    scene.physics.add.existing(this.sprite);
    this.sprite.body.setAllowGravity(false);
    this.sprite.body.setImmovable(true);
    this.legsGfx = scene.add.graphics();
    this.bodyGfx = scene.add.graphics();
    this.legPhase = 0;
    this._isMoving = false;
    this._isGrounded = true;
    this._lastSyncX = x;
    drawBody(this.bodyGfx, color, { stroke: true });
    drawLegs(this.legsGfx, color, 0, { isMoving: false, isGrounded: true });
    this.damageStage = 0;
    this.damageSeed = hashSeed(String(id));
    this.damageGfx = scene.add.graphics();
    this.faceGfx = scene.add.graphics();
    this._wasGrounded = true;
    this._lastVy = 0;
    this._walkAmp = 0;
    this._lastFacing = facing;
    drawFace(this.faceGfx, this.skin, PLAYER.WIDTH, PLAYER.HEIGHT);
    this._postUpdateBound = () => {
      this.syncBodyOverlay();
      this.syncLegsOverlay();
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
    this.legsGfx.setDepth(10);
    this.bodyGfx.setDepth(11);
    this.damageGfx.setDepth(12);
    this.faceGfx.setDepth(13);
    this.bow.sprite.setDepth(14);
    this.nameText.setDepth(14);

    this.spawnShield = new SpawnShield(scene, color);

    this.chatBubble = scene.add.text(x, y - PLAYER.HEIGHT / 2 - 22, '', {
      fontFamily: 'JetBrains Mono, monospace',
      fontSize: '9px',
      color: '#f5f5f0',
      backgroundColor: 'rgba(21,21,31,0.9)',
      padding: { x: 6, y: 3 },
      align: 'center',
      wordWrap: { width: 160 },
    }).setOrigin(0.5, 1).setDepth(16).setVisible(false);

    this.buffer = [{ t: performance.now(), x, y, facing, bowAngle }];
  }

  showChatBubble(text) {
    if (!this.chatBubble) return;
    if (this._chatBubbleTimer) {
      clearTimeout(this._chatBubbleTimer);
      this._chatBubbleTimer = null;
    }
    this.chatBubble.setText(text);
    this.chatBubble.setVisible(true);
    this.chatBubble.setAlpha(1);
    this._chatBubbleTimer = setTimeout(() => {
      if (!this.chatBubble?.active) return;
      this.scene.tweens.add({
        targets: this.chatBubble,
        alpha: 0,
        duration: 250,
        onComplete: () => this.chatBubble?.setVisible(false),
      });
      this._chatBubbleTimer = null;
    }, 4000);
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
    drawBody(this.bodyGfx, this.color, { stroke: true });
    this.setDamageFromHp(PLAYER.MAX_HP);
  }

  setDamageFromHp(hp) {
    const stage = damageStageFromHp(hp);
    if (stage === this.damageStage) return;
    this.damageStage = stage;
    drawCracks(this.damageGfx, stage, PLAYER.WIDTH, PLAYER.HEIGHT * (2 / 3), this.damageSeed);
  }

  syncDamageOverlay() {
    const gfx = this.damageGfx;
    if (!gfx) return;
    const offsetY = -PLAYER.HEIGHT / 6;
    const sin = Math.sin(this.sprite.rotation);
    const cos = Math.cos(this.sprite.rotation);
    const sy = this.sprite.scaleY;
    const bob = this._bobY ?? 0;
    const lean = this._leanAngle ?? 0;
    gfx.setPosition(
      this.sprite.x - offsetY * sin * sy,
      this.sprite.y + offsetY * cos * sy + bob,
    );
    gfx.setRotation(this.sprite.rotation + lean);
    gfx.setScale(this.sprite.scaleX, this.sprite.scaleY);
    gfx.setVisible(this.sprite.visible && this.damageStage > 0);
  }

  syncBodyOverlay() {
    const gfx = this.bodyGfx;
    if (!gfx) return;
    const bob = this._bobY ?? 0;
    const lean = this._leanAngle ?? 0;
    gfx.setPosition(this.sprite.x, this.sprite.y + bob);
    gfx.setRotation(this.sprite.rotation + lean);
    gfx.setScale(this.sprite.scaleX, this.sprite.scaleY);
    gfx.setVisible(this.sprite.visible);
    gfx.setAlpha(this.sprite.alpha);
  }

  syncLegsOverlay() {
    const gfx = this.legsGfx;
    if (!gfx) return;
    drawLegs(gfx, this.color, this.legPhase, {
      isMoving: this._isMoving,
      isGrounded: this._isGrounded,
      facing: this.facing,
      vyNorm: this._vyNorm ?? 0,
      walkAmp: this._walkAmp ?? 0,
    });
    gfx.setPosition(this.sprite.x, this.sprite.y);
    gfx.setRotation(this.sprite.rotation);
    gfx.setScale(this.sprite.scaleX, this.sprite.scaleY);
    gfx.setVisible(this.sprite.visible);
    gfx.setAlpha(this.sprite.alpha);
  }

  setSkin(skin) {
    if (skin === this.skin) return;
    this.skin = skin;
    drawFace(this.faceGfx, this.skin, PLAYER.WIDTH, PLAYER.HEIGHT);
  }

  syncFaceOverlay() {
    const gfx = this.faceGfx;
    if (!gfx) return;
    const bob = this._bobY ?? 0;
    const lean = this._leanAngle ?? 0;
    gfx.setPosition(this.sprite.x, this.sprite.y + bob);
    gfx.setRotation(this.sprite.rotation + lean);
    gfx.setScale(this.sprite.scaleX * (this.facing < 0 ? -1 : 1), this.sprite.scaleY);
    gfx.setVisible(this.sprite.visible);
    gfx.setAlpha(this.sprite.alpha);
  }

  playLandingSquash(impactVy) {
    if (!this.sprite?.active) return;
    const intensity = Math.max(0.25, Math.min(1, impactVy / 600));
    const squashY = 1 - 0.28 * intensity;
    const squashX = 1 + 0.22 * intensity;
    this._resetScaleTweens();
    this.scene.tweens.add({
      targets: this.sprite,
      scaleX: squashX,
      scaleY: squashY,
      duration: 70,
      ease: 'Quad.easeOut',
      yoyo: true,
    });
    this.scene.spawnLandingDust?.(
      this.sprite.x,
      this.sprite.y + PLAYER.HEIGHT / 2,
      this.color,
      intensity,
    );
    if (this.scene.cache?.audio?.exists('player-landing')) {
      this.scene.sound.play('player-landing', { volume: 0.18 + intensity * 0.22 });
    }
  }

  flashHit() {
    const sprite = this.sprite;
    if (!sprite?.active) return;
    drawBody(this.bodyGfx, 0xffffff, { stroke: true });
    this.scene.time.delayedCall(HIT.FLASH_MS, () => {
      if (this.bodyGfx) drawBody(this.bodyGfx, this.color, { stroke: true });
    });
    this._resetScaleTweens();
    this.scene.tweens.add({
      targets: sprite,
      scaleX: 1.25,
      scaleY: 0.8,
      duration: 90,
      yoyo: true,
      ease: 'Cubic.easeOut',
    });
  }

  _resetScaleTweens() {
    if (!this.sprite?.active) return;
    this.scene.tweens.killTweensOf(this.sprite);
    this.sprite.scaleX = 1;
    this.sprite.scaleY = 1;
  }

  applyState({ x, y, vy, facing, bowAngle }) {
    const last = this.buffer[this.buffer.length - 1];
    this.buffer.push({
      t: performance.now(),
      x: typeof x === 'number' ? x : last.x,
      y: typeof y === 'number' ? y : last.y,
      vy: typeof vy === 'number' ? vy : last.vy ?? 0,
      facing: typeof facing === 'number' ? facing : last.facing,
      bowAngle: typeof bowAngle === 'number' ? bowAngle : last.bowAngle,
    });
    if (this.buffer.length > 30) this.buffer.shift();
  }

  update() {
    const nowT = performance.now();
    const dt = this._lastUpdateAt ? Math.min(0.05, (nowT - this._lastUpdateAt) / 1000) : 0;
    this._lastUpdateAt = nowT;
    this.spawnShield?.update(dt, this.sprite.x, this.sprite.y);
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
      this._vy = b.vy ?? 0;
      this.bow.setAngle(lerp(a.bowAngle, b.bowAngle, t));
    } else {
      const s = this.buffer[0];
      this.sprite.x = s.x;
      this.sprite.y = s.y;
      this.facing = s.facing;
      this._vy = s.vy ?? 0;
      this.bow.setAngle(s.bowAngle);
    }

    this.bow.update();
    if (this.nameText) {
      const bob = this._bobY ?? 0;
      this.nameText.setPosition(this.sprite.x, this.sprite.y - PLAYER.HEIGHT / 2 - 6 + bob);
    }
    if (this.chatBubble?.visible) {
      const bob = this._bobY ?? 0;
      this.chatBubble.setPosition(this.sprite.x, this.sprite.y - PLAYER.HEIGHT / 2 - 22 + bob);
    }

    const dx = this.sprite.x - this._lastSyncX;
    this._lastSyncX = this.sprite.x;
    const vy = this._vy ?? 0;
    const grounded = Math.abs(vy) < 30;
    if (grounded && !this._wasGrounded && this._lastVy > 180) {
      this.playLandingSquash(this._lastVy);
    }
    this._wasGrounded = grounded;
    this._lastVy = vy;
    const moving = Math.abs(dx) > 0.4 && grounded;
    const targetAmp = moving ? 1 : 0;
    this._walkAmp += (targetAmp - this._walkAmp) * 0.18;
    if (this._walkAmp > 0.05 && grounded) this.legPhase += Math.abs(dx) * 0.1;
    else if (!grounded) this.legPhase = 0;
    this._isMoving = this._walkAmp > 0.05;
    this._isGrounded = grounded;
    this._vyNorm = Math.max(-1, Math.min(1, vy / 400));
    if (grounded) {
      const breathIntensity = 1 + (this.damageStage ?? 0) * 0.4;
      const walkBob = (moving ? computeWalkBob(this.legPhase) : 0) * this._walkAmp;
      const idleBob = computeIdleBob(performance.now(), breathIntensity) * (1 - this._walkAmp);
      this._bobY = walkBob + idleBob;
    } else {
      this._bobY = 0;
    }
    const vxApprox = dx * 60;
    if (grounded && moving) this._leanAngle = computeLean(vxApprox, PLAYER.SPEED);
    else if (!grounded) this._leanAngle = computeLean(vxApprox, PLAYER.SPEED) * 0.7;
    else this._leanAngle = 0;
    if (this._lastFacing !== this.facing && Math.abs(dx) > 1 && grounded) {
      this.scene.spawnLandingDust?.(
        this.sprite.x,
        this.sprite.y + PLAYER.HEIGHT / 2,
        this.color,
        0.45,
      );
    }
    this._lastFacing = this.facing;
  }

  destroy() {
    if (this._postUpdateBound) {
      this.scene.events.off('postupdate', this._postUpdateBound);
      this._postUpdateBound = null;
    }
    this.bow.destroy();
    this.sprite.destroy();
    this.nameText?.destroy();
    this.bodyGfx?.destroy();
    this.legsGfx?.destroy();
    this.damageGfx?.destroy();
    this.faceGfx?.destroy();
    if (this._chatBubbleTimer) {
      clearTimeout(this._chatBubbleTimer);
      this._chatBubbleTimer = null;
    }
    this.chatBubble?.destroy();
    this.spawnShield?.destroy();
  }
}
