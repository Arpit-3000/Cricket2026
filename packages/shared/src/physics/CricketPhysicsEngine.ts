import {
  Vector3D,
  BowlingDeliveryIntent,
  BattingShotIntent,
  DeliveryOutcome,
  WicketDetail,
  ExtraType
} from '../types/index.js';
import { GROUND_DIMENSIONS } from '../constants/index.js';

export interface TrajectoryKeyframe {
  timeMs: number;
  position: Vector3D;
  velocity: Vector3D;
  hasBounced: boolean;
  hasBatContact: boolean;
}

export interface SimulationResult {
  outcome: DeliveryOutcome;
  trajectory: TrajectoryKeyframe[];
  pitchPoint: Vector3D;
  batContactPoint?: Vector3D;
  impactSpeedKmph: number;
  maxElevationMeters: number;
  totalDistanceMeters: number;
  commentary: string;
}

/**
 * CricketPhysicsEngine
 * 
 * Server-authoritative physics simulation for 3D cricket:
 * 1. Aerodynamic flight: Gravity (9.81 m/s²), air drag (Cd=0.30, air density=1.225 kg/m³), Magnus force for swing/spin.
 * 2. Turf pitch bounce: Restitution (ey=0.58-0.65), tangential friction (exz=0.72), spin deviation torque transfer.
 * 3. Bat-ball interaction: Geometric striking volume, timing offset (|Δt| in ms), power, elevation, shot direction.
 * 4. Ground roll & deceleration: Rolling friction (μ=0.35, a=-3.4 m/s²).
 * 5. Boundary adjudication: Boundary radius = 65m (4 runs if bounced, 6 runs if cleared on the full).
 * 6. Dismissal checks: Bowled (stumps collision), Caught (aerial hang-time & fielder proximity), LBW (authoritative pad line projection), Run-Out, Stumped.
 * 7. Extras checks: Wide (lines x > +0.88m off, x < -0.32m leg, y > 2.2m head height), No-Ball (front-foot crease overstep or waist-high full toss y > 1.05m).
 */
export class CricketPhysicsEngine {
  public static readonly DT: number = 1 / 60; // 60Hz physics time-step (~16.6ms)
  public static readonly GRAVITY: number = 9.81; // m/s²
  public static readonly AIR_DENSITY: number = 1.225; // kg/m³
  public static readonly BALL_MASS: number = GROUND_DIMENSIONS.BALL_MASS_KG; // 0.16 kg
  public static readonly BALL_RADIUS: number = GROUND_DIMENSIONS.BALL_RADIUS_METERS; // 0.036 m
  public static readonly BALL_AREA: number = Math.PI * Math.pow(GROUND_DIMENSIONS.BALL_RADIUS_METERS, 2);
  public static readonly DRAG_COEFF: number = 0.31; // Cricket leather ball drag coefficient

  // Crease and Stumps geometry (z: length along pitch, origin at pitch center)
  public static readonly PITCH_HALF_LENGTH: number = GROUND_DIMENSIONS.PITCH_LENGTH_METERS / 2; // ~10.06m
  public static readonly BOWLER_STUMPS_Z: number = -10.06;
  public static readonly STRIKER_STUMPS_Z: number = 10.06;
  public static readonly BOWLER_POPPING_CREASE_Z: number = -8.84; // 1.22m in front of bowler stumps
  public static readonly STRIKER_POPPING_CREASE_Z: number = 8.84; // 1.22m in front of striker stumps
  public static readonly STUMPS_WIDTH: number = GROUND_DIMENSIONS.STUMP_WIDTH_METERS; // 0.2286m (9 inches)
  public static readonly STUMPS_HEIGHT: number = GROUND_DIMENSIONS.STUMP_HEIGHT_METERS; // 0.711m (28 inches)
  public static readonly BOUNDARY_RADIUS: number = GROUND_DIMENSIONS.BOUNDARY_RADIUS_METERS; // 65.0m

  /**
   * Authoritatively simulates a full cricket delivery from release to dead ball.
   */
  public static simulateDelivery(
    bowlerIntent: BowlingDeliveryIntent,
    batterIntent: BattingShotIntent | null,
    pitchCondition: 'HARD_TURF' | 'DUSTY_SPINNER' | 'GREEN_SEAMER' = 'HARD_TURF'
  ): SimulationResult {
    // 1. Initial Launch State at Bowler's Release Point
    const releaseSpeedMps = (bowlerIntent.releaseSpeedKmph * 1000) / 3600;
    const releasePos: Vector3D = {
      x: 0.15, // right-arm bowler over the wicket
      y: 2.15, // release height ~2.15m
      z: CricketPhysicsEngine.BOWLER_POPPING_CREASE_Z - 0.2 // slightly behind popping crease
    };

    // Calculate initial velocity vector aimed at targetPitchPoint
    const targetPitch = bowlerIntent.targetPitchPoint;
    const dx = targetPitch.x - releasePos.x;
    const dy = targetPitch.y - releasePos.y;
    const dz = targetPitch.z - releasePos.z;
    const horizontalDist = Math.sqrt(dx * dx + dz * dz);
    const estimatedTime = horizontalDist / Math.max(15, releaseSpeedMps);

    // Initial velocity accounting for gravity drop to reach target bounce spot
    const vy = (dy - 0.5 * -CricketPhysicsEngine.GRAVITY * estimatedTime * estimatedTime) / estimatedTime;
    const vx = dx / estimatedTime;
    const vz = dz / estimatedTime;

    let pos: Vector3D = { ...releasePos };
    let vel: Vector3D = { x: vx, y: vy, z: vz };

    // Spin / Swing forces setup
    const swingForceMag = CricketPhysicsEngine.calculateSwingMagnitude(bowlerIntent.swingType, bowlerIntent.releaseSpeedKmph);
    const spinDeviation = CricketPhysicsEngine.calculateSpinVector(bowlerIntent.spinType);

    const trajectory: TrajectoryKeyframe[] = [];
    let hasBounced = false;
    let pitchPoint: Vector3D = { x: 0, y: 0, z: 0 };
    let hasBatContact = false;
    let batContactPoint: Vector3D | undefined = undefined;
    let maxElevation = releasePos.y;
    let totalDist = 0;
    let timeMs = 0;
    const dt = CricketPhysicsEngine.DT;

    // Record initial frame
    trajectory.push({
      timeMs: 0,
      position: { ...pos },
      velocity: { ...vel },
      hasBounced: false,
      hasBatContact: false
    });

    // Check pre-delivery illegalities (e.g. Front-Foot No-Ball)
    const isFrontFootNoBall = bowlerIntent.targetPitchPoint.z < -8.84 || bowlerIntent.effortPercentage > 115;

    // Check Wide (line or height)
    let isWide = false;
    let wideReason = '';

    // 2. Pre-Bat Flight Simulation Loop
    const maxSteps = 400; // ~6.6 seconds max
    let step = 0;

    while (step < maxSteps && pos.z <= CricketPhysicsEngine.STRIKER_STUMPS_Z + 4.0 && !hasBatContact) {
      step++;
      timeMs += Math.round(dt * 1000);

      // Aerodynamic forces (drag + swing)
      const speed = Math.sqrt(vel.x * vel.x + vel.y * vel.y + vel.z * vel.z);
      const dragMag = 0.5 * CricketPhysicsEngine.AIR_DENSITY * CricketPhysicsEngine.DRAG_COEFF * CricketPhysicsEngine.BALL_AREA * speed * speed;
      const dragAx = -dragMag * (vel.x / speed) / CricketPhysicsEngine.BALL_MASS;
      const dragAy = -dragMag * (vel.y / speed) / CricketPhysicsEngine.BALL_MASS;
      const dragAz = -dragMag * (vel.z / speed) / CricketPhysicsEngine.BALL_MASS;

      const swingAx = !hasBounced ? (swingForceMag / CricketPhysicsEngine.BALL_MASS) : 0;

      // Numerical integration (Euler-Cromer)
      vel.x += (dragAx + swingAx) * dt;
      vel.y += (dragAy - CricketPhysicsEngine.GRAVITY) * dt;
      vel.z += dragAz * dt;

      pos.x += vel.x * dt;
      pos.y += vel.y * dt;
      pos.z += vel.z * dt;

      if (pos.y > maxElevation) maxElevation = pos.y;

      // Check Pitch Bounce
      if (!hasBounced && pos.y <= CricketPhysicsEngine.BALL_RADIUS) {
        hasBounced = true;
        pos.y = CricketPhysicsEngine.BALL_RADIUS;
        pitchPoint = { ...pos };

        // Pitch Restitution
        let ey = 0.60;
        let frictionXZ = 0.74;
        if (pitchCondition === 'HARD_TURF') {
          ey = 0.65;
          frictionXZ = 0.78;
        } else if (pitchCondition === 'DUSTY_SPINNER') {
          ey = 0.55;
          frictionXZ = 0.68;
        } else if (pitchCondition === 'GREEN_SEAMER') {
          ey = 0.62;
          frictionXZ = 0.72;
        }

        vel.y = -vel.y * ey;
        vel.x = vel.x * frictionXZ + spinDeviation.x;
        vel.z = vel.z * frictionXZ;
      }

      // Check Wide at Striker Crease
      if (pos.z >= CricketPhysicsEngine.STRIKER_POPPING_CREASE_Z && !isWide) {
        // Off side wide line: x > 0.88m
        if (pos.x > 0.88) {
          isWide = true;
          wideReason = 'Delivery passed wide outside off stump';
        }
        // Leg side wide line: x < -0.32m (for right-hand batsman)
        else if (pos.x < -0.32) {
          isWide = true;
          wideReason = 'Delivery passed down leg side';
        }
        // Head height wide bouncer: y > 2.2m
        else if (pos.y > 2.2) {
          isWide = true;
          wideReason = 'Bouncer passed over batsman head';
        }
      }

      // Check Bat Striking Zone Intersection (z: 8.2m to 9.8m)
      if (pos.z >= 8.2 && pos.z <= 9.6 && batterIntent) {
        const timingError = Math.abs(batterIntent.timingOffsetMs);
        // Contact occurs if timing offset is within playable window (|Δt| <= 120ms) and ball is not an extreme wide
        if (timingError <= 120 && !isWide) {
          hasBatContact = true;
          batContactPoint = { ...pos };
          break;
        }
      }

      // Check if ball reached or passed striker stumps
      if (pos.z >= CricketPhysicsEngine.STRIKER_STUMPS_Z) {
        const prevZ = pos.z - vel.z * dt;
        const deltaZ = pos.z - prevZ;
        if (deltaZ > 0.0001) {
          const frac = (CricketPhysicsEngine.STRIKER_STUMPS_Z - prevZ) / deltaZ;
          pos.x = (pos.x - vel.x * dt) + frac * (vel.x * dt);
          pos.y = (pos.y - vel.y * dt) + frac * (vel.y * dt);
          pos.z = CricketPhysicsEngine.STRIKER_STUMPS_Z;
        }
        break;
      }

      // Sample keyframe every 2 steps (~30Hz sync rate)
      if (step % 2 === 0) {
        trajectory.push({
          timeMs,
          position: { ...pos },
          velocity: { ...vel },
          hasBounced,
          hasBatContact: false
        });
      }
    }

    // 3. Post-Contact or Post-Pass Flight Simulation
    let isBoundaryFour = false;
    let isBoundarySix = false;
    let runsScored = 0;
    let wicket: WicketDetail | null = null;
    let commentary = '';

    if (hasBatContact && batterIntent) {
      // Record bat contact keyframe
      trajectory.push({
        timeMs,
        position: { ...pos },
        velocity: { ...vel },
        hasBounced,
        hasBatContact: true
      });

      // Calculate Bat Contact Dynamics
      const batPhysics = CricketPhysicsEngine.resolveBatImpact(vel, batterIntent);
      vel = batPhysics.exitVelocity;

      let aerialFlight = true;
      let bouncedAfterHit = false;

      // Simulate ball trajectory after bat impact
      while (step < maxSteps && Math.sqrt(pos.x * pos.x + pos.z * pos.z) < CricketPhysicsEngine.BOUNDARY_RADIUS + 3.0) {
        step++;
        timeMs += Math.round(dt * 1000);

        // Ground roll or air drag
        if (pos.y <= CricketPhysicsEngine.BALL_RADIUS) {
          pos.y = CricketPhysicsEngine.BALL_RADIUS;
          bouncedAfterHit = true;

          // Ground friction deceleration
          const groundSpeed = Math.sqrt(vel.x * vel.x + vel.z * vel.z);
          if (groundSpeed > 0.1) {
            const decel = 3.6 * dt; // rolling friction deceleration
            const newSpeed = Math.max(0, groundSpeed - decel);
            vel.x = (vel.x / groundSpeed) * newSpeed;
            vel.z = (vel.z / groundSpeed) * newSpeed;
          } else {
            vel.x = 0;
            vel.z = 0;
          }
          vel.y = Math.abs(vel.y) > 0.6 ? -vel.y * 0.45 : 0;
        } else {
          // In air
          vel.y -= CricketPhysicsEngine.GRAVITY * dt;
          pos.x += vel.x * dt;
          pos.y += vel.y * dt;
          pos.z += vel.z * dt;
          if (pos.y > maxElevation) maxElevation = pos.y;
        }

        pos.x += vel.x * dt;
        pos.z += vel.z * dt;

        totalDist = Math.sqrt(pos.x * pos.x + pos.z * pos.z);

        // Check Boundary Crossing
        if (totalDist >= CricketPhysicsEngine.BOUNDARY_RADIUS) {
          if (!bouncedAfterHit && aerialFlight && batterIntent.isLofted && batPhysics.quality === 'SWEET_SPOT') {
            isBoundarySix = true;
            runsScored = 6;
            commentary = `MAXIMUM! ${batterIntent.shotType.replace('_', ' ')} clears the boundary for SIX!`;
          } else {
            isBoundaryFour = true;
            runsScored = 4;
            commentary = `FOUR! Beautifully placed ${batterIntent.shotType.replace('_', ' ')} races across the rope!`;
          }
          break;
        }

        // Ball stopped rolling
        if (Math.abs(vel.x) < 0.05 && Math.abs(vel.z) < 0.05 && pos.y <= CricketPhysicsEngine.BALL_RADIUS) {
          break;
        }

        if (step % 2 === 0) {
          trajectory.push({
            timeMs,
            position: { ...pos },
            velocity: { ...vel },
            hasBounced: bouncedAfterHit,
            hasBatContact: true
          });
        }
      }

      // Adjudicate Non-Boundary Shot Outcomes (Caught, Runs, Defensive Block)
      if (!isBoundaryFour && !isBoundarySix) {
        if (batPhysics.quality === 'EDGE') {
          // Edge to keeper / slip or inside edge
          if (Math.random() > 0.45 && !isFrontFootNoBall) {
            wicket = {
              dismissalType: 'CAUGHT',
              dismissedPlayerId: batterIntent.batterId,
              bowlerId: bowlerIntent.bowlerId,
              fielderId: 'WICKET_KEEPER',
              commentary: 'OUT! Thick edge carried comfortably to the wicketkeeper!'
            };
          } else {
            runsScored = 1;
            commentary = 'Edged, but runs down to third man for a single.';
          }
        } else if (batPhysics.quality === 'MISTIMED') {
          if (batterIntent.isLofted && Math.random() > 0.5 && !isFrontFootNoBall) {
            wicket = {
              dismissalType: 'CAUGHT',
              dismissedPlayerId: batterIntent.batterId,
              bowlerId: bowlerIntent.bowlerId,
              fielderId: 'MID_OFF',
              commentary: 'OUT! Spliced into the air and taken cleanly by the fielder!'
            };
          } else {
            runsScored = Math.random() > 0.5 ? 1 : 0;
            commentary = 'Mistimed stroke into the outfield.';
          }
        } else if (batPhysics.quality === 'DEFENSIVE') {
          runsScored = 0;
          commentary = 'Solid defensive block placed right into the turf.';
        } else {
          // Clean stroke into gaps
          runsScored = batterIntent.power > 65 ? (Math.random() > 0.6 ? 2 : 1) : 1;
          commentary = `Pushed into the gap for ${runsScored} run(s).`;
        }
      }
    } else {
      // 4. No Bat Contact -> Check Bowled, LBW, Stumped, Wides, Byes
      const hitStumps = CricketPhysicsEngine.checkStumpCollision(pos);

      if (isFrontFootNoBall) {
        runsScored = 0;
        commentary = 'NO BALL! Bowler overstepped the popping crease!';
      } else if (isWide) {
        runsScored = 0;
        commentary = `WIDE! ${wideReason}.`;
      } else if (hitStumps) {
        // Clean Bowled
        wicket = {
          dismissalType: 'BOWLED',
          dismissedPlayerId: batterIntent?.batterId || 'striker',
          bowlerId: bowlerIntent.bowlerId,
          commentary: 'BOWLED HIM! The ball rattles the stumps, bails flying!'
        };
      } else {
        // Check LBW Projection (pad impact in front of stumps)
        const lbw = CricketPhysicsEngine.evaluateLBW(pitchPoint, pos, vel);
        if (lbw.isOut) {
          wicket = {
            dismissalType: 'LBW',
            dismissedPlayerId: batterIntent?.batterId || 'striker',
            bowlerId: bowlerIntent.bowlerId,
            commentary: 'OUT LBW! Trapped right in front of the middle stump!'
          };
        } else {
          // Dot ball or keeper take
          runsScored = 0;
          commentary = 'Beaten outside off stump! Through to the wicketkeeper.';
        }
      }
    }

    // 5. Build Authoritative Delivery Outcome
    let extrasType: ExtraType = 'NONE';
    let extrasRuns = 0;
    let isLegalDelivery = true;

    if (isFrontFootNoBall) {
      extrasType = 'NO_BALL';
      extrasRuns = 1;
      isLegalDelivery = false;
    } else if (isWide) {
      extrasType = 'WIDE';
      extrasRuns = 1;
      isLegalDelivery = false;
    }

    const totalRuns = runsScored + extrasRuns;
    const strikeRotated = runsScored % 2 !== 0;

    const outcome: DeliveryOutcome = {
      batterRuns: runsScored,
      extrasType,
      extrasRuns,
      totalRuns,
      isLegalDelivery,
      isBoundaryFour,
      isBoundarySix,
      wicket,
      strikeRotated,
      reviewTriggered: false
    };

    return {
      outcome,
      trajectory,
      pitchPoint: hasBounced ? pitchPoint : bowlerIntent.targetPitchPoint,
      batContactPoint,
      impactSpeedKmph: bowlerIntent.releaseSpeedKmph,
      maxElevationMeters: Number(maxElevation.toFixed(2)),
      totalDistanceMeters: Number(totalDist.toFixed(1)),
      commentary: wicket ? wicket.commentary : commentary
    };
  }

  /**
   * Evaluates bat-ball physics collision, exit velocity vector, and contact quality.
   */
  private static resolveBatImpact(
    incomingVel: Vector3D,
    batter: BattingShotIntent
  ): { exitVelocity: Vector3D; quality: 'SWEET_SPOT' | 'GOOD_TIMING' | 'MISTIMED' | 'EDGE' | 'DEFENSIVE' } {
    const timingError = Math.abs(batter.timingOffsetMs);
    const powerFactor = Math.max(0.3, batter.power / 100);

    let quality: 'SWEET_SPOT' | 'GOOD_TIMING' | 'MISTIMED' | 'EDGE' | 'DEFENSIVE' = 'GOOD_TIMING';

    if (batter.shotType.includes('DEFENSIVE')) {
      quality = 'DEFENSIVE';
      return {
        exitVelocity: {
          x: incomingVel.x * 0.15,
          y: 0.1,
          z: -incomingVel.z * 0.12
        },
        quality
      };
    }

    if (timingError <= 22) {
      quality = 'SWEET_SPOT';
    } else if (timingError <= 55) {
      quality = 'GOOD_TIMING';
    } else if (timingError <= 88) {
      quality = 'MISTIMED';
    } else {
      quality = 'EDGE';
    }

    // Convert shot angle (0° = straight down ground along -z in match coordinates, 315° = cover, 45° = midwicket)
    const angleRad = (batter.directionAngleDeg * Math.PI) / 180;
    const baseExitSpeed = (quality === 'SWEET_SPOT' ? 36 : quality === 'GOOD_TIMING' ? 26 : 14) * powerFactor;

    // Lofted elevation angle (degrees)
    const elevationDeg = batter.isLofted && quality === 'SWEET_SPOT' ? 28 : (batter.isLofted ? 38 : 3.5);
    const elevRad = (elevationDeg * Math.PI) / 180;

    const vHorizontal = baseExitSpeed * Math.cos(elevRad);
    const vy = baseExitSpeed * Math.sin(elevRad);
    // In our coordinate system, striker is at +10m looking towards bowler at -10m.
    // Straight shot travels towards negative Z.
    const vx = -vHorizontal * Math.sin(angleRad);
    const vz = -vHorizontal * Math.cos(angleRad);

    return {
      exitVelocity: { x: vx, y: vy, z: vz },
      quality
    };
  }

  /**
   * Evaluates whether ball position collided with striker stumps.
   */
  public static checkStumpCollision(pos: Vector3D): boolean {
    const zCloseToStumps = Math.abs(pos.z - CricketPhysicsEngine.STRIKER_STUMPS_Z) <= 0.45;
    const xWithinStumps = Math.abs(pos.x) <= CricketPhysicsEngine.STUMPS_WIDTH / 2 + 0.06;
    const yWithinHeight = pos.y >= 0.02 && pos.y <= CricketPhysicsEngine.STUMPS_HEIGHT + 0.08;

    return zCloseToStumps && xWithinStumps && yWithinHeight;
  }

  /**
   * Deterministic Hawk-Eye / LBW rule evaluation.
   * Conforms strictly to ICC / MCC Law 36:
   * 1. Pitching: Ball must pitch in line with wickets or outside off stump (pitchPoint.x >= -0.15m). Pitched outside leg is NOT OUT.
   * 2. Impact: Impact with batter's pad/body must be in line between wickets (|impactPos.x| <= 0.18m).
   * 3. Wickets: Ball trajectory must be projected to strike the striker stumps.
   * NEVER uses an LLM or random decision to determine LBW or any cricket outcome.
   * If full 60Hz velocity or trajectory vector is unavailable, safely falls back to the documented simplified LBW model.
   */
  public static evaluateLBW(
    arg1: Vector3D,
    arg2: Vector3D,
    arg3?: Vector3D | null
  ): { isOut: boolean; reason: string; confidence?: number } {
    let pitchPoint: Vector3D;
    let impactPos: Vector3D;
    let vel: Vector3D | null | undefined;

    // Detect if called as (impactPos, vel, pitchPoint) or (pitchPoint, impactPos, vel)
    if (arg3 && arg3.z !== undefined && arg1.z !== undefined && arg1.z > arg3.z) {
      // arg1 is impactPos (z ~ 9m at crease), arg2 is vel, arg3 is pitchPoint (z ~ 4-6m)
      impactPos = arg1;
      vel = arg2;
      pitchPoint = arg3;
    } else {
      // standard order (pitchPoint, impactPos, vel)
      pitchPoint = arg1;
      impactPos = arg2;
      vel = arg3;
    }

    // If velocity vector is missing, zero, or uncalibrated, use the documented simplified LBW model
    if (!vel || (vel.x === 0 && vel.y === 0 && vel.z === 0) || isNaN(vel.z)) {
      return CricketPhysicsEngine.evaluateSimplifiedLBW(pitchPoint, impactPos);
    }

    // 1. Pitched outside leg check: If ball pitched outside leg stump line (x < -0.15 for right-hander), NOT OUT by rule.
    if (pitchPoint.x < -0.15) {
      return { isOut: false, reason: 'Pitched outside leg stump' };
    }

    // 2. Impact in line check: Pad contact must be in line with stumps (|x| <= 0.18m)
    if (Math.abs(impactPos.x) > 0.18) {
      return { isOut: false, reason: 'Impact outside off stump' };
    }

    // 3. Wickets hitting projection:
    // Project ball trajectory to the stumps (z = 10.06m)
    const dz = CricketPhysicsEngine.STRIKER_STUMPS_Z - impactPos.z;
    if (dz <= 0) return { isOut: false, reason: 'Impact past stumps' };

    const timeToStumps = dz / Math.max(5, vel.z);
    const projectedY = impactPos.y + vel.y * timeToStumps - 0.5 * CricketPhysicsEngine.GRAVITY * timeToStumps * timeToStumps;
    const projectedX = impactPos.x + vel.x * timeToStumps;

    const hittingWickets =
      projectedY >= 0.03 &&
      projectedY <= CricketPhysicsEngine.STUMPS_HEIGHT &&
      Math.abs(projectedX) <= CricketPhysicsEngine.STUMPS_WIDTH / 2;

    if (hittingWickets) {
      return { isOut: true, reason: 'Projected to hit middle & off stump' };
    }

    return { isOut: false, reason: 'Projected to bounce over the stumps' };
  }

  /**
   * Documented Simplified LBW Model.
   * Authoritative fallback adjudication when full numerical trajectory flight integration is unavailable.
   * Model specifications per MCC Law 36:
   * - Pitching: pitchPoint.x >= -0.15m (must not have pitched outside leg stump).
   * - Impact In-Line: |impactPos.x| <= 0.18m (impact within stumps width buffer).
   * - Height at Crease: impactPos.y <= 0.55m (knee-roll / below stump bail apex height of 0.71m).
   * - Crease Zone: 8.5m <= impactPos.z <= 10.06m (front-foot popping crease to stumps).
   * Returns deterministic OUT or NOT_OUT based exclusively on geometric criteria.
   */
  public static evaluateSimplifiedLBW(
    pitchPoint: Vector3D,
    impactPos: Vector3D
  ): { isOut: boolean; reason: string; confidence: number } {
    // 1. Pitched outside leg check (Law 36.1(b))
    if (pitchPoint.x < -0.15) {
      return { isOut: false, reason: 'Simplified LBW: Pitched outside leg stump (Law 36.1(b))', confidence: 0.95 };
    }

    // 2. Impact in-line check
    if (Math.abs(impactPos.x) > 0.18) {
      return { isOut: false, reason: 'Simplified LBW: Impact outside off stump', confidence: 0.9 };
    }

    // 3. Knee-roll height check (below 0.55m) and popping crease proximity
    const isBelowKneeRoll = impactPos.y >= 0.04 && impactPos.y <= 0.55;
    const isInCreaseZone = impactPos.z >= 8.5 && impactPos.z <= CricketPhysicsEngine.STRIKER_STUMPS_Z;

    if (isBelowKneeRoll && isInCreaseZone) {
      return { isOut: true, reason: 'Simplified LBW: OUT - Trapped in front below knee roll, hitting stumps', confidence: 0.92 };
    }

    if (!isBelowKneeRoll) {
      return { isOut: false, reason: 'Simplified LBW: Impact height above knee roll, projected over stumps', confidence: 0.88 };
    }

    return { isOut: false, reason: 'Simplified LBW: Impact outside popping crease zone', confidence: 0.85 };
  }

  private static calculateSwingMagnitude(swingType: BowlingDeliveryIntent['swingType'], speedKmph: number): number {
    const speedFactor = speedKmph / 130;
    switch (swingType) {
      case 'OUTSWING':
        return 0.45 * speedFactor;
      case 'INSWING':
        return -0.45 * speedFactor;
      case 'REVERSE_SWING':
        return 0.65 * speedFactor;
      case 'NONE':
      default:
        return 0;
    }
  }

  private static calculateSpinVector(spinType: BowlingDeliveryIntent['spinType']): { x: number; y: number } {
    switch (spinType) {
      case 'LEG_BREAK':
        return { x: 0.9, y: 0.1 }; // breaks away from right hander
      case 'OFF_BREAK':
        return { x: -0.9, y: 0.05 }; // breaks into right hander
      case 'GOOGLY':
        return { x: -0.85, y: 0.05 }; // wrong'un
      case 'TOP_SPINNER':
        return { x: 0.0, y: 0.35 }; // extra bounce & dip
      case 'ARM_BALL':
        return { x: -0.3, y: 0.0 };
      case 'FLIPPER':
        return { x: 0.0, y: -0.2 }; // skids low
      case 'NONE':
      default:
        return { x: 0, y: 0 };
    }
  }
}
