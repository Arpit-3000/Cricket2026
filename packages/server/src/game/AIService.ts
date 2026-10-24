import {
  AIDifficulty,
  BowlingDeliveryIntent,
  BattingShotIntent,
  FieldingIntent,
  Vector3D,
  ShotType,
  SwingType,
  SpinVariation,
  UmpireSignal
} from '@cricket2026/shared';

export class AIService {
  /**
   * Generates bowling delivery parameters for an AI-controlled bowler.
   */
  public static generateBowlingIntent(
    bowlerId: string,
    difficulty: AIDifficulty,
    isSpinBowler: boolean
  ): BowlingDeliveryIntent {
    // Pitch dimensions: Z runs from -10 to +10, X runs -1.5 to +1.5
    // Good length for fast bowler: Z ~ 4.0 to 6.0m
    const zBase = isSpinBowler ? 3.5 : 5.0;
    const xBase = 0.15; // slightly outside off stump for right hander

    // Add noise based on difficulty
    const variance = difficulty === 'LEGEND' ? 0.1 : difficulty === 'PRO' ? 0.25 : 0.45;
    const xNoise = (Math.random() - 0.5) * variance;
    const zNoise = (Math.random() - 0.5) * variance * 2;

    const baseSpeed = isSpinBowler ? 88 : 138;
    const speedNoise = (Math.random() - 0.5) * 8;

    const swings: SwingType[] = ['NONE', 'OUTSWING', 'INSWING'];
    const spins: SpinVariation[] = isSpinBowler
      ? ['OFF_BREAK', 'LEG_BREAK', 'TOP_SPINNER', 'ARM_BALL']
      : ['NONE'];

    const chosenSwing = isSpinBowler ? 'NONE' : swings[Math.floor(Math.random() * swings.length)];
    const chosenSpin = spins[Math.floor(Math.random() * spins.length)];

    return {
      bowlerId,
      targetPitchPoint: {
        x: Number((xBase + xNoise).toFixed(3)),
        y: 0,
        z: Number((zBase + zNoise).toFixed(3))
      },
      releaseSpeedKmph: Math.round(baseSpeed + speedNoise),
      swingType: chosenSwing,
      spinType: chosenSpin,
      seamAngleDegrees: Math.floor(Math.random() * 15),
      effortPercentage: 85 + Math.floor(Math.random() * 15)
    };
  }

  /**
   * Generates a batting response for an AI batter facing a delivery.
   */
  public static generateBattingIntent(
    batterId: string,
    difficulty: AIDifficulty,
    pitchPoint: Vector3D,
    speedKmph: number
  ): BattingShotIntent {
    // Reaction quality based on difficulty and delivery speed
    const maxTimingErrorMs = difficulty === 'LEGEND' ? 15 : difficulty === 'PRO' ? 35 : 70;
    const speedFactor = speedKmph > 140 ? 1.2 : 1.0;
    const timingOffsetMs = (Math.random() - 0.5) * 2 * maxTimingErrorMs * speedFactor;

    let shotType: ShotType = 'FORWARD_DEFENSIVE';
    let directionAngleDeg = 45;
    let isLofted = false;
    let power = 70;

    // Tactical shot selection based on pitch length
    if (pitchPoint.z < 2.5) {
      // Short ball / bouncer -> Pull or Hook
      shotType = 'PULL_SHOT';
      directionAngleDeg = 240;
      power = 85;
      isLofted = Math.random() > 0.4;
    } else if (pitchPoint.z > 7.0) {
      // Full / Yorker -> Straight drive or defensive dig
      shotType = 'STRAIGHT_DRIVE';
      directionAngleDeg = 0;
      power = 65;
      isLofted = false;
    } else {
      // Good length -> Drive or Cover Drive
      if (pitchPoint.x > 0.2) {
        shotType = 'COVER_DRIVE';
        directionAngleDeg = 315;
      } else {
        shotType = 'ON_DRIVE';
        directionAngleDeg = 45;
      }
      power = 75;
      isLofted = Math.random() > 0.7;
    }

    return {
      batterId,
      shotType,
      power,
      directionAngleDeg,
      timingOffsetMs: Math.round(timingOffsetMs),
      isLofted,
      footwork: pitchPoint.z < 3.5 ? 'BACK_FOOT' : 'FRONT_FOOT'
    };
  }

  /**
   * Generates fielding action for an AI fielder intercepting the ball.
   */
  public static generateFieldingIntent(
    fielderId: string,
    ballPosition: Vector3D,
    fielderPosition: Vector3D
  ): FieldingIntent {
    const dx = ballPosition.x - fielderPosition.x;
    const dz = ballPosition.z - fielderPosition.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    let action: FieldingIntent['action'] = 'SPRINT';
    if (dist < 1.0) {
      action = 'PICKUP';
    } else if (dist < 2.5) {
      action = 'DIVE';
    }

    return {
      fielderId,
      action,
      targetPosition: { x: ballPosition.x, y: 0, z: ballPosition.z },
      throwTargetEnd: Math.random() > 0.5 ? 'STRIKER_END' : 'BOWLER_END'
    };
  }

  /**
   * Automated AI umpire line & lbw evaluation.
   */
  public static evaluateUmpireDecision(
    pitchPoint: Vector3D,
    stumpHitPredicted: boolean,
    batEdgeDetected: boolean
  ): { signal: UmpireSignal; reason: string } {
    if (batEdgeDetected) {
      return { signal: 'NOT_OUT', reason: 'Bat contact confirmed via ultra-edge analysis' };
    }

    if (pitchPoint.x < -1.5) {
      return { signal: 'WIDE', reason: 'Delivery passed outside legal leg boundary line' };
    }

    if (stumpHitPredicted) {
      return { signal: 'OUT', reason: 'Ball tracking confirms delivery hitting the wickets' };
    }

    return { signal: 'NOT_OUT', reason: 'Ball projected to miss the wickets' };
  }
}
