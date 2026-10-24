import React, { useMemo } from 'react';
import * as THREE from 'three';
import { Text } from '@react-three/drei';
import { CricketGameState } from '@cricket2026/shared';

interface StadiumGeometryProps {
  crowdDensity?: 'low' | 'high' | 'off';
  shadowsEnabled?: boolean;
  graphicsQuality?: 'LOW' | 'MEDIUM' | 'HIGH' | 'ULTRA';
  gameState?: CricketGameState | null;
}

/**
 * Procedural tiered stadium grandstands, canopy roof, crowd blocks,
 * digital dynamic jumbotron screens, and floodlight towers with
 * graphics quality scaling (LOW, MEDIUM, HIGH, ULTRA).
 */
export const StadiumGeometry: React.FC<StadiumGeometryProps> = ({
  crowdDensity = 'high',
  shadowsEnabled = true,
  graphicsQuality = 'HIGH',
  gameState = null
}) => {
  const isLowGraphics = graphicsQuality === 'LOW';
  const isUltraGraphics = graphicsQuality === 'ULTRA';
  const shouldCastShadow = shadowsEnabled && !isLowGraphics;
  const shadowResolution = isLowGraphics ? 512 : graphicsQuality === 'MEDIUM' ? 1024 : 2048;

  // Generate crowd seating blocks with randomized spectator apparel colors
  const crowdRows = useMemo(() => {
    if (crowdDensity === 'off' || isLowGraphics) return [];

    const rows: { position: [number, number, number]; color: string; scale: [number, number, number] }[] = [];
    const colors = [
      '#1e3a8a', '#1e40af', '#3b82f6', // Team A blues
      '#15803d', '#166534', '#22c55e', // Team B greens
      '#eab308', '#facc15', '#f59e0b', // Gold / Amber
      '#dc2626', '#ef4444',             // Red accents
      '#ffffff', '#f1f5f9', '#cbd5e1'  // White / Light apparel
    ];

    const tiers = [
      { radius: 72, height: 4.5, count: crowdDensity === 'high' ? 72 : 36 },
      { radius: 78, height: 8.5, count: crowdDensity === 'high' ? 84 : 42 },
      { radius: 84, height: 13.0, count: crowdDensity === 'high' ? 96 : 48 },
      { radius: 90, height: 18.0, count: crowdDensity === 'high' ? 108 : 54 },
      { radius: 96, height: 23.5, count: crowdDensity === 'high' ? 120 : 60 }
    ];

    tiers.forEach((tier) => {
      for (let i = 0; i < tier.count; i++) {
        const angle = (i / tier.count) * Math.PI * 2;
        // Leave gaps for grandstand stairwells and sight screens
        const isSightScreenGap =
          (angle > Math.PI * 0.45 && angle < Math.PI * 0.55) ||
          (angle > Math.PI * 1.45 && angle < Math.PI * 1.55);

        if (!isSightScreenGap) {
          const x = Math.cos(angle) * tier.radius;
          const z = Math.sin(angle) * tier.radius;
          const randomColor = colors[Math.floor(Math.random() * colors.length)];
          rows.push({
            position: [x, tier.height, z],
            color: randomColor,
            scale: [1.8, 1.2, 1.8]
          });
        }
      }
    });

    return rows;
  }, [crowdDensity, isLowGraphics]);

  // Dynamic Scoreboard calculations
  const battingTeamId = gameState?.battingTeamId || 'TEAM_A';
  const bowlingTeamId = gameState?.bowlingTeamId || 'TEAM_B';
  const battingTeamName = gameState?.teams[battingTeamId]?.name || 'INDIA';
  const bowlingTeamName = gameState?.teams[bowlingTeamId]?.name || 'AUSTRALIA';
  const curInnings = gameState?.scorecard?.innings?.[(gameState.scorecard.currentInningsIndex || 1) - 1];
  const scoreStr = curInnings ? `${curInnings.runs}/${curInnings.wickets}` : '0/0';
  const oversStr = curInnings ? `(${curInnings.oversCompleted}.${curInnings.ballsInCurrentOver} ov)` : '(0.0 ov)';
  const lastSpeedKmph = gameState?.activeDelivery?.bowlerIntent?.releaseSpeedKmph
    ? `${gameState.activeDelivery.bowlerIntent.releaseSpeedKmph.toFixed(1)} KM/H`
    : '142.5 KM/H';

  return (
    <group>
      {/* =========================================================================
          1. 3D TIERED STADIUM GRANDSTANDS
      ========================================================================= */}

      {/* Lower Grandstand Bowl */}
      <mesh position={[0, 4, 0]} receiveShadow={shouldCastShadow}>
        <cylinderGeometry args={[84, 68, 8, isLowGraphics ? 32 : 64, 1, true]} />
        <meshStandardMaterial
          color="#1e293b"
          roughness={0.7}
          metalness={0.2}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Corporate Hospitality & Club Suite Ribbon */}
      <mesh position={[0, 10, 0]}>
        <cylinderGeometry args={[86, 84, 4, isLowGraphics ? 32 : 64, 1, true]} />
        <meshStandardMaterial
          color="#0f172a"
          roughness={0.3}
          metalness={0.8}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Upper Grandstand Tier */}
      <mesh position={[0, 19, 0]} receiveShadow={shouldCastShadow}>
        <cylinderGeometry args={[102, 86, 14, isLowGraphics ? 32 : 64, 1, true]} />
        <meshStandardMaterial
          color="#334155"
          roughness={0.7}
          metalness={0.15}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Cantilever Stadium Roof Canopy */}
      <mesh position={[0, 29, 0]}>
        <ringGeometry args={[78, 106, isLowGraphics ? 32 : 64]} />
        <meshStandardMaterial
          color="#e2e8f0"
          roughness={0.4}
          metalness={0.4}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Outer Stadium Facade Wall */}
      <mesh position={[0, 14.5, 0]}>
        <cylinderGeometry args={[102, 102, 29, isLowGraphics ? 32 : 64, 1, true]} />
        <meshStandardMaterial color="#0f172a" roughness={0.8} side={THREE.DoubleSide} />
      </mesh>

      {/* =========================================================================
          2. STADIUM CROWD SPECTATOR ROWS
      ========================================================================= */}
      {crowdRows.map((crowd, idx) => (
        <mesh key={idx} position={crowd.position} scale={crowd.scale}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color={crowd.color} roughness={0.8} />
        </mesh>
      ))}

      {/* =========================================================================
          3. SIGHT SCREENS (Behind bowler at both ends outside boundary)
      ========================================================================= */}
      {/* Striker end sight screen (North) */}
      <group position={[0, 4.5, 71]}>
        <mesh castShadow={shouldCastShadow} receiveShadow={shouldCastShadow}>
          <boxGeometry args={[14, 9, 0.4]} />
          <meshStandardMaterial color="#f8fafc" roughness={0.2} />
        </mesh>
        <mesh position={[0, -3, 0]}>
          <boxGeometry args={[15, 0.5, 1.2]} />
          <meshStandardMaterial color="#1e293b" />
        </mesh>
      </group>

      {/* Bowler end sight screen (South) */}
      <group position={[0, 4.5, -71]}>
        <mesh castShadow={shouldCastShadow} receiveShadow={shouldCastShadow}>
          <boxGeometry args={[14, 9, 0.4]} />
          <meshStandardMaterial color="#f8fafc" roughness={0.2} />
        </mesh>
        <mesh position={[0, -3, 0]}>
          <boxGeometry args={[15, 0.5, 1.2]} />
          <meshStandardMaterial color="#1e293b" />
        </mesh>
      </group>

      {/* =========================================================================
          4. GIANT JUMBOTRON DIGITAL SCOREBOARD SCREENS (Live Dynamic Score Data)
      ========================================================================= */}
      {/* North Jumbotron Screen */}
      <group position={[0, 22, 94]} rotation={[0, Math.PI, 0]}>
        <mesh castShadow={shouldCastShadow}>
          <boxGeometry args={[26, 14, 1.5]} />
          <meshStandardMaterial color="#090d16" metalness={0.9} roughness={0.2} />
        </mesh>
        {/* Screen Display Face */}
        <mesh position={[0, 0, 0.8]}>
          <planeGeometry args={[24, 12]} />
          <meshBasicMaterial color="#020617" />
        </mesh>
        <Text position={[0, 4.2, 0.85]} fontSize={1.3} color="#facc15" anchorX="center" anchorY="middle">
          CRICKET 2026 ARENA
        </Text>
        <Text position={[0, 1.6, 0.85]} fontSize={2.4} color="#ffffff" font="" anchorX="center" anchorY="middle">
          {`${battingTeamName}  ${scoreStr}`}
        </Text>
        <Text position={[0, -0.6, 0.85]} fontSize={1.4} color="#38bdf8" anchorX="center" anchorY="middle">
          {`OVERS: ${oversStr} • VS ${bowlingTeamName}`}
        </Text>
        <Text position={[0, -3.2, 0.85]} fontSize={1.1} color="#94a3b8" anchorX="center" anchorY="middle">
          LIVE TELECAST • DECISION REVIEW READY
        </Text>
      </group>

      {/* South Jumbotron Screen */}
      <group position={[0, 22, -94]}>
        <mesh castShadow={shouldCastShadow}>
          <boxGeometry args={[26, 14, 1.5]} />
          <meshStandardMaterial color="#090d16" metalness={0.9} roughness={0.2} />
        </mesh>
        <mesh position={[0, 0, 0.8]}>
          <planeGeometry args={[24, 12]} />
          <meshBasicMaterial color="#020617" />
        </mesh>
        <Text position={[0, 4.0, 0.85]} fontSize={1.3} color="#facc15" anchorX="center" anchorY="middle">
          ICC CHAMPIONSHIP 2026
        </Text>
        <Text position={[0, 1.4, 0.85]} fontSize={2.2} color="#4ade80" anchorX="center" anchorY="middle">
          {`SPEED: ${lastSpeedKmph}`}
        </Text>
        <Text position={[0, -1.2, 0.85]} fontSize={1.4} color="#f87171" anchorX="center" anchorY="middle">
          {gameState?.activeDelivery?.deliveryPhase === 'UMPIRE_ADJUDICATION' ? '🔥 REVIEW IN PROGRESS 🔥' : 'HAWKEYE TRACKING ACTIVE'}
        </Text>
        <Text position={[0, -3.4, 0.85]} fontSize={1.1} color="#cbd5e1" anchorX="center" anchorY="middle">
          OFFICIAL TIMING & BALL TRACKING
        </Text>
      </group>

      {/* =========================================================================
          5. 360-DEGREE DIGITAL LED RIBBON BOARDS (Along Lower Tier & Boundary)
      ========================================================================= */}
      <mesh position={[0, 0.85, 0]}>
        <cylinderGeometry args={[65.8, 65.8, 1.3, isLowGraphics ? 32 : 64, 1, true]} />
        <meshStandardMaterial
          color="#0f172a"
          emissive="#1e3a8a"
          emissiveIntensity={isLowGraphics ? 0.3 : 0.6}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Mid-tier LED Ribbon */}
      <mesh position={[0, 8.2, 0]}>
        <cylinderGeometry args={[84.2, 84.2, 1.2, isLowGraphics ? 32 : 64, 1, true]} />
        <meshStandardMaterial
          color="#0f172a"
          emissive="#065f46"
          emissiveIntensity={isLowGraphics ? 0.3 : 0.5}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* =========================================================================
          6. FOUR HIGH-POWER FLOODLIGHT MASTS (Scaled to Graphics Preset)
      ========================================================================= */}
      {[
        { pos: [-62, 0, -62], rotY: Math.PI / 4 },
        { pos: [62, 0, -62], rotY: -Math.PI / 4 },
        { pos: [-62, 0, 62], rotY: (3 * Math.PI) / 4 },
        { pos: [62, 0, 62], rotY: -(3 * Math.PI) / 4 }
      ].map((mast, i) => {
        // In Low mode, only 2 masts cast light without shadows; in High/Ultra, all 4 cast shadows
        const enableMastLight = !isLowGraphics || i < 2;

        return (
          <group key={i} position={mast.pos as [number, number, number]} rotation={[0, mast.rotY, 0]}>
            {/* Main Lattice Tower Mast */}
            <mesh position={[0, 22, 0]} castShadow={shouldCastShadow}>
              <cylinderGeometry args={[0.9, 2.2, 44, 8]} />
              <meshStandardMaterial color="#475569" metalness={0.8} roughness={0.3} />
            </mesh>

            {/* Cross Struts Platforms */}
            {[14, 28, 42].map((y, pIdx) => (
              <mesh key={pIdx} position={[0, y, 0]}>
                <boxGeometry args={[4.2, 0.4, 4.2]} />
                <meshStandardMaterial color="#334155" metalness={0.7} />
              </mesh>
            ))}

            {/* Lamp Bank Head Frame */}
            <mesh position={[0, 44, 0]} castShadow={shouldCastShadow}>
              <boxGeometry args={[11, 6.5, 2.5]} />
              <meshStandardMaterial color="#1e293b" metalness={0.9} />
            </mesh>

            {/* Glowing Floodlight Array Panels */}
            <mesh position={[0, 44, 1.3]}>
              <planeGeometry args={[10, 5.5]} />
              <meshStandardMaterial
                color="#ffffff"
                emissive="#f8fafc"
                emissiveIntensity={isLowGraphics ? 1.5 : 2.5}
                roughness={0.1}
              />
            </mesh>

            {/* Dynamic Spotlight Illuminating the Stadium Ground */}
            {enableMastLight && (
              <spotLight
                position={[0, 44, 0]}
                target-position={[0, 0, 0]}
                intensity={isLowGraphics ? 1.0 : isUltraGraphics ? 2.0 : 1.6}
                distance={180}
                angle={0.75}
                penumbra={0.6}
                castShadow={shouldCastShadow}
                shadow-bias={-0.0005}
                shadow-mapSize-width={shadowResolution}
                shadow-mapSize-height={shadowResolution}
              />
            )}
          </group>
        );
      })}
    </group>
  );
};
