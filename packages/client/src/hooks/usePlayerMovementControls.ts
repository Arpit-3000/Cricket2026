import { useEffect, useRef, useCallback } from 'react';
import {
  PlayerMovementInput,
  PlayerEntityState,
  PlayerAnimationState,
  FieldingIntent,
  GROUND_DIMENSIONS
} from '@cricket2026/shared';

interface MovementControlOptions {
  roomCode: string | null;
  assignedPlayerId: string | null | undefined;
  playerEntities: Record<string, PlayerEntityState>;
  ballPosition?: { x: number; y: number; z: number };
  ballPossessedById?: string | null;
  onSendMovement: (input: PlayerMovementInput) => void;
  onSendFieldingAction?: (intent: FieldingIntent) => void;
  isEnabled: boolean;
}

export function usePlayerMovementControls({
  roomCode,
  assignedPlayerId,
  playerEntities,
  ballPosition: _ballPosition,
  ballPossessedById: _ballPossessedById,
  onSendMovement,
  onSendFieldingAction,
  isEnabled
}: MovementControlOptions) {
  const keysPressed = useRef<Set<string>>(new Set());
  const sequenceRef = useRef<number>(0);
  const positionRef = useRef<{ x: number; y: number; z: number }>({ x: 0, y: 0, z: 0 });
  const rotationRef = useRef<number>(0);
  const lastTickTime = useRef<number>(Date.now());
  const initializedForPlayer = useRef<string | null>(null);

  // Initialize position from server entity when slot is claimed
  useEffect(() => {
    if (assignedPlayerId && playerEntities[assignedPlayerId]) {
      const serverEntity = playerEntities[assignedPlayerId];
      if (initializedForPlayer.current !== assignedPlayerId) {
        positionRef.current = { ...serverEntity.position };
        rotationRef.current = serverEntity.rotationY;
        initializedForPlayer.current = assignedPlayerId;
      }
    }
  }, [assignedPlayerId, playerEntities]);

  // Key event listeners
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) {
      return;
    }
    const key = e.key.toLowerCase();
    if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'shift', ' ', 'e', 'f'].includes(key)) {
      keysPressed.current.add(key);

      // Contextual actions
      if (key === 'e' && assignedPlayerId && onSendFieldingAction) {
        onSendFieldingAction({
          fielderId: assignedPlayerId,
          action: 'PICKUP',
          timestamp: Date.now()
        });
      }

      if (key === ' ' && assignedPlayerId && onSendFieldingAction) {
        onSendFieldingAction({
          fielderId: assignedPlayerId,
          action: 'DIVE',
          timestamp: Date.now()
        });
      }

      if (key === 'f' && assignedPlayerId && onSendFieldingAction) {
        onSendFieldingAction({
          fielderId: assignedPlayerId,
          action: 'OVERARM_THROW',
          throwTargetEnd: 'STRIKER_END',
          throwPower: 85,
          timestamp: Date.now()
        });
      }
    }
  }, [assignedPlayerId, onSendFieldingAction]);

  const handleKeyUp = useCallback((e: KeyboardEvent) => {
    const key = e.key.toLowerCase();
    keysPressed.current.delete(key);
  }, []);

  const handleMouseDown = useCallback((e: MouseEvent) => {
    if (e.button === 0 && assignedPlayerId && onSendFieldingAction) {
      if ((e.target as HTMLElement)?.closest('button, input, select, .glass-panel')) {
        return;
      }
      onSendFieldingAction({
        fielderId: assignedPlayerId,
        action: 'OVERARM_THROW',
        throwTargetEnd: 'STRIKER_END',
        throwPower: 85,
        timestamp: Date.now()
      });
    }
  }, [assignedPlayerId, onSendFieldingAction]);

  useEffect(() => {
    if (!isEnabled) return;
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('mousedown', handleMouseDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('mousedown', handleMouseDown);
    };
  }, [isEnabled, handleKeyDown, handleKeyUp, handleMouseDown]);

  // Authoritative movement submission loop at 30Hz (~33ms)
  useEffect(() => {
    if (!isEnabled || !roomCode || !assignedPlayerId) return;

    const interval = setInterval(() => {
      const now = Date.now();
      const dt = Math.min(0.1, (now - lastTickTime.current) / 1000);
      lastTickTime.current = now;

      let dx = 0;
      let dz = 0;
      const keys = keysPressed.current;

      if (keys.has('w') || keys.has('arrowup')) dz -= 1;
      if (keys.has('s') || keys.has('arrowdown')) dz += 1;
      if (keys.has('a') || keys.has('arrowleft')) dx -= 1;
      if (keys.has('d') || keys.has('arrowright')) dx += 1;

      const isSprinting = keys.has('shift');
      const isDiving = keys.has(' ');
      const isMoving = dx !== 0 || dz !== 0;

      if (isMoving) {
        const len = Math.hypot(dx, dz);
        dx /= len;
        dz /= len;

        const speed = isSprinting ? 9.5 : 5.8;
        const newX = positionRef.current.x + dx * speed * dt;
        const newZ = positionRef.current.z + dz * speed * dt;

        // Boundary constraint
        const distFromCenter = Math.hypot(newX, newZ);
        const maxDist = GROUND_DIMENSIONS.BOUNDARY_RADIUS_METERS + 1.0;
        if (distFromCenter <= maxDist) {
          positionRef.current.x = newX;
          positionRef.current.z = newZ;
        }

        rotationRef.current = Math.atan2(dx, dz);
      }

      let animationState: PlayerAnimationState = 'IDLE';
      if (isDiving) {
        animationState = 'DIVE';
      } else if (isMoving) {
        animationState = isSprinting ? 'SPRINT' : 'RUN';
      } else if (assignedPlayerId?.includes('player_1')) {
        animationState = 'BATTING_STANCE';
      }

      // If moving or state changed or periodic heartbeat
      if (isMoving || isDiving || sequenceRef.current % 15 === 0) {
        sequenceRef.current += 1;
        const input: PlayerMovementInput = {
          roomCode,
          playerId: assignedPlayerId,
          position: { ...positionRef.current },
          rotationY: rotationRef.current,
          velocity: {
            x: isMoving ? dx * (isSprinting ? 9.5 : 5.8) : 0,
            y: 0,
            z: isMoving ? dz * (isSprinting ? 9.5 : 5.8) : 0
          },
          animationState,
          sequence: sequenceRef.current,
          clientTimestamp: now
        };

        onSendMovement(input);
      }
    }, 1000 / 30);

    return () => clearInterval(interval);
  }, [isEnabled, roomCode, assignedPlayerId, onSendMovement]);

  return {
    currentPosition: positionRef.current,
    currentRotation: rotationRef.current
  };
}
