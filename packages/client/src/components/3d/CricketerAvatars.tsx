import React, { useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import {
  DEFAULT_FIELD_PRESETS,
  GROUND_DIMENSIONS,
  CricketGameState,
  PlayerEntityState
} from '@cricket2026/shared';
import { RealisticCricketer, CricketerVisualRole } from './RealisticCricketer.js';

interface CricketerAvatarsProps {
  gameState: CricketGameState | null;
  playerEntities?: Record<string, PlayerEntityState>;
  myPlayerId?: string | null;
  lastUmpireSignal?: string | null;
}

export const CricketerAvatars: React.FC<CricketerAvatarsProps> = ({
  gameState,
  playerEntities = {},
  myPlayerId,
  lastUmpireSignal
}) => {
  const pitchHalfLength = GROUND_DIMENSIONS.PITCH_LENGTH_METERS / 2; // ~10.06m
  const entityList = Object.values(playerEntities);

  // Team Colors
  const teamAColor = gameState?.teams.TEAM_A.primaryColor || '#1d4ed8'; // Royal Blue
  const teamBColor = gameState?.teams.TEAM_B.primaryColor || '#15803d'; // Forest Green
  const teamAAccent = gameState?.teams.TEAM_A.secondaryColor || '#facc15'; // Gold
  const teamBAccent = gameState?.teams.TEAM_B.secondaryColor || '#fbbf24'; // Amber

  return (
    <group>
      {/* =========================================================================
          1. REALISTIC HUMANOID CRICKETERS (Server-Synchronized Entities)
      ========================================================================= */}
      {entityList.length > 0 ? (
        entityList.map((entity, idx) => {
          const isStriker = entity.role === 'STRIKER' || entity.playerId === gameState?.currentStrikerId;
          const isNonStriker = entity.role === 'NON_STRIKER' || entity.playerId === gameState?.currentNonStrikerId;
          const isBowler = entity.role === 'BOWLER' || entity.playerId === gameState?.currentBowlerId;
          const isKeeper = entity.role === 'WICKET_KEEPER';
          const isLocal = entity.playerId === myPlayerId;
          const isTeamA = entity.teamId === 'TEAM_A';
          const primaryColor = isTeamA ? teamAColor : teamBColor;
          const accentColor = isTeamA ? teamAAccent : teamBAccent;
          const hasBall = gameState?.activeDelivery.ball.possessedByFielderId === entity.playerId;

          let visualRole: CricketerVisualRole = 'FIELDER';
          if (isStriker || isNonStriker) visualRole = 'BATTER';
          else if (isKeeper) visualRole = 'WICKET_KEEPER';
          else if (isBowler) visualRole = 'BOWLER';

          return (
            <RealisticCricketer
              key={entity.playerId}
              targetPosition={[entity.position.x, entity.position.y, entity.position.z]}
              targetRotationY={entity.rotationY}
              label={entity.displayName || entity.role.replace('_', ' ')}
              jerseyNumber={entity.jerseyNumber || (idx + 1)}
              animationState={entity.animationState}
              visualRole={visualRole}
              teamColor={primaryColor}
              teamAccentColor={accentColor}
              isLocalPlayer={isLocal}
              isHuman={entity.isHuman}
              isDisconnected={entity.isDisconnected}
              hasBallPossession={hasBall}
              skinTone={idx % 3 === 0 ? '#d4a373' : idx % 3 === 1 ? '#e0ac69' : '#8d5524'}
            />
          );
        })
      ) : (
        /* Fallback Practice Preview: Realistic Formations */
        <>
          {/* Striker Batter */}
          <RealisticCricketer
            targetPosition={[0, 0, pitchHalfLength - 1.2]}
            targetRotationY={Math.PI}
            label="Striker"
            jerseyNumber={18}
            animationState="BATTING_STANCE"
            visualRole="BATTER"
            teamColor={teamAColor}
            teamAccentColor={teamAAccent}
            isLocalPlayer={gameState?.currentStrikerId === myPlayerId}
            skinTone="#d4a373"
          />

          {/* Non-Striker Batter */}
          <RealisticCricketer
            targetPosition={[1.4, 0, -pitchHalfLength + 1.2]}
            targetRotationY={0}
            label="Non-Striker"
            jerseyNumber={45}
            animationState="IDLE"
            visualRole="BATTER"
            teamColor={teamAColor}
            teamAccentColor={teamAAccent}
            isLocalPlayer={gameState?.currentNonStrikerId === myPlayerId}
            skinTone="#e0ac69"
          />

          {/* Bowler */}
          <RealisticCricketer
            targetPosition={[0, 0, -pitchHalfLength - 8.5]}
            targetRotationY={0}
            label="Bowler"
            jerseyNumber={93}
            animationState="IDLE"
            visualRole="BOWLER"
            teamColor={teamBColor}
            teamAccentColor={teamBAccent}
            isLocalPlayer={gameState?.currentBowlerId === myPlayerId}
            skinTone="#8d5524"
          />

          {/* Wicketkeeper */}
          <RealisticCricketer
            targetPosition={[0, 0, pitchHalfLength + 3.8]}
            targetRotationY={Math.PI}
            label="Wicket-Keeper"
            jerseyNumber={7}
            animationState="KEEPER_READY"
            visualRole="WICKET_KEEPER"
            teamColor={teamBColor}
            teamAccentColor={teamBAccent}
            skinTone="#d4a373"
          />

          {/* Standard In-field & Out-field Fielders */}
          {Object.entries(DEFAULT_FIELD_PRESETS)
            .filter(([name]) => !['BOWLER', 'WICKET_KEEPER'].includes(name))
            .slice(0, 9)
            .map(([name, coords], idx) => (
              <RealisticCricketer
                key={name}
                targetPosition={[coords.x, 0, coords.z]}
                targetRotationY={Math.atan2(-coords.x, -coords.z)}
                label={name.replace(/_/g, ' ')}
                jerseyNumber={idx + 10}
                animationState="IDLE"
                visualRole="FIELDER"
                teamColor={teamBColor}
                teamAccentColor={teamBAccent}
                skinTone={idx % 2 === 0 ? '#e0ac69' : '#8d5524'}
              />
            ))}
        </>
      )}

      {/* =========================================================================
          2. OFFICIAL ON-FIELD UMPIRES (Bowler's End & Square Leg)
      ========================================================================= */}
      {/* Central Umpire standing directly behind non-striker stumps */}
      <RealisticCricketer
        targetPosition={[0, 0, -pitchHalfLength - 2.2]}
        targetRotationY={0}
        label="Umpire (Bowler End)"
        visualRole="UMPIRE"
        umpireSignal={lastUmpireSignal}
        skinTone="#d4a373"
      />

      {/* Square Leg Umpire standing on the batsman's leg side boundary angle */}
      <RealisticCricketer
        targetPosition={[15.5, 0, pitchHalfLength - 1.2]}
        targetRotationY={-Math.PI / 2}
        label="Umpire (Square Leg)"
        visualRole="UMPIRE"
        umpireSignal={lastUmpireSignal}
        skinTone="#e0ac69"
      />

      {/* =========================================================================
          3. REALISTIC 3D CRICKET BALL WITH RAISED WHITE SEAM
      ========================================================================= */}
      <CricketBall
        position={
          gameState?.activeDelivery.ball.position || {
            x: 0,
            y: 0.05,
            z: -pitchHalfLength + 0.6
          }
        }
      />
    </group>
  );
};

const CricketBall: React.FC<{
  position: { x: number; y: number; z: number };
}> = ({ position }) => {
  const ballRef = useRef<THREE.Group>(null);

  useFrame((_state, delta) => {
    if (!ballRef.current) return;
    const alpha = Math.min(1, delta * 20);
    ballRef.current.position.x = THREE.MathUtils.lerp(ballRef.current.position.x, position.x, alpha);
    ballRef.current.position.y = THREE.MathUtils.lerp(ballRef.current.position.y, Math.max(0.048, position.y), alpha);
    ballRef.current.position.z = THREE.MathUtils.lerp(ballRef.current.position.z, position.z, alpha);
    ballRef.current.rotation.x += delta * 12;
    ballRef.current.rotation.y += delta * 6;
  });

  return (
    <group ref={ballRef} position={[position.x, Math.max(0.048, position.y), position.z]}>
      {/* 4-Piece Cricket Ball Shell */}
      <mesh castShadow receiveShadow>
        <sphereGeometry args={[GROUND_DIMENSIONS.BALL_RADIUS_METERS, 24, 24]} />
        <meshStandardMaterial color="#dc2626" roughness={0.25} metalness={0.18} />
      </mesh>
      {/* 6-Row Stitched Seam */}
      <mesh rotation={[0, 0, Math.PI / 4]}>
        <torusGeometry args={[GROUND_DIMENSIONS.BALL_RADIUS_METERS + 0.0012, 0.0028, 8, 24]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
    </group>
  );
};
