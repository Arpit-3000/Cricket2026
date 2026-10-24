import { RoomSettings, RoomState, RoomParticipant } from './room.js';
import { TeamId } from './team.js';
import { CoinChoice, TossDecision, CricketGameState } from './cricket.js';
import {
  BowlingDeliveryIntent,
  BattingShotIntent,
  FieldingIntent,
  BallPhysicalState,
  Vector3D
} from './physics.js';
import { DeliveryPhase, DeliveryRecord } from './delivery.js';
import { MatchScorecard } from './scorecard.js';
import { UmpireSignal, UmpireDecisionEvent, DRSReviewState } from './umpire.js';

export interface ClientToServerEvents {
  'room:create': (
    payload: { hostName: string; settings?: Partial<RoomSettings> },
    callback: (response: { success: boolean; roomCode?: string; error?: string }) => void
  ) => void;

  'room:join': (
    payload: { roomCode: string; displayName: string; reconnectToken?: string },
    callback: (response: { success: boolean; roomState?: RoomState; error?: string }) => void
  ) => void;

  'room:leave': () => void;

  'room:claim_slot': (payload: { teamId: TeamId; playerId: string }) => void;

  'room:release_slot': () => void;

  'room:set_ready': (payload: { ready: boolean }) => void;

  'room:update_settings': (payload: Partial<RoomSettings>) => void;

  'room:start_match': () => void;

  'toss:call': (payload: { choice: CoinChoice }) => void;

  'toss:decision': (payload: { decision: TossDecision }) => void;

  'game:bowler_select': (payload: { bowlerId: string }) => void;

  'game:bowler_commit_delivery': (payload: BowlingDeliveryIntent) => void;

  'game:batter_shot_input': (payload: BattingShotIntent) => void;

  'game:fielder_action': (payload: FieldingIntent) => void;

  'game:call_run': (payload: { runner: 'STRIKER' | 'NON_STRIKER' }) => void;

  'umpire:appeal': (payload: { appealType: string }) => void;

  'umpire:manual_signal': (payload: { signal: UmpireSignal; reason: string }) => void;

  'drs:request_review': () => void;

  'ping:sync': (
    payload: { clientTimestamp: number },
    callback: (serverTimestamp: number) => void
  ) => void;
}

export interface ServerToClientEvents {
  'room:state': (state: RoomState) => void;
  'room:participant_joined': (participant: RoomParticipant) => void;
  'room:participant_left': (socketId: string) => void;

  'game:init_match': (gameState: CricketGameState) => void;
  'game:tick': (sync: {
    tick: number;
    ball: BallPhysicalState;
    phase: DeliveryPhase;
    fielderPositions: Record<string, Vector3D>;
  }) => void;

  'game:bowler_runup': (payload: { bowlerId: string; durationMs: number }) => void;
  'game:ball_released': (payload: { speedKmph: number; trajectory: Vector3D }) => void;
  'game:bat_contact': (payload: { timingQuality: string; exitVelocity: Vector3D }) => void;
  'game:delivery_completed': (record: DeliveryRecord) => void;
  'game:scorecard_sync': (scorecard: MatchScorecard) => void;
  'game:over_ended': (payload: { overIndex: number; runs: number; wickets: number }) => void;
  'game:innings_transition': (payload: { nextInnings: 2; target: number }) => void;
  'game:match_finished': (payload: {
    winnerTeamId: TeamId | 'TIE';
    commentary: string;
    scorecard: MatchScorecard;
  }) => void;

  'umpire:signal_broadcast': (event: UmpireDecisionEvent) => void;
  'drs:state_update': (drsState: DRSReviewState) => void;
  'error:notification': (error: { code: string; message: string }) => void;
}
