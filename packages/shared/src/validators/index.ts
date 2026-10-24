import { RoomSettings } from '../types/room.js';
import { BowlingDeliveryIntent, BattingShotIntent, FieldingIntent, Vector3D } from '../types/physics.js';
import { GROUND_DIMENSIONS, SERVER_CONFIG, PERMITTED_UMPIRE_SIGNALS } from '../constants/index.js';
import { PlayerMovementInput, PlayerEntityState } from '../types/player.js';
import { UmpireSignal } from '../types/umpire.js';

export function isValidRoomCode(code: string): boolean {
  if (!code || typeof code !== 'string') return false;
  return /^[A-Z0-9]{6}$/.test(code.trim().toUpperCase());
}

export function validateRoomSettings(settings: Partial<RoomSettings>): { valid: boolean; error?: string } {
  if (settings.maxOversPerInnings !== undefined) {
    if (settings.maxOversPerInnings < 1 || settings.maxOversPerInnings > 20) {
      return { valid: false, error: 'Overs must be between 1 and 20' };
    }
  }

  if (settings.deliveryTimeLimitSec !== undefined) {
    if (settings.deliveryTimeLimitSec < 10 || settings.deliveryTimeLimitSec > 60) {
      return { valid: false, error: 'Delivery time limit must be between 10 and 60 seconds' };
    }
  }

  if (settings.minPlayersPerTeam !== undefined) {
    if (settings.minPlayersPerTeam < 1 || settings.minPlayersPerTeam > 11) {
      return { valid: false, error: 'Minimum players per team must be between 1 and 11' };
    }
  }

  return { valid: true };
}

export function validatePlayerMovement(
  input: PlayerMovementInput,
  lastState?: PlayerEntityState,
  now: number = Date.now()
): { valid: boolean; error?: string; correctedPosition?: { x: number; y: number; z: number } } {
  if (!input.playerId || typeof input.playerId !== 'string') {
    return { valid: false, error: 'Missing or invalid player ID' };
  }

  const { x, y, z } = input.position;
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
    return { valid: false, error: 'Non-finite position coordinates' };
  }

  if (!Number.isFinite(input.rotationY)) {
    return { valid: false, error: 'Non-finite rotation' };
  }

  // Oval boundary radius check (with 3.0m buffer for boundary run-ups)
  const distFromCenter = Math.hypot(x, z);
  const maxAllowedDist = GROUND_DIMENSIONS.BOUNDARY_RADIUS_METERS + 3.0;
  if (distFromCenter > maxAllowedDist) {
    // Clamp to boundary edge
    const angle = Math.atan2(z, x);
    return {
      valid: true,
      correctedPosition: {
        x: Math.cos(angle) * maxAllowedDist,
        y: Math.max(0, Math.min(3.0, y)),
        z: Math.sin(angle) * maxAllowedDist
      }
    };
  }

  // Elevation check (player cannot fly above 4 meters or fall below ground)
  if (y < -0.5 || y > 4.0) {
    return {
      valid: true,
      correctedPosition: {
        x,
        y: 0,
        z
      }
    };
  }

  // Speed / distance plausibility check if lastState exists and has an established movement sequence
  if (lastState && lastState.sequence > 0 && lastState.serverTimestamp > 0) {
    const dtSeconds = Math.max(0.01, (now - lastState.serverTimestamp) / 1000);
    const distTraveled = Math.hypot(x - lastState.position.x, z - lastState.position.z);
    const maxReachableDist = SERVER_CONFIG.MAX_SPRINT_SPEED_MPS * dtSeconds * SERVER_CONFIG.MAX_SPEED_TOLERANCE_FACTOR;

    // If packet jumps impossibly far in dt (teleportation hack or severe desync)
    if (distTraveled > maxReachableDist && distTraveled > 2.0) {
      // Clamp position along direction vector
      const ratio = maxReachableDist / distTraveled;
      return {
        valid: true,
        correctedPosition: {
          x: lastState.position.x + (x - lastState.position.x) * ratio,
          y: Math.max(0, y),
          z: lastState.position.z + (z - lastState.position.z) * ratio
        }
      };
    }
  }

  return { valid: true };
}

export function validateBowlingIntent(intent: BowlingDeliveryIntent): { valid: boolean; error?: string } {
  if (!intent.bowlerId) return { valid: false, error: 'Bowler ID required' };
  
  // Speed bounds: 60 km/h (slow spin) to 160 km/h (express pace)
  if (intent.releaseSpeedKmph < 60 || intent.releaseSpeedKmph > 165) {
    return { valid: false, error: 'Release speed out of physical bounds (60-165 km/h)' };
  }

  // Pitch point bounds: X +/- half pitch width, Z between stumps
  const halfWidth = GROUND_DIMENSIONS.PITCH_WIDTH_METERS / 2;
  const halfLength = GROUND_DIMENSIONS.PITCH_LENGTH_METERS / 2;
  if (
    Math.abs(intent.targetPitchPoint.x) > halfWidth * 1.5 ||
    Math.abs(intent.targetPitchPoint.z) > halfLength * 1.2
  ) {
    return { valid: false, error: 'Target pitch coordinate outside playable pitch boundaries' };
  }

  return { valid: true };
}

export function validateBattingIntent(intent: BattingShotIntent): { valid: boolean; error?: string } {
  if (!intent.batterId) return { valid: false, error: 'Batter ID required' };
  if (intent.power < 0 || intent.power > 100) {
    return { valid: false, error: 'Power must be 0-100' };
  }
  if (intent.directionAngleDeg < 0 || intent.directionAngleDeg >= 360) {
    return { valid: false, error: 'Shot angle must be within 0-359 degrees' };
  }
  if (Math.abs(intent.timingOffsetMs) > 200) {
    return { valid: false, error: 'Timing offset outside physical window' };
  }
  return { valid: true };
}

export function validateFieldingIntent(intent: FieldingIntent): { valid: boolean; error?: string } {
  if (!intent || !intent.fielderId || typeof intent.fielderId !== 'string') {
    return { valid: false, error: 'Fielder ID required' };
  }

  const validActions = ['PICKUP', 'DIVE', 'CATCH_ATTEMPT', 'OVERARM_THROW', 'UNDERARM_THROW', 'BACKUP'];
  if (!validActions.includes(intent.action)) {
    return { valid: false, error: `Invalid fielding action: ${intent.action}` };
  }

  if (intent.action === 'OVERARM_THROW' || intent.action === 'UNDERARM_THROW') {
    if (intent.throwTargetEnd && intent.throwTargetEnd !== 'STRIKER_END' && intent.throwTargetEnd !== 'BOWLER_END') {
      return { valid: false, error: 'Target end must be STRIKER_END or BOWLER_END' };
    }
    if (intent.throwPower !== undefined) {
      if (!Number.isFinite(intent.throwPower) || intent.throwPower < 0 || intent.throwPower > 100) {
        return { valid: false, error: 'Throw power must be between 0 and 100' };
      }
    }
    if (intent.targetPosition) {
      const { x, y, z } = intent.targetPosition;
      if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
        return { valid: false, error: 'Non-finite target coordinate for throw' };
      }
    }
  }

  return { valid: true };
}

export function validateFieldAdjustment(fielderId: string, position: Vector3D): { valid: boolean; error?: string } {
  if (!fielderId || typeof fielderId !== 'string') {
    return { valid: false, error: 'Fielder ID required' };
  }
  if (!position || !Number.isFinite(position.x) || !Number.isFinite(position.y) || !Number.isFinite(position.z)) {
    return { valid: false, error: 'Non-finite position coordinate' };
  }

  const dist = Math.hypot(position.x, position.z);
  if (dist > GROUND_DIMENSIONS.BOUNDARY_RADIUS_METERS) {
    return { valid: false, error: 'Fielder cannot be positioned beyond boundary rope' };
  }

  // Pitch strip safety exclusion zone: |x| < 1.6m and |z| <= 11.0m (pitch length / 2 + small buffer)
  if (Math.abs(position.x) < 1.6 && Math.abs(position.z) <= 11.0) {
    return { valid: false, error: 'Fielder cannot be positioned on the pitch strip' };
  }

  return { valid: true };
}

export function validateUmpireSignal(
  signalOrPayload: UmpireSignal | string | { signal: UmpireSignal | string; runs?: any; wickets?: any; score?: any; [key: string]: any },
  arbitraryScorePayload?: any
): { valid: boolean; error?: string } {
  let signalStr: string;
  let payload: any = arbitraryScorePayload;

  if (typeof signalOrPayload === 'object' && signalOrPayload !== null) {
    signalStr = (signalOrPayload as any).signal;
    payload = payload || signalOrPayload;
  } else {
    signalStr = signalOrPayload;
  }

  // Reject arbitrary score edits
  if (
    payload &&
    (payload.runs !== undefined ||
      payload.wickets !== undefined ||
      payload.score !== undefined)
  ) {
    return { valid: false, error: 'Umpires are not permitted to modify arbitrary scores directly' };
  }

  // Permitted signals check
  if (!PERMITTED_UMPIRE_SIGNALS.includes(signalStr as any)) {
    return {
      valid: false,
      error: `Invalid umpire decision signal: ${signalStr}. Permitted signals: ${PERMITTED_UMPIRE_SIGNALS.join(', ')}`
    };
  }

  return { valid: true };
}

export function validateLineupUpdate(
  payload: {
    teamId: string;
    captainId?: string;
    captainPlayerId?: string;
    wicketKeeperId?: string;
    wicketkeeperPlayerId?: string;
    battingOrder?: string[];
    playerRoles?: Record<string, string>;
  },
  existingPlayerIds: string[]
): { valid: boolean; error?: string } {
  if (payload.teamId !== 'TEAM_A' && payload.teamId !== 'TEAM_B') {
    return { valid: false, error: 'Invalid team ID. Must be TEAM_A or TEAM_B' };
  }

  const validIdSet = new Set(existingPlayerIds);
  const cap = payload.captainPlayerId || payload.captainId;
  const wk = payload.wicketkeeperPlayerId || payload.wicketKeeperId;

  if (cap && !validIdSet.has(cap)) {
    return { valid: false, error: `Captain ID ${cap} not found in team roster` };
  }

  if (wk && !validIdSet.has(wk)) {
    return { valid: false, error: `Wicketkeeper ID ${wk} not found in team roster` };
  }

  if (payload.battingOrder) {
    if (payload.battingOrder.length !== existingPlayerIds.length) {
      return { valid: false, error: `Batting order must contain exactly ${existingPlayerIds.length} players` };
    }
    const orderSet = new Set(payload.battingOrder);
    if (orderSet.size !== payload.battingOrder.length) {
      return { valid: false, error: 'Batting order contains duplicate players' };
    }
    for (const id of payload.battingOrder) {
      if (!validIdSet.has(id)) {
        return { valid: false, error: `Unknown player ${id} in batting order` };
      }
    }
  }

  if (payload.playerRoles) {
    const validRoles = ['BATSMAN', 'BATTER', 'BOWLER', 'ALL_ROUNDER', 'WICKET_KEEPER'];
    for (const [playerId, role] of Object.entries(payload.playerRoles)) {
      if (!validIdSet.has(playerId)) {
        return { valid: false, error: `Cannot set role for unknown player ${playerId}` };
      }
      if (!validRoles.includes(role)) {
        return { valid: false, error: `Invalid role ${role} for player ${playerId}` };
      }
    }
  }

  return { valid: true };
}

