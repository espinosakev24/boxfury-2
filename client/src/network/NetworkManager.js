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

  sendState(state, now = performance.now()) {
    if (!this.room) return;
    if (now - this._lastSentAt < this.sendIntervalMs) return;
    this._lastSentAt = now;
    this.room.send(MESSAGES.STATE, state);
  }

  sendShoot(payload) {
    this.room?.send(MESSAGES.SHOOT, payload);
  }

  onShoot(cb) {
    this.room?.onMessage(MESSAGES.SHOOT, cb);
  }

  async disconnect() {
    if (!this.room) return;
    const room = this.room;
    this.room = null;
    this.client = null;
    try {
      await room.leave();
    } catch {
      // ignore — connection may already be closed
    }
  }
}
