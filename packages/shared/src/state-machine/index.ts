import { MatchPhase } from '../types/cricket.js';
import { DeliveryPhase } from '../types/delivery.js';

/**
 * Valid transitions for high-level match phases.
 */
export const VALID_MATCH_PHASE_TRANSITIONS: Record<MatchPhase, MatchPhase[]> = {
  // Phase 3 canonical lifecycle
  LOBBY: ['TEAM_SELECTION', 'TOSS', 'TOSS_IN_PROGRESS'],
  TEAM_SELECTION: ['TOSS', 'TOSS_IN_PROGRESS', 'LOBBY', 'WAITING_FOR_PLAYERS'],
  TOSS: ['INNINGS_SETUP', 'ACTIVE_MATCH', 'INNINGS_1_IN_PROGRESS'],
  INNINGS_SETUP: ['ACTIVE_MATCH', 'INNINGS_1_IN_PROGRESS'],
  ACTIVE_MATCH: ['INNINGS_BREAK', 'MID_INNINGS_BREAK', 'COMPLETED_MATCH', 'MATCH_CONCLUDED'],
  INNINGS_BREAK: ['SECOND_INNINGS', 'INNINGS_2_IN_PROGRESS'],
  SECOND_INNINGS: ['COMPLETED_MATCH', 'MATCH_CONCLUDED', 'SUPER_OVER'],
  COMPLETED_MATCH: ['LOBBY', 'WAITING_FOR_PLAYERS', 'TOSS', 'TOSS_IN_PROGRESS'],

  // Backward-compatible alias mappings
  WAITING_FOR_PLAYERS: ['TEAM_SELECTION', 'TOSS', 'TOSS_IN_PROGRESS'],
  TOSS_IN_PROGRESS: ['INNINGS_SETUP', 'ACTIVE_MATCH', 'INNINGS_1_IN_PROGRESS'],
  INNINGS_1_IN_PROGRESS: ['INNINGS_BREAK', 'MID_INNINGS_BREAK', 'COMPLETED_MATCH', 'MATCH_CONCLUDED'],
  MID_INNINGS_BREAK: ['SECOND_INNINGS', 'INNINGS_2_IN_PROGRESS'],
  INNINGS_2_IN_PROGRESS: ['COMPLETED_MATCH', 'MATCH_CONCLUDED', 'SUPER_OVER'],
  SUPER_OVER: ['COMPLETED_MATCH', 'MATCH_CONCLUDED'],
  MATCH_CONCLUDED: ['LOBBY', 'WAITING_FOR_PLAYERS', 'TOSS', 'TOSS_IN_PROGRESS']
};

export function canTransitionMatchPhase(from: MatchPhase, to: MatchPhase): boolean {
  const allowed = VALID_MATCH_PHASE_TRANSITIONS[from] || [];
  return allowed.includes(to);
}

/**
 * Valid transitions for individual ball delivery lifecycle.
 */
export const VALID_DELIVERY_PHASE_TRANSITIONS: Record<DeliveryPhase, DeliveryPhase[]> = {
  AWAITING_BOWLER_CONFIRM: ['BOWLER_RUNUP'],
  BOWLER_RUNUP: ['BALL_RELEASE', 'AWAITING_BOWLER_CONFIRM'],
  BALL_RELEASE: ['BALL_IN_FLIGHT_PRE_BOUNCE'],
  BALL_IN_FLIGHT_PRE_BOUNCE: ['BALL_PITCHED'],
  BALL_PITCHED: ['BAT_INTERACTION'],
  BAT_INTERACTION: ['BALL_IN_FIELD', 'BALL_DEAD', 'UMPIRE_ADJUDICATION'],
  BALL_IN_FIELD: ['RUNNING_BETWEEN_WICKETS', 'BALL_DEAD'],
  RUNNING_BETWEEN_WICKETS: ['BALL_IN_FIELD', 'BALL_DEAD', 'UMPIRE_ADJUDICATION'],
  UMPIRE_ADJUDICATION: ['BALL_DEAD'],
  BALL_DEAD: ['AWAITING_BOWLER_CONFIRM']
};

export class MatchStateMachine {
  private currentPhase: MatchPhase;
  private currentDeliveryPhase: DeliveryPhase;

  constructor(initialPhase: MatchPhase = 'WAITING_FOR_PLAYERS') {
    this.currentPhase = initialPhase;
    this.currentDeliveryPhase = 'AWAITING_BOWLER_CONFIRM';
  }

  public getPhase(): MatchPhase {
    return this.currentPhase;
  }

  public getDeliveryPhase(): DeliveryPhase {
    return this.currentDeliveryPhase;
  }

  public canTransitionMatchPhase(nextPhase: MatchPhase): boolean {
    const allowed = VALID_MATCH_PHASE_TRANSITIONS[this.currentPhase] || [];
    return allowed.includes(nextPhase);
  }

  public transitionMatchPhase(nextPhase: MatchPhase): boolean {
    if (this.canTransitionMatchPhase(nextPhase)) {
      this.currentPhase = nextPhase;
      return true;
    }
    return false;
  }

  public canTransitionDeliveryPhase(nextPhase: DeliveryPhase): boolean {
    const allowed = VALID_DELIVERY_PHASE_TRANSITIONS[this.currentDeliveryPhase] || [];
    return allowed.includes(nextPhase);
  }

  public transitionDeliveryPhase(nextPhase: DeliveryPhase): boolean {
    if (this.canTransitionDeliveryPhase(nextPhase)) {
      this.currentDeliveryPhase = nextPhase;
      return true;
    }
    return false;
  }

  public resetDeliveryPhase(): void {
    this.currentDeliveryPhase = 'AWAITING_BOWLER_CONFIRM';
  }
}
