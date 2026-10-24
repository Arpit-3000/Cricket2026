import { RoomSettings } from '../types/room.js';
import { BowlingDeliveryIntent, BattingShotIntent, FieldingIntent } from '../types/physics.js';
import { GROUND_DIMENSIONS } from '../constants/index.js';

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
  if (!intent.fielderId) return { valid: false, error: 'Fielder ID required' };
  return { valid: true };
}
