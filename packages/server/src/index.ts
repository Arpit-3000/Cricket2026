import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { ClientToServerEvents, ServerToClientEvents } from '@cricket2026/shared';
import { config } from './config/index.js';
import { RoomManager } from './services/RoomManager.js';
import { registerSocketHandlers } from './socket/registerHandlers.js';

const app = express();
app.use(cors({ origin: config.corsOrigin }));
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    game: 'Cricket 2026 Server',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

const server = http.createServer(app);

const io = new Server<ClientToServerEvents, ServerToClientEvents>(server, {
  cors: {
    origin: config.corsOrigin,
    methods: ['GET', 'POST']
  },
  pingTimeout: 10000,
  pingInterval: 5000
});

const roomManager = new RoomManager();
registerSocketHandlers(io, roomManager);

server.listen(config.port, () => {
  console.log(`[Cricket 2026 Server] Running authoritative game server on port ${config.port}`);
  console.log(`[Cricket 2026 Server] CORS origin: ${config.corsOrigin}`);
});

export { app, server, io };
