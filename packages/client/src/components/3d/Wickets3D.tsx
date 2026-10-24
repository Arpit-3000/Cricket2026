import React from 'react';
import { GROUND_DIMENSIONS } from '@cricket2026/shared';

interface Wickets3DProps {
  zPosition: number;
}

export const Wickets3D: React.FC<Wickets3DProps> = ({ zPosition }) => {
  const stumpSpacing = 0.085; // ~8.5cm spacing (total width ~22.8cm)
  const stumpHeight = GROUND_DIMENSIONS.STUMP_HEIGHT_METERS; // 0.711m
  const stumpRadius = 0.019; // ~3.8cm diameter

  return (
    <group position={[0, 0, zPosition]}>
      {/* 3 Wooden Stumps (Off, Middle, Leg) */}
      {[-stumpSpacing, 0, stumpSpacing].map((xOffset, idx) => (
        <group key={idx} position={[xOffset, 0, 0]}>
          {/* Main Stump Shaft */}
          <mesh position={[0, stumpHeight / 2, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[stumpRadius, stumpRadius, stumpHeight, 16]} />
            <meshStandardMaterial color="#cfa878" roughness={0.35} metalness={0.05} />
          </mesh>

          {/* Rounded Crown Top */}
          <mesh position={[0, stumpHeight + 0.008, 0]}>
            <sphereGeometry args={[stumpRadius, 16, 8]} />
            <meshStandardMaterial color="#bf9664" roughness={0.3} />
          </mesh>

          {/* Ground Base Spike */}
          <mesh position={[0, 0.015, 0]}>
            <cylinderGeometry args={[stumpRadius * 1.15, stumpRadius * 1.15, 0.03, 16]} />
            <meshStandardMaterial color="#3e2712" roughness={0.8} />
          </mesh>
        </group>
      ))}

      {/* Cross Bail 1 (between Stump 1 & 2) */}
      <mesh
        position={[-stumpSpacing / 2, stumpHeight + 0.018, 0]}
        rotation={[0, 0, Math.PI / 2]}
        castShadow
      >
        <cylinderGeometry args={[0.007, 0.007, stumpSpacing * 1.1, 12]} />
        <meshStandardMaterial color="#fef08a" roughness={0.25} metalness={0.1} />
      </mesh>

      {/* Cross Bail 2 (between Stump 2 & 3) */}
      <mesh
        position={[stumpSpacing / 2, stumpHeight + 0.018, 0]}
        rotation={[0, 0, Math.PI / 2]}
        castShadow
      >
        <cylinderGeometry args={[0.007, 0.007, stumpSpacing * 1.1, 12]} />
        <meshStandardMaterial color="#fef08a" roughness={0.25} metalness={0.1} />
      </mesh>
    </group>
  );
};
