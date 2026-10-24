import {
  RoomState,
  RoomSettings,
  RoomParticipant,
  TeamId,
  CRICKET_RULES,
  SERVER_CONFIG,
  PlayerMovementInput,
  PlayerEntityState,
  CoinChoice,
  TossDecision,
  TossState,
  UmpireSignal,
  TeamPlayingXI,
  FieldingIntent,
  Vector3D,
  BowlingDeliveryIntent,
  BattingShotIntent,
  validatePlayerMovement,
  validateRoomSettings
} from '@cricket2026/shared';
import { GameSession } from '../game/GameSession.js';
import { config } from '../config/index.js';

export interface RoomEntry {
  state: RoomState;
  session: GameSession;
  disconnectTimers: Map<string, NodeJS.Timeout>;
  sequenceTracker: Map<string, number>; // playerId -> last processed sequence
  rateLimiter: Map<string, { lastTimestamp: number; windowStart: number; count: number }>; // socketId -> rate tracking
}

export class RoomManager {
  private rooms: Map<string, RoomEntry> = new Map();
  private socketToRoom: Map<string, string> = new Map(); // socketId -> roomCode
  private reconnectTokenMap: Map<string, { roomCode: string; userId: string; socketId: string }> = new Map();
  private io: any = null;
  private cleanupInterval: NodeJS.Timeout | null = null;

  public setIO(io: any): void {
    this.io = io;
  }

  public sanitizeName(name: string, fallback: string = 'Player'): string {
    if (!name || typeof name !== 'string') return fallback;
    const sanitized = name.replace(/<[^>]*>/g, '').replace(/[\x00-\x1F\x7F]/g, '').trim();
    if (!sanitized) return fallback;
    return sanitized.slice(0, 32);
  }

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
  ): { roomCode: string; state: RoomState; reconnectToken: string } {
    if (this.rooms.size >= config.maxRooms) {
      throw new Error(`Server room capacity reached (max ${config.maxRooms}). Please try again later.`);
    }

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
      minPlayersPerTeam: CRICKET_RULES.MIN_PLAYERS_PER_TEAM,
      ...customSettings
    };

    const cleanHostName = this.sanitizeName(hostName, 'Captain Host');

    const hostParticipant: RoomParticipant = {
      socketId: hostSocketId,
      userId: `user_${hostSocketId.substring(0, 8)}`,
      displayName: cleanHostName,
      avatarSeed: hostSocketId,
      isHost: true,
      isReady: true,
      assignedRole: 'PLAYER',
      assignedTeamId: 'TEAM_A',
      assignedPlayerId: 'TEAM_A_player_1',
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
      onStateBroadcast: (state) => {
        if (this.io) this.io.to(roomCode).emit('game:init_match', state);
      },
      onTickBroadcast: (sync) => {
        if (this.io) this.io.to(roomCode).emit('game:tick', sync);
      },
      onDeliveryCompleted: (record) => {
        if (this.io) this.io.to(roomCode).emit('game:delivery_completed', record);
      },
      onUmpireBroadcast: (event) => {
        if (this.io) this.io.to(roomCode).emit('umpire:signal_broadcast', event);
      },
      onUmpirePrompt: (prompt) => {
        if (this.io) this.io.to(roomCode).emit('umpire:prompt', prompt);
      },
      onUmpireTimeout: (timeout) => {
        if (this.io) this.io.to(roomCode).emit('umpire:timeout', timeout);
      },
      onScorecardSync: (scorecard) => {
        if (this.io) this.io.to(roomCode).emit('game:scorecard_sync', scorecard);
      },
      onOverEnded: (payload) => {
        if (this.io) this.io.to(roomCode).emit('game:over_ended', payload);
      },
      onInningsTransition: (payload) => {
        if (this.io) this.io.to(roomCode).emit('game:innings_transition', payload);
      },
      onInningsBreak: (payload) => {
        if (this.io) this.io.to(roomCode).emit('game:innings_break', payload);
      },
      onMatchFinished: (payload) => {
        if (this.io) this.io.to(roomCode).emit('game:match_finished', payload);
      },
      onSuperOverStarted: (payload) => {
        if (this.io) this.io.to(roomCode).emit('game:super_over_started', payload);
      },
      onRematchStarted: (payload) => {
        if (this.io) this.io.to(roomCode).emit('game:rematch_started', payload);
      },
      onBallReleased: (payload) => {
        if (this.io) this.io.to(roomCode).emit('game:ball_released', payload);
      },
      onBatContact: (payload) => {
        if (this.io) this.io.to(roomCode).emit('game:bat_contact', payload);
      },
      onBallPossession: (payload) => {
        if (this.io) this.io.to(roomCode).emit('game:ball_possession', payload);
      },
      onFielderThrow: (payload) => {
        if (this.io) this.io.to(roomCode).emit('game:fielder_throw', payload);
      },
      onFieldPositionUpdated: (payload) => {
        if (this.io) this.io.to(roomCode).emit('field:position_updated', payload);
      },
      onFieldPresetApplied: (payload) => {
        if (this.io) this.io.to(roomCode).emit('field:preset_applied', payload);
      }
    });

    // Mark host player slot as human-controlled in the session
    session.setPlayerHumanControl('TEAM_A_player_1', false, hostSocketId, hostParticipant.displayName);

    this.rooms.set(roomCode, {
      state: roomState,
      session,
      disconnectTimers: new Map(),
      sequenceTracker: new Map(),
      rateLimiter: new Map()
    });

    this.socketToRoom.set(hostSocketId, roomCode);
    this.reconnectTokenMap.set(reconnectToken, {
      roomCode,
      userId: hostParticipant.userId,
      socketId: hostSocketId
    });

    return { roomCode, state: roomState, reconnectToken };
  }

  public joinRoom(
    roomCode: string,
    socketId: string,
    displayName: string,
    reconnectToken?: string
  ): {
    success: boolean;
    state?: RoomState;
    reconnectToken?: string;
    error?: string;
    reconnected?: boolean;
    participant?: RoomParticipant;
  } {
    const upperCode = roomCode.trim().toUpperCase();
    const entry = this.rooms.get(upperCode);
    if (!entry) {
      return { success: false, error: `Room ${upperCode} does not exist. Please check the 6-character room code.` };
    }

    // 1. Reconnection handling
    if (reconnectToken && this.reconnectTokenMap.has(reconnectToken)) {
      const rec = this.reconnectTokenMap.get(reconnectToken)!;
      if (rec.roomCode === upperCode) {
        const oldSocketId = rec.socketId;
        const participant = entry.state.participants[oldSocketId];
        if (participant) {
          // Clear any active disconnect timer
          const timer = entry.disconnectTimers.get(oldSocketId);
          if (timer) {
            clearTimeout(timer);
            entry.disconnectTimers.delete(oldSocketId);
          }

          delete entry.state.participants[oldSocketId];
          participant.socketId = socketId;
          participant.isDisconnected = false;
          participant.disconnectGraceExpiresAt = undefined;
          participant.reconnectToken = undefined;
          entry.state.participants[socketId] = participant;

          // If was host, update hostSocketId
          if (entry.state.hostSocketId === oldSocketId) {
            entry.state.hostSocketId = socketId;
          }

          // Update human assignment in GameSession
          if (participant.assignedPlayerId) {
            entry.session.setPlayerHumanControl(
              participant.assignedPlayerId,
              false,
              socketId,
              participant.displayName
            );
          }

          // Restore manual umpire authorization if assigned
          if (participant.assignedRole === 'MANUAL_UMPIRE') {
            entry.session.setUmpireMode('MANUAL_HUMAN', socketId);
            entry.state.settings.umpireMode = 'MANUAL_HUMAN';
          }

          this.socketToRoom.delete(oldSocketId);
          this.socketToRoom.set(socketId, upperCode);
          rec.socketId = socketId;

          return {
            success: true,
            state: entry.state,
            reconnectToken,
            reconnected: true,
            participant
          };
        }
      }
    }

    // 2. Fresh join
    const newReconnectToken = `rec_${Math.random().toString(36).substring(2)}_${Date.now()}`;
    const participantCount = Object.keys(entry.state.participants).length;

    // Default auto-balance to Team B if Team A has more players
    const teamAPlayers = Object.values(entry.state.participants).filter(p => p.assignedTeamId === 'TEAM_A');
    const teamBPlayers = Object.values(entry.state.participants).filter(p => p.assignedTeamId === 'TEAM_B');

    let assignedTeam: TeamId | null = teamAPlayers.length <= teamBPlayers.length ? 'TEAM_A' : 'TEAM_B';
    let assignedRole: RoomParticipant['assignedRole'] = 'PLAYER';

    // Find first vacant slot on the assigned team
    const occupiedSlots = new Set(
      Object.values(entry.state.participants).map(p => p.assignedPlayerId).filter(Boolean)
    );
    let assignedPlayerId: string | null = null;
    for (let i = 1; i <= 11; i++) {
      const candidateId = `${assignedTeam}_player_${i}`;
      if (!occupiedSlots.has(candidateId)) {
        assignedPlayerId = candidateId;
        break;
      }
    }

    // If both teams full (22 players)
    if (participantCount >= CRICKET_RULES.TOTAL_FIELD_POSITIONS || !assignedPlayerId) {
      if (!entry.state.settings.allowSpectators) {
        return { success: false, error: 'Room is full and spectators are disabled for this match.' };
      }
      assignedTeam = null;
      assignedPlayerId = null;
      assignedRole = 'SPECTATOR';
      entry.state.spectatorCount++;
    }

    const cleanName = this.sanitizeName(displayName, `Player ${participantCount + 1}`);

    const participant: RoomParticipant = {
      socketId,
      userId: `user_${socketId.substring(0, 8)}`,
      displayName: cleanName,
      avatarSeed: socketId,
      isHost: false,
      isReady: false,
      assignedRole,
      assignedTeamId: assignedTeam,
      assignedPlayerId,
      connectedAt: Date.now(),
      lastPingMs: 0,
      isDisconnected: false
    };

    if (assignedPlayerId) {
      entry.session.setPlayerHumanControl(assignedPlayerId, false, socketId, cleanName);
    }

    entry.state.participants[socketId] = participant;
    entry.state.lastActivityAt = Date.now();
    this.socketToRoom.set(socketId, upperCode);
    this.reconnectTokenMap.set(newReconnectToken, {
      roomCode: upperCode,
      userId: participant.userId,
      socketId
    });

    return {
      success: true,
      state: entry.state,
      reconnectToken: newReconnectToken,
      reconnected: false,
      participant
    };
  }

  public claimSlot(
    socketId: string,
    teamId: TeamId,
    playerId: string
  ): { success: boolean; state?: RoomState; error?: string } {
    const entry = this.getRoomBySocket(socketId);
    if (!entry) return { success: false, error: 'Player not in any active room' };

    if (entry.state.status !== 'LOBBY') {
      return { success: false, error: 'Cannot claim slots once the match setup has started' };
    }

    const participant = entry.state.participants[socketId];
    if (!participant) return { success: false, error: 'Participant record not found' };

    // Prevent stealing an occupied human player slot
    const existingOccupant = Object.values(entry.state.participants).find(
      p => p.assignedPlayerId === playerId && p.socketId !== socketId && !p.isDisconnected
    );
    if (existingOccupant) {
      return { success: false, error: `Position ${playerId} is already claimed by ${existingOccupant.displayName}` };
    }

    // Release previously occupied slot back to AI
    if (participant.assignedPlayerId && participant.assignedPlayerId !== playerId) {
      entry.session.setPlayerHumanControl(participant.assignedPlayerId, true, null);
    }

    participant.assignedTeamId = teamId;
    participant.assignedPlayerId = playerId;
    participant.assignedRole = 'PLAYER';

    // Update GameSession human status
    entry.session.setPlayerHumanControl(playerId, false, socketId, participant.displayName);
    entry.state.lastActivityAt = Date.now();

    return { success: true, state: entry.state };
  }

  public releaseSlot(socketId: string): { success: boolean; state?: RoomState; error?: string } {
    const entry = this.getRoomBySocket(socketId);
    if (!entry) return { success: false, error: 'Player not in any active room' };

    if (entry.state.status !== 'LOBBY') {
      return { success: false, error: 'Cannot release slots once the match setup has started' };
    }

    const participant = entry.state.participants[socketId];
    if (!participant) return { success: false, error: 'Participant record not found' };

    if (participant.assignedPlayerId) {
      entry.session.setPlayerHumanControl(participant.assignedPlayerId, true, null);
      participant.assignedPlayerId = null;
      participant.assignedRole = 'SPECTATOR';
    }

    return { success: true, state: entry.state };
  }

  public setReady(
    socketId: string,
    isReady: boolean = true
  ): { success: boolean; state?: RoomState; error?: string } {
    const entry = this.getRoomBySocket(socketId);
    if (!entry) return { success: false, error: 'Room not found' };

    const participant = entry.state.participants[socketId];
    if (!participant) return { success: false, error: 'Participant not found' };

    participant.isReady = isReady;
    entry.state.lastActivityAt = Date.now();
    return { success: true, state: entry.state };
  }

  public getRoomState(roomCode: string): RoomState | undefined {
    return this.getRoomEntry(roomCode)?.state;
  }

  public updateSettings(
    socketId: string,
    customSettings: Partial<RoomSettings>
  ): { success: boolean; state?: RoomState; error?: string } {
    const entry = this.getRoomBySocket(socketId);
    if (!entry) return { success: false, error: 'Room not found' };

    if (entry.state.status !== 'LOBBY') {
      return { success: false, error: 'Cannot modify match settings once the match setup has started' };
    }

    if (entry.state.hostSocketId !== socketId) {
      return { success: false, error: 'Only the room owner can configure match settings' };
    }

    const validation = validateRoomSettings(customSettings);
    if (!validation.valid) {
      return { success: false, error: validation.error || 'Invalid settings' };
    }

    entry.state.settings = {
      ...entry.state.settings,
      ...customSettings
    };
    entry.state.lastActivityAt = Date.now();

    return { success: true, state: entry.state };
  }

  public updateTeamLineup(
    socketId: string,
    payload: {
      teamId: TeamId;
      captainId?: string;
      wicketKeeperId?: string;
      battingOrder?: string[];
      playerRoles?: Record<string, string>;
      name?: string;
      primaryColor?: string;
      secondaryColor?: string;
    }
  ): { success: boolean; team?: TeamPlayingXI; error?: string } {
    const entry = this.getRoomBySocket(socketId);
    if (!entry) return { success: false, error: 'Room not found' };

    if (entry.state.status !== 'LOBBY') {
      return { success: false, error: 'Cannot modify team lineup once the match setup has started' };
    }

    const participant = entry.state.participants[socketId];
    if (!participant) return { success: false, error: 'Participant not found' };

    // Host can configure either team; or a participant on that team can configure their own team
    if (!participant.isHost && participant.assignedTeamId !== payload.teamId) {
      return { success: false, error: `Unauthorized: You are not assigned to ${payload.teamId}` };
    }

    const result = entry.session.updateTeamLineup(payload);
    if (result.success) {
      entry.state.lastActivityAt = Date.now();
    }
    return result;
  }

  public assignUmpire(
    hostSocketId: string,
    targetSocketId: string | null,
    mode: 'AI_AUTOMATION' | 'MANUAL_HUMAN' = 'MANUAL_HUMAN'
  ): { success: boolean; state?: RoomState; error?: string } {
    const entry = this.getRoomBySocket(hostSocketId);
    if (!entry) return { success: false, error: 'Room not found' };

    if (entry.state.hostSocketId !== hostSocketId) {
      return { success: false, error: 'Only the room host can assign the match umpire' };
    }

    if (entry.state.status !== 'LOBBY') {
      return { success: false, error: 'Cannot modify umpire configuration once the match setup has started' };
    }

    if (mode === 'MANUAL_HUMAN') {
      if (!targetSocketId) {
        return { success: false, error: 'A valid participant must be selected for Manual Umpire mode' };
      }
      const participant = entry.state.participants[targetSocketId];
      if (!participant) {
        return { success: false, error: 'Selected participant not found in room' };
      }

      // Vacate player slot if assigned
      if (participant.assignedPlayerId) {
        entry.session.setPlayerHumanControl(participant.assignedPlayerId, true, null);
        participant.assignedPlayerId = null;
      }

      // Clear any previous manual umpire
      for (const p of Object.values(entry.state.participants)) {
        if (p.assignedRole === 'MANUAL_UMPIRE' && p.socketId !== targetSocketId) {
          p.assignedRole = 'SPECTATOR';
        }
      }

      participant.assignedRole = 'MANUAL_UMPIRE';
      entry.state.settings.umpireMode = 'MANUAL_HUMAN';
      entry.session.setUmpireMode('MANUAL_HUMAN', targetSocketId);
    } else {
      for (const p of Object.values(entry.state.participants)) {
        if (p.assignedRole === 'MANUAL_UMPIRE') {
          p.assignedRole = 'SPECTATOR';
        }
      }
      entry.state.settings.umpireMode = 'AI_AUTOMATION';
      entry.session.setUmpireMode('AI_AUTOMATION', null);
    }

    entry.state.lastActivityAt = Date.now();
    return { success: true, state: entry.state };
  }

  public startToss(socketId: string): { success: boolean; toss?: TossState; state?: RoomState; error?: string } {
    const entry = this.getRoomBySocket(socketId);
    if (!entry) return { success: false, error: 'Room not found' };

    if (entry.state.hostSocketId !== socketId) {
      return { success: false, error: 'Only the room host can start the toss' };
    }

    const check = this.canStartMatch(entry.state.roomCode);
    if (!check.canStart) {
      return { success: false, error: check.reason || 'Cannot start match' };
    }

    const result = entry.session.startToss();
    if (result.success) {
      entry.state.status = 'TOSS';
      entry.state.lastActivityAt = Date.now();
      return { success: true, toss: result.toss, state: entry.state };
    }
    return { success: false, error: result.error };
  }

  public callToss(socketId: string, choice: CoinChoice): {
    success: boolean;
    coinResult?: CoinChoice;
    winnerTeamId?: TeamId;
    winnerCaptainName?: string;
    flipDurationMs?: number;
    toss?: TossState;
    error?: string;
  } {
    const entry = this.getRoomBySocket(socketId);
    if (!entry) return { success: false, error: 'Room not found' };

    const participant = entry.state.participants[socketId];
    if (!participant) return { success: false, error: 'Participant not found' };

    const toss = entry.session.getGameState().toss;
    if (participant.assignedTeamId !== toss.callerTeamId) {
      return { success: false, error: `Only the ${toss.callerTeamId} captain can call the toss` };
    }

    const result = entry.session.callToss(choice);
    if (result.success) {
      entry.state.lastActivityAt = Date.now();
      return {
        success: true,
        coinResult: result.coinResult,
        winnerTeamId: result.winnerTeamId,
        winnerCaptainName: result.winnerCaptainName,
        flipDurationMs: result.flipDurationMs,
        toss: entry.session.getGameState().toss
      };
    }
    return { success: false, error: result.error };
  }

  public decideToss(socketId: string, decision: TossDecision): {
    success: boolean;
    battingTeamId?: TeamId;
    bowlingTeamId?: TeamId;
    toss?: TossState;
    state?: RoomState;
    error?: string;
  } {
    const entry = this.getRoomBySocket(socketId);
    if (!entry) return { success: false, error: 'Room not found' };

    const participant = entry.state.participants[socketId];
    if (!participant) return { success: false, error: 'Participant not found' };

    const toss = entry.session.getGameState().toss;
    if (!toss.winnerTeamId) {
      return { success: false, error: 'Toss has not been resolved yet' };
    }
    if (participant.assignedTeamId !== toss.winnerTeamId) {
      return { success: false, error: `Only the ${toss.winnerTeamId} captain can decide to bat or bowl` };
    }

    const result = entry.session.decideToss(decision);
    if (result.success) {
      entry.state.status = 'IN_PLAY';
      entry.state.lastActivityAt = Date.now();
      return {
        success: true,
        battingTeamId: result.battingTeamId,
        bowlingTeamId: result.bowlingTeamId,
        toss: result.toss,
        state: entry.state
      };
    }
    return { success: false, error: result.error };
  }

  public submitManualUmpireSignal(
    socketId: string,
    signal: UmpireSignal,
    reason: string,
    arbitraryScorePayload?: any
  ): { success: boolean; signal?: UmpireSignal; error?: string } {
    const entry = this.getRoomBySocket(socketId);
    if (!entry) return { success: false, error: 'Room not found' };

    return entry.session.handleManualUmpireSignal(socketId, signal, reason, arbitraryScorePayload);
  }

  public callRun(
    socketId: string,
    runner: 'STRIKER' | 'NON_STRIKER'
  ): { success: boolean; runs?: number; error?: string } {
    const entry = this.getRoomBySocket(socketId);
    if (!entry) return { success: false, error: 'Room not found' };

    const participant = entry.state.participants[socketId];
    if (participant && participant.assignedRole === 'SPECTATOR') {
      return { success: false, error: 'Unauthorized: Spectators cannot call runs' };
    }

    return entry.session.handleCallRun(socketId, runner);
  }

  public handleCallRun(
    socketId: string,
    runner: 'STRIKER' | 'NON_STRIKER'
  ): { success: boolean; runs?: number; error?: string } {
    return this.callRun(socketId, runner);
  }

  public canStartMatch(roomCode: string): { canStart: boolean; reason?: string } {
    const entry = this.rooms.get(roomCode.toUpperCase());
    if (!entry) return { canStart: false, reason: 'Room not found' };

    if (entry.state.status !== 'LOBBY') {
      return { canStart: false, reason: 'Match has already started' };
    }

    const participants = Object.values(entry.state.participants).filter(p => !p.isDisconnected);
    const minPlayers = entry.state.settings.minPlayersPerTeam ?? CRICKET_RULES.MIN_PLAYERS_PER_TEAM;

    const teamAHumans = participants.filter(p => p.assignedTeamId === 'TEAM_A' && p.assignedPlayerId);
    const teamBHumans = participants.filter(p => p.assignedTeamId === 'TEAM_B' && p.assignedPlayerId);

    if (teamAHumans.length < minPlayers) {
      return {
        canStart: false,
        reason: `Team A requires at least ${minPlayers} human player(s) (currently ${teamAHumans.length})`
      };
    }

    if (teamBHumans.length < minPlayers) {
      return {
        canStart: false,
        reason: `Team B requires at least ${minPlayers} human player(s) (currently ${teamBHumans.length})`
      };
    }

    // Check ready status for all assigned human players
    const unreadyPlayers = participants.filter(p => p.assignedPlayerId && !p.isReady);
    if (unreadyPlayers.length > 0) {
      const names = unreadyPlayers.map(p => p.displayName).join(', ');
      return {
        canStart: false,
        reason: `Waiting for ${names} to click Ready`
      };
    }

    return { canStart: true };
  }

  public leaveRoom(socketId: string): {
    success: boolean;
    roomCode?: string;
    state?: RoomState;
    hostMigrated?: boolean;
    newHostSocketId?: string;
    roomDestroyed?: boolean;
    displayName?: string;
  } {
    const roomCode = this.socketToRoom.get(socketId);
    if (!roomCode) return { success: false };

    const entry = this.rooms.get(roomCode);
    if (!entry) {
      this.socketToRoom.delete(socketId);
      return { success: false };
    }

    // Clear disconnect timer if any
    const timer = entry.disconnectTimers.get(socketId);
    if (timer) {
      clearTimeout(timer);
      entry.disconnectTimers.delete(socketId);
    }

    const participant = entry.state.participants[socketId];
    const displayName = participant?.displayName || 'Player';

    // If player had a slot, revert to AI control in session
    if (participant?.assignedPlayerId) {
      entry.session.setPlayerHumanControl(participant.assignedPlayerId, true, null);
    }

    delete entry.state.participants[socketId];
    this.socketToRoom.delete(socketId);

    // Host migration or room cleanup
    let hostMigrated = false;
    let newHostSocketId: string | undefined;
    let roomDestroyed = false;

    const remainingSocketIds = Object.keys(entry.state.participants);

    if (remainingSocketIds.length === 0) {
      // Clean up room when empty
      entry.session.destroy();
      this.rooms.delete(roomCode);
      roomDestroyed = true;
    } else if (entry.state.hostSocketId === socketId) {
      // Host migration to first remaining active player
      newHostSocketId = remainingSocketIds[0];
      entry.state.hostSocketId = newHostSocketId;
      entry.state.participants[newHostSocketId].isHost = true;
      hostMigrated = true;
    }

    return {
      success: true,
      roomCode,
      state: roomDestroyed ? undefined : entry.state,
      hostMigrated,
      newHostSocketId,
      roomDestroyed,
      displayName
    };
  }

  public handleDisconnect(socketId: string): {
    roomCode?: string;
    left: boolean;
    displayName?: string;
    graceExpiresAt?: number;
  } {
    const roomCode = this.socketToRoom.get(socketId);
    if (!roomCode) return { left: false };

    const entry = this.rooms.get(roomCode);
    if (!entry) return { left: false };

    const participant = entry.state.participants[socketId];
    if (!participant) return { left: false };

    participant.isDisconnected = true;
    const graceExpiresAt = Date.now() + SERVER_CONFIG.RECONNECTION_GRACE_MS;
    participant.disconnectGraceExpiresAt = graceExpiresAt;

    // Trigger safe AI fallback if the disconnecting client was the manual umpire
    entry.session.handleManualUmpireDisconnect(socketId);
    if (participant.assignedRole === 'MANUAL_UMPIRE') {
      entry.state.settings.umpireMode = 'AI_AUTOMATION';
    }

    // Start 30s grace countdown timer
    const timer = setTimeout(() => {
      this.purgeDisconnectedParticipant(roomCode, socketId);
    }, SERVER_CONFIG.RECONNECTION_GRACE_MS);

    entry.disconnectTimers.set(socketId, timer);

    return {
      roomCode,
      left: true,
      displayName: participant.displayName,
      graceExpiresAt
    };
  }

  private purgeDisconnectedParticipant(roomCode: string, socketId: string): void {
    const entry = this.rooms.get(roomCode);
    if (!entry) return;

    const participant = entry.state.participants[socketId];
    if (participant && participant.isDisconnected) {
      if (participant.assignedPlayerId) {
        entry.session.setPlayerHumanControl(participant.assignedPlayerId, true, null);
      }

      delete entry.state.participants[socketId];
      this.socketToRoom.delete(socketId);

      // Clean up empty room or migrate host
      const remainingSockets = Object.keys(entry.state.participants);
      if (remainingSockets.length === 0) {
        entry.session.destroy();
        this.rooms.delete(roomCode);
      } else if (entry.state.hostSocketId === socketId) {
        entry.state.hostSocketId = remainingSockets[0];
        entry.state.participants[remainingSockets[0]].isHost = true;
      }
    }
  }

  public handleMovementInput(
    socketId: string,
    input: PlayerMovementInput
  ): {
    success: boolean;
    error?: string;
    stale?: boolean;
    rateLimited?: boolean;
    authoritativeState?: PlayerEntityState;
  } {
    const entry = this.getRoomBySocket(socketId);
    if (!entry) {
      return { success: false, error: 'Unauthorized: Client not associated with any active room' };
    }

    if (input.roomCode && input.roomCode.toUpperCase() !== entry.state.roomCode) {
      return { success: false, error: 'Room code mismatch' };
    }

    const participant = entry.state.participants[socketId];
    if (!participant) {
      return { success: false, error: 'Unauthorized: Participant record not found' };
    }

    // Strict Authorization: Prevent controlling other players or unassigned slots
    if (!participant.assignedPlayerId || participant.assignedPlayerId !== input.playerId) {
      return {
        success: false,
        error: `Unauthorized: You do not control player ${input.playerId}. Assigned slot is ${participant.assignedPlayerId || 'NONE'}`
      };
    }

    const now = Date.now();

    // 1. Rate Limiting Check (Token bucket / sliding window per socket)
    let rateData = entry.rateLimiter.get(socketId);
    if (!rateData) {
      rateData = { lastTimestamp: 0, windowStart: now, count: 0 };
      entry.rateLimiter.set(socketId, rateData);
    }

    // Minimum interval between inputs
    if (now - rateData.lastTimestamp < SERVER_CONFIG.MIN_INPUT_INTERVAL_MS) {
      return { success: false, error: 'Input dropped: Exceeded minimum interval', rateLimited: true };
    }

    // Window count check (max 35 packets / sec)
    if (now - rateData.windowStart > 1000) {
      rateData.windowStart = now;
      rateData.count = 1;
    } else {
      rateData.count++;
      if (rateData.count > SERVER_CONFIG.RATE_LIMIT_INPUTS_PER_SEC) {
        return { success: false, error: 'Input dropped: Rate limit exceeded (35Hz)', rateLimited: true };
      }
    }
    rateData.lastTimestamp = now;

    // 2. Duplicate & Stale Input Check (Sequence numbers must be strictly increasing)
    const lastSeq = entry.sequenceTracker.get(input.playerId) ?? -1;
    if (input.sequence <= lastSeq) {
      return { success: false, error: 'Stale or duplicate sequence number dropped', stale: true };
    }
    entry.sequenceTracker.set(input.playerId, input.sequence);

    // 3. Movement Validation (Boundaries, elevation, and speed plausibility)
    const currentEntity = entry.session.getPlayerEntity(input.playerId);
    const validation = validatePlayerMovement(input, currentEntity, now);
    if (!validation.valid) {
      return { success: false, error: validation.error || 'Invalid movement coordinates' };
    }

    const finalPos = validation.correctedPosition || input.position;

    // 4. Update authoritative entity state in GameSession
    entry.session.updatePlayerEntity(input.playerId, {
      position: finalPos,
      rotationY: input.rotationY,
      velocity: input.velocity || { x: 0, y: 0, z: 0 },
      animationState: input.animationState || 'IDLE',
      sequence: input.sequence
    });

    const authoritativeState = entry.session.getPlayerEntity(input.playerId);
    return { success: true, authoritativeState };
  }

  public getRoomEntry(roomCode: string): RoomEntry | undefined {
    return this.rooms.get(roomCode.trim().toUpperCase());
  }

  public getRoomBySocket(socketId: string): RoomEntry | undefined {
    const code = this.socketToRoom.get(socketId);
    return code ? this.rooms.get(code) : undefined;
  }

  public handleFielderAction(
    socketId: string,
    intent: FieldingIntent
  ): { success: boolean; error?: string; action?: string; caught?: boolean; runOut?: boolean } {
    const entry = this.getRoomBySocket(socketId);
    if (!entry) {
      return { success: false, error: 'Unauthorized: Client not associated with any active room' };
    }
    const participant = entry.state.participants[socketId];
    if (participant && participant.assignedRole === 'SPECTATOR') {
      return { success: false, error: 'Unauthorized: Spectators cannot perform fielding actions' };
    }
    return entry.session.handleFielderAction(socketId, intent);
  }

  public handleFieldingAction(
    socketId: string,
    intent: FieldingIntent
  ): { success: boolean; error?: string; action?: string; caught?: boolean; runOut?: boolean } {
    return this.handleFielderAction(socketId, intent);
  }

  public handleAdjustFieldPosition(
    socketId: string,
    fielderId: string,
    position: Vector3D
  ): { success: boolean; error?: string } {
    const entry = this.getRoomBySocket(socketId);
    if (!entry) {
      return { success: false, error: 'Unauthorized: Client not associated with any active room' };
    }
    const participant = entry.state.participants[socketId];
    if (participant && participant.assignedRole === 'SPECTATOR') {
      return { success: false, error: 'Unauthorized: Spectators cannot adjust field positions' };
    }
    return entry.session.handleAdjustFieldPosition(socketId, fielderId, position);
  }

  public handleApplyFieldPreset(
    socketId: string,
    preset: 'ATTACKING' | 'DEFENSIVE' | 'BALANCED'
  ): { success: boolean; error?: string; positions?: Record<string, Vector3D> } {
    const entry = this.getRoomBySocket(socketId);
    if (!entry) {
      return { success: false, error: 'Unauthorized: Client not associated with any active room' };
    }
    const participant = entry.state.participants[socketId];
    if (participant && participant.assignedRole === 'SPECTATOR') {
      return { success: false, error: 'Unauthorized: Spectators cannot adjust field presets' };
    }
    return entry.session.handleApplyFieldPreset(socketId, preset);
  }

  public applyFieldPreset(
    socketId: string,
    preset: 'ATTACKING' | 'DEFENSIVE' | 'BALANCED'
  ): { success: boolean; error?: string; positions?: Record<string, Vector3D> } {
    return this.handleApplyFieldPreset(socketId, preset);
  }

  public handleBowlerCommit(
    socketId: string,
    intent: BowlingDeliveryIntent
  ): { success: boolean; error?: string } {
    const entry = this.getRoomBySocket(socketId);
    if (!entry) {
      return { success: false, error: 'Unauthorized: Room not found' };
    }
    const participant = entry.state.participants[socketId];
    if (!participant || participant.assignedRole === 'SPECTATOR' || !participant.assignedPlayerId) {
      return { success: false, error: 'Unauthorized: Spectators cannot bowl deliveries' };
    }
    return entry.session.handleBowlerCommit(intent, socketId);
  }

  public handleBatterShot(
    socketId: string,
    intent: BattingShotIntent
  ): { success: boolean; error?: string } {
    const entry = this.getRoomBySocket(socketId);
    if (!entry) {
      return { success: false, error: 'Unauthorized: Room not found' };
    }
    const participant = entry.state.participants[socketId];
    if (!participant || participant.assignedRole === 'SPECTATOR' || !participant.assignedPlayerId) {
      return { success: false, error: 'Unauthorized: Spectators cannot execute batting shots' };
    }
    return entry.session.handleBatterShot(intent, socketId);
  }

  public handleAppeal(
    socketId: string,
    appealType: string = 'HOWZAT'
  ): { success: boolean; signal?: UmpireSignal; error?: string } {
    const entry = this.getRoomBySocket(socketId);
    if (!entry) {
      return { success: false, error: 'Unauthorized: Room not found' };
    }
    const participant = entry.state.participants[socketId];
    if (!participant || participant.assignedRole === 'SPECTATOR') {
      return { success: false, error: 'Unauthorized: Spectators cannot appeal to the umpire' };
    }
    return entry.session.handleAppeal(socketId, appealType);
  }

  public handleRematch(socketId: string): { success: boolean; error?: string; state?: RoomState } {
    const entry = this.getRoomBySocket(socketId);
    if (!entry) {
      return { success: false, error: 'Room not found' };
    }
    const participant = entry.state.participants[socketId];
    if (!participant || !participant.isHost) {
      return { success: false, error: 'Only the room host can initiate a rematch' };
    }
    const res = entry.session.restartRematch();
    if (res.success) {
      entry.state.status = 'IN_PLAY';
      entry.state.lastActivityAt = Date.now();
      return { success: true, state: entry.state };
    }
    return res;
  }

  public handleReturnToLobby(socketId: string): { success: boolean; error?: string; state?: RoomState } {
    const entry = this.getRoomBySocket(socketId);
    if (!entry) {
      return { success: false, error: 'Room not found' };
    }
    const participant = entry.state.participants[socketId];
    if (!participant || !participant.isHost) {
      return { success: false, error: 'Only the room host can return the room to lobby' };
    }
    entry.state.status = 'LOBBY';
    for (const p of Object.values(entry.state.participants)) {
      p.isReady = p.isHost;
    }
    entry.session.resetToLobby();
    entry.state.lastActivityAt = Date.now();
    return { success: true, state: entry.state };
  }

  public handleStartSuperOver(socketId: string): { success: boolean; error?: string; state?: RoomState } {
    const entry = this.getRoomBySocket(socketId);
    if (!entry) {
      return { success: false, error: 'Room not found' };
    }
    const participant = entry.state.participants[socketId];
    if (!participant || !participant.isHost) {
      return { success: false, error: 'Only the room host can initiate a Super Over' };
    }
    const res = entry.session.startSuperOver();
    if (res.success) {
      entry.state.status = 'IN_PLAY';
      entry.state.lastActivityAt = Date.now();
      return { success: true, state: entry.state };
    }
    return res;
  }

  public cleanupInactiveRooms(
    maxInactiveMs: number = SERVER_CONFIG.ROOM_INACTIVITY_TTL_MS,
    now: number = Date.now()
  ): number {
    let swept = 0;
    for (const [roomCode, entry] of this.rooms.entries()) {
      const isExpired = (now - entry.state.lastActivityAt) > maxInactiveMs;
      const allDisconnected = Object.values(entry.state.participants).every(p => p.isDisconnected);
      const isEmpty = Object.keys(entry.state.participants).length === 0;

      if (isExpired || isEmpty || (allDisconnected && (now - entry.state.lastActivityAt > SERVER_CONFIG.RECONNECTION_GRACE_MS))) {
        for (const timer of entry.disconnectTimers.values()) {
          clearTimeout(timer);
        }
        entry.disconnectTimers.clear();

        entry.session.destroy();

        for (const socketId of Object.keys(entry.state.participants)) {
          this.socketToRoom.delete(socketId);
        }

        for (const [token, rec] of this.reconnectTokenMap.entries()) {
          if (rec.roomCode === roomCode) {
            this.reconnectTokenMap.delete(token);
          }
        }

        this.rooms.delete(roomCode);
        swept++;
      }
    }
    return swept;
  }

  public startCleanupSchedule(intervalMs: number = 60000): void {
    if (this.cleanupInterval) return;
    this.cleanupInterval = setInterval(() => {
      const swept = this.cleanupInactiveRooms();
      if (swept > 0) {
        console.log(`[RoomManager] Cleaned up ${swept} inactive room(s). Active rooms: ${this.rooms.size}`);
      }
    }, intervalMs);
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }

  public stopCleanupSchedule(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  public getActiveRoomCount(): number {
    return this.rooms.size;
  }
}

