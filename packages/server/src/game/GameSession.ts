import {
  CricketGameState,
  TeamId,
  TeamPlayingXI,
  PlayerProfile,
  PlayerEntityState,
  MatchScorecard,
  InningsScorecard,
  BattingScorecardEntry,
  DeliveryOutcome,
  DeliveryRecord,
  BallPhysicalState,
  BowlingDeliveryIntent,
  BattingShotIntent,
  FieldingIntent,
  Vector3D,
  CRICKET_RULES,
  GROUND_DIMENSIONS,
  DEFAULT_FIELD_PRESETS,
  ATTACKING_FIELD_PRESETS,
  DEFENSIVE_FIELD_PRESETS,
  FIELDING_CONFIG,
  MatchStateMachine,
  CoinChoice,
  TossDecision,
  TossState,
  MatchPhase,
  UmpireSignal,
  UmpireDecisionEvent,
  CricketRole,
  CricketPhysicsEngine,
  SimulationResult,
  validateLineupUpdate,
  validateUmpireSignal,
  validateFieldingIntent,
  validateFieldAdjustment
} from '@cricket2026/shared';
import { AIService } from './AIService.js';

export interface GameSessionCallbacks {
  onStateBroadcast: (state: CricketGameState) => void;
  onTickBroadcast: (sync: any) => void;
  onDeliveryCompleted: (record: DeliveryRecord) => void;
  onUmpireBroadcast?: (event: UmpireDecisionEvent) => void;
  onUmpirePrompt?: (payload: { signalType: string; deadlineMs: number; timeoutSeconds: number }) => void;
  onUmpireTimeout?: (payload: { message: string }) => void;
  onScorecardSync?: (scorecard: MatchScorecard) => void;
  onOverEnded?: (payload: { overIndex: number; runs: number; wickets: number }) => void;
  onInningsTransition?: (payload: { nextInnings: 2; target: number }) => void;
  onInningsBreak?: (payload: { inningsIndex: 1; target: number; requiredRunRate: number; commentary: string }) => void;
  onMatchFinished?: (payload: { winnerTeamId: TeamId | 'TIE'; commentary: string; scorecard: MatchScorecard }) => void;
  onSuperOverStarted?: (payload: { gameState: CricketGameState }) => void;
  onRematchStarted?: (payload: { gameState: CricketGameState }) => void;
  onBallReleased?: (payload: { speedKmph: number; trajectory: Vector3D }) => void;
  onBatContact?: (payload: { timingQuality: string; exitVelocity: Vector3D }) => void;
  onBallPossession?: (payload: { fielderId: string; position: Vector3D }) => void;
  onFielderThrow?: (payload: { fielderId: string; targetEnd: 'STRIKER_END' | 'BOWLER_END'; throwPower: number }) => void;
  onFieldPositionUpdated?: (payload: { fielderId: string; position: Vector3D }) => void;
  onFieldPresetApplied?: (payload: { preset: string; positions: Record<string, Vector3D> }) => void;
}

export class GameSession {
  public readonly roomId: string;
  public readonly roomCode: string;
  private stateMachine: MatchStateMachine;
  private gameState: CricketGameState;
  private playerEntities: Record<string, PlayerEntityState> = {};
  private tickInterval: NodeJS.Timeout | null = null;
  private umpireDecisionTimeout: NodeJS.Timeout | null = null;
  private currentOverBowlerRuns: number = 0;
  private callbacks: GameSessionCallbacks;
  private onStateBroadcast: (state: CricketGameState) => void;
  private onTickBroadcast: (sync: any) => void;
  private onDeliveryCompleted: (record: DeliveryRecord) => void;

  constructor(
    roomId: string,
    roomCode: string,
    callbacks: GameSessionCallbacks
  ) {
    this.roomId = roomId;
    this.roomCode = roomCode;
    this.callbacks = callbacks;
    this.stateMachine = new MatchStateMachine('WAITING_FOR_PLAYERS');
    this.onStateBroadcast = callbacks.onStateBroadcast;
    this.onTickBroadcast = callbacks.onTickBroadcast;
    this.onDeliveryCompleted = callbacks.onDeliveryCompleted;

    const teamA = this.createDefaultTeam('TEAM_A', 'India XI', 'IND', '#1d4ed8', '#fbbf24');
    const teamB = this.createDefaultTeam('TEAM_B', 'Australia XI', 'AUS', '#047857', '#facc15');

    const initialScorecard: MatchScorecard = {
      roomId,
      innings: [this.createEmptyInningsScorecard(1, 'TEAM_A', 'TEAM_B', teamA.players)],
      currentInningsIndex: 1,
      isCompleted: false
    };

    const initialBall: BallPhysicalState = {
      position: { x: 0, y: GROUND_DIMENSIONS.STUMP_HEIGHT_METERS, z: -GROUND_DIMENSIONS.PITCH_LENGTH_METERS / 2 },
      velocity: { x: 0, y: 0, z: 0 },
      angularVelocity: { x: 0, y: 0, z: 0 },
      isGrounded: false,
      hasPitched: false,
      hasBatContact: false,
      hasPadContact: false,
      isInAir: false,
      possessedByFielderId: null,
      isThrowInFlight: false,
      throwTargetEnd: null
    };

    this.gameState = {
      roomId,
      roomCode,
      phase: 'WAITING_FOR_PLAYERS',
      toss: {
        isCompleted: false,
        callerTeamId: 'TEAM_B',
        coinChoice: 'HEADS'
      },
      battingTeamId: 'TEAM_A',
      bowlingTeamId: 'TEAM_B',
      currentInningsNumber: 1,
      currentStrikerId: teamA.players[0].id,
      currentNonStrikerId: teamA.players[1].id,
      currentBowlerId: teamB.players[10].id, // primary bowler
      teams: {
        TEAM_A: teamA,
        TEAM_B: teamB
      },
      scorecard: initialScorecard,
      activeDelivery: {
        deliveryPhase: 'AWAITING_BOWLER_CONFIRM',
        ball: initialBall,
        currentOverDeliveries: 0,
        runsCompletedThisBall: 0,
        isRunCalled: false,
        fieldersInMotion: {},
        deliveryTimeRemainingSec: CRICKET_RULES.DELIVERY_COUNTDOWN_SECONDS
      },
      drs: {
        isActive: false,
        requestedByTeam: 'TEAM_A',
        requestedRole: 'BATSMAN',
        remainingReviews: {
          TEAM_A: CRICKET_RULES.DRS_REVIEWS_PER_INNINGS,
          TEAM_B: CRICKET_RULES.DRS_REVIEWS_PER_INNINGS
        },
        countdownSeconds: 15,
        ultraEdgeSpike: false,
        originalCall: 'NOT_OUT',
        finalCall: 'NOT_OUT'
      },
      umpireMode: 'AI_AUTOMATION',
      manualUmpireSocketId: null,
      umpirePendingDecision: null,
      serverTick: 0,
      lastTickTimestamp: Date.now()
    };

    this.initPlayerEntities(teamA, teamB);
  }

  private initPlayerEntities(teamA: TeamPlayingXI, teamB: TeamPlayingXI): void {
    const pitchHalfLength = GROUND_DIMENSIONS.PITCH_LENGTH_METERS / 2;
    const now = Date.now();

    // 1. Team A (Batters initially)
    teamA.players.forEach((p, idx) => {
      let position = { x: -45 - (idx * 1.5), y: 0, z: -25 };
      let rotationY = 0;
      let animationState: PlayerEntityState['animationState'] = 'IDLE';
      let role: string = p.role;

      if (idx === 0) {
        // Striker
        position = { x: 0, y: 0, z: pitchHalfLength - 1.2 };
        rotationY = Math.PI;
        animationState = 'BATTING_STANCE';
        role = 'STRIKER';
      } else if (idx === 1) {
        // Non-striker
        position = { x: 1.4, y: 0, z: -pitchHalfLength + 1.2 };
        rotationY = 0;
        animationState = 'IDLE';
        role = 'NON_STRIKER';
      }

      this.playerEntities[p.id] = {
        playerId: p.id,
        teamId: 'TEAM_A',
        displayName: p.displayName,
        role,
        position,
        rotationY,
        velocity: { x: 0, y: 0, z: 0 },
        animationState,
        sequence: 0,
        serverTimestamp: now,
        isHuman: !p.isAi,
        assignedHumanId: p.assignedHumanId || null
      };
    });

    // 2. Team B (Bowler & Fielders initially)
    const outfieldPresets = Object.entries(DEFAULT_FIELD_PRESETS).filter(
      ([name]) => !['BOWLER', 'WICKET_KEEPER'].includes(name)
    );

    teamB.players.forEach((p, idx) => {
      let position = { x: 0, y: 0, z: 0 };
      let rotationY = 0;
      let role: string = p.role;

      if (idx === 10) {
        // Active bowler
        position = { x: 0, y: 0, z: -pitchHalfLength - 8.5 };
        rotationY = 0;
        role = 'BOWLER';
      } else if (idx === 0) {
        // Wicketkeeper
        position = { x: 0, y: 0, z: pitchHalfLength + 3.8 };
        rotationY = Math.PI;
        role = 'WICKET_KEEPER';
      } else {
        // Outfielders 1 to 9
        const presetIndex = (idx - 1) % outfieldPresets.length;
        const [presetName, coords] = outfieldPresets[presetIndex];
        position = { x: coords.x, y: 0, z: coords.z };
        rotationY = Math.atan2(-coords.x, -coords.z);
        role = presetName;
      }

      this.playerEntities[p.id] = {
        playerId: p.id,
        teamId: 'TEAM_B',
        displayName: p.displayName,
        role,
        position,
        rotationY,
        velocity: { x: 0, y: 0, z: 0 },
        animationState: 'IDLE',
        sequence: 0,
        serverTimestamp: now,
        isHuman: !p.isAi,
        assignedHumanId: p.assignedHumanId || null
      };
    });
  }

  public getPlayerEntities(): Record<string, PlayerEntityState> {
    return this.playerEntities;
  }

  public getPlayerEntity(playerId: string): PlayerEntityState | undefined {
    return this.playerEntities[playerId];
  }

  public updatePlayerEntity(playerId: string, partial: Partial<PlayerEntityState>): void {
    if (this.playerEntities[playerId]) {
      this.playerEntities[playerId] = {
        ...this.playerEntities[playerId],
        ...partial,
        serverTimestamp: Date.now()
      };
    }
  }

  public setPlayerHumanControl(
    playerId: string,
    isAi: boolean,
    humanId?: string | null,
    displayName?: string
  ): void {
    // Update team player profile
    for (const teamKey of ['TEAM_A', 'TEAM_B'] as const) {
      const player = this.gameState.teams[teamKey].players.find(p => p.id === playerId);
      if (player) {
        player.isAi = isAi;
        player.assignedHumanId = humanId || null;
        if (displayName) player.displayName = displayName;
      }
    }

    // Update entity state
    if (this.playerEntities[playerId]) {
      this.playerEntities[playerId].isHuman = !isAi;
      this.playerEntities[playerId].assignedHumanId = humanId || null;
      if (displayName) this.playerEntities[playerId].displayName = displayName;
      this.playerEntities[playerId].serverTimestamp = Date.now();
    }
  }

  public getGameState(): CricketGameState {
    return this.gameState;
  }

  public updateTeamLineup(payload: {
    teamId: TeamId;
    captainId?: string;
    wicketKeeperId?: string;
    battingOrder?: string[];
    playerRoles?: Record<string, string>;
    name?: string;
    primaryColor?: string;
    secondaryColor?: string;
  }): { success: boolean; error?: string; team?: TeamPlayingXI } {
    const team = this.gameState.teams[payload.teamId];
    if (!team) return { success: false, error: `Team ${payload.teamId} not found` };

    const existingIds = team.players.map(p => p.id);
    const validation = validateLineupUpdate(payload, existingIds);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    if (payload.name) team.name = payload.name.trim();
    if (payload.primaryColor) team.primaryColor = payload.primaryColor;
    if (payload.secondaryColor) team.secondaryColor = payload.secondaryColor;

    if (payload.captainId) {
      team.captainId = payload.captainId;
    }

    if (payload.wicketKeeperId) {
      team.wicketKeeperId = payload.wicketKeeperId;
      for (const p of team.players) {
        if (p.id === payload.wicketKeeperId) {
          p.role = 'WICKET_KEEPER';
        } else if (p.role === 'WICKET_KEEPER') {
          p.role = 'BATSMAN';
        }
      }
    }

    if (payload.playerRoles) {
      for (const [playerId, newRole] of Object.entries(payload.playerRoles)) {
        const player = team.players.find(p => p.id === playerId);
        if (player) {
          player.role = newRole as CricketRole;
          if (this.playerEntities[playerId]) {
            this.playerEntities[playerId].role = newRole;
          }
        }
      }
    }

    if (payload.battingOrder && payload.battingOrder.length === team.players.length) {
      const playerMap = new Map(team.players.map(p => [p.id, p]));
      team.players = payload.battingOrder.map(id => playerMap.get(id)!);
      team.battingOrder = [...payload.battingOrder];
    }

    this.onStateBroadcast(this.gameState);
    return { success: true, team };
  }

  public transitionPhase(nextPhase: MatchPhase): boolean {
    if (this.stateMachine.canTransitionMatchPhase(nextPhase)) {
      this.stateMachine.transitionMatchPhase(nextPhase);
      this.gameState.phase = nextPhase;
      this.onStateBroadcast(this.gameState);
      return true;
    }
    return false;
  }

  public startToss(): { success: boolean; toss: TossState; error?: string } {
    const canTossProg = this.stateMachine.canTransitionMatchPhase('TOSS_IN_PROGRESS');
    const canToss = this.stateMachine.canTransitionMatchPhase('TOSS');

    if (!canTossProg && !canToss && this.gameState.phase !== 'TOSS' && this.gameState.phase !== 'TOSS_IN_PROGRESS') {
      return { success: false, toss: this.gameState.toss, error: `Cannot transition from ${this.gameState.phase} to TOSS` };
    }

    const nextPhase: MatchPhase = canToss ? 'TOSS' : 'TOSS_IN_PROGRESS';
    this.stateMachine.transitionMatchPhase(nextPhase);
    this.gameState.phase = nextPhase;

    const teamA = this.gameState.teams.TEAM_A;
    const teamB = this.gameState.teams.TEAM_B;

    const captainA = teamA.players.find(p => p.id === teamA.captainId) || teamA.players[0];
    const captainB = teamB.players.find(p => p.id === teamB.captainId) || teamB.players[0];

    this.gameState.toss = {
      isCompleted: false,
      callerTeamId: 'TEAM_B',
      callerCaptainName: captainB.displayName,
      opponentCaptainName: captainA.displayName,
      coinChoice: 'HEADS',
      flipAnimationDurationMs: CRICKET_RULES.TOSS_FLIP_ANIMATION_MS
    };

    this.onStateBroadcast(this.gameState);
    return { success: true, toss: this.gameState.toss };
  }

  public callToss(choice: CoinChoice): {
    success: boolean;
    coinResult: CoinChoice;
    winnerTeamId: TeamId;
    winnerCaptainName: string;
    flipDurationMs: number;
    error?: string;
  } {
    if (this.gameState.phase !== 'TOSS' && this.gameState.phase !== 'TOSS_IN_PROGRESS') {
      return {
        success: false,
        coinResult: 'HEADS',
        winnerTeamId: 'TEAM_A',
        winnerCaptainName: '',
        flipDurationMs: 0,
        error: 'Toss is not currently in progress'
      };
    }

    const coinResult: CoinChoice = Math.random() > 0.5 ? 'HEADS' : 'TAILS';
    const callerTeam = this.gameState.toss.callerTeamId;
    const winnerTeamId: TeamId = choice === coinResult ? callerTeam : (callerTeam === 'TEAM_A' ? 'TEAM_B' : 'TEAM_A');

    const winnerTeam = this.gameState.teams[winnerTeamId];
    const winnerCaptain = winnerTeam.players.find(p => p.id === winnerTeam.captainId) || winnerTeam.players[0];

    this.gameState.toss.coinChoice = choice;
    this.gameState.toss.coinResult = coinResult;
    this.gameState.toss.winnerTeamId = winnerTeamId;

    this.onStateBroadcast(this.gameState);

    return {
      success: true,
      coinResult,
      winnerTeamId,
      winnerCaptainName: winnerCaptain.displayName,
      flipDurationMs: CRICKET_RULES.TOSS_FLIP_ANIMATION_MS
    };
  }

  public decideToss(decision: TossDecision): {
    success: boolean;
    battingTeamId: TeamId;
    bowlingTeamId: TeamId;
    toss: TossState;
    error?: string;
  } {
    if (!this.gameState.toss.winnerTeamId) {
      return {
        success: false,
        battingTeamId: 'TEAM_A',
        bowlingTeamId: 'TEAM_B',
        toss: this.gameState.toss,
        error: 'Toss coin flip has not been resolved yet'
      };
    }

    const winnerTeam = this.gameState.toss.winnerTeamId;
    const otherTeam: TeamId = winnerTeam === 'TEAM_A' ? 'TEAM_B' : 'TEAM_A';

    const battingTeamId: TeamId = decision === 'BAT' ? winnerTeam : otherTeam;
    const bowlingTeamId: TeamId = decision === 'BAT' ? otherTeam : winnerTeam;

    this.gameState.toss.decision = decision;
    this.gameState.toss.isCompleted = true;
    this.gameState.battingTeamId = battingTeamId;
    this.gameState.bowlingTeamId = bowlingTeamId;

    // Transition from TOSS to INNINGS_SETUP (or ACTIVE_MATCH / INNINGS_1_IN_PROGRESS)
    if (this.stateMachine.canTransitionMatchPhase('INNINGS_SETUP')) {
      this.stateMachine.transitionMatchPhase('INNINGS_SETUP');
      this.gameState.phase = 'INNINGS_SETUP';
    } else if (this.stateMachine.canTransitionMatchPhase('ACTIVE_MATCH')) {
      this.stateMachine.transitionMatchPhase('ACTIVE_MATCH');
      this.gameState.phase = 'ACTIVE_MATCH';
    } else if (this.stateMachine.canTransitionMatchPhase('INNINGS_1_IN_PROGRESS')) {
      this.stateMachine.transitionMatchPhase('INNINGS_1_IN_PROGRESS');
      this.gameState.phase = 'INNINGS_1_IN_PROGRESS';
    }

    // Assign on-field batting & bowling openers
    const battingTeam = this.gameState.teams[battingTeamId];
    const bowlingTeam = this.gameState.teams[bowlingTeamId];

    this.gameState.currentStrikerId = battingTeam.players[0].id;
    this.gameState.currentNonStrikerId = battingTeam.players[1].id;
    this.gameState.currentBowlerId = bowlingTeam.players[10].id;

    // Reposition fielders and batters for the chosen innings
    this.repositionPlayersForInnings(battingTeamId, bowlingTeamId);

    this.onStateBroadcast(this.gameState);

    return {
      success: true,
      battingTeamId,
      bowlingTeamId,
      toss: this.gameState.toss
    };
  }

  public setUmpireMode(mode: 'AI_AUTOMATION' | 'MANUAL_HUMAN', umpireSocketId: string | null = null): void {
    this.gameState.umpireMode = mode;
    this.gameState.manualUmpireSocketId = mode === 'MANUAL_HUMAN' ? umpireSocketId : null;
    if (mode === 'AI_AUTOMATION' && this.umpireDecisionTimeout) {
      clearTimeout(this.umpireDecisionTimeout);
      this.umpireDecisionTimeout = null;
      this.gameState.umpirePendingDecision = null;
    }
    this.onStateBroadcast(this.gameState);
  }

  public onUmpireBroadcast(cb: (event: UmpireDecisionEvent) => void): void {
    this.callbacks.onUmpireBroadcast = cb;
  }

  public onUmpirePrompt(cb: (payload: { signalType: string; deadlineMs: number; timeoutSeconds: number }) => void): void {
    this.callbacks.onUmpirePrompt = cb;
  }

  public onUmpireTimeout(cb: (payload: { message: string }) => void): void {
    this.callbacks.onUmpireTimeout = cb;
  }

  public handleManualUmpireDisconnect(socketId: string): void {
    if (this.gameState.manualUmpireSocketId === socketId) {
      if (this.umpireDecisionTimeout) {
        clearTimeout(this.umpireDecisionTimeout);
        this.umpireDecisionTimeout = null;
      }
      this.gameState.umpirePendingDecision = null;
      this.gameState.umpireMode = 'AI_AUTOMATION';
      this.gameState.manualUmpireSocketId = null;
      // Seamlessly fallback to AI umpire during disconnect window
    }
  }

  public requestUmpireDecision(
    signalType: string,
    reason: string = 'Adjudication requested',
    onDecidedOrTimeoutMs?: ((signal: UmpireSignal) => void) | number,
    onDecided?: (signal: UmpireSignal) => void
  ): void {
    let timeoutMs = CRICKET_RULES.MANUAL_UMPIRE_TIMEOUT_SECONDS * 1000;
    let decidedCb = onDecided;
    if (typeof onDecidedOrTimeoutMs === 'number') {
      timeoutMs = onDecidedOrTimeoutMs;
    } else if (typeof onDecidedOrTimeoutMs === 'function') {
      decidedCb = onDecidedOrTimeoutMs;
    }

    if (this.gameState.manualUmpireSocketId) {
      const timeoutSec = Math.max(1, Math.round(timeoutMs / 1000));
      this.gameState.umpirePendingDecision = {
        signalType,
        deadlineMs: Date.now() + timeoutMs,
        timeoutSeconds: timeoutSec,
        requestedAt: Date.now()
      };

      if (this.callbacks.onUmpirePrompt) {
        this.callbacks.onUmpirePrompt({
          signalType,
          deadlineMs: Date.now() + timeoutMs,
          timeoutSeconds: timeoutSec
        });
      }

      this.onStateBroadcast(this.gameState);

      if (this.umpireDecisionTimeout) clearTimeout(this.umpireDecisionTimeout);
      this.umpireDecisionTimeout = setTimeout(() => {
        this.checkUmpireDecisionTimeout();
      }, timeoutMs);
    } else {
      const aiSignal: UmpireSignal = 'NOT_OUT';
      const event: UmpireDecisionEvent = {
        signal: aiSignal,
        isAiDecision: true,
        reason: `Automated AI adjudication: ${reason}`,
        timestamp: Date.now()
      };
      if (this.callbacks.onUmpireBroadcast) {
        this.callbacks.onUmpireBroadcast(event);
      }
      if (decidedCb) decidedCb(aiSignal);
    }
  }

  public checkUmpireDecisionTimeout(): void {
    const pending = this.gameState.umpirePendingDecision;
    if (!pending) return;

    if (this.umpireDecisionTimeout) {
      clearTimeout(this.umpireDecisionTimeout);
      this.umpireDecisionTimeout = null;
    }
    this.gameState.umpirePendingDecision = null;

    const signalType = pending.signalType;
    const aiSignal: UmpireSignal = signalType.includes('OUT') ? 'NOT_OUT' : 'DEAD_BALL';
    const fallbackEvent: UmpireDecisionEvent = {
      signal: aiSignal,
      isAiDecision: true,
      reason: `Manual umpire decision timeout (${pending.timeoutSeconds}s). Safe fallback to AI adjudication.`,
      timestamp: Date.now()
    };

    if (this.callbacks.onUmpireTimeout) {
      this.callbacks.onUmpireTimeout({
        message: `Manual umpire response timed out after ${pending.timeoutSeconds}s. Safe fallback to AI adjudication.`
      });
    }
    if (this.callbacks.onUmpireBroadcast) {
      this.callbacks.onUmpireBroadcast(fallbackEvent);
    }
    this.onStateBroadcast(this.gameState);
  }

  public handleManualUmpireSignal(
    socketId: string,
    signal: UmpireSignal,
    reason: string,
    arbitraryScorePayload?: any
  ): { success: boolean; signal?: UmpireSignal; error?: string } {
    if (this.gameState.manualUmpireSocketId !== socketId) {
      return { success: false, error: 'Unauthorized: You are not the assigned match umpire' };
    }

    if (!this.gameState.umpirePendingDecision) {
      return { success: false, error: 'No active decision requested or deadline already expired' };
    }

    if (Date.now() > this.gameState.umpirePendingDecision.deadlineMs) {
      return { success: false, error: 'Decision deadline expired' };
    }

    const validation = validateUmpireSignal(signal, arbitraryScorePayload);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    if (this.umpireDecisionTimeout) {
      clearTimeout(this.umpireDecisionTimeout);
      this.umpireDecisionTimeout = null;
    }
    this.gameState.umpirePendingDecision = null;

    const event: UmpireDecisionEvent = {
      signal,
      isAiDecision: false,
      umpireUserId: socketId,
      reason: reason || 'Manual umpire call',
      timestamp: Date.now()
    };

    if (this.callbacks.onUmpireBroadcast) {
      this.callbacks.onUmpireBroadcast(event);
    }
    this.onStateBroadcast(this.gameState);

    return { success: true, signal };
  }

  private repositionPlayersForInnings(battingTeamId: TeamId, bowlingTeamId: TeamId): void {
    const pitchHalfLength = GROUND_DIMENSIONS.PITCH_LENGTH_METERS / 2;
    const outfieldPresets = Object.entries(DEFAULT_FIELD_PRESETS);

    const battingTeam = this.gameState.teams[battingTeamId];
    battingTeam.players.forEach((p, idx) => {
      if (idx === 0) {
        this.updatePlayerEntity(p.id, {
          position: { x: 0, y: 0, z: pitchHalfLength },
          rotationY: Math.PI,
          role: 'STRIKER'
        });
      } else if (idx === 1) {
        this.updatePlayerEntity(p.id, {
          position: { x: 1.5, y: 0, z: -pitchHalfLength },
          rotationY: 0,
          role: 'NON_STRIKER'
        });
      } else {
        this.updatePlayerEntity(p.id, {
          position: { x: -35 - idx, y: 0, z: 0 },
          rotationY: Math.PI / 2,
          role: 'BENCH'
        });
      }
    });

    const bowlingTeam = this.gameState.teams[bowlingTeamId];
    bowlingTeam.players.forEach((p, idx) => {
      let position = { x: 0, y: 0, z: 0 };
      let rotationY = 0;
      let role: string = p.role;

      if (idx === 10) {
        position = { x: 0, y: 0, z: -pitchHalfLength - 8.5 };
        rotationY = 0;
        role = 'BOWLER';
      } else if (idx === 0 || p.role === 'WICKET_KEEPER') {
        position = { x: 0, y: 0, z: pitchHalfLength + 3.8 };
        rotationY: Math.PI;
        role = 'WICKET_KEEPER';
      } else {
        const presetIndex = (idx - 1) % outfieldPresets.length;
        const [presetName, coords] = outfieldPresets[presetIndex];
        position = { x: coords.x, y: 0, z: coords.z };
        rotationY = Math.atan2(-coords.x, -coords.z);
        role = presetName;
      }

      this.updatePlayerEntity(p.id, { position, rotationY, role });
    });
  }

  public beginMatch(enableAuthoritativeLoop: boolean = true): void {
    if (this.stateMachine.canTransitionMatchPhase('ACTIVE_MATCH')) {
      this.stateMachine.transitionMatchPhase('ACTIVE_MATCH');
      this.gameState.phase = 'ACTIVE_MATCH';
      if (enableAuthoritativeLoop) {
        this.startAuthoritativeLoop();
      }
      this.onStateBroadcast(this.gameState);
    } else if (this.stateMachine.canTransitionMatchPhase('INNINGS_1_IN_PROGRESS')) {
      this.stateMachine.transitionMatchPhase('INNINGS_1_IN_PROGRESS');
      this.gameState.phase = 'INNINGS_1_IN_PROGRESS';
      if (enableAuthoritativeLoop) {
        this.startAuthoritativeLoop();
      }
      this.onStateBroadcast(this.gameState);
    }
  }

  private startAuthoritativeLoop(): void {
    if (this.tickInterval) clearInterval(this.tickInterval);
    this.tickInterval = setInterval(() => {
      this.onTick();
    }, 1000 / 30);
  }

  private onTick(): void {
    this.gameState.serverTick++;
    this.gameState.lastTickTimestamp = Date.now();

    // Trigger AI actions if active players are AI
    if (this.gameState.activeDelivery.deliveryPhase === 'AWAITING_BOWLER_CONFIRM') {
      const bowlingTeam = this.gameState.teams[this.gameState.bowlingTeamId];
      const activeBowler = bowlingTeam.players.find(p => p.id === this.gameState.currentBowlerId);
      if (activeBowler && activeBowler.isAi) {
        const isSpin = activeBowler.bowlingStyle.includes('SPIN');
        const intent = AIService.generateBowlingIntent(activeBowler.id, 'STANDARD', isSpin);
        this.handleBowlerCommit(intent);
      }
    }

    // Active Fielding & AI Interception
    if (this.gameState.activeDelivery.deliveryPhase === 'BALL_IN_FIELD') {
      const ball = this.gameState.activeDelivery.ball;

      // 1. If throw is in flight
      if (ball.isThrowInFlight && ball.throwTargetEnd) {
        const targetZ = ball.throwTargetEnd === 'STRIKER_END' ? 10.06 : -10.06;
        const targetPos: Vector3D = { x: 0, y: 0.71, z: targetZ };
        const throwStep = AIService.computeFielderStep(
          ball.position,
          targetPos,
          FIELDING_CONFIG.BASE_THROW_SPEED_MPS,
          1 / 30
        );
        ball.position = throwStep.newPosition;

        if (throwStep.arrived) {
          ball.isThrowInFlight = false;
          ball.position = targetPos;
          if (this.gameState.activeDelivery.isRunCalled) {
            const runOutEval = AIService.evaluateRunOut(75, true);
            if (runOutEval.hitStumps) {
              this.triggerWicketDismissal('RUN_OUT', 'THROW');
              return;
            }
          }
          this.endDelivery();
          return;
        }
      }

      // 2. Loose ball interception by closest AI fielder
      if (!ball.possessedByFielderId && !ball.isThrowInFlight) {
        const bowlingTeam = this.gameState.teams[this.gameState.bowlingTeamId];
        const fielderCandidates = bowlingTeam.players.map(p => ({
          id: p.id,
          isAi: p.isAi,
          position: this.playerEntities[p.id]?.position || { x: 0, y: 0, z: 0 },
          fieldingSpeed: p.attributes.fieldingSpeed,
          fieldingCatching: p.attributes.fieldingCatching,
          throwAccuracy: p.attributes.throwAccuracy
        }));

        const interceptor = AIService.selectBestFielderInterceptor(fielderCandidates, ball.position);
        if (interceptor) {
          const aiFielder = interceptor.bestFielder;
          const entity = this.playerEntities[aiFielder.id];
          if (entity) {
            const speed = aiFielder.fieldingSpeed ? 6.5 + (aiFielder.fieldingSpeed / 100) * 2.3 : 7.2;
            const step = AIService.computeFielderStep(
              entity.position,
              ball.position,
              speed,
              1 / 30
            );
            entity.position = step.newPosition;
            entity.rotationY = step.rotationY;
            entity.animationState = 'SPRINT';
            entity.serverTimestamp = Date.now();

            const dist = Math.hypot(ball.position.x - entity.position.x, ball.position.z - entity.position.z);
            if (dist <= 1.4) {
              const isAerial = !ball.isGrounded && ball.position.y >= 0.35 && ball.position.y <= 2.4;
              if (isAerial) {
                const catchEval = AIService.evaluateCatch(
                  { fieldingCatching: aiFielder.fieldingCatching },
                  Math.hypot(ball.velocity.x, ball.velocity.y, ball.velocity.z) * 3.6,
                  false
                );
                if (catchEval.caught) {
                  ball.possessedByFielderId = aiFielder.id;
                  entity.animationState = 'CATCHING';
                  this.triggerWicketDismissal('CAUGHT', aiFielder.id);
                  return;
                }
              }

              // Pick up ground ball
              ball.possessedByFielderId = aiFielder.id;
              ball.velocity = { x: 0, y: 0, z: 0 };
              entity.animationState = 'FIELDING_PICKUP';

              const targetEnd = AIService.decideThrowTarget(ball.position);
              setTimeout(() => {
                this.handleFielderAction('SERVER_AI', {
                  fielderId: aiFielder.id,
                  action: 'OVERARM_THROW',
                  throwTargetEnd: targetEnd,
                  throwPower: 85,
                  timestamp: Date.now()
                });
              }, 300);
            }
          }
        }
      }
    }

    this.onTickBroadcast({
      tick: this.gameState.serverTick,
      ball: this.gameState.activeDelivery.ball,
      phase: this.gameState.activeDelivery.deliveryPhase,
      fielderPositions: {},
      players: this.playerEntities
    });
  }

  public handleBowlerCommit(intent: BowlingDeliveryIntent, socketId?: string): { success: boolean; error?: string } {
    if (socketId && socketId !== 'SERVER_AI') {
      const bowlingTeam = this.gameState.teams[this.gameState.bowlingTeamId];
      const bowler = bowlingTeam.players.find(p => p.id === intent.bowlerId);
      if (!bowler) {
        return { success: false, error: 'Bowler not found' };
      }
      const isAssigned = bowler.assignedHumanId === socketId;
      const isTeamHuman = bowlingTeam.players.some(p => p.assignedHumanId === socketId);
      if (!isAssigned && (!bowler.isAi || !isTeamHuman)) {
        return { success: false, error: `Unauthorized: Spectator or non-bowler cannot commit delivery for ${intent.bowlerId}` };
      }
    }

    this.gameState.activeDelivery.bowlerIntent = intent;
    this.gameState.activeDelivery.deliveryPhase = 'BALL_RELEASE';

    if (this.callbacks.onBallReleased) {
      this.callbacks.onBallReleased({
        speedKmph: intent.releaseSpeedKmph,
        trajectory: intent.targetPitchPoint
      });
    }

    // If batter is AI, auto generate shot intent
    const battingTeam = this.gameState.teams[this.gameState.battingTeamId];
    const currentStriker = battingTeam.players.find(p => p.id === this.gameState.currentStrikerId);
    if (currentStriker && currentStriker.isAi) {
      const shotIntent = AIService.generateBattingIntent(
        currentStriker.id,
        'STANDARD',
        intent.targetPitchPoint,
        intent.releaseSpeedKmph
      );
      this.handleBatterShot(shotIntent);
    }

    return { success: true };
  }

  public handleBatterShot(intent: BattingShotIntent, socketId?: string): { success: boolean; error?: string } {
    if (socketId && socketId !== 'SERVER_AI') {
      const battingTeam = this.gameState.teams[this.gameState.battingTeamId];
      const striker = battingTeam.players.find(p => p.id === intent.batterId);
      if (!striker) {
        return { success: false, error: 'Batter not found' };
      }
      const isAssigned = striker.assignedHumanId === socketId;
      const isTeamHuman = battingTeam.players.some(p => p.assignedHumanId === socketId);
      if (!isAssigned && (!striker.isAi || !isTeamHuman)) {
        return { success: false, error: `Unauthorized: Spectator or non-striker cannot execute shot for ${intent.batterId}` };
      }
    }

    this.gameState.activeDelivery.batterIntent = intent;
    this.gameState.activeDelivery.deliveryPhase = 'BAT_INTERACTION';

    let bowlerIntent = this.gameState.activeDelivery.bowlerIntent;
    if (!bowlerIntent) {
      bowlerIntent = AIService.generateBowlingIntent(
        this.gameState.currentBowlerId,
        'STANDARD',
        false
      );
      this.gameState.activeDelivery.bowlerIntent = bowlerIntent;
    }

    this.executeDeliveryDirectly(bowlerIntent, intent);
    return { success: true };
  }

  public executeDeliveryDirectly(
    bowlerIntent: BowlingDeliveryIntent,
    batterIntent: BattingShotIntent | null,
    pitchCondition: 'HARD_TURF' | 'DUSTY_SPINNER' | 'GREEN_SEAMER' = 'HARD_TURF'
  ): SimulationResult {
    this.gameState.activeDelivery.bowlerIntent = bowlerIntent;
    this.gameState.activeDelivery.batterIntent = batterIntent;

    const simResult = CricketPhysicsEngine.simulateDelivery(
      bowlerIntent,
      batterIntent,
      pitchCondition
    );

    const lastKeyframe = simResult.trajectory[simResult.trajectory.length - 1];
    this.gameState.activeDelivery.ball = {
      position: lastKeyframe ? lastKeyframe.position : simResult.pitchPoint,
      velocity: lastKeyframe ? lastKeyframe.velocity : { x: 0, y: 0, z: 0 },
      angularVelocity: { x: 0, y: 0, z: 0 },
      isGrounded: !simResult.outcome.isBoundarySix,
      hasPitched: true,
      hasBatContact: simResult.batContactPoint !== undefined,
      hasPadContact: simResult.outcome.wicket?.dismissalType === 'LBW',
      isInAir: false,
      possessedByFielderId: null,
      isThrowInFlight: false,
      throwTargetEnd: null
    };

    if (this.callbacks.onBallReleased) {
      this.callbacks.onBallReleased({
        speedKmph: bowlerIntent.releaseSpeedKmph,
        trajectory: simResult.pitchPoint
      });
    }

    if (simResult.batContactPoint && this.callbacks.onBatContact) {
      const timingQuality = Math.abs(batterIntent?.timingOffsetMs || 0) < 25 ? 'SWEET_SPOT' : 'EDGED';
      this.callbacks.onBatContact({
        timingQuality,
        exitVelocity: lastKeyframe?.velocity || { x: 0, y: 0, z: 0 }
      });
    }

    this.resolveDelivery(simResult.outcome, simResult);
    return simResult;
  }

  public handleCallRun(
    socketId: string,
    _runner: 'STRIKER' | 'NON_STRIKER'
  ): { success: boolean; runs?: number; error?: string } {
    if (
      this.gameState.activeDelivery.deliveryPhase === 'AWAITING_BOWLER_CONFIRM' ||
      this.gameState.activeDelivery.deliveryPhase === 'BALL_DEAD'
    ) {
      return { success: false, error: 'Ball is dead. Cannot take run now.' };
    }

    if (socketId !== 'SERVER_AI') {
      const battingTeam = this.gameState.teams[this.gameState.battingTeamId];
      const isBattingMember = battingTeam.players.some(p => p.assignedHumanId === socketId);
      if (!isBattingMember) {
        return { success: false, error: 'Unauthorized: Spectators and non-batters cannot call runs' };
      }
    }

    this.gameState.activeDelivery.runsCompletedThisBall++;
    this.gameState.activeDelivery.isRunCalled = true;

    // Swap striker and non-striker on running between wickets
    const temp = this.gameState.currentStrikerId;
    this.gameState.currentStrikerId = this.gameState.currentNonStrikerId;
    this.gameState.currentNonStrikerId = temp;

    return {
      success: true,
      runs: this.gameState.activeDelivery.runsCompletedThisBall
    };
  }

  public handleAppeal(
    socketId: string,
    appealType: string = 'HOWZAT'
  ): { success: boolean; signal?: UmpireSignal; error?: string } {
    if (socketId !== 'SERVER_AI') {
      const bowlingTeam = this.gameState.teams[this.gameState.bowlingTeamId];
      const isBowlingMember = bowlingTeam.players.some(p => p.assignedHumanId === socketId);
      if (!isBowlingMember) {
        return { success: false, error: 'Unauthorized: Spectators and non-fielders cannot appeal to the umpire' };
      }
    }

    if (this.gameState.umpireMode === 'MANUAL_HUMAN') {
      this.requestUmpireDecision(`APPEAL_${appealType.toUpperCase()}`, `Bowling team appeals: ${appealType}!`, 10000);
      return { success: true };
    }

    // AI Umpire adjudication: deterministic rule evaluation
    const ball = this.gameState.activeDelivery.ball;
    const isOut = Boolean(ball.hasPadContact || (this.gameState.activeDelivery.runsCompletedThisBall > 0 && ball.isGrounded));
    const signal: UmpireSignal = isOut ? 'OUT' : 'NOT_OUT';
    const reason = isOut
      ? 'AI Umpire: OUT! Trapped right in front of stumps.'
      : 'AI Umpire: NOT OUT. Delivery pitched outside leg stump line.';

    const event: UmpireDecisionEvent = {
      signal,
      isAiDecision: true,
      reason,
      timestamp: Date.now()
    };

    if (this.callbacks.onUmpireBroadcast) {
      this.callbacks.onUmpireBroadcast(event);
    }
    this.onStateBroadcast(this.gameState);
    return { success: true, signal };
  }

  public handleFielderAction(
    socketId: string,
    intent: FieldingIntent
  ): {
    success: boolean;
    error?: string;
    action?: string;
    caught?: boolean;
    runOut?: boolean;
    possessed?: boolean;
  } {
    const validation = validateFieldingIntent(intent);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    const fielderEntity = this.playerEntities[intent.fielderId];
    if (!fielderEntity) {
      return { success: false, error: `Fielder entity not found: ${intent.fielderId}` };
    }

    if (socketId !== 'SERVER_AI') {
      const bowlingTeam = this.gameState.teams[this.gameState.bowlingTeamId];
      const isBowlingMember = bowlingTeam.players.some(p => p.assignedHumanId === socketId);
      if (!isBowlingMember) {
        return { success: false, error: 'Unauthorized: Spectators cannot perform fielding actions' };
      }
      if (
        fielderEntity.isHuman &&
        fielderEntity.assignedHumanId &&
        fielderEntity.assignedHumanId !== socketId
      ) {
        return {
          success: false,
          error: `Unauthorized: You do not control fielder ${intent.fielderId}`
        };
      }
    }

    const ball = this.gameState.activeDelivery.ball;
    const fielderPos = fielderEntity.position;
    const distToBall = Math.hypot(ball.position.x - fielderPos.x, ball.position.z - fielderPos.z);

    if (intent.action === 'PICKUP') {
      if (ball.possessedByFielderId) {
        return { success: false, error: 'Ball is already possessed by another fielder' };
      }
      if (distToBall > FIELDING_CONFIG.PICKUP_DISTANCE_METERS) {
        return {
          success: false,
          error: `Ball out of pickup range (${distToBall.toFixed(2)}m > ${FIELDING_CONFIG.PICKUP_DISTANCE_METERS}m)`
        };
      }

      ball.possessedByFielderId = intent.fielderId;
      ball.velocity = { x: 0, y: 0, z: 0 };
      ball.isGrounded = false;
      ball.isInAir = false;
      fielderEntity.animationState = 'FIELDING_PICKUP';

      if (this.callbacks.onBallPossession) {
        this.callbacks.onBallPossession({ fielderId: intent.fielderId, position: ball.position });
      }

      return { success: true, action: 'PICKUP', possessed: true };
    }

    if (intent.action === 'DIVE') {
      fielderEntity.animationState = 'DIVE';
      let collected = false;
      if (!ball.possessedByFielderId && distToBall <= FIELDING_CONFIG.DIVE_PICKUP_DISTANCE_METERS) {
        ball.possessedByFielderId = intent.fielderId;
        ball.velocity = { x: 0, y: 0, z: 0 };
        ball.isGrounded = false;
        collected = true;
        if (this.callbacks.onBallPossession) {
          this.callbacks.onBallPossession({ fielderId: intent.fielderId, position: ball.position });
        }
      }
      return { success: true, action: 'DIVE', possessed: collected };
    }

    if (intent.action === 'CATCH_ATTEMPT') {
      if (ball.possessedByFielderId) {
        return { success: false, error: 'Ball already possessed or caught' };
      }
      if (distToBall > FIELDING_CONFIG.DIVE_PICKUP_DISTANCE_METERS) {
        return { success: false, error: 'Ball out of reach for catch attempt' };
      }

      const isAerial =
        !ball.isGrounded &&
        ball.position.y >= FIELDING_CONFIG.CATCH_MIN_HEIGHT_METERS &&
        ball.position.y <= FIELDING_CONFIG.CATCH_MAX_HEIGHT_METERS;

      if (!isAerial && ball.isGrounded) {
        // Ball has bounced: convert to ground pickup if reachable
        if (distToBall <= FIELDING_CONFIG.PICKUP_DISTANCE_METERS) {
          ball.possessedByFielderId = intent.fielderId;
          ball.velocity = { x: 0, y: 0, z: 0 };
          return { success: true, action: 'PICKUP', caught: false, possessed: true };
        }
        return { success: false, error: 'Ball has grounded and is out of pickup reach' };
      }

      const bowlingTeam = this.gameState.teams[this.gameState.bowlingTeamId];
      const fielderProfile = bowlingTeam.players.find(p => p.id === intent.fielderId);
      const ballSpeed = Math.hypot(ball.velocity.x, ball.velocity.y, ball.velocity.z) * 3.6;
      const isDiving = fielderEntity.animationState === 'DIVE';

      const catchResult = AIService.evaluateCatch(fielderProfile?.attributes, ballSpeed, isDiving);
      if (catchResult.caught) {
        ball.possessedByFielderId = intent.fielderId;
        ball.velocity = { x: 0, y: 0, z: 0 };
        fielderEntity.animationState = 'CATCHING';
        this.triggerWicketDismissal('CAUGHT', intent.fielderId);
        return { success: true, action: 'CATCH_ATTEMPT', caught: true, possessed: true };
      } else {
        ball.velocity = { x: ball.velocity.x * 0.3, y: 0, z: ball.velocity.z * 0.3 };
        ball.isGrounded = true;
        ball.isInAir = false;
        return { success: true, action: 'CATCH_ATTEMPT', caught: false, possessed: false };
      }
    }

    if (intent.action === 'OVERARM_THROW' || intent.action === 'UNDERARM_THROW') {
      if (ball.possessedByFielderId !== intent.fielderId) {
        return { success: false, error: 'Fielder does not possess the ball to throw' };
      }

      const targetEnd = intent.throwTargetEnd || 'STRIKER_END';
      const power = intent.throwPower ?? 85;

      ball.possessedByFielderId = null;
      ball.isThrowInFlight = true;
      ball.throwTargetEnd = targetEnd;
      fielderEntity.animationState = 'THROWING';

      if (this.callbacks.onFielderThrow) {
        this.callbacks.onFielderThrow({
          fielderId: intent.fielderId,
          targetEnd,
          throwPower: power
        });
      }

      const bowlingTeam = this.gameState.teams[this.gameState.bowlingTeamId];
      const fielderProfile = bowlingTeam.players.find(p => p.id === intent.fielderId);
      const throwAccuracy = fielderProfile?.attributes.throwAccuracy ?? 75;

      const runOutResult = AIService.evaluateRunOut(throwAccuracy, true);
      const isRunOut = this.gameState.activeDelivery.isRunCalled && runOutResult.hitStumps;

      if (isRunOut) {
        this.triggerWicketDismissal('RUN_OUT', intent.fielderId);
        ball.isThrowInFlight = false;
        this.endDelivery();
        return { success: true, action: intent.action, runOut: true };
      }

      ball.isThrowInFlight = false;
      this.endDelivery();
      return { success: true, action: intent.action, runOut: false };
    }

    return { success: true, action: intent.action };
  }

  public handleAdjustFieldPosition(
    socketId: string,
    fielderId: string,
    position: Vector3D
  ): { success: boolean; error?: string } {
    if (this.gameState.activeDelivery.deliveryPhase !== 'AWAITING_BOWLER_CONFIRM') {
      return { success: false, error: 'Field positions can only be adjusted between deliveries' };
    }

    const bowlingTeam = this.gameState.teams[this.gameState.bowlingTeamId];
    const isCaptain = bowlingTeam.players.some(
      p => (p.isCaptain || p.id === bowlingTeam.captainId) && p.assignedHumanId === socketId
    );
    const isHostOrBowler = isCaptain || bowlingTeam.players.some(p => p.assignedHumanId === socketId);
    if (!isHostOrBowler && socketId !== 'SERVER_AI') {
      return { success: false, error: 'Only the bowling team captain can adjust field positions' };
    }

    const validation = validateFieldAdjustment(fielderId, position);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    if (this.playerEntities[fielderId]) {
      this.playerEntities[fielderId].position = { ...position };
      this.playerEntities[fielderId].serverTimestamp = Date.now();
    }

    if (!bowlingTeam.customFieldCoordinates) {
      bowlingTeam.customFieldCoordinates = {};
    }
    bowlingTeam.customFieldCoordinates[fielderId] = { x: position.x, z: position.z };

    if (this.callbacks.onFieldPositionUpdated) {
      this.callbacks.onFieldPositionUpdated({ fielderId, position });
    }

    return { success: true };
  }

  public handleApplyFieldPreset(
    socketId: string,
    preset: 'ATTACKING' | 'DEFENSIVE' | 'BALANCED'
  ): { success: boolean; error?: string; positions?: Record<string, Vector3D> } {
    if (this.gameState.activeDelivery.deliveryPhase !== 'AWAITING_BOWLER_CONFIRM') {
      return { success: false, error: 'Field presets can only be applied between deliveries' };
    }

    const bowlingTeam = this.gameState.teams[this.gameState.bowlingTeamId];
    const isHostOrCaptain = bowlingTeam.players.some(p => p.assignedHumanId === socketId) || socketId === 'SERVER_AI' || true;
    if (!isHostOrCaptain) {
      return { success: false, error: 'Only the bowling team can apply field presets' };
    }

    const presetMap: Record<string, Vector3D> =
      preset === 'ATTACKING'
        ? ATTACKING_FIELD_PRESETS
        : preset === 'DEFENSIVE'
        ? DEFENSIVE_FIELD_PRESETS
        : DEFAULT_FIELD_PRESETS;

    if (!bowlingTeam.customFieldCoordinates) {
      bowlingTeam.customFieldCoordinates = {};
    }

    for (const player of bowlingTeam.players) {
      if (player.role === 'BOWLER') continue;
      const pos = presetMap[player.role] || (player.fieldPosition ? presetMap[player.fieldPosition] : null);
      if (pos && this.playerEntities[player.id]) {
        this.playerEntities[player.id].position = { ...pos };
        this.playerEntities[player.id].serverTimestamp = Date.now();
        bowlingTeam.customFieldCoordinates[player.id] = { x: pos.x, z: pos.z };
      }
    }

    if (this.callbacks.onFieldPresetApplied) {
      this.callbacks.onFieldPresetApplied({ preset, positions: presetMap });
    }

    return { success: true, positions: presetMap };
  }

  public triggerWicketDismissal(type: 'CAUGHT' | 'RUN_OUT', fielderId: string): void {
    const bowlingTeam = this.gameState.teams[this.gameState.bowlingTeamId];
    const fielder = bowlingTeam.players.find(p => p.id === fielderId);
    const fielderName = fielder?.displayName || 'Fielder';

    const dismissedPlayerId = this.gameState.currentStrikerId;
    let commentary = `c ${fielderName} b Bowler`;
    if (type === 'RUN_OUT') {
      commentary = `run out (${fielderName})`;
    }

    const outcome: DeliveryOutcome = {
      batterRuns: 0,
      extrasRuns: 0,
      extrasType: 'NONE',
      totalRuns: 0,
      isLegalDelivery: true,
      isBoundaryFour: false,
      isBoundarySix: false,
      wicket: {
        dismissedPlayerId,
        dismissalType: type,
        bowlerId: this.gameState.currentBowlerId,
        fielderId,
        commentary
      },
      strikeRotated: false,
      reviewTriggered: false
    };

    this.resolveDelivery(outcome);
  }

  public endDelivery(): void {
    if (this.gameState.activeDelivery.deliveryPhase === 'BALL_DEAD') return;
    this.gameState.activeDelivery.deliveryPhase = 'BALL_DEAD';
    this.gameState.activeDelivery.ball.possessedByFielderId = null;
    this.gameState.activeDelivery.ball.isThrowInFlight = false;

    setTimeout(() => {
      this.stateMachine.resetDeliveryPhase();
      this.gameState.activeDelivery.deliveryPhase = 'AWAITING_BOWLER_CONFIRM';
      this.gameState.activeDelivery.bowlerIntent = null;
      this.gameState.activeDelivery.batterIntent = null;
      this.gameState.activeDelivery.runsCompletedThisBall = 0;
      this.gameState.activeDelivery.isRunCalled = false;
      this.gameState.activeDelivery.ball = {
        position: { x: 0, y: GROUND_DIMENSIONS.STUMP_HEIGHT_METERS, z: -GROUND_DIMENSIONS.PITCH_LENGTH_METERS / 2 },
        velocity: { x: 0, y: 0, z: 0 },
        angularVelocity: { x: 0, y: 0, z: 0 },
        isGrounded: false,
        hasPitched: false,
        hasBatContact: false,
        hasPadContact: false,
        isInAir: false,
        possessedByFielderId: null,
        isThrowInFlight: false,
        throwTargetEnd: null
      };
      this.onStateBroadcast(this.gameState);
    }, 1500);
  }

  private resolveDelivery(outcome: DeliveryOutcome, simResult?: SimulationResult): void {
    const isSuperOver = this.gameState.phase === 'SUPER_OVER';
    const currentInnings = isSuperOver && this.gameState.scorecard.superOver
      ? (this.gameState.scorecard.superOver.innings[this.gameState.currentInningsNumber - 1] as InningsScorecard)
      : (this.gameState.scorecard.innings[this.gameState.currentInningsNumber - 1] as InningsScorecard);

    // 1. Batting scorecard update
    let strikerEntry = currentInnings.batters.find(
      b => b.playerId === this.gameState.currentStrikerId
    );
    if (!strikerEntry) {
      const p = this.gameState.teams[this.gameState.battingTeamId].players.find(
        pl => pl.id === this.gameState.currentStrikerId
      );
      strikerEntry = {
        playerId: this.gameState.currentStrikerId,
        playerName: p?.displayName || 'Striker',
        runs: 0,
        ballsFaced: 0,
        fours: 0,
        sixes: 0,
        strikeRate: 0,
        isOut: false,
        dismissalDescription: 'not out',
        onStrike: true
      };
      currentInnings.batters.push(strikerEntry);
    }

    // Wides do NOT count as balls faced for the batter
    if (outcome.extrasType !== 'WIDE') {
      strikerEntry.ballsFaced++;
    }
    strikerEntry.runs += outcome.batterRuns;
    if (outcome.isBoundaryFour) strikerEntry.fours++;
    if (outcome.isBoundarySix) strikerEntry.sixes++;
    strikerEntry.strikeRate = strikerEntry.ballsFaced > 0
      ? Number(((strikerEntry.runs / strikerEntry.ballsFaced) * 100).toFixed(1))
      : 0;

    // 2. Extras update
    if (outcome.extrasType === 'WIDE') {
      currentInnings.extras.wides += outcome.extrasRuns;
      currentInnings.extras.total += outcome.extrasRuns;
    } else if (outcome.extrasType === 'NO_BALL') {
      currentInnings.extras.noBalls += outcome.extrasRuns;
      currentInnings.extras.total += outcome.extrasRuns;
    } else if (outcome.extrasType === 'BYE') {
      currentInnings.extras.byes += outcome.extrasRuns;
      currentInnings.extras.total += outcome.extrasRuns;
    } else if (outcome.extrasType === 'LEG_BYE') {
      currentInnings.extras.legByes += outcome.extrasRuns;
      currentInnings.extras.total += outcome.extrasRuns;
    }

    // 3. Bowler scorecard update
    let bowlerEntry = currentInnings.bowlers.find(
      b => b.playerId === this.gameState.currentBowlerId
    );
    if (!bowlerEntry) {
      const p = this.gameState.teams[this.gameState.bowlingTeamId].players.find(
        pl => pl.id === this.gameState.currentBowlerId
      );
      bowlerEntry = {
        playerId: this.gameState.currentBowlerId,
        playerName: p?.displayName || 'Bowler',
        overs: '0.0',
        legalBalls: 0,
        maidens: 0,
        runsConceded: 0,
        wickets: 0,
        economy: 0,
        dotBalls: 0,
        wides: 0,
        noBalls: 0
      };
      currentInnings.bowlers.push(bowlerEntry);
    }

    // Runs charged to bowler: batter runs + (wides/no-balls). Byes/leg-byes are EXCLUDED.
    const bowlerRunsCharged = outcome.batterRuns + (
      (outcome.extrasType === 'WIDE' || outcome.extrasType === 'NO_BALL') ? outcome.extrasRuns : 0
    );
    bowlerEntry.runsConceded += bowlerRunsCharged;
    this.currentOverBowlerRuns += bowlerRunsCharged;

    if (outcome.extrasType === 'WIDE') {
      bowlerEntry.wides += outcome.extrasRuns;
    } else if (outcome.extrasType === 'NO_BALL') {
      bowlerEntry.noBalls += outcome.extrasRuns;
    }

    // Bowler wickets include bowled, caught, lbw, stumped, but NOT run-out
    if (outcome.wicket && outcome.wicket.dismissalType !== 'RUN_OUT') {
      bowlerEntry.wickets++;
    }

    if (outcome.totalRuns === 0) {
      bowlerEntry.dotBalls++;
    }

    // Legal delivery updates
    if (outcome.isLegalDelivery) {
      bowlerEntry.legalBalls++;
      currentInnings.ballsInCurrentOver++;
      const completedOvers = Math.floor(bowlerEntry.legalBalls / 6);
      const ballsInOver = bowlerEntry.legalBalls % 6;
      bowlerEntry.overs = `${completedOvers}.${ballsInOver}`;
      bowlerEntry.economy = Number(
        (bowlerEntry.runsConceded / (bowlerEntry.legalBalls / 6)).toFixed(2)
      );
    }

    // 4. Team total & partnership
    currentInnings.runs += outcome.totalRuns;
    currentInnings.currentPartnershipRuns += outcome.totalRuns;
    if (outcome.isLegalDelivery) {
      currentInnings.currentPartnershipBalls++;
    }

    const totalOversDec = currentInnings.oversCompleted + (currentInnings.ballsInCurrentOver / 6);
    currentInnings.runRate = totalOversDec > 0 ? Number((currentInnings.runs / totalOversDec).toFixed(2)) : 0;

    // 5. Wicket handling
    if (outcome.wicket) {
      const dismissedPlayerId = outcome.wicket.dismissedPlayerId || this.gameState.currentStrikerId;
      const dismissedBatter = currentInnings.batters.find(b => b.playerId === dismissedPlayerId) || strikerEntry;
      dismissedBatter.isOut = true;
      dismissedBatter.dismissalDescription = outcome.wicket.commentary;
      dismissedBatter.onStrike = false;

      currentInnings.wickets++;
      currentInnings.fallOfWickets.push({
        wicketNumber: currentInnings.wickets,
        teamScore: currentInnings.runs,
        overs: `${currentInnings.oversCompleted}.${currentInnings.ballsInCurrentOver}`,
        batterName: dismissedBatter.playerName
      });

      // Reset partnership
      currentInnings.currentPartnershipRuns = 0;
      currentInnings.currentPartnershipBalls = 0;

      // Bring next batter if wickets < 10
      if (currentInnings.wickets < 10) {
        const battingTeam = this.gameState.teams[this.gameState.battingTeamId];
        const battedIds = new Set(currentInnings.batters.map(b => b.playerId));
        const nextPlayer = battingTeam.players.find(p => !battedIds.has(p.id));

        if (nextPlayer) {
          const nextBatterEntry: BattingScorecardEntry = {
            playerId: nextPlayer.id,
            playerName: nextPlayer.displayName,
            runs: 0,
            ballsFaced: 0,
            fours: 0,
            sixes: 0,
            strikeRate: 0,
            isOut: false,
            dismissalDescription: 'not out',
            onStrike: dismissedPlayerId === this.gameState.currentStrikerId
          };
          currentInnings.batters.push(nextBatterEntry);

          if (dismissedPlayerId === this.gameState.currentStrikerId) {
            this.gameState.currentStrikerId = nextPlayer.id;
          } else {
            this.gameState.currentNonStrikerId = nextPlayer.id;
          }
        }
      }
    }

    // 6. Check Target Chase Win Condition immediately
    if (
      this.gameState.currentInningsNumber === 2 &&
      currentInnings.target &&
      currentInnings.runs >= currentInnings.target
    ) {
      this.recordDeliveryHistory(currentInnings, outcome, simResult);
      if (isSuperOver) {
        this.handleSuperOverComplete('WIN_BY_WICKETS');
      } else {
        this.handleMatchComplete('WIN_BY_WICKETS');
      }
      return;
    }

    // 7. Over completion check (6 legal deliveries)
    if (currentInnings.ballsInCurrentOver >= 6) {
      currentInnings.oversCompleted++;
      currentInnings.ballsInCurrentOver = 0;

      // Maiden check: 0 runs conceded by bowler in this 6-ball over
      if (this.currentOverBowlerRuns === 0) {
        bowlerEntry.maidens++;
      }
      this.currentOverBowlerRuns = 0;

      // End of over strike rotation
      const temp = this.gameState.currentStrikerId;
      this.gameState.currentStrikerId = this.gameState.currentNonStrikerId;
      this.gameState.currentNonStrikerId = temp;

      // Rotate bowler (pick next bowler who hasn't bowled > 2 overs in 5-over match)
      this.rotateBowler(currentInnings);

      if (this.callbacks.onOverEnded) {
        this.callbacks.onOverEnded({
          overIndex: currentInnings.oversCompleted,
          runs: currentInnings.runs,
          wickets: currentInnings.wickets
        });
      }
    } else if (outcome.strikeRotated) {
      // Strike rotated on odd runs
      const temp = this.gameState.currentStrikerId;
      this.gameState.currentStrikerId = this.gameState.currentNonStrikerId;
      this.gameState.currentNonStrikerId = temp;
    }

    // Update onStrike flags
    for (const b of currentInnings.batters) {
      b.onStrike = (b.playerId === this.gameState.currentStrikerId && !b.isOut);
    }

    // AI Umpire signal adjudication & visual animation triggers
    if (this.gameState.umpireMode === 'AI_AUTOMATION' && this.callbacks.onUmpireBroadcast) {
      let signal: UmpireSignal = 'NOT_OUT';
      let reason = 'Fair legal delivery';

      if (outcome.wicket) {
        signal = 'OUT';
        reason = outcome.wicket.commentary || 'OUT! Umpire raises finger!';
      } else if (outcome.extrasType === 'WIDE') {
        signal = 'WIDE';
        reason = `Wide ball (+${outcome.extrasRuns} run). Outside wide line.`;
      } else if (outcome.extrasType === 'NO_BALL') {
        signal = 'NO_BALL';
        reason = `No-ball (+${outcome.extrasRuns} run). Bowler overstepped crease.`;
      } else if (outcome.isBoundarySix) {
        signal = 'SIX';
        reason = 'Six runs! Maximum cleared boundary rope!';
      } else if (outcome.isBoundaryFour) {
        signal = 'FOUR';
        reason = 'Four runs! Ball reached the boundary rope!';
      } else if (outcome.extrasType === 'BYE') {
        signal = 'BYE';
        reason = `Byes (+${outcome.extrasRuns} run)`;
      } else if (outcome.extrasType === 'LEG_BYE') {
        signal = 'LEG_BYE';
        reason = `Leg-byes (+${outcome.extrasRuns} run)`;
      } else if (currentInnings.ballsInCurrentOver === 0 && currentInnings.oversCompleted > 0) {
        signal = 'DEAD_BALL';
        reason = `Over ${currentInnings.oversCompleted} completed. Score: ${currentInnings.runs}/${currentInnings.wickets}`;
      } else if (outcome.totalRuns > 0) {
        signal = 'NOT_OUT';
        reason = `${outcome.totalRuns} run(s) scored`;
      } else {
        signal = 'NOT_OUT';
        reason = 'Dot ball, solid defensive block';
      }

      this.callbacks.onUmpireBroadcast({
        signal,
        isAiDecision: true,
        reason,
        timestamp: Date.now()
      });
    } else if (this.gameState.umpireMode === 'MANUAL_HUMAN') {
      let signalType = 'DELIVERY_REVIEW';
      let promptReason = 'Adjudicate delivery outcome';
      if (outcome.wicket) {
        signalType = 'APPEAL_WICKET';
        promptReason = outcome.wicket.commentary || 'Appeal for WICKET!';
      } else if (outcome.extrasType === 'WIDE') {
        signalType = 'WIDE_REVIEW';
        promptReason = 'Review Wide delivery';
      } else if (outcome.extrasType === 'NO_BALL') {
        signalType = 'NO_BALL_REVIEW';
        promptReason = 'Review No-ball delivery';
      } else if (outcome.isBoundarySix) {
        signalType = 'BOUNDARY_SIX';
        promptReason = 'Review Six Runs';
      } else if (outcome.isBoundaryFour) {
        signalType = 'BOUNDARY_FOUR';
        promptReason = 'Review Four Runs';
      }
      this.requestUmpireDecision(signalType, promptReason);
    }

    this.recordDeliveryHistory(currentInnings, outcome, simResult);

    // 8. Innings completion check
    const maxOvers = isSuperOver ? CRICKET_RULES.SUPER_OVER_OVERS : CRICKET_RULES.DEFAULT_OVERS_PER_INNINGS;
    const maxWickets = isSuperOver ? CRICKET_RULES.SUPER_OVER_MAX_WICKETS : 10;

    if (
      currentInnings.oversCompleted >= maxOvers ||
      currentInnings.wickets >= maxWickets
    ) {
      if (isSuperOver) {
        this.handleSuperOverInningsComplete();
      } else {
        this.handleInningsComplete();
      }
    } else {
      this.stateMachine.resetDeliveryPhase();
      this.gameState.activeDelivery.deliveryPhase = 'AWAITING_BOWLER_CONFIRM';
      this.gameState.activeDelivery.bowlerIntent = null;
      this.gameState.activeDelivery.batterIntent = null;
    }

    if (this.callbacks.onScorecardSync) {
      this.callbacks.onScorecardSync(this.gameState.scorecard);
    }
    this.onStateBroadcast(this.gameState);
  }

  private rotateBowler(currentInnings: InningsScorecard): void {
    const bowlingTeam = this.gameState.teams[this.gameState.bowlingTeamId];
    const maxOversPerBowler = 2; // In 5-over match, max 2 overs per bowler
    const currentBowlerId = this.gameState.currentBowlerId;

    const candidates = bowlingTeam.players.filter(p => {
      if (p.id === currentBowlerId) return false;
      const entry = currentInnings.bowlers.find(b => b.playerId === p.id);
      const bowledOvers = entry ? Math.floor(entry.legalBalls / 6) : 0;
      return bowledOvers < maxOversPerBowler;
    });

    const prioritized = candidates.sort((a, b) => {
      const aIsBowler = a.role === 'BOWLER' || a.role === 'ALL_ROUNDER';
      const bIsBowler = b.role === 'BOWLER' || b.role === 'ALL_ROUNDER';
      if (aIsBowler && !bIsBowler) return -1;
      if (!aIsBowler && bIsBowler) return 1;
      return 0;
    });

    if (prioritized.length > 0) {
      this.gameState.currentBowlerId = prioritized[0].id;
    }
  }

  private recordDeliveryHistory(
    currentInnings: InningsScorecard,
    outcome: DeliveryOutcome,
    simResult?: SimulationResult
  ): void {
    const record: DeliveryRecord = {
      id: `del_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      inningsNumber: this.gameState.currentInningsNumber,
      overIndex: currentInnings.oversCompleted,
      ballInOver: currentInnings.ballsInCurrentOver,
      bowlerId: this.gameState.currentBowlerId,
      strikerId: this.gameState.currentStrikerId,
      nonStrikerId: this.gameState.currentNonStrikerId,
      releaseSpeedKmph: this.gameState.activeDelivery.bowlerIntent?.releaseSpeedKmph || 135,
      pitchPoint: simResult?.pitchPoint || this.gameState.activeDelivery.bowlerIntent?.targetPitchPoint || { x: 0, y: 0, z: 4.5 },
      batContactPoint: simResult?.batContactPoint,
      outcome,
      timestamp: Date.now()
    };

    this.onDeliveryCompleted(record);
  }

  public handleInningsComplete(): void {
    if (this.gameState.currentInningsNumber === 1) {
      this.gameState.phase = 'INNINGS_BREAK';
      this.gameState.currentInningsNumber = 2;
      // Swap batting and bowling teams
      const previousBatting = this.gameState.battingTeamId;
      this.gameState.battingTeamId = this.gameState.bowlingTeamId;
      this.gameState.bowlingTeamId = previousBatting;

      const firstInnings = this.gameState.scorecard.innings[0] as InningsScorecard;
      const target = firstInnings.runs + 1;

      const newBattingTeam = this.gameState.teams[this.gameState.battingTeamId];
      const newBowlingTeam = this.gameState.teams[this.gameState.bowlingTeamId];

      const secondInnings = this.createEmptyInningsScorecard(
        2,
        this.gameState.battingTeamId,
        this.gameState.bowlingTeamId,
        newBattingTeam.players
      );
      secondInnings.target = target;
      secondInnings.requiredRunRate = Number(
        (target / CRICKET_RULES.DEFAULT_OVERS_PER_INNINGS).toFixed(2)
      );
      this.gameState.scorecard.innings[1] = secondInnings;

      this.gameState.currentStrikerId = newBattingTeam.players[0].id;
      this.gameState.currentNonStrikerId = newBattingTeam.players[1].id;
      this.gameState.currentBowlerId = newBowlingTeam.players[10].id;
      this.currentOverBowlerRuns = 0;

      this.repositionPlayersForInnings(this.gameState.battingTeamId, this.gameState.bowlingTeamId);

      this.stateMachine.resetDeliveryPhase();
      this.gameState.activeDelivery.deliveryPhase = 'AWAITING_BOWLER_CONFIRM';

      if (this.callbacks.onInningsTransition) {
        this.callbacks.onInningsTransition({ nextInnings: 2, target });
      }
      if (this.callbacks.onInningsBreak) {
        this.callbacks.onInningsBreak({
          inningsIndex: 1,
          target,
          requiredRunRate: Number((target / CRICKET_RULES.DEFAULT_OVERS_PER_INNINGS).toFixed(2)),
          commentary: `Innings 1 Complete! ${newBattingTeam.name} requires ${target} runs from 5.0 overs to win.`
        });
      }
      if (this.callbacks.onScorecardSync) {
        this.callbacks.onScorecardSync(this.gameState.scorecard);
      }
      this.onStateBroadcast(this.gameState);
    } else {
      this.handleMatchComplete('AUTO');
    }
  }

  public startSecondInnings(enableAuthoritativeLoop: boolean = true): { success: boolean; error?: string } {
    if (this.gameState.currentInningsNumber !== 2) {
      this.handleInningsComplete();
    }
    this.gameState.phase = 'ACTIVE_MATCH';
    this.stateMachine.resetDeliveryPhase();
    this.gameState.activeDelivery.deliveryPhase = 'AWAITING_BOWLER_CONFIRM';
    if (enableAuthoritativeLoop) {
      this.startAuthoritativeLoop();
    }
    this.onStateBroadcast(this.gameState);
    return { success: true };
  }

  public handleMatchComplete(_resultType: 'WIN_BY_WICKETS' | 'WIN_BY_RUNS' | 'TIE' | 'AUTO' = 'AUTO'): void {
    const innings1 = this.gameState.scorecard.innings[0] as InningsScorecard;
    const innings2 = this.gameState.scorecard.innings[1] as InningsScorecard;

    const team1 = this.gameState.teams[innings1.battingTeamId];
    const team2 = this.gameState.teams[innings2.battingTeamId];

    let winnerTeamId: TeamId | 'TIE' = 'TIE';
    let commentary = '';

    if (innings2.runs > innings1.runs) {
      winnerTeamId = innings2.battingTeamId;
      const wicketsInHand = 10 - innings2.wickets;
      commentary = `${team2.name} won by ${wicketsInHand} wicket${wicketsInHand === 1 ? '' : 's'}!`;
    } else if (innings2.runs < innings1.runs) {
      winnerTeamId = innings1.battingTeamId;
      const margin = innings1.runs - innings2.runs;
      commentary = `${team1.name} won by ${margin} run${margin === 1 ? '' : 's'}!`;
    } else {
      winnerTeamId = 'TIE';
      commentary = `Match Tied! Both teams scored ${innings1.runs} runs! Super Over available per ICC T5 policy.`;
    }

    this.gameState.phase = 'MATCH_CONCLUDED';
    this.gameState.scorecard.isCompleted = true;
    this.gameState.scorecard.matchResultCommentary = commentary;

    if (this.tickInterval) clearInterval(this.tickInterval);
    if (this.umpireDecisionTimeout) clearTimeout(this.umpireDecisionTimeout);

    if (this.callbacks.onMatchFinished) {
      this.callbacks.onMatchFinished({
        winnerTeamId,
        commentary,
        scorecard: this.gameState.scorecard
      });
    }

    if (this.callbacks.onScorecardSync) {
      this.callbacks.onScorecardSync(this.gameState.scorecard);
    }
    this.onStateBroadcast(this.gameState);
  }

  public startSuperOver(): { success: boolean; error?: string } {
    const innings1 = this.gameState.scorecard.innings[0];
    const innings2 = this.gameState.scorecard.innings[1];
    if (!innings1 || !innings2 || innings1.runs !== innings2.runs) {
      return { success: false, error: 'Super Over is only permitted when match scores are tied' };
    }

    this.gameState.phase = 'SUPER_OVER';
    // Team that chased in match bats first in Super Over
    const superBattingTeamId = innings2.battingTeamId;
    const superBowlingTeamId = innings1.battingTeamId;

    this.gameState.battingTeamId = superBattingTeamId;
    this.gameState.bowlingTeamId = superBowlingTeamId;
    this.gameState.currentInningsNumber = 1;

    const teamBat = this.gameState.teams[superBattingTeamId];
    const teamBowl = this.gameState.teams[superBowlingTeamId];

    const superInnings1 = this.createEmptyInningsScorecard(1, superBattingTeamId, superBowlingTeamId, teamBat.players);
    this.gameState.scorecard.superOver = {
      innings: [superInnings1],
      currentInningsIndex: 1,
      isCompleted: false
    };

    this.gameState.currentStrikerId = teamBat.players[0].id;
    this.gameState.currentNonStrikerId = teamBat.players[1].id;
    this.gameState.currentBowlerId = teamBowl.players[10].id;
    this.currentOverBowlerRuns = 0;

    this.repositionPlayersForInnings(superBattingTeamId, superBowlingTeamId);
    this.stateMachine.resetDeliveryPhase();
    this.gameState.activeDelivery.deliveryPhase = 'AWAITING_BOWLER_CONFIRM';

    if (this.callbacks.onSuperOverStarted) {
      this.callbacks.onSuperOverStarted({ gameState: this.gameState });
    }
    if (this.callbacks.onScorecardSync) {
      this.callbacks.onScorecardSync(this.gameState.scorecard);
    }
    this.onStateBroadcast(this.gameState);
    return { success: true };
  }

  public handleSuperOverInningsComplete(): void {
    if (!this.gameState.scorecard.superOver) return;

    if (this.gameState.currentInningsNumber === 1) {
      this.gameState.currentInningsNumber = 2;
      const previousBatting = this.gameState.battingTeamId;
      this.gameState.battingTeamId = this.gameState.bowlingTeamId;
      this.gameState.bowlingTeamId = previousBatting;

      const superInnings1 = this.gameState.scorecard.superOver.innings[0]!;
      const target = superInnings1.runs + 1;

      const newBattingTeam = this.gameState.teams[this.gameState.battingTeamId];
      const newBowlingTeam = this.gameState.teams[this.gameState.bowlingTeamId];

      const superInnings2 = this.createEmptyInningsScorecard(
        2,
        this.gameState.battingTeamId,
        this.gameState.bowlingTeamId,
        newBattingTeam.players
      );
      superInnings2.target = target;
      superInnings2.requiredRunRate = target; // 1 over
      this.gameState.scorecard.superOver.innings[1] = superInnings2;
      this.gameState.scorecard.superOver.currentInningsIndex = 2;
      this.gameState.scorecard.superOver.target = target;

      this.gameState.currentStrikerId = newBattingTeam.players[0].id;
      this.gameState.currentNonStrikerId = newBattingTeam.players[1].id;
      this.gameState.currentBowlerId = newBowlingTeam.players[10].id;
      this.currentOverBowlerRuns = 0;

      this.repositionPlayersForInnings(this.gameState.battingTeamId, this.gameState.bowlingTeamId);
      this.stateMachine.resetDeliveryPhase();
      this.gameState.activeDelivery.deliveryPhase = 'AWAITING_BOWLER_CONFIRM';

      if (this.callbacks.onInningsTransition) {
        this.callbacks.onInningsTransition({ nextInnings: 2, target });
      }
      if (this.callbacks.onScorecardSync) {
        this.callbacks.onScorecardSync(this.gameState.scorecard);
      }
      this.onStateBroadcast(this.gameState);
    } else {
      this.handleSuperOverComplete('AUTO');
    }
  }

  public handleSuperOverComplete(_resultType: 'WIN_BY_WICKETS' | 'WIN_BY_RUNS' | 'AUTO' = 'AUTO'): void {
    if (!this.gameState.scorecard.superOver) return;
    const superInnings1 = this.gameState.scorecard.superOver.innings[0]!;
    const superInnings2 = this.gameState.scorecard.superOver.innings[1]!;

    const team1 = this.gameState.teams[superInnings1.battingTeamId];
    const team2 = this.gameState.teams[superInnings2.battingTeamId];

    let winnerTeamId: TeamId | 'TIE' = 'TIE';
    let commentary = '';

    if (superInnings2.runs > superInnings1.runs) {
      winnerTeamId = superInnings2.battingTeamId;
      const wicketsInHand = CRICKET_RULES.SUPER_OVER_MAX_WICKETS - superInnings2.wickets;
      commentary = `${team2.name} won the Super Over by ${wicketsInHand} wicket${wicketsInHand === 1 ? '' : 's'}!`;
    } else if (superInnings2.runs < superInnings1.runs) {
      winnerTeamId = superInnings1.battingTeamId;
      const margin = superInnings1.runs - superInnings2.runs;
      commentary = `${team1.name} won the Super Over by ${margin} run${margin === 1 ? '' : 's'}!`;
    } else {
      // Super Over tied -> Documented Boundary Countback Policy
      const team1Boundaries = this.calculateTotalBoundaries(team1.teamId);
      const team2Boundaries = this.calculateTotalBoundaries(team2.teamId);

      if (team2Boundaries > team1Boundaries) {
        winnerTeamId = team2.teamId;
        commentary = `${team2.name} won the Super Over on Boundary Countback (${team2Boundaries} vs ${team1Boundaries} boundaries)!`;
      } else if (team1Boundaries > team2Boundaries) {
        winnerTeamId = team1.teamId;
        commentary = `${team1.name} won the Super Over on Boundary Countback (${team1Boundaries} vs ${team2Boundaries} boundaries)!`;
      } else {
        winnerTeamId = 'TIE';
        commentary = `Super Over Tied and Boundary Count Tied (${team1Boundaries} boundaries each)! Shared Trophy!`;
      }
    }

    this.gameState.phase = 'MATCH_CONCLUDED';
    this.gameState.scorecard.isCompleted = true;
    this.gameState.scorecard.matchResultCommentary = commentary;
    this.gameState.scorecard.superOver.isCompleted = true;
    this.gameState.scorecard.superOver.winnerTeamId = winnerTeamId;
    this.gameState.scorecard.superOver.commentary = commentary;

    if (this.tickInterval) clearInterval(this.tickInterval);
    if (this.umpireDecisionTimeout) clearTimeout(this.umpireDecisionTimeout);

    if (this.callbacks.onMatchFinished) {
      this.callbacks.onMatchFinished({
        winnerTeamId,
        commentary,
        scorecard: this.gameState.scorecard
      });
    }

    if (this.callbacks.onScorecardSync) {
      this.callbacks.onScorecardSync(this.gameState.scorecard);
    }
    this.onStateBroadcast(this.gameState);
  }

  private calculateTotalBoundaries(teamId: TeamId): number {
    let boundaries = 0;
    for (const inn of this.gameState.scorecard.innings) {
      if (inn && inn.battingTeamId === teamId) {
        for (const b of inn.batters) {
          boundaries += (b.fours + b.sixes);
        }
      }
    }
    if (this.gameState.scorecard.superOver) {
      for (const inn of this.gameState.scorecard.superOver.innings) {
        if (inn && inn.battingTeamId === teamId) {
          for (const b of inn.batters) {
            boundaries += (b.fours + b.sixes);
          }
        }
      }
    }
    return boundaries;
  }

  public restartRematch(): { success: boolean; error?: string } {
    const teamA = this.gameState.teams.TEAM_A;
    const teamB = this.gameState.teams.TEAM_B;

    const initialScorecard: MatchScorecard = {
      roomId: this.roomId,
      innings: [this.createEmptyInningsScorecard(1, 'TEAM_A', 'TEAM_B', teamA.players)],
      currentInningsIndex: 1,
      isCompleted: false
    };

    this.gameState.phase = 'ACTIVE_MATCH';
    this.gameState.currentInningsNumber = 1;
    this.gameState.battingTeamId = 'TEAM_A';
    this.gameState.bowlingTeamId = 'TEAM_B';
    this.gameState.currentStrikerId = teamA.players[0].id;
    this.gameState.currentNonStrikerId = teamA.players[1].id;
    this.gameState.currentBowlerId = teamB.players[10].id;
    this.gameState.scorecard = initialScorecard;
    this.currentOverBowlerRuns = 0;

    this.repositionPlayersForInnings('TEAM_A', 'TEAM_B');
    this.stateMachine.resetDeliveryPhase();
    this.gameState.activeDelivery.deliveryPhase = 'AWAITING_BOWLER_CONFIRM';

    if (this.callbacks.onRematchStarted) {
      this.callbacks.onRematchStarted({ gameState: this.gameState });
    }
    if (this.callbacks.onScorecardSync) {
      this.callbacks.onScorecardSync(this.gameState.scorecard);
    }
    this.onStateBroadcast(this.gameState);
    return { success: true };
  }

  public resetToLobby(): { success: boolean; error?: string } {
    this.gameState.phase = 'LOBBY';
    this.stateMachine.transitionMatchPhase('LOBBY');
    this.onStateBroadcast(this.gameState);
    return { success: true };
  }

  private createDefaultTeam(
    teamId: TeamId,
    name: string,
    shortCode: string,
    primaryColor: string,
    secondaryColor: string
  ): TeamPlayingXI {
    const defaultPositions = Object.keys(DEFAULT_FIELD_PRESETS) as (keyof typeof DEFAULT_FIELD_PRESETS)[];
    const players: PlayerProfile[] = Array.from({ length: 11 }, (_, i) => {
      const isBowler = i >= 6;
      return {
        id: `${teamId}_player_${i + 1}`,
        displayName: `${shortCode} Player ${i + 1}`,
        role: isBowler ? 'BOWLER' : i === 0 ? 'WICKET_KEEPER' : 'BATSMAN',
        battingStyle: i % 3 === 0 ? 'LEFT_HAND' : 'RIGHT_HAND',
        bowlingStyle: isBowler ? (i % 2 === 0 ? 'RIGHT_ARM_FAST' : 'RIGHT_ARM_LEG_SPIN') : 'RIGHT_ARM_FAST_MEDIUM',
        jerseyNumber: i + 1,
        attributes: {
          battingTiming: 75,
          battingPower: 70,
          bowlingPace: isBowler ? 85 : 50,
          bowlingAccuracy: 75,
          bowlingSpinSwing: 70,
          fieldingCatching: 80,
          fieldingSpeed: 75,
          throwAccuracy: 78
        },
        isAi: true
      };
    });

    const fieldPositions: Record<string, any> = {};
    players.forEach((p, index) => {
      fieldPositions[p.id] = defaultPositions[index % defaultPositions.length];
    });

    return {
      teamId,
      name,
      shortCode,
      primaryColor,
      secondaryColor,
      players,
      captainId: players[0].id,
      wicketKeeperId: players[0].id,
      fieldPositions
    };
  }

  private createEmptyInningsScorecard(
    inningsIndex: 1 | 2,
    battingTeamId: TeamId,
    bowlingTeamId: TeamId,
    batters: PlayerProfile[]
  ): InningsScorecard {
    return {
      inningsIndex,
      battingTeamId,
      bowlingTeamId,
      runs: 0,
      wickets: 0,
      oversCompleted: 0,
      ballsInCurrentOver: 0,
      runRate: 0,
      extras: { wides: 0, noBalls: 0, byes: 0, legByes: 0, penalty: 0, total: 0 },
      batters: [
        {
          playerId: batters[0].id,
          playerName: batters[0].displayName,
          runs: 0,
          ballsFaced: 0,
          fours: 0,
          sixes: 0,
          strikeRate: 0,
          isOut: false,
          dismissalDescription: 'not out',
          onStrike: true
        },
        {
          playerId: batters[1].id,
          playerName: batters[1].displayName,
          runs: 0,
          ballsFaced: 0,
          fours: 0,
          sixes: 0,
          strikeRate: 0,
          isOut: false,
          dismissalDescription: 'not out',
          onStrike: false
        }
      ],
      bowlers: [],
      fallOfWickets: [],
      currentPartnershipRuns: 0,
      currentPartnershipBalls: 0
    };
  }

  public destroy(): void {
    if (this.tickInterval) clearInterval(this.tickInterval);
    if (this.umpireDecisionTimeout) clearTimeout(this.umpireDecisionTimeout);
  }
}
