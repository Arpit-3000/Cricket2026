import React, { useState } from 'react';
import { TossState, TeamId, CoinChoice, TossDecision, TeamPlayingXI } from '@cricket2026/shared';

interface TossModalProps {
  toss: TossState;
  teams: {
    TEAM_A: TeamPlayingXI;
    TEAM_B: TeamPlayingXI;
  };
  isHost: boolean;
  myTeamId?: TeamId | null;
  onCallToss: (choice: CoinChoice) => void;
  onDecideToss: (decision: TossDecision) => void;
  coinFlipping?: boolean;
}

export const TossModal: React.FC<TossModalProps> = ({
  toss,
  teams,
  isHost,
  myTeamId,
  onCallToss,
  onDecideToss,
  coinFlipping = false
}) => {
  const [selectedCall, setSelectedCall] = useState<CoinChoice>('HEADS');

  const teamA = teams.TEAM_A;
  const teamB = teams.TEAM_B;

  const captainA = teamA.players.find(p => p.id === teamA.captainId) || teamA.players[0];
  const captainB = teamB.players.find(p => p.id === teamB.captainId) || teamB.players[0];

  const callerTeamId = toss.callerTeamId || 'TEAM_B';
  const isCaller = myTeamId === callerTeamId || (isHost && !myTeamId);
  const isWinner = toss.winnerTeamId && (myTeamId === toss.winnerTeamId || (isHost && !myTeamId));

  const winningTeam = toss.winnerTeamId ? teams[toss.winnerTeamId] : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-300">
      <div className="relative w-full max-w-2xl bg-gradient-to-b from-slate-900 via-slate-850 to-slate-950 border border-amber-500/30 rounded-2xl shadow-2xl overflow-hidden p-6 text-white">
        
        {/* Glow Header */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-600 animate-pulse" />

        {/* Title */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-bold uppercase tracking-wider mb-2">
            🪙 Official Match Toss • 5 Overs T5
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white via-amber-200 to-amber-400 bg-clip-text text-transparent">
            Captain's Coin Toss
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            {toss.isCompleted
              ? 'Toss completed! Match starting shortly...'
              : toss.winnerTeamId
              ? `${winningTeam?.name} must now decide whether to BAT or BOWL`
              : `${teams[callerTeamId].name} (${toss.callerCaptainName || 'Captain'}) will call the toss`}
          </p>
        </div>

        {/* Captains Face-Off Banner */}
        <div className="grid grid-cols-2 gap-4 mb-8 bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
          {/* Captain A */}
          <div className="flex flex-col items-center text-center p-3 rounded-lg bg-slate-900/40 border border-blue-500/20">
            <div className="relative mb-2">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center font-black text-xl border-2 shadow-lg"
                style={{ backgroundColor: teamA.primaryColor, borderColor: teamA.secondaryColor }}
              >
                {captainA.jerseyNumber}
              </div>
              <span className="absolute -bottom-1 -right-1 bg-amber-500 text-black text-[10px] font-black px-1.5 py-0.5 rounded-full">
                (C)
              </span>
            </div>
            <div className="text-xs uppercase font-bold text-blue-400">{teamA.name}</div>
            <div className="font-bold text-sm text-white">{captainA.displayName}</div>
            <div className="text-[11px] text-slate-400 mt-0.5">{captainA.role}</div>
          </div>

          {/* Captain B */}
          <div className="flex flex-col items-center text-center p-3 rounded-lg bg-slate-900/40 border border-emerald-500/20">
            <div className="relative mb-2">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center font-black text-xl border-2 shadow-lg"
                style={{ backgroundColor: teamB.primaryColor, borderColor: teamB.secondaryColor }}
              >
                {captainB.jerseyNumber}
              </div>
              <span className="absolute -bottom-1 -right-1 bg-amber-500 text-black text-[10px] font-black px-1.5 py-0.5 rounded-full">
                (C)
              </span>
            </div>
            <div className="text-xs uppercase font-bold text-emerald-400">{teamB.name}</div>
            <div className="font-bold text-sm text-white">{captainB.displayName}</div>
            <div className="text-[11px] text-slate-400 mt-0.5">{captainB.role}</div>
          </div>
        </div>

        {/* Central 3D Animated Coin */}
        <div className="flex flex-col items-center justify-center py-4 mb-6">
          <div className="relative w-28 h-28 flex items-center justify-center">
            {/* Spinning Coin Disk with CSS 3D animation */}
            <div
              className={`w-24 h-24 rounded-full border-4 border-amber-400 bg-gradient-to-tr from-amber-600 via-yellow-300 to-amber-500 shadow-[0_0_30px_rgba(245,158,11,0.5)] flex items-center justify-center transition-transform duration-700 ${
                coinFlipping ? 'animate-spin' : ''
              }`}
              style={{
                transformStyle: 'preserve-3d',
                boxShadow: '0 0 25px rgba(245, 158, 11, 0.6), inset 0 0 15px rgba(0,0,0,0.4)'
              }}
            >
              <div className="text-center font-black text-slate-950 tracking-wider">
                <span className="text-2xl block">
                  {toss.coinResult === 'TAILS' ? '🪙 T' : '🪙 H'}
                </span>
                <span className="text-[10px] tracking-widest uppercase">
                  {toss.coinResult || (coinFlipping ? 'FLIPPING' : 'CRICKET')}
                </span>
              </div>
            </div>
          </div>

          {coinFlipping && (
            <div className="text-xs text-amber-300 font-bold tracking-widest uppercase mt-3 animate-pulse">
              Flipping Coin in Mid-Air...
            </div>
          )}
        </div>

        {/* Step 1: Call Toss (Heads or Tails) */}
        {!toss.coinResult && !coinFlipping && (
          <div className="bg-slate-800/80 rounded-xl p-4 border border-slate-700 text-center">
            <div className="text-xs font-semibold text-slate-300 mb-3">
              {isCaller
                ? 'Your turn to call the coin! Select Heads or Tails:'
                : `Waiting for ${teams[callerTeamId].name} (${toss.callerCaptainName || 'Captain'}) to call the toss...`}
            </div>

            {isCaller ? (
              <div className="flex items-center justify-center gap-4">
                <button
                  type="button"
                  onClick={() => setSelectedCall('HEADS')}
                  className={`flex-1 py-3 px-4 rounded-xl font-black text-sm transition-all border ${
                    selectedCall === 'HEADS'
                      ? 'bg-amber-500 text-black border-amber-300 shadow-lg shadow-amber-500/30 scale-105'
                      : 'bg-slate-700/60 text-slate-200 border-slate-600 hover:bg-slate-700'
                  }`}
                >
                  HEADS
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedCall('TAILS')}
                  className={`flex-1 py-3 px-4 rounded-xl font-black text-sm transition-all border ${
                    selectedCall === 'TAILS'
                      ? 'bg-amber-500 text-black border-amber-300 shadow-lg shadow-amber-500/30 scale-105'
                      : 'bg-slate-700/60 text-slate-200 border-slate-600 hover:bg-slate-700'
                  }`}
                >
                  TAILS
                </button>
                <button
                  type="button"
                  onClick={() => onCallToss(selectedCall)}
                  className="py-3 px-6 rounded-xl font-black text-sm bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/20 hover:brightness-110 active:scale-95 transition-all"
                >
                  FLIP COIN
                </button>
              </div>
            ) : (
              <div className="inline-flex items-center gap-2 text-xs text-amber-400 py-2">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                Waiting for toss call...
              </div>
            )}
          </div>
        )}

        {/* Step 2: Winner Decision (Bat or Bowl) */}
        {toss.coinResult && !coinFlipping && !toss.decision && (
          <div className="bg-slate-800/80 rounded-xl p-4 border border-amber-500/40 text-center">
            <div className="inline-block px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 text-xs font-bold mb-2">
              🎉 Toss Winner: {winningTeam?.name} ({toss.winnerTeamId})
            </div>
            <div className="text-sm font-semibold text-white mb-4">
              {isWinner
                ? 'Congratulations! You won the toss. Choose to BAT or BOWL first:'
                : `Waiting for ${winningTeam?.name} to choose whether to BAT or BOWL...`}
            </div>

            {isWinner ? (
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => onDecideToss('BAT')}
                  className="py-3.5 px-4 rounded-xl font-black text-sm bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-lg shadow-blue-500/30 active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  🏏 ELECT TO BAT FIRST
                </button>
                <button
                  type="button"
                  onClick={() => onDecideToss('BOWL')}
                  className="py-3.5 px-4 rounded-xl font-black text-sm bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-lg shadow-emerald-500/30 active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  🎯 ELECT TO BOWL FIRST
                </button>
              </div>
            ) : (
              <div className="inline-flex items-center gap-2 text-xs text-amber-400 py-2">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                Captain is making the decision...
              </div>
            )}
          </div>
        )}

        {/* Step 3: Result Summary */}
        {toss.decision && (
          <div className="bg-gradient-to-r from-slate-900 via-amber-950/40 to-slate-900 border border-amber-500/50 rounded-xl p-4 text-center">
            <div className="text-xs uppercase font-bold tracking-widest text-amber-400 mb-1">
              Match Setup Confirmed
            </div>
            <div className="text-base sm:text-lg font-extrabold text-white">
              {winningTeam?.name} won the toss and elected to{' '}
              <span className="text-amber-300 underline font-black">{toss.decision}</span> first!
            </div>
            <div className="text-xs text-slate-400 mt-2">
              Innings 1 is setting up. Players are walking onto the field...
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
