import React from 'react';
import { MatchScorecard, InningsScorecard, CricketGameState } from '@cricket2026/shared';
import { Wifi, Users, Shield } from 'lucide-react';

interface ScorecardProps {
  scorecard: MatchScorecard | null;
  gameState: CricketGameState | null;
  roomCode: string;
  pingMs: number;
  spectatorCount: number;
}

export const BroadcastScorecard: React.FC<ScorecardProps> = ({
  scorecard,
  gameState,
  roomCode,
  pingMs,
  spectatorCount
}) => {
  if (!gameState || !scorecard) {
    return (
      <div className="absolute top-4 left-4 z-20 flex items-center gap-3 glass-panel px-4 py-2.5 rounded-xl border border-white/10 shadow-2xl">
        <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
        <span className="text-xs uppercase tracking-widest text-slate-300 font-semibold">
          Cricket 2026 Arena
        </span>
        <span className="text-xs font-mono text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/20">
          CODE: {roomCode || 'LOBBY'}
        </span>
      </div>
    );
  }

  const currentInningsIndex = (gameState.currentInningsNumber - 1) as 0 | 1;
  const currentInnings = scorecard.innings[currentInningsIndex] as InningsScorecard | undefined;
  const battingTeam = gameState.teams[gameState.battingTeamId];
  const bowlingTeam = gameState.teams[gameState.bowlingTeamId];

  const striker = currentInnings?.batters.find(b => b.playerId === gameState.currentStrikerId);
  const nonStriker = currentInnings?.batters.find(b => b.playerId === gameState.currentNonStrikerId);
  const bowler = currentInnings?.bowlers.find(b => b.playerId === gameState.currentBowlerId);

  return (
    <div className="absolute top-4 left-4 right-4 z-20 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 pointer-events-none">
      {/* Primary Broadcast Banner */}
      <div className="flex flex-wrap items-stretch pointer-events-auto shadow-2xl rounded-2xl overflow-hidden border border-white/15 bg-slate-900/90 backdrop-blur-xl">
        {/* Team Identity Block */}
        <div className="px-5 py-3 flex items-center gap-3 bg-gradient-to-r from-blue-700 to-indigo-800 border-r border-white/15">
          <Shield className="w-5 h-5 text-amber-400" />
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-blue-200">
              {battingTeam?.shortCode || 'BAT'} vs {bowlingTeam?.shortCode || 'BOWL'}
            </div>
            <div className="text-sm font-black text-white">{battingTeam?.name || 'Batting Team'}</div>
          </div>
        </div>

        {/* Score & Overs Block */}
        <div className="px-6 py-2.5 flex items-baseline gap-4 bg-slate-950/80 border-r border-white/10">
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-black text-white font-mono-numbers">
              {currentInnings?.runs ?? 0}
            </span>
            <span className="text-2xl font-bold text-slate-400">/</span>
            <span className="text-2xl font-black text-rose-500 font-mono-numbers">
              {currentInnings?.wickets ?? 0}
            </span>
          </div>
          <div className="text-xs text-slate-400 font-medium">
            <span className="text-amber-400 font-bold font-mono-numbers">
              {currentInnings?.oversCompleted ?? 0}.{currentInnings?.ballsInCurrentOver ?? 0}
            </span>
            <span> / 5.0 Ov</span>
          </div>
          <div className="text-xs text-slate-400">
            CRR: <span className="font-bold text-emerald-400">{currentInnings?.runRate ?? 0}</span>
          </div>
          {currentInnings?.target && (
            <div className="text-xs font-semibold text-amber-300 bg-amber-500/20 px-2 py-0.5 rounded border border-amber-500/30">
              Target: {currentInnings.target}
            </div>
          )}
        </div>

        {/* Current Batters & Bowler Mini Bar */}
        <div className="px-5 py-2 flex items-center gap-6 text-xs text-slate-300">
          <div>
            <span className="font-bold text-amber-400">{striker?.playerName || 'Striker'}*</span>{' '}
            <span className="font-mono-numbers font-semibold text-white">{striker?.runs ?? 0}</span>
            <span className="text-slate-400">({striker?.ballsFaced ?? 0})</span>
          </div>
          <div className="text-slate-400">|</div>
          <div>
            <span className="font-medium text-slate-300">{nonStriker?.playerName || 'Non-Striker'}</span>{' '}
            <span className="font-mono-numbers font-semibold text-white">{nonStriker?.runs ?? 0}</span>
            <span className="text-slate-400">({nonStriker?.ballsFaced ?? 0})</span>
          </div>
          <div className="text-slate-400">|</div>
          <div>
            <span className="text-emerald-400 font-semibold">{bowler?.playerName || 'Bowler'}:</span>{' '}
            <span className="font-mono-numbers text-white font-semibold">
              {bowler?.wickets ?? 0}-{bowler?.runsConceded ?? 0}
            </span>{' '}
            <span className="text-slate-400">({bowler?.overs ?? '0.0'})</span>
          </div>
        </div>
      </div>

      {/* Room Status & Telemetry Bar */}
      <div className="pointer-events-auto flex items-center gap-2 glass-panel px-4 py-2 rounded-xl text-xs font-medium text-slate-300">
        <div className="flex items-center gap-1.5 text-emerald-400">
          <Wifi className="w-3.5 h-3.5" />
          <span className="font-mono-numbers">{pingMs}ms</span>
        </div>
        <div className="w-px h-3 bg-white/15" />
        <div className="flex items-center gap-1.5 text-sky-400">
          <Users className="w-3.5 h-3.5" />
          <span>{spectatorCount} Spectators</span>
        </div>
        <div className="w-px h-3 bg-white/15" />
        <span className="font-mono text-amber-300 font-bold bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/30">
          ROOM: {roomCode}
        </span>
      </div>
    </div>
  );
};
