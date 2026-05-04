import { ARROW, BOW, DEFAULT_SKIN, HIT, PLAYER } from '@boxfury/shared';
import { Bow } from './Bow.js';
import { computeWalkBob, drawBody, drawLegs } from './body.js';
import { damageStageFromHp, drawCracks, hashSeed } from './cracks.js';
import { drawFace } from './faces.js';

export class Player {
  constructor(scene, { id, x, y, color = 0x4ade80, name = '', skin = DEFAULT_SKIN }) {
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
    this.bodyGfx = scene.add.graphics();
    this.legsGfx = scene.add.graphics();
    this.legPhase = 0;
    this._isMoving = false;
    this._isGrounded = true;
    drawBody(this.bodyGfx, color);
    drawLegs(this.legsGfx, color, 0, { isMoving: false, isGrounded: true });
    this.damageStage = 0;
    this.damageSeed = hashSeed(String(id));
    this.damageGfx = scene.add.graphics();
    this.faceGfx = scene.add.graphics();
    drawFace(this.faceGfx, this.skin, PLAYER.WIDTH, PLAYER.HEIGHT);
    this._postUpdateBound = () => {
      this.syncBodyOverlay();
      this.syncLegsOverlay();
      this.syncDamageOverlay();
      this.syncFaceOverlay();
    };
    scene.events.on('postupdate', this._postUpdateBound);
    this.bow = new Bow(scene, this);
    this.nameText = scene.add.text(x, y - PLAYER.HEIGHT / 2 - 6, name, {
      fontFamily: 'JetBrains Mono, monospace',
      fontSize: '11px',
      fontStyle: 'bold',
      color: '#' + color.toString(16).padStart(6, '0'),
      stroke: '#15151f',
      strokeThickness: 3,
    }).setOrigin(0.5, 1);
  }

  move({ left, right, lockFacing = false }) {
    if (performance.now() < this.inputLockedUntil) return;
    const vx = (right ? 1 : 0) - (left ? 1 : 0);
    const speed = this.carryingFlag ? PLAYER.CARRY_SPEED : PLAYER.SPEED;
    this.sprite.body.setVelocityX(vx * speed);
    if (vx !== 0 && !lockFacing) this.facing = vx;
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
    this.bow.sprite.setVisible(!this.carryingFlag);
    if (this.nameText) this.nameText.setVisible(true);
    drawBody(this.bodyGfx, this.color);
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
    gfx.setPosition(
      this.sprite.x - offsetY * sin * sy,
      this.sprite.y + offsetY * cos * sy + bob,
    );
    gfx.setRotation(this.sprite.rotation);
    gfx.setScale(this.sprite.scaleX, this.sprite.scaleY);
    gfx.setVisible(this.sprite.visible && this.damageStage > 0);
  }

  syncBodyOverlay() {
    const gfx = this.bodyGfx;
    if (!gfx) return;
    const bob = this._bobY ?? 0;
    gfx.setPosition(this.sprite.x, this.sprite.y + bob);
    gfx.setRotation(this.sprite.rotation);
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
    gfx.setPosition(this.sprite.x, this.sprite.y + bob);
    gfx.setRotation(this.sprite.rotation);
    gfx.setScale(this.sprite.scaleX * (this.facing < 0 ? -1 : 1), this.sprite.scaleY);
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
    this.scene.tweens.add({
      targets: sprite,
      scaleX: 1.25,
      scaleY: 0.8,
      duration: 90,
      yoyo: true,
      ease: 'Cubic.easeOut',
    });
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
    if (this.sprite.body.blocked.down || this.sprite.body.touching.down) {
      this.sprite.body.setVelocityY(-PLAYER.JUMP_SPEED);
    }
  }

  chargeBow() {
    if (this.carryingFlag) return;
    this.charging = true;
  }

  releaseBow() {
    if (this.carryingFlag || !this.charging) return null;
    this.charging = false;
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
    return shot;
  }

  update(dt) {
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
    const moving = Math.abs(vx) > 5 && grounded;
    if (moving) this.legPhase += Math.abs(vx) * dt * 0.1;
    else this.legPhase = 0;
    this._isMoving = moving;
    this._isGrounded = grounded;
    this._vyNorm = Math.max(-1, Math.min(1, vy / 400));
    this._bobY = (moving && grounded) ? computeWalkBob(this.legPhase) : 0;
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
  }
}
