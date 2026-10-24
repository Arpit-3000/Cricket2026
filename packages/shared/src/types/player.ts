/**
 * Player roles, styles, and field positions in Cricket 2026.
 */

export type CricketRole = 'BATSMAN' | 'BOWLER' | 'ALL_ROUNDER' | 'WICKET_KEEPER';

export type BattingStyle = 'RIGHT_HAND' | 'LEFT_HAND';

export type BowlingStyle =
  | 'RIGHT_ARM_FAST'
  | 'RIGHT_ARM_FAST_MEDIUM'
  | 'RIGHT_ARM_OFF_SPIN'
  | 'RIGHT_ARM_LEG_SPIN'
  | 'LEFT_ARM_FAST'
  | 'LEFT_ARM_FAST_MEDIUM'
  | 'LEFT_ARM_ORTHODOX'
  | 'LEFT_ARM_UNORTHODOX';

/**
 * Standard 11 fielding positions on the cricket oval.
 */
export type FieldPositionName =
  | 'WICKET_KEEPER'
  | 'BOWLER'
  | 'FIRST_SLIP'
  | 'SECOND_SLIP'
  | 'GULLY'
  | 'POINT'
  | 'COVER'
  | 'MID_OFF'
  | 'MID_ON'
  | 'MID_WICKET'
  | 'SQUARE_LEG'
  | 'FINE_LEG'
  | 'THIRD_MAN'
  | 'DEEP_POINT'
  | 'DEEP_COVER'
  | 'LONG_OFF'
  | 'LONG_ON'
  | 'DEEP_MID_WICKET'
  | 'DEEP_SQUARE_LEG'
  | 'DEEP_FINE_LEG';

export interface PlayerAttributes {
  battingTiming: number; // 0-100
  battingPower: number; // 0-100
  bowlingPace: number; // 0-100 (maps to km/h)
  bowlingAccuracy: number; // 0-100
  bowlingSpinSwing: number; // 0-100
  fieldingCatching: number; // 0-100
  fieldingSpeed: number; // 0-100
  throwAccuracy: number; // 0-100
}

export interface PlayerProfile {
  id: string;
  displayName: string;
  avatarUrl?: string;
  role: CricketRole;
  battingStyle: BattingStyle;
  bowlingStyle: BowlingStyle;
  jerseyNumber: number;
  attributes: PlayerAttributes;
  isAi: boolean;
  assignedHumanId?: string | null; // socket id / user id if human controlled
  fieldPosition?: FieldPositionName;
  isCaptain?: boolean;
}

export interface PlayerAssignment {
  playerId: string;
  teamId: 'TEAM_A' | 'TEAM_B';
  battingOrder: number; // 1 to 11
  fieldPosition: FieldPositionName;
  isCaptain: boolean;
  isWicketKeeper: boolean;
  isStriker: boolean;
  isNonStriker: boolean;
  isCurrentBowler: boolean;
}

export type PlayerAnimationState =
  | 'IDLE'
  | 'WALK'
  | 'RUN'
  | 'SPRINT'
  | 'SLIDE'
  | 'DIVE'
  | 'BATTING_STANCE'
  | 'BACKSWING'
  | 'SHOT_EXECUTION'
  | 'ATTACKING_SHOT'
  | 'DEFENSIVE_SHOT'
  | 'DEFENSIVE_BLOCK'
  | 'FOLLOW_THROUGH'
  | 'BOWLING_RUNUP'
  | 'BOWLER_RUNUP'
  | 'DELIVERY_STRIDE'
  | 'RELEASE'
  | 'BOWLER_FOLLOW_THROUGH'
  | 'KEEPER_READY'
  | 'CELEBRATION'
  | 'FIELDING_PICKUP'
  | 'CATCHING'
  | 'THROWING';

export interface PlayerEntityState {
  playerId: string;
  teamId: 'TEAM_A' | 'TEAM_B';
  displayName: string;
  role: FieldPositionName | CricketRole | string;
  jerseyNumber?: number;
  position: { x: number; y: number; z: number };
  rotationY: number;
  velocity: { x: number; y: number; z: number };
  animationState: PlayerAnimationState;
  sequence: number;
  serverTimestamp: number;
  isHuman: boolean;
  isDisconnected?: boolean;
  assignedHumanId?: string | null;
}

export interface PlayerMovementInput {
  roomCode: string;
  playerId: string;
  position: { x: number; y: number; z: number };
  rotationY: number;
  velocity: { x: number; y: number; z: number };
  animationState: PlayerAnimationState;
  sequence: number;
  clientTimestamp: number;
}

