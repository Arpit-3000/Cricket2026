import React from 'react';
import { PlusCircle, LogIn, Target, Sliders, BookOpen, Wifi, Play, Trophy } from 'lucide-react';

interface HomeScreenProps {
  isConnected: boolean;
  pingMs: number;
  onPlayMatch: () => void;
  onStartPractice: () => void;
  onCreateRoomClick: () => void;
  onJoinRoomClick: () => void;
  onOpenSettings: () => void;
  onOpenHowToPlay: () => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  isConnected,
  pingMs,
  onPlayMatch,
  onStartPractice,
  onCreateRoomClick,
  onJoinRoomClick,
  onOpenSettings,
  onOpenHowToPlay
}) => {
  return (
    <div className="absolute inset-0 z-30 flex flex-col justify-between p-6 md:p-10 pointer-events-none select-none bg-gradient-to-t from-slate-950/80 via-transparent to-slate-950/70">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between pointer-events-auto">
        {/* Game Brand Logo */}
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-rose-700 via-rose-600 to-amber-500 flex items-center justify-center shadow-lg shadow-rose-900/40 border border-white/20">
            <span className="text-xl font-black text-white">🏏</span>
          </div>
          <div>
            <div className="text-xl font-black tracking-tight text-white flex items-center gap-2">
              CRICKET <span className="text-amber-400">2026</span>
            </div>
            <div className="text-[10px] uppercase font-bold tracking-widest text-slate-400">
              Realistic 3D Arena
            </div>
          </div>
        </div>

        {/* Status Pill & Header Actions */}
        <div className="flex items-center gap-2.5">
          <div className="glass-panel px-3 py-1.5 rounded-xl border border-white/10 flex items-center gap-2 text-xs font-semibold text-slate-300">
            <div
              className={`w-2.5 h-2.5 rounded-full ${
                isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
              }`}
            />
            <span className="hidden sm:inline">
              {isConnected ? 'Server Online' : 'Connecting Server...'}
            </span>
            {isConnected && (
              <span className="text-emerald-400 font-mono text-[11px] flex items-center gap-1">
                <Wifi className="w-3 h-3" /> {pingMs}ms
              </span>
            )}
          </div>

          <button
            onClick={onOpenHowToPlay}
            className="glass-panel px-3 py-2 rounded-xl border border-white/10 hover:border-white/30 text-xs font-bold text-slate-300 hover:text-white transition-all flex items-center gap-1.5 shadow-md"
          >
            <BookOpen className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden md:inline">How to Play</span>
          </button>

          <button
            onClick={onOpenSettings}
            className="glass-panel p-2 rounded-xl border border-white/10 hover:border-white/30 text-slate-300 hover:text-white transition-all shadow-md"
            title="Settings"
          >
            <Sliders className="w-4 h-4 text-slate-300" />
          </button>
        </div>
      </div>

      {/* Center Hero Card & Action Grid */}
      <div className="max-w-xl mx-auto w-full pointer-events-auto my-auto text-center">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-amber-500/10 border border-amber-400/30 text-[11px] font-bold text-amber-300 uppercase tracking-wider mb-3">
          <span>★</span> Televised Match Experience
        </div>

        <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight mb-2 drop-shadow-md">
          Step Onto the Pitch
        </h1>
        <p className="text-xs sm:text-sm text-slate-300 mb-8 max-w-md mx-auto leading-relaxed">
          Five overs per innings • 11 on-field positions • AI backfill • Synchronized multiplayer & spectator cameras.
        </p>

        {/* Primary Play Match Action */}
        <button
          onClick={onPlayMatch}
          className="w-full mb-3.5 p-4 rounded-2xl border border-amber-400/50 bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 active:scale-98 text-slate-950 font-black shadow-xl shadow-amber-500/25 flex items-center justify-between group transition-all"
        >
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl bg-slate-950/20 flex items-center justify-center text-slate-950 group-hover:scale-110 transition-transform">
              <Play className="w-5 h-5 fill-current" />
            </span>
            <div className="text-left">
              <div className="text-sm font-black tracking-tight text-slate-950">PLAY MATCH (5 OVERS)</div>
              <div className="text-[11px] font-semibold text-slate-900/80">
                Authoritative match with full 11v11 field, DRS & live scorecard
              </div>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-950/15 text-xs font-bold text-slate-950">
            <Trophy className="w-4 h-4" /> Instant
          </div>
        </button>

        {/* Action Buttons Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-left">
          {/* Practice Mode / Stadium Tour */}
          <button
            onClick={onStartPractice}
            className="glass-panel p-4 rounded-2xl border border-emerald-500/30 hover:border-emerald-400/60 bg-gradient-to-br from-emerald-950/40 to-slate-900/80 hover:from-emerald-950/60 transition-all active:scale-98 shadow-xl group"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 group-hover:scale-110 transition-transform">
                <Target className="w-5 h-5" />
              </span>
              <span className="text-[10px] font-black uppercase text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                Solo / Tour
              </span>
            </div>
            <div className="font-black text-sm text-white mb-0.5">Practice Nets & Stadium</div>
            <div className="text-[11px] text-slate-400">
              Explore 3D stadium, switch all 5 cameras, test bowling & batting.
            </div>
          </button>

          {/* Create Private Match */}
          <button
            onClick={onCreateRoomClick}
            className="glass-panel p-4 rounded-2xl border border-amber-500/30 hover:border-amber-400/60 bg-gradient-to-br from-amber-950/40 to-slate-900/80 hover:from-amber-950/60 transition-all active:scale-98 shadow-xl group"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="p-2 rounded-xl bg-amber-500/20 text-amber-400 group-hover:scale-110 transition-transform">
                <PlusCircle className="w-5 h-5" />
              </span>
              <span className="text-[10px] font-black uppercase text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                5 Overs
              </span>
            </div>
            <div className="font-black text-sm text-white mb-0.5">Create Private Room</div>
            <div className="text-[11px] text-slate-400">
              Host friends with shareable 6-digit code and custom pitch type.
            </div>
          </button>

          {/* Join with Code */}
          <button
            onClick={onJoinRoomClick}
            className="glass-panel p-4 rounded-2xl border border-blue-500/30 hover:border-blue-400/60 bg-gradient-to-br from-blue-950/40 to-slate-900/80 hover:from-blue-950/60 transition-all active:scale-98 shadow-xl group"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="p-2 rounded-xl bg-blue-500/20 text-blue-400 group-hover:scale-110 transition-transform">
                <LogIn className="w-5 h-5" />
              </span>
              <span className="text-[10px] font-black uppercase text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
                Join
              </span>
            </div>
            <div className="font-black text-sm text-white mb-0.5">Join Friend's Match</div>
            <div className="text-[11px] text-slate-400">
              Enter 6-letter room code to claim your spot in the playing XI.
            </div>
          </button>

          {/* How to Play Manual */}
          <button
            onClick={onOpenHowToPlay}
            className="glass-panel p-4 rounded-2xl border border-purple-500/30 hover:border-purple-400/60 bg-gradient-to-br from-purple-950/40 to-slate-900/80 hover:from-purple-950/60 transition-all active:scale-98 shadow-xl group"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="p-2 rounded-xl bg-purple-500/20 text-purple-400 group-hover:scale-110 transition-transform">
                <BookOpen className="w-5 h-5" />
              </span>
              <span className="text-[10px] font-black uppercase text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">
                Guide
              </span>
            </div>
            <div className="font-black text-sm text-white mb-0.5">Rules & Controls Manual</div>
            <div className="text-[11px] text-slate-400">
              Learn batting sweet spots, pace/spin bowling, and DRS appeals.
            </div>
          </button>
        </div>
      </div>

      {/* Bottom Footer Telemetry */}
      <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-400 font-medium pointer-events-auto gap-2 border-t border-white/5 pt-4">
        <div>
          Phase 1: <span className="text-emerald-400 font-bold">3D Stadium & Broadcast UI Active</span>
        </div>
        <div className="flex items-center gap-4">
          <span>5 Overs Per Innings</span>
          <span>•</span>
          <span>11v11 Playing XI</span>
          <span>•</span>
          <span>30Hz Physics Loop</span>
        </div>
      </div>
    </div>
  );
};
