import { useState, useEffect, useCallback } from 'react';
import { useCricketGame } from './hooks/useCricketGame.js';
import { CricketStadiumScene, CameraViewMode } from './components/3d/CricketStadiumScene.js';
import { BroadcastScorecard } from './components/ui/BroadcastScorecard.js';
import { GameControlsHUD } from './components/ui/GameControlsHUD.js';
import { RoomLobbyModal } from './components/lobby/RoomLobbyModal.js';
import { HomeScreen } from './components/ui/HomeScreen.js';
import { SettingsModal, GameSettings, DEFAULT_SETTINGS } from './components/ui/SettingsModal.js';
import { HowToPlayModal } from './components/ui/HowToPlayModal.js';
import { LoadingScreen } from './components/ui/LoadingScreen.js';
import { TossModal } from './components/prematch/TossModal.js';
import { LineupCustomizerModal } from './components/prematch/LineupCustomizerModal.js';
import { UmpireOverlay } from './components/prematch/UmpireOverlay.js';
import { InningsBreakModal } from './components/ui/InningsBreakModal.js';
import { MatchResultModal } from './components/ui/MatchResultModal.js';
import { TeamId } from '@cricket2026/shared';

import { usePlayerMovementControls } from './hooks/usePlayerMovementControls.js';

type ScreenView = 'HOME' | 'PRACTICE' | 'MATCH';

export function App() {
  const {
    isConnected,
    pingMs,
    roomState,
    gameState,
    playerEntities,
    notifications,
    errorNotification,
    scorecard,
    myParticipant,
    coinFlipping,
    umpirePrompt,
    lastUmpireSignal,
    inningsBreakData,
    superOverData: _superOverData,
    matchFinished,
    createRoom,
    joinRoom,
    leaveRoom,
    claimSlot,
    releaseSlot,
    updateSettings,
    setReady,
    startMatch,
    sendPlayerMovement,
    commitBowling,
    submitBatting,
    updateLineup,
    assignUmpire,
    callToss,
    decideToss,
    sendUmpireSignal,
    callRun,
    sendFielderAction,
    adjustFieldPosition,
    applyFieldPreset,
    appeal,
    rematch,
    returnToLobby,
    startSuperOver,
    clearInningsBreak
  } = useCricketGame();

  const [activeScreen, setActiveScreen] = useState<ScreenView>('HOME');
  const [cameraMode, setCameraMode] = useState<CameraViewMode>('BROADCAST');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [howToPlayOpen, setHowToPlayOpen] = useState(false);
  const [lobbyModalOpen, setLobbyModalOpen] = useState(false);
  const [lobbyInitialMode, setLobbyInitialMode] = useState<'CREATE' | 'JOIN'>('CREATE');
  const [lineupCustomizerOpen, setLineupCustomizerOpen] = useState(false);
  const [lineupCustomizerTeamId, setLineupCustomizerTeamId] = useState<TeamId>('TEAM_A');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('Loading Stadium...');
  const [gameSettings, setGameSettings] = useState<GameSettings>(DEFAULT_SETTINGS);

  // Real-Time Keyboard Controls for Local Player Movement (WASD / Arrows + Shift sprint + Space dive + E pickup + Click throw)
  usePlayerMovementControls({
    roomCode: roomState?.roomCode || null,
    assignedPlayerId: myParticipant?.assignedPlayerId,
    playerEntities,
    ballPosition: gameState?.activeDelivery.ball.position,
    ballPossessedById: gameState?.activeDelivery.ball.possessedByFielderId,
    onSendMovement: sendPlayerMovement,
    onSendFieldingAction: sendFielderAction,
    isEnabled: isConnected && (activeScreen === 'MATCH' || Boolean(roomState))
  });

  // Load saved settings on mount
  useEffect(() => {
    const saved = localStorage.getItem('cricket2026_settings');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setGameSettings(parsed);
        if (parsed.defaultCameraMode) {
          setCameraMode(parsed.defaultCameraMode);
        }
      } catch {
        // use default settings
      }
    }
  }, []);

  // When room match starts, switch to MATCH view
  useEffect(() => {
    if (roomState && roomState.status !== 'LOBBY') {
      setActiveScreen('MATCH');
      setLobbyModalOpen(false);
    }
  }, [roomState]);

  // Global Keyboard Shortcuts
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Don't intercept typing in input fields
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      switch (e.key) {
        case '1':
          setCameraMode('BROADCAST');
          break;
        case '2':
          setCameraMode('BATTING');
          break;
        case '3':
          setCameraMode('BOWLING');
          break;
        case '4':
          setCameraMode('FIELD_SIDE');
          break;
        case '5':
          setCameraMode('SPECTATOR');
          break;
        case '6':
          setCameraMode('REPLAY');
          break;
        case 'h':
        case 'H':
          setHowToPlayOpen((prev) => !prev);
          break;
        case 's':
        case 'S':
          setSettingsOpen((prev) => !prev);
          break;
        case 'Escape':
          if (settingsOpen) setSettingsOpen(false);
          else if (howToPlayOpen) setHowToPlayOpen(false);
          else if (lobbyModalOpen && !roomState) setLobbyModalOpen(false);
          break;
        default:
          break;
      }
    },
    [settingsOpen, howToPlayOpen, lobbyModalOpen, roomState]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const handlePlayMatch = async () => {
    if (isConnected) {
      setLoadingMessage('Creating 5-Over Match Arena...');
      setIsLoading(true);
      const res = await createRoom('Player');
      setIsLoading(false);
      if (res.success) {
        setLobbyModalOpen(true);
      } else {
        setLobbyInitialMode('CREATE');
        setLobbyModalOpen(true);
      }
    } else {
      handleStartPractice();
    }
  };

  const handleStartPractice = () => {
    setLoadingMessage('Loading Practice Nets & Stadium Arena...');
    setIsLoading(true);
  };

  const handleCreateRoomClick = () => {
    setLobbyInitialMode('CREATE');
    setLobbyModalOpen(true);
  };

  const handleJoinRoomClick = () => {
    setLobbyInitialMode('JOIN');
    setLobbyModalOpen(true);
  };

  const handleApplySettings = (newSettings: GameSettings) => {
    setGameSettings(newSettings);
    setCameraMode(newSettings.defaultCameraMode);
  };

  return (
    <div className="w-screen h-screen relative bg-slate-950 font-sans select-none overflow-hidden text-slate-100">
      {/* Real-time Room Notification Toasts */}
      {notifications.length > 0 && (
        <div className="absolute top-20 right-4 z-40 flex flex-col gap-2 max-w-sm pointer-events-none">
          {notifications.slice(0, 3).map((notif) => (
            <div
              key={notif.id}
              className={`p-3 rounded-2xl shadow-xl backdrop-blur-md border text-xs font-semibold animate-fadeIn ${
                notif.type === 'DISCONNECT'
                  ? 'bg-rose-950/80 border-rose-500/40 text-rose-200'
                  : notif.type === 'RECONNECT'
                  ? 'bg-emerald-950/80 border-emerald-500/40 text-emerald-200'
                  : notif.type === 'WARNING'
                  ? 'bg-amber-950/80 border-amber-500/40 text-amber-200'
                  : 'bg-slate-900/85 border-white/15 text-slate-200'
              }`}
            >
              {notif.message}
            </div>
          ))}
        </div>
      )}

      {/* 1. Realistic 3D Cricket Stadium Canvas */}
      <CricketStadiumScene
        cameraMode={cameraMode}
        gameState={gameState}
        playerEntities={playerEntities}
        myPlayerId={myParticipant?.assignedPlayerId}
        crowdDensity={gameSettings.crowdDensity}
        graphicsQuality={gameSettings.graphicsQuality}
        shadowsEnabled={gameSettings.shadowsEnabled}
        fov={gameSettings.cameraFov}
        lastUmpireSignal={lastUmpireSignal?.signal || null}
        masterVolume={gameSettings.masterVolume}
        crowdVolume={gameSettings.crowdVolume}
        sfxVolume={gameSettings.sfxVolume}
      />

      {/* 2. Television Broadcast Scorecard Overlay (In Match or Practice) */}
      {(activeScreen === 'MATCH' || activeScreen === 'PRACTICE') && (
        <BroadcastScorecard
          scorecard={scorecard}
          gameState={gameState}
          roomCode={roomState?.roomCode || ''}
          pingMs={pingMs}
          spectatorCount={roomState?.spectatorCount || 0}
          isPracticeMode={activeScreen === 'PRACTICE'}
          onExitToMenu={() => {
            if (roomState) leaveRoom();
            setActiveScreen('HOME');
          }}
        />
      )}

      {/* 3. Interactive Role Controls HUD (In Match or Practice) */}
      {(activeScreen === 'MATCH' || activeScreen === 'PRACTICE') && (
        <GameControlsHUD
          gameState={gameState}
          myPlayerId={myParticipant?.assignedPlayerId}
          cameraMode={cameraMode}
          onCameraChange={setCameraMode}
          onCommitBowling={commitBowling}
          onSubmitBatting={submitBatting}
          onCallRun={callRun}
          onFielderAction={sendFielderAction}
          onAdjustFieldPosition={adjustFieldPosition}
          onApplyFieldPreset={applyFieldPreset}
          onAppeal={appeal}
          playerEntities={playerEntities}
          isCaptain={Boolean(myParticipant?.isHost)}
          isPracticeMode={activeScreen === 'PRACTICE'}
        />
      )}

      {/* 4. Home Screen Navigation Overlay */}
      {activeScreen === 'HOME' && !lobbyModalOpen && !roomState && (
        <HomeScreen
          isConnected={isConnected}
          pingMs={pingMs}
          onPlayMatch={handlePlayMatch}
          onStartPractice={handleStartPractice}
          onCreateRoomClick={handleCreateRoomClick}
          onJoinRoomClick={handleJoinRoomClick}
          onOpenSettings={() => setSettingsOpen(true)}
          onOpenHowToPlay={() => setHowToPlayOpen(true)}
        />
      )}

      {/* 5. Multiplayer Room Lobby & 11v11 Slot Selection Modal */}
      {(lobbyModalOpen || (roomState && roomState.status === 'LOBBY')) && (
        <RoomLobbyModal
          roomState={roomState}
          myParticipant={myParticipant}
          pingMs={pingMs}
          onCreateRoom={createRoom}
          onJoinRoom={joinRoom}
          onClaimSlot={claimSlot}
          onReleaseSlot={releaseSlot}
          onUpdateSettings={updateSettings}
          onSetReady={setReady}
          onStartMatch={startMatch}
          onLeaveRoom={leaveRoom}
          errorNotification={errorNotification}
          onOpenLineupCustomizer={(teamId) => {
            setLineupCustomizerTeamId(teamId);
            setLineupCustomizerOpen(true);
          }}
          onAssignUmpire={assignUmpire}
          onClose={() => {
            setLobbyModalOpen(false);
            if (!roomState) setActiveScreen('HOME');
          }}
          initialMode={lobbyInitialMode}
        />
      )}

      {/* 5.1. Official Pre-Match Toss Modal */}
      {Boolean(gameState && (roomState?.status === 'TOSS' || gameState.phase === 'TOSS' || gameState.phase === 'TOSS_IN_PROGRESS')) && (
        <TossModal
          toss={gameState!.toss}
          teams={gameState!.teams}
          isHost={Boolean(myParticipant?.isHost)}
          myTeamId={myParticipant?.assignedTeamId}
          coinFlipping={coinFlipping}
          onCallToss={callToss}
          onDecideToss={decideToss}
        />
      )}

      {/* 5.2. Playing XI Lineup Customizer Modal */}
      {lineupCustomizerOpen && gameState && (
        <LineupCustomizerModal
          teams={gameState.teams}
          initialTeamId={lineupCustomizerTeamId}
          isHost={Boolean(myParticipant?.isHost)}
          myTeamId={myParticipant?.assignedTeamId}
          onSaveLineup={updateLineup}
          onClose={() => setLineupCustomizerOpen(false)}
        />
      )}

      {/* 5.3. Umpire Adjudication Overlay & Decision Banner */}
      <UmpireOverlay
        isManualUmpire={myParticipant?.assignedRole === 'MANUAL_UMPIRE'}
        manualUmpireName={
          roomState && Object.values(roomState.participants).find(p => p.assignedRole === 'MANUAL_UMPIRE')?.displayName
        }
        umpirePrompt={umpirePrompt}
        lastUmpireSignal={lastUmpireSignal}
        onSendSignal={sendUmpireSignal}
        onSwitchCamera={setCameraMode}
        matchContext={
          gameState ? {
            battingTeam: gameState.teams[gameState.battingTeamId]?.name,
            bowlingTeam: gameState.teams[gameState.bowlingTeamId]?.name,
            score: `${scorecard?.innings[gameState.currentInningsNumber - 1]?.runs ?? 0}/${scorecard?.innings[gameState.currentInningsNumber - 1]?.wickets ?? 0}`,
            overs: `${scorecard?.innings[gameState.currentInningsNumber - 1]?.oversCompleted ?? 0}.${scorecard?.innings[gameState.currentInningsNumber - 1]?.ballsInCurrentOver ?? 0} ov`,
            striker: scorecard?.innings[gameState.currentInningsNumber - 1]?.batters.find(b => b.playerId === gameState.currentStrikerId)?.playerName,
            bowler: scorecard?.innings[gameState.currentInningsNumber - 1]?.bowlers.find(b => b.playerId === gameState.currentBowlerId)?.playerName,
            target: scorecard?.innings[gameState.currentInningsNumber - 1]?.target ?? undefined
          } : undefined
        }
      />

      {/* 5.4. Innings Break Modal */}
      {(inningsBreakData || (gameState && (gameState.phase === 'INNINGS_BREAK' || gameState.phase === 'MID_INNINGS_BREAK'))) && (
        <InningsBreakModal
          scorecard={scorecard}
          gameState={gameState}
          inningsBreakData={inningsBreakData}
          onDismiss={clearInningsBreak}
        />
      )}

      {/* 5.5. Match Result & Final Scorecard Modal */}
      {(matchFinished || (scorecard?.isCompleted && (gameState?.phase === 'MATCH_CONCLUDED' || gameState?.phase === 'COMPLETED_MATCH'))) && (
        <MatchResultModal
          scorecard={matchFinished?.scorecard || scorecard}
          gameState={gameState}
          winnerTeamId={matchFinished?.winnerTeamId || scorecard?.winnerTeamId}
          commentary={matchFinished?.commentary || scorecard?.matchResultCommentary}
          isHost={Boolean(myParticipant?.isHost)}
          onRematch={rematch}
          onReturnToLobby={returnToLobby}
          onStartSuperOver={startSuperOver}
        />
      )}

      {/* 6. Settings Modal */}
      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onApplySettings={handleApplySettings}
      />

      {/* 7. How To Play & Rules Modal */}
      <HowToPlayModal isOpen={howToPlayOpen} onClose={() => setHowToPlayOpen(false)} />

      {/* 8. Match Intro Loading Screen */}
      {isLoading && (
        <LoadingScreen
          message={loadingMessage}
          onFinish={() => {
            setIsLoading(false);
            setActiveScreen('PRACTICE');
          }}
        />
      )}
    </div>
  );
}

export default App;
