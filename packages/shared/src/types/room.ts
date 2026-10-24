import { UmpireMode } from './umpire.js';
import { TeamId } from './team.js';

export type PitchCondition = 'HARD_TURF' | 'DUSTY_SPINNER' | 'GREEN_SEAMER';
export type MatchAtmosphere = 'DAY_SUNNY' | 'OVERCAST' | 'FLOODLIGHT_NIGHT';
export type AIDifficulty = 'ROOKIE' | 'STANDARD' | 'PRO' | 'LEGEND';

export interface RoomSettings {
  maxOversPerInnings: number; // 5 overs specification
  pitchCondition: PitchCondition;
  atmosphere: MatchAtmosphere;
  umpireMode: UmpireMode;
  aiDifficulty: AIDifficulty;
  isPrivate: boolean;
  allowSpectators: boolean;
  deliveryTimeLimitSec: number; // e.g. 20s shot clock
}

export interface RoomParticipant {
  socketId: string;
  userId: string;
  displayName: string;
  avatarSeed: string;
  isHost: boolean;
  isReady: boolean;
  assignedRole: 'PLAYER' | 'SPECTATOR' | 'MANUAL_UMPIRE';
  assignedTeamId?: TeamId | null;
  assignedPlayerId?: string | null; // cricketer in Playing XI (1 of 11)
  reconnectToken: string;
  connectedAt: number;
  lastPingMs: number;
  isDisconnected: boolean;
  disconnectGraceExpiresAt?: number;
}

export type RoomLobbyStatus = 'LOBBY' | 'TOSS' | 'IN_PLAY' | 'INNINGS_BREAK' | 'MATCH_OVER';

export interface RoomState {
  roomId: string;
  roomCode: string; // 6-character code
  hostSocketId: string;
  status: RoomLobbyStatus;
  settings: RoomSettings;
  participants: Record<string, RoomParticipant>;
  spectatorCount: number;
  createdAt: number;
  lastActivityAt: number;
}
