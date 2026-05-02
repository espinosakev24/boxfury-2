import { Client, getStateCallbacks } from 'colyseus.js';
import { MESSAGES, NETWORK, ROOM_NAME } from '@boxfury/shared';
import { CLIENT_CONFIG } from '../config/index.js';

export class NetworkManager {
  constructor() {
    this.client = null;
    this.room = null;
    this.$ = null;
    this.sessionId = null;
    this.sendIntervalMs = 1000 / NETWORK.SEND_RATE;
    this._lastSentAt = 0;
    this._lastInput = null;
  }

  async connect() {
    this.client = new Client(CLIENT_CONFIG.SERVER_URL);
    this.room = await this.client.joinOrCreate(ROOM_NAME);
    this.sessionId = this.room.sessionId;
    this.$ = getStateCallbacks(this.room);
    console.log('[net] connected', this.sessionId);
    this.room.onLeave(() => console.log('[net] disconnected'));
    return this.room;
  }

  sendInput(input, now = performance.now()) {
    if (!this.room) return;
    const changed = !this._lastInput
      || this._lastInput.left !== input.left
      || this._lastInput.right !== input.right
      || this._lastInput.jump !== input.jump
      || this._lastInput.down !== input.down
      || this._lastInput.charging !== input.charging;
    const dueByTime = now - this._lastSentAt >= this.sendIntervalMs;
    if (!changed && !dueByTime) return;
    this._lastSentAt = now;
    this._lastInput = { ...input };
    this.room.send(MESSAGES.INPUT, input);
  }

  async disconnect() {
    if (!this.room) return;
    const room = this.room;
    this.room = null;
    this.client = null;
    this.$ = null;
    try { await room.leave(); } catch {}
  }
}
