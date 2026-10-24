import React, { useState } from 'react';
import {
  CricketGameState,
  BowlingDeliveryIntent,
  BattingShotIntent,
  FieldingIntent,
  Vector3D,
  PlayerEntityState,
  ShotType,
  SwingType,
  SpinVariation,
  FIELDING_CONFIG
} from '@cricket2026/shared';
import { CameraViewMode } from '../3d/CricketStadiumScene.js';
import { Camera, Zap, Shield, Play, HelpCircle, Eye, Hand, Crosshair, Flag, Move } from 'lucide-react';
import { Tooltip } from './Tooltip.js';

interface GameControlsProps {
  gameState: CricketGameState | null;
  myPlayerId?: string | null;
  cameraMode: CameraViewMode;
  onCameraChange: (mode: CameraViewMode) => void;
  onCommitBowling: (intent: BowlingDeliveryIntent) => void;
  onSubmitBatting: (intent: BattingShotIntent) => void;
  onCallRun?: () => void;
  onFielderAction?: (intent: FieldingIntent) => void;
  onAdjustFieldPosition?: (fielderId: string, position: Vector3D) => void;
  onApplyFieldPreset?: (preset: 'ATTACKING' | 'DEFENSIVE' | 'BALANCED') => void;
  onAppeal?: (appealType: 'HOWZAT' | 'LBW' | 'CAUGHT' | 'RUN_OUT') => void;
  playerEntities?: Record<string, PlayerEntityState>;
  isCaptain?: boolean;
  isPracticeMode?: boolean;
}

export const GameControlsHUD: React.FC<GameControlsProps> = ({
  gameState,
  myPlayerId,
  cameraMode,
  onCameraChange,
  onCommitBowling,
  onSubmitBatting,
  onCallRun,
  onFielderAction,
  onAdjustFieldPosition: _onAdjustFieldPosition,
  onApplyFieldPreset,
  onAppeal,
  playerEntities = {},
  isCaptain = false,
  isPracticeMode = false
}) => {
  // Bowling state
  const [bowlingSpeed, setBowlingSpeed] = useState(135);
  const [pitchLength, setPitchLength] = useState<'YORKER' | 'FULL' | 'GOOD' | 'SHORT'>('GOOD');
  const [pitchLine, setPitchLine] = useState<'OUTSIDE_OFF' | 'OFF' | 'MIDDLE' | 'LEG'>('OFF');
  const [selectedSwing, setSelectedSwing] = useState<SwingType>('OUTSWING');
  const [selectedSpin, setSelectedSpin] = useState<SpinVariation>('NONE');

  // Batting state
  const [selectedShot, setSelectedShot] = useState<ShotType>('COVER_DRIVE');
  const [shotPower, setShotPower] = useState(80);
  const [shotTimingOffset, setShotTimingOffset] = useState(0); // 0 = sweet spot
  const [isLofted, setIsLofted] = useState(false);
  const [shotAngle, setShotAngle] = useState(315);

  // Fielding state
  const [throwTargetEnd, setThrowTargetEnd] = useState<'STRIKER_END' | 'BOWLER_END'>('STRIKER_END');
  const [throwPower, setThrowPower] = useState(85);
  const [captainDrawerOpen, setCaptainDrawerOpen] = useState(false);

  // Broadcast feedback toast notification
  const [feedbackBanner, setFeedbackBanner] = useState<{ title: string; message: string } | null>(null);

  // Practice mode toggle for testing bowler or batter
  const [practiceRole, setPracticeRole] = useState<'BATTING' | 'BOWLING' | 'FIELDING'>('BATTING');

  const triggerFeedback = (title: string, message: string) => {
    setFeedbackBanner({ title, message });
    setTimeout(() => {
      setFeedbackBanner(null);
    }, 4000);
  };

  const isMyTurnToBowl = isPracticeMode
    ? practiceRole === 'BOWLING'
    : gameState?.currentBowlerId === myPlayerId;
  const isMyTurnToBat = isPracticeMode
    ? practiceRole === 'BATTING'
    : gameState?.currentStrikerId === myPlayerId;

  const myEntity = myPlayerId ? playerEntities[myPlayerId] : null;
  const ball = gameState?.activeDelivery.ball;
  const distToBall =
    myEntity && ball
      ? Math.hypot(ball.position.x - myEntity.position.x, ball.position.z - myEntity.position.z)
      : null;
  const inPickupRange = distToBall !== null && distToBall <= FIELDING_CONFIG.PICKUP_DISTANCE_METERS;
  const inDiveRange = distToBall !== null && distToBall <= FIELDING_CONFIG.DIVE_PICKUP_DISTANCE_METERS;
  const hasBall = Boolean(myPlayerId && ball?.possessedByFielderId === myPlayerId);
  const isFieldingTeam = Boolean(myEntity && gameState && myEntity.teamId === gameState.bowlingTeamId);
  const isCurrentBowler = Boolean(myPlayerId && gameState?.currentBowlerId === myPlayerId);
  const isFielder = isFieldingTeam && !isCurrentBowler;
  const isCaptainUser = Boolean(
    isCaptain || (gameState && myPlayerId && gameState.teams[gameState.bowlingTeamId].captainId === myPlayerId)
  );

  const handlePickup = () => {
    if (!myPlayerId || !onFielderAction) return;
    onFielderAction({
      fielderId: myPlayerId,
      action: 'PICKUP',
      timestamp: Date.now()
    });
    triggerFeedback('GROUND PICKUP', 'Collecting ball cleanly from the outfield');
  };

  const handleDive = () => {
    if (!myPlayerId || !onFielderAction) return;
    onFielderAction({
      fielderId: myPlayerId,
      action: 'DIVE',
      timestamp: Date.now()
    });
    triggerFeedback('DIVING STOP', 'Diving forward across turf to intercept ball!');
  };

  const handleCatch = () => {
    if (!myPlayerId || !onFielderAction) return;
    onFielderAction({
      fielderId: myPlayerId,
      action: 'CATCH_ATTEMPT',
      timestamp: Date.now()
    });
    triggerFeedback('CATCH ATTEMPT', 'Reaching out for aerial catch!');
  };

  const handleThrow = () => {
    if (!myPlayerId || !onFielderAction) return;
    onFielderAction({
      fielderId: myPlayerId,
      action: 'OVERARM_THROW',
      throwTargetEnd,
      throwPower,
      timestamp: Date.now()
    });
    triggerFeedback(
      'THROW RETURNED',
      `Fired overarm throw to ${throwTargetEnd.replace('_', ' ')} with ${throwPower}% velocity`
    );
  };

  const handleApplyPreset = (preset: 'ATTACKING' | 'DEFENSIVE' | 'BALANCED') => {
    if (onApplyFieldPreset) {
      onApplyFieldPreset(preset);
      triggerFeedback('FIELD TACTIC APPLIED', `${preset} layout deployed across outfield.`);
    }
  };

  const handleDeliver = () => {
    const bowlerId = myPlayerId || 'practice_bowler';

    // Map line and length to pitch coordinates (x: line, z: length)
    const lineMap = { OUTSIDE_OFF: 0.45, OFF: 0.15, MIDDLE: 0.0, LEG: -0.22 };
    const lengthMap = { YORKER: 8.2, FULL: 6.8, GOOD: 4.8, SHORT: 2.6 };

    const targetX = lineMap[pitchLine];
    const targetZ = lengthMap[pitchLength];

    const intent: BowlingDeliveryIntent = {
      bowlerId,
      targetPitchPoint: { x: targetX, y: 0, z: targetZ },
      releaseSpeedKmph: bowlingSpeed,
      swingType: selectedSwing,
      spinType: selectedSpin,
      seamAngleDegrees: 5,
      effortPercentage: 90
    };
    onCommitBowling(intent);
    triggerFeedback(
      'DELIVERY RELEASED',
      `${bowlingSpeed} km/h • ${pitchLength} Length • ${pitchLine.replace('_', ' ')} • ${selectedSwing !== 'NONE' ? selectedSwing : selectedSpin}`
    );
  };

  const handleShot = () => {
    const batterId = myPlayerId || 'practice_batter';
    const intent: BattingShotIntent = {
      batterId,
      shotType: selectedShot,
      power: shotPower,
      directionAngleDeg: shotAngle,
      timingOffsetMs: shotTimingOffset,
      isLofted,
      footwork: 'FRONT_FOOT'
    };
    onSubmitBatting(intent);
    const timingQuality = Math.abs(shotTimingOffset) < 22 ? 'Sweet Spot! ★' : Math.abs(shotTimingOffset) < 55 ? 'Good Stroke' : 'Mistimed';
    triggerFeedback(
      `SHOT EXECUTED (${timingQuality})`,
      `${selectedShot.replace('_', ' ')} • ${shotPower}% Power • ${isLofted ? 'Lofted Aerial' : 'Grounded Placement'}`
    );
  };

  const cameraOptions: { mode: CameraViewMode; label: string; key: string }[] = [
    { mode: 'BROADCAST', label: 'Broadcast TV', key: '1' },
    { mode: 'BATTING', label: 'Batting Stance', key: '2' },
    { mode: 'BOWLING', label: 'Bowler Mark', key: '3' },
    { mode: 'FIELD_SIDE', label: 'Field-Side', key: '4' },
    { mode: 'SPECTATOR', label: 'Free Orbit', key: '5' },
    { mode: 'REPLAY', label: 'Action Replay', key: '6' }
  ];

  return (
    <div className="absolute bottom-4 left-4 right-4 z-20 flex flex-col md:flex-row items-end md:items-center justify-between gap-4 pointer-events-none select-none">
      {/* 5-Perspective Camera Switcher Bar */}
      <div className="pointer-events-auto flex items-center gap-1 glass-panel p-1.5 rounded-2xl border border-white/10 shadow-2xl overflow-x-auto max-w-full">
        {cameraOptions.map((opt) => (
          <Tooltip key={opt.mode} content={`Shortcut: Press [${opt.key}] key`}>
            <button
              onClick={() => onCameraChange(opt.mode)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                cameraMode === opt.mode
                  ? 'bg-amber-400 text-slate-950 font-black shadow-lg scale-102'
                  : 'text-slate-300 hover:text-white hover:bg-white/10'
              }`}
            >
              <Camera className="w-3.5 h-3.5" />
              <span>{opt.label}</span>
              <span className="text-[10px] opacity-60 font-mono">[{opt.key}]</span>
            </button>
          </Tooltip>
        ))}
      </div>

      {/* Dynamic Action Console: Bowler or Batter Controls */}
      <div className="pointer-events-auto flex flex-wrap items-center gap-3">
        {/* Practice Mode Role Switcher */}
        {isPracticeMode && (
          <div className="glass-panel p-1 rounded-xl border border-emerald-500/30 flex gap-1 text-xs font-bold">
            <button
              onClick={() => {
                setPracticeRole('BATTING');
                onCameraChange('BATTING');
              }}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                practiceRole === 'BATTING' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Test Batting
            </button>
            <button
              onClick={() => {
                setPracticeRole('BOWLING');
                onCameraChange('BOWLING');
              }}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                practiceRole === 'BOWLING' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Test Bowling
            </button>
          </div>
        )}

        {/* Bowler Console */}
        {isMyTurnToBowl && (
          <div className="glass-panel p-3.5 rounded-2xl border border-emerald-500/30 flex flex-wrap items-center gap-3 shadow-2xl">
            <div className="text-left">
              <div className="text-[10px] uppercase font-bold tracking-wider text-emerald-400 flex items-center gap-1">
                <Zap className="w-3 h-3" /> Bowler Controls
              </div>
              <div className="text-xs font-semibold text-white">Speed: {bowlingSpeed} km/h</div>
            </div>
            <input
              type="range"
              min="85"
              max="155"
              value={bowlingSpeed}
              onChange={(e) => setBowlingSpeed(Number(e.target.value))}
              className="w-16 accent-emerald-500 cursor-pointer"
              title="Release pace in km/h"
            />
            <select
              value={pitchLength}
              onChange={(e) => setPitchLength(e.target.value as any)}
              className="bg-slate-900 border border-white/10 text-xs rounded-lg px-2 py-1 text-slate-200 focus:outline-none"
              title="Pitch Length Targeting"
            >
              <option value="YORKER">Yorker</option>
              <option value="FULL">Full Length</option>
              <option value="GOOD">Good Length</option>
              <option value="SHORT">Short / Bouncer</option>
            </select>
            <select
              value={pitchLine}
              onChange={(e) => setPitchLine(e.target.value as any)}
              className="bg-slate-900 border border-white/10 text-xs rounded-lg px-2 py-1 text-slate-200 focus:outline-none"
              title="Pitch Line Targeting"
            >
              <option value="OUTSIDE_OFF">Outside Off</option>
              <option value="OFF">Off Stump</option>
              <option value="MIDDLE">Middle Stump</option>
              <option value="LEG">Leg Stump</option>
            </select>
            <select
              value={selectedSwing}
              onChange={(e) => setSelectedSwing(e.target.value as SwingType)}
              className="bg-slate-900 border border-white/10 text-xs rounded-lg px-2 py-1 text-slate-200 focus:outline-none"
            >
              <option value="NONE">Seam Upright</option>
              <option value="OUTSWING">Outswing</option>
              <option value="INSWING">Inswing</option>
              <option value="REVERSE_SWING">Reverse Swing</option>
            </select>
            <select
              value={selectedSpin}
              onChange={(e) => setSelectedSpin(e.target.value as SpinVariation)}
              className="bg-slate-900 border border-white/10 text-xs rounded-lg px-2 py-1 text-slate-200 focus:outline-none"
            >
              <option value="NONE">No Spin</option>
              <option value="OFF_BREAK">Off Break</option>
              <option value="LEG_BREAK">Leg Break</option>
              <option value="GOOGLY">Googly</option>
            </select>
            <button
              onClick={handleDeliver}
              className="bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-black text-xs px-4 py-2 rounded-xl transition-all flex items-center gap-1.5 shadow-lg shadow-emerald-900/50"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              Deliver Ball
            </button>
          </div>
        )}

        {/* Batter Console */}
        {isMyTurnToBat && (
          <div className="glass-panel p-3.5 rounded-2xl border border-blue-500/30 flex flex-wrap items-center gap-3 shadow-2xl">
            <div className="text-left">
              <div className="text-[10px] uppercase font-bold tracking-wider text-blue-400 flex items-center gap-1">
                <Shield className="w-3 h-3" /> Batter Controls
              </div>
              <div className="text-xs font-semibold text-white">Power: {shotPower}%</div>
            </div>
            <select
              value={selectedShot}
              onChange={(e) => setSelectedShot(e.target.value as ShotType)}
              className="bg-slate-900 border border-white/10 text-xs rounded-lg px-2 py-1 text-slate-200 focus:outline-none"
            >
              <option value="COVER_DRIVE">Cover Drive</option>
              <option value="STRAIGHT_DRIVE">Straight Drive</option>
              <option value="PULL_SHOT">Pull Shot</option>
              <option value="FORWARD_DEFENSIVE">Defensive Block</option>
              <option value="LOFTED_DRIVE">Lofted Drive</option>
            </select>
            <select
              value={shotTimingOffset}
              onChange={(e) => setShotTimingOffset(Number(e.target.value))}
              className="bg-slate-900 border border-white/10 text-xs rounded-lg px-2 py-1 text-slate-200 focus:outline-none"
              title="Shot Timing Window"
            >
              <option value="0">Sweet Spot (0ms)</option>
              <option value="30">Good Timing (+30ms)</option>
              <option value="-30">Early Timing (-30ms)</option>
              <option value="75">Mistimed (+75ms)</option>
              <option value="110">Outside Edge (+110ms)</option>
            </select>
            <input
              type="range"
              min="20"
              max="100"
              value={shotPower}
              onChange={(e) => setShotPower(Number(e.target.value))}
              className="w-14 accent-blue-500 cursor-pointer"
              title="Shot power %"
            />
            <input
              type="range"
              min="0"
              max="359"
              value={shotAngle}
              onChange={(e) => setShotAngle(Number(e.target.value))}
              className="w-14 accent-amber-500 cursor-pointer"
              title="Shot direction angle (0-359°)"
            />
            <button
              onClick={() => setIsLofted(!isLofted)}
              className={`text-xs px-2.5 py-1 rounded-lg border font-semibold transition-all ${
                isLofted
                  ? 'bg-amber-500 text-slate-950 border-amber-400 font-bold'
                  : 'bg-slate-800 text-slate-300 border-white/10'
              }`}
            >
              {isLofted ? 'Lofted ▲' : 'Grounded ▼'}
            </button>
            <button
              onClick={handleShot}
              className="bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-black text-xs px-4 py-2 rounded-xl transition-all flex items-center gap-1.5 shadow-lg shadow-blue-900/50"
            >
              <Zap className="w-3.5 h-3.5 fill-current" />
              Hit Shot
            </button>
            {onCallRun && (
              <button
                onClick={onCallRun}
                className="bg-amber-400 hover:bg-amber-300 active:scale-95 text-slate-950 font-black text-xs px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 shadow-lg shadow-amber-900/50 cursor-pointer"
                title="Call and take a run between wickets"
              >
                Call Run 🏃
              </button>
            )}
          </div>
        )}

        {/* Fielder with Ball Possession Console */}
        {hasBall && (
          <div className="glass-panel p-3.5 rounded-2xl border border-red-500/40 flex flex-wrap items-center gap-3 shadow-2xl bg-red-950/40 animate-pulse">
            <div className="text-left">
              <div className="text-[10px] uppercase font-bold tracking-wider text-red-400 flex items-center gap-1">
                <Hand className="w-3.5 h-3.5 text-red-400" /> Ball in Hand
              </div>
              <div className="text-xs font-semibold text-white">Power: {throwPower}%</div>
            </div>
            <select
              value={throwTargetEnd}
              onChange={(e) => setThrowTargetEnd(e.target.value as any)}
              className="bg-slate-900 border border-white/10 text-xs rounded-lg px-2 py-1 text-slate-200 focus:outline-none"
            >
              <option value="STRIKER_END">🎯 Striker End (Wickets)</option>
              <option value="BOWLER_END">🎯 Bowler End (Wickets)</option>
            </select>
            <input
              type="range"
              min="50"
              max="100"
              value={throwPower}
              onChange={(e) => setThrowPower(Number(e.target.value))}
              className="w-16 accent-red-500 cursor-pointer"
              title="Throw power %"
            />
            <button
              onClick={handleThrow}
              className="bg-red-600 hover:bg-red-500 active:scale-95 text-white font-black text-xs px-4 py-2 rounded-xl transition-all flex items-center gap-1.5 shadow-lg shadow-red-900/50 cursor-pointer"
            >
              <Crosshair className="w-3.5 h-3.5" />
              Throw Ball
            </button>
          </div>
        )}

        {/* Outfielder In-Play Action Console */}
        {(isFielder || (isPracticeMode && practiceRole === 'FIELDING')) && !hasBall && (
          <div className="glass-panel p-3 rounded-2xl border border-emerald-500/30 flex flex-wrap items-center gap-2.5 shadow-2xl">
            <div className="text-left pr-1">
              <div className="text-[10px] uppercase font-bold tracking-wider text-emerald-400 flex items-center gap-1">
                <Move className="w-3 h-3" /> Fielder
              </div>
              <div className="text-xs font-semibold text-slate-200">
                {distToBall !== null ? `${distToBall.toFixed(1)}m to Ball` : 'In Field'}
              </div>
            </div>

            {inPickupRange && (
              <button
                onClick={handlePickup}
                className="bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-black text-xs px-3.5 py-1.5 rounded-xl transition-all flex items-center gap-1 shadow-lg shadow-emerald-900/50 cursor-pointer"
                title="Press E to pick up ball"
              >
                <Hand className="w-3.5 h-3.5" />
                Pick Up [E]
              </button>
            )}

            {inDiveRange && (
              <button
                onClick={handleDive}
                className="bg-amber-600 hover:bg-amber-500 active:scale-95 text-white font-black text-xs px-3.5 py-1.5 rounded-xl transition-all flex items-center gap-1 shadow-lg shadow-amber-900/50 cursor-pointer"
                title="Press Space to dive"
              >
                Dive Stop [Space]
              </button>
            )}

            {ball && !ball.isGrounded && inDiveRange && (
              <button
                onClick={handleCatch}
                className="bg-sky-600 hover:bg-sky-500 active:scale-95 text-white font-black text-xs px-3.5 py-1.5 rounded-xl transition-all flex items-center gap-1 shadow-lg shadow-sky-900/50 cursor-pointer"
                title="Catch aerial ball"
              >
                Catch Ball 🤲
              </button>
            )}
          </div>
        )}

        {/* Bowling Captain Tactical Presets Drawer */}
        {isCaptainUser && (
          <div className="glass-panel p-2 rounded-2xl border border-amber-400/30 flex items-center gap-2">
            <button
              onClick={() => setCaptainDrawerOpen(!captainDrawerOpen)}
              className="px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 active:scale-95 rounded-xl text-xs font-bold text-amber-300 border border-amber-400/40 transition-all flex items-center gap-1 shadow-md"
            >
              <Flag className="w-3.5 h-3.5" />
              <span>Field Tactics</span>
            </button>

            {captainDrawerOpen && (
              <div className="flex items-center gap-1.5 animate-fadeIn">
                <button
                  onClick={() => handleApplyPreset('ATTACKING')}
                  className="px-2.5 py-1 bg-red-600/80 hover:bg-red-600 text-white rounded-lg text-xs font-bold transition-all shadow"
                >
                  ⚡ Attacking
                </button>
                <button
                  onClick={() => handleApplyPreset('DEFENSIVE')}
                  className="px-2.5 py-1 bg-blue-600/80 hover:bg-blue-600 text-white rounded-lg text-xs font-bold transition-all shadow"
                >
                  🛡️ Defensive
                </button>
                <button
                  onClick={() => handleApplyPreset('BALANCED')}
                  className="px-2.5 py-1 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-xs font-bold transition-all shadow"
                >
                  ⚖️ Balanced
                </button>
              </div>
            )}
          </div>
        )}

        {/* Spectator Mode Panel with Camera Controls */}
        {!myPlayerId && !isPracticeMode && (
          <div className="glass-panel p-2 rounded-2xl border border-amber-400/40 text-slate-300 text-xs font-semibold flex flex-wrap items-center gap-2 shadow-xl bg-slate-950/90">
            <div className="flex items-center gap-1.5 text-amber-400 font-bold px-2 py-1 bg-amber-500/10 rounded-lg border border-amber-500/20">
              <Eye className="w-4 h-4" />
              <span>Spectating Match</span>
            </div>
            <div className="flex items-center gap-1 flex-wrap">
              <button
                type="button"
                onClick={() => onCameraChange('BROADCAST')}
                className={`px-2.5 py-1 text-xs rounded-lg font-bold transition-all ${
                  cameraMode === 'BROADCAST' ? 'bg-amber-500 text-slate-950 shadow' : 'bg-slate-800 text-slate-300 hover:text-white'
                }`}
              >
                📺 Broadcast
              </button>
              <button
                type="button"
                onClick={() => onCameraChange('BATTING')}
                className={`px-2.5 py-1 text-xs rounded-lg font-bold transition-all ${
                  cameraMode === 'BATTING' ? 'bg-amber-500 text-slate-950 shadow' : 'bg-slate-800 text-slate-300 hover:text-white'
                }`}
              >
                🏏 Batter
              </button>
              <button
                type="button"
                onClick={() => onCameraChange('BOWLING')}
                className={`px-2.5 py-1 text-xs rounded-lg font-bold transition-all ${
                  cameraMode === 'BOWLING' ? 'bg-amber-500 text-slate-950 shadow' : 'bg-slate-800 text-slate-300 hover:text-white'
                }`}
              >
                🎯 Bowler
              </button>
              <button
                type="button"
                onClick={() => onCameraChange('FIELDER')}
                className={`px-2.5 py-1 text-xs rounded-lg font-bold transition-all ${
                  cameraMode === 'FIELDER' ? 'bg-amber-500 text-slate-950 shadow' : 'bg-slate-800 text-slate-300 hover:text-white'
                }`}
              >
                🏃 Fielder
              </button>
              <button
                type="button"
                onClick={() => onCameraChange('SPECTATOR')}
                className={`px-2.5 py-1 text-xs rounded-lg font-bold transition-all ${
                  cameraMode === 'SPECTATOR' ? 'bg-amber-500 text-slate-950 shadow' : 'bg-slate-800 text-slate-300 hover:text-white'
                }`}
              >
                🪐 Orbit
              </button>
              <button
                type="button"
                onClick={() => onCameraChange('REPLAY')}
                className={`px-2.5 py-1 text-xs rounded-lg font-bold transition-all ${
                  cameraMode === 'REPLAY' ? 'bg-amber-500 text-slate-950 shadow' : 'bg-slate-800 text-slate-300 hover:text-white'
                }`}
              >
                🎥 Replay
              </button>
            </div>
          </div>
        )}

        {/* Umpire Appeal & DRS Review Button (Active Players Only) */}
        {(Boolean(myPlayerId) || isPracticeMode) && (
          <div className="glass-panel p-2 rounded-2xl border border-white/10 flex items-center gap-2">
            <button
              onClick={() => {
                if (onAppeal) {
                  onAppeal('HOWZAT');
                  triggerFeedback('HOWZAT!', 'Appeal submitted to the match umpire.');
                }
              }}
              className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-500 active:scale-95 rounded-xl text-xs font-black text-white transition-all flex items-center gap-1.5 shadow-md shadow-rose-950/50"
            >
              <HelpCircle className="w-3.5 h-3.5" />
              <span>HOWZAT!</span>
            </button>

            <Tooltip content="DRS review system activates when appeal is adjudicated">
              <button
                onClick={() =>
                  triggerFeedback(
                    'DRS HAWK-EYE & ULTRAEDGE',
                    'Tracking ball path trajectory and bat contact acoustics.'
                  )
                }
                className="px-3 py-1.5 bg-indigo-600/80 hover:bg-indigo-600 active:scale-95 rounded-xl text-xs font-bold text-white transition-all flex items-center gap-1 shadow-md"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>DRS</span>
              </button>
            </Tooltip>
          </div>
        )}
      </div>

      {/* Floating Televised Broadcast Feedback Banner */}
      {feedbackBanner && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-40 max-w-md w-full px-4 animate-fadeIn pointer-events-none">
          <div className="glass-panel p-3.5 rounded-2xl border border-amber-400/40 shadow-2xl bg-slate-900/95 text-center">
            <div className="text-[10px] font-black uppercase tracking-widest text-amber-400 mb-0.5">
              {feedbackBanner.title}
            </div>
            <div className="text-xs font-semibold text-slate-100">{feedbackBanner.message}</div>
          </div>
        </div>
      )}
    </div>
  );
};
