import { ARROW, BOW, DEFAULT_SKIN, HIT, PLAYER } from '@boxfury/shared';
import { Bow } from './Bow.js';
import { SpawnShield } from './SpawnShield.js';
import {
  computeIdleBob,
  computeLean,
  computeWalkBob,
  drawBody,
  drawLegs,
} from './body.js';
import { damageStageFromHp, drawCracks, hashSeed } from './cracks.js';
import { drawFace } from './faces.js';

export class Player {
  constructor(
    scene,
    { id, x, y, color = 0x4ade80, name = '', skin = DEFAULT_SKIN },
  ) {
    this.scene = scene;
    this.id = id;
    this.color = color;
    this.skin = skin;
    this.facing = 1;
    this.charging = false;
    this.carryingFlag = false;
    this.inputLockedUntil = 0;
    this.sprite = scene.add.rectangle(x, y, PLAYER.WIDTH, PLAYER.HEIGHT, color);
    this.sprite.setFillStyle(color, 0);
    scene.physics.add.existing(this.sprite);
    this.sprite.body.setCollideWorldBounds(true);
    this.legsGfx = scene.add.graphics();
    this.bodyGfx = scene.add.graphics();
    this.legPhase = 0;
    this._isMoving = false;
    this._isGrounded = true;
    drawBody(this.bodyGfx, color);
    drawLegs(this.legsGfx, color, 0, { isMoving: false, isGrounded: true });
    this.damageStage = 0;
    this.damageSeed = hashSeed(String(id));
    this.damageGfx = scene.add.graphics();
    this.faceGfx = scene.add.graphics();
    this._wasGrounded = true;
    this._lastVy = 0;
    this._walkAmp = 0;
    this._lastFacing = 1;
    drawFace(this.faceGfx, this.skin, PLAYER.WIDTH, PLAYER.HEIGHT);
    this._postUpdateBound = () => {
      this.syncBodyOverlay();
      this.syncLegsOverlay();
      this.syncDamageOverlay();
      this.syncFaceOverlay();
    };
    scene.events.on('postupdate', this._postUpdateBound);
    this.bow = new Bow(scene, this);
    this.nameText = scene.add
      .text(x, y - PLAYER.HEIGHT / 2 - 6, name, {
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: '11px',
        fontStyle: 'bold',
        color: '#' + color.toString(16).padStart(6, '0'),
        stroke: '#15151f',
        strokeThickness: 3,
      })
      .setOrigin(0.5, 1);
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

  move({ left, right, lockFacing = false }) {
    if (performance.now() < this.inputLockedUntil) return;
    const vx = (right ? 1 : 0) - (left ? 1 : 0);
    const baseSpeed = this.carryingFlag ? PLAYER.CARRY_SPEED : PLAYER.SPEED;
    const speed = this._crouchInput ? baseSpeed * 0.55 : baseSpeed;
    this.sprite.body.setVelocityX(vx * speed);
    if (vx !== 0 && !lockFacing) this.facing = vx;
  }

  setCrouching(active) {
    const grounded = this.sprite.body.blocked.down || this.sprite.body.touching.down;
    this._crouchInput = !!active && grounded;
  }

  dropThrough() {
    const body = this.sprite.body;
    if (!body) return;
    if (this._platformCollider) this._platformCollider.active = false;
    body.setVelocityY(110);
    this._resetScaleTweens();
    this.scene.tweens.chain({
      targets: this.sprite,
      tweens: [
        { scaleX: 1.15, scaleY: 0.78, duration: 80, ease: 'Quad.easeOut' },
        { scaleX: 1, scaleY: 1, duration: 120, ease: 'Quad.easeIn' },
      ],
    });
    this.scene.spawnLandingDust?.(
      this.sprite.x,
      this.sprite.y + PLAYER.HEIGHT / 2,
      this.color,
      0.5,
    );
    this.scene.time.delayedCall(240, () => {
      if (this._platformCollider) this._platformCollider.active = true;
    });
  }

  applyKnockback(vx, vy) {
    this.sprite.body.setVelocity(vx, vy);
    this.inputLockedUntil = performance.now() + HIT.INPUT_LOCK_MS;
    this.charging = false;
    this.bow.setAngle(BOW.MIN_ANGLE);
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
      rotation: (fallDir * Math.PI) / 2,
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
    this.bow.sprite.setVisible(!this.carryingFlag);
    if (this.nameText) this.nameText.setVisible(true);
    drawBody(this.bodyGfx, this.color);
    this.setDamageFromHp(PLAYER.MAX_HP);
  }

  setDamageFromHp(hp) {
    const stage = damageStageFromHp(hp);
    if (stage === this.damageStage) return;
    this.damageStage = stage;
    drawCracks(
      this.damageGfx,
      stage,
      PLAYER.WIDTH,
      PLAYER.HEIGHT * (2 / 3),
      this.damageSeed,
    );
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
    const crouch = (this._crouchAmp ?? 0) * 7;
    gfx.setPosition(
      this.sprite.x - offsetY * sin * sy,
      this.sprite.y + offsetY * cos * sy + bob + crouch,
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
    const crouch = (this._crouchAmp ?? 0) * 7;
    gfx.setPosition(this.sprite.x, this.sprite.y + bob + crouch);
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
    const crouch = (this._crouchAmp ?? 0) * 7;
    gfx.setPosition(this.sprite.x, this.sprite.y + bob + crouch);
    gfx.setRotation(this.sprite.rotation + lean);
    gfx.setScale(
      this.sprite.scaleX * (this.facing < 0 ? -1 : 1),
      this.sprite.scaleY,
    );
    gfx.setVisible(this.sprite.visible);
    gfx.setAlpha(this.sprite.alpha);
  }

  flashHit() {
    const sprite = this.sprite;
    if (!sprite?.active) return;
    drawBody(this.bodyGfx, 0xffffff);
    this.scene.time.delayedCall(HIT.FLASH_MS, () => {
      if (this.bodyGfx) drawBody(this.bodyGfx, this.color);
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

  setCarryingFlag(carrying) {
    this.carryingFlag = carrying;
    if (carrying) {
      this.charging = false;
      this.bow.setAngle(BOW.MIN_ANGLE);
    }
    this.bow.sprite.setVisible(!carrying);
  }

  jump() {
    const now = performance.now();
    if (this._lastJumpAt && now - this._lastJumpAt < PLAYER.JUMP_COOLDOWN_MS) return;
    if (this.sprite.body.blocked.down || this.sprite.body.touching.down) {
      this._lastJumpAt = now;
      this.sprite.body.setVelocityY(-PLAYER.JUMP_SPEED);
      this.playJumpCrouch();
      if (this.scene.cache?.audio?.exists('jump')) {
        this.scene.sound.play('jump', { volume: 0.1 });
      }
    }
  }

  playJumpCrouch() {
    if (!this.sprite?.active) return;
    this._resetScaleTweens();
    this.scene.tweens.chain({
      targets: this.sprite,
      tweens: [
        { scaleX: 0.86, scaleY: 1.18, duration: 110, ease: 'Quad.easeOut' },
        { scaleX: 1, scaleY: 1, duration: 130, ease: 'Quad.easeIn' },
      ],
    });
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
      this.scene.sound.play('player-landing', {
        volume: 0.05 + intensity * 0.1,
      });
    }
  }

  chargeBow() {
    if (this.carryingFlag) return;
    this.charging = true;
  }

  releaseBow() {
    if (this.carryingFlag || !this.charging) return null;
    this.charging = false;
    const now = performance.now();
    if (this._lastShotAt && now - this._lastShotAt < ARROW.COOLDOWN_MS) {
      this.bow.setAngle(BOW.MIN_ANGLE);
      return null;
    }
    this._lastShotAt = now;
    const rot = this.bow.getRotation();
    const cos = Math.cos(rot);
    const sin = Math.sin(rot);
    const shot = {
      x: this.sprite.x + cos * BOW.LENGTH,
      y: this.sprite.y + sin * BOW.LENGTH,
      vx: cos * ARROW.SPEED,
      vy: sin * ARROW.SPEED,
    };
    this.bow.setAngle(BOW.MIN_ANGLE);
    this.bow.triggerSnap();
    if (this.scene.cache?.audio?.exists('arrow-shoot')) {
      this.scene.sound.play('arrow-shoot', { volume: 0.2 });
    }
    return shot;
  }

  update(dt) {
    this.spawnShield?.update(dt, this.sprite.x, this.sprite.y);
    if (this.charging && !this._wasCharging) this._playChargeSfx();
    else if (!this.charging && this._wasCharging) this._stopChargeSfx();
    this._wasCharging = this.charging;

    if (this.charging) {
      this.bow.setAngle(this.bow.angle + BOW.CHARGE_RATE * dt);
    } else {
      this.bow.setAngle(BOW.MIN_ANGLE);
    }
    this.bow.update();

    const body = this.sprite.body;
    const vx = body.velocity.x;
    const vy = body.velocity.y;
    const grounded = body.blocked.down || body.touching.down;
    if (grounded && !this._wasGrounded && this._lastVy > 180) {
      this.playLandingSquash(this._lastVy);
    }
    this._wasGrounded = grounded;
    this._lastVy = vy;
    const moving = Math.abs(vx) > 5 && grounded;
    const targetAmp = moving ? 1 : 0;
    this._walkAmp += (targetAmp - this._walkAmp) * 0.18;
    const targetCrouch = this._crouchInput && grounded ? 1 : 0;
    this._crouchAmp = (this._crouchAmp ?? 0) + (targetCrouch - (this._crouchAmp ?? 0)) * 0.22;
    if (this._walkAmp > 0.05 && grounded)
      this.legPhase += Math.abs(vx) * dt * 0.1;
    else if (!grounded) this.legPhase = 0;
    const shouldWalk =
      moving && grounded && performance.now() >= this.inputLockedUntil;
    if (shouldWalk && !this._wasWalking) this._playWalkSfx();
    else if (!shouldWalk && this._wasWalking) this._stopWalkSfx();
    this._wasWalking = shouldWalk;
    this._isMoving = this._walkAmp > 0.05;
    this._isGrounded = grounded;
    this._vyNorm = Math.max(-1, Math.min(1, vy / 400));
    if (grounded) {
      const breathIntensity = 1 + (this.damageStage ?? 0) * 0.4;
      const walkBob =
        (moving ? computeWalkBob(this.legPhase) : 0) * this._walkAmp;
      const idleBob =
        computeIdleBob(performance.now(), breathIntensity) *
        (1 - this._walkAmp);
      this._bobY = walkBob + idleBob;
    } else {
      this._bobY = 0;
    }
    if (grounded && moving) this._leanAngle = computeLean(vx, PLAYER.SPEED);
    else if (!grounded) this._leanAngle = computeLean(vx, PLAYER.SPEED) * 0.7;
    else this._leanAngle = 0;
    if (this._lastFacing !== this.facing && Math.abs(vx) > 60 && grounded) {
      this.scene.spawnLandingDust?.(
        this.sprite.x,
        this.sprite.y + PLAYER.HEIGHT / 2,
        this.color,
        0.45,
      );
    }
    this._lastFacing = this.facing;
  }

  getState() {
    const b = this.sprite.body;
    return {
      x: this.sprite.x,
      y: this.sprite.y,
      vx: b.velocity.x,
      vy: b.velocity.y,
      facing: this.facing,
      bowAngle: this.bow.angle,
    };
  }

  _playWalkSfx() {
    const sound = this.scene?.sound;
    if (!sound) return;
    if (!this.scene.cache.audio.exists('player-walking')) return;
    this._walkSfx?.stop();
    this._walkSfx?.destroy();
    this._walkSfx = sound.add('player-walking');
    this._walkSfx.play({ loop: true, volume: 0.2 });
  }

  _stopWalkSfx() {
    if (!this._walkSfx) return;
    this._walkSfx.stop();
    this._walkSfx.destroy();
    this._walkSfx = null;
  }

  _playChargeSfx() {
    const sound = this.scene?.sound;
    if (!sound) return;
    if (!this.scene.cache.audio.exists('bow-aiming')) return;
    this._chargeSfx?.stop();
    this._chargeSfx?.destroy();
    this._chargeSfx = sound.add('bow-aiming');
    this._chargeSfx.play({ volume: 0.2 });
  }

  _stopChargeSfx() {
    if (!this._chargeSfx) return;
    this._chargeSfx.stop();
    this._chargeSfx.destroy();
    this._chargeSfx = null;
  }

  destroy() {
    if (this._postUpdateBound) {
      this.scene.events.off('postupdate', this._postUpdateBound);
      this._postUpdateBound = null;
    }
    this._stopChargeSfx();
    this._stopWalkSfx();
    if (this._chatBubbleTimer) {
      clearTimeout(this._chatBubbleTimer);
      this._chatBubbleTimer = null;
    }
    this.chatBubble?.destroy();
    this.spawnShield?.destroy();
    this.bow.destroy();
    this.sprite.destroy();
    this.nameText?.destroy();
    this.bodyGfx?.destroy();
    this.legsGfx?.destroy();
    this.damageGfx?.destroy();
    this.faceGfx?.destroy();
  }
}
