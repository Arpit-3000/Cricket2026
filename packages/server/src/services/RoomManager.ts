import {
  RoomState,
  RoomSettings,
  RoomParticipant,
  TeamId,
  CRICKET_RULES,
  SERVER_CONFIG
} from '@cricket2026/shared';
import { GameSession } from '../game/GameSession.js';

export interface RoomEntry {
  state: RoomState;
  session: GameSession;
  disconnectTimers: Map<string, NodeJS.Timeout>;
}

export class RoomManager {
  private rooms: Map<string, RoomEntry> = new Map();
  private socketToRoom: Map<string, string> = new Map(); // socketId -> roomCode
  private reconnectTokenMap: Map<string, { roomCode: string; userId: string; socketId: string }> = new Map();

  public generateRoomCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    do {
      code = '';
      for (let i = 0; i < SERVER_CONFIG.ROOM_CODE_LENGTH; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }
    } while (this.rooms.has(code));
    return code;
  }

  public createRoom(
    hostSocketId: string,
    hostName: string,
    customSettings?: Partial<RoomSettings>
  ): { roomCode: string; state: RoomState } {
    const roomCode = this.generateRoomCode();
    const roomId = `room_${roomCode}_${Date.now()}`;
    const reconnectToken = `rec_${Math.random().toString(36).substring(2)}_${Date.now()}`;

    const defaultSettings: RoomSettings = {
      maxOversPerInnings: CRICKET_RULES.DEFAULT_OVERS_PER_INNINGS,
      pitchCondition: 'HARD_TURF',
      atmosphere: 'FLOODLIGHT_NIGHT',
      umpireMode: 'AI_AUTOMATION',
      aiDifficulty: 'STANDARD',
      isPrivate: true,
      allowSpectators: true,
      deliveryTimeLimitSec: CRICKET_RULES.DELIVERY_COUNTDOWN_SECONDS,
      ...customSettings
    };

    const hostParticipant: RoomParticipant = {
      socketId: hostSocketId,
      userId: `user_${hostSocketId.substring(0, 8)}`,
      displayName: hostName || 'Host',
      avatarSeed: hostSocketId,
      isHost: true,
      isReady: true,
      assignedRole: 'PLAYER',
      assignedTeamId: 'TEAM_A',
      assignedPlayerId: 'TEAM_A_player_1',
      reconnectToken,
      connectedAt: Date.now(),
      lastPingMs: 0,
      isDisconnected: false
    };

    const roomState: RoomState = {
      roomId,
      roomCode,
      hostSocketId,
      status: 'LOBBY',
      settings: defaultSettings,
      participants: {
        [hostSocketId]: hostParticipant
      },
      spectatorCount: 0,
      createdAt: Date.now(),
      lastActivityAt: Date.now()
    };

    const session = new GameSession(roomId, roomCode, {
      onStateBroadcast: () => {},
      onTickBroadcast: () => {},
      onDeliveryCompleted: () => {}
    });

    // Mark host player slot as human-controlled in the session
    const teamA = session.getGameState().teams.TEAM_A;
    if (teamA.players[0]) {
      teamA.players[0].isAi = false;
      teamA.players[0].assignedHumanId = hostSocketId;
      teamA.players[0].displayName = hostName;
    }

    this.rooms.set(roomCode, {
      state: roomState,
      session,
      disconnectTimers: new Map()
    });

    this.socketToRoom.set(hostSocketId, roomCode);
    this.reconnectTokenMap.set(reconnectToken, {
      roomCode,
      userId: hostParticipant.userId,
      socketId: hostSocketId
    });

    return { roomCode, state: roomState };
  }

  public joinRoom(
    roomCode: string,
    socketId: string,
    displayName: string,
    reconnectToken?: string
  ): { success: boolean; state?: RoomState; error?: string } {
    const entry = this.rooms.get(roomCode.toUpperCase());
    if (!entry) {
      return { success: false, error: 'Room not found. Check code.' };
    }

    // Check reconnection
    if (reconnectToken && this.reconnectTokenMap.has(reconnectToken)) {
      const rec = this.reconnectTokenMap.get(reconnectToken)!;
      if (rec.roomCode === roomCode.toUpperCase()) {
        const oldSocketId = rec.socketId;
        const participant = entry.state.participants[oldSocketId];
        if (participant) {
          // Clear disconnect timer
          const timer = entry.disconnectTimers.get(oldSocketId);
          if (timer) {
            clearTimeout(timer);
            entry.disconnectTimers.delete(oldSocketId);
          }

          delete entry.state.participants[oldSocketId];
          participant.socketId = socketId;
          participant.isDisconnected = false;
          participant.disconnectGraceExpiresAt = undefined;
          entry.state.participants[socketId] = participant;

          this.socketToRoom.delete(oldSocketId);
          this.socketToRoom.set(socketId, roomCode);
          rec.socketId = socketId;

          return { success: true, state: entry.state };
        }
      }
    }

    const newReconnectToken = `rec_${Math.random().toString(36).substring(2)}_${Date.now()}`;
    const participantCount = Object.keys(entry.state.participants).length;

    // Assign to Team A or Team B or Spectator if full
    let assignedTeam: TeamId | null = participantCount % 2 === 0 ? 'TEAM_A' : 'TEAM_B';
    let assignedRole: RoomParticipant['assignedRole'] = 'PLAYER';

    if (participantCount >= CRICKET_RULES.TOTAL_FIELD_POSITIONS) {
      if (!entry.state.settings.allowSpectators) {
        return { success: false, error: 'Room is full and spectators are disabled.' };
      }
      assignedTeam = null;
      assignedRole = 'SPECTATOR';
      entry.state.spectatorCount++;
    }

    const participant: RoomParticipant = {
      socketId,
      userId: `user_${socketId.substring(0, 8)}`,
      displayName: displayName || `Player ${participantCount + 1}`,
      avatarSeed: socketId,
      isHost: false,
      isReady: false,
      assignedRole,
      assignedTeamId: assignedTeam,
      assignedPlayerId: assignedTeam ? `${assignedTeam}_player_${Math.min(11, Math.floor(participantCount / 2) + 1)}` : null,
      reconnectToken: newReconnectToken,
      connectedAt: Date.now(),
      lastPingMs: 0,
      isDisconnected: false
    };

    entry.state.participants[socketId] = participant;
    entry.state.lastActivityAt = Date.now();
    this.socketToRoom.set(socketId, roomCode);
    this.reconnectTokenMap.set(newReconnectToken, {
      roomCode,
      userId: participant.userId,
      socketId
    });

    return { success: true, state: entry.state };
  }

  public handleDisconnect(socketId: string): { roomCode?: string; left: boolean } {
    const roomCode = this.socketToRoom.get(socketId);
    if (!roomCode) return { left: false };

    const entry = this.rooms.get(roomCode);
    if (!entry) return { left: false };

    const participant = entry.state.participants[socketId];
    if (participant) {
      participant.isDisconnected = true;
      participant.disconnectGraceExpiresAt = Date.now() + SERVER_CONFIG.RECONNECTION_GRACE_MS;

      // Start grace countdown timer
      const timer = setTimeout(() => {
        this.purgeParticipant(roomCode, socketId);
      }, SERVER_CONFIG.RECONNECTION_GRACE_MS);

      entry.disconnectTimers.set(socketId, timer);
    }

    return { roomCode, left: true };
  }

  private purgeParticipant(roomCode: string, socketId: string): void {
    const entry = this.rooms.get(roomCode);
    if (!entry) return;

    delete entry.state.participants[socketId];
    this.socketToRoom.delete(socketId);

    // Host migration if host left
    if (entry.state.hostSocketId === socketId) {
      const remainingSockets = Object.keys(entry.state.participants);
      if (remainingSockets.length > 0) {
        entry.state.hostSocketId = remainingSockets[0];
        entry.state.participants[remainingSockets[0]].isHost = true;
      } else {
        // Room empty -> clean up
        entry.session.destroy();
        this.rooms.delete(roomCode);
      }
    }
  }

  public getRoomEntry(roomCode: string): RoomEntry | undefined {
    return this.rooms.get(roomCode.toUpperCase());
  }

  public getRoomBySocket(socketId: string): RoomEntry | undefined {
    const code = this.socketToRoom.get(socketId);
    return code ? this.rooms.get(code) : undefined;
  }
}
