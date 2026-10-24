import { Server, Socket } from 'socket.io';
import {
  ClientToServerEvents,
  ServerToClientEvents,
  validateBowlingIntent,
  validateBattingIntent,
  isValidRoomCode,
  validateRoomSettings
} from '@cricket2026/shared';
import { RoomManager } from '../services/RoomManager.js';

export function registerSocketHandlers(
  io: Server<ClientToServerEvents, ServerToClientEvents>,
  roomManager: RoomManager
): void {
  io.on('connection', (socket: Socket<ClientToServerEvents, ServerToClientEvents>) => {
    // 1. Create Room
    socket.on('room:create', (payload, callback) => {
      try {
        if (payload.settings) {
          const check = validateRoomSettings(payload.settings);
          if (!check.valid) {
            return callback({ success: false, error: check.error });
          }
        }
        const { roomCode, state } = roomManager.createRoom(
          socket.id,
          payload.hostName,
          payload.settings
        );
        socket.join(roomCode);
        callback({ success: true, roomCode });
        io.to(roomCode).emit('room:state', state);
      } catch (err: any) {
        callback({ success: false, error: err?.message || 'Failed to create room' });
      }
    });

    // 2. Join Room
    socket.on('room:join', (payload, callback) => {
      try {
        if (!isValidRoomCode(payload.roomCode)) {
          return callback({ success: false, error: 'Invalid 6-character room code format' });
        }

        const res = roomManager.joinRoom(
          payload.roomCode,
          socket.id,
          payload.displayName,
          payload.reconnectToken
        );

        if (!res.success || !res.state) {
          return callback({ success: false, error: res.error || 'Failed to join room' });
        }

        socket.join(payload.roomCode.toUpperCase());
        callback({ success: true, roomState: res.state });
        io.to(payload.roomCode.toUpperCase()).emit('room:state', res.state);
      } catch (err: any) {
        callback({ success: false, error: err?.message || 'Error joining room' });
      }
    });

    // 3. Claim Cricket Position Slot
    socket.on('room:claim_slot', payload => {
      const entry = roomManager.getRoomBySocket(socket.id);
      if (!entry) return;

      const participant = entry.state.participants[socket.id];
      if (!participant) return;

      participant.assignedTeamId = payload.teamId;
      participant.assignedPlayerId = payload.playerId;

      // Update session roster
      const team = entry.session.getGameState().teams[payload.teamId];
      const player = team.players.find(p => p.id === payload.playerId);
      if (player) {
        player.isAi = false;
        player.assignedHumanId = socket.id;
        player.displayName = participant.displayName;
      }

      io.to(entry.state.roomCode).emit('room:state', entry.state);
    });

    // 4. Ready Status Toggle
    socket.on('room:set_ready', payload => {
      const entry = roomManager.getRoomBySocket(socket.id);
      if (!entry) return;

      const participant = entry.state.participants[socket.id];
      if (participant) {
        participant.isReady = payload.ready;
        io.to(entry.state.roomCode).emit('room:state', entry.state);
      }
    });

    // 5. Host Starts Match
    socket.on('room:start_match', () => {
      const entry = roomManager.getRoomBySocket(socket.id);
      if (!entry) return;

      if (entry.state.hostSocketId !== socket.id) {
        socket.emit('error:notification', {
          code: 'UNAUTHORIZED',
          message: 'Only the host can start the match.'
        });
        return;
      }

      entry.state.status = 'TOSS';
      entry.session.startToss();
      entry.session.beginMatch();

      io.to(entry.state.roomCode).emit('room:state', entry.state);
      io.to(entry.state.roomCode).emit('game:init_match', entry.session.getGameState());
    });

    // 6. Bowler Commit Delivery
    socket.on('game:bowler_commit_delivery', payload => {
      const validation = validateBowlingIntent(payload);
      if (!validation.valid) {
        socket.emit('error:notification', {
          code: 'INVALID_BOWLING_INPUT',
          message: validation.error || 'Invalid bowling intent'
        });
        return;
      }

      const entry = roomManager.getRoomBySocket(socket.id);
      if (!entry) return;

      entry.session.handleBowlerCommit(payload);
      io.to(entry.state.roomCode).emit('game:bowler_runup', {
        bowlerId: payload.bowlerId,
        durationMs: 2500
      });
    });

    // 7. Batter Shot Input
    socket.on('game:batter_shot_input', payload => {
      const validation = validateBattingIntent(payload);
      if (!validation.valid) {
        socket.emit('error:notification', {
          code: 'INVALID_BATTING_INPUT',
          message: validation.error || 'Invalid batting intent'
        });
        return;
      }

      const entry = roomManager.getRoomBySocket(socket.id);
      if (!entry) return;

      entry.session.handleBatterShot(payload);
    });

    // 8. Ping / Latency Sync
    socket.on('ping:sync', (payload, callback) => {
      const now = Date.now();
      const rtt = now - payload.clientTimestamp;
      const entry = roomManager.getRoomBySocket(socket.id);
      if (entry && entry.state.participants[socket.id]) {
        entry.state.participants[socket.id].lastPingMs = Math.round(rtt / 2);
      }
      callback(now);
    });

    // 9. Disconnect Handling with Reconnection Grace
    socket.on('disconnect', () => {
      const res = roomManager.handleDisconnect(socket.id);
      if (res.left && res.roomCode) {
        const entry = roomManager.getRoomEntry(res.roomCode);
        if (entry) {
          io.to(res.roomCode).emit('room:state', entry.state);
        }
      }
    });
  });
}
