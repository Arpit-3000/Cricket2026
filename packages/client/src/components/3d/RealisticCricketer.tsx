import React, { useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import { PlayerAnimationState } from '@cricket2026/shared';

export type CricketerVisualRole =
  | 'BATTER'
  | 'BOWLER'
  | 'WICKET_KEEPER'
  | 'FIELDER'
  | 'UMPIRE';

export interface RealisticCricketerProps {
  targetPosition: [number, number, number];
  targetRotationY?: number;
  label: string;
  jerseyNumber?: number;
  animationState?: PlayerAnimationState;
  visualRole?: CricketerVisualRole;
  teamColor?: string;
  teamAccentColor?: string;
  isLocalPlayer?: boolean;
  isHuman?: boolean;
  isDisconnected?: boolean;
  hasBallPossession?: boolean;
  skinTone?: string;
  umpireSignal?: string | null;
}

export const RealisticCricketer: React.FC<RealisticCricketerProps> = ({
  targetPosition,
  targetRotationY = 0,
  label,
  jerseyNumber = 18,
  animationState = 'IDLE',
  visualRole = 'FIELDER',
  teamColor = '#1d4ed8', // Team primary (Royal Blue / Forest Green)
  teamAccentColor = '#facc15', // Gold accent
  isLocalPlayer = false,
  isHuman = false,
  isDisconnected = false,
  hasBallPossession = false,
  skinTone = '#d4a373', // Natural human skin tone
  umpireSignal = null
}) => {
  const rootGroupRef = useRef<THREE.Group>(null);
  const pelvisRef = useRef<THREE.Group>(null);
  const torsoRef = useRef<THREE.Group>(null);
  const headRef = useRef<THREE.Group>(null);
  const leftArmRef = useRef<THREE.Group>(null);
  const rightArmRef = useRef<THREE.Group>(null);
  const leftForearmRef = useRef<THREE.Group>(null);
  const rightForearmRef = useRef<THREE.Group>(null);
  const leftLegRef = useRef<THREE.Group>(null);
  const rightLegRef = useRef<THREE.Group>(null);
  const leftShinRef = useRef<THREE.Group>(null);
  const rightShinRef = useRef<THREE.Group>(null);
  const batRef = useRef<THREE.Group>(null);

  const animClockRef = useRef<number>(Math.random() * 10);

  const isBatter = visualRole === 'BATTER';
  const isKeeper = visualRole === 'WICKET_KEEPER';
  const isBowler = visualRole === 'BOWLER';
  const isUmpire = visualRole === 'UMPIRE';

  // Smooth Remote Player Interpolation and Procedural Skeletal Kinematics
  useFrame((_state, delta) => {
    if (!rootGroupRef.current) return;

    // Advance animation clock
    animClockRef.current += delta;
    const t = animClockRef.current;

    // Position & Rotation smoothing (LERP)
    const lerpSpeed = Math.min(1, delta * 15);
    rootGroupRef.current.position.x = THREE.MathUtils.lerp(
      rootGroupRef.current.position.x,
      targetPosition[0],
      lerpSpeed
    );
    rootGroupRef.current.position.y = THREE.MathUtils.lerp(
      rootGroupRef.current.position.y,
      targetPosition[1],
      lerpSpeed
    );
    rootGroupRef.current.position.z = THREE.MathUtils.lerp(
      rootGroupRef.current.position.z,
      targetPosition[2],
      lerpSpeed
    );

    rootGroupRef.current.rotation.y = THREE.MathUtils.lerp(
      rootGroupRef.current.rotation.y,
      targetRotationY,
      lerpSpeed
    );

    // =========================================================================
    // PROCEDURAL SKELETAL INVERSE KINEMATICS & ANIMATION POSTURES
    // =========================================================================
    const lerpJoint = (ref: React.RefObject<THREE.Group | null>, rx: number, ry: number, rz: number, speed = 12) => {
      if (!ref.current) return;
      const alpha = Math.min(1, delta * speed);
      ref.current.rotation.x = THREE.MathUtils.lerp(ref.current.rotation.x, rx, alpha);
      ref.current.rotation.y = THREE.MathUtils.lerp(ref.current.rotation.y, ry, alpha);
      ref.current.rotation.z = THREE.MathUtils.lerp(ref.current.rotation.z, rz, alpha);
    };

    // 1. UMPIRE SIGNALS & POSTURES
    if (isUmpire) {
      if (umpireSignal === 'OUT' || umpireSignal === 'WICKET') {
        // Dramatic raised right index finger
        lerpJoint(torsoRef, 0.05, 0, 0);
        lerpJoint(rightArmRef, -2.8, 0, 0.2); // Pointing straight up
        lerpJoint(rightForearmRef, -0.2, 0, 0);
        lerpJoint(leftArmRef, 0.2, 0, -0.2); // Left hand rested on waist
        lerpJoint(headRef, -0.1, 0, 0);
      } else if (umpireSignal === 'FOUR') {
        // Arm swept across body
        const wave = Math.sin(t * 8) * 0.45;
        lerpJoint(torsoRef, 0, wave * 0.2, 0);
        lerpJoint(rightArmRef, -0.3, wave + 0.5, 0.3);
        lerpJoint(rightForearmRef, 0, 0, 0);
        lerpJoint(leftArmRef, 0.2, 0, -0.2);
      } else if (umpireSignal === 'SIX') {
        // Both arms raised high above head
        lerpJoint(torsoRef, -0.05, 0, 0);
        lerpJoint(rightArmRef, -2.9, 0, 0.25);
        lerpJoint(leftArmRef, -2.9, 0, -0.25);
        lerpJoint(rightForearmRef, 0, 0, 0);
        lerpJoint(leftForearmRef, 0, 0, 0);
      } else if (umpireSignal === 'WIDE') {
        // Both arms horizontally wide at 90 degrees
        lerpJoint(torsoRef, 0, 0, 0);
        lerpJoint(rightArmRef, 0, 0, 1.55);
        lerpJoint(leftArmRef, 0, 0, -1.55);
      } else if (umpireSignal === 'NO_BALL') {
        // Right arm extended horizontally
        lerpJoint(torsoRef, 0, 0, 0);
        lerpJoint(rightArmRef, 0, 0, 1.55);
        lerpJoint(leftArmRef, 0.1, 0, -0.2);
      } else {
        // Natural attentive umpire stance
        const breath = Math.sin(t * 2) * 0.02;
        lerpJoint(torsoRef, 0.06 + breath, 0, 0);
        lerpJoint(rightArmRef, 0.25, 0.1, 0.15);
        lerpJoint(leftArmRef, 0.25, -0.1, -0.15);
        lerpJoint(rightForearmRef, 0.7, 0, 0); // Holding counter
        lerpJoint(leftForearmRef, 0.7, 0, 0);
      }
      return;
    }

    // 2. BATTING ANIMATIONS (Stance, Backswing, Shot Execution, Defense, Follow-through)
    if (isBatter && (animationState === 'BATTING_STANCE' || animationState === 'IDLE')) {
      // Balanced side-on stance, bent knees, tapping bat behind popping crease
      const tap = Math.sin(t * 5) * 0.12;
      lerpJoint(pelvisRef, 0.15, -0.3, 0);
      lerpJoint(torsoRef, 0.2, 0.35, -0.05);
      lerpJoint(headRef, -0.15, -0.45, 0); // Head turned sideways facing bowler
      lerpJoint(leftLegRef, -0.25, 0.1, -0.1);
      lerpJoint(rightLegRef, 0.3, -0.1, 0.1);
      lerpJoint(leftShinRef, 0.35, 0, 0);
      lerpJoint(rightShinRef, 0.25, 0, 0);
      // Bat tapping motion
      lerpJoint(leftArmRef, 0.45, 0.2, 0.2);
      lerpJoint(rightArmRef, 0.75 + tap, -0.2, -0.3);
      lerpJoint(leftForearmRef, 0.8, 0, 0);
      lerpJoint(rightForearmRef, 0.9, 0, 0);
      if (batRef.current) {
        batRef.current.rotation.x = 0.2 + tap * 0.5;
        batRef.current.rotation.z = -0.1;
      }
    } else if (isBatter && animationState === 'BACKSWING') {
      // Bat cocked high behind the back foot
      lerpJoint(torsoRef, 0.1, 0.6, -0.1);
      lerpJoint(headRef, -0.1, -0.5, 0);
      lerpJoint(leftArmRef, 0.9, 0.5, 0.4);
      lerpJoint(rightArmRef, 1.6, -0.4, -0.5);
      lerpJoint(leftForearmRef, 1.2, 0, 0);
      lerpJoint(rightForearmRef, 1.3, 0, 0);
      if (batRef.current) {
        batRef.current.rotation.x = 1.1;
        batRef.current.rotation.z = -0.4;
      }
    } else if (isBatter && (animationState === 'SHOT_EXECUTION' || animationState === 'ATTACKING_SHOT')) {
      // Dynamic forward drive / pull arc
      lerpJoint(torsoRef, 0.35, -0.5, 0.15);
      lerpJoint(headRef, 0.1, 0.2, 0);
      lerpJoint(leftArmRef, -0.6, -0.3, -0.4);
      lerpJoint(rightArmRef, -0.9, -0.5, -0.3);
      lerpJoint(leftForearmRef, 0.4, 0, 0);
      lerpJoint(rightForearmRef, 0.5, 0, 0);
      if (batRef.current) {
        batRef.current.rotation.x = -1.2;
        batRef.current.rotation.z = 0.3;
      }
    } else if (isBatter && (animationState === 'DEFENSIVE_SHOT' || animationState === 'DEFENSIVE_BLOCK')) {
      // Front foot defensive block, bat and pad pressed tight under eyes
      lerpJoint(pelvisRef, 0.3, -0.2, 0);
      lerpJoint(torsoRef, 0.45, 0.2, 0);
      lerpJoint(headRef, 0.2, -0.25, 0);
      lerpJoint(leftLegRef, -0.55, 0, 0); // Stride forward
      lerpJoint(leftShinRef, 0.65, 0, 0);
      lerpJoint(rightLegRef, 0.4, 0, 0);
      lerpJoint(leftArmRef, 0.3, 0.1, 0.15);
      lerpJoint(rightArmRef, 0.4, -0.1, -0.15);
      lerpJoint(leftForearmRef, 0.9, 0, 0);
      lerpJoint(rightForearmRef, 0.95, 0, 0);
      if (batRef.current) {
        batRef.current.rotation.x = -0.35;
        batRef.current.rotation.z = 0.05;
      }
    } else if (isBatter && animationState === 'FOLLOW_THROUGH') {
      // Full stylish high-elbow follow through
      lerpJoint(torsoRef, -0.15, -0.7, 0.2);
      lerpJoint(headRef, -0.2, 0.4, 0);
      lerpJoint(leftArmRef, -2.1, -0.3, 0.2); // High left elbow
      lerpJoint(rightArmRef, -1.8, -0.4, -0.1);
      lerpJoint(leftForearmRef, 0.9, 0, 0);
      lerpJoint(rightForearmRef, 0.8, 0, 0);
      if (batRef.current) {
        batRef.current.rotation.x = -2.2;
        batRef.current.rotation.z = 0.6;
      }
    }
    // 3. BOWLER RUN-UP, DELIVERY STRIDE, RELEASE, FOLLOW-THROUGH
    else if (isBowler && animationState === 'BOWLER_RUNUP') {
      const runFreq = t * 14;
      const legStride = Math.sin(runFreq) * 0.75;
      const armSwing = Math.cos(runFreq) * 0.85;

      lerpJoint(torsoRef, 0.35, legStride * 0.15, 0);
      lerpJoint(headRef, -0.25, 0, 0);
      lerpJoint(leftLegRef, legStride, 0, 0);
      lerpJoint(rightLegRef, -legStride, 0, 0);
      lerpJoint(leftShinRef, Math.max(0, -legStride * 0.9), 0, 0);
      lerpJoint(rightShinRef, Math.max(0, legStride * 0.9), 0, 0);
      lerpJoint(leftArmRef, -armSwing, 0, 0.2);
      lerpJoint(rightArmRef, armSwing, 0, -0.2);
      lerpJoint(leftForearmRef, 0.7, 0, 0);
      lerpJoint(rightForearmRef, 0.7, 0, 0);
    } else if (isBowler && animationState === 'DELIVERY_STRIDE') {
      // Pre-delivery coil: non-bowling arm high, bowling arm coiled back
      lerpJoint(torsoRef, 0.2, 0.45, -0.15);
      lerpJoint(headRef, -0.1, -0.4, 0);
      lerpJoint(leftArmRef, -2.5, 0.2, -0.1); // High front arm
      lerpJoint(rightArmRef, 1.4, -0.3, 0.4); // Coiled back arm
      lerpJoint(leftLegRef, -0.7, 0, 0); // Planting front leg
      lerpJoint(rightLegRef, 0.5, 0, 0);
    } else if (isBowler && animationState === 'RELEASE') {
      // High straight-arm over-the-top release at 12 o'clock
      lerpJoint(torsoRef, 0.4, -0.3, 0.1);
      lerpJoint(headRef, 0.1, 0.2, 0);
      lerpJoint(leftArmRef, 1.1, 0, -0.2); // Front arm pulling down into ribcage
      lerpJoint(rightArmRef, -2.9, 0, 0.1); // Bowling arm at vertical apex
      lerpJoint(rightForearmRef, 0, 0, 0);
      lerpJoint(leftLegRef, -0.2, 0, 0);
      lerpJoint(rightLegRef, 0.8, 0, 0);
    } else if (isBowler && animationState === 'FOLLOW_THROUGH') {
      // Bowling arm sweeps across left hip, decelerating off the pitch
      lerpJoint(torsoRef, 0.55, -0.4, 0.2);
      lerpJoint(headRef, -0.2, 0.1, 0);
      lerpJoint(rightArmRef, 0.8, -0.8, -0.5);
      lerpJoint(leftArmRef, 0.4, 0.2, -0.2);
      lerpJoint(leftLegRef, 0.4, 0, 0);
      lerpJoint(rightLegRef, -0.3, 0, 0);
    }
    // 4. WICKETKEEPER CROUCH & READY STANCE
    else if (isKeeper && (animationState === 'IDLE' || animationState === 'KEEPER_READY')) {
      const breath = Math.sin(t * 3) * 0.03;
      lerpJoint(pelvisRef, 0.45, 0, 0);
      lerpJoint(torsoRef, 0.55 + breath, 0, 0);
      lerpJoint(headRef, -0.45, 0, 0); // Looking forward under helmet visor
      lerpJoint(leftLegRef, -0.65, 0.2, -0.15); // Deep crouch
      lerpJoint(rightLegRef, -0.65, -0.2, 0.15);
      lerpJoint(leftShinRef, 0.85, 0, 0);
      lerpJoint(rightShinRef, 0.85, 0, 0);
      // Large catching gloves open in front of body
      lerpJoint(leftArmRef, 0.4, 0.25, 0.1);
      lerpJoint(rightArmRef, 0.4, -0.25, -0.1);
      lerpJoint(leftForearmRef, 1.1, 0, 0);
      lerpJoint(rightForearmRef, 1.1, 0, 0);
    }
    // 5. RUNNING, SPRINTING & DIVING
    else if (animationState === 'DIVE' || animationState === 'SLIDE') {
      // Horizontal turf slide / dive
      lerpJoint(pelvisRef, -1.25, 0, 0);
      lerpJoint(torsoRef, -0.3, 0, 0);
      lerpJoint(headRef, 0.5, 0, 0);
      lerpJoint(leftLegRef, 0.2, 0, 0);
      lerpJoint(rightLegRef, 0.3, 0, 0);
      lerpJoint(leftShinRef, 0.15, 0, 0);
      lerpJoint(rightShinRef, 0.15, 0, 0);
      lerpJoint(leftArmRef, -2.6, 0, -0.15); // Outstretched forward
      lerpJoint(rightArmRef, -2.6, 0, 0.15);
      lerpJoint(leftForearmRef, 0, 0, 0);
      lerpJoint(rightForearmRef, 0, 0, 0);
    } else if (animationState === 'SPRINT' || animationState === 'RUN') {
      const speed = animationState === 'SPRINT' ? 15 : 10;
      const stride = Math.sin(t * speed) * (animationState === 'SPRINT' ? 0.9 : 0.65);
      const armStride = Math.cos(t * speed) * (animationState === 'SPRINT' ? 1.0 : 0.7);

      lerpJoint(torsoRef, animationState === 'SPRINT' ? 0.45 : 0.25, stride * 0.1, 0);
      lerpJoint(headRef, animationState === 'SPRINT' ? -0.3 : -0.15, 0, 0);
      lerpJoint(leftLegRef, stride, 0, 0);
      lerpJoint(rightLegRef, -stride, 0, 0);
      lerpJoint(leftShinRef, Math.max(0, -stride * 1.1), 0, 0);
      lerpJoint(rightShinRef, Math.max(0, stride * 1.1), 0, 0);
      lerpJoint(leftArmRef, -armStride, 0, 0.2);
      lerpJoint(rightArmRef, armStride, 0, -0.2);
      lerpJoint(leftForearmRef, 0.8, 0, 0);
      lerpJoint(rightForearmRef, 0.8, 0, 0);
    } else if (animationState === 'FIELDING_PICKUP') {
      // Long-barrier fielding knee down to scoop ball
      lerpJoint(pelvisRef, 0.55, 0, 0);
      lerpJoint(torsoRef, 0.8, 0, 0); // Bending deeply
      lerpJoint(headRef, -0.5, 0, 0);
      lerpJoint(leftLegRef, -0.7, 0, 0);
      lerpJoint(rightLegRef, 0.8, 0, 0);
      lerpJoint(leftShinRef, 0.9, 0, 0);
      lerpJoint(rightShinRef, 0.6, 0, 0);
      lerpJoint(leftArmRef, 0.9, 0.1, 0.1);
      lerpJoint(rightArmRef, 0.9, -0.1, -0.1);
      lerpJoint(leftForearmRef, 0.5, 0, 0);
      lerpJoint(rightForearmRef, 0.5, 0, 0);
    } else if (animationState === 'CATCHING') {
      // Reaching up with soft cupped hands
      lerpJoint(torsoRef, -0.15, 0, 0);
      lerpJoint(headRef, -0.35, 0, 0);
      lerpJoint(leftArmRef, -2.1, 0.2, -0.1);
      lerpJoint(rightArmRef, -2.1, -0.2, 0.1);
      lerpJoint(leftForearmRef, 0.6, 0, 0);
      lerpJoint(rightForearmRef, 0.6, 0, 0);
    } else if (animationState === 'THROWING') {
      // Overarm throw
      lerpJoint(torsoRef, 0.3, -0.4, 0.1);
      lerpJoint(headRef, 0, 0.3, 0);
      lerpJoint(leftArmRef, 0.6, 0, -0.3); // Front arm pointing
      lerpJoint(rightArmRef, -2.2, -0.4, 0.3); // Cocked and releasing
      lerpJoint(rightForearmRef, 0.3, 0, 0);
    } else if (animationState === 'CELEBRATION') {
      // Fist pump & leap
      const hop = Math.abs(Math.sin(t * 6)) * 0.25;
      if (rootGroupRef.current) rootGroupRef.current.position.y = targetPosition[1] + hop;
      lerpJoint(torsoRef, -0.2, 0, 0);
      lerpJoint(headRef, -0.3, 0, 0);
      lerpJoint(rightArmRef, -2.8, 0, 0.3); // Raised fist
      lerpJoint(rightForearmRef, 0.5, 0, 0);
      lerpJoint(leftArmRef, -2.2, 0, -0.4);
    } else {
      // Natural idle stance with subtle breathing
      const breath = Math.sin(t * 2.2) * 0.02;
      lerpJoint(pelvisRef, 0, 0, 0);
      lerpJoint(torsoRef, 0.05 + breath, 0, 0);
      lerpJoint(headRef, 0, 0, 0);
      lerpJoint(leftLegRef, 0.05, 0, 0);
      lerpJoint(rightLegRef, -0.05, 0, 0);
      lerpJoint(leftShinRef, 0, 0, 0);
      lerpJoint(rightShinRef, 0, 0, 0);
      lerpJoint(leftArmRef, 0.15, 0, 0.12);
      lerpJoint(rightArmRef, 0.15, 0, -0.12);
      lerpJoint(leftForearmRef, 0.25, 0, 0);
      lerpJoint(rightForearmRef, 0.25, 0, 0);
    }
  });

  return (
    <group ref={rootGroupRef} position={targetPosition} rotation={[0, targetRotationY, 0]}>
      {/* 1. Ground Marker Halo (Local = Amber, Human = Cyan, AI = Subtle Slate) */}
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.38, 0.54, 32]} />
        <meshBasicMaterial
          color={isLocalPlayer ? '#facc15' : isHuman ? '#38bdf8' : isUmpire ? '#f8fafc' : '#475569'}
          side={THREE.DoubleSide}
          transparent
          opacity={0.8}
        />
      </mesh>

      {/* 2. Floating Name and Jersey Number Tag */}
      <Text
        position={[0, 2.32, 0]}
        fontSize={0.25}
        color={isDisconnected ? '#f87171' : isLocalPlayer ? '#fde047' : '#ffffff'}
        anchorX="center"
        anchorY="middle"
      >
        {`${isUmpire ? '⚖️ ' : ''}${label}${
          isDisconnected
            ? ' ⚠️ [Reconnecting]'
            : isLocalPlayer
            ? ' ★ YOU'
            : isHuman
            ? ' 👤'
            : isUmpire
            ? ''
            : ' 🤖'
        }`}
      </Text>

      {/* =========================================================================
          3. ARTICULATED HUMANOID SKELETON (Pelvis -> Spine -> Head / Arms / Legs)
      ========================================================================= */}
      <group ref={pelvisRef} position={[0, 0.95, 0]}>
        {/* Hip / Waist Athletic Shorts / Trousers */}
        <mesh castShadow receiveShadow>
          <boxGeometry args={[0.34, 0.24, 0.24]} />
          <meshStandardMaterial
            color={isUmpire ? '#0f172a' : '#ffffff'} // Umpire black trousers, players white trousers
            roughness={0.7}
          />
        </mesh>

        {/* =======================================================================
            TORSO / CHEST & JERSEY
        ======================================================================= */}
        <group ref={torsoRef} position={[0, 0.12, 0]}>
          {/* Main Upper Torso */}
          <mesh position={[0, 0.26, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.38, 0.44, 0.25]} />
            <meshStandardMaterial
              color={isUmpire ? '#1e293b' : teamColor}
              roughness={0.6}
            />
          </mesh>

          {/* Jersey V-Neck / Collar Accent */}
          <mesh position={[0, 0.47, 0.08]} castShadow>
            <boxGeometry args={[0.22, 0.07, 0.12]} />
            <meshStandardMaterial
              color={isUmpire ? '#ffffff' : teamAccentColor}
              roughness={0.5}
            />
          </mesh>

          {/* Jersey Team Crest on Front Left Chest */}
          {!isUmpire && (
            <mesh position={[-0.1, 0.34, 0.13]}>
              <circleGeometry args={[0.04, 16]} />
              <meshBasicMaterial color={teamAccentColor} />
            </mesh>
          )}

          {/* Player Jersey Number on Back */}
          {!isUmpire && (
            <Text
              position={[0, 0.32, -0.13]}
              rotation={[0, Math.PI, 0]}
              fontSize={0.16}
              color={teamAccentColor}
              anchorX="center"
              anchorY="middle"
            >
              {jerseyNumber.toString()}
            </Text>
          )}

          {/* =====================================================================
              HEAD, NECK & HEADGEAR (Helmet with metallic wire grille / Peaked Cap / Sunhat)
          ===================================================================== */}
          <group ref={headRef} position={[0, 0.52, 0]}>
            {/* Neck */}
            <mesh position={[0, 0.05, 0]}>
              <cylinderGeometry args={[0.065, 0.075, 0.1, 16]} />
              <meshStandardMaterial color={skinTone} roughness={0.7} />
            </mesh>

            {/* Cranium / Face */}
            <mesh position={[0, 0.18, 0]} castShadow>
              <sphereGeometry args={[0.12, 20, 20]} />
              <meshStandardMaterial color={skinTone} roughness={0.7} />
            </mesh>

            {/* Nose & Ear features */}
            <mesh position={[0, 0.17, 0.12]}>
              <boxGeometry args={[0.03, 0.05, 0.03]} />
              <meshStandardMaterial color={skinTone} roughness={0.7} />
            </mesh>

            {/* A. BATTER / KEEPER CRICKET HELMET WITH WIRE FACEGUARD GRILLE */}
            {(isBatter || isKeeper) && (
              <group position={[0, 0.2, 0]}>
                {/* Composite Shell */}
                <mesh castShadow>
                  <sphereGeometry args={[0.145, 24, 24, 0, Math.PI * 2, 0, Math.PI * 0.7]} />
                  <meshStandardMaterial color={teamColor} roughness={0.3} metalness={0.2} />
                </mesh>
                {/* Helmet Peak */}
                <mesh position={[0, 0.04, 0.12]} rotation={[0.2, 0, 0]}>
                  <boxGeometry args={[0.18, 0.025, 0.1]} />
                  <meshStandardMaterial color={teamColor} roughness={0.3} />
                </mesh>
                {/* Metallic Wire Faceguard Grille: Brow bar, Chin bar, Vertical struts */}
                <group position={[0, -0.06, 0.12]}>
                  {/* Chin protector */}
                  <mesh position={[0, -0.06, 0.01]}>
                    <boxGeometry args={[0.14, 0.03, 0.03]} />
                    <meshStandardMaterial color="#0f172a" roughness={0.5} />
                  </mesh>
                  {/* Wire struts */}
                  {[-0.05, 0, 0.05].map((x, i) => (
                    <mesh key={i} position={[x, 0, 0]}>
                      <cylinderGeometry args={[0.003, 0.003, 0.1, 8]} />
                      <meshStandardMaterial color="#cbd5e1" metalness={0.9} roughness={0.2} />
                    </mesh>
                  ))}
                  {/* Horizontal Wire Crossbar */}
                  <mesh position={[0, 0.01, 0]}>
                    <cylinderGeometry args={[0.0035, 0.0035, 0.15, 8]} />
                    <meshStandardMaterial color="#cbd5e1" metalness={0.9} roughness={0.2} />
                  </mesh>
                </group>
              </group>
            )}

            {/* B. BOWLER / FIELDER PEAKED CAP */}
            {!isBatter && !isKeeper && !isUmpire && (
              <group position={[0, 0.23, 0]}>
                <mesh castShadow>
                  <sphereGeometry args={[0.135, 20, 20, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
                  <meshStandardMaterial color={teamColor} roughness={0.6} />
                </mesh>
                {/* Curved Peak Visor */}
                <mesh position={[0, -0.02, 0.12]} rotation={[0.25, 0, 0]}>
                  <boxGeometry args={[0.16, 0.018, 0.11]} />
                  <meshStandardMaterial color={teamColor} roughness={0.6} />
                </mesh>
                {/* Cap Team Badge */}
                <mesh position={[0, 0.04, 0.125]}>
                  <circleGeometry args={[0.025, 12]} />
                  <meshBasicMaterial color={teamAccentColor} />
                </mesh>
              </group>
            )}

            {/* C. UMPIRE WIDE-BRIM SUNHAT */}
            {isUmpire && (
              <group position={[0, 0.24, 0]}>
                <mesh castShadow>
                  <cylinderGeometry args={[0.12, 0.14, 0.12, 24]} />
                  <meshStandardMaterial color="#f8fafc" roughness={0.6} />
                </mesh>
                {/* Wide Brim Ring */}
                <mesh position={[0, -0.04, 0]}>
                  <cylinderGeometry args={[0.26, 0.26, 0.015, 24]} />
                  <meshStandardMaterial color="#f8fafc" roughness={0.6} />
                </mesh>
                {/* Hat Ribbon Band */}
                <mesh position={[0, -0.02, 0]}>
                  <cylinderGeometry args={[0.138, 0.138, 0.025, 24]} />
                  <meshStandardMaterial color="#0f172a" roughness={0.4} />
                </mesh>
              </group>
            )}
          </group>

          {/* =====================================================================
              LEFT ARM & HAND
          ===================================================================== */}
          <group ref={leftArmRef} position={[-0.24, 0.38, 0]}>
            {/* Shoulder Deltoid & Sleeve */}
            <mesh position={[0, -0.1, 0]} castShadow>
              <cylinderGeometry args={[0.065, 0.055, 0.2, 12]} />
              <meshStandardMaterial color={isUmpire ? '#1e293b' : teamColor} roughness={0.6} />
            </mesh>

            {/* Forearm & Hand */}
            <group ref={leftForearmRef} position={[0, -0.22, 0]}>
              <mesh position={[0, -0.1, 0]} castShadow>
                <cylinderGeometry args={[0.05, 0.045, 0.2, 12]} />
                <meshStandardMaterial color={skinTone} roughness={0.7} />
              </mesh>
              {/* White Sweatband */}
              <mesh position={[0, -0.15, 0]}>
                <cylinderGeometry args={[0.052, 0.052, 0.05, 12]} />
                <meshStandardMaterial color="#ffffff" roughness={0.8} />
              </mesh>

              {/* Hand / Glove */}
              <group position={[0, -0.24, 0]}>
                {isBatter ? (
                  /* Batting Glove Left */
                  <mesh castShadow>
                    <boxGeometry args={[0.09, 0.1, 0.06]} />
                    <meshStandardMaterial color="#ffffff" roughness={0.4} />
                  </mesh>
                ) : isKeeper ? (
                  /* Wicketkeeper Webbed Catching Glove Left */
                  <mesh castShadow>
                    <boxGeometry args={[0.12, 0.14, 0.06]} />
                    <meshStandardMaterial color="#f8fafc" roughness={0.5} />
                  </mesh>
                ) : (
                  /* Bare Hand */
                  <mesh castShadow>
                    <boxGeometry args={[0.065, 0.08, 0.04]} />
                    <meshStandardMaterial color={skinTone} roughness={0.7} />
                  </mesh>
                )}
              </group>
            </group>
          </group>

          {/* =====================================================================
              RIGHT ARM, HAND, BAT & BALL
          ===================================================================== */}
          <group ref={rightArmRef} position={[0.24, 0.38, 0]}>
            {/* Shoulder Deltoid & Sleeve */}
            <mesh position={[0, -0.1, 0]} castShadow>
              <cylinderGeometry args={[0.065, 0.055, 0.2, 12]} />
              <meshStandardMaterial color={isUmpire ? '#1e293b' : teamColor} roughness={0.6} />
            </mesh>

            {/* Forearm & Hand */}
            <group ref={rightForearmRef} position={[0, -0.22, 0]}>
              <mesh position={[0, -0.1, 0]} castShadow>
                <cylinderGeometry args={[0.05, 0.045, 0.2, 12]} />
                <meshStandardMaterial color={skinTone} roughness={0.7} />
              </mesh>
              {/* White Sweatband */}
              <mesh position={[0, -0.15, 0]}>
                <cylinderGeometry args={[0.052, 0.052, 0.05, 12]} />
                <meshStandardMaterial color="#ffffff" roughness={0.8} />
              </mesh>

              {/* Hand / Glove */}
              <group position={[0, -0.24, 0]}>
                {isBatter ? (
                  /* Batting Glove Right */
                  <mesh castShadow>
                    <boxGeometry args={[0.09, 0.1, 0.06]} />
                    <meshStandardMaterial color="#ffffff" roughness={0.4} />
                  </mesh>
                ) : isKeeper ? (
                  /* Wicketkeeper Webbed Catching Glove Right */
                  <mesh castShadow>
                    <boxGeometry args={[0.12, 0.14, 0.06]} />
                    <meshStandardMaterial color="#f8fafc" roughness={0.5} />
                  </mesh>
                ) : (
                  /* Bare Hand */
                  <mesh castShadow>
                    <boxGeometry args={[0.065, 0.08, 0.04]} />
                    <meshStandardMaterial color={skinTone} roughness={0.7} />
                  </mesh>
                )}

                {/* ===============================================================
                    ENGLISH WILLOW CRICKET BAT (With curved blade, spine swell & grip)
                =============================================================== */}
                {isBatter && (
                  <group ref={batRef} position={[0, -0.1, 0.08]}>
                    {/* Rubber Grip Handle */}
                    <mesh position={[0, 0.24, 0]} castShadow>
                      <cylinderGeometry args={[0.016, 0.016, 0.3, 16]} />
                      <meshStandardMaterial color="#1e293b" roughness={0.9} />
                    </mesh>
                    {/* Handle Top Cap */}
                    <mesh position={[0, 0.39, 0]}>
                      <cylinderGeometry args={[0.018, 0.018, 0.02, 16]} />
                      <meshStandardMaterial color="#f59e0b" roughness={0.5} />
                    </mesh>

                    {/* English Willow Blade: Power edges and duckbill toe */}
                    <mesh position={[0, -0.22, 0]} castShadow receiveShadow>
                      <boxGeometry args={[0.115, 0.62, 0.042]} />
                      <meshStandardMaterial color="#d4a373" roughness={0.45} />
                    </mesh>

                    {/* Bat Spine Swell (High Sweet Spot) */}
                    <mesh position={[0, -0.2, -0.022]} rotation={[0, 0, Math.PI / 4]}>
                      <boxGeometry args={[0.05, 0.5, 0.025]} />
                      <meshStandardMaterial color="#bc8a5f" roughness={0.45} />
                    </mesh>

                    {/* Bat Face Branding Decal */}
                    <mesh position={[0, -0.16, 0.022]}>
                      <planeGeometry args={[0.085, 0.3]} />
                      <meshBasicMaterial color="#ef4444" />
                    </mesh>
                  </group>
                )}

                {/* Bowler holding cricket ball during run-up */}
                {(isBowler || hasBallPossession) && (
                  <group position={[0, -0.05, 0.06]}>
                    <mesh castShadow>
                      <sphereGeometry args={[0.038, 20, 20]} />
                      <meshStandardMaterial color="#dc2626" roughness={0.25} metalness={0.2} />
                    </mesh>
                    {/* Raised White Seam */}
                    <mesh rotation={[0, 0, Math.PI / 4]}>
                      <torusGeometry args={[0.0385, 0.002, 8, 20]} />
                      <meshBasicMaterial color="#ffffff" />
                    </mesh>
                  </group>
                )}
              </group>
            </group>
          </group>
        </group>

        {/* =======================================================================
            LEGS, MULTI-CANE PADS & CRICKET SPIKES
        ======================================================================= */}
        {/* LEFT LEG */}
        <group ref={leftLegRef} position={[-0.11, -0.1, 0]}>
          {/* Thigh (White cricket trousers) */}
          <mesh position={[0, -0.2, 0]} castShadow>
            <cylinderGeometry args={[0.075, 0.065, 0.38, 14]} />
            <meshStandardMaterial color={isUmpire ? '#0f172a' : '#ffffff'} roughness={0.7} />
          </mesh>

          {/* Knee & Shin */}
          <group ref={leftShinRef} position={[0, -0.4, 0]}>
            <mesh position={[0, -0.2, 0]} castShadow>
              <cylinderGeometry args={[0.06, 0.052, 0.38, 14]} />
              <meshStandardMaterial color={isUmpire ? '#0f172a' : '#ffffff'} roughness={0.7} />
            </mesh>

            {/* BATTER / KEEPER LEG PAD (Left) */}
            {(isBatter || isKeeper) && (
              <group position={[0, -0.16, 0.06]}>
                {/* Molded Top Hat Knee Roll */}
                <mesh position={[0, 0.16, 0]} castShadow>
                  <boxGeometry args={[0.16, 0.08, 0.08]} />
                  <meshStandardMaterial color="#f8fafc" roughness={0.3} />
                </mesh>
                {/* Vertical Cane-Bolster Padded Ribs */}
                <mesh castShadow receiveShadow>
                  <boxGeometry args={[0.155, 0.42, 0.075]} />
                  <meshStandardMaterial color="#f8fafc" roughness={0.3} />
                </mesh>
                {/* Cane Stitching Lines */}
                {[-0.045, 0, 0.045].map((xOffset, i) => (
                  <mesh key={i} position={[xOffset, 0, 0.04]}>
                    <cylinderGeometry args={[0.006, 0.006, 0.4, 8]} />
                    <meshStandardMaterial color="#e2e8f0" roughness={0.4} />
                  </mesh>
                ))}
                {/* Back Straps */}
                {[-0.1, 0.05].map((y, i) => (
                  <mesh key={i} position={[0, y, -0.06]}>
                    <boxGeometry args={[0.14, 0.025, 0.06]} />
                    <meshStandardMaterial color="#334155" />
                  </mesh>
                ))}
              </group>
            )}

            {/* Cricket Spikes Boot (Left) */}
            <group position={[0, -0.41, 0.04]}>
              <mesh castShadow>
                <boxGeometry args={[0.1, 0.08, 0.22]} />
                <meshStandardMaterial color="#ffffff" roughness={0.5} />
              </mesh>
              {/* Spiked Sole */}
              <mesh position={[0, -0.042, 0]}>
                <boxGeometry args={[0.105, 0.015, 0.225]} />
                <meshStandardMaterial color="#0284c7" roughness={0.3} />
              </mesh>
            </group>
          </group>
        </group>

        {/* RIGHT LEG */}
        <group ref={rightLegRef} position={[0.11, -0.1, 0]}>
          {/* Thigh */}
          <mesh position={[0, -0.2, 0]} castShadow>
            <cylinderGeometry args={[0.075, 0.065, 0.38, 14]} />
            <meshStandardMaterial color={isUmpire ? '#0f172a' : '#ffffff'} roughness={0.7} />
          </mesh>

          {/* Knee & Shin */}
          <group ref={rightShinRef} position={[0, -0.4, 0]}>
            <mesh position={[0, -0.2, 0]} castShadow>
              <cylinderGeometry args={[0.06, 0.052, 0.38, 14]} />
              <meshStandardMaterial color={isUmpire ? '#0f172a' : '#ffffff'} roughness={0.7} />
            </mesh>

            {/* BATTER / KEEPER LEG PAD (Right) */}
            {(isBatter || isKeeper) && (
              <group position={[0, -0.16, 0.06]}>
                {/* Molded Top Hat Knee Roll */}
                <mesh position={[0, 0.16, 0]} castShadow>
                  <boxGeometry args={[0.16, 0.08, 0.08]} />
                  <meshStandardMaterial color="#f8fafc" roughness={0.3} />
                </mesh>
                {/* Vertical Cane-Bolster Padded Ribs */}
                <mesh castShadow receiveShadow>
                  <boxGeometry args={[0.155, 0.42, 0.075]} />
                  <meshStandardMaterial color="#f8fafc" roughness={0.3} />
                </mesh>
                {/* Cane Stitching Lines */}
                {[-0.045, 0, 0.045].map((xOffset, i) => (
                  <mesh key={i} position={[xOffset, 0, 0.04]}>
                    <cylinderGeometry args={[0.006, 0.006, 0.4, 8]} />
                    <meshStandardMaterial color="#e2e8f0" roughness={0.4} />
                  </mesh>
                ))}
                {/* Back Straps */}
                {[-0.1, 0.05].map((y, i) => (
                  <mesh key={i} position={[0, y, -0.06]}>
                    <boxGeometry args={[0.14, 0.025, 0.06]} />
                    <meshStandardMaterial color="#334155" />
                  </mesh>
                ))}
              </group>
            )}

            {/* Cricket Spikes Boot (Right) */}
            <group position={[0, -0.41, 0.04]}>
              <mesh castShadow>
                <boxGeometry args={[0.1, 0.08, 0.22]} />
                <meshStandardMaterial color="#ffffff" roughness={0.5} />
              </mesh>
              {/* Spiked Sole */}
              <mesh position={[0, -0.042, 0]}>
                <boxGeometry args={[0.105, 0.015, 0.225]} />
                <meshStandardMaterial color="#0284c7" roughness={0.3} />
              </mesh>
            </group>
          </group>
        </group>
      </group>
    </group>
  );
};
