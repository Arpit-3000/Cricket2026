import { Vector3D } from './physics.js';

export type DismissalType =
  | 'BOWLED'
  | 'CAUGHT'
  | 'LBW'
  | 'RUN_OUT'
  | 'STUMPED'
  | 'HIT_WICKET'
  | 'OBSTRUCTING_THE_FIELD';

export type ExtraType = 'NONE' | 'WIDE' | 'NO_BALL' | 'BYE' | 'LEG_BYE' | 'PENALTY';

export interface WicketDetail {
  dismissalType: DismissalType;
  dismissedPlayerId: string;
  bowlerId: string;
  fielderId?: string | null;
  commentary: string;
}

export interface DeliveryOutcome {
  batterRuns: number;
  extrasType: ExtraType;
  extrasRuns: number;
  totalRuns: number;
  isLegalDelivery: boolean; // false for wide / no-ball
  isBoundaryFour: boolean;
  isBoundarySix: boolean;
  wicket?: WicketDetail | null;
  strikeRotated: boolean;
  reviewTriggered: boolean;
}

export type DeliveryPhase =
  | 'AWAITING_BOWLER_CONFIRM'
  | 'BOWLER_RUNUP'
  | 'BALL_RELEASE'
  | 'BALL_IN_FLIGHT_PRE_BOUNCE'
  | 'BALL_PITCHED'
  | 'BAT_INTERACTION'
  | 'BALL_IN_FIELD'
  | 'RUNNING_BETWEEN_WICKETS'
  | 'BALL_DEAD'
  | 'UMPIRE_ADJUDICATION';

export interface DeliveryRecord {
  id: string;
  inningsNumber: 1 | 2;
  overIndex: number; // 0 to 4
  ballInOver: number; // 1 to 6 (legal ball count)
  bowlerId: string;
  strikerId: string;
  nonStrikerId: string;
  releaseSpeedKmph: number;
  pitchPoint: Vector3D;
  batContactPoint?: Vector3D;
  outcome: DeliveryOutcome;
  timestamp: number;
}
