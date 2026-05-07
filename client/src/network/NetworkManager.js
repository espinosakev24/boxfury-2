import { Client, getStateCallbacks } from 'colyseus.js';
import { MESSAGES, NETWORK, ROOM_NAME } from '@boxfury/shared';
import { CLIENT_CONFIG } from '../config/index.js';

const RECONNECT_TIMEOUT_MS = 15000;
const RECONNECT_RETRY_MS = 1500;

export class NetworkManager {
  constructor() {
    this.client = null;
    this.room = null;
    this.$ = null;
    this.sessionId = null;
    this.sendIntervalMs = 1000 / NETWORK.SEND_RATE;
    this._lastSentAt = 0;
    this._reconnectionToken = null;
    this._userInitiated = false;
    this._statusCb = null;
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
    this._afterRoomReady();
    console.log('[net] connected', this.sessionId, 'room', this.room.roomId);
    return this.room;
  }

  _afterRoomReady() {
    this.sessionId = this.room.sessionId;
    this.$ = getStateCallbacks(this.room);
    this._reconnectionToken = this.room.reconnectionToken;
    this.room.onLeave((code) => {
      console.log('[net] disconnected', code);
      if (this._userInitiated) return;
      this._handleDisconnect();
    });
  }

  async _handleDisconnect() {
    this._statusCb?.('disconnected');
    const newRoom = await this._tryReconnect();
    if (newRoom) {
      this.room = newRoom;
      this._afterRoomReady();
      this._statusCb?.('reconnected', newRoom);
    } else {
      this._statusCb?.('failed');
    }
  }

  async _tryReconnect() {
    if (!this._reconnectionToken || !this.client) return null;
    const start = Date.now();
    while (Date.now() - start < RECONNECT_TIMEOUT_MS) {
      if (this._userInitiated) return null;
      try {
        const room = await this.client.reconnect(this._reconnectionToken);
        console.log('[net] reconnected to', room.roomId);
        return room;
      } catch (e) {
        console.warn('[net] reconnect attempt failed:', e?.message ?? e);
        await new Promise((r) => setTimeout(r, RECONNECT_RETRY_MS));
      }
    }
    return null;
  }

  onStatusChange(cb) {
    this._statusCb = cb;
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

  sendFlagToggle() {
    this.room?.send(MESSAGES.FLAG_TOGGLE);
  }

  sendChooseTeam(team) {
    this.room?.send(MESSAGES.CHOOSE_TEAM, { team });
  }

  sendChangeMap(mapId) {
    this.room?.send(MESSAGES.CHANGE_MAP, { mapId });
  }

  sendChat(text) {
    this.room?.send(MESSAGES.CHAT, { text });
  }

  onHit(cb) {
    this.room?.onMessage(MESSAGES.HIT, cb);
  }

  onMatchEnd(cb) {
    this.room?.onMessage(MESSAGES.MATCH_END, cb);
  }

  onMapChanged(cb) {
    this.room?.onMessage(MESSAGES.MAP_CHANGED, cb);
  }

  onLog(cb) {
    this.room?.onMessage(MESSAGES.LOG, cb);
  }

  onChat(cb) {
    this.room?.onMessage(MESSAGES.CHAT, cb);
  }

  async disconnect() {
    this._userInitiated = true;
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
