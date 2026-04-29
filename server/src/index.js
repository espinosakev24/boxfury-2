import { Server } from 'colyseus';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { ROOM_NAME } from '@boxfury/shared';
import { SERVER_CONFIG } from './config/index.js';
import { GameRoom } from './rooms/GameRoom.js';

const gameServer = new Server({
  transport: new WebSocketTransport(),
});

gameServer.define(ROOM_NAME, GameRoom);

gameServer.listen(SERVER_CONFIG.PORT);
console.log(`[boxfury] colyseus listening on :${SERVER_CONFIG.PORT}`);
