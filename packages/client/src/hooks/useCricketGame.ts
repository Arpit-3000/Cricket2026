import { useState, useEffect, useCallback } from 'react';
import {
  RoomState,
  CricketGameState,
  MatchScorecard,
  DeliveryRecord,
  BowlingDeliveryIntent,
  BattingShotIntent
} from '@cricket2026/shared';
import { socketService } from '../services/socketService.js';

export function useCricketGame() {
  const [isConnected, setIsConnected] = useState(false);
  const [pingMs, setPingMs] = useState(0);
  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const [gameState, setGameState] = useState<CricketGameState | null>(null);
  const [scorecard, setScorecard] = useState<MatchScorecard | null>(null);
  const [lastDelivery, setLastDelivery] = useState<DeliveryRecord | null>(null);
  const [currentSocketId, setCurrentSocketId] = useState<string>('');

  useEffect(() => {
    const socket = socketService.connect();

    socket.on('connect', () => {
      setIsConnected(true);
      setCurrentSocketId(socket.id || '');
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    socket.on('room:state', (state: RoomState) => {
      setRoomState(state);
    });

    socket.on('game:init_match', (game: CricketGameState) => {
      setGameState(game);
      setScorecard(game.scorecard);
    });

    socket.on('game:scorecard_sync', (sc: MatchScorecard) => {
      setScorecard(sc);
    });

    socket.on('game:delivery_completed', (rec: DeliveryRecord) => {
      setLastDelivery(rec);
    });

    const pingInterval = setInterval(async () => {
      if (socket.connected) {
        const latency = await socketService.ping();
        setPingMs(latency);
      }
    }, 4000);

    return () => {
      clearInterval(pingInterval);
      socket.off('connect');
      socket.off('disconnect');
      socket.off('room:state');
      socket.off('game:init_match');
      socket.off('game:scorecard_sync');
      socket.off('game:delivery_completed');
    };
  }, []);

  const createRoom = useCallback(async (hostName: string) => {
    return await socketService.createRoom(hostName);
  }, []);

  const joinRoom = useCallback(async (roomCode: string, displayName: string) => {
    return await socketService.joinRoom(roomCode, displayName);
  }, []);

  const claimSlot = useCallback((teamId: 'TEAM_A' | 'TEAM_B', playerId: string) => {
    socketService.claimSlot(teamId, playerId);
  }, []);

  const setReady = useCallback((ready: boolean) => {
    socketService.setReady(ready);
  }, []);

  const startMatch = useCallback(() => {
    socketService.startMatch();
  }, []);

  const commitBowling = useCallback((intent: BowlingDeliveryIntent) => {
    socketService.commitBowlingDelivery(intent);
  }, []);

  const submitBatting = useCallback((intent: BattingShotIntent) => {
    socketService.submitBattingShot(intent);
  }, []);

  const myParticipant = currentSocketId && roomState?.participants[currentSocketId]
    ? roomState.participants[currentSocketId]
    : null;

  return {
    isConnected,
    pingMs,
    currentSocketId,
    roomState,
    gameState,
    scorecard,
    lastDelivery,
    myParticipant,
    createRoom,
    joinRoom,
    claimSlot,
    setReady,
    startMatch,
    commitBowling,
    submitBatting
  };
}
