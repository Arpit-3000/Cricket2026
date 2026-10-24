/**
 * 3D Physics vectors, coordinates, delivery trajectories, and input definitions.
 */

export interface Vector3D {
  x: number;
  y: number;
  z: number;
}

export interface QuaternionRotation {
  x: number;
  y: number;
  z: number;
  w: number;
}

export type DeliveryLength =
  | 'FULL_TOSS'
  | 'YORKER'
  | 'FULL'
  | 'GOOD_LENGTH'
  | 'SHORT_OF_A_LENGTH'
  | 'BOUNCER';

export type DeliveryLine =
  | 'WIDE_OUTSIDE_OFF'
  | 'OUTSIDE_OFF'
  | 'OFF_STUMP'
  | 'MIDDLE_STUMP'
  | 'LEG_STUMP'
  | 'DOWN_LEG'
  | 'WIDE_DOWN_LEG';

export type SwingType = 'NONE' | 'OUTSWING' | 'INSWING' | 'REVERSE_SWING';

export type SpinVariation =
  | 'NONE'
  | 'OFF_BREAK'
  | 'LEG_BREAK'
  | 'GOOGLY'
  | 'DOOSRA'
  | 'TOP_SPINNER'
  | 'ARM_BALL'
  | 'FLIPPER';

export interface BowlingDeliveryIntent {
  bowlerId: string;
  targetPitchPoint: Vector3D; // Projected bounce coordinate on pitch
  releaseSpeedKmph: number; // e.g. 85 to 155 km/h
  swingType: SwingType;
  spinType: SpinVariation;
  seamAngleDegrees: number;
  effortPercentage: number; // 0 to 100
}

export type ShotType =
  | 'FORWARD_DEFENSIVE'
  | 'BACKWARD_DEFENSIVE'
  | 'COVER_DRIVE'
  | 'STRAIGHT_DRIVE'
  | 'ON_DRIVE'
  | 'SQUARE_CUT'
  | 'PULL_SHOT'
  | 'HOOK_SHOT'
  | 'LEG_GLANCE'
  | 'SWEEP'
  | 'LOFTED_DRIVE'
  | 'RAMP_SCOOP'
  | 'UPPERCUT';

export interface BattingShotIntent {
  batterId: string;
  shotType: ShotType;
  power: number; // 0 to 100
  directionAngleDeg: number; // 0 to 360 degrees
  timingOffsetMs: number; // -100ms (early) to +100ms (late), 0 = sweet spot
  isLofted: boolean;
  footwork: 'FRONT_FOOT' | 'BACK_FOOT';
}

export type FieldingAction =
  | 'SPRINT'
  | 'JOG'
  | 'DIVE'
  | 'SLIDE'
  | 'PICKUP'
  | 'CATCH_ATTEMPT'
  | 'UNDERARM_THROW'
  | 'OVERARM_THROW'
  | 'BACKUP';

export interface FieldingIntent {
  fielderId: string;
  action: FieldingAction;
  targetPosition?: Vector3D;
  throwTargetEnd?: 'STRIKER_END' | 'BOWLER_END';
  throwPower?: number; // 0 to 100
  timestamp?: number;
}

export interface BallPhysicalState {
  position: Vector3D;
  velocity: Vector3D;
  angularVelocity: Vector3D;
  isGrounded: boolean;
  lastBouncePoint?: Vector3D;
  hasPitched: boolean;
  hasBatContact: boolean;
  hasPadContact: boolean;
  isInAir: boolean;
  possessedByFielderId?: string | null;
  isThrowInFlight?: boolean;
  throwTargetEnd?: 'STRIKER_END' | 'BOWLER_END' | null;
}
