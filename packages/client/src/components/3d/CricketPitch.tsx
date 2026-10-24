import React, { useMemo } from 'react';
import * as THREE from 'three';
import { GROUND_DIMENSIONS } from '@cricket2026/shared';

export const CricketPitch: React.FC = () => {
  const pitchHalfLength = GROUND_DIMENSIONS.PITCH_LENGTH_METERS / 2; // ~10.06m
  const poppingCreaseDist = GROUND_DIMENSIONS.POPPING_CREASE_METERS; // 1.22m

  // Outfield concentric stripes (mowing pattern)
  const lawnStripes = useMemo(() => {
    const stripes: { inner: number; outer: number; isDark: boolean }[] = [];
    const step = 4.0; // 4m wide mower rings
    for (let r = 0; r < GROUND_DIMENSIONS.BOUNDARY_RADIUS_METERS; r += step) {
      stripes.push({
        inner: r,
        outer: Math.min(r + step, GROUND_DIMENSIONS.BOUNDARY_RADIUS_METERS),
        isDark: Math.floor(r / step) % 2 === 0
      });
    }
    return stripes;
  }, []);

  // 30-yard circle disc markers around circumference
  const innerCircleDiscs = useMemo(() => {
    const discs: [number, number, number][] = [];
    const count = 36;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      discs.push([
        Math.cos(angle) * GROUND_DIMENSIONS.INNER_CIRCLE_RADIUS_METERS,
        0.02,
        Math.sin(angle) * GROUND_DIMENSIONS.INNER_CIRCLE_RADIUS_METERS
      ]);
    }
    return discs;
  }, []);

  return (
    <group>
      {/* =========================================================================
          1. OUTFIELD WITH REALISTIC CONCENTRIC MOWING PATTERN
      ========================================================================= */}
      {lawnStripes.map((stripe, idx) => (
        <mesh key={idx} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
          <ringGeometry args={[stripe.inner, stripe.outer, 64]} />
          <meshStandardMaterial
            color={stripe.isDark ? '#14532d' : '#166534'}
            roughness={0.85}
            metalness={0.05}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}

      {/* 30-Yard Fielding Restriction White Line */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.006, 0]}>
        <ringGeometry
          args={[
            GROUND_DIMENSIONS.INNER_CIRCLE_RADIUS_METERS - 0.08,
            GROUND_DIMENSIONS.INNER_CIRCLE_RADIUS_METERS + 0.08,
            64
          ]}
        />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.65} side={THREE.DoubleSide} />
      </mesh>

      {/* 30-Yard Fielding Restriction Plastic White Discs */}
      {innerCircleDiscs.map((pos, idx) => (
        <mesh key={idx} position={pos} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.22, 16]} />
          <meshBasicMaterial color="#ffffff" side={THREE.DoubleSide} />
        </mesh>
      ))}

      {/* =========================================================================
          2. TRIANGULAR FOAM BOUNDARY WEDGE ROPE (At 65m boundary radius)
      ========================================================================= */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.12, 0]}>
        <torusGeometry args={[GROUND_DIMENSIONS.BOUNDARY_RADIUS_METERS - 0.2, 0.18, 12, 100]} />
        <meshStandardMaterial color="#f8fafc" roughness={0.4} />
      </mesh>

      {/* =========================================================================
          3. 22-YARD CLAY/TURF PITCH STRIP
      ========================================================================= */}
      {/* Surrounding dry clay apron */}
      <mesh position={[0, 0.004, 0]} receiveShadow>
        <boxGeometry
          args={[
            GROUND_DIMENSIONS.PITCH_WIDTH_METERS + 0.8,
            0.01,
            GROUND_DIMENSIONS.PITCH_LENGTH_METERS + 2.8
          ]}
        />
        <meshStandardMaterial color="#78593a" roughness={0.95} />
      </mesh>

      {/* Central Playing Turf Strip */}
      <mesh position={[0, 0.012, 0]} receiveShadow>
        <boxGeometry
          args={[
            GROUND_DIMENSIONS.PITCH_WIDTH_METERS,
            0.015,
            GROUND_DIMENSIONS.PITCH_LENGTH_METERS + 1.2
          ]}
        />
        <meshStandardMaterial color="#b58d5b" roughness={0.92} metalness={0.02} />
      </mesh>

      {/* Bowler Landing Footmarks (worn dark soil patches at bowling creases) */}
      <mesh position={[-0.45, 0.022, -pitchHalfLength - 0.4]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.8, 1.4]} />
        <meshBasicMaterial color="#543c22" transparent opacity={0.7} />
      </mesh>
      <mesh position={[0.45, 0.022, pitchHalfLength + 0.4]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.8, 1.4]} />
        <meshBasicMaterial color="#543c22" transparent opacity={0.7} />
      </mesh>

      {/* =========================================================================
          4. OFFICIAL VISIBLE CREASES (ICC Law 8 Standard Dimensions)
      ========================================================================= */}

      {/* STRIKER END (North: Z = +pitchHalfLength) */}
      {/* Bowling Crease (through base of stumps, 2.64m wide) */}
      <mesh position={[0, 0.023, pitchHalfLength]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[GROUND_DIMENSIONS.RETURN_CREASE_WIDTH_METERS, 0.05]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>

      {/* Popping Crease (1.22m in front of bowling crease, 3.66m wide) */}
      <mesh position={[0, 0.023, pitchHalfLength - poppingCreaseDist]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[GROUND_DIMENSIONS.PITCH_WIDTH_METERS * 1.2, 0.08]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>

      {/* Return Creases (perpendicular, extending back from popping crease) */}
      <mesh
        position={[GROUND_DIMENSIONS.RETURN_CREASE_WIDTH_METERS / 2, 0.023, pitchHalfLength - poppingCreaseDist / 2]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <planeGeometry args={[0.05, poppingCreaseDist * 1.8]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
      <mesh
        position={[-GROUND_DIMENSIONS.RETURN_CREASE_WIDTH_METERS / 2, 0.023, pitchHalfLength - poppingCreaseDist / 2]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <planeGeometry args={[0.05, poppingCreaseDist * 1.8]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>

      {/* NON-STRIKER END (South: Z = -pitchHalfLength) */}
      {/* Bowling Crease (through base of stumps, 2.64m wide) */}
      <mesh position={[0, 0.023, -pitchHalfLength]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[GROUND_DIMENSIONS.RETURN_CREASE_WIDTH_METERS, 0.05]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>

      {/* Popping Crease (1.22m in front of bowling crease, 3.66m wide) */}
      <mesh position={[0, 0.023, -pitchHalfLength + poppingCreaseDist]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[GROUND_DIMENSIONS.PITCH_WIDTH_METERS * 1.2, 0.08]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>

      {/* Return Creases */}
      <mesh
        position={[GROUND_DIMENSIONS.RETURN_CREASE_WIDTH_METERS / 2, 0.023, -pitchHalfLength + poppingCreaseDist / 2]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <planeGeometry args={[0.05, poppingCreaseDist * 1.8]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
      <mesh
        position={[-GROUND_DIMENSIONS.RETURN_CREASE_WIDTH_METERS / 2, 0.023, -pitchHalfLength + poppingCreaseDist / 2]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <planeGeometry args={[0.05, poppingCreaseDist * 1.8]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
    </group>
  );
};
