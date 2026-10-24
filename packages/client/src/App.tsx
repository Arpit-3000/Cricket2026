import { useState } from 'react';
import { useCricketGame } from './hooks/useCricketGame.js';
import { CricketStadiumScene, CameraViewMode } from './components/3d/CricketStadiumScene.js';
import { BroadcastScorecard } from './components/ui/BroadcastScorecard.js';
import { GameControlsHUD } from './components/ui/GameControlsHUD.js';
import { RoomLobbyModal } from './components/lobby/RoomLobbyModal.js';

export function App() {
  const {
    roomState,
    gameState,
    scorecard,
    pingMs,
    myParticipant,
    createRoom,
    joinRoom,
    claimSlot,
    setReady,
    startMatch,
    commitBowling,
    submitBatting
  } = useCricketGame();

  const [cameraMode, setCameraMode] = useState<CameraViewMode>('STRIKER');

  const showLobby = !roomState || roomState.status === 'LOBBY';

  return (
    <div className="w-screen h-screen relative bg-slate-950 font-sans select-none overflow-hidden">
      {/* 3D Realistic Cricket Stadium Canvas */}
      <CricketStadiumScene
        cameraMode={cameraMode}
        gameState={gameState}
        myPlayerId={myParticipant?.assignedPlayerId}
      />

      {/* Broadcast Scorecard Top Overlay */}
      <BroadcastScorecard
        scorecard={scorecard}
        gameState={gameState}
        roomCode={roomState?.roomCode || ''}
        pingMs={pingMs}
        spectatorCount={roomState?.spectatorCount || 0}
      />

      {/* Bottom Controls HUD */}
      {!showLobby && (
        <GameControlsHUD
          gameState={gameState}
          myPlayerId={myParticipant?.assignedPlayerId}
          cameraMode={cameraMode}
          onCameraChange={setCameraMode}
          onCommitBowling={commitBowling}
          onSubmitBatting={submitBatting}
        />
      )}

      {/* Private Room Creation & 11v11 Position Selection Modal */}
      {showLobby && (
        <RoomLobbyModal
          roomState={roomState}
          myParticipant={myParticipant}
          onCreateRoom={createRoom}
          onJoinRoom={joinRoom}
          onClaimSlot={claimSlot}
          onSetReady={setReady}
          onStartMatch={startMatch}
        />
      )}
    </div>
  );
}

export default App;
