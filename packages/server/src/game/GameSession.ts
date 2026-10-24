import {
  CricketGameState,
  TeamId,
  TeamPlayingXI,
  PlayerProfile,
  MatchScorecard,
  InningsScorecard,
  DeliveryOutcome,
  DeliveryRecord,
  BallPhysicalState,
  BowlingDeliveryIntent,
  BattingShotIntent,
  CRICKET_RULES,
  GROUND_DIMENSIONS,
  DEFAULT_FIELD_PRESETS,
  MatchStateMachine
} from '@cricket2026/shared';
import { AIService } from './AIService.js';

export class GameSession {
  public readonly roomId: string;
  public readonly roomCode: string;
  private stateMachine: MatchStateMachine;
  private gameState: CricketGameState;
  private tickInterval: NodeJS.Timeout | null = null;
  private onStateBroadcast: (state: CricketGameState) => void;
  private onTickBroadcast: (sync: any) => void;
  private onDeliveryCompleted: (record: DeliveryRecord) => void;

  constructor(
    roomId: string,
    roomCode: string,
    callbacks: {
      onStateBroadcast: (state: CricketGameState) => void;
      onTickBroadcast: (sync: any) => void;
      onDeliveryCompleted: (record: DeliveryRecord) => void;
    }
  ) {
    this.roomId = roomId;
    this.roomCode = roomCode;
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
      isInAir: false
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
      serverTick: 0,
      lastTickTimestamp: Date.now()
    };
  }

  public getGameState(): CricketGameState {
    return this.gameState;
  }

  public startToss(): void {
    if (this.stateMachine.transitionMatchPhase('TOSS_IN_PROGRESS')) {
      this.gameState.phase = 'TOSS_IN_PROGRESS';
      this.gameState.toss.coinResult = Math.random() > 0.5 ? 'HEADS' : 'TAILS';
      this.gameState.toss.winnerTeamId =
        this.gameState.toss.coinResult === this.gameState.toss.coinChoice ? 'TEAM_B' : 'TEAM_A';
      this.gameState.toss.decision = 'BAT';
      this.gameState.toss.isCompleted = true;

      if (this.gameState.toss.winnerTeamId === 'TEAM_A') {
        this.gameState.battingTeamId = 'TEAM_A';
        this.gameState.bowlingTeamId = 'TEAM_B';
      } else {
        this.gameState.battingTeamId = 'TEAM_B';
        this.gameState.bowlingTeamId = 'TEAM_A';
      }

      this.onStateBroadcast(this.gameState);
    }
  }

  public beginMatch(): void {
    if (this.stateMachine.transitionMatchPhase('INNINGS_1_IN_PROGRESS')) {
      this.gameState.phase = 'INNINGS_1_IN_PROGRESS';
      this.startAuthoritativeLoop();
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

    this.onTickBroadcast({
      tick: this.gameState.serverTick,
      ball: this.gameState.activeDelivery.ball,
      phase: this.gameState.activeDelivery.deliveryPhase,
      fielderPositions: {}
    });
  }

  public handleBowlerCommit(intent: BowlingDeliveryIntent): void {
    this.gameState.activeDelivery.bowlerIntent = intent;
    this.gameState.activeDelivery.deliveryPhase = 'BALL_RELEASE';

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
  }

  public handleBatterShot(intent: BattingShotIntent): void {
    this.gameState.activeDelivery.batterIntent = intent;
    this.gameState.activeDelivery.deliveryPhase = 'BAT_INTERACTION';

    // Physics resolution calculation
    const outcome = this.calculateDeliveryOutcome(
      this.gameState.activeDelivery.bowlerIntent!,
      intent
    );

    this.resolveDelivery(outcome);
  }

  private calculateDeliveryOutcome(
    bowler: BowlingDeliveryIntent,
    batter: BattingShotIntent
  ): DeliveryOutcome {
    const timingError = Math.abs(batter.timingOffsetMs);
    let runs = 0;
    let isBoundaryFour = false;
    let isBoundarySix = false;
    let wicket = null;

    if (timingError < 15) {
      // Sweet spot contact
      if (batter.isLofted && batter.power > 70) {
        runs = 6;
        isBoundarySix = true;
      } else {
        runs = 4;
        isBoundaryFour = true;
      }
    } else if (timingError < 45) {
      // Good stroke
      runs = batter.power > 50 ? (Math.random() > 0.5 ? 2 : 1) : 0;
    } else if (timingError < 80) {
      // Mis-timed / beaten
      if (Math.random() > 0.6) {
        wicket = {
          dismissalType: 'CAUGHT' as const,
          dismissedPlayerId: this.gameState.currentStrikerId,
          bowlerId: bowler.bowlerId,
          fielderId: 'MID_OFF',
          commentary: 'Mistimed lofted shot caught cleanly at mid-off!'
        };
      } else {
        runs = 0;
      }
    } else {
      // Clean bowled or LBW
      wicket = {
        dismissalType: 'BOWLED' as const,
        dismissedPlayerId: this.gameState.currentStrikerId,
        bowlerId: bowler.bowlerId,
        commentary: 'Clean bowled! The bails fly into the air!'
      };
    }

    return {
      batterRuns: runs,
      extrasType: 'NONE',
      extrasRuns: 0,
      totalRuns: runs,
      isLegalDelivery: true,
      isBoundaryFour,
      isBoundarySix,
      wicket,
      strikeRotated: runs % 2 !== 0,
      reviewTriggered: false
    };
  }

  private resolveDelivery(outcome: DeliveryOutcome): void {
    const currentInnings = this.gameState.scorecard.innings[
      this.gameState.currentInningsNumber - 1
    ] as InningsScorecard;

    // Update batting scorecard
    let strikerEntry = currentInnings.batters.find(
      b => b.playerId === this.gameState.currentStrikerId
    );
    if (!strikerEntry) {
      const p = this.gameState.teams[this.gameState.battingTeamId].players.find(
        pl => pl.id === this.gameState.currentStrikerId
      );
      strikerEntry = {
        playerId: this.gameState.currentStrikerId,
        playerName: p?.displayName || 'Batter',
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

    strikerEntry.ballsFaced++;
    strikerEntry.runs += outcome.batterRuns;
    if (outcome.isBoundaryFour) strikerEntry.fours++;
    if (outcome.isBoundarySix) strikerEntry.sixes++;
    strikerEntry.strikeRate = Number(((strikerEntry.runs / strikerEntry.ballsFaced) * 100).toFixed(1));

    if (outcome.wicket) {
      strikerEntry.isOut = true;
      strikerEntry.dismissalDescription = outcome.wicket.commentary;
      currentInnings.wickets++;
      currentInnings.fallOfWickets.push({
        wicketNumber: currentInnings.wickets,
        teamScore: currentInnings.runs + outcome.totalRuns,
        overs: `${currentInnings.oversCompleted}.${currentInnings.ballsInCurrentOver + 1}`,
        batterName: strikerEntry.playerName
      });
    }

    // Update bowler scorecard
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

    bowlerEntry.runsConceded += outcome.totalRuns;
    if (outcome.wicket) bowlerEntry.wickets++;
    if (outcome.totalRuns === 0) bowlerEntry.dotBalls++;

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

    currentInnings.runs += outcome.totalRuns;
    currentInnings.runRate = Number(
      (
        currentInnings.runs /
        Math.max(1 / 6, currentInnings.oversCompleted + currentInnings.ballsInCurrentOver / 6)
      ).toFixed(2)
    );

    // Over completion check (6 legal deliveries)
    if (currentInnings.ballsInCurrentOver >= 6) {
      currentInnings.oversCompleted++;
      currentInnings.ballsInCurrentOver = 0;
      // Strike changes at end of over
      const temp = this.gameState.currentStrikerId;
      this.gameState.currentStrikerId = this.gameState.currentNonStrikerId;
      this.gameState.currentNonStrikerId = temp;
    } else if (outcome.strikeRotated) {
      // Strike changes on odd runs
      const temp = this.gameState.currentStrikerId;
      this.gameState.currentStrikerId = this.gameState.currentNonStrikerId;
      this.gameState.currentNonStrikerId = temp;
    }

    const record: DeliveryRecord = {
      id: `del_${Date.now()}`,
      inningsNumber: this.gameState.currentInningsNumber,
      overIndex: currentInnings.oversCompleted,
      ballInOver: currentInnings.ballsInCurrentOver,
      bowlerId: this.gameState.currentBowlerId,
      strikerId: this.gameState.currentStrikerId,
      nonStrikerId: this.gameState.currentNonStrikerId,
      releaseSpeedKmph: this.gameState.activeDelivery.bowlerIntent?.releaseSpeedKmph || 135,
      pitchPoint: this.gameState.activeDelivery.bowlerIntent?.targetPitchPoint || { x: 0, y: 0, z: 4.5 },
      outcome,
      timestamp: Date.now()
    };

    // Check innings completion (5 overs completed or 10 wickets)
    if (currentInnings.oversCompleted >= CRICKET_RULES.DEFAULT_OVERS_PER_INNINGS || currentInnings.wickets >= 10) {
      this.handleInningsComplete();
    } else {
      this.stateMachine.resetDeliveryPhase();
      this.gameState.activeDelivery.deliveryPhase = 'AWAITING_BOWLER_CONFIRM';
      this.gameState.activeDelivery.bowlerIntent = null;
      this.gameState.activeDelivery.batterIntent = null;
    }

    this.onDeliveryCompleted(record);
    this.onStateBroadcast(this.gameState);
  }

  private handleInningsComplete(): void {
    if (this.gameState.currentInningsNumber === 1) {
      this.gameState.phase = 'MID_INNINGS_BREAK';
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
      this.gameState.scorecard.innings.push(secondInnings);

      this.gameState.currentStrikerId = newBattingTeam.players[0].id;
      this.gameState.currentNonStrikerId = newBattingTeam.players[1].id;
      this.gameState.currentBowlerId = newBowlingTeam.players[10].id;

      this.stateMachine.resetDeliveryPhase();
      this.gameState.activeDelivery.deliveryPhase = 'AWAITING_BOWLER_CONFIRM';
    } else {
      this.gameState.phase = 'MATCH_CONCLUDED';
      this.gameState.scorecard.isCompleted = true;
      if (this.tickInterval) clearInterval(this.tickInterval);
    }
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
  }
}
