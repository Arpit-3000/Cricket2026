import React, { useState } from 'react';
import { TeamId, TeamPlayingXI } from '@cricket2026/shared';

interface LineupCustomizerModalProps {
  teams: {
    TEAM_A: TeamPlayingXI;
    TEAM_B: TeamPlayingXI;
  };
  initialTeamId?: TeamId;
  isHost: boolean;
  myTeamId?: TeamId | null;
  onSaveLineup: (payload: {
    teamId: TeamId;
    captainId?: string;
    wicketKeeperId?: string;
    battingOrder?: string[];
    playerRoles?: Record<string, string>;
    name?: string;
    primaryColor?: string;
    secondaryColor?: string;
  }) => Promise<any>;
  onClose: () => void;
}

export const LineupCustomizerModal: React.FC<LineupCustomizerModalProps> = ({
  teams,
  initialTeamId = 'TEAM_A',
  isHost,
  myTeamId,
  onSaveLineup,
  onClose
}) => {
  const [selectedTeamId, setSelectedTeamId] = useState<TeamId>(initialTeamId);
  const team = teams[selectedTeamId];

  const [teamName, setTeamName] = useState<string>(team.name);
  const [primaryColor, setPrimaryColor] = useState<string>(team.primaryColor);
  const [secondaryColor, setSecondaryColor] = useState<string>(team.secondaryColor);
  const [captainId, setCaptainId] = useState<string>(team.captainId);
  const [wicketKeeperId, setWicketKeeperId] = useState<string>(team.wicketKeeperId);
  const [orderedPlayerIds, setOrderedPlayerIds] = useState<string[]>(team.players.map(p => p.id));
  const [playerRoles, setPlayerRoles] = useState<Record<string, string>>(
    Object.fromEntries(team.players.map(p => [p.id, p.role]))
  );
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  // Switch team tab
  const handleTeamChange = (newTeamId: TeamId) => {
    setSelectedTeamId(newTeamId);
    const newTeam = teams[newTeamId];
    setTeamName(newTeam.name);
    setPrimaryColor(newTeam.primaryColor);
    setSecondaryColor(newTeam.secondaryColor);
    setCaptainId(newTeam.captainId);
    setWicketKeeperId(newTeam.wicketKeeperId);
    setOrderedPlayerIds(newTeam.players.map(p => p.id));
    setPlayerRoles(Object.fromEntries(newTeam.players.map(p => [p.id, p.role])));
    setSaveMessage(null);
  };

  const movePlayer = (index: number, direction: 'UP' | 'DOWN') => {
    const newOrder = [...orderedPlayerIds];
    const targetIndex = direction === 'UP' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newOrder.length) return;

    const temp = newOrder[index];
    newOrder[index] = newOrder[targetIndex];
    newOrder[targetIndex] = temp;
    setOrderedPlayerIds(newOrder);
  };

  const handleRoleChange = (playerId: string, role: string) => {
    setPlayerRoles(prev => ({ ...prev, [playerId]: role }));
    if (role === 'WICKET_KEEPER') {
      setWicketKeeperId(playerId);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveMessage(null);
    try {
      await onSaveLineup({
        teamId: selectedTeamId,
        name: teamName,
        primaryColor,
        secondaryColor,
        captainId,
        wicketKeeperId,
        battingOrder: orderedPlayerIds,
        playerRoles
      });
      setSaveMessage('✓ Lineup and team customization saved successfully!');
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (err: any) {
      setSaveMessage(`Error: ${err?.message || 'Failed to save lineup'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const canEdit = isHost || myTeamId === selectedTeamId;
  const playerMap = new Map(team.players.map(p => [p.id, p]));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto animate-in fade-in">
      <div className="relative w-full max-w-4xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden my-6 flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="px-6 py-4 bg-slate-800/80 border-b border-slate-700/80 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <span>📋</span> Playing XI & Lineup Customizer
            </h2>
            <p className="text-xs text-slate-400">
              Configure Captain (C), Wicketkeeper (WK), batting order (1-11), player roles, and team jersey.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Team Selector Tabs */}
        <div className="flex border-b border-slate-800 bg-slate-950/60 px-6 pt-3 gap-2">
          <button
            type="button"
            onClick={() => handleTeamChange('TEAM_A')}
            className={`px-4 py-2 text-sm font-bold rounded-t-lg transition-all border-b-2 flex items-center gap-2 ${
              selectedTeamId === 'TEAM_A'
                ? 'border-blue-500 text-blue-400 bg-slate-800/60'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: teams.TEAM_A.primaryColor }} />
            {teams.TEAM_A.name}
          </button>
          <button
            type="button"
            onClick={() => handleTeamChange('TEAM_B')}
            className={`px-4 py-2 text-sm font-bold rounded-t-lg transition-all border-b-2 flex items-center gap-2 ${
              selectedTeamId === 'TEAM_B'
                ? 'border-emerald-500 text-emerald-400 bg-slate-800/60'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: teams.TEAM_B.primaryColor }} />
            {teams.TEAM_B.name}
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-200">
          
          {/* Team Brand / Jersey Customization Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-xl bg-slate-800/40 border border-slate-700/60">
            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">Team Name</label>
              <input
                type="text"
                value={teamName}
                disabled={!canEdit}
                onChange={e => setTeamName(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-amber-400"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">Primary Jersey Color</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={primaryColor}
                  disabled={!canEdit}
                  onChange={e => setPrimaryColor(e.target.value)}
                  className="w-8 h-8 rounded border-none cursor-pointer bg-transparent"
                />
                <span className="text-xs font-mono text-slate-300">{primaryColor}</span>
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">Secondary Accent Color</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={secondaryColor}
                  disabled={!canEdit}
                  onChange={e => setSecondaryColor(e.target.value)}
                  className="w-8 h-8 rounded border-none cursor-pointer bg-transparent"
                />
                <span className="text-xs font-mono text-slate-300">{secondaryColor}</span>
              </div>
            </div>
          </div>

          {/* Batting Order & Lineup List */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300">
                Playing XI Batting Order & Roles (1 - 11)
              </h3>
              <span className="text-xs text-slate-400">
                Use arrows to adjust batting sequence
              </span>
            </div>

            <div className="space-y-2">
              {orderedPlayerIds.map((playerId, index) => {
                const player = playerMap.get(playerId);
                if (!player) return null;

                const isCap = captainId === playerId;
                const isWk = wicketKeeperId === playerId;
                const role = playerRoles[playerId] || player.role;

                return (
                  <div
                    key={playerId}
                    className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                      isCap
                        ? 'bg-amber-950/20 border-amber-500/40 shadow-sm'
                        : isWk
                        ? 'bg-blue-950/20 border-blue-500/40'
                        : 'bg-slate-800/50 border-slate-700/60 hover:bg-slate-800'
                    }`}
                  >
                    {/* Left: Position Number & Avatar */}
                    <div className="flex items-center gap-3">
                      <div className="w-6 text-center font-black text-xs text-slate-400">
                        #{index + 1}
                      </div>

                      <div
                        className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs border shadow"
                        style={{ backgroundColor: primaryColor, borderColor: secondaryColor }}
                      >
                        {player.jerseyNumber}
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-white">
                            {player.displayName}
                          </span>
                          {!player.isAi ? (
                            <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                              👤 Human
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-700 text-slate-300 font-semibold">
                              🤖 AI
                            </span>
                          )}
                          {isCap && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-500 text-black font-black">
                              CAPTAIN (C)
                            </span>
                          )}
                          {isWk && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] bg-blue-500 text-white font-black">
                              WICKETKEEPER (WK)
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {player.battingStyle.replace('_', ' ')} • {player.bowlingStyle.replace(/_/g, ' ')}
                        </div>
                      </div>
                    </div>

                    {/* Right: Controls (Captain, WK, Role, Move Up/Down) */}
                    <div className="flex items-center gap-2">
                      {/* Role Dropdown */}
                      <select
                        value={role}
                        disabled={!canEdit}
                        onChange={e => handleRoleChange(playerId, e.target.value)}
                        className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-amber-400"
                      >
                        <option value="BATSMAN">BATSMAN</option>
                        <option value="BOWLER">BOWLER</option>
                        <option value="ALL_ROUNDER">ALL ROUNDER</option>
                        <option value="WICKET_KEEPER">WICKETKEEPER</option>
                      </select>

                      {/* Captain Toggle */}
                      <button
                        type="button"
                        disabled={!canEdit}
                        onClick={() => setCaptainId(playerId)}
                        className={`px-2.5 py-1 rounded text-xs font-bold border transition-colors ${
                          isCap
                            ? 'bg-amber-500 text-black border-amber-400'
                            : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
                        }`}
                        title="Make Captain"
                      >
                        (C)
                      </button>

                      {/* WK Toggle */}
                      <button
                        type="button"
                        disabled={!canEdit}
                        onClick={() => {
                          setWicketKeeperId(playerId);
                          handleRoleChange(playerId, 'WICKET_KEEPER');
                        }}
                        className={`px-2.5 py-1 rounded text-xs font-bold border transition-colors ${
                          isWk
                            ? 'bg-blue-600 text-white border-blue-400'
                            : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
                        }`}
                        title="Make Wicketkeeper"
                      >
                        (WK)
                      </button>

                      {/* Re-order Up / Down */}
                      {canEdit && (
                        <div className="flex items-center gap-1 ml-1">
                          <button
                            type="button"
                            disabled={index === 0}
                            onClick={() => movePlayer(index, 'UP')}
                            className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-30 text-xs"
                            title="Move Up in Batting Order"
                          >
                            ▲
                          </button>
                          <button
                            type="button"
                            disabled={index === orderedPlayerIds.length - 1}
                            onClick={() => movePlayer(index, 'DOWN')}
                            className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-30 text-xs"
                            title="Move Down in Batting Order"
                          >
                            ▼
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {saveMessage && (
            <div className={`p-3 rounded-lg text-xs font-bold ${
              saveMessage.startsWith('✓') ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
            }`}>
              {saveMessage}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-950/80 border-t border-slate-800 flex items-center justify-between">
          <div className="text-xs text-slate-400">
            {!canEdit && '⚠️ Only the room host or assigned team players can modify this team.'}
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-300 hover:bg-slate-800 transition-colors"
            >
              Close
            </button>
            {canEdit && (
              <button
                type="button"
                disabled={isSaving}
                onClick={handleSave}
                className="px-6 py-2 rounded-xl text-sm font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-lg shadow-amber-500/20 transition-all active:scale-95 disabled:opacity-50"
              >
                {isSaving ? 'Saving Lineup...' : 'Save Lineup Changes'}
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
