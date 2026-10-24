/**
 * Umpire modes, human & AI calls, appeals, and DRS (Decision Review System).
 */

export type UmpireMode = 'AI_AUTOMATION' | 'MANUAL_HUMAN';

export type UmpireSignal =
  | 'OUT'
  | 'NOT_OUT'
  | 'WIDE'
  | 'NO_BALL'
  | 'FOUR'
  | 'SIX'
  | 'DEAD_BALL'
  | 'BYE'
  | 'LEG_BYE'
  | 'SHORT_RUN';

export type HawkEyePitchAlignment = 'IN_LINE' | 'OUTSIDE_OFF' | 'OUTSIDE_LEG';
export type HawkEyeImpactAlignment = 'IN_LINE' | 'OUTSIDE';
export type HawkEyeWicketsOutcome = 'HITTING' | 'CLIPPING_UMPIRES_CALL' | 'MISSING';

export interface HawkEyeData {
  pitching: HawkEyePitchAlignment;
  impact: HawkEyeImpactAlignment;
  wickets: HawkEyeWicketsOutcome;
  projectedStumpImpactPoint: { x: number; y: number; z: number };
}

export interface DRSReviewState {
  isActive: boolean;
  requestedByTeam: 'TEAM_A' | 'TEAM_B';
  requestedRole: 'BATSMAN' | 'BOWLER_CAPTAIN';
  remainingReviews: {
    TEAM_A: number;
    TEAM_B: number;
  };
  countdownSeconds: number; // 15-second timer
  ultraEdgeSpike: boolean;
  hawkEye?: HawkEyeData;
  originalCall: 'OUT' | 'NOT_OUT';
  finalCall: 'OUT' | 'NOT_OUT';
}

export interface UmpireDecisionEvent {
  signal: UmpireSignal;
  isAiDecision: boolean;
  umpireUserId?: string; // Socket ID or user ID if manual mode
  reason: string;
  timestamp: number;
}
