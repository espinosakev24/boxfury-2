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

  async connect({ mode = 'auto', roomId = null, options = {} } = {}) {
    this.client = new Client(CLIENT_CONFIG.SERVER_URL);
    if (mode === 'create') {
      this.room = await this.client.create(ROOM_NAME, options);
    } else if (mode === 'join' && roomId) {
      this.room = await this.client.joinById(roomId, options);
    } else {
      this.room = await this.client.joinOrCreate(ROOM_NAME, options);
    }
    this.sessionId = this.room.sessionId;
    this.$ = getStateCallbacks(this.room);
    console.log('[net] connected', this.sessionId, 'room', this.room.roomId);

    this.room.onLeave(() => console.log('[net] disconnected'));
    return this.room;
  }

  static async listRooms() {
    const url = CLIENT_CONFIG.SERVER_URL.replace(/^ws/, 'http') + `/rooms/${ROOM_NAME}`;
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return Array.isArray(data) ? data : [];
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

  onHit(cb) {
    this.room?.onMessage(MESSAGES.HIT, cb);
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
