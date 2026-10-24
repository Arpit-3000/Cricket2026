import React, { Component, ReactNode, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Stars } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { CricketGameState, GROUND_DIMENSIONS, PlayerEntityState } from '@cricket2026/shared';
import { StadiumGeometry } from './StadiumGeometry.js';
import { CricketPitch } from './CricketPitch.js';
import { Wickets3D } from './Wickets3D.js';
import { CricketerAvatars } from './CricketerAvatars.js';
import { cricketAudio } from '../../services/CricketAudioEngine.js';

interface WebGLErrorBoundaryProps {
  children: ReactNode;
}

interface WebGLErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class WebGLErrorBoundary extends Component<WebGLErrorBoundaryProps, WebGLErrorBoundaryState> {
  constructor(props: WebGLErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): WebGLErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.warn('[CricketStadiumScene] WebGL Canvas initialization error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="w-full h-full relative overflow-hidden bg-gradient-to-b from-slate-950 via-[#071328] to-slate-950 flex flex-col items-center justify-center p-6 text-center select-none">
          {/* Stylized 2D Outfield Oval Silhouette */}
          <div className="w-[480px] h-[300px] rounded-[50%] border-2 border-emerald-500/20 bg-emerald-950/20 relative flex items-center justify-center shadow-2xl shadow-emerald-900/30">
            {/* 30-yard circle */}
            <div className="w-[320px] h-[190px] rounded-[50%] border border-dashed border-emerald-400/30 flex items-center justify-center">
              {/* Pitch */}
              <div className="w-8 h-28 bg-amber-200/30 rounded border border-amber-300/40 relative flex flex-col justify-between p-1">
                <div className="w-full h-0.5 bg-white/80" />
                <div className="text-[7px] font-bold text-amber-200/60 uppercase tracking-widest rotate-90 mx-auto">Pitch</div>
                <div className="w-full h-0.5 bg-white/80" />
              </div>
            </div>
          </div>
          <div className="mt-4 glass-panel px-4 py-2 rounded-xl border border-white/10 text-xs text-slate-300 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <span>3D Arena running in 2D Stadium Compatibility Mode</span>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export type CameraViewMode = 'BROADCAST' | 'BATTING' | 'BOWLING' | 'FIELD_SIDE' | 'SPECTATOR' | 'REPLAY' | 'FIELDER';

interface StadiumProps {
  cameraMode: CameraViewMode;
  gameState: CricketGameState | null;
  playerEntities?: Record<string, PlayerEntityState>;
  myPlayerId?: string | null;
  crowdDensity?: 'low' | 'high' | 'off';
  graphicsQuality?: 'LOW' | 'MEDIUM' | 'HIGH' | 'ULTRA';
  shadowsEnabled?: boolean;
  fov?: number;
  lastUmpireSignal?: string | null;
  masterVolume?: number;
  crowdVolume?: number;
  sfxVolume?: number;
}

interface CameraControllerProps {
  cameraMode: CameraViewMode;
  targetPos: [number, number, number];
  targetLookAt: [number, number, number];
  fov: number;
}

/**
 * Broadcast Camera Controller with smooth television crane/dolly damping and dynamic ball tracking
 */
const CameraController: React.FC<CameraControllerProps> = ({
  cameraMode,
  targetPos,
  targetLookAt,
  fov
}) => {
  const { camera } = useThree();
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const currentPos = useRef(new THREE.Vector3(...targetPos));
  const currentLookAt = useRef(new THREE.Vector3(...targetLookAt));

  // Initialize camera position immediately on first load
  useEffect(() => {
    if (camera) {
      if ('fov' in camera) {
        (camera as THREE.PerspectiveCamera).fov = fov;
        camera.updateProjectionMatrix();
      }
    }
  }, [fov, camera]);

  // Smooth cinematic camera damping per frame
  useFrame((_state, delta) => {
    if (cameraMode === 'SPECTATOR') return; // OrbitControls handles spectator mode

    const speed = Math.min(1, delta * 6.5);

    // Lerp camera position
    currentPos.current.x = THREE.MathUtils.lerp(currentPos.current.x, targetPos[0], speed);
    currentPos.current.y = THREE.MathUtils.lerp(currentPos.current.y, targetPos[1], speed);
    currentPos.current.z = THREE.MathUtils.lerp(currentPos.current.z, targetPos[2], speed);
    camera.position.set(currentPos.current.x, currentPos.current.y, currentPos.current.z);

    // Lerp camera target lookAt
    currentLookAt.current.x = THREE.MathUtils.lerp(currentLookAt.current.x, targetLookAt[0], speed);
    currentLookAt.current.y = THREE.MathUtils.lerp(currentLookAt.current.y, targetLookAt[1], speed);
    currentLookAt.current.z = THREE.MathUtils.lerp(currentLookAt.current.z, targetLookAt[2], speed);
    camera.lookAt(currentLookAt.current.x, currentLookAt.current.y, currentLookAt.current.z);
  });

  return (
    <>
      <PerspectiveCamera makeDefault position={targetPos} fov={fov} />
      {cameraMode === 'SPECTATOR' && (
        <OrbitControls
          ref={controlsRef}
          maxPolarAngle={Math.PI / 2 - 0.05} // prevent descending below ground
          minDistance={6}
          maxDistance={140}
          dampingFactor={0.08}
          enableDamping
        />
      )}
    </>
  );
};

export const CricketStadiumScene: React.FC<StadiumProps> = ({
  cameraMode,
  gameState,
  playerEntities,
  myPlayerId,
  crowdDensity = 'high',
  graphicsQuality = 'HIGH',
  shadowsEnabled = true,
  fov = 50,
  lastUmpireSignal,
  masterVolume = 80,
  crowdVolume = 70,
  sfxVolume = 85
}) => {
  const pitchHalfLength = GROUND_DIMENSIONS.PITCH_LENGTH_METERS / 2; // ~10.06m
  const isLowGraphics = graphicsQuality === 'LOW';
  const shouldCastShadow = shadowsEnabled && !isLowGraphics;
  const shadowResolution = isLowGraphics ? 512 : graphicsQuality === 'MEDIUM' ? 1024 : 2048;

  // Track previous delivery events to trigger procedural Web Audio sound effects
  const prevShotPlayedRef = useRef(false);
  const prevPhaseRef = useRef<string | null>(null);
  const prevBallBouncedRef = useRef(false);
  const prevUmpireSignalRef = useRef<string | null>(null);

  // Update audio volume levels
  useEffect(() => {
    cricketAudio.updateVolumes(masterVolume, crowdVolume, sfxVolume);
  }, [masterVolume, crowdVolume, sfxVolume]);

  // Start crowd murmur ambience on mount, stop on unmount
  useEffect(() => {
    cricketAudio.startCrowdAmbience();
    return () => {
      cricketAudio.stopCrowdAmbience();
    };
  }, []);

  // Reactive audio triggers based on gameplay state events
  useEffect(() => {
    if (!gameState) return;

    const deliveryPhase = gameState.activeDelivery.deliveryPhase;

    // 1. Bat Impact Audio
    if (deliveryPhase === 'BAT_INTERACTION' && !prevShotPlayedRef.current) {
      const timingOffset = gameState.activeDelivery.batterIntent?.timingOffsetMs || 0;
      if (Math.abs(timingOffset) <= 20) {
        cricketAudio.playBatHit('SWEET_SPOT');
      } else if (Math.abs(timingOffset) <= 45) {
        cricketAudio.playBatHit('GOOD');
      } else {
        cricketAudio.playBatHit('EDGED');
      }
      prevShotPlayedRef.current = true;
    }
    if (deliveryPhase === 'BOWLER_RUNUP' || deliveryPhase === 'AWAITING_BOWLER_CONFIRM') {
      prevShotPlayedRef.current = false;
    }

    // 2. Pitch / Turf Bounce Audio
    if (deliveryPhase === 'BALL_PITCHED' && !prevBallBouncedRef.current) {
      const speed = gameState.activeDelivery.bowlerIntent?.releaseSpeedKmph || 135;
      cricketAudio.playBallBounce(speed / 145);
      prevBallBouncedRef.current = true;
    }
    if (deliveryPhase === 'BOWLER_RUNUP' || deliveryPhase === 'AWAITING_BOWLER_CONFIRM') {
      prevBallBouncedRef.current = false;
    }

    // 3. Wickets, Boundaries & Crowd Reaction Audio
    if (gameState.phase !== prevPhaseRef.current) {
      if (gameState.phase === 'MID_INNINGS_BREAK' || gameState.phase === 'INNINGS_BREAK') {
        cricketAudio.playCrowdReaction('APPLAUSE');
      } else if (gameState.phase === 'MATCH_CONCLUDED' || gameState.phase === 'COMPLETED_MATCH') {
        cricketAudio.playCrowdReaction('ROAR');
      }
      prevPhaseRef.current = gameState.phase;
    }

    // 4. Umpire Decision Whistle / Signal Audio
    if (lastUmpireSignal && lastUmpireSignal !== prevUmpireSignalRef.current) {
      cricketAudio.playUmpireSignal();
      if (['OUT', 'WICKET'].includes(lastUmpireSignal)) {
        cricketAudio.playStumpHit();
        cricketAudio.playCrowdReaction('WICKET');
      } else if (['FOUR', 'SIX'].includes(lastUmpireSignal)) {
        cricketAudio.playCrowdReaction(lastUmpireSignal === 'SIX' ? 'BOUNDARY_SIX' : 'BOUNDARY_FOUR');
      } else if (['WIDE', 'NO_BALL'].includes(lastUmpireSignal)) {
        cricketAudio.playCrowdReaction('GASP');
      }
      prevUmpireSignalRef.current = lastUmpireSignal;
    }
  }, [gameState, lastUmpireSignal]);

  // Camera presets tailored to realistic televised cricket viewpoints
  const getCameraConfig = (): { position: [number, number, number]; lookAt: [number, number, number] } => {
    const ballPos = gameState?.activeDelivery.ball.position;

    switch (cameraMode) {
      case 'BATTING':
        // Over-the-shoulder behind striker batsman looking down pitch towards bowler
        return { position: [0, 2.3, pitchHalfLength + 3.8], lookAt: [0, 1.2, -pitchHalfLength] };

      case 'BOWLING':
        // Behind bowler at delivery mark looking down pitch towards striker's wickets
        return { position: [0, 3.4, -pitchHalfLength - 12], lookAt: [0, 1.2, pitchHalfLength] };

      case 'FIELD_SIDE':
        // Field-side dugout / slip-cordon perspective looking across central pitch
        return { position: [46, 2.8, 18], lookAt: [0, 1.2, 0] };

      case 'REPLAY':
        // Slow-motion cinematic replay camera focusing on striker wicket zone
        return {
          position: [6.5, 2.2, pitchHalfLength + 4.5],
          lookAt: [0, 1.1, pitchHalfLength]
        };

      case 'SPECTATOR':
        // High stadium overview for free orbit exploration
        return { position: [42, 30, 48], lookAt: [0, 2, 0] };

      case 'FIELDER': {
        // Follow active fielder (or ball if possessed, or closest fielder)
        const possessedId = gameState?.activeDelivery.ball.possessedByFielderId;
        const activeFielder = (possessedId && playerEntities && playerEntities[possessedId])
          ? playerEntities[possessedId]
          : Object.values(playerEntities || {}).find(p => p.role === 'FIELDER');

        if (activeFielder) {
          return {
            position: [activeFielder.position.x - 4, 3, activeFielder.position.z - 4],
            lookAt: [activeFielder.position.x, 1.2, activeFielder.position.z]
          };
        }
        return { position: [25, 8, 25], lookAt: [ballPos?.x || 0, 1.0, ballPos?.z || 0] };
      }

      case 'BROADCAST':
      default: {
        // Elevated main TV broadcast camera on the grandstand sideline with dynamic ball tracking
        const trackX = ballPos ? ballPos.x * 0.35 : 0;
        const trackZ = ballPos ? ballPos.z * 0.35 : 0;
        return { position: [36, 17, 0], lookAt: [trackX, 1.2, trackZ] };
      }
    }
  };

  const camConfig = getCameraConfig();

  return (
    <div className="w-full h-full relative overflow-hidden bg-slate-950">
      <WebGLErrorBoundary>
        <Canvas shadows={shouldCastShadow}>
          {/* Dynamic Broadcast Camera Controller with smooth damping and tracking */}
          <CameraController
            cameraMode={cameraMode}
            targetPos={camConfig.position}
            targetLookAt={camConfig.lookAt}
            fov={fov}
          />

          {/* Stadium Atmosphere Ground Fog */}
          <fogExp2 attach="fog" args={['#060c18', isLowGraphics ? 0.001 : 0.0035]} />

          {/* Realistic Night Sky with Shimmering Stars */}
          <Stars
            radius={160}
            depth={50}
            count={isLowGraphics ? 800 : 2500}
            factor={4}
            saturation={0}
            fade
            speed={1}
          />
          <mesh>
            <sphereGeometry args={[220, 24, 24]} />
            <meshBasicMaterial color="#040812" side={THREE.BackSide} />
          </mesh>

          {/* Ambient & Natural Stadium Environment Light */}
          <ambientLight intensity={isLowGraphics ? 0.75 : 0.55} color="#e2e8f0" />

          {/* Directional Sunlight / Twilight Fill */}
          <directionalLight
            position={[30, 65, 30]}
            intensity={1.1}
            castShadow={shouldCastShadow}
            shadow-mapSize-width={shadowResolution}
            shadow-mapSize-height={shadowResolution}
            shadow-camera-near={10}
            shadow-camera-far={220}
            shadow-camera-left={-75}
            shadow-camera-right={75}
            shadow-camera-top={75}
            shadow-camera-bottom={-75}
            shadow-bias={-0.0004}
          />

          {/* 1. 3D Stadium Architecture, Grandstands, Roof & Floodlights */}
          <StadiumGeometry
            crowdDensity={crowdDensity}
            shadowsEnabled={shadowsEnabled}
            graphicsQuality={graphicsQuality}
            gameState={gameState}
          />

          {/* 2. 22-Yard Turf Pitch, Creases, Outfield Stripes, 30-Yd Ring & Boundary Rope */}
          <CricketPitch />

          {/* 3. Two Batting Wickets with Stumps & Bails */}
          <Wickets3D zPosition={pitchHalfLength} />
          <Wickets3D zPosition={-pitchHalfLength} />

          {/* 4. Realistic Cricketers (Batters, Bowlers, Keepers, Fielders, Umpires) & Ball */}
          <CricketerAvatars
            gameState={gameState}
            playerEntities={playerEntities}
            myPlayerId={myPlayerId}
            lastUmpireSignal={lastUmpireSignal}
          />
        </Canvas>
      </WebGLErrorBoundary>
    </div>
  );
};
