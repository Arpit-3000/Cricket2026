import { RoomSettings, RoomState, RoomParticipant, RoomNotification } from './room.js';
import { TeamId, TeamPlayingXI } from './team.js';
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
import { PlayerMovementInput, PlayerEntityState } from './player.js';

export interface ClientToServerEvents {
  'room:create': (
    payload: { hostName: string; settings?: Partial<RoomSettings> },
    callback: (response: { success: boolean; roomCode?: string; reconnectToken?: string; error?: string }) => void
  ) => void;

  'room:join': (
    payload: { roomCode: string; displayName: string; reconnectToken?: string },
    callback: (response: { success: boolean; roomState?: RoomState; reconnectToken?: string; error?: string }) => void
  ) => void;

  'room:leave': () => void;

  'room:claim_slot': (payload: { teamId: TeamId; playerId: string }) => void;

  'room:release_slot': () => void;

  'room:set_ready': (payload: { ready: boolean }) => void;

  'room:update_settings': (payload: Partial<RoomSettings>) => void;

  'room:start_match': () => void;

  'team:update_lineup': (
    payload: {
      teamId: TeamId;
      captainId?: string;
      wicketKeeperId?: string;
      battingOrder?: string[];
      playerRoles?: Record<string, string>;
      name?: string;
      primaryColor?: string;
      secondaryColor?: string;
    },
    callback?: (response: { success: boolean; error?: string }) => void
  ) => void;

  'room:assign_umpire': (
    payload: { umpireSocketId: string | null; mode?: 'AI_AUTOMATION' | 'MANUAL_HUMAN' },
    callback?: (response: { success: boolean; error?: string }) => void
  ) => void;

  'toss:start': () => void;

  'player:move_input': (payload: PlayerMovementInput) => void;

  'toss:call': (payload: { choice: CoinChoice }) => void;

  'toss:decision': (payload: { decision: TossDecision }) => void;

  'game:bowler_select': (payload: { bowlerId: string }) => void;

  'game:bowler_commit_delivery': (payload: BowlingDeliveryIntent) => void;

  'game:batter_shot_input': (payload: BattingShotIntent) => void;

  'game:fielder_action': (payload: FieldingIntent) => void;

  'field:adjust_position': (
    payload: { fielderId: string; position: Vector3D },
    callback?: (response: { success: boolean; error?: string }) => void
  ) => void;

  'field:apply_preset': (
    payload: { preset: 'ATTACKING' | 'DEFENSIVE' | 'BALANCED' },
    callback?: (response: { success: boolean; error?: string }) => void
  ) => void;

  'game:call_run': (payload: { runner: 'STRIKER' | 'NON_STRIKER' }) => void;

  'umpire:appeal': (payload: { appealType: string }) => void;

  'umpire:manual_signal': (payload: { signal: UmpireSignal; reason: string }) => void;

  'drs:request_review': () => void;

  'room:rematch': (
    callback?: (response: { success: boolean; error?: string }) => void
  ) => void;

  'room:return_to_lobby': (
    callback?: (response: { success: boolean; error?: string }) => void
  ) => void;

  'game:start_second_innings': (
    callback?: (response: { success: boolean; error?: string }) => void
  ) => void;

  'game:start_super_over': (
    callback?: (response: { success: boolean; error?: string }) => void
  ) => void;

  'ping:sync': (
    payload: { clientTimestamp: number },
    callback: (serverTimestamp: number) => void
  ) => void;
}

export interface ServerToClientEvents {
  'room:state': (state: RoomState) => void;
  'room:notification': (notification: RoomNotification) => void;
  'room:participant_joined': (participant: RoomParticipant) => void;
  'room:participant_left': (socketId: string) => void;
  'room:participant_disconnected': (payload: { socketId: string; graceExpiresAt: number; displayName: string }) => void;
  'room:participant_reconnected': (payload: { socketId: string; participant: RoomParticipant }) => void;

  'player:sync': (payload: PlayerEntityState) => void;
  'player:batch_sync': (payload: { players: Record<string, PlayerEntityState>; serverTick: number }) => void;

  'game:init_match': (gameState: CricketGameState) => void;
  'game:tick': (sync: {
    tick: number;
    ball: BallPhysicalState;
    phase: DeliveryPhase;
    fielderPositions: Record<string, Vector3D>;
    players?: Record<string, PlayerEntityState>;
  }) => void;

  'game:bowler_runup': (payload: { bowlerId: string; durationMs: number }) => void;
  'game:ball_released': (payload: { speedKmph: number; trajectory: Vector3D }) => void;
  'game:bat_contact': (payload: { timingQuality: string; exitVelocity: Vector3D }) => void;
  'game:ball_possession': (payload: { fielderId: string | null; position: Vector3D }) => void;
  'game:fielder_throw': (payload: { fielderId: string; throwTargetEnd: 'STRIKER_END' | 'BOWLER_END'; velocity: Vector3D }) => void;
  'field:position_updated': (payload: { fielderId: string; position: Vector3D }) => void;
  'field:preset_applied': (payload: { preset: string; fieldPositions: Record<string, Vector3D> }) => void;
  'game:delivery_completed': (record: DeliveryRecord) => void;
  'game:scorecard_sync': (scorecard: MatchScorecard) => void;
  'game:over_ended': (payload: { overIndex: number; runs: number; wickets: number }) => void;
  'game:innings_transition': (payload: { nextInnings: 2; target: number }) => void;
  'game:innings_break': (payload: { inningsIndex: 1; target: number; requiredRunRate: number; commentary: string }) => void;
  'game:match_finished': (payload: {
    winnerTeamId: TeamId | 'TIE';
    commentary: string;
    scorecard: MatchScorecard;
  }) => void;
  'game:super_over_started': (payload: { gameState: CricketGameState }) => void;
  'game:rematch_started': (payload: { gameState: CricketGameState }) => void;
  'game:returned_to_lobby': (payload: { roomState: RoomState }) => void;

  'toss:started': (payload: { callerTeamId: TeamId; callerCaptainName: string; opponentCaptainName: string }) => void;
  'toss:flipped': (payload: { coinResult: CoinChoice; winnerTeamId: TeamId; winnerCaptainName: string; flipDurationMs: number }) => void;
  'toss:completed': (payload: { winnerTeamId: TeamId; decision: TossDecision; battingTeamId: TeamId; bowlingTeamId: TeamId }) => void;

  'team:lineup_updated': (payload: { teamId: TeamId; team: TeamPlayingXI }) => void;
  'umpire:assigned': (payload: { mode: 'AI_AUTOMATION' | 'MANUAL_HUMAN'; umpireSocketId: string | null; umpireName?: string }) => void;
  'umpire:prompt': (payload: { signalType: string; deadlineMs: number; timeoutSeconds: number }) => void;
  'umpire:timeout': (payload: { message: string }) => void;

  'umpire:signal_broadcast': (event: UmpireDecisionEvent) => void;
  'drs:state_update': (drsState: DRSReviewState) => void;
  'error:notification': (error: { code: string; message: string }) => void;
}
