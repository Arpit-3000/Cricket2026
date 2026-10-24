import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { GameSession } from '../game/GameSession.js';
import {
  BowlingDeliveryIntent,
  BattingShotIntent,
  CricketPhysicsEngine,
  CRICKET_RULES
} from '@cricket2026/shared';

describe('Phase 4: Core Cricket Gameplay Engine & Authoritative Physics', () => {

  test('1. Authoritative Physics Engine: Aerodynamic Flight, Pitch Bounce & Speed Bounds', () => {
    const bowlerIntent: BowlingDeliveryIntent = {
      bowlerId: 'TEAM_B_player_11',
      targetPitchPoint: { x: 0.1, y: 0, z: 4.5 },
      releaseSpeedKmph: 142,
      swingType: 'OUTSWING',
      spinType: 'NONE',
      seamAngleDegrees: 12,
      effortPercentage: 90
    };

    const simResult = CricketPhysicsEngine.simulateDelivery(bowlerIntent, null, 'HARD_TURF');

    assert.ok(simResult.trajectory.length > 10, 'Trajectory must contain numerical flight keyframes');
    assert.ok(simResult.pitchPoint.z > 3.0 && simResult.pitchPoint.z < 6.0, 'Pitch point must be in good length zone');
    assert.ok(simResult.impactSpeedKmph > 110, 'Impact speed after aerodynamic drag must be realistic');

    // Keyframes check
    const bounceFrame = simResult.trajectory.find(k => k.hasBounced);
    assert.ok(bounceFrame, 'Trajectory must capture keyframes after turf bounce');
    assert.ok(simResult.pitchPoint.y >= 0 && simResult.pitchPoint.y <= 0.1, 'Pitch point must be on turf surface');
  });

  test('2. Batting Collision & Timing Quality: Sweet Spot vs Mistimed vs Complete Miss', () => {
    const bowlerIntent: BowlingDeliveryIntent = {
      bowlerId: 'TEAM_B_player_11',
      targetPitchPoint: { x: 0.05, y: 0, z: 5.5 },
      releaseSpeedKmph: 135,
      swingType: 'NONE',
      spinType: 'NONE',
      seamAngleDegrees: 0,
      effortPercentage: 85
    };

    // 1. Sweet spot lofted shot (|Δt| = 5ms) -> 6 Runs
    const sweetSpotIntent: BattingShotIntent = {
      batterId: 'TEAM_A_player_1',
      shotType: 'STRAIGHT_DRIVE',
      power: 85,
      directionAngleDeg: 0,
      timingOffsetMs: 5,
      isLofted: true,
      footwork: 'FRONT_FOOT'
    };
    const sweetRes = CricketPhysicsEngine.simulateDelivery(bowlerIntent, sweetSpotIntent);
    assert.equal(sweetRes.outcome.isBoundarySix, true, 'Sweet spot lofted shot with 85 power must clear boundary for 6');
    assert.equal(sweetRes.outcome.batterRuns, 6);
    assert.equal(sweetRes.outcome.totalRuns, 6);

    // 2. Sweet spot ground drive (|Δt| = 10ms) -> 4 Runs
    const groundDriveIntent: BattingShotIntent = {
      batterId: 'TEAM_A_player_1',
      shotType: 'COVER_DRIVE',
      power: 80,
      directionAngleDeg: 315,
      timingOffsetMs: -10,
      isLofted: false,
      footwork: 'FRONT_FOOT'
    };
    const groundRes = CricketPhysicsEngine.simulateDelivery(bowlerIntent, groundDriveIntent);
    assert.equal(groundRes.outcome.isBoundaryFour, true, 'Grounded sweet-spot cover drive must reach boundary for 4');
    assert.equal(groundRes.outcome.batterRuns, 4);

    // 3. Complete miss (|Δt| = 140ms) on stump line -> Clean Bowled
    const stumpDelivery: BowlingDeliveryIntent = {
      bowlerId: 'TEAM_B_player_11',
      targetPitchPoint: { x: 0.02, y: 0, z: 8.0 },
      releaseSpeedKmph: 130,
      swingType: 'NONE',
      spinType: 'NONE',
      seamAngleDegrees: 0,
      effortPercentage: 80
    };
    const missIntent: BattingShotIntent = {
      batterId: 'TEAM_A_player_1',
      shotType: 'FORWARD_DEFENSIVE',
      power: 50,
      directionAngleDeg: 0,
      timingOffsetMs: 140, // very late
      isLofted: false,
      footwork: 'FRONT_FOOT'
    };
    const missRes = CricketPhysicsEngine.simulateDelivery(stumpDelivery, missIntent);
    assert.equal(missRes.outcome.wicket?.dismissalType, 'BOWLED', 'Missing a straight delivery hitting stumps must result in BOWLED');
    assert.equal(missRes.outcome.batterRuns, 0);
  });

  test('3. Extras Adjudication: Wides, No-Balls, and Legal Delivery Counting', () => {
    // 1. Wide outside off stump (x = 1.15m > 0.88m wide mark)
    const wideIntent: BowlingDeliveryIntent = {
      bowlerId: 'TEAM_B_player_11',
      targetPitchPoint: { x: 1.15, y: 0, z: 5.0 },
      releaseSpeedKmph: 130,
      swingType: 'NONE',
      spinType: 'NONE',
      seamAngleDegrees: 0,
      effortPercentage: 80
    };
    const wideRes = CricketPhysicsEngine.simulateDelivery(wideIntent, null);
    assert.equal(wideRes.outcome.extrasType, 'WIDE');
    assert.equal(wideRes.outcome.extrasRuns, 1);
    assert.equal(wideRes.outcome.isLegalDelivery, false, 'Wide must NOT be a legal delivery');

    // 2. No-ball (front-foot overstep)
    const session = new GameSession('room_test_extras', 'EXT123', {
      onStateBroadcast: () => {},
      onTickBroadcast: () => {},
      onDeliveryCompleted: () => {}
    });

    session.beginMatch();
    const state = session.getGameState();
    const innings1 = state.scorecard.innings[0];

    // Simulate Wide in session
    session.executeDeliveryDirectly(wideIntent, null);

    assert.equal(innings1.extras.wides, 1, 'Extras wides must be 1');
    assert.equal(innings1.extras.total, 1, 'Extras total must be 1');
    assert.equal(innings1.ballsInCurrentOver, 0, 'Wide must not increment balls in current over');
    assert.equal(innings1.runs, 1, 'Team score must increment by 1 for wide');

    const striker = innings1.batters.find(b => b.playerId === state.currentStrikerId);
    assert.equal(striker?.ballsFaced, 0, 'Batter must NOT be charged a ball faced for wide');

    const bowler = innings1.bowlers.find(b => b.playerId === state.currentBowlerId);
    assert.equal(bowler?.wides, 1, 'Bowler wides must be 1');
    assert.equal(bowler?.runsConceded, 1, 'Wide is charged to bowler runs conceded');
    assert.equal(bowler?.legalBalls, 0, 'Bowler legal balls must remain 0 after wide');
  });

  test('4. Scorecard Tracking: Strike Rotation, Running Between Wickets, Boundaries & Partnerships', () => {
    const session = new GameSession('room_test_scorecard', 'SCR123', {
      onStateBroadcast: () => {},
      onTickBroadcast: () => {},
      onDeliveryCompleted: () => {}
    });

    session.beginMatch();
    const state = session.getGameState();
    const innings1 = state.scorecard.innings[0];
    const initialStrikerId = state.currentStrikerId;
    const initialNonStrikerId = state.currentNonStrikerId;

    // Ball 1: Sweet spot boundary 4
    const bowlerDelivery: BowlingDeliveryIntent = {
      bowlerId: state.currentBowlerId,
      targetPitchPoint: { x: 0.1, y: 0, z: 5.0 },
      releaseSpeedKmph: 130,
      swingType: 'NONE',
      spinType: 'NONE',
      seamAngleDegrees: 0,
      effortPercentage: 80
    };
    const fourShot: BattingShotIntent = {
      batterId: initialStrikerId,
      shotType: 'COVER_DRIVE',
      power: 80,
      directionAngleDeg: 315,
      timingOffsetMs: -10,
      isLofted: false,
      footwork: 'FRONT_FOOT'
    };

    session.executeDeliveryDirectly(bowlerDelivery, fourShot);

    assert.equal(innings1.runs, 4);
    assert.equal(innings1.ballsInCurrentOver, 1);
    assert.equal(innings1.currentPartnershipRuns, 4);
    assert.equal(innings1.currentPartnershipBalls, 1);

    const striker = innings1.batters.find(b => b.playerId === initialStrikerId)!;
    assert.equal(striker.runs, 4);
    assert.equal(striker.ballsFaced, 1);
    assert.equal(striker.fours, 1);
    assert.equal(striker.strikeRate, 400.0);
    // Strike did not rotate on 4 runs
    assert.equal(state.currentStrikerId, initialStrikerId);

    // Ball 2: Push for a single (1 run) -> Odd runs rotates strike
    const singleShot: BattingShotIntent = {
      batterId: initialStrikerId,
      shotType: 'ON_DRIVE',
      power: 55,
      directionAngleDeg: 45,
      timingOffsetMs: 30, // good stroke
      isLofted: false,
      footwork: 'FRONT_FOOT'
    };
    session.executeDeliveryDirectly(bowlerDelivery, singleShot);

    assert.equal(innings1.ballsInCurrentOver, 2);
    // Strike should have rotated to non-striker
    assert.equal(state.currentStrikerId, initialNonStrikerId, 'Strike must rotate to other batter on single run');
  });

  test('5. Wickets: Bowled, Caught & LBW Adjudications, Fall of Wickets and Next Batter', () => {
    const session = new GameSession('room_test_wickets', 'WKT123', {
      onStateBroadcast: () => {},
      onTickBroadcast: () => {},
      onDeliveryCompleted: () => {}
    });

    session.beginMatch();
    const state = session.getGameState();
    const innings1 = state.scorecard.innings[0];
    const initialStrikerId = state.currentStrikerId;

    // Delivery 1: Bowled dismissal
    const bowlerDelivery: BowlingDeliveryIntent = {
      bowlerId: state.currentBowlerId,
      targetPitchPoint: { x: 0.05, y: 0, z: 5.5 },
      releaseSpeedKmph: 138,
      swingType: 'NONE',
      spinType: 'NONE',
      seamAngleDegrees: 0,
      effortPercentage: 90
    };
    const defensiveMiss: BattingShotIntent = {
      batterId: initialStrikerId,
      shotType: 'FORWARD_DEFENSIVE',
      power: 40,
      directionAngleDeg: 0,
      timingOffsetMs: 150, // complete miss
      isLofted: false,
      footwork: 'FRONT_FOOT'
    };

    session.executeDeliveryDirectly(bowlerDelivery, defensiveMiss);

    assert.equal(innings1.wickets, 1, 'Innings wickets must be 1');
    assert.equal(innings1.fallOfWickets.length, 1, 'Fall of wickets record must be created');
    assert.equal(innings1.fallOfWickets[0].wicketNumber, 1);
    assert.equal(innings1.currentPartnershipRuns, 0, 'Partnership runs must reset on wicket');
    assert.equal(innings1.currentPartnershipBalls, 0, 'Partnership balls must reset on wicket');

    const dismissedBatter = innings1.batters.find(b => b.playerId === initialStrikerId)!;
    assert.equal(dismissedBatter.isOut, true, 'Dismissed batter must be marked isOut = true');
    assert.equal(dismissedBatter.onStrike, false, 'Dismissed batter cannot be on strike');

    // Next batter from team playing XI must enter the crease
    assert.notEqual(state.currentStrikerId, initialStrikerId, 'New batter must replace the dismissed striker');
    const newStriker = innings1.batters.find(b => b.playerId === state.currentStrikerId);
    assert.ok(newStriker, 'New batter must be added to innings scorecard');
    assert.equal(newStriker?.isOut, false);
    assert.equal(newStriker?.onStrike, true);
  });

  test('6. Over Progression, Maiden Over Adjudication & Bowler Rotation', () => {
    let overEndedEvent: any = null;
    const session = new GameSession('room_test_overs', 'OVR123', {
      onStateBroadcast: () => {},
      onTickBroadcast: () => {},
      onDeliveryCompleted: () => {},
      onOverEnded: (payload) => {
        overEndedEvent = payload;
      }
    });

    session.beginMatch();
    const state = session.getGameState();
    const innings1 = state.scorecard.innings[0];
    const firstBowlerId = state.currentBowlerId;

    // Bowl 6 consecutive dot balls (defensive blocks with 0 power) -> Maiden Over
    const dotDelivery: BowlingDeliveryIntent = {
      bowlerId: firstBowlerId,
      targetPitchPoint: { x: 0.15, y: 0, z: 5.0 },
      releaseSpeedKmph: 125,
      swingType: 'NONE',
      spinType: 'NONE',
      seamAngleDegrees: 0,
      effortPercentage: 75
    };
    const blockShot: BattingShotIntent = {
      batterId: state.currentStrikerId,
      shotType: 'FORWARD_DEFENSIVE',
      power: 20,
      directionAngleDeg: 0,
      timingOffsetMs: 0,
      isLofted: false,
      footwork: 'FRONT_FOOT'
    };

    for (let i = 0; i < 6; i++) {
      session.executeDeliveryDirectly(dotDelivery, blockShot);
    }

    assert.equal(innings1.oversCompleted, 1, 'Innings must have 1 completed over');
    assert.equal(innings1.ballsInCurrentOver, 0, 'Balls in current over must reset to 0 after 6 balls');
    assert.ok(overEndedEvent, 'onOverEnded callback must be invoked');
    assert.equal(overEndedEvent.overIndex, 1);

    const firstBowler = innings1.bowlers.find(b => b.playerId === firstBowlerId)!;
    assert.equal(firstBowler.legalBalls, 6);
    assert.equal(firstBowler.overs, '1.0');
    assert.equal(firstBowler.maidens, 1, 'Bowler must be credited with 1 maiden over for 0 runs conceded');
    assert.equal(firstBowler.runsConceded, 0);

    // Bowler rotation check: bowler must rotate after the over
    assert.notEqual(state.currentBowlerId, firstBowlerId, 'Bowler must change at end of the over');
  });

  test('7. 5-Over Innings Transition & Target Chase with Win Adjudication', () => {
    let inningsTransitionPayload: any = null;
    let matchFinishedPayload: any = null;

    const session = new GameSession('room_test_match_finish', 'FIN123', {
      onStateBroadcast: () => {},
      onTickBroadcast: () => {},
      onDeliveryCompleted: () => {},
      onInningsTransition: (payload) => {
        inningsTransitionPayload = payload;
      },
      onMatchFinished: (payload) => {
        matchFinishedPayload = payload;
      }
    });

    session.beginMatch();
    const state = session.getGameState();
    const teamAId = state.battingTeamId; // Team A bats 1st
    const teamBId = state.bowlingTeamId; // Team B bowls 1st

    // Bowl 5 complete overs (30 legal balls) with 1 single on ball 1 of each over (5 runs total)
    for (let over = 0; over < CRICKET_RULES.DEFAULT_OVERS_PER_INNINGS; over++) {
      for (let ball = 0; ball < 6; ball++) {
        const bowlerIntent: BowlingDeliveryIntent = {
          bowlerId: state.currentBowlerId,
          targetPitchPoint: { x: 0.1, y: 0, z: 5.0 },
          releaseSpeedKmph: 125,
          swingType: 'NONE',
          spinType: 'NONE',
          seamAngleDegrees: 0,
          effortPercentage: 75
        };
        // 1 single per over on ball 0, rest 0 runs
        const isRun = ball === 0;
        const shot: BattingShotIntent = {
          batterId: state.currentStrikerId,
          shotType: isRun ? 'ON_DRIVE' : 'FORWARD_DEFENSIVE',
          power: isRun ? 55 : 20,
          directionAngleDeg: 0,
          timingOffsetMs: isRun ? 30 : 0,
          isLofted: false,
          footwork: 'FRONT_FOOT'
        };
        session.executeDeliveryDirectly(bowlerIntent, shot);
      }
    }

    // First innings must be completed after 5 overs
    assert.ok(inningsTransitionPayload, 'Innings transition event must be triggered');
    assert.equal(inningsTransitionPayload.nextInnings, 2);
    const target = inningsTransitionPayload.target;
    assert.equal(target, state.scorecard.innings[0].runs + 1, 'Target must equal Innings 1 runs + 1');

    // Verify swap of batting and bowling teams
    assert.equal(state.currentInningsNumber, 2);
    assert.equal(state.battingTeamId, teamBId, 'Team B must now be batting');
    assert.equal(state.bowlingTeamId, teamAId, 'Team A must now be bowling');

    const innings2 = state.scorecard.innings[1]!;
    assert.equal(innings2.target, target);

    // Innings 2: Team B hits a 6 on the first ball to chase down the target (Target = 6, 6 runs > target)
    const chaseBowler: BowlingDeliveryIntent = {
      bowlerId: state.currentBowlerId,
      targetPitchPoint: { x: 0.05, y: 0, z: 5.5 },
      releaseSpeedKmph: 130,
      swingType: 'NONE',
      spinType: 'NONE',
      seamAngleDegrees: 0,
      effortPercentage: 80
    };
    const sixHit: BattingShotIntent = {
      batterId: state.currentStrikerId,
      shotType: 'STRAIGHT_DRIVE',
      power: 90,
      directionAngleDeg: 0,
      timingOffsetMs: 5, // sweet spot
      isLofted: true,
      footwork: 'FRONT_FOOT'
    };

    session.executeDeliveryDirectly(chaseBowler, sixHit);

    // Match must finish immediately upon target reached
    assert.ok(matchFinishedPayload, 'Match finished callback must be triggered upon reaching target');
    assert.equal(matchFinishedPayload.winnerTeamId, teamBId, 'Chasing team (Team B) must be declared the match winner');
    assert.match(matchFinishedPayload.commentary, /won by 10 wickets/, 'Commentary must reflect win by 10 wickets');
    assert.equal(state.phase, 'MATCH_CONCLUDED');
    assert.equal(state.scorecard.isCompleted, true);
  });
});
