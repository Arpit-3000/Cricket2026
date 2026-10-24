import React from 'react';
import { MatchScorecard, InningsScorecard, CricketGameState } from '@cricket2026/shared';
import { Wifi, Users, Shield, Compass } from 'lucide-react';
import { Tooltip } from './Tooltip.js';

interface ScorecardProps {
  scorecard: MatchScorecard | null;
  gameState: CricketGameState | null;
  roomCode: string;
  pingMs: number;
  spectatorCount: number;
  isPracticeMode?: boolean;
  onExitToMenu?: () => void;
}

export const BroadcastScorecard: React.FC<ScorecardProps> = ({
  scorecard,
  gameState,
  roomCode,
  pingMs,
  spectatorCount,
  isPracticeMode = false,
  onExitToMenu
}) => {
  // Practice Mode Scoreboard
  if (isPracticeMode) {
    return (
      <div className="absolute top-4 left-4 right-4 z-20 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 pointer-events-none">
        <div className="flex flex-wrap items-stretch pointer-events-auto shadow-2xl rounded-2xl overflow-hidden border border-white/15 bg-slate-900/90 backdrop-blur-xl">
          <div className="px-5 py-3 flex items-center gap-3 bg-gradient-to-r from-emerald-700 to-teal-800 border-r border-white/15">
            <Compass className="w-5 h-5 text-amber-300" />
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-200">
                STADIUM TOUR
              </div>
              <div className="text-sm font-black text-white">Practice Nets Arena</div>
            </div>
          </div>
          <div className="px-6 py-2.5 flex items-baseline gap-4 bg-slate-950/80 border-r border-white/10 text-xs text-slate-300">
            <div>
              Format: <span className="font-bold text-amber-400">5 Overs Specification</span>
            </div>
            <div>
              Boundary: <span className="font-bold text-emerald-400">65 Meters</span>
            </div>
            <div>
              Pitch: <span className="font-bold text-sky-400">22 Yards (20.12m)</span>
            </div>
          </div>
        </div>

        {/* Practice Return Button */}
        {onExitToMenu && (
          <div className="pointer-events-auto flex items-center gap-2">
            <button
              onClick={onExitToMenu}
              className="glass-panel px-4 py-2 rounded-xl text-xs font-bold text-slate-200 hover:text-white hover:bg-white/10 transition-all border border-white/15 shadow-xl"
            >
              Exit to Menu
            </button>
          </div>
        )}
      </div>
    );
  }

  // Pre-match / Lobby state
  if (!gameState || !scorecard) {
    return (
      <div className="absolute top-4 left-4 z-20 flex items-center gap-3 glass-panel px-4 py-2.5 rounded-xl border border-white/10 shadow-2xl">
        <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
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

  const striker = currentInnings?.batters.find((b) => b.playerId === gameState.currentStrikerId);
  const nonStriker = currentInnings?.batters.find((b) => b.playerId === gameState.currentNonStrikerId);
  const bowler = currentInnings?.bowlers.find((b) => b.playerId === gameState.currentBowlerId);

  return (
    <div className="absolute top-4 left-4 right-4 z-20 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 pointer-events-none">
      {/* Primary Broadcast Banner */}
      <div className="flex flex-wrap items-stretch pointer-events-auto shadow-2xl rounded-2xl overflow-hidden border border-white/15 bg-slate-900/90 backdrop-blur-xl">
        {/* Team Identity Block */}
        <div className="px-5 py-3 flex items-center gap-3 bg-gradient-to-r from-blue-700 to-indigo-800 border-r border-white/15">
          <Shield className="w-5 h-5 text-amber-400" />
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-blue-200 flex items-center gap-1.5">
              <span className="text-amber-400 font-extrabold">
                {gameState.currentInningsNumber === 1 ? '1ST INNINGS' : '2ND INNINGS'}
              </span>
              <span>•</span>
              <span>{battingTeam?.shortCode || 'BAT'} vs {bowlingTeam?.shortCode || 'BOWL'}</span>
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

          <Tooltip content="Overs completed in this 5-over innings">
            <div className="text-xs text-slate-400 font-medium cursor-help">
              <span className="text-amber-400 font-bold font-mono-numbers">
                {currentInnings?.oversCompleted ?? 0}.{currentInnings?.ballsInCurrentOver ?? 0}
              </span>
              <span> / 5.0 Ov</span>
            </div>
          </Tooltip>

          <Tooltip content="Current Run Rate: Average runs scored per over">
            <div className="text-xs text-slate-400 cursor-help">
              CRR: <span className="font-bold text-emerald-400 font-mono-numbers">{currentInnings?.runRate ?? 0}</span>
            </div>
          </Tooltip>

          {currentInnings?.target && (
            <Tooltip content="Target to win in 5 overs">
              <div className="text-xs font-semibold text-amber-300 bg-amber-500/20 px-2 py-0.5 rounded border border-amber-500/30 cursor-help">
                Target: {currentInnings.target}
              </div>
            </Tooltip>
          )}
        </div>

        {/* Current Batters & Bowler Mini Bar */}
        <div className="px-5 py-2 flex flex-wrap items-center gap-4 text-xs text-slate-300">
          <div>
            <span className="font-bold text-amber-400">{striker?.playerName || 'Striker'}*</span>{' '}
            <span className="font-mono-numbers font-semibold text-white">{striker?.runs ?? 0}</span>
            <span className="text-slate-400">({striker?.ballsFaced ?? 0})</span>
            {striker?.fours ? <span className="ml-1 text-[10px] text-amber-300">4s:{striker.fours}</span> : null}
            {striker?.sixes ? <span className="ml-1 text-[10px] text-emerald-400">6s:{striker.sixes}</span> : null}
          </div>
          <div className="text-slate-500">|</div>
          <div>
            <span className="font-medium text-slate-300">{nonStriker?.playerName || 'Non-Striker'}</span>{' '}
            <span className="font-mono-numbers font-semibold text-white">{nonStriker?.runs ?? 0}</span>
            <span className="text-slate-400">({nonStriker?.ballsFaced ?? 0})</span>
          </div>
          <div className="text-slate-500">|</div>
          <div>
            <span className="text-emerald-400 font-semibold">{bowler?.playerName || 'Bowler'}:</span>{' '}
            <span className="font-mono-numbers text-white font-semibold">
              {bowler?.wickets ?? 0}-{bowler?.runsConceded ?? 0}
            </span>{' '}
            <span className="text-slate-400">({bowler?.overs ?? '0.0'})</span>
            {bowler?.maidens ? <span className="ml-1 text-[10px] text-cyan-300 font-bold">M:{bowler.maidens}</span> : null}
          </div>
          <div className="text-slate-500">|</div>
          <div className="text-[11px] text-slate-400">
            <span>Partnership: </span>
            <span className="text-white font-bold">{currentInnings?.currentPartnershipRuns ?? 0}</span>
            <span> ({currentInnings?.currentPartnershipBalls ?? 0})</span>
          </div>
          <div className="text-slate-500">|</div>
          <div className="text-[11px] text-slate-400">
            <span>Extras: </span>
            <span className="text-amber-300 font-bold">{currentInnings?.extras.total ?? 0}</span>
            <span className="text-[10px] text-slate-400"> (w:{currentInnings?.extras.wides ?? 0}, nb:{currentInnings?.extras.noBalls ?? 0})</span>
          </div>
        </div>

        {/* Current Over Ball Progress Strip */}
        <div className="w-full px-4 py-1.5 bg-slate-950/90 border-t border-white/10 flex items-center gap-2 text-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Over Progress:</span>
          <div className="flex items-center gap-1.5 flex-wrap">
            {Array.from({ length: 6 }).map((_, idx) => {
              const ballIndex = idx + 1;
              const isDelivered = ballIndex <= (currentInnings?.ballsInCurrentOver ?? 0);
              return (
                <span
                  key={idx}
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-mono-numbers font-bold border shadow-sm ${
                    isDelivered
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                      : 'bg-slate-900/60 text-slate-600 border-white/5'
                  }`}
                >
                  {isDelivered ? `${ballIndex}` : '•'}
                </span>
              );
            })}
          </div>
        </div>
      </div>

      {/* Match Completed Banner */}
      {scorecard.isCompleted && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-50 pointer-events-auto shadow-2xl rounded-2xl p-5 border border-amber-400/50 bg-slate-950/95 text-center max-w-lg w-full animate-bounce">
          <div className="text-xs uppercase font-black tracking-widest text-amber-400 mb-1">
            MATCH CONCLUDED
          </div>
          <div className="text-lg font-black text-white mb-2">
            {scorecard.matchResultCommentary || 'Match Completed!'}
          </div>
          <div className="text-xs text-slate-300 flex justify-center gap-6">
            <div>
              {gameState.teams.TEAM_A.name}: <span className="font-bold text-amber-400">{scorecard.innings[0]?.runs}/{scorecard.innings[0]?.wickets}</span>
            </div>
            {scorecard.innings[1] && (
              <div>
                {gameState.teams.TEAM_B.name}: <span className="font-bold text-emerald-400">{scorecard.innings[1]?.runs}/{scorecard.innings[1]?.wickets}</span>
              </div>
            )}
          </div>
        </div>
      )}

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
