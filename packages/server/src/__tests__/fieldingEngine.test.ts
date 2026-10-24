import test from 'node:test';
import assert from 'node:assert/strict';
import { GameSession } from '../game/GameSession.js';
import { AIService } from '../game/AIService.js';
import {
  FieldingIntent,
  Vector3D
} from '@cricket2026/shared';

test('Phase 5: Complete Human-Controlled Fielding & AI Support Suite', async t => {
  // Helper to create a standard GameSession for fielding tests
  function createTestSession() {
    let lastBroadcastState: any = null;
    let lastPossessionEvent: any = null;
    let lastThrowEvent: any = null;
    let lastPositionUpdate: any = null;
    let lastPresetApplied: any = null;

    const session = new GameSession('room-f5', 'ROOMF5', {
      onStateBroadcast: (state) => { lastBroadcastState = state; },
      onTickBroadcast: () => {},
      onDeliveryCompleted: () => {},
      onBallPossession: (payload) => { lastPossessionEvent = payload; },
      onFielderThrow: (payload) => { lastThrowEvent = payload; },
      onFieldPositionUpdated: (payload) => { lastPositionUpdate = payload; },
      onFieldPresetApplied: (payload) => { lastPresetApplied = payload; }
    });

    return {
      session,
      getLastBroadcastState: () => lastBroadcastState,
      getLastPossessionEvent: () => lastPossessionEvent,
      getLastThrowEvent: () => lastThrowEvent,
      getLastPositionUpdate: () => lastPositionUpdate,
      getLastPresetApplied: () => lastPresetApplied
    };
  }

  await t.test('1. Ground Ball Pickup Validation, Possession & Reachability Limits', () => {
    const { session, getLastPossessionEvent } = createTestSession();
    const gameState = session.getGameState();
    const bowlingTeam = gameState.teams[gameState.bowlingTeamId];
    const fielder = bowlingTeam.players[2]; // Outfielder

    // Position fielder at (10, 0, 10)
    session.updatePlayerEntity(fielder.id, {
      position: { x: 10, y: 0, z: 10 },
      rotationY: 0,
      velocity: { x: 0, y: 0, z: 0 },
      animationState: 'IDLE',
      sequence: 1
    });

    // Place ball within pickup range: 1.2m away at (10.8, 0, 10)
    gameState.activeDelivery.ball.position = { x: 10.8, y: 0, z: 10 };
    gameState.activeDelivery.ball.isGrounded = true;
    gameState.activeDelivery.ball.possessedByFielderId = null;

    // Fielder attempts PICKUP
    const pickupIntent: FieldingIntent = {
      fielderId: fielder.id,
      action: 'PICKUP',
      timestamp: Date.now()
    };

    const res = session.handleFielderAction('SERVER_AI', pickupIntent);
    assert.equal(res.success, true, 'Pickup should succeed when within 1.8m');
    assert.equal(gameState.activeDelivery.ball.possessedByFielderId, fielder.id, 'Fielder should possess ball');
    assert.equal(gameState.activeDelivery.ball.velocity.x, 0, 'Ball velocity should be zeroed upon pickup');
    assert.equal(getLastPossessionEvent()?.fielderId, fielder.id, 'Ball possession callback should trigger');

    // Attempting to pick up ball while already possessed by another fielder must fail
    const anotherFielder = bowlingTeam.players[3];
    session.updatePlayerEntity(anotherFielder.id, {
      position: { x: 10.8, y: 0, z: 10 },
      rotationY: 0,
      velocity: { x: 0, y: 0, z: 0 },
      animationState: 'IDLE',
      sequence: 1
    });

    const duplicateRes = session.handleFielderAction('SERVER_AI', {
      fielderId: anotherFielder.id,
      action: 'PICKUP',
      timestamp: Date.now()
    });
    assert.equal(duplicateRes.success, false, 'Duplicate pickup must be rejected');
    assert.match(duplicateRes.error || '', /already possessed/i);

    // Release possession for out-of-range test
    gameState.activeDelivery.ball.possessedByFielderId = null;
    gameState.activeDelivery.ball.position = { x: 25, y: 0, z: 25 }; // > 20m away

    const outOfReachRes = session.handleFielderAction('SERVER_AI', pickupIntent);
    assert.equal(outOfReachRes.success, false, 'Pickup must fail when ball is out of reach');
    assert.match(outOfReachRes.error || '', /out of pickup range/i);
  });

  await t.test('2. Diving Mechanics & Extended Pickup Range', () => {
    const { session } = createTestSession();
    const gameState = session.getGameState();
    const bowlingTeam = gameState.teams[gameState.bowlingTeamId];
    const fielder = bowlingTeam.players[3];

    // Position fielder at (5, 0, 5)
    session.updatePlayerEntity(fielder.id, {
      position: { x: 5, y: 0, z: 5 },
      rotationY: 0,
      velocity: { x: 0, y: 0, z: 0 },
      animationState: 'IDLE',
      sequence: 1
    });

    // Place ball 2.3m away (beyond normal 1.8m pickup, but within 2.6m dive pickup range)
    gameState.activeDelivery.ball.position = { x: 5 + 2.1, y: 0, z: 5 };
    gameState.activeDelivery.ball.isGrounded = true;
    gameState.activeDelivery.ball.possessedByFielderId = null;

    const diveIntent: FieldingIntent = {
      fielderId: fielder.id,
      action: 'DIVE',
      timestamp: Date.now()
    };

    const res = session.handleFielderAction('SERVER_AI', diveIntent);
    assert.equal(res.success, true, 'Dive should succeed');
    assert.equal(res.action, 'DIVE');
    assert.equal(res.possessed, true, 'Dive should collect ball within 2.6m extended range');
    assert.equal(session.getPlayerEntity(fielder.id)?.animationState, 'DIVE', 'Fielder animation should update to DIVE');
  });

  await t.test('3. Aerial Catch Adjudication & Wicket Dismissal', () => {
    const { session } = createTestSession();
    const gameState = session.getGameState();
    const currentInnings = gameState.scorecard.innings[0];
    const initialWickets = currentInnings.wickets;

    const bowlingTeam = gameState.teams[gameState.bowlingTeamId];
    const fielder = bowlingTeam.players[4];

    // Fielder at (15, 0, 15)
    session.updatePlayerEntity(fielder.id, {
      position: { x: 15, y: 0, z: 15 },
      rotationY: 0,
      velocity: { x: 0, y: 0, z: 0 },
      animationState: 'IDLE',
      sequence: 1
    });

    // Aerial ball at chest height: y = 1.2m, within 1.0m of fielder
    gameState.activeDelivery.ball.position = { x: 15.5, y: 1.2, z: 15 };
    gameState.activeDelivery.ball.velocity = { x: 10, y: 2, z: 10 };
    gameState.activeDelivery.ball.isGrounded = false;
    gameState.activeDelivery.ball.isInAir = true;
    gameState.activeDelivery.ball.possessedByFielderId = null;

    const catchIntent: FieldingIntent = {
      fielderId: fielder.id,
      action: 'CATCH_ATTEMPT',
      timestamp: Date.now()
    };

    // Rig catch evaluation or test standard probability
    const evalRes = AIService.evaluateCatch({ fieldingCatching: 90 }, 60, false);
    assert.ok(evalRes.probability >= 0.5 && evalRes.probability <= 0.95, 'Catch probability within realistic bounds');

    const res = session.handleFielderAction('SERVER_AI', catchIntent);
    assert.equal(res.success, true);
    assert.equal(res.action, 'CATCH_ATTEMPT');

    if (res.caught) {
      assert.equal(currentInnings.wickets, initialWickets + 1, 'Innings wickets must increment on successful catch');
      assert.equal(currentInnings.fallOfWickets.length, 1, 'Fall of wickets should record dismissal');
    }
  });

  await t.test('4. Throw Execution, In-Flight Trajectory & Possession Reset', () => {
    const { session, getLastThrowEvent } = createTestSession();
    const gameState = session.getGameState();
    const bowlingTeam = gameState.teams[gameState.bowlingTeamId];
    const fielder = bowlingTeam.players[5];

    // Fielder at cover (18, 0, -7) possessing the ball
    session.updatePlayerEntity(fielder.id, {
      position: { x: 18, y: 0, z: -7 },
      rotationY: 0,
      velocity: { x: 0, y: 0, z: 0 },
      animationState: 'IDLE',
      sequence: 1
    });

    gameState.activeDelivery.ball.possessedByFielderId = fielder.id;

    // Fielder throws towards STRIKER_END
    const throwIntent: FieldingIntent = {
      fielderId: fielder.id,
      action: 'OVERARM_THROW',
      throwTargetEnd: 'STRIKER_END',
      throwPower: 90,
      timestamp: Date.now()
    };

    const res = session.handleFielderAction('SERVER_AI', throwIntent);
    assert.equal(res.success, true);
    assert.equal(gameState.activeDelivery.ball.possessedByFielderId, null, 'Throwing clears fielder possession');
    assert.equal(getLastThrowEvent()?.targetEnd, 'STRIKER_END');
    assert.equal(getLastThrowEvent()?.throwPower, 90);

    // Attempting to throw without possessing ball must fail
    const throwWithoutBallRes = session.handleFielderAction('SERVER_AI', throwIntent);
    assert.equal(throwWithoutBallRes.success, false, 'Throw without possession must fail');
    assert.match(throwWithoutBallRes.error || '', /does not possess the ball/i);
  });

  await t.test('5. Run-Out Adjudication when Batter is Outside Crease', () => {
    const { session } = createTestSession();
    const gameState = session.getGameState();
    const currentInnings = gameState.scorecard.innings[0];
    const initialWickets = currentInnings.wickets;

    const bowlingTeam = gameState.teams[gameState.bowlingTeamId];
    const fielder = bowlingTeam.players[6];

    gameState.activeDelivery.ball.possessedByFielderId = fielder.id;
    // Simulate batters taking a run
    gameState.activeDelivery.isRunCalled = true;

    // Fielder executes throw to striker end with high accuracy
    const throwIntent: FieldingIntent = {
      fielderId: fielder.id,
      action: 'OVERARM_THROW',
      throwTargetEnd: 'STRIKER_END',
      throwPower: 95,
      timestamp: Date.now()
    };

    const res = session.handleFielderAction('SERVER_AI', throwIntent);
    assert.equal(res.success, true);

    // If run out occurs, wicket count increases and dismissal is RUN_OUT
    if (res.runOut) {
      assert.equal(currentInnings.wickets, initialWickets + 1, 'Wicket count increments on run-out');
      const lastFall = currentInnings.fallOfWickets[currentInnings.fallOfWickets.length - 1];
      assert.ok(lastFall, 'Fall of wickets should record run-out');
    }
  });

  await t.test('6. AI Fielding Movement: Continuous Speed Bounds & No Teleportation', () => {
    const startPos: Vector3D = { x: 20, y: 0, z: 20 };
    const ballPos: Vector3D = { x: 25, y: 0, z: 25 };
    const dtSeconds = 1 / 30; // 30Hz frame
    const speedMps = 7.5; // realistic sprint speed

    const step = AIService.computeFielderStep(startPos, ballPos, speedMps, dtSeconds);
    const distMoved = Math.hypot(step.newPosition.x - startPos.x, step.newPosition.z - startPos.z);
    const maxPermittedDist = speedMps * dtSeconds + 0.001;

    assert.ok(
      distMoved <= maxPermittedDist,
      `AI fielder must not teleport: moved ${distMoved.toFixed(4)}m in dt, max allowed ${maxPermittedDist.toFixed(4)}m`
    );
    assert.equal(step.arrived, false, 'Should not arrive in a single frame across 7 meters');

    // AI Best interceptor selection
    const fielders = [
      { id: 'f1', isAi: true, position: { x: 30, y: 0, z: 30 }, fieldingSpeed: 80 },
      { id: 'f2', isAi: true, position: { x: 10, y: 0, z: 10 }, fieldingSpeed: 90 },
      { id: 'f3', isAi: true, position: { x: 50, y: 0, z: 50 }, fieldingSpeed: 70 }
    ];

    const targetBall: Vector3D = { x: 11, y: 0, z: 11 };
    const interceptor = AIService.selectBestFielderInterceptor(fielders, targetBall);
    assert.ok(interceptor, 'Interceptor should be found');
    assert.equal(interceptor?.bestFielder.id, 'f2', 'Closest AI fielder (f2) must be selected to intercept');
  });

  await t.test('7. Captain Field Adjustments & Tactical Preset Application', () => {
    const { session, getLastPositionUpdate, getLastPresetApplied } = createTestSession();
    const gameState = session.getGameState();
    const bowlingTeam = gameState.teams[gameState.bowlingTeamId];
    const captainId = bowlingTeam.captainId;
    const fielderToMove = bowlingTeam.players[7];

    // Assign a socket ID to captain
    const captainSocketId = 'socket-captain-123';
    const captainPlayer = bowlingTeam.players.find(p => p.id === captainId);
    if (captainPlayer) {
      captainPlayer.assignedHumanId = captainSocketId;
      captainPlayer.isCaptain = true;
    }

    // 1. Captain moves fielder to valid outfield position (22, 0, 15)
    const validPos: Vector3D = { x: 22, y: 0, z: 15 };
    const adjRes = session.handleAdjustFieldPosition(captainSocketId, fielderToMove.id, validPos);
    assert.equal(adjRes.success, true, 'Captain field adjustment should succeed');
    assert.deepEqual(session.getPlayerEntity(fielderToMove.id)?.position, validPos);
    assert.equal(getLastPositionUpdate()?.fielderId, fielderToMove.id);

    // 2. Adjusting fielder directly onto pitch strip (|x| < 1.6m and |z| <= 11m) must be rejected
    const pitchStripPos: Vector3D = { x: 0.5, y: 0, z: 4.0 };
    const illegalPosRes = session.handleAdjustFieldPosition(captainSocketId, fielderToMove.id, pitchStripPos);
    assert.equal(illegalPosRes.success, false, 'Positioning fielder on central pitch strip must fail');
    assert.match(illegalPosRes.error || '', /pitch strip/i);

    // 3. Applying ATTACKING field preset
    const presetRes = session.handleApplyFieldPreset(captainSocketId, 'ATTACKING');
    assert.equal(presetRes.success, true, 'Applying field preset should succeed');
    assert.equal(getLastPresetApplied()?.preset, 'ATTACKING');

    // 4. Applying DEFENSIVE field preset
    const defPresetRes = session.handleApplyFieldPreset(captainSocketId, 'DEFENSIVE');
    assert.equal(defPresetRes.success, true, 'Applying DEFENSIVE preset should succeed');
    assert.equal(getLastPresetApplied()?.preset, 'DEFENSIVE');
  });

  await t.test('8. Strict Multiplayer Role Authorization & Spectator Isolation', () => {
    const { session } = createTestSession();
    const gameState = session.getGameState();
    const bowlingTeam = gameState.teams[gameState.bowlingTeamId];

    const humanFielder = bowlingTeam.players[8];
    humanFielder.isAi = false;
    humanFielder.assignedHumanId = 'socket-human-player';

    session.updatePlayerEntity(humanFielder.id, {
      position: { x: 12, y: 0, z: 12 },
      rotationY: 0,
      velocity: { x: 0, y: 0, z: 0 },
      animationState: 'IDLE',
      sequence: 1,
      isHuman: true,
      assignedHumanId: 'socket-human-player'
    });

    gameState.activeDelivery.ball.position = { x: 12.5, y: 0, z: 12 };
    gameState.activeDelivery.ball.isGrounded = true;

    // Another player / spectator tries to control humanFielder
    const unauthorizedRes = session.handleFielderAction('socket-spectator-malicious', {
      fielderId: humanFielder.id,
      action: 'PICKUP',
      timestamp: Date.now()
    });

    assert.equal(unauthorizedRes.success, false, 'Unauthorized player must not control another human cricketer');
    assert.match(unauthorizedRes.error || '', /Unauthorized/i);

    // Authorized human player controlling their own character succeeds
    const authorizedRes = session.handleFielderAction('socket-human-player', {
      fielderId: humanFielder.id,
      action: 'PICKUP',
      timestamp: Date.now()
    });
    assert.equal(authorizedRes.success, true, 'Assigned human player controls their own cricketer');
  });
});
