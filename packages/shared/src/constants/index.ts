import { FieldPositionName } from '../types/player.js';
import { Vector3D } from '../types/physics.js';

export const CRICKET_RULES = {
  DEFAULT_OVERS_PER_INNINGS: 5,
  LEGAL_BALLS_PER_OVER: 6,
  MAX_OVERS_PER_BOWLER: 2, // Maximum 2 overs per bowler in a 5-over match
  MAX_PLAYERS_PER_TEAM: 11,
  TOTAL_FIELD_POSITIONS: 22,
  DRS_REVIEWS_PER_INNINGS: 1,
  DRS_DECISION_WINDOW_SECONDS: 15,
  DELIVERY_COUNTDOWN_SECONDS: 20,
  SUPER_OVER_OVERS: 1
} as const;

export const GROUND_DIMENSIONS = {
  PITCH_LENGTH_METERS: 20.12, // 22 yards
  PITCH_WIDTH_METERS: 3.05, // 10 feet
  POPPING_CREASE_METERS: 1.22, // 4 feet from stumps
  RETURN_CREASE_WIDTH_METERS: 2.64,
  STUMP_HEIGHT_METERS: 0.711, // 28 inches
  STUMP_WIDTH_METERS: 0.2286, // 9 inches
  BALL_RADIUS_METERS: 0.036, // 7.2cm diameter
  BALL_MASS_KG: 0.16, // 160g standard leather ball
  BOUNDARY_RADIUS_METERS: 65.0, // 65m boundary radius
  INNER_CIRCLE_RADIUS_METERS: 27.43 // 30 yards
} as const;

export const SERVER_CONFIG = {
  DEFAULT_PORT: 4000,
  TICK_RATE_HZ: 30,
  TICK_INTERVAL_MS: 1000 / 30, // ~33.3ms
  RECONNECTION_GRACE_MS: 30000, // 30 seconds reconnect window
  ROOM_INACTIVITY_TTL_MS: 1800000, // 30 minutes
  ROOM_CODE_LENGTH: 6
} as const;

/**
 * Default outfield coordinate presets for standard fielding layout.
 * Z = length along pitch (negative towards bowler, positive towards striker).
 * X = width across ground (negative = leg side for RHB, positive = off side for RHB).
 */
export const DEFAULT_FIELD_PRESETS: Record<FieldPositionName, Vector3D> = {
  WICKET_KEEPER: { x: 0, y: 0, z: 12.0 },
  BOWLER: { x: 0, y: 0, z: -11.0 },
  FIRST_SLIP: { x: 2.2, y: 0, z: 12.5 },
  SECOND_SLIP: { x: 4.0, y: 0, z: 13.0 },
  GULLY: { x: 9.5, y: 0, z: 10.5 },
  POINT: { x: 19.0, y: 0, z: 3.0 },
  COVER: { x: 18.0, y: 0, z: -7.0 },
  MID_OFF: { x: 8.5, y: 0, z: -15.0 },
  MID_ON: { x: -8.5, y: 0, z: -15.0 },
  MID_WICKET: { x: -17.5, y: 0, z: -6.0 },
  SQUARE_LEG: { x: -19.0, y: 0, z: 2.5 },
  FINE_LEG: { x: -14.0, y: 0, z: 16.0 },
  THIRD_MAN: { x: 35.0, y: 0, z: 38.0 },
  DEEP_POINT: { x: 45.0, y: 0, z: 10.0 },
  DEEP_COVER: { x: 42.0, y: 0, z: -25.0 },
  LONG_OFF: { x: 20.0, y: 0, z: -50.0 },
  LONG_ON: { x: -20.0, y: 0, z: -50.0 },
  DEEP_MID_WICKET: { x: -45.0, y: 0, z: -20.0 },
  DEEP_SQUARE_LEG: { x: -48.0, y: 0, z: 8.0 },
  DEEP_FINE_LEG: { x: -30.0, y: 0, z: 42.0 }
};
