import React, { useState } from 'react';
import { X, BookOpen, Shield, Zap, Target, Eye } from 'lucide-react';

interface HowToPlayProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HowToPlayModal: React.FC<HowToPlayProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'RULES' | 'BATTING' | 'BOWLING' | 'DRS'>('RULES');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div className="w-full max-w-2xl glass-panel p-6 rounded-3xl border border-white/15 shadow-2xl flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <BookOpen className="w-5 h-5 text-amber-400" />
            <h2 className="text-xl font-black text-white">How to Play Cricket 2026</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-white/10 text-slate-400 hover:text-white transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2 py-3 border-b border-white/10 overflow-x-auto text-xs font-bold">
          {(['RULES', 'BATTING', 'BOWLING', 'DRS'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3.5 py-1.5 rounded-xl transition-all flex items-center gap-1.5 ${
                activeTab === tab
                  ? 'bg-amber-400 text-slate-950 font-black shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {tab === 'RULES' && <Shield className="w-3.5 h-3.5" />}
              {tab === 'BATTING' && <Zap className="w-3.5 h-3.5" />}
              {tab === 'BOWLING' && <Target className="w-3.5 h-3.5" />}
              {tab === 'DRS' && <Eye className="w-3.5 h-3.5" />}
              {tab === 'RULES'
                ? '5-Over Rules'
                : tab === 'BATTING'
                ? 'Batting Guide'
                : tab === 'BOWLING'
                ? 'Bowling Guide'
                : 'DRS & Umpire'}
            </button>
          ))}
        </div>

        {/* Tab Content Body */}
        <div className="py-4 overflow-y-auto space-y-4 text-xs text-slate-300 flex-1 pr-1">
          {/* RULES TAB */}
          {activeTab === 'RULES' && (
            <div className="space-y-3">
              <div className="p-3.5 rounded-2xl bg-slate-900/70 border border-white/10">
                <h3 className="font-bold text-amber-300 text-sm mb-1">5 Overs Per Innings (T5 Format)</h3>
                <p className="text-slate-300 leading-relaxed">
                  Matches consist of two 5-over innings. Each over consists of 6 legal deliveries. Wides and No-Balls
                  do not count as legal balls and incur a 1-run penalty plus an extra ball.
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-900/70 border border-white/10">
                <h3 className="font-bold text-emerald-300 text-sm mb-1">Bowling Spell Cap</h3>
                <p className="text-slate-300 leading-relaxed">
                  In a 5-over match, no individual bowler may bowl more than <strong>2 overs</strong>. Bowlers cannot bowl
                  consecutive overs from either end.
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-900/70 border border-white/10">
                <h3 className="font-bold text-sky-300 text-sm mb-1">Strike Rotation & Chase</h3>
                <p className="text-slate-300 leading-relaxed">
                  Striker and non-striker rotate ends on odd runs (1, 3, 5) and at the completion of each 6-ball over.
                  The second innings team chases the target (1st Innings Runs + 1). If scores are tied, a 1-over Super Over is played.
                </p>
              </div>
            </div>
          )}

          {/* BATTING TAB */}
          {activeTab === 'BATTING' && (
            <div className="space-y-3">
              <div className="p-3.5 rounded-2xl bg-slate-900/70 border border-blue-500/20">
                <h3 className="font-bold text-blue-300 text-sm mb-1">Precision Sweet-Spot Timing</h3>
                <p className="text-slate-300 leading-relaxed">
                  Watch the ball trajectory as it pitches on the turf. Time your swing as the ball reaches the hitting zone:
                </p>
                <div className="grid grid-cols-3 gap-2 mt-2 text-[11px] font-mono text-center">
                  <div className="p-2 bg-emerald-950/60 border border-emerald-500/30 rounded-xl text-emerald-300">
                    <span className="font-bold">±15ms</span>
                    <div>Sweet Spot (4 / 6)</div>
                  </div>
                  <div className="p-2 bg-blue-950/60 border border-blue-500/30 rounded-xl text-blue-300">
                    <span className="font-bold">±45ms</span>
                    <div>Solid Placement (1-2)</div>
                  </div>
                  <div className="p-2 bg-rose-950/60 border border-rose-500/30 rounded-xl text-rose-300">
                    <span className="font-bold">&gt; ±80ms</span>
                    <div>Mistimed / Wicket</div>
                  </div>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-900/70 border border-white/10">
                <h3 className="font-bold text-amber-300 text-sm mb-1">Grounded vs Lofted Strokes</h3>
                <p className="text-slate-300 leading-relaxed">
                  Toggle <strong>Lofted</strong> mode to hit aerial shots over the infielders. Lofted shots carry higher boundary
                  reward but introduce catching danger if mistimed.
                </p>
              </div>
            </div>
          )}

          {/* BOWLING TAB */}
          {activeTab === 'BOWLING' && (
            <div className="space-y-3">
              <div className="p-3.5 rounded-2xl bg-slate-900/70 border border-emerald-500/20">
                <h3 className="font-bold text-emerald-300 text-sm mb-1">Pace & Variation Control</h3>
                <p className="text-slate-300 leading-relaxed">
                  As the bowler, select your release speed (80 to 155 km/h) and seam orientation.
                  Pace bowlers can generate outswing, inswing, or reverse swing through atmospheric drag.
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-900/70 border border-white/10">
                <h3 className="font-bold text-amber-300 text-sm mb-1">Spin Wizardry</h3>
                <p className="text-slate-300 leading-relaxed">
                  Spin bowlers can deliver Off-breaks, Leg-breaks, Googlies, and Top-spinners. The ball grips the turf
                  and deviates sharply upon pitching.
                </p>
              </div>
            </div>
          )}

          {/* DRS TAB */}
          {activeTab === 'DRS' && (
            <div className="space-y-3">
              <div className="p-3.5 rounded-2xl bg-slate-900/70 border border-indigo-500/20">
                <h3 className="font-bold text-indigo-300 text-sm mb-1">15-Second Review Countdown</h3>
                <p className="text-slate-300 leading-relaxed">
                  Each team receives 1 review per 5-over innings. Following an appeal, the captain or batsman has 15 seconds
                  to trigger DRS.
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-900/70 border border-white/10">
                <h3 className="font-bold text-rose-300 text-sm mb-1">UltraEdge & Hawk-Eye Technology</h3>
                <p className="text-slate-300 leading-relaxed">
                  UltraEdge displays acoustic waveform spikes to confirm bat contact before pad collision.
                  Hawk-Eye computes the 3D projected trajectory to check if the delivery pitches in-line and hits the wickets.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-white/10 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 text-slate-950 font-black text-xs rounded-xl shadow-lg transition-all"
          >
            Got It
          </button>
        </div>
      </div>
    </div>
  );
};
