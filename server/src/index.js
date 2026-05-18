import http from 'http';
import express from 'express';
import cors from 'cors';
import { Server, matchMaker } from 'colyseus';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { ROOM_NAME } from '@boxfury/shared';
import { SERVER_CONFIG, hasAuthConfig, hasDbConfig } from './config/index.js';
import { GameRoom } from './rooms/GameRoom.js';
import { connectMongo } from './db/mongo.js';
import { createApiRouter } from './http/api.js';

const app = express();
app.use(cors({ origin: true, credentials: true }));

app.use('/api', createApiRouter());

// Existing room-listing endpoint kept verbatim for the lobby UI.
app.get('/rooms/:name', async (req, res) => {
  try {
    const rooms = await matchMaker.query({ name: req.params.name });
    res.json(rooms.map((r) => ({
      roomId: r.roomId,
      clients: r.clients,
      maxClients: r.maxClients === Infinity ? null : r.maxClients,
      metadata: r.metadata ?? null,
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const httpServer = http.createServer(app);

const gameServer = new Server({
  transport: new WebSocketTransport({ server: httpServer }),
});
gameServer.define(ROOM_NAME, GameRoom);

if (hasDbConfig()) {
  connectMongo().catch(() => {
    console.warn('[boxfury] starting without DB — auth endpoints will return 503');
  });
}
if (!hasAuthConfig()) {
  console.warn('[boxfury] PRIVY_APP_ID / PRIVY_APP_SECRET not set — auth endpoints disabled');
}

gameServer.listen(SERVER_CONFIG.PORT);
console.log(`[boxfury] colyseus + http listening on :${SERVER_CONFIG.PORT}`);
