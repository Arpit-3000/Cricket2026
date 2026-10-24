import { PlayerProfile, FieldPositionName } from './player.js';

export type TeamId = 'TEAM_A' | 'TEAM_B';

export interface TeamPlayingXI {
  teamId: TeamId;
  name: string;
  shortCode: string; // e.g. "IND", "AUS", "ENG"
  primaryColor: string;
  secondaryColor: string;
  players: PlayerProfile[]; // Exactly 11 players
  captainId: string;
  wicketKeeperId: string;
  battingOrder?: string[];
  fieldPositions: Record<string, FieldPositionName>; // playerId -> field position
  customFieldCoordinates?: Record<string, { x: number; z: number }>; // exact coordinates on outfield
}

export interface TeamMatchState {
  teamId: TeamId;
  currentStrikerId: string;
  currentNonStrikerId: string;
  currentBowlerId: string;
  nextBatterIndex: number;
  oversBowledByPlayer: Record<string, number>; // bowling spell limit enforcement
}
