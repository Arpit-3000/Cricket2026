import React, { useState } from 'react';
import { MatchScorecard, CricketGameState, TeamId } from '@cricket2026/shared';
import { Trophy, RotateCcw, Home, Swords, X } from 'lucide-react';

interface MatchResultModalProps {
  scorecard: MatchScorecard | null;
  gameState: CricketGameState | null;
  winnerTeamId?: TeamId | 'TIE';
  commentary?: string;
  isHost?: boolean;
  onRematch: () => void;
  onReturnToLobby: () => void;
  onStartSuperOver?: () => void;
  onClose?: () => void;
}

export const MatchResultModal: React.FC<MatchResultModalProps> = ({
  scorecard,
  gameState,
  winnerTeamId,
  commentary,
  isHost = false,
  onRematch,
  onReturnToLobby,
  onStartSuperOver,
  onClose
}) => {
  const [activeTab, setActiveTab] = useState<'INN_1' | 'INN_2' | 'SUPER_OVER'>('INN_1');

  if (!scorecard || !gameState) return null;

  const resolvedWinner = winnerTeamId || scorecard.winnerTeamId;
  const isTie = resolvedWinner === 'TIE';
  const winningTeam = (!isTie && resolvedWinner && (resolvedWinner === 'TEAM_A' || resolvedWinner === 'TEAM_B'))
    ? gameState.teams[resolvedWinner]
    : null;

  const inn1 = scorecard.innings[0];
  const inn2 = scorecard.innings[1];
  const superOver = scorecard.superOver;

  const currentDisplayInnings =
    activeTab === 'INN_1' ? inn1 : activeTab === 'INN_2' ? inn2 : superOver?.innings[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-3 sm:p-6 overflow-y-auto animate-in zoom-in-95 duration-300">
      <div className="w-full max-w-4xl bg-slate-900 border-2 border-amber-500/80 rounded-3xl shadow-[0_0_80px_rgba(245,158,11,0.3)] overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* 1. Championship Winner Header Banner */}
        <div className="relative bg-gradient-to-r from-amber-600 via-amber-500 to-amber-700 px-6 py-5 text-center text-white shrink-0">
          {onClose && (
            <button
              onClick={onClose}
              className="absolute right-4 top-4 p-1.5 rounded-full bg-black/20 hover:bg-black/40 text-white transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          )}

          <div className="flex items-center justify-center gap-2 text-xs font-black uppercase tracking-widest text-amber-950 mb-1">
            <Trophy className="w-4 h-4" /> Official Match Concluded • 5-Over Specification
          </div>

          <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white drop-shadow">
            {isTie ? 'MATCH TIED!' : `${winningTeam?.name || 'Winner'} VICTORIOUS!`}
          </h2>

          <p className="text-sm font-semibold text-amber-100 mt-0.5">
            {commentary || scorecard.matchResultCommentary || (isTie ? 'Scores level after 5 overs' : 'Victory secured')}
          </p>

          {/* Quick Innings Score Pill */}
          <div className="flex items-center justify-center gap-4 mt-3 text-xs font-bold text-amber-950 bg-white/20 py-1.5 px-4 rounded-full mx-auto max-w-md">
            <span>
              {gameState.teams.TEAM_A.name}: <strong className="text-white font-mono-numbers">{inn1?.runs}/{inn1?.wickets}</strong> ({inn1?.oversCompleted}.{inn1?.ballsInCurrentOver} ov)
            </span>
            <span>vs</span>
            <span>
              {gameState.teams.TEAM_B.name}: <strong className="text-white font-mono-numbers">{inn2 ? `${inn2.runs}/${inn2.wickets}` : 'DNB'}</strong> ({inn2 ? `${inn2.oversCompleted}.${inn2.ballsInCurrentOver}` : '0.0'} ov)
            </span>
          </div>
        </div>

        {/* 2. Tab Navigation */}
        <div className="flex border-b border-white/10 bg-slate-950/60 px-4 shrink-0">
          <button
            onClick={() => setActiveTab('INN_1')}
            className={`px-4 py-3 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 ${
              activeTab === 'INN_1'
                ? 'border-amber-400 text-amber-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>1st Innings: {gameState.teams.TEAM_A.shortCode}</span>
          </button>

          <button
            onClick={() => setActiveTab('INN_2')}
            className={`px-4 py-3 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 ${
              activeTab === 'INN_2'
                ? 'border-amber-400 text-amber-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>2nd Innings: {gameState.teams.TEAM_B.shortCode}</span>
          </button>

          {superOver && (
            <button
              onClick={() => setActiveTab('SUPER_OVER')}
              className={`px-4 py-3 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 ${
                activeTab === 'SUPER_OVER'
                  ? 'border-amber-400 text-amber-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Swords className="w-3.5 h-3.5" />
              <span>Super Over</span>
            </button>
          )}
        </div>

        {/* 3. Scorecard Details Container (Scrollable) */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1 text-slate-200">
          {currentDisplayInnings ? (
            <>
              {/* Batting Scorecard Table */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                    <span>🏏</span> Batting Scorecard
                  </h4>
                  <span className="text-xs text-slate-400 font-mono-numbers">
                    Total: <strong className="text-white text-sm">{currentDisplayInnings.runs}/{currentDisplayInnings.wickets}</strong> ({currentDisplayInnings.oversCompleted}.{currentDisplayInnings.ballsInCurrentOver} ov)
                  </span>
                </div>

                <div className="overflow-x-auto rounded-xl border border-white/10 bg-slate-950/60">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-white/5 text-[10px] uppercase font-bold text-slate-400 border-b border-white/10">
                      <tr>
                        <th className="py-2.5 px-3">Batter</th>
                        <th className="py-2.5 px-3">Dismissal</th>
                        <th className="py-2.5 px-2 text-right">R</th>
                        <th className="py-2.5 px-2 text-right">B</th>
                        <th className="py-2.5 px-2 text-right">4s</th>
                        <th className="py-2.5 px-2 text-right">6s</th>
                        <th className="py-2.5 px-3 text-right">SR</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {currentDisplayInnings.batters.map((b) => (
                        <tr key={b.playerId} className="hover:bg-white/5">
                          <td className="py-2 px-3 font-semibold text-white">
                            {b.playerName}
                          </td>
                          <td className="py-2 px-3 text-slate-400 text-[11px]">
                            {b.dismissalDescription || (b.isOut ? <span className="text-rose-400">Out</span> : <span className="text-emerald-400 font-bold">not out</span>)}
                          </td>
                          <td className="py-2 px-2 text-right font-bold text-amber-300 font-mono-numbers">
                            {b.runs}
                          </td>
                          <td className="py-2 px-2 text-right text-slate-300 font-mono-numbers">
                            {b.ballsFaced}
                          </td>
                          <td className="py-2 px-2 text-right text-slate-300 font-mono-numbers">
                            {b.fours}
                          </td>
                          <td className="py-2 px-2 text-right text-slate-300 font-mono-numbers">
                            {b.sixes}
                          </td>
                          <td className="py-2 px-3 text-right text-slate-400 font-mono-numbers">
                            {b.strikeRate}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Extras & Partnership info */}
                <div className="flex flex-wrap items-center justify-between mt-2 px-3 py-1.5 rounded-lg bg-slate-950/40 border border-white/5 text-[11px] text-slate-400">
                  <div>
                    Extras: <strong className="text-white">{currentDisplayInnings.extras.total}</strong> (w {currentDisplayInnings.extras.wides}, nb {currentDisplayInnings.extras.noBalls}, b {currentDisplayInnings.extras.byes}, lb {currentDisplayInnings.extras.legByes})
                  </div>
                  <div>
                    Run Rate: <strong className="text-emerald-400">{currentDisplayInnings.runRate}</strong>
                  </div>
                </div>
              </div>

              {/* Bowling Scorecard Table */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                    <span>🎯</span> Bowling Figures
                  </h4>
                </div>

                <div className="overflow-x-auto rounded-xl border border-white/10 bg-slate-950/60">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-white/5 text-[10px] uppercase font-bold text-slate-400 border-b border-white/10">
                      <tr>
                        <th className="py-2.5 px-3">Bowler</th>
                        <th className="py-2.5 px-2 text-right">O</th>
                        <th className="py-2.5 px-2 text-right">M</th>
                        <th className="py-2.5 px-2 text-right">R</th>
                        <th className="py-2.5 px-2 text-right">W</th>
                        <th className="py-2.5 px-2 text-right">Dots</th>
                        <th className="py-2.5 px-3 text-right">Econ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {currentDisplayInnings.bowlers.map((b) => (
                        <tr key={b.playerId} className="hover:bg-white/5">
                          <td className="py-2 px-3 font-semibold text-white">
                            {b.playerName}
                          </td>
                          <td className="py-2 px-2 text-right font-mono-numbers">
                            {b.overs}
                          </td>
                          <td className="py-2 px-2 text-right font-mono-numbers">
                            {b.maidens}
                          </td>
                          <td className="py-2 px-2 text-right font-mono-numbers text-rose-300">
                            {b.runsConceded}
                          </td>
                          <td className="py-2 px-2 text-right font-bold text-emerald-400 font-mono-numbers">
                            {b.wickets}
                          </td>
                          <td className="py-2 px-2 text-right font-mono-numbers text-slate-400">
                            {b.dotBalls}
                          </td>
                          <td className="py-2 px-3 text-right text-slate-300 font-mono-numbers">
                            {b.economy}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Fall of Wickets */}
              {currentDisplayInnings.fallOfWickets.length > 0 && (
                <div className="bg-slate-950/60 rounded-xl p-3 border border-white/10 text-xs">
                  <div className="text-[10px] uppercase font-bold text-slate-400 mb-1.5">
                    Fall of Wickets:
                  </div>
                  <div className="flex flex-wrap gap-2 text-slate-300">
                    {currentDisplayInnings.fallOfWickets.map((fow) => (
                      <span key={fow.wicketNumber} className="bg-slate-900 px-2 py-0.5 rounded border border-white/5">
                        <strong className="text-rose-400">{fow.teamScore}/{fow.wicketNumber}</strong> ({fow.batterName}, {fow.overs} ov)
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-10 text-slate-400 text-sm">
              Innings not yet played.
            </div>
          )}
        </div>

        {/* 4. Action Footer: Rematch, Super Over & Lobby */}
        <div className="border-t border-white/10 bg-slate-950/80 p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-400">
            {isHost ? 'Match Host Controls' : 'Waiting for host action...'}
          </div>

          <div className="flex items-center gap-2.5">
            {/* If tied and super over not yet started */}
            {isTie && !superOver && onStartSuperOver && (
              <button
                type="button"
                onClick={onStartSuperOver}
                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white font-bold text-xs shadow-lg active:scale-95 transition-all flex items-center gap-1.5"
              >
                <Swords className="w-4 h-4" />
                <span>Trigger Super Over</span>
              </button>
            )}

            <button
              type="button"
              onClick={onRematch}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-lg active:scale-95 transition-all flex items-center gap-1.5"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Play Rematch</span>
            </button>

            <button
              type="button"
              onClick={onReturnToLobby}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs border border-white/10 shadow active:scale-95 transition-all flex items-center gap-1.5"
            >
              <Home className="w-4 h-4" />
              <span>Return to Lobby</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
