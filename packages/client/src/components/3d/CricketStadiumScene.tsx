import React from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Text } from '@react-three/drei';
import * as THREE from 'three';
import {
  GROUND_DIMENSIONS,
  DEFAULT_FIELD_PRESETS,
  CricketGameState
} from '@cricket2026/shared';

export type CameraViewMode = 'STRIKER' | 'BOWLER' | 'BROADCAST' | 'SPECTATOR';

interface StadiumProps {
  cameraMode: CameraViewMode;
  gameState: CricketGameState | null;
  myPlayerId?: string | null;
}

/**
 * 3D Wickets & Bails Component
 */
function Wickets({ zPosition }: { zPosition: number }) {
  const stumpSpacing = 0.08; // 8cm
  return (
    <group position={[0, 0, zPosition]}>
      {/* 3 Stumps */}
      {[-stumpSpacing, 0, stumpSpacing].map((xOffset, idx) => (
        <mesh key={idx} position={[xOffset, GROUND_DIMENSIONS.STUMP_HEIGHT_METERS / 2, 0]} castShadow>
          <cylinderGeometry args={[0.02, 0.02, GROUND_DIMENSIONS.STUMP_HEIGHT_METERS, 16]} />
          <meshStandardMaterial color="#d4a373" roughness={0.4} />
        </mesh>
      ))}
      {/* 2 Bails */}
      <mesh position={[-stumpSpacing / 2, GROUND_DIMENSIONS.STUMP_HEIGHT_METERS + 0.015, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.008, 0.008, stumpSpacing * 1.1, 8]} />
        <meshStandardMaterial color="#fef08a" roughness={0.3} />
      </mesh>
      <mesh position={[stumpSpacing / 2, GROUND_DIMENSIONS.STUMP_HEIGHT_METERS + 0.015, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.008, 0.008, stumpSpacing * 1.1, 8]} />
        <meshStandardMaterial color="#fef08a" roughness={0.3} />
      </mesh>
    </group>
  );
}

/**
 * 3D Cricketer Avatar Component
 */
function CricketerModel({
  position,
  label,
  isStriker,
  isBowler,
  isHuman,
  isUserCricketer,
  teamColor = '#1d4ed8'
}: {
  position: [number, number, number];
  label: string;
  isStriker?: boolean;
  isBowler?: boolean;
  isHuman?: boolean;
  isUserCricketer?: boolean;
  teamColor?: string;
}) {
  return (
    <group position={position}>
      {/* Player marker ring */}
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.5, 0.65, 32]} />
        <meshBasicMaterial
          color={isUserCricketer ? '#eab308' : isHuman ? '#38bdf8' : '#64748b'}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Floating HUD Label */}
      <Text
        position={[0, 2.3, 0]}
        fontSize={0.32}
        color={isUserCricketer ? '#facc15' : '#ffffff'}
        anchorX="center"
        anchorY="middle"
      >
        {`${label}${isUserCricketer ? ' ★ (YOU)' : isHuman ? ' 👤' : ' 🤖'}`}
      </Text>

      {/* Cricketer Torso */}
      <mesh position={[0, 1.25, 0]} castShadow>
        <capsuleGeometry args={[0.22, 0.65, 8, 16]} />
        <meshStandardMaterial color={teamColor} roughness={0.6} />
      </mesh>

      {/* Helmet / Head */}
      <mesh position={[0, 1.82, 0]} castShadow>
        <sphereGeometry args={[0.16, 16, 16]} />
        <meshStandardMaterial color={isStriker ? '#1e3a8a' : '#0f172a'} roughness={0.3} metalness={0.2} />
      </mesh>

      {/* Bat (for striker) */}
      {isStriker && (
        <group position={[0.3, 0.7, 0.2]} rotation={[0.4, 0.2, -0.3]}>
          <mesh castShadow>
            <boxGeometry args={[0.1, 0.8, 0.04]} />
            <meshStandardMaterial color="#c29b68" roughness={0.5} />
          </mesh>
          <mesh position={[0, 0.5, 0]}>
            <cylinderGeometry args={[0.02, 0.02, 0.25, 8]} />
            <meshStandardMaterial color="#1e293b" />
          </mesh>
        </group>
      )}

      {/* Bowling Ball in hand (for bowler) */}
      {isBowler && (
        <mesh position={[0.35, 1.2, 0.1]} castShadow>
          <sphereGeometry args={[0.045, 16, 16]} />
          <meshStandardMaterial color="#dc2626" roughness={0.4} />
        </mesh>
      )}
    </group>
  );
}

/**
 * Main 3D Stadium Environment
 */
export const CricketStadiumScene: React.FC<StadiumProps> = ({
  cameraMode,
  gameState,
  myPlayerId
}) => {
  const pitchHalfLength = GROUND_DIMENSIONS.PITCH_LENGTH_METERS / 2; // ~10.06m

  // Camera settings per mode
  const getCameraConfig = (): { position: [number, number, number]; lookAt: [number, number, number] } => {
    switch (cameraMode) {
      case 'STRIKER':
        return { position: [0, 2.4, pitchHalfLength + 4.5], lookAt: [0, 1.0, -pitchHalfLength] };
      case 'BOWLER':
        return { position: [0, 3.2, -pitchHalfLength - 12], lookAt: [0, 1.0, pitchHalfLength] };
      case 'BROADCAST':
        return { position: [36, 18, 0], lookAt: [0, 1.5, 0] };
      case 'SPECTATOR':
      default:
        return { position: [40, 28, 45], lookAt: [0, 0, 0] };
    }
  };

  const camConfig = getCameraConfig();

  return (
    <div className="w-full h-full relative overflow-hidden bg-slate-950">
      <Canvas shadows>
        <PerspectiveCamera makeDefault position={camConfig.position} fov={50} />
        {cameraMode === 'SPECTATOR' && (
          <OrbitControls maxPolarAngle={Math.PI / 2 - 0.05} maxDistance={120} minDistance={5} />
        )}

        {/* Stadium Night & Sun Lights */}
        <ambientLight intensity={0.65} />
        <directionalLight
          position={[40, 60, 30]}
          intensity={1.2}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
          shadow-camera-near={10}
          shadow-camera-far={200}
          shadow-camera-left={-60}
          shadow-camera-right={60}
          shadow-camera-top={60}
          shadow-camera-bottom={-60}
        />

        {/* 4 Corner Floodlight Towers */}
        {[
          [-55, 38, -55],
          [55, 38, -55],
          [-55, 38, 55],
          [55, 38, 55]
        ].map((pos, idx) => (
          <group key={idx} position={pos as [number, number, number]}>
            <mesh>
              <cylinderGeometry args={[0.6, 1.2, 38, 8]} />
              <meshStandardMaterial color="#334155" metalness={0.8} />
            </mesh>
            <mesh position={[0, 19, 0]}>
              <boxGeometry args={[6, 4, 2]} />
              <meshStandardMaterial color="#f8fafc" emissive="#f8fafc" emissiveIntensity={1.5} />
            </mesh>
            <spotLight
              position={[0, 18, 0]}
              target-position={[0, 0, 0]}
              intensity={0.8}
              angle={0.7}
              penumbra={0.5}
            />
          </group>
        ))}

        {/* Circular Outfield Grass */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
          <circleGeometry args={[GROUND_DIMENSIONS.BOUNDARY_RADIUS_METERS, 64]} />
          <meshStandardMaterial color="#166534" roughness={0.8} />
        </mesh>

        {/* 30-Yard Inner Circle Marking */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]}>
          <ringGeometry
            args={[
              GROUND_DIMENSIONS.INNER_CIRCLE_RADIUS_METERS - 0.1,
              GROUND_DIMENSIONS.INNER_CIRCLE_RADIUS_METERS + 0.1,
              64
            ]}
          />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.6} />
        </mesh>

        {/* Boundary Rope Ring */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.08, 0]}>
          <ringGeometry
            args={[
              GROUND_DIMENSIONS.BOUNDARY_RADIUS_METERS - 0.35,
              GROUND_DIMENSIONS.BOUNDARY_RADIUS_METERS,
              64
            ]}
          />
          <meshStandardMaterial color="#f8fafc" roughness={0.5} />
        </mesh>

        {/* 22-Yard Pitch Strip */}
        <mesh position={[0, 0.01, 0]} receiveShadow>
          <boxGeometry
            args={[
              GROUND_DIMENSIONS.PITCH_WIDTH_METERS,
              0.02,
              GROUND_DIMENSIONS.PITCH_LENGTH_METERS + 2.0
            ]}
          />
          <meshStandardMaterial color="#b48956" roughness={0.9} />
        </mesh>

        {/* Popping Crease White Markings */}
        {[-pitchHalfLength + GROUND_DIMENSIONS.POPPING_CREASE_METERS, pitchHalfLength - GROUND_DIMENSIONS.POPPING_CREASE_METERS].map(
          (z, i) => (
            <mesh key={i} position={[0, 0.022, z]} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[GROUND_DIMENSIONS.PITCH_WIDTH_METERS * 0.95, 0.08]} />
              <meshBasicMaterial color="#ffffff" />
            </mesh>
          )
        )}

        {/* Stumps & Bails at both ends */}
        <Wickets zPosition={pitchHalfLength} />
        <Wickets zPosition={-pitchHalfLength} />

        {/* Striker Cricketer */}
        <CricketerModel
          position={[0, 0, pitchHalfLength - 1.2]}
          label="Striker"
          isStriker
          isUserCricketer={gameState?.currentStrikerId === myPlayerId}
          teamColor="#1e40af"
        />

        {/* Non-Striker Cricketer */}
        <CricketerModel
          position={[1.5, 0, -pitchHalfLength + 1.2]}
          label="Non-Striker"
          isUserCricketer={gameState?.currentNonStrikerId === myPlayerId}
          teamColor="#1e40af"
        />

        {/* Bowler at Runup Mark */}
        <CricketerModel
          position={[0, 0, -pitchHalfLength - 8.5]}
          label="Bowler"
          isBowler
          isUserCricketer={gameState?.currentBowlerId === myPlayerId}
          teamColor="#15803d"
        />

        {/* Wicket-Keeper behind Striker Stumps */}
        <CricketerModel
          position={[0, 0, pitchHalfLength + 4.5]}
          label="Keeper"
          teamColor="#15803d"
        />

        {/* Outfield Fielders at standard coordinates */}
        {Object.entries(DEFAULT_FIELD_PRESETS)
          .filter(([name]) => !['BOWLER', 'WICKET_KEEPER'].includes(name))
          .slice(0, 9)
          .map(([name, coords]) => (
            <CricketerModel
              key={name}
              position={[coords.x, 0, coords.z]}
              label={name.replace('_', ' ')}
              teamColor="#15803d"
            />
          ))}

        {/* 3D Cricket Ball */}
        <mesh
          position={[
            gameState?.activeDelivery.ball.position.x || 0,
            Math.max(0.04, gameState?.activeDelivery.ball.position.y || 0.8),
            gameState?.activeDelivery.ball.position.z || 0
          ]}
          castShadow
        >
          <sphereGeometry args={[GROUND_DIMENSIONS.BALL_RADIUS_METERS, 24, 24]} />
          <meshStandardMaterial color="#dc2626" roughness={0.3} metalness={0.1} />
        </mesh>
      </Canvas>
    </div>
  );
};
