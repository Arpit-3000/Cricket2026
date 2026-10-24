import React, { useEffect, useState } from 'react';
import { MatchScorecard, CricketGameState } from '@cricket2026/shared';
import { ArrowRight, Shield, Zap, Target } from 'lucide-react';

interface InningsBreakModalProps {
  scorecard: MatchScorecard | null;
  gameState: CricketGameState | null;
  inningsBreakData: {
    inningsIndex: 1;
    target: number;
    requiredRunRate: number;
    commentary: string;
  } | null;
  onDismiss: () => void;
}

export const InningsBreakModal: React.FC<InningsBreakModalProps> = ({
  scorecard,
  gameState,
  inningsBreakData,
  onDismiss
}) => {
  const [countdown, setCountdown] = useState<number>(15);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          onDismiss();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [onDismiss]);

  if (!scorecard || !gameState) return null;

  const firstInnings = scorecard.innings[0];
  if (!firstInnings) return null;

  const firstBattingTeam = gameState.teams[firstInnings.battingTeamId];
  const secondBattingTeam = gameState.teams[firstInnings.bowlingTeamId];

  const target = inningsBreakData?.target || (firstInnings.runs + 1);
  const requiredRunRate = (target / 5.0).toFixed(2);

  // Top batter in 1st innings
  const topBatter = [...firstInnings.batters].sort((a, b) => b.runs - a.runs)[0];
  // Top bowler in 1st innings
  const topBowler = [...firstInnings.bowlers].sort((a, b) => b.wickets - a.wickets || a.runsConceded - b.runsConceded)[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-300">
      <div className="w-full max-w-xl bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border-2 border-amber-500/80 rounded-3xl shadow-[0_0_60px_rgba(245,158,11,0.25)] overflow-hidden text-white">
        
        {/* Banner Header */}
        <div className="bg-gradient-to-r from-amber-600 via-amber-500 to-amber-700 px-6 py-4 text-center relative">
          <div className="text-[11px] font-black uppercase tracking-widest text-amber-950">
            T5 Match Specification • 5 Overs
          </div>
          <h2 className="text-2xl font-black text-white flex items-center justify-center gap-2">
            <span>☕</span> INNINGS BREAK
          </h2>
          <div className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/20 px-2.5 py-1 rounded-full text-xs font-mono font-bold text-white">
            Resuming in {countdown}s
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5">
          {/* 1st Innings Result Score Box */}
          <div className="bg-slate-950/80 rounded-2xl p-4 border border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center text-lg font-black text-white shadow-inner"
                style={{ backgroundColor: firstBattingTeam?.primaryColor || '#1e3a8a' }}
              >
                {firstBattingTeam?.shortCode || 'BAT'}
              </div>
              <div>
                <div className="text-xs uppercase font-bold text-slate-400">1st Innings Completed</div>
                <div className="text-lg font-black text-white">{firstBattingTeam?.name}</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-3xl font-black text-amber-400 font-mono-numbers">
                {firstInnings.runs}/{firstInnings.wickets}
              </div>
              <div className="text-xs text-slate-400 font-mono-numbers">
                ({firstInnings.oversCompleted}.{firstInnings.ballsInCurrentOver} / 5.0 ov)
              </div>
            </div>
          </div>

          {/* 2nd Innings Target Banner */}
          <div className="bg-gradient-to-r from-emerald-950/60 via-slate-900 to-emerald-950/60 rounded-2xl p-4 border border-emerald-500/40 text-center">
            <div className="flex items-center justify-center gap-1.5 text-xs uppercase font-bold text-emerald-400 mb-1">
              <Target className="w-4 h-4" />
              <span>Target Equation</span>
            </div>
            <div className="text-2xl font-black text-white mb-1">
              <span className="text-emerald-400">{secondBattingTeam?.name}</span> needs{' '}
              <span className="text-amber-400 font-mono-numbers">{target} Runs</span> to win
            </div>
            <div className="text-xs text-slate-300 flex items-center justify-center gap-4">
              <span>Required: <strong className="text-white">30 Balls</strong></span>
              <span>•</span>
              <span>Req Run Rate: <strong className="text-emerald-300 font-mono-numbers">{requiredRunRate} RPO</strong></span>
            </div>
          </div>

          {/* Top Performers Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Top Batter */}
            <div className="bg-slate-950/60 rounded-xl p-3 border border-white/5">
              <div className="text-[10px] uppercase font-bold text-amber-400 mb-1 flex items-center gap-1">
                <Zap className="w-3 h-3" /> Top Batter (1st Inn)
              </div>
              {topBatter ? (
                <div>
                  <div className="text-sm font-bold text-white">{topBatter.playerName}</div>
                  <div className="text-xs text-slate-300 font-mono-numbers">
                    <strong className="text-amber-300">{topBatter.runs}</strong> ({topBatter.ballsFaced}b) • {topBatter.fours}x4, {topBatter.sixes}x6
                  </div>
                  <div className="text-[11px] text-slate-400">SR: {topBatter.strikeRate}</div>
                </div>
              ) : (
                <div className="text-xs text-slate-400">None</div>
              )}
            </div>

            {/* Top Bowler */}
            <div className="bg-slate-950/60 rounded-xl p-3 border border-white/5">
              <div className="text-[10px] uppercase font-bold text-emerald-400 mb-1 flex items-center gap-1">
                <Shield className="w-3 h-3" /> Top Bowler (1st Inn)
              </div>
              {topBowler ? (
                <div>
                  <div className="text-sm font-bold text-white">{topBowler.playerName}</div>
                  <div className="text-xs text-slate-300 font-mono-numbers">
                    <strong className="text-emerald-300">{topBowler.wickets}-{topBowler.runsConceded}</strong> ({topBowler.overs} ov)
                  </div>
                  <div className="text-[11px] text-slate-400">Econ: {topBowler.economy}</div>
                </div>
              ) : (
                <div className="text-xs text-slate-400">None</div>
              )}
            </div>
          </div>

          {/* Action Button */}
          <button
            type="button"
            onClick={onDismiss}
            className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 font-black text-sm text-white shadow-[0_0_30px_rgba(16,185,129,0.3)] active:scale-98 transition-all flex items-center justify-center gap-2"
          >
            <span>Begin 2nd Innings</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
