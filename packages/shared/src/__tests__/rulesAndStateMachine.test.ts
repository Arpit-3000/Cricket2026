import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  MatchStateMachine,
  isValidRoomCode,
  validateBowlingIntent,
  validateBattingIntent,
  CRICKET_RULES,
  GROUND_DIMENSIONS
} from '../index.js';

describe('MatchStateMachine', () => {
  it('initializes in WAITING_FOR_PLAYERS phase', () => {
    const fsm = new MatchStateMachine();
    assert.equal(fsm.getPhase(), 'WAITING_FOR_PLAYERS');
  });

  it('permits valid match progression flow', () => {
    const fsm = new MatchStateMachine();
    assert.equal(fsm.transitionMatchPhase('TOSS_IN_PROGRESS'), true);
    assert.equal(fsm.getPhase(), 'TOSS_IN_PROGRESS');

    assert.equal(fsm.transitionMatchPhase('INNINGS_1_IN_PROGRESS'), true);
    assert.equal(fsm.getPhase(), 'INNINGS_1_IN_PROGRESS');

    assert.equal(fsm.transitionMatchPhase('MID_INNINGS_BREAK'), true);
    assert.equal(fsm.getPhase(), 'MID_INNINGS_BREAK');

    assert.equal(fsm.transitionMatchPhase('INNINGS_2_IN_PROGRESS'), true);
    assert.equal(fsm.getPhase(), 'INNINGS_2_IN_PROGRESS');

    assert.equal(fsm.transitionMatchPhase('MATCH_CONCLUDED'), true);
    assert.equal(fsm.getPhase(), 'MATCH_CONCLUDED');
  });

  it('rejects illegal phase skips', () => {
    const fsm = new MatchStateMachine();
    // Cannot jump from WAITING_FOR_PLAYERS directly to INNINGS_2_IN_PROGRESS
    assert.equal(fsm.transitionMatchPhase('INNINGS_2_IN_PROGRESS'), false);
    assert.equal(fsm.getPhase(), 'WAITING_FOR_PLAYERS');
  });

  it('transitions delivery lifecycle correctly', () => {
    const fsm = new MatchStateMachine();
    assert.equal(fsm.getDeliveryPhase(), 'AWAITING_BOWLER_CONFIRM');
    assert.equal(fsm.transitionDeliveryPhase('BOWLER_RUNUP'), true);
    assert.equal(fsm.transitionDeliveryPhase('BALL_RELEASE'), true);
    assert.equal(fsm.transitionDeliveryPhase('BALL_IN_FLIGHT_PRE_BOUNCE'), true);
    assert.equal(fsm.transitionDeliveryPhase('BALL_PITCHED'), true);
    assert.equal(fsm.transitionDeliveryPhase('BAT_INTERACTION'), true);
    assert.equal(fsm.transitionDeliveryPhase('BALL_IN_FIELD'), true);
    assert.equal(fsm.transitionDeliveryPhase('BALL_DEAD'), true);
  });
});

describe('Input Validators', () => {
  it('validates 6-character room codes', () => {
    assert.equal(isValidRoomCode('CRK9A2'), true);
    assert.equal(isValidRoomCode('ABC123'), true);
    assert.equal(isValidRoomCode('short'), false);
    assert.equal(isValidRoomCode('TOOLONG123'), false);
    assert.equal(isValidRoomCode('AB!@#$'), false);
  });

  it('validates bowling delivery limits', () => {
    const validIntent = {
      bowlerId: 'bowler_1',
      targetPitchPoint: { x: 0.1, y: 0, z: 4.5 },
      releaseSpeedKmph: 140,
      swingType: 'OUTSWING' as const,
      spinType: 'NONE' as const,
      seamAngleDegrees: 5,
      effortPercentage: 90
    };
    assert.equal(validateBowlingIntent(validIntent).valid, true);

    const outOfBoundsSpeed = { ...validIntent, releaseSpeedKmph: 220 };
    assert.equal(validateBowlingIntent(outOfBoundsSpeed).valid, false);

    const outOfBoundsPitch = { ...validIntent, targetPitchPoint: { x: 10, y: 0, z: 50 } };
    assert.equal(validateBowlingIntent(outOfBoundsPitch).valid, false);
  });

  it('validates batting shot intent limits', () => {
    const validShot = {
      batterId: 'batter_1',
      shotType: 'COVER_DRIVE' as const,
      power: 80,
      directionAngleDeg: 315,
      timingOffsetMs: 0,
      isLofted: false,
      footwork: 'FRONT_FOOT' as const
    };
    assert.equal(validateBattingIntent(validShot).valid, true);

    const invalidPower = { ...validShot, power: 150 };
    assert.equal(validateBattingIntent(invalidPower).valid, false);

    const invalidAngle = { ...validShot, directionAngleDeg: 400 };
    assert.equal(validateBattingIntent(invalidAngle).valid, false);
  });
});

describe('Cricket Dimensions & Official Rules', () => {
  it('ensures 5 overs default for T5 match specification', () => {
    assert.equal(CRICKET_RULES.DEFAULT_OVERS_PER_INNINGS, 5);
    assert.equal(CRICKET_RULES.LEGAL_BALLS_PER_OVER, 6);
    assert.equal(CRICKET_RULES.MAX_OVERS_PER_BOWLER, 2);
    assert.equal(CRICKET_RULES.MAX_PLAYERS_PER_TEAM, 11);
    assert.equal(CRICKET_RULES.TOTAL_FIELD_POSITIONS, 22);
  });

  it('verifies ICC official pitch and boundary dimensions', () => {
    assert.equal(GROUND_DIMENSIONS.PITCH_LENGTH_METERS, 20.12); // 22 yards
    assert.equal(GROUND_DIMENSIONS.BOUNDARY_RADIUS_METERS, 65.0);
    assert.equal(GROUND_DIMENSIONS.STUMP_HEIGHT_METERS, 0.711);
  });
});
