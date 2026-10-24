import { TeamId, TeamPlayingXI } from './team.js';
import { MatchScorecard } from './scorecard.js';
import { DRSReviewState } from './umpire.js';
import {
  BallPhysicalState,
  BowlingDeliveryIntent,
  BattingShotIntent,
  FieldingIntent
} from './physics.js';
import { DeliveryPhase } from './delivery.js';

export type CoinChoice = 'HEADS' | 'TAILS';
export type TossDecision = 'BAT' | 'BOWL';

export interface TossState {
  isCompleted: boolean;
  callerTeamId: TeamId;
  coinChoice: CoinChoice;
  coinResult?: CoinChoice;
  winnerTeamId?: TeamId;
  decision?: TossDecision;
}

export type MatchPhase =
  | 'WAITING_FOR_PLAYERS'
  | 'TOSS_IN_PROGRESS'
  | 'INNINGS_1_IN_PROGRESS'
  | 'MID_INNINGS_BREAK'
  | 'INNINGS_2_IN_PROGRESS'
  | 'MATCH_CONCLUDED'
  | 'SUPER_OVER';

export interface ActiveDeliveryState {
  deliveryPhase: DeliveryPhase;
  ball: BallPhysicalState;
  bowlerIntent?: BowlingDeliveryIntent | null;
  batterIntent?: BattingShotIntent | null;
  currentOverDeliveries: number; // 0 to 6
  runsCompletedThisBall: number;
  isRunCalled: boolean;
  fieldersInMotion: Record<string, FieldingIntent>;
  deliveryTimeRemainingSec: number;
}

export interface CricketGameState {
  roomId: string;
  roomCode: string;
  phase: MatchPhase;
  toss: TossState;
  battingTeamId: TeamId;
  bowlingTeamId: TeamId;
  currentInningsNumber: 1 | 2;
  currentStrikerId: string;
  currentNonStrikerId: string;
  currentBowlerId: string;
  teams: {
    TEAM_A: TeamPlayingXI;
    TEAM_B: TeamPlayingXI;
  };
  scorecard: MatchScorecard;
  activeDelivery: ActiveDeliveryState;
  drs: DRSReviewState;
  serverTick: number;
  lastTickTimestamp: number;
}
