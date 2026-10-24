import React, { useState } from 'react';
import {
  CricketGameState,
  BowlingDeliveryIntent,
  BattingShotIntent,
  ShotType,
  SwingType,
  SpinVariation
} from '@cricket2026/shared';
import { CameraViewMode } from '../3d/CricketStadiumScene.js';
import { Camera, Zap, Shield, Play, HelpCircle, Eye } from 'lucide-react';

interface GameControlsProps {
  gameState: CricketGameState | null;
  myPlayerId?: string | null;
  cameraMode: CameraViewMode;
  onCameraChange: (mode: CameraViewMode) => void;
  onCommitBowling: (intent: BowlingDeliveryIntent) => void;
  onSubmitBatting: (intent: BattingShotIntent) => void;
}

export const GameControlsHUD: React.FC<GameControlsProps> = ({
  gameState,
  myPlayerId,
  cameraMode,
  onCameraChange,
  onCommitBowling,
  onSubmitBatting
}) => {
  // Bowling state
  const [bowlingSpeed, setBowlingSpeed] = useState(135);
  const [selectedSwing, setSelectedSwing] = useState<SwingType>('OUTSWING');
  const [selectedSpin, setSelectedSpin] = useState<SpinVariation>('NONE');

  // Batting state
  const [selectedShot, setSelectedShot] = useState<ShotType>('COVER_DRIVE');
  const [shotPower, setShotPower] = useState(80);
  const [isLofted, setIsLofted] = useState(false);
  const [shotAngle, setShotAngle] = useState(315);

  const isMyTurnToBowl = gameState?.currentBowlerId === myPlayerId;
  const isMyTurnToBat = gameState?.currentStrikerId === myPlayerId;

  const handleDeliver = () => {
    if (!myPlayerId) return;
    const intent: BowlingDeliveryIntent = {
      bowlerId: myPlayerId,
      targetPitchPoint: { x: 0.1, y: 0, z: 4.8 },
      releaseSpeedKmph: bowlingSpeed,
      swingType: selectedSwing,
      spinType: selectedSpin,
      seamAngleDegrees: 5,
      effortPercentage: 90
    };
    onCommitBowling(intent);
  };

  const handleShot = () => {
    if (!myPlayerId) return;
    const intent: BattingShotIntent = {
      batterId: myPlayerId,
      shotType: selectedShot,
      power: shotPower,
      directionAngleDeg: shotAngle,
      timingOffsetMs: 0, // perfect sweet-spot click
      isLofted,
      footwork: 'FRONT_FOOT'
    };
    onSubmitBatting(intent);
  };

  return (
    <div className="absolute bottom-4 left-4 right-4 z-20 flex flex-col md:flex-row items-end md:items-center justify-between gap-4 pointer-events-none">
      {/* Camera Mode Toggle Bar */}
      <div className="pointer-events-auto flex items-center gap-1.5 glass-panel p-1.5 rounded-2xl border border-white/10 shadow-xl">
        {(['STRIKER', 'BOWLER', 'BROADCAST', 'SPECTATOR'] as CameraViewMode[]).map((mode) => (
          <button
            key={mode}
            onClick={() => onCameraChange(mode)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
              cameraMode === mode
                ? 'bg-amber-400 text-slate-950 shadow-md font-bold'
                : 'text-slate-300 hover:text-white hover:bg-white/10'
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            {mode}
          </button>
        ))}
      </div>

      {/* Dynamic Action Console: Bowler or Batter Controls */}
      <div className="pointer-events-auto flex items-center gap-3">
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
              className="w-20 accent-emerald-500 cursor-pointer"
            />
            <select
              value={selectedSwing}
              onChange={(e) => setSelectedSwing(e.target.value as SwingType)}
              className="bg-slate-900 border border-white/10 text-xs rounded-lg px-2 py-1 text-slate-200"
            >
              <option value="NONE">Seam</option>
              <option value="OUTSWING">Outswing</option>
              <option value="INSWING">Inswing</option>
              <option value="REVERSE_SWING">Reverse</option>
            </select>
            <select
              value={selectedSpin}
              onChange={(e) => setSelectedSpin(e.target.value as SpinVariation)}
              className="bg-slate-900 border border-white/10 text-xs rounded-lg px-2 py-1 text-slate-200"
            >
              <option value="NONE">No Spin</option>
              <option value="OFF_BREAK">Off Break</option>
              <option value="LEG_BREAK">Leg Break</option>
              <option value="GOOGLY">Googly</option>
            </select>
            <button
              onClick={handleDeliver}
              className="bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold text-xs px-4 py-2 rounded-xl transition-all flex items-center gap-1.5 shadow-lg shadow-emerald-900/50"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              Deliver
            </button>
          </div>
        )}

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
              className="bg-slate-900 border border-white/10 text-xs rounded-lg px-2 py-1 text-slate-200"
            >
              <option value="COVER_DRIVE">Cover Drive</option>
              <option value="STRAIGHT_DRIVE">Straight Drive</option>
              <option value="PULL_SHOT">Pull Shot</option>
              <option value="FORWARD_DEFENSIVE">Defensive</option>
              <option value="LOFTED_DRIVE">Lofted</option>
            </select>
            <input
              type="range"
              min="20"
              max="100"
              value={shotPower}
              onChange={(e) => setShotPower(Number(e.target.value))}
              className="w-16 accent-blue-500 cursor-pointer"
            />
            <input
              type="range"
              min="0"
              max="359"
              value={shotAngle}
              onChange={(e) => setShotAngle(Number(e.target.value))}
              className="w-16 accent-amber-500 cursor-pointer"
              title="Shot direction angle"
            />
            <button
              onClick={() => setIsLofted(!isLofted)}
              className={`text-xs px-2.5 py-1 rounded-lg border font-semibold transition-all ${
                isLofted
                  ? 'bg-amber-500 text-slate-950 border-amber-400'
                  : 'bg-slate-800 text-slate-300 border-white/10'
              }`}
            >
              {isLofted ? 'Lofted ▲' : 'Grounded ▼'}
            </button>
            <button
              onClick={handleShot}
              className="bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-bold text-xs px-4 py-2 rounded-xl transition-all flex items-center gap-1.5 shadow-lg shadow-blue-900/50"
            >
              <Zap className="w-3.5 h-3.5 fill-current" />
              Hit
            </button>
          </div>
        )}

        {/* Umpire Appeal & DRS Review Prompt */}
        <div className="glass-panel p-2 rounded-2xl border border-white/10 flex items-center gap-2">
          <button
            onClick={() => alert('Appealed to Umpire: HOWZAT!')}
            className="px-3 py-1.5 bg-rose-600/80 hover:bg-rose-600 active:scale-95 rounded-xl text-xs font-bold text-white transition-all flex items-center gap-1 shadow-md"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            Appeal
          </button>
          <button
            onClick={() => alert('DRS Review Requested! Ball Tracking & UltraEdge Initializing...')}
            className="px-3 py-1.5 bg-indigo-600/80 hover:bg-indigo-600 active:scale-95 rounded-xl text-xs font-bold text-white transition-all flex items-center gap-1 shadow-md"
          >
            <Eye className="w-3.5 h-3.5" />
            DRS
          </button>
        </div>
      </div>
    </div>
  );
};
