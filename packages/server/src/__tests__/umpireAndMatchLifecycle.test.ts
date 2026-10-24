import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { GameSession } from '../game/GameSession.js';
import { RoomManager } from '../services/RoomManager.js';
import {
  CricketPhysicsEngine,
  BowlingDeliveryIntent,
  BattingShotIntent,
  UmpireDecisionEvent
} from '@cricket2026/shared';

const createMockCallbacks = (overrides = {}) => ({
  onStateBroadcast: () => {},
  onTickBroadcast: () => {},
  onDeliveryCompleted: () => {},
  onUmpireBroadcast: () => {},
  onUmpirePrompt: () => {},
  onUmpireTimeout: () => {},
  onScorecardSync: () => {},
  onOverEnded: () => {},
  onInningsTransition: () => {},
  onInningsBreak: () => {},
  onMatchFinished: () => {},
  onSuperOverStarted: () => {},
  onRematchStarted: () => {},
  ...overrides
});

describe('Phase 7: Umpiring Modes & Full 5-Over Match Lifecycle', () => {

  // =========================================================================
  // 1. AI UMPIRE ADJUDICATION & EXPLICIT RULES
  // =========================================================================
  describe('1. AI Umpire Mode: Server-Validated Adjudication & Explicit Rules', () => {
    test('1.1. Deterministic signals: Legal deliveries, Wides, No-Balls, Boundaries & Wickets', () => {
      const broadcastSignals: UmpireDecisionEvent[] = [];
      const session = new GameSession(
        'test_ai_umpire_room',
        'AIU001',
        createMockCallbacks({
          onUmpireBroadcast: (event: UmpireDecisionEvent) => {
            broadcastSignals.push(event);
          }
        })
      );

      session.setUmpireMode('AI_AUTOMATION');
      session.beginMatch(false);

      // Case A: Wide Ball
      const wideIntent: BowlingDeliveryIntent = {
        bowlerId: session.getGameState().currentBowlerId,
        targetPitchPoint: { x: 1.25, y: 0, z: 5.0 }, // Far outside off stump (> 0.9m crease limit)
        releaseSpeedKmph: 130,
        seamAngleDegrees: 0,
        swingType: 'NONE',
        spinType: 'NONE',
        effortPercentage: 85
      };
      session.executeDeliveryDirectly(wideIntent, null);

      const wideSignal = broadcastSignals.find(s => s.signal === 'WIDE');
      assert.ok(wideSignal, 'AI Umpire must broadcast WIDE signal for deliveries outside wide line');
      assert.equal(wideSignal.isAiDecision, true, 'AI Umpire decision flag must be true');
      assert.ok(wideSignal.reason.includes('Wide'), 'Reason must document wide adjudication');

      // Case B: Boundary Four
      broadcastSignals.length = 0;
      const fourShot: BattingShotIntent = {
        batterId: session.getGameState().currentStrikerId,
        shotType: 'COVER_DRIVE',
        power: 80,
        directionAngleDeg: 315,
        timingOffsetMs: 0,
        isLofted: false,
        footwork: 'FRONT_FOOT'
      };
      const normalBall: BowlingDeliveryIntent = {
        bowlerId: session.getGameState().currentBowlerId,
        targetPitchPoint: { x: 0.1, y: 0, z: 5.0 },
        releaseSpeedKmph: 130,
        seamAngleDegrees: 0,
        swingType: 'NONE',
        spinType: 'NONE',
        effortPercentage: 85
      };
      session.executeDeliveryDirectly(normalBall, fourShot);
      const fourSignal = broadcastSignals.find(s => s.signal === 'FOUR');
      assert.ok(fourSignal, 'AI Umpire must broadcast FOUR signal for ground boundary');

      // Case C: Boundary Six
      broadcastSignals.length = 0;
      const sixShot: BattingShotIntent = {
        batterId: session.getGameState().currentStrikerId,
        shotType: 'STRAIGHT_DRIVE',
        power: 90,
        directionAngleDeg: 0,
        timingOffsetMs: 0,
        isLofted: true,
        footwork: 'FRONT_FOOT'
      };
      session.executeDeliveryDirectly(normalBall, sixShot);
      const sixSignal = broadcastSignals.find(s => s.signal === 'SIX');
      assert.ok(sixSignal, 'AI Umpire must broadcast SIX signal for aerial boundary');

      // Case D: Bowled Wicket
      broadcastSignals.length = 0;
      const bowledBall: BowlingDeliveryIntent = {
        bowlerId: session.getGameState().currentBowlerId,
        targetPitchPoint: { x: 0.0, y: 0, z: 4.5 },
        releaseSpeedKmph: 145,
        seamAngleDegrees: 0,
        swingType: 'NONE',
        spinType: 'NONE',
        effortPercentage: 95
      };
      session.executeDeliveryDirectly(bowledBall, null);
      const outSignal = broadcastSignals.find(s => s.signal === 'OUT');
      assert.ok(outSignal, 'AI Umpire must broadcast OUT signal when delivery breaks the wicket');
    });

    test('1.2. Documented Simplified LBW Model: Deterministic evaluation without LLM or random numbers', () => {
      // MCC Law 36 criteria verified via evaluateSimplifiedLBW:
      // Point pitching in-line or offside (x >= -0.15m), impacting pad in front of stumps (|x| <= 0.18m),
      // height <= 0.55m, and z in crease zone (8.5m - 10.06m)

      // Test 1: Legal LBW - Pitches on off stump, strikes pad plumb in front of middle stump at knee roll
      const plumbPitchPoint = { x: 0.05, y: 0, z: 5.5 };
      const plumbImpactPos = { x: 0.02, y: 0.42, z: 9.2 };
      const plumbRes = CricketPhysicsEngine.evaluateSimplifiedLBW(plumbPitchPoint, plumbImpactPos);

      assert.equal(plumbRes.isOut, true, 'Plumb ball pitching on off and striking middle stump height must be OUT');
      assert.ok(plumbRes.confidence >= 0.85, 'Confidence must be high for plumb impact');
      assert.ok(plumbRes.reason.includes('Simplified LBW: OUT'), 'Documentation reason must be provided');

      // Test 2: Pitched outside leg-stump (x < -0.15m) -> NOT OUT by Law 36.1(b)
      const legPitchPoint = { x: -0.22, y: 0, z: 5.0 };
      const legRes = CricketPhysicsEngine.evaluateSimplifiedLBW(legPitchPoint, plumbImpactPos);
      assert.equal(legRes.isOut, false, 'Pitched outside leg stump must be NOT OUT');
      assert.ok(legRes.reason.includes('Pitched outside leg'), 'Reason must explicitly cite Law 36.1(b)');

      // Test 3: Impact outside off stump (|x| > 0.18m) -> NOT OUT
      const wideImpactPos = { x: 0.28, y: 0.40, z: 9.0 };
      const outsideRes = CricketPhysicsEngine.evaluateSimplifiedLBW(plumbPitchPoint, wideImpactPos);
      assert.equal(outsideRes.isOut, false, 'Impact outside off stump must be NOT OUT');

      // Test 4: Bouncing over the crossbails (height > 0.55m) -> NOT OUT
      const highImpactPos = { x: 0.02, y: 0.68, z: 9.0 };
      const highRes = CricketPhysicsEngine.evaluateSimplifiedLBW(plumbPitchPoint, highImpactPos);
      assert.equal(highRes.isOut, false, 'Bouncing over stumps height must be NOT OUT');

      // Test 5: Fallback integration: evaluateLBW uses evaluateSimplifiedLBW when trajectory velocity is missing
      const fallbackRes = CricketPhysicsEngine.evaluateLBW(
        plumbImpactPos,
        { x: 0, y: 0, z: 0 },
        plumbPitchPoint
      );
      assert.equal(fallbackRes.isOut, true, 'evaluateLBW must fallback to simplified LBW model');
    });
  });

  // =========================================================================
  // 2. MANUAL UMPIRE: INTERFACE, DEADLINES, DISCONNECTS & AUTHORITY
  // =========================================================================
  describe('2. Manual Umpire Mode: Authority, Deadlines & Reconnections', () => {
    test('2.1. Permitted decisions only & Server Authority over scoring', () => {
      let broadcastSignal: UmpireDecisionEvent | null = null;
      const session = new GameSession(
        'test_manual_umpire_room',
        'MAN001',
        createMockCallbacks({
          onUmpireBroadcast: (event: UmpireDecisionEvent) => {
            broadcastSignal = event;
          }
        })
      );

      session.setUmpireMode('MANUAL_HUMAN', 'umpire_socket_123');
      session.beginMatch(false);

      // Trigger a delivery requiring manual decision
      const bowlerIntent: BowlingDeliveryIntent = {
        bowlerId: session.getGameState().currentBowlerId,
        targetPitchPoint: { x: 0.1, y: 0, z: 5.0 },
        releaseSpeedKmph: 130,
        seamAngleDegrees: 0,
        swingType: 'NONE',
        spinType: 'NONE',
        effortPercentage: 85
      };
      session.executeDeliveryDirectly(bowlerIntent, null);

      assert.ok(session.getGameState().umpirePendingDecision, 'Session must prompt manual umpire');

      // Attempt 1: Unauthorized socket tries to submit decision
      const unauthorizedResult = session.handleManualUmpireSignal(
        'impostor_socket_999',
        'OUT',
        'Impostor call'
      );
      assert.equal(unauthorizedResult.success, false, 'Decisions from unauthorized sockets must be rejected');
      assert.ok(unauthorizedResult.error?.includes('Unauthorized'), 'Error must specify unauthorized caller');

      // Attempt 2: Authorized umpire submits valid signal
      const authorizedResult = session.handleManualUmpireSignal(
        'umpire_socket_123',
        'OUT',
        'Umpire raises finger: Batter is OUT'
      );
      assert.equal(authorizedResult.success, true, 'Authorized manual umpire decision must succeed');
      assert.equal((broadcastSignal as any)?.signal, 'OUT', 'OUT signal must be broadcast');
      assert.equal((broadcastSignal as any)?.isAiDecision, false, 'Decision must be marked as manual human decision');

      // Attempt 3: Duplicate decision after resolution is prevented
      const duplicateResult = session.handleManualUmpireSignal(
        'umpire_socket_123',
        'NOT_OUT',
        'Duplicate attempt'
      );
      assert.equal(duplicateResult.success, false, 'Duplicate umpire decisions must be rejected');
    });

    test('2.2. Enforces 10-second timeout with safe AI fallback without hanging match', () => {
      let broadcastSignal: UmpireDecisionEvent | null = null;
      const session = new GameSession(
        'test_timeout_room',
        'TO0001',
        createMockCallbacks({
          onUmpireBroadcast: (event: UmpireDecisionEvent) => {
            broadcastSignal = event;
          }
        })
      );

      session.setUmpireMode('MANUAL_HUMAN', 'slow_umpire_socket');
      session.beginMatch(false);

      const bowlerIntent: BowlingDeliveryIntent = {
        bowlerId: session.getGameState().currentBowlerId,
        targetPitchPoint: { x: 0.05, y: 0, z: 4.8 },
        releaseSpeedKmph: 135,
        seamAngleDegrees: 0,
        swingType: 'NONE',
        spinType: 'NONE',
        effortPercentage: 85
      };
      session.executeDeliveryDirectly(bowlerIntent, null);

      // Fast-forward simulated clock past 10-second deadline
      const pending = session.getGameState().umpirePendingDecision;
      assert.ok(pending, 'Umpire pending review must exist');
      pending.deadlineMs = Date.now() - 500; // Expired 500ms ago

      session.checkUmpireDecisionTimeout();

      assert.equal(session.getGameState().umpirePendingDecision, null, 'Pending prompt must be cleared on timeout');
      assert.ok(broadcastSignal, 'AI fallback broadcast must be emitted');
      assert.equal((broadcastSignal as any)?.isAiDecision, true, 'Fallback must be recorded as AI decision');
      assert.ok((broadcastSignal as any)?.reason.includes('timeout'), 'Reason must document timeout');
    });

    test('2.3. Safe disconnect fallback to AI & reconnection restoration within grace period', () => {
      const roomManager = new RoomManager();
      const createRes = roomManager.createRoom('socket_host_1', 'HostUmpire');
      const roomCode = createRes.roomCode;
      const hostReconnectToken = createRes.reconnectToken;

      // Assign Manual Umpire
      roomManager.assignUmpire('socket_host_1', 'socket_host_1', 'MANUAL_HUMAN');
      let room = roomManager.getRoomEntry(roomCode);
      assert.equal(room?.state.settings.umpireMode, 'MANUAL_HUMAN');
      assert.equal(room?.session.getGameState().manualUmpireSocketId, 'socket_host_1');

      // Manual Umpire disconnects: Match automatically falls back to AI Umpire
      const disconnectRes = roomManager.handleDisconnect('socket_host_1');
      assert.equal(disconnectRes.left, true);
      assert.ok(disconnectRes.graceExpiresAt);
      room = roomManager.getRoomEntry(roomCode);
      assert.equal(room?.state.settings.umpireMode, 'AI_AUTOMATION', 'Umpire mode must safely fall back to AI on disconnect');
      assert.equal(room?.session.getGameState().manualUmpireSocketId, null, 'Manual umpire socket ID must be cleared in session');

      // Manual Umpire reconnects with token within grace period: Manual Umpire role restored
      const reconnectRes = roomManager.joinRoom(
        roomCode,
        'new_umpire_socket_456',
        'HostUmpire',
        hostReconnectToken
      );
      assert.equal(reconnectRes.success, true);
      assert.equal(reconnectRes.reconnected, true);
      room = roomManager.getRoomEntry(roomCode);
      assert.equal(room?.state.settings.umpireMode, 'MANUAL_HUMAN', 'Umpire mode must be restored to MANUAL_HUMAN on reconnect');
      assert.equal(room?.session.getGameState().manualUmpireSocketId, 'new_umpire_socket_456', 'Socket ID must be updated in session');
    });
  });

  // =========================================================================
  // 3. MATCH LIFECYCLE: 5 OVERS, TARGET, MARGINS, TIES & SUPER OVER
  // =========================================================================
  describe('3. Match Lifecycle: 5-Over Specification, Targets & Super Over', () => {
    test('3.1. Complete 5-Over First Innings & Target Calculation', () => {
      let inningsBreakCalled = false;
      let targetScore = 0;
      const session = new GameSession(
        'test_lifecycle_room',
        'LC0001',
        createMockCallbacks({
          onInningsBreak: (payload: { target: number }) => {
            inningsBreakCalled = true;
            targetScore = payload.target;
          }
        })
      );

      session.beginMatch(false);

      // Simulate 5 complete overs (30 legal balls) with single runs
      const bowlerIntent: BowlingDeliveryIntent = {
        bowlerId: session.getGameState().currentBowlerId,
        targetPitchPoint: { x: 0.1, y: 0, z: 5.0 },
        releaseSpeedKmph: 120,
        seamAngleDegrees: 0,
        swingType: 'NONE',
        spinType: 'NONE',
        effortPercentage: 70
      };
      const singleShot: BattingShotIntent = {
        batterId: session.getGameState().currentStrikerId,
        shotType: 'FORWARD_DEFENSIVE',
        power: 40,
        directionAngleDeg: 45,
        timingOffsetMs: 0,
        isLofted: false,
        footwork: 'FRONT_FOOT'
      };

      for (let i = 0; i < 30; i++) {
        bowlerIntent.bowlerId = session.getGameState().currentBowlerId;
        singleShot.batterId = session.getGameState().currentStrikerId;
        session.executeDeliveryDirectly(bowlerIntent, singleShot);
      }

      assert.equal(session.getGameState().phase, 'INNINGS_BREAK', 'Match phase must transition to INNINGS_BREAK');
      assert.equal(inningsBreakCalled, true, 'onInningsBreak callback must be fired');
      const inn1 = session.getGameState().scorecard.innings[0];
      assert.equal(inn1?.oversCompleted, 5, '1st innings must complete all 5 overs');
      assert.equal(targetScore, inn1!.runs + 1, '2nd innings target must equal 1st innings runs + 1');
    });

    test('3.2. Second Innings Chase: Victory by Wickets when target is reached', () => {
      let matchWinner: string | null = null;
      let victoryCommentary: string | null = null;
      const session = new GameSession(
        'test_chase_room',
        'CH0001',
        createMockCallbacks({
          onMatchFinished: (payload: { winnerTeamId: string; commentary: string }) => {
            matchWinner = payload.winnerTeamId;
            victoryCommentary = payload.commentary;
          }
        })
      );

      session.beginMatch(false);

      // 1st innings scores 10 runs in 5 overs
      const inn1 = session.getGameState().scorecard.innings[0]!;
      inn1.runs = 10;
      inn1.oversCompleted = 5;
      inn1.ballsInCurrentOver = 0;

      // Start 2nd innings with target = 11
      session.startSecondInnings(false);
      assert.equal(session.getGameState().currentInningsNumber, 2);

      // Hit two consecutive sixes (12 runs > 11 target)
      const sixShot: BattingShotIntent = {
        batterId: session.getGameState().currentStrikerId,
        shotType: 'STRAIGHT_DRIVE',
        power: 90,
        directionAngleDeg: 0,
        timingOffsetMs: 0,
        isLofted: true,
        footwork: 'FRONT_FOOT'
      };
      const normalBall: BowlingDeliveryIntent = {
        bowlerId: session.getGameState().currentBowlerId,
        targetPitchPoint: { x: 0.1, y: 0, z: 5.0 },
        releaseSpeedKmph: 125,
        seamAngleDegrees: 0,
        swingType: 'NONE',
        spinType: 'NONE',
        effortPercentage: 80
      };

      session.executeDeliveryDirectly(normalBall, sixShot);
      session.executeDeliveryDirectly(normalBall, sixShot);

      assert.ok(
        ['COMPLETED_MATCH', 'MATCH_CONCLUDED'].includes(session.getGameState().phase),
        'Match must conclude early once target is achieved'
      );
      assert.equal(matchWinner, 'TEAM_B', 'Team B (chasing team) must win');
      assert.ok((victoryCommentary as any)?.includes('wickets'), 'Victory margin must be by wickets for chasing team');
    });

    test('3.3. Second Innings Defense: Victory by Runs when defending team succeeds', () => {
      let matchWinner: string | null = null;
      let victoryCommentary: string | null = null;
      const session = new GameSession(
        'test_defense_room',
        'DEF001',
        createMockCallbacks({
          onMatchFinished: (payload: { winnerTeamId: string; commentary: string }) => {
            matchWinner = payload.winnerTeamId;
            victoryCommentary = payload.commentary;
          }
        })
      );

      session.beginMatch(false);

      // Set 1st innings to 50 runs in 5 overs
      const inn1 = session.getGameState().scorecard.innings[0]!;
      inn1.runs = 50;
      inn1.oversCompleted = 5;
      inn1.ballsInCurrentOver = 0;

      // Start 2nd innings (Target = 51)
      session.startSecondInnings(false);

      // Team B bats 30 balls scoring 0 runs (dots)
      const dotBall: BowlingDeliveryIntent = {
        bowlerId: session.getGameState().currentBowlerId,
        targetPitchPoint: { x: 0.1, y: 0, z: 5.0 },
        releaseSpeedKmph: 125,
        seamAngleDegrees: 0,
        swingType: 'NONE',
        spinType: 'NONE',
        effortPercentage: 80
      };
      const dotShot: BattingShotIntent = {
        batterId: session.getGameState().currentStrikerId,
        shotType: 'FORWARD_DEFENSIVE',
        power: 10,
        directionAngleDeg: 0,
        timingOffsetMs: 0,
        isLofted: false,
        footwork: 'FRONT_FOOT'
      };

      for (let i = 0; i < 30; i++) {
        dotBall.bowlerId = session.getGameState().currentBowlerId;
        dotShot.batterId = session.getGameState().currentStrikerId;
        session.executeDeliveryDirectly(dotBall, dotShot);
      }

      assert.ok(
        ['COMPLETED_MATCH', 'MATCH_CONCLUDED'].includes(session.getGameState().phase),
        'Defending team match must conclude'
      );
      assert.equal(matchWinner, 'TEAM_A', 'Team A (defending team) must win');
      assert.ok((victoryCommentary as any)?.includes('runs'), 'Victory margin must be by runs for defending team');
    });

    test('3.4. Match Tie & Super Over Lifecycle: 1 Over, Max 2 Wickets & Boundary Countback', () => {
      let superOverStarted = false;
      let finalWinner: string | null = null;
      const session = new GameSession(
        'test_super_over_room',
        'SO0001',
        createMockCallbacks({
          onSuperOverStarted: () => {
            superOverStarted = true;
          },
          onMatchFinished: (payload: { winnerTeamId: string }) => {
            finalWinner = payload.winnerTeamId;
          }
        })
      );

      session.beginMatch(false);

      // Create a tie: Team A = 25 runs, Team B = 25 runs after 5 overs
      const inn1 = session.getGameState().scorecard.innings[0]!;
      inn1.runs = 25;
      inn1.oversCompleted = 5;
      inn1.ballsInCurrentOver = 0;

      session.startSecondInnings(false);
      const inn2 = session.getGameState().scorecard.innings[1]!;
      inn2.runs = 25;
      inn2.oversCompleted = 5;
      inn2.ballsInCurrentOver = 0;

      // Trigger Super Over
      session.startSuperOver();
      assert.equal(superOverStarted, true, 'Super Over callback must be triggered');
      assert.equal(session.getGameState().phase, 'SUPER_OVER', 'Phase must be SUPER_OVER');
      assert.ok(session.getGameState().scorecard.superOver, 'Scorecard must contain superOver structure');

      // Super Over 1st Innings: Team B bats, scores 12 runs in 1 over
      const so = session.getGameState().scorecard.superOver!;
      const soInn1 = so.innings[0];
      soInn1.runs = 12;
      soInn1.oversCompleted = 1;
      soInn1.ballsInCurrentOver = 0;

      // Complete Super Over 1st Innings -> Target = 13
      session.handleSuperOverInningsComplete();
      assert.equal(so.currentInningsIndex, 2);
      assert.equal(so.target, 13);

      // Super Over 2nd Innings: Team A scores 12 runs (Super Over is tied)
      const soInn2 = so.innings[1]!;
      soInn2.runs = 12;
      soInn2.oversCompleted = 1;
      soInn2.ballsInCurrentOver = 0;

      // Grant Team B more boundaries in main match to test boundary countback
      inn2.batters[0].fours = 3;
      inn1.batters[0].fours = 1;

      session.handleSuperOverComplete();
      assert.equal(so.isCompleted, true);
      assert.equal(finalWinner, 'TEAM_B', 'Boundary countback rule must award victory to Team B');
      assert.ok(session.getGameState().scorecard.matchResultCommentary?.toLowerCase().includes('boundary countback'));
      assert.ok(
        ['COMPLETED_MATCH', 'MATCH_CONCLUDED'].includes(session.getGameState().phase),
        'Super over must conclude match'
      );
    });

    test('3.5. Rematch & Return to Lobby Transitions', () => {
      let rematchFired = false;
      const session = new GameSession(
        'test_rematch_room',
        'RM0001',
        createMockCallbacks({
          onRematchStarted: () => {
            rematchFired = true;
          }
        })
      );

      session.beginMatch(false);
      session.getGameState().phase = 'COMPLETED_MATCH';

      // 1. Rematch resets match to ACTIVE_MATCH
      session.restartRematch();
      assert.equal(rematchFired, true, 'Rematch callback must fire');
      assert.equal(session.getGameState().phase, 'ACTIVE_MATCH', 'Rematch must transition to ACTIVE_MATCH phase');
      assert.equal(session.getGameState().scorecard.isCompleted, false);
      assert.equal(session.getGameState().scorecard.innings[0]?.runs, 0);

      // 2. Return to Lobby resets phase to LOBBY
      session.resetToLobby();
      assert.equal(session.getGameState().phase, 'LOBBY', 'Must reset to LOBBY phase');
    });
  });

  // =========================================================================
  // 4. SPECTATOR CLIENT ISOLATION
  // =========================================================================
  describe('4. Spectator Client Isolation: Prevents Active Gameplay Inputs', () => {
    test('4.1. Spectator is prevented from bowling, batting, running and fielding', () => {
      const roomManager = new RoomManager();
      const hostRes = roomManager.createRoom('socket_host_1', 'HostPlayer');
      const roomCode = hostRes.roomCode;

      // Join a spectator and release slot so they become a SPECTATOR
      const spectatorRes = roomManager.joinRoom(roomCode, 'socket_spec_1', 'SpectatorFan');
      assert.equal(spectatorRes.success, true);
      roomManager.releaseSlot('socket_spec_1');

      const roomEntry = roomManager.getRoomEntry(roomCode)!;
      assert.equal(roomEntry.state.participants['socket_spec_1'].assignedRole, 'SPECTATOR');

      // 1. Spectator tries to commit bowling delivery -> REJECTED
      const bowlRes = roomManager.handleBowlerCommit('socket_spec_1', {
        bowlerId: 'TEAM_A_player_1',
        targetPitchPoint: { x: 0, y: 0, z: 5 },
        releaseSpeedKmph: 130,
        seamAngleDegrees: 0,
        swingType: 'NONE',
        spinType: 'NONE',
        effortPercentage: 80
      });
      assert.equal(bowlRes.success, false, 'Spectator must be rejected from bowling');
      assert.ok(bowlRes.error?.includes('Spectator'), 'Error must specify spectator restriction');

      // 2. Spectator tries to submit batting shot -> REJECTED
      const batRes = roomManager.handleBatterShot('socket_spec_1', {
        batterId: 'TEAM_B_player_1',
        shotType: 'COVER_DRIVE',
        power: 80,
        directionAngleDeg: 0,
        timingOffsetMs: 0,
        isLofted: false,
        footwork: 'FRONT_FOOT'
      });
      assert.equal(batRes.success, false, 'Spectator must be rejected from batting');
      assert.ok(batRes.error?.includes('Spectator'), 'Error must specify spectator restriction');

      // 3. Spectator tries to call run -> REJECTED
      const runRes = roomManager.handleCallRun('socket_spec_1', 'STRIKER');
      assert.equal(runRes.success, false, 'Spectator must be rejected from calling runs');

      // 4. Spectator tries to submit fielding action -> REJECTED
      const fieldRes = roomManager.handleFieldingAction('socket_spec_1', {
        fielderId: 'TEAM_A_player_2',
        action: 'PICKUP',
        timestamp: Date.now()
      });
      assert.equal(fieldRes.success, false, 'Spectator must be rejected from fielding');

      // 5. Spectator tries to adjust field preset -> REJECTED
      const presetRes = roomManager.applyFieldPreset('socket_spec_1', 'ATTACKING');
      assert.equal(presetRes.success, false, 'Spectator must be rejected from adjusting field presets');
    });
  });

});
