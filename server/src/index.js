import http from 'http';
import { Server, matchMaker } from 'colyseus';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { ROOM_NAME } from '@boxfury/shared';
import { SERVER_CONFIG } from './config/index.js';
import { GameRoom } from './rooms/GameRoom.js';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Accept',
};

const httpServer = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS_HEADERS);
    res.end();
    return;
  }

  const match = req.url && req.url.match(/^\/rooms\/([^?/]+)/);
  if (req.method === 'GET' && match) {
    try {
      const rooms = await matchMaker.query({ name: match[1] });
      const payload = rooms.map((r) => ({
        roomId: r.roomId,
        clients: r.clients,
        maxClients: r.maxClients === Infinity ? null : r.maxClients,
        metadata: r.metadata ?? null,
      }));
      res.writeHead(200, { 'Content-Type': 'application/json', ...CORS_HEADERS });
      res.end(JSON.stringify(payload));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json', ...CORS_HEADERS });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  res.writeHead(404, CORS_HEADERS);
  res.end();
});

const gameServer = new Server({
  transport: new WebSocketTransport({ server: httpServer }),
});

gameServer.define(ROOM_NAME, GameRoom);

gameServer.listen(SERVER_CONFIG.PORT);
console.log(`[boxfury] colyseus listening on :${SERVER_CONFIG.PORT}`);
