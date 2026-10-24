import React, { useState, useEffect } from 'react';
import { UmpireSignal, UmpireDecisionEvent } from '@cricket2026/shared';
import { CameraViewMode } from '../3d/CricketStadiumScene.js';

interface UmpireOverlayProps {
  isManualUmpire: boolean;
  manualUmpireName?: string | null;
  umpirePrompt: {
    signalType: string;
    deadlineMs: number;
    timeoutSeconds: number;
  } | null;
  lastUmpireSignal: UmpireDecisionEvent | null;
  onSendSignal: (signal: UmpireSignal, reason: string) => void;
  matchContext?: {
    battingTeam?: string;
    bowlingTeam?: string;
    score?: string;
    overs?: string;
    striker?: string;
    bowler?: string;
    target?: number;
  };
  onSwitchCamera?: (mode: CameraViewMode) => void;
}

export const UmpireOverlay: React.FC<UmpireOverlayProps> = ({
  isManualUmpire,
  manualUmpireName,
  umpirePrompt,
  lastUmpireSignal,
  onSendSignal,
  matchContext,
  onSwitchCamera
}) => {
  const [secondsLeft, setSecondsLeft] = useState<number>(10);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  useEffect(() => {
    if (!umpirePrompt) {
      setIsSubmitting(false);
      return;
    }

    setIsSubmitting(false);
    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((umpirePrompt.deadlineMs - Date.now()) / 1000));
      setSecondsLeft(remaining);
    }, 200);

    return () => clearInterval(interval);
  }, [umpirePrompt]);

  const handleDecision = (signal: UmpireSignal, reason: string) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    onSendSignal(signal, reason);
  };

  return (
    <>
      {/* 1. Decision Broadcast Popup (Visible to All Players) */}
      {lastUmpireSignal && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-50 pointer-events-none animate-in zoom-in-95 duration-300">
          <div className="px-6 py-3 rounded-2xl bg-gradient-to-r from-slate-900 via-amber-950 to-slate-900 border-2 border-amber-400 shadow-[0_0_40px_rgba(245,158,11,0.6)] text-center text-white">
            <div className="text-[11px] uppercase tracking-widest text-amber-300 font-bold mb-0.5">
              {lastUmpireSignal.isAiDecision ? '🤖 AI UMPIRE DECISION' : '👤 MANUAL UMPIRE CALL'}
            </div>
            <div className="text-2xl sm:text-3xl font-black tracking-wider text-amber-400">
              {lastUmpireSignal.signal === 'OUT' && '☝️ OUT!'}
              {lastUmpireSignal.signal === 'NOT_OUT' && '🙅 NOT OUT'}
              {lastUmpireSignal.signal === 'WIDE' && '↔️ WIDE BALL'}
              {lastUmpireSignal.signal === 'NO_BALL' && '🚫 NO BALL (FREE HIT)'}
              {lastUmpireSignal.signal === 'FOUR' && '🌊 FOUR RUNS!'}
              {lastUmpireSignal.signal === 'SIX' && '🚀 SIX RUNS!'}
              {lastUmpireSignal.signal === 'DEAD_BALL' && '🛑 DEAD BALL'}
              {!['OUT', 'NOT_OUT', 'WIDE', 'NO_BALL', 'FOUR', 'SIX', 'DEAD_BALL'].includes(lastUmpireSignal.signal) &&
                `📢 ${lastUmpireSignal.signal}`}
            </div>
            <div className="text-xs text-slate-300 mt-1 italic">
              {lastUmpireSignal.reason}
            </div>
          </div>
        </div>
      )}

      {/* 2. Adjudication Prompt (Active Review) */}
      {umpirePrompt && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
          <div className="w-full max-w-xl bg-slate-900/95 border-2 border-amber-500 rounded-3xl shadow-[0_0_50px_rgba(245,158,11,0.3)] p-6 text-white text-center">
            
            {/* Header: Countdown indicator */}
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                <span>⚖️</span> Official Match Adjudication
              </span>
              <span className={`text-xs font-mono font-bold px-2.5 py-1 rounded-full ${
                secondsLeft <= 3 ? 'bg-rose-500/30 text-rose-300 animate-ping' : 'bg-amber-500/20 text-amber-300'
              }`}>
                ⏱ {secondsLeft}s left
              </span>
            </div>

            {/* Progress bar */}
            <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden mb-4">
              <div
                className="h-full bg-gradient-to-r from-amber-500 to-rose-500 transition-all duration-200"
                style={{ width: `${(secondsLeft / umpirePrompt.timeoutSeconds) * 100}%` }}
              />
            </div>

            {/* Event title */}
            <h3 className="text-2xl font-black mb-1.5 text-white">
              Decision Under Review: <span className="text-amber-400">{umpirePrompt.signalType}</span>
            </h3>

            {/* Match Context Strip */}
            {matchContext && (
              <div className="bg-slate-950/80 rounded-xl p-2.5 mb-4 border border-white/10 flex flex-wrap items-center justify-center gap-3 text-xs text-slate-300">
                {matchContext.score && <div>Score: <strong className="text-white">{matchContext.score}</strong></div>}
                {matchContext.overs && <div>Overs: <strong className="text-amber-400">{matchContext.overs}</strong></div>}
                {matchContext.striker && <div>Striker: <strong className="text-white">{matchContext.striker}</strong></div>}
                {matchContext.bowler && <div>Bowler: <strong className="text-emerald-400">{matchContext.bowler}</strong></div>}
                {matchContext.target && <div>Target: <strong className="text-amber-300">{matchContext.target}</strong></div>}
              </div>
            )}

            {/* Available Replay & Camera Angles for Review */}
            {onSwitchCamera && (
              <div className="mb-4">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Available Camera & Replay Views:
                </div>
                <div className="flex items-center justify-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => onSwitchCamera('REPLAY')}
                    className="px-2.5 py-1 text-xs rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold border border-white/10 transition-all active:scale-95"
                  >
                    🎥 Crease Replay
                  </button>
                  <button
                    type="button"
                    onClick={() => onSwitchCamera('BATTING')}
                    className="px-2.5 py-1 text-xs rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold border border-white/10 transition-all active:scale-95"
                  >
                    🏏 Striker Cam
                  </button>
                  <button
                    type="button"
                    onClick={() => onSwitchCamera('BOWLING')}
                    className="px-2.5 py-1 text-xs rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold border border-white/10 transition-all active:scale-95"
                  >
                    🎯 Bowler Mark
                  </button>
                  <button
                    type="button"
                    onClick={() => onSwitchCamera('BROADCAST')}
                    className="px-2.5 py-1 text-xs rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold border border-white/10 transition-all active:scale-95"
                  >
                    📺 Broadcast
                  </button>
                </div>
              </div>
            )}

            {isManualUmpire ? (
              <div>
                <p className="text-xs text-slate-400 mb-3">
                  You are the authorized Match Umpire. Adjudicate before the deadline or the match will safely auto-resolve.
                </p>

                {/* Permitted decision buttons */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => handleDecision('OUT', 'Umpire raises finger: Batter is OUT')}
                    className="p-3 rounded-xl font-black text-sm bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white shadow active:scale-95 transition-all"
                  >
                    ☝️ OUT
                  </button>
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => handleDecision('NOT_OUT', 'Umpire signals: NOT OUT')}
                    className="p-3 rounded-xl font-black text-sm bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white shadow active:scale-95 transition-all"
                  >
                    🙅 NOT OUT
                  </button>
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => handleDecision('WIDE', 'Umpire signals: Wide Ball')}
                    className="p-3 rounded-xl font-black text-sm bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white shadow active:scale-95 transition-all"
                  >
                    ↔️ WIDE
                  </button>
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => handleDecision('NO_BALL', 'Umpire signals: No Ball (Free Hit)')}
                    className="p-3 rounded-xl font-black text-sm bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white shadow active:scale-95 transition-all"
                  >
                    🚫 NO BALL
                  </button>
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => handleDecision('FOUR', 'Umpire signals: Four Runs')}
                    className="p-3 rounded-xl font-black text-sm bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white shadow active:scale-95 transition-all"
                  >
                    🌊 FOUR
                  </button>
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => handleDecision('SIX', 'Umpire signals: Six Runs (Maximum)')}
                    className="p-3 rounded-xl font-black text-sm bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white shadow active:scale-95 transition-all"
                  >
                    🚀 SIX
                  </button>
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => handleDecision('DEAD_BALL', 'Umpire signals: Dead Ball')}
                    className="p-3 rounded-xl font-black text-sm bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white shadow active:scale-95 transition-all"
                  >
                    🛑 DEAD BALL
                  </button>
                  <div className="p-3 rounded-xl text-xs font-semibold bg-slate-950/40 text-slate-400 flex items-center justify-center border border-white/5">
                    {isSubmitting ? 'Submitting...' : '🔒 Server-Verified'}
                  </div>
                </div>

                <div className="text-[11px] text-slate-400 bg-slate-950/70 p-2.5 rounded-xl border border-slate-800 text-left space-y-1">
                  <div>🔒 <strong>Server Authority:</strong> Umpires submit official decisions only; server rules engine updates scores & dismissals.</div>
                  <div>🛡️ <strong>Disconnect Policy:</strong> If the umpire disconnects, match automatically falls back to AI Umpire with zero game state lost. Reconnect within 30s restores umpire authority.</div>
                </div>
              </div>
            ) : (
              <div className="py-6">
                <div className="inline-flex items-center gap-2 text-sm text-amber-300 font-semibold mb-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
                  Waiting for {manualUmpireName || 'Manual Umpire'} to adjudicate...
                </div>
                <p className="text-xs text-slate-400">
                  If no call is made within {secondsLeft} seconds, the match safely falls back to the Automated AI Umpire.
                </p>
              </div>
            )}

          </div>
        </div>
      )}
    </>
  );
};
