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
    fielderPosition: Vector3D,
    isInAir: boolean = false,
    ballHeight: number = 0
  ): FieldingIntent {
    const dx = ballPosition.x - fielderPosition.x;
    const dz = ballPosition.z - fielderPosition.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    let action: FieldingIntent['action'] = 'SPRINT';
    if (dist <= 1.4) {
      action = isInAir && ballHeight >= 0.35 && ballHeight <= 2.4 ? 'CATCH_ATTEMPT' : 'PICKUP';
    } else if (dist <= 2.5) {
      action = 'DIVE';
    }

    const throwTargetEnd: 'STRIKER_END' | 'BOWLER_END' =
      Math.hypot(ballPosition.x, ballPosition.z - 10.06) <= Math.hypot(ballPosition.x, ballPosition.z + 10.06)
        ? 'STRIKER_END'
        : 'BOWLER_END';

    return {
      fielderId,
      action,
      targetPosition: { x: ballPosition.x, y: 0, z: ballPosition.z },
      throwTargetEnd,
      throwPower: 85
    };
  }

  /**
   * Selects the most optimal AI fielder to intercept the ball.
   * If an active human fielder is already close to the ball, AI avoids stealing human opportunity.
   */
  public static selectBestFielderInterceptor(
    fielders: Array<{
      id: string;
      isAi: boolean;
      position: Vector3D;
      fieldingSpeed?: number;
      fieldingCatching?: number;
      throwAccuracy?: number;
    }>,
    ballPosition: Vector3D
  ): { bestFielder: (typeof fielders)[0]; distance: number } | null {
    const aiCandidates = fielders.filter(f => f.isAi);
    if (aiCandidates.length === 0) return null;

    // Check if any human is closer than 2.0m (human priority)
    const humanFielders = fielders.filter(f => !f.isAi);
    for (const h of humanFielders) {
      const hDist = Math.hypot(ballPosition.x - h.position.x, ballPosition.z - h.position.z);
      if (hDist < 2.0) {
        return null;
      }
    }

    let bestFielder: (typeof fielders)[0] | null = null;
    let minScore = Infinity;

    for (const f of aiCandidates) {
      const dist = Math.hypot(ballPosition.x - f.position.x, ballPosition.z - f.position.z);
      const speed = f.fieldingSpeed ? 6.5 + (f.fieldingSpeed / 100) * 2.3 : 7.2;
      const estimatedTime = dist / speed;
      if (estimatedTime < minScore) {
        minScore = estimatedTime;
        bestFielder = f;
      }
    }

    if (!bestFielder) return null;
    const distance = Math.hypot(ballPosition.x - bestFielder.position.x, ballPosition.z - bestFielder.position.z);
    return { bestFielder, distance };
  }

  /**
   * Smoothly steps a fielder toward target position without teleporting.
   */
  public static computeFielderStep(
    currentPos: Vector3D,
    targetPos: Vector3D,
    speedMps: number,
    dtSeconds: number
  ): { newPosition: Vector3D; rotationY: number; arrived: boolean } {
    const dx = targetPos.x - currentPos.x;
    const dz = targetPos.z - currentPos.z;
    const dist = Math.hypot(dx, dz);

    const maxMove = speedMps * dtSeconds;
    const rotationY = Math.atan2(dx, dz);

    if (dist <= maxMove || dist < 0.05) {
      return {
        newPosition: { x: targetPos.x, y: 0, z: targetPos.z },
        rotationY,
        arrived: true
      };
    }

    const stepRatio = maxMove / dist;
    return {
      newPosition: {
        x: currentPos.x + dx * stepRatio,
        y: 0,
        z: currentPos.z + dz * stepRatio
      },
      rotationY,
      arrived: false
    };
  }

  /**
   * Evaluates catch success based on fielder attributes, ball speed, and dive state.
   * AI never guarantees catches (never 100%, never 0%).
   */
  public static evaluateCatch(
    attributes: { fieldingCatching?: number } | undefined,
    ballSpeedKmph: number,
    isDiving: boolean
  ): { caught: boolean; probability: number } {
    const catchSkill = attributes?.fieldingCatching ?? 75;
    let prob = 0.55 + (catchSkill / 100) * 0.33;

    if (isDiving) prob -= 0.15;
    if (ballSpeedKmph > 110) prob -= 0.12;

    prob = Math.max(0.25, Math.min(0.90, prob));
    const roll = Math.random();
    return { caught: roll <= prob, probability: Number(prob.toFixed(2)) };
  }

  /**
   * Determines best throw target end (STRIKER_END or BOWLER_END) based on ball position.
   */
  public static decideThrowTarget(ballPosition: Vector3D): 'STRIKER_END' | 'BOWLER_END' {
    const distToStriker = Math.hypot(ballPosition.x, ballPosition.z - 10.06);
    const distToBowler = Math.hypot(ballPosition.x, ballPosition.z + 10.06);
    return distToStriker <= distToBowler ? 'STRIKER_END' : 'BOWLER_END';
  }

  /**
   * Evaluates run-out hit probability and whether throw hits wickets.
   */
  public static evaluateRunOut(
    throwAccuracy: number = 75,
    isDirectHitAttempt: boolean = true
  ): { isDirectHit: boolean; hitStumps: boolean } {
    const accuracy = Math.max(30, Math.min(95, throwAccuracy));
    const hitThreshold = isDirectHitAttempt ? accuracy * 0.75 : accuracy * 0.90;
    const roll = Math.random() * 100;
    return {
      isDirectHit: isDirectHitAttempt && roll < hitThreshold,
      hitStumps: roll < hitThreshold
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
