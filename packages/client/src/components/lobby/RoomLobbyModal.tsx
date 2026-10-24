import React, { useState } from 'react';
import {
  RoomState,
  RoomParticipant,
  RoomSettings,
  TeamId,
  CRICKET_RULES
} from '@cricket2026/shared';
import {
  Users,
  Copy,
  Check,
  Play,
  Shield,
  Sparkles,
  ArrowLeft,
  Wifi,
  Settings2,
  LogOut,
  AlertTriangle,
  UserCheck,
  Clock,
  Radio
} from 'lucide-react';

interface LobbyProps {
  roomState: RoomState | null;
  myParticipant: RoomParticipant | null;
  pingMs?: number;
  onCreateRoom: (hostName: string, settings?: Partial<RoomSettings>) => Promise<{ success: boolean; roomCode?: string; error?: string }>;
  onJoinRoom: (roomCode: string, name: string) => Promise<{ success: boolean; error?: string }>;
  onClaimSlot: (teamId: TeamId, playerId: string) => void;
  onReleaseSlot?: () => void;
  onUpdateSettings?: (settings: Partial<RoomSettings>) => void;
  onSetReady: (ready: boolean) => void;
  onStartMatch: () => void;
  onLeaveRoom?: () => void;
  onClose?: () => void;
  initialMode?: 'CREATE' | 'JOIN';
  errorNotification?: { code: string; message: string } | null;
  onOpenLineupCustomizer?: (teamId: TeamId) => void;
  onAssignUmpire?: (umpireSocketId: string | null, mode?: 'AI_AUTOMATION' | 'MANUAL_HUMAN') => Promise<any>;
}

export const RoomLobbyModal: React.FC<LobbyProps> = ({
  roomState,
  myParticipant,
  pingMs = 0,
  onCreateRoom,
  onJoinRoom,
  onClaimSlot,
  onReleaseSlot,
  onUpdateSettings,
  onSetReady,
  onStartMatch,
  onLeaveRoom,
  onClose,
  initialMode = 'CREATE',
  errorNotification,
  onOpenLineupCustomizer,
  onAssignUmpire
}) => {
  const [hostNameInput, setHostNameInput] = useState('Captain Virat');
  const [joinNameInput, setJoinNameInput] = useState('Player Steve');
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'CREATE' | 'JOIN'>(initialMode);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showSettingsDrawer, setShowSettingsDrawer] = useState(false);

  // Match settings setup state for room creator
  const [selectedOvers, setSelectedOvers] = useState<number>(5);
  const [minPlayersPerTeam, setMinPlayersPerTeam] = useState<number>(1);
  const [pitchCondition, setPitchCondition] = useState<RoomSettings['pitchCondition']>('HARD_TURF');
  const [atmosphere, setAtmosphere] = useState<RoomSettings['atmosphere']>('FLOODLIGHT_NIGHT');
  const [aiDifficulty, setAiDifficulty] = useState<RoomSettings['aiDifficulty']>('STANDARD');

  const copyRoomCode = () => {
    if (roomState?.roomCode) {
      navigator.clipboard.writeText(roomState.roomCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCreate = async () => {
    setErrorMessage(null);
    const res = await onCreateRoom(hostNameInput, {
      maxOversPerInnings: selectedOvers,
      minPlayersPerTeam,
      pitchCondition,
      atmosphere,
      aiDifficulty,
      isPrivate: true,
      allowSpectators: true
    });
    if (!res.success && res.error) {
      setErrorMessage(res.error);
    }
  };

  const handleJoin = async () => {
    setErrorMessage(null);
    const code = joinCodeInput.trim().toUpperCase();
    if (code.length !== 6) {
      setErrorMessage('Room code must be exactly 6 alphanumeric characters.');
      return;
    }
    const res = await onJoinRoom(code, joinNameInput);
    if (!res.success && res.error) {
      setErrorMessage(res.error);
    }
  };

  const handleSaveSettings = () => {
    if (onUpdateSettings) {
      onUpdateSettings({
        maxOversPerInnings: selectedOvers,
        minPlayersPerTeam,
        pitchCondition,
        atmosphere,
        aiDifficulty
      });
      setShowSettingsDrawer(false);
    }
  };

  // Pre-join Room Setup Modal
  if (!roomState) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fadeIn">
        <div className="w-full max-w-md glass-panel p-6 rounded-3xl border border-white/15 shadow-2xl text-center relative max-h-[92vh] overflow-y-auto">
          {onClose && (
            <button
              onClick={onClose}
              className="absolute top-5 left-5 p-1.5 rounded-xl hover:bg-white/10 text-slate-400 hover:text-white transition-all flex items-center gap-1 text-xs font-semibold"
            >
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
          )}

          <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-gradient-to-tr from-amber-500 to-rose-600 flex items-center justify-center shadow-lg shadow-rose-900/40">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-2xl font-black text-white tracking-tight mb-1">Cricket 2026 Arena</h2>
          <p className="text-xs text-slate-400 mb-6">
            Real-Time Multiplayer Rooms • 11v11 Playing XI • Minimum 1 Player/Team
          </p>

          <div className="flex rounded-xl bg-slate-900/80 p-1 mb-5 border border-white/10">
            <button
              onClick={() => {
                setActiveTab('CREATE');
                setErrorMessage(null);
              }}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                activeTab === 'CREATE' ? 'bg-amber-400 text-slate-950' : 'text-slate-400 hover:text-white'
              }`}
            >
              Create Private Room
            </button>
            <button
              onClick={() => {
                setActiveTab('JOIN');
                setErrorMessage(null);
              }}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                activeTab === 'JOIN' ? 'bg-amber-400 text-slate-950' : 'text-slate-400 hover:text-white'
              }`}
            >
              Join with Code
            </button>
          </div>

          {(errorMessage || errorNotification) && (
            <div className="mb-4 p-2.5 rounded-xl bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs font-semibold text-left flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
              <span>{errorMessage || errorNotification?.message}</span>
            </div>
          )}

          {activeTab === 'CREATE' ? (
            <div className="space-y-4 text-left">
              <div>
                <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Your Cricketer Name
                </label>
                <input
                  type="text"
                  value={hostNameInput}
                  onChange={(e) => setHostNameInput(e.target.value)}
                  className="w-full mt-1.5 px-4 py-2.5 bg-slate-900/80 border border-white/10 rounded-xl text-sm font-semibold text-white focus:outline-none focus:border-amber-400"
                  placeholder="e.g. Captain Virat"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Overs Per Innings
                  </label>
                  <select
                    value={selectedOvers}
                    onChange={(e) => setSelectedOvers(Number(e.target.value))}
                    className="w-full mt-1.5 px-3 py-2 bg-slate-900 border border-white/10 rounded-xl text-xs font-semibold text-white focus:outline-none focus:border-amber-400"
                  >
                    <option value={2}>2 Overs (Blitz)</option>
                    <option value={5}>5 Overs (Standard T5)</option>
                    <option value={10}>10 Overs (T10)</option>
                    <option value={20}>20 Overs (T20)</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Min Players / Team
                  </label>
                  <select
                    value={minPlayersPerTeam}
                    onChange={(e) => setMinPlayersPerTeam(Number(e.target.value))}
                    className="w-full mt-1.5 px-3 py-2 bg-slate-900 border border-white/10 rounded-xl text-xs font-semibold text-white focus:outline-none focus:border-amber-400"
                  >
                    <option value={1}>1 Player (1v1 PvP)</option>
                    <option value={2}>2 Players</option>
                    <option value={3}>3 Players</option>
                    <option value={5}>5 Players</option>
                    <option value={11}>11 Players (Full Human XI)</option>
                  </select>
                </div>
              </div>

              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-[11px] text-amber-200/90 leading-relaxed">
                ℹ️ <strong>Documented Minimum:</strong> Requires {minPlayersPerTeam} human per team to start. The remaining vacant slots up to 11 are automatically fielded by AI cricketers.
              </div>

              <button
                onClick={handleCreate}
                className="w-full py-3 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 active:scale-98 text-slate-950 font-black text-sm rounded-xl transition-all shadow-lg shadow-amber-500/20 cursor-pointer"
              >
                Create Private Room
              </button>
            </div>
          ) : (
            <div className="space-y-4 text-left">
              <div>
                <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Your Cricketer Name
                </label>
                <input
                  type="text"
                  value={joinNameInput}
                  onChange={(e) => setJoinNameInput(e.target.value)}
                  className="w-full mt-1.5 px-4 py-2.5 bg-slate-900/80 border border-white/10 rounded-xl text-sm font-semibold text-white focus:outline-none focus:border-amber-400"
                  placeholder="e.g. Player Steve"
                />
              </div>
              <div>
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
                onClick={handleJoin}
                className="w-full py-3 bg-blue-600 hover:bg-blue-500 active:scale-98 text-white font-black text-sm rounded-xl transition-all shadow-lg shadow-blue-600/30 cursor-pointer"
              >
                Join Room
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Active Lobby State Calculations
  const participantsList = Object.values(roomState.participants);
  const activeParticipants = participantsList.filter((p) => !p.isDisconnected);
  const minRequired = roomState.settings.minPlayersPerTeam ?? CRICKET_RULES.MIN_PLAYERS_PER_TEAM;

  const teamAHumans = activeParticipants.filter(
    (p) => p.assignedTeamId === 'TEAM_A' && p.assignedPlayerId
  );
  const teamBHumans = activeParticipants.filter(
    (p) => p.assignedTeamId === 'TEAM_B' && p.assignedPlayerId
  );

  const teamASatisfied = teamAHumans.length >= minRequired;
  const teamBSatisfied = teamBHumans.length >= minRequired;
  const allHumanReady = activeParticipants.every((p) => !p.assignedPlayerId || p.isReady);
  const canStartMatch = teamASatisfied && teamBSatisfied && allHumanReady;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-slate-950/85 backdrop-blur-md animate-fadeIn">
      <div className="w-full max-w-5xl glass-panel p-5 md:p-6 rounded-3xl border border-white/15 shadow-2xl flex flex-col max-h-[94vh]">
        {/* Lobby Header */}
        <div className="flex flex-wrap items-center justify-between pb-4 border-b border-white/10 gap-3">
          <div className="flex items-center gap-3">
            {onLeaveRoom && (
              <button
                onClick={onLeaveRoom}
                className="p-2 rounded-xl bg-slate-800/80 hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 border border-white/10 transition-all flex items-center gap-1.5 text-xs font-semibold cursor-pointer"
                title="Leave room"
              >
                <LogOut className="w-4 h-4" /> Leave
              </button>
            )}
            <div>
              <div className="text-xs font-semibold text-amber-400 flex items-center gap-1.5 uppercase tracking-wider">
                <Radio className="w-3.5 h-3.5 animate-pulse text-emerald-400" />
                Multiplayer Room • {roomState.settings.maxOversPerInnings} Overs • {roomState.settings.atmosphere.replace('_', ' ')}
              </div>
              <h2 className="text-xl md:text-2xl font-black text-white">Playing XI Position Selection</h2>
            </div>
          </div>

          <div className="flex items-center gap-2 md:gap-3">
            <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-mono font-semibold glass-panel px-2.5 py-1 rounded-xl">
              <Wifi className="w-3.5 h-3.5" /> {pingMs}ms
            </div>

            <button
              onClick={copyRoomCode}
              className="flex items-center gap-2 px-3 py-1.5 bg-slate-800/80 hover:bg-slate-700 rounded-xl border border-white/10 text-xs font-mono font-bold text-amber-300 transition-all shadow-md cursor-pointer"
              title="Copy shareable room code"
            >
              <span>{roomState.roomCode}</span>
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>

            {myParticipant?.isHost && (
              <>
                <button
                  onClick={() => setShowSettingsDrawer(!showSettingsDrawer)}
                  className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-white/10 text-slate-300 hover:text-white transition-all cursor-pointer"
                  title="Configure Match Settings"
                >
                  <Settings2 className="w-4 h-4" />
                </button>

                <button
                  onClick={onStartMatch}
                  disabled={!canStartMatch}
                  className={`flex items-center gap-2 px-4 py-2 font-black text-xs rounded-xl transition-all shadow-lg ${
                    canStartMatch
                      ? 'bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white shadow-emerald-700/40 cursor-pointer animate-pulse'
                      : 'bg-slate-800 text-slate-500 border border-white/5 cursor-not-allowed'
                  }`}
                  title={
                    !teamASatisfied || !teamBSatisfied
                      ? `Requires at least ${minRequired} player(s) on both Team A & Team B to start`
                      : !allHumanReady
                      ? 'Waiting for all human players to set Ready'
                      : 'Start Match'
                  }
                >
                  <Play className="w-4 h-4 fill-current" />
                  Start Match
                </button>
              </>
            )}
          </div>
        </div>

        {/* Host Settings Config Panel (Toggleable) */}
        {showSettingsDrawer && myParticipant?.isHost && (
          <div className="my-3 p-4 bg-slate-900/90 border border-amber-400/30 rounded-2xl animate-fadeIn text-xs">
            <div className="font-bold text-amber-300 mb-2 flex items-center justify-between">
              <span>Match Configuration (Host Only)</span>
              <button
                onClick={handleSaveSettings}
                className="px-3 py-1 bg-amber-400 text-slate-950 font-black rounded-lg hover:bg-amber-300 cursor-pointer"
              >
                Apply Settings
              </button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-slate-300">
              <div>
                <label className="block text-[10px] text-slate-400 uppercase">Overs</label>
                <select
                  value={selectedOvers}
                  onChange={(e) => setSelectedOvers(Number(e.target.value))}
                  className="w-full mt-1 px-2 py-1.5 bg-slate-950 border border-white/10 rounded-lg text-white"
                >
                  <option value={2}>2 Overs</option>
                  <option value={5}>5 Overs</option>
                  <option value={10}>10 Overs</option>
                  <option value={20}>20 Overs</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] text-slate-400 uppercase">Min Players / Team</label>
                <select
                  value={minPlayersPerTeam}
                  onChange={(e) => setMinPlayersPerTeam(Number(e.target.value))}
                  className="w-full mt-1 px-2 py-1.5 bg-slate-950 border border-white/10 rounded-lg text-white"
                >
                  <option value={1}>1 Player (1v1 PvP)</option>
                  <option value={2}>2 Players</option>
                  <option value={3}>3 Players</option>
                  <option value={5}>5 Players</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] text-slate-400 uppercase">Pitch Condition</label>
                <select
                  value={pitchCondition}
                  onChange={(e) => setPitchCondition(e.target.value as any)}
                  className="w-full mt-1 px-2 py-1.5 bg-slate-950 border border-white/10 rounded-lg text-white"
                >
                  <option value="HARD_TURF">Hard Turf (High Bounce)</option>
                  <option value="DUSTY_SPINNER">Dusty (Heavy Spin)</option>
                  <option value="GREEN_SEAMER">Green Seamer (Seam / Carry)</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] text-slate-400 uppercase">Atmosphere</label>
                <select
                  value={atmosphere}
                  onChange={(e) => setAtmosphere(e.target.value as any)}
                  className="w-full mt-1 px-2 py-1.5 bg-slate-950 border border-white/10 rounded-lg text-white"
                >
                  <option value="FLOODLIGHT_NIGHT">Floodlight Night</option>
                  <option value="DAY_SUNNY">Day Sunny</option>
                  <option value="OVERCAST">Overcast</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] text-slate-400 uppercase">AI Difficulty</label>
                <select
                  value={aiDifficulty}
                  onChange={(e) => setAiDifficulty(e.target.value as any)}
                  className="w-full mt-1 px-2 py-1.5 bg-slate-950 border border-white/10 rounded-lg text-white"
                >
                  <option value="ROOKIE">Rookie</option>
                  <option value="STANDARD">Standard</option>
                  <option value="PRO">Pro</option>
                  <option value="LEGEND">Legend</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] text-slate-400 uppercase">Umpire Mode</label>
                <select
                  value={roomState?.settings.umpireMode || 'AI_AUTOMATION'}
                  disabled={!myParticipant?.isHost}
                  onChange={(e) => {
                    const mode = e.target.value as any;
                    if (onAssignUmpire) {
                      const firstSocket = Object.keys(roomState?.participants || {})[0] || null;
                      onAssignUmpire(mode === 'MANUAL_HUMAN' ? firstSocket : null, mode);
                    }
                  }}
                  className="w-full mt-1 px-2 py-1.5 bg-slate-950 border border-white/10 rounded-lg text-white"
                >
                  <option value="AI_AUTOMATION">🤖 Automated AI Umpire</option>
                  <option value="MANUAL_HUMAN">👤 Manual Human Umpire</option>
                </select>
              </div>

              {roomState?.settings.umpireMode === 'MANUAL_HUMAN' && (
                <div>
                  <label className="block text-[10px] text-slate-400 uppercase">Assign Umpire Participant</label>
                  <select
                    value={Object.values(roomState.participants).find(p => p.assignedRole === 'MANUAL_UMPIRE')?.socketId || ''}
                    disabled={!myParticipant?.isHost}
                    onChange={(e) => {
                      if (onAssignUmpire) {
                        onAssignUmpire(e.target.value || null, 'MANUAL_HUMAN');
                      }
                    }}
                    className="w-full mt-1 px-2 py-1.5 bg-slate-950 border border-white/10 rounded-lg text-white"
                  >
                    <option value="">Select Participant</option>
                    {Object.values(roomState.participants).map(p => (
                      <option key={p.socketId} value={p.socketId}>
                        {p.displayName} {p.isHost ? '(Host)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Documented Minimum Player Requirement Banner */}
        <div className="my-2.5 p-3 rounded-2xl bg-gradient-to-r from-blue-950/40 via-slate-900/40 to-emerald-950/40 border border-white/10 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 text-slate-300">
            <span className="px-2 py-0.5 rounded-lg bg-amber-400/20 text-amber-300 font-mono font-bold text-[10px] border border-amber-400/30">
              MINIMUM RULE
            </span>
            <span>
              Documented Minimum: <strong>{minRequired} human per team</strong>. (Team A: {teamAHumans.length}/{minRequired}, Team B: {teamBHumans.length}/{minRequired}). Unoccupied slots are AI-controlled.
            </span>
          </div>

          <div className="flex items-center gap-2">
            {!canStartMatch && (
              <span className="text-amber-400 font-semibold flex items-center gap-1 text-[11px]">
                <Clock className="w-3.5 h-3.5" />
                {!teamASatisfied || !teamBSatisfied
                  ? `Need ${minRequired} human(s) on both teams to start`
                  : 'Waiting for players to be Ready'}
              </span>
            )}
            {canStartMatch && (
              <span className="text-emerald-400 font-bold flex items-center gap-1 text-[11px]">
                <UserCheck className="w-3.5 h-3.5" /> Ready to Launch
              </span>
            )}
          </div>
        </div>

        {/* Connected Friends Horizontal Bar */}
        <div className="py-2 flex items-center gap-2 overflow-x-auto border-b border-white/10 pb-3">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider shrink-0 flex items-center gap-1">
            <Users className="w-3.5 h-3.5" /> Friends Online ({activeParticipants.length}):
          </span>
          {participantsList.map((p) => (
            <div
              key={p.socketId}
              className={`px-2.5 py-1 rounded-xl text-xs flex items-center gap-2 shrink-0 border ${
                p.isDisconnected
                  ? 'bg-rose-950/30 border-rose-500/40 text-rose-300'
                  : p.socketId === myParticipant?.socketId
                  ? 'bg-amber-400/15 border-amber-400/40 text-amber-200'
                  : 'bg-slate-900 border-white/10 text-slate-300'
              }`}
            >
              <span className="font-semibold">{p.displayName}</span>
              {p.isHost && <span className="text-[10px] px-1 py-0.2 bg-amber-400 text-slate-950 rounded font-black">HOST</span>}
              <span className="text-[10px] text-slate-400">
                {p.assignedTeamId ? (p.assignedTeamId === 'TEAM_A' ? 'Ind' : 'Aus') : 'Spec'}
              </span>
              {p.isDisconnected ? (
                <span className="text-[10px] text-rose-400 font-bold animate-pulse">Reconnecting...</span>
              ) : p.isReady ? (
                <span className="text-emerald-400 text-[10px] font-bold">✓ Ready</span>
              ) : (
                <span className="text-slate-500 text-[10px]">Wait</span>
              )}
            </div>
          ))}
        </div>

        {/* 11v11 Team Rosters */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-3 overflow-y-auto flex-1">
          {/* Team A: Royal Strikers */}
          <div className="bg-blue-950/25 border border-blue-500/20 rounded-2xl p-3.5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-black text-blue-300 flex items-center gap-1.5">
                <Shield className="w-4 h-4 text-blue-400" /> Team A (Royal Strikers)
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onOpenLineupCustomizer && onOpenLineupCustomizer('TEAM_A')}
                  className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-600/30 hover:bg-blue-600/50 text-blue-300 border border-blue-400/30 transition-colors"
                >
                  ⚙️ Lineup (C, WK, Order)
                </button>
                <span className="text-[11px] text-blue-200/80 font-semibold">
                  {teamAHumans.length}H / {11 - teamAHumans.length}AI
                </span>
              </div>
            </div>
            <div className="space-y-1">
              {Array.from({ length: 11 }).map((_, i) => {
                const playerId = `TEAM_A_player_${i + 1}`;
                const isClaimedByMe = myParticipant?.assignedPlayerId === playerId;
                const occupant = Object.values(roomState.participants).find(
                  (p) => p.assignedPlayerId === playerId
                );

                const roleDesc =
                  i === 0
                    ? 'Opener / Striker'
                    : i === 1
                    ? 'Opener / Non-Striker'
                    : i === 2
                    ? 'One Down Anchor'
                    : i < 5
                    ? 'Middle Order Batter'
                    : i < 7
                    ? 'All-Rounder'
                    : i === 7
                    ? 'Wicket-Keeper'
                    : 'Bowler';

                return (
                  <div
                    key={playerId}
                    onClick={() => onClaimSlot('TEAM_A', playerId)}
                    className={`px-3 py-1.5 rounded-xl text-xs flex items-center justify-between cursor-pointer transition-all border ${
                      isClaimedByMe
                        ? 'bg-blue-600/40 border-amber-400 text-white font-bold shadow-md'
                        : occupant
                        ? occupant.isDisconnected
                          ? 'bg-rose-950/20 border-rose-500/30 text-rose-300'
                          : 'bg-blue-900/20 border-white/10 text-slate-300'
                        : 'bg-slate-900/40 border-dashed border-white/10 text-slate-400 hover:border-blue-400/50'
                    }`}
                  >
                    <span>
                      {i + 1}. {roleDesc}
                    </span>
                    <span className="font-semibold flex items-center gap-1.5">
                      {isClaimedByMe ? (
                        <span className="text-amber-300">★ You</span>
                      ) : occupant ? (
                        <>
                          <span>👤 {occupant.displayName}</span>
                          {occupant.isDisconnected && (
                            <span className="text-[10px] text-rose-400 animate-pulse">⚠️</span>
                          )}
                        </>
                      ) : (
                        <span className="text-slate-500">🤖 AI</span>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Team B: Titans XI */}
          <div className="bg-emerald-950/25 border border-emerald-500/20 rounded-2xl p-3.5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-black text-emerald-300 flex items-center gap-1.5">
                <Shield className="w-4 h-4 text-emerald-400" /> Team B (Titans XI)
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onOpenLineupCustomizer && onOpenLineupCustomizer('TEAM_B')}
                  className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-300 border border-emerald-400/30 transition-colors"
                >
                  ⚙️ Lineup (C, WK, Order)
                </button>
                <span className="text-[11px] text-emerald-200/80 font-semibold">
                  {teamBHumans.length}H / {11 - teamBHumans.length}AI
                </span>
              </div>
            </div>
            <div className="space-y-1">
              {Array.from({ length: 11 }).map((_, i) => {
                const playerId = `TEAM_B_player_${i + 1}`;
                const isClaimedByMe = myParticipant?.assignedPlayerId === playerId;
                const occupant = Object.values(roomState.participants).find(
                  (p) => p.assignedPlayerId === playerId
                );

                const roleDesc =
                  i === 0
                    ? 'Opener / Wicketkeeper'
                    : i === 1
                    ? 'Opener / Batter'
                    : i === 2
                    ? 'Top Order Anchor'
                    : i < 5
                    ? 'Middle Order Batter'
                    : i < 7
                    ? 'All-Rounder'
                    : i === 10
                    ? 'Opening Bowler'
                    : 'Bowler';

                return (
                  <div
                    key={playerId}
                    onClick={() => onClaimSlot('TEAM_B', playerId)}
                    className={`px-3 py-1.5 rounded-xl text-xs flex items-center justify-between cursor-pointer transition-all border ${
                      isClaimedByMe
                        ? 'bg-emerald-600/40 border-amber-400 text-white font-bold shadow-md'
                        : occupant
                        ? occupant.isDisconnected
                          ? 'bg-rose-950/20 border-rose-500/30 text-rose-300'
                          : 'bg-emerald-900/20 border-white/10 text-slate-300'
                        : 'bg-slate-900/40 border-dashed border-white/10 text-slate-400 hover:border-emerald-400/50'
                    }`}
                  >
                    <span>
                      {i + 1}. {roleDesc}
                    </span>
                    <span className="font-semibold flex items-center gap-1.5">
                      {isClaimedByMe ? (
                        <span className="text-amber-300">★ You</span>
                      ) : occupant ? (
                        <>
                          <span>👤 {occupant.displayName}</span>
                          {occupant.isDisconnected && (
                            <span className="text-[10px] text-rose-400 animate-pulse">⚠️</span>
                          )}
                        </>
                      ) : (
                        <span className="text-slate-500">🤖 AI</span>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Bottom Actions Bar */}
        <div className="pt-3 border-t border-white/10 flex flex-wrap items-center justify-between text-xs gap-3">
          <div className="flex items-center gap-3">
            {myParticipant?.assignedPlayerId && onReleaseSlot && (
              <button
                onClick={onReleaseSlot}
                className="px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white border border-white/10 transition-all cursor-pointer"
              >
                Vacate Slot (Spectate)
              </button>
            )}
            <span className="text-slate-400 text-[11px]">
              Use <strong>W, A, S, D</strong> to move, <strong>Shift</strong> to sprint, and <strong>Space</strong> to dive during play.
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onSetReady(!myParticipant?.isReady)}
              className={`px-5 py-2 rounded-xl font-bold transition-all shadow-md cursor-pointer ${
                myParticipant?.isReady
                  ? 'bg-emerald-500 text-slate-950 font-black'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {myParticipant?.isReady ? '✓ You Are Ready' : 'Set Ready'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

