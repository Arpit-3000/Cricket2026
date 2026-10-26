import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { ClientToServerEvents, ServerToClientEvents } from '@cricket2026/shared';
import { config } from './config/index.js';
import { RoomManager } from './services/RoomManager.js';
import { registerSocketHandlers } from './socket/registerHandlers.js';

const corsOriginOption = config.allowedOrigins === '*' ? true : config.allowedOrigins;

const app = express();
app.use(cors({ origin: corsOriginOption, credentials: true }));
app.use(express.json());

const server = http.createServer(app);

const io = new Server<ClientToServerEvents, ServerToClientEvents>(server, {
  cors: {
    origin: corsOriginOption,
    methods: ['GET', 'POST'],
    credentials: true
  },
  pingTimeout: 10000,
  pingInterval: 5000
});

const roomManager = new RoomManager();
registerSocketHandlers(io, roomManager);

// Start inactive room sweep schedule (runs every 60s)
// Production Health Check Route with Operational Metrics
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    game: 'Cricket 2026 Server',
    version: '1.0.0',
    activeRooms: roomManager.getActiveRoomCount(),
    activeSockets: io.sockets?.sockets ? io.sockets.sockets.size : 0,
    uptimeSeconds: Math.floor(process.uptime()),
    memory: process.memoryUsage(),
    timestamp: new Date().toISOString()
  });
});

const isTestEnv = process.env.NODE_ENV === 'test' || process.argv.some(arg => arg.includes('test'));

if (!isTestEnv) {
  // Start inactive room sweep schedule (runs every 60s)
  roomManager.startCleanupSchedule();

  server.listen(config.port, () => {
    console.log(`[Cricket 2026 Server] Running authoritative game server on port ${config.port}`);
    console.log(`[Cricket 2026 Server] CORS allowed origins:`, config.allowedOrigins);
  });
}

const shutdown = (signal: string) => {
  console.log(`[Cricket 2026 Server] Received ${signal}, shutting down gracefully...`);
  roomManager.stopCleanupSchedule();
  io.close(() => {
    server.close(() => {
      console.log('[Cricket 2026 Server] HTTP & WebSocket servers closed.');
      process.exit(0);
    });
  });
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

export { app, server, io, roomManager };
