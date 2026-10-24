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
  roomManager.setIO(io);

  io.on('connection', (socket: Socket<ClientToServerEvents, ServerToClientEvents>) => {
    // Per-socket event rate limiter (prevent flooding/DoS)
    const socketEventTracker = { count: 0, windowStart: Date.now() };
    socket.use((_packet, next) => {
      const now = Date.now();
      if (now - socketEventTracker.windowStart > 1000) {
        socketEventTracker.windowStart = now;
        socketEventTracker.count = 1;
      } else {
        socketEventTracker.count++;
        if (socketEventTracker.count > 60) {
          socket.emit('error:notification', {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many requests. Please slow down.'
          });
          return next(new Error('Rate limit exceeded (60 events/sec)'));
        }
      }
      next();
    });

    // 1. Create Room
    socket.on('room:create', (payload, callback) => {
      try {
        if (payload.settings) {
          const check = validateRoomSettings(payload.settings);
          if (!check.valid) {
            return callback({ success: false, error: check.error });
          }
        }
        const { roomCode, state, reconnectToken } = roomManager.createRoom(
          socket.id,
          payload.hostName,
          payload.settings
        );
        socket.join(roomCode);
        callback({ success: true, roomCode, reconnectToken });
        io.to(roomCode).emit('room:state', state);
      } catch (err: any) {
        callback({ success: false, error: err?.message || 'Failed to create room' });
      }
    });

    // 2. Join Room
    socket.on('room:join', (payload, callback) => {
      try {
        if (!isValidRoomCode(payload.roomCode)) {
          return callback({
            success: false,
            error: 'Invalid 6-character room code format (e.g. CRK9A2)'
          });
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

        const upperCode = payload.roomCode.toUpperCase();
        socket.join(upperCode);
        callback({ success: true, roomState: res.state, reconnectToken: res.reconnectToken });
        io.to(upperCode).emit('room:state', res.state);

        if (res.reconnected) {
          io.to(upperCode).emit('room:notification', {
            id: `notif_${Date.now()}_rec`,
            type: 'RECONNECT',
            message: `${res.participant?.displayName || 'Player'} reconnected to the match!`,
            timestamp: Date.now()
          });
          io.to(upperCode).emit('room:participant_reconnected', {
            socketId: socket.id,
            participant: res.participant!
          });
        } else if (res.participant) {
          io.to(upperCode).emit('room:participant_joined', res.participant);
          io.to(upperCode).emit('room:notification', {
            id: `notif_${Date.now()}_join`,
            type: 'INFO',
            message: `${res.participant.displayName} entered the match lobby.`,
            timestamp: Date.now()
          });
        }
      } catch (err: any) {
        callback({ success: false, error: err?.message || 'Error joining room' });
      }
    });

    // 3. Leave Room
    socket.on('room:leave', () => {
      const res = roomManager.leaveRoom(socket.id);
      if (res.success && res.roomCode) {
        socket.leave(res.roomCode);
        if (!res.roomDestroyed && res.state) {
          io.to(res.roomCode).emit('room:state', res.state);
          io.to(res.roomCode).emit('room:participant_left', socket.id);
          io.to(res.roomCode).emit('room:notification', {
            id: `notif_${Date.now()}_left`,
            type: 'INFO',
            message: `${res.displayName || 'A player'} has left the room.`,
            timestamp: Date.now()
          });
          if (res.hostMigrated && res.newHostSocketId) {
            const newHost = res.state.participants[res.newHostSocketId];
            io.to(res.roomCode).emit('room:notification', {
              id: `notif_${Date.now()}_mig`,
              type: 'WARNING',
              message: `Host left. ${newHost?.displayName || 'Senior player'} is now the Room Host.`,
              timestamp: Date.now()
            });
          }
        }
      }
    });

    // 4. Claim Cricket Position Slot
    socket.on('room:claim_slot', payload => {
      if (
        !payload ||
        (payload.teamId !== 'TEAM_A' && payload.teamId !== 'TEAM_B') ||
        typeof payload.playerId !== 'string' ||
        !/^(TEAM_A|TEAM_B)_player_([1-9]|1[0-1])$/.test(payload.playerId)
      ) {
        socket.emit('error:notification', {
          code: 'INVALID_SLOT_PAYLOAD',
          message: 'Invalid team or player position identifier'
        });
        return;
      }

      const res = roomManager.claimSlot(socket.id, payload.teamId, payload.playerId);
      if (!res.success) {
        socket.emit('error:notification', {
          code: 'SLOT_OCCUPIED',
          message: res.error || 'Cannot claim this slot'
        });
        return;
      }
      const entry = roomManager.getRoomBySocket(socket.id);
      if (entry) {
        io.to(entry.state.roomCode).emit('room:state', entry.state);
      }
    });

    // 5. Release Cricket Position Slot
    socket.on('room:release_slot', () => {
      const res = roomManager.releaseSlot(socket.id);
      if (res.success && res.state) {
        io.to(res.state.roomCode).emit('room:state', res.state);
      }
    });

    // 6. Update Match Settings (Host Only)
    socket.on('room:update_settings', payload => {
      const res = roomManager.updateSettings(socket.id, payload);
      if (!res.success) {
        socket.emit('error:notification', {
          code: 'SETTINGS_UPDATE_FAILED',
          message: res.error || 'Failed to update room settings'
        });
        return;
      }
      if (res.state) {
        io.to(res.state.roomCode).emit('room:state', res.state);
        io.to(res.state.roomCode).emit('room:notification', {
          id: `notif_${Date.now()}_cfg`,
          type: 'INFO',
          message: 'Match settings updated by room owner.',
          timestamp: Date.now()
        });
      }
    });

    // 7. Ready Status Toggle
    socket.on('room:set_ready', payload => {
      const entry = roomManager.getRoomBySocket(socket.id);
      if (!entry) return;

      const participant = entry.state.participants[socket.id];
      if (participant) {
        participant.isReady = payload.ready;
        io.to(entry.state.roomCode).emit('room:state', entry.state);
      }
    });

    // 8. Lineup Customization (Captain, Wicketkeeper, Batting Order, Roles, Team details)
    socket.on('team:update_lineup', (payload, callback) => {
      const res = roomManager.updateTeamLineup(socket.id, payload);
      if (!res.success) {
        socket.emit('error:notification', {
          code: 'LINEUP_UPDATE_FAILED',
          message: res.error || 'Failed to update team lineup'
        });
        if (callback) callback({ success: false, error: res.error });
        return;
      }
      const entry = roomManager.getRoomBySocket(socket.id);
      if (entry && res.team) {
        io.to(entry.state.roomCode).emit('team:lineup_updated', {
          teamId: payload.teamId,
          team: res.team
        });
        io.to(entry.state.roomCode).emit('game:init_match', entry.session.getGameState());
        io.to(entry.state.roomCode).emit('room:notification', {
          id: `notif_${Date.now()}_lineup`,
          type: 'INFO',
          message: `${res.team.name} lineup updated.`,
          timestamp: Date.now()
        });
      }
      if (callback) callback({ success: true });
    });

    // 9. Assign Match Umpire (AI or Manual Human)
    socket.on('room:assign_umpire', (payload, callback) => {
      const res = roomManager.assignUmpire(socket.id, payload.umpireSocketId, payload.mode);
      if (!res.success) {
        socket.emit('error:notification', {
          code: 'UMPIRE_ASSIGN_FAILED',
          message: res.error || 'Failed to configure umpire'
        });
        if (callback) callback({ success: false, error: res.error });
        return;
      }
      const entry = roomManager.getRoomBySocket(socket.id);
      if (entry && res.state) {
        io.to(entry.state.roomCode).emit('room:state', res.state);
        const umpireParticipant = payload.umpireSocketId ? entry.state.participants[payload.umpireSocketId] : null;
        io.to(entry.state.roomCode).emit('umpire:assigned', {
          mode: payload.mode || 'MANUAL_HUMAN',
          umpireSocketId: payload.umpireSocketId,
          umpireName: umpireParticipant?.displayName
        });
        io.to(entry.state.roomCode).emit('room:notification', {
          id: `notif_${Date.now()}_ump`,
          type: 'INFO',
          message: payload.mode === 'MANUAL_HUMAN' && umpireParticipant
            ? `Manual Umpire assigned: ${umpireParticipant.displayName}`
            : 'Umpire mode set to Automated AI Umpire.',
          timestamp: Date.now()
        });
      }
      if (callback) callback({ success: true });
    });

    // 10. Start Toss / Match
    socket.on('room:start_match', () => {
      const res = roomManager.startToss(socket.id);
      if (!res.success) {
        socket.emit('error:notification', {
          code: 'TOSS_START_FAILED',
          message: res.error || 'Failed to start match / toss'
        });
        return;
      }
      const entry = roomManager.getRoomBySocket(socket.id);
      if (entry && res.state && res.toss) {
        io.to(entry.state.roomCode).emit('room:state', res.state);
        io.to(entry.state.roomCode).emit('toss:started', {
          callerTeamId: res.toss.callerTeamId,
          callerCaptainName: res.toss.callerCaptainName || 'Visiting Captain',
          opponentCaptainName: res.toss.opponentCaptainName || 'Home Captain'
        });
        io.to(entry.state.roomCode).emit('game:init_match', entry.session.getGameState());
        io.to(entry.state.roomCode).emit('room:notification', {
          id: `notif_${Date.now()}_toss`,
          type: 'INFO',
          message: `Match initiated! Captains are out for the coin toss. ${res.toss.callerCaptainName} calls the toss.`,
          timestamp: Date.now()
        });
      }
    });

    socket.on('toss:start', () => {
      const res = roomManager.startToss(socket.id);
      if (!res.success) {
        socket.emit('error:notification', {
          code: 'TOSS_START_FAILED',
          message: res.error || 'Failed to start toss'
        });
        return;
      }
      const entry = roomManager.getRoomBySocket(socket.id);
      if (entry && res.state && res.toss) {
        io.to(entry.state.roomCode).emit('room:state', res.state);
        io.to(entry.state.roomCode).emit('toss:started', {
          callerTeamId: res.toss.callerTeamId,
          callerCaptainName: res.toss.callerCaptainName || 'Visiting Captain',
          opponentCaptainName: res.toss.opponentCaptainName || 'Home Captain'
        });
        io.to(entry.state.roomCode).emit('game:init_match', entry.session.getGameState());
      }
    });

    // 11. Call Toss (Heads / Tails)
    socket.on('toss:call', payload => {
      if (!payload || (payload.choice !== 'HEADS' && payload.choice !== 'TAILS')) {
        socket.emit('error:notification', {
          code: 'INVALID_TOSS_CALL',
          message: 'Coin call must be either HEADS or TAILS'
        });
        return;
      }

      const res = roomManager.callToss(socket.id, payload.choice);
      if (!res.success) {
        socket.emit('error:notification', {
          code: 'TOSS_CALL_FAILED',
          message: res.error || 'Failed to call toss'
        });
        return;
      }
      const entry = roomManager.getRoomBySocket(socket.id);
      if (entry) {
        io.to(entry.state.roomCode).emit('toss:flipped', {
          coinResult: res.coinResult!,
          winnerTeamId: res.winnerTeamId!,
          winnerCaptainName: res.winnerCaptainName!,
          flipDurationMs: res.flipDurationMs!
        });
        io.to(entry.state.roomCode).emit('game:init_match', entry.session.getGameState());
        io.to(entry.state.roomCode).emit('room:notification', {
          id: `notif_${Date.now()}_flip`,
          type: 'INFO',
          message: `Coin landed on ${res.coinResult}! ${res.winnerCaptainName} (${res.winnerTeamId}) won the toss!`,
          timestamp: Date.now()
        });
      }
    });

    // 12. Decide Toss (Bat / Bowl)
    socket.on('toss:decision', payload => {
      if (!payload || (payload.decision !== 'BAT' && payload.decision !== 'BOWL')) {
        socket.emit('error:notification', {
          code: 'INVALID_TOSS_DECISION',
          message: 'Toss decision must be BAT or BOWL'
        });
        return;
      }

      const res = roomManager.decideToss(socket.id, payload.decision);
      if (!res.success) {
        socket.emit('error:notification', {
          code: 'TOSS_DECISION_FAILED',
          message: res.error || 'Failed to record toss decision'
        });
        return;
      }
      const entry = roomManager.getRoomBySocket(socket.id);
      if (entry && res.state && res.toss) {
        io.to(entry.state.roomCode).emit('room:state', res.state);
        io.to(entry.state.roomCode).emit('toss:completed', {
          winnerTeamId: res.toss.winnerTeamId!,
          decision: payload.decision,
          battingTeamId: res.battingTeamId!,
          bowlingTeamId: res.bowlingTeamId!
        });
        io.to(entry.state.roomCode).emit('game:init_match', entry.session.getGameState());
        io.to(entry.state.roomCode).emit('room:notification', {
          id: `notif_${Date.now()}_dec`,
          type: 'SUCCESS',
          message: `${res.toss.winnerTeamId} elected to ${payload.decision} first! Game on!`,
          timestamp: Date.now()
        });
      }
    });

    // 13. Manual Umpire Signal
    socket.on('umpire:manual_signal', payload => {
      const res = roomManager.submitManualUmpireSignal(socket.id, payload.signal, payload.reason);
      if (!res.success) {
        socket.emit('error:notification', {
          code: 'UMPIRE_SIGNAL_REJECTED',
          message: res.error || 'Invalid or unauthorized umpire decision'
        });
        return;
      }
    });

    // 9. Real-Time Player Movement & Synchronization
    socket.on('player:move_input', payload => {
      const res = roomManager.handleMovementInput(socket.id, payload);
      if (!res.success) {
        // Report unauthorized control attempts
        if (res.error?.startsWith('Unauthorized')) {
          socket.emit('error:notification', {
            code: 'UNAUTHORIZED_CONTROL',
            message: res.error
          });
        }
        return;
      }

      const entry = roomManager.getRoomBySocket(socket.id);
      if (entry && res.authoritativeState) {
        // Broadcast authoritative player movement to all participants in the room
        io.to(entry.state.roomCode).emit('player:sync', res.authoritativeState);
      }
    });

    // 10. Bowler Commit Delivery
    socket.on('game:bowler_commit_delivery', payload => {
      const validation = validateBowlingIntent(payload);
      if (!validation.valid) {
        socket.emit('error:notification', {
          code: 'INVALID_BOWLING_INPUT',
          message: validation.error || 'Invalid bowling intent'
        });
        return;
      }

      const res = roomManager.handleBowlerCommit(socket.id, payload);
      if (!res.success) {
        socket.emit('error:notification', {
          code: 'UNAUTHORIZED_BOWLING_INPUT',
          message: res.error || 'Unauthorized bowling delivery intention'
        });
        return;
      }

      const entry = roomManager.getRoomBySocket(socket.id);
      if (!entry) return;

      io.to(entry.state.roomCode).emit('game:bowler_runup', {
        bowlerId: payload.bowlerId,
        durationMs: 2500
      });
    });

    // 11. Batter Shot Input
    socket.on('game:batter_shot_input', payload => {
      const validation = validateBattingIntent(payload);
      if (!validation.valid) {
        socket.emit('error:notification', {
          code: 'INVALID_BATTING_INPUT',
          message: validation.error || 'Invalid batting intent'
        });
        return;
      }

      const res = roomManager.handleBatterShot(socket.id, payload);
      if (!res.success) {
        socket.emit('error:notification', {
          code: 'UNAUTHORIZED_BATTING_INPUT',
          message: res.error || 'Unauthorized batting shot intention'
        });
        return;
      }
    });

    // 12. Call Run / Running Between Wickets
    socket.on('game:call_run', payload => {
      if (!payload || (payload.runner !== 'STRIKER' && payload.runner !== 'NON_STRIKER')) {
        socket.emit('error:notification', {
          code: 'INVALID_RUNNER_DESIGNATION',
          message: 'Runner must be STRIKER or NON_STRIKER'
        });
        return;
      }

      const res = roomManager.callRun(socket.id, payload.runner);
      if (!res.success) {
        socket.emit('error:notification', {
          code: 'CALL_RUN_FAILED',
          message: res.error || 'Cannot take run'
        });
      }
    });

    // 13. Fielder Action (Pickup, Dive, Catch, Throw)
    socket.on('game:fielder_action', payload => {
      const res = roomManager.handleFielderAction(socket.id, payload);
      if (!res.success) {
        socket.emit('error:notification', {
          code: 'FIELDER_ACTION_FAILED',
          message: res.error || 'Fielding action rejected'
        });
      }
    });

    // 14. Adjust Field Position (Bowling Captain)
    socket.on('field:adjust_position', payload => {
      if (
        !payload ||
        typeof payload.fielderId !== 'string' ||
        !payload.position ||
        typeof payload.position.x !== 'number' ||
        typeof payload.position.y !== 'number' ||
        typeof payload.position.z !== 'number' ||
        isNaN(payload.position.x) ||
        isNaN(payload.position.y) ||
        isNaN(payload.position.z)
      ) {
        socket.emit('error:notification', {
          code: 'INVALID_FIELD_POSITION',
          message: 'Invalid fielder ID or numeric 3D position coordinates'
        });
        return;
      }

      const res = roomManager.handleAdjustFieldPosition(socket.id, payload.fielderId, payload.position);
      if (!res.success) {
        socket.emit('error:notification', {
          code: 'FIELD_ADJUST_FAILED',
          message: res.error || 'Field adjustment rejected'
        });
      }
    });

    // 15. Apply Field Preset (Attacking, Defensive, Balanced)
    socket.on('field:apply_preset', payload => {
      if (!payload || !['ATTACKING', 'DEFENSIVE', 'BALANCED'].includes(payload.preset)) {
        socket.emit('error:notification', {
          code: 'INVALID_FIELD_PRESET',
          message: 'Preset must be ATTACKING, DEFENSIVE, or BALANCED'
        });
        return;
      }

      const res = roomManager.handleApplyFieldPreset(socket.id, payload.preset);
      if (!res.success) {
        socket.emit('error:notification', {
          code: 'FIELD_PRESET_FAILED',
          message: res.error || 'Failed to apply field preset'
        });
      }
    });

    // 16. Umpire Appeal (HOWZAT / LBW / Catch)
    socket.on('umpire:appeal', payload => {
      const res = roomManager.handleAppeal(socket.id, payload?.appealType || 'HOWZAT');
      if (!res.success) {
        socket.emit('error:notification', {
          code: 'APPEAL_REJECTED',
          message: res.error || 'Umpire appeal rejected'
        });
      }
    });

    // 17. Rematch Request & Execution
    socket.on('room:rematch', callback => {
      const res = roomManager.handleRematch(socket.id);
      if (!res.success) {
        socket.emit('error:notification', {
          code: 'REMATCH_FAILED',
          message: res.error || 'Failed to restart rematch'
        });
        if (callback) callback({ success: false, error: res.error });
        return;
      }
      const entry = roomManager.getRoomBySocket(socket.id);
      if (entry) {
        io.to(entry.state.roomCode).emit('game:rematch_started', { gameState: entry.session.getGameState() });
        io.to(entry.state.roomCode).emit('game:init_match', entry.session.getGameState());
        io.to(entry.state.roomCode).emit('room:notification', {
          id: `notif_${Date.now()}_rematch`,
          type: 'SUCCESS',
          message: 'Rematch started! New 5-over contest underway!',
          timestamp: Date.now()
        });
      }
      if (callback) callback({ success: true });
    });

    // 18. Return to Lobby
    socket.on('room:return_to_lobby', callback => {
      const res = roomManager.handleReturnToLobby(socket.id);
      if (!res.success) {
        socket.emit('error:notification', {
          code: 'RETURN_LOBBY_FAILED',
          message: res.error || 'Failed to return to lobby'
        });
        if (callback) callback({ success: false, error: res.error });
        return;
      }
      const entry = roomManager.getRoomBySocket(socket.id);
      if (entry && res.state) {
        io.to(entry.state.roomCode).emit('game:returned_to_lobby', { roomState: res.state });
        io.to(entry.state.roomCode).emit('room:state', res.state);
        io.to(entry.state.roomCode).emit('room:notification', {
          id: `notif_${Date.now()}_lobby`,
          type: 'INFO',
          message: 'Returned to Match Lobby. Adjust Playing XI or toggle Ready to play again.',
          timestamp: Date.now()
        });
      }
      if (callback) callback({ success: true });
    });

    // 19. Start Super Over
    socket.on('game:start_super_over', callback => {
      const res = roomManager.handleStartSuperOver(socket.id);
      if (!res.success) {
        socket.emit('error:notification', {
          code: 'SUPER_OVER_FAILED',
          message: res.error || 'Failed to start Super Over'
        });
        if (callback) callback({ success: false, error: res.error });
        return;
      }
      const entry = roomManager.getRoomBySocket(socket.id);
      if (entry) {
        io.to(entry.state.roomCode).emit('game:super_over_started', { gameState: entry.session.getGameState() });
        io.to(entry.state.roomCode).emit('game:init_match', entry.session.getGameState());
        io.to(entry.state.roomCode).emit('room:notification', {
          id: `notif_${Date.now()}_super`,
          type: 'SUCCESS',
          message: '⚡ SUPER OVER INITIATED! 1 Over • Max 2 Wickets • High Voltage Finish!',
          timestamp: Date.now()
        });
      }
      if (callback) callback({ success: true });
    });

    // 12. Ping / Latency Sync
    socket.on('ping:sync', (payload, callback) => {
      if (!payload || typeof payload.clientTimestamp !== 'number') {
        if (typeof callback === 'function') callback(Date.now());
        return;
      }
      const now = Date.now();
      const rtt = now - payload.clientTimestamp;
      const entry = roomManager.getRoomBySocket(socket.id);
      if (entry && entry.state.participants[socket.id]) {
        entry.state.participants[socket.id].lastPingMs = Math.round(rtt / 2);
      }
      if (typeof callback === 'function') callback(now);
    });

    // 13. Disconnect Handling with 30s Grace Window & Notification
    socket.on('disconnect', () => {
      const res = roomManager.handleDisconnect(socket.id);
      if (res.left && res.roomCode) {
        const entry = roomManager.getRoomEntry(res.roomCode);
        if (entry) {
          io.to(res.roomCode).emit('room:state', entry.state);
          io.to(res.roomCode).emit('room:participant_disconnected', {
            socketId: socket.id,
            graceExpiresAt: res.graceExpiresAt!,
            displayName: res.displayName!
          });
          io.to(res.roomCode).emit('room:notification', {
            id: `notif_${Date.now()}_dc`,
            type: 'DISCONNECT',
            message: `${res.displayName || 'Player'} disconnected. 30s grace window active to reconnect...`,
            timestamp: Date.now()
          });
        }
      }
    });
  });
}

