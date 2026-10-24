import React, { useState } from 'react';
import { RoomState, RoomParticipant, TeamId } from '@cricket2026/shared';
import { Users, Copy, Check, Play, Shield, Sparkles } from 'lucide-react';

interface LobbyProps {
  roomState: RoomState | null;
  myParticipant: RoomParticipant | null;
  onCreateRoom: (hostName: string) => Promise<{ success: boolean; roomCode?: string; error?: string }>;
  onJoinRoom: (roomCode: string, name: string) => Promise<{ success: boolean; error?: string }>;
  onClaimSlot: (teamId: TeamId, playerId: string) => void;
  onSetReady: (ready: boolean) => void;
  onStartMatch: () => void;
}

export const RoomLobbyModal: React.FC<LobbyProps> = ({
  roomState,
  myParticipant,
  onCreateRoom,
  onJoinRoom,
  onClaimSlot,
  onSetReady,
  onStartMatch
}) => {
  const [hostNameInput, setHostNameInput] = useState('Captain Virat');
  const [joinNameInput, setJoinNameInput] = useState('Player Steve');
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'CREATE' | 'JOIN'>('CREATE');

  const copyRoomCode = () => {
    if (roomState?.roomCode) {
      navigator.clipboard.writeText(roomState.roomCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!roomState) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
        <div className="w-full max-w-md glass-panel p-6 rounded-3xl border border-white/15 shadow-2xl text-center">
          <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-gradient-to-tr from-amber-500 to-rose-600 flex items-center justify-center shadow-lg shadow-rose-900/40">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-2xl font-black text-white tracking-tight mb-1">Cricket 2026 Arena</h2>
          <p className="text-xs text-slate-400 mb-6">
            Realistic 3D Multiplayer Cricket • 11v11 Positions • 5-Over Matches
          </p>

          <div className="flex rounded-xl bg-slate-900/80 p-1 mb-5 border border-white/10">
            <button
              onClick={() => setActiveTab('CREATE')}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                activeTab === 'CREATE' ? 'bg-amber-400 text-slate-950' : 'text-slate-400 hover:text-white'
              }`}
            >
              Create Private Room
            </button>
            <button
              onClick={() => setActiveTab('JOIN')}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                activeTab === 'JOIN' ? 'bg-amber-400 text-slate-950' : 'text-slate-400 hover:text-white'
              }`}
            >
              Join with Code
            </button>
          </div>

          {activeTab === 'CREATE' ? (
            <div className="space-y-4">
              <div className="text-left">
                <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Your Cricketer Name
                </label>
                <input
                  type="text"
                  value={hostNameInput}
                  onChange={(e) => setHostNameInput(e.target.value)}
                  className="w-full mt-1.5 px-4 py-2.5 bg-slate-900/80 border border-white/10 rounded-xl text-sm font-semibold text-white focus:outline-none focus:border-amber-400"
                  placeholder="e.g. Captain"
                />
              </div>
              <button
                onClick={() => onCreateRoom(hostNameInput)}
                className="w-full py-3 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 active:scale-98 text-slate-950 font-black text-sm rounded-xl transition-all shadow-lg shadow-amber-500/20"
              >
                Create Room (5 Overs)
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="text-left">
                <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Your Cricketer Name
                </label>
                <input
                  type="text"
                  value={joinNameInput}
                  onChange={(e) => setJoinNameInput(e.target.value)}
                  className="w-full mt-1.5 px-4 py-2.5 bg-slate-900/80 border border-white/10 rounded-xl text-sm font-semibold text-white focus:outline-none focus:border-amber-400"
                />
              </div>
              <div className="text-left">
                <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  6-Letter Room Code
                </label>
                <input
                  type="text"
                  maxLength={6}
                  value={joinCodeInput}
                  onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                  className="w-full mt-1.5 px-4 py-2.5 bg-slate-900/80 border border-white/10 rounded-xl text-sm font-mono font-bold tracking-widest text-amber-400 uppercase focus:outline-none focus:border-amber-400"
                  placeholder="e.g. CRK9A2"
                />
              </div>
              <button
                onClick={() => onJoinRoom(joinCodeInput, joinNameInput)}
                className="w-full py-3 bg-blue-600 hover:bg-blue-500 active:scale-98 text-white font-black text-sm rounded-xl transition-all shadow-lg shadow-blue-600/30"
              >
                Join Match
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Active Lobby View
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md">
      <div className="w-full max-w-4xl glass-panel p-6 rounded-3xl border border-white/15 shadow-2xl flex flex-col max-h-[90vh]">
        {/* Lobby Header */}
        <div className="flex flex-wrap items-center justify-between pb-4 border-b border-white/10 gap-3">
          <div>
            <div className="text-xs font-semibold text-amber-400 flex items-center gap-1.5 uppercase tracking-wider">
              <Users className="w-3.5 h-3.5" /> Match Lobby • 5 Overs Per Innings
            </div>
            <h2 className="text-2xl font-black text-white">Select Your Playing XI Position</h2>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={copyRoomCode}
              className="flex items-center gap-2 px-3 py-1.5 bg-slate-800/80 hover:bg-slate-700 rounded-xl border border-white/10 text-xs font-mono font-bold text-amber-300 transition-all"
            >
              <span>{roomState.roomCode}</span>
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
            {myParticipant?.isHost && (
              <button
                onClick={onStartMatch}
                className="flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-black text-xs rounded-xl transition-all shadow-lg shadow-emerald-700/40"
              >
                <Play className="w-4 h-4 fill-current" />
                Start Match
              </button>
            )}
          </div>
        </div>

        {/* 11v11 Team Roster Boards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4 overflow-y-auto">
          {/* Team A */}
          <div className="bg-blue-950/30 border border-blue-500/20 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-black text-blue-300 flex items-center gap-1.5">
                <Shield className="w-4 h-4 text-blue-400" /> Team A (Royal Strikers)
              </span>
              <span className="text-[11px] text-blue-200/70 font-semibold">11 On-Field Roles</span>
            </div>
            <div className="space-y-1.5">
              {Array.from({ length: 11 }).map((_, i) => {
                const playerId = `TEAM_A_player_${i + 1}`;
                const isClaimedByMe = myParticipant?.assignedPlayerId === playerId;
                const occupant = Object.values(roomState.participants).find(
                  (p) => p.assignedPlayerId === playerId
                );

                return (
                  <div
                    key={playerId}
                    onClick={() => onClaimSlot('TEAM_A', playerId)}
                    className={`px-3 py-2 rounded-xl text-xs flex items-center justify-between cursor-pointer transition-all border ${
                      isClaimedByMe
                        ? 'bg-blue-600/40 border-amber-400 text-white font-bold'
                        : occupant
                        ? 'bg-blue-900/20 border-white/10 text-slate-300'
                        : 'bg-slate-900/40 border-dashed border-white/10 text-slate-400 hover:border-blue-400/50'
                    }`}
                  >
                    <span>
                      {i + 1}. {i === 0 ? 'Opener / Keeper' : i === 1 ? 'Opener' : i >= 6 ? 'Bowler' : 'Batter'}
                    </span>
                    <span className="font-semibold">
                      {isClaimedByMe
                        ? '★ You'
                        : occupant
                        ? `👤 ${occupant.displayName}`
                        : '🤖 AI Player'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Team B */}
          <div className="bg-emerald-950/30 border border-emerald-500/20 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-black text-emerald-300 flex items-center gap-1.5">
                <Shield className="w-4 h-4 text-emerald-400" /> Team B (Titans XI)
              </span>
              <span className="text-[11px] text-emerald-200/70 font-semibold">11 On-Field Roles</span>
            </div>
            <div className="space-y-1.5">
              {Array.from({ length: 11 }).map((_, i) => {
                const playerId = `TEAM_B_player_${i + 1}`;
                const isClaimedByMe = myParticipant?.assignedPlayerId === playerId;
                const occupant = Object.values(roomState.participants).find(
                  (p) => p.assignedPlayerId === playerId
                );

                return (
                  <div
                    key={playerId}
                    onClick={() => onClaimSlot('TEAM_B', playerId)}
                    className={`px-3 py-2 rounded-xl text-xs flex items-center justify-between cursor-pointer transition-all border ${
                      isClaimedByMe
                        ? 'bg-emerald-600/40 border-amber-400 text-white font-bold'
                        : occupant
                        ? 'bg-emerald-900/20 border-white/10 text-slate-300'
                        : 'bg-slate-900/40 border-dashed border-white/10 text-slate-400 hover:border-emerald-400/50'
                    }`}
                  >
                    <span>
                      {i + 1}. {i === 0 ? 'Opener / Keeper' : i === 1 ? 'Opener' : i >= 6 ? 'Bowler' : 'Batter'}
                    </span>
                    <span className="font-semibold">
                      {isClaimedByMe
                        ? '★ You'
                        : occupant
                        ? `👤 ${occupant.displayName}`
                        : '🤖 AI Player'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Ready Toggle & Spectator note */}
        <div className="pt-3 border-t border-white/10 flex items-center justify-between text-xs text-slate-400">
          <span>Unoccupied positions are filled by realistic AI cricketers.</span>
          <button
            onClick={() => onSetReady(!myParticipant?.isReady)}
            className={`px-4 py-2 rounded-xl font-bold transition-all ${
              myParticipant?.isReady
                ? 'bg-emerald-500 text-slate-950'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            {myParticipant?.isReady ? '✓ Ready' : 'Set Ready'}
          </button>
        </div>
      </div>
    </div>
  );
};
