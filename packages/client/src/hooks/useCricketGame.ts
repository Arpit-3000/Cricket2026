import { useState, useEffect, useCallback } from 'react';
import {
  RoomState,
  RoomSettings,
  RoomNotification,
  CricketGameState,
  MatchScorecard,
  DeliveryRecord,
  BowlingDeliveryIntent,
  BattingShotIntent,
  PlayerMovementInput,
  PlayerEntityState,
  TeamId,
  CoinChoice,
  TossDecision,
  UmpireSignal,
  UmpireDecisionEvent,
  FieldingIntent,
  Vector3D
} from '@cricket2026/shared';
import { socketService } from '../services/socketService.js';

export function useCricketGame() {
  const [isConnected, setIsConnected] = useState(false);
  const [pingMs, setPingMs] = useState(0);
  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const [gameState, setGameState] = useState<CricketGameState | null>(null);
  const [playerEntities, setPlayerEntities] = useState<Record<string, PlayerEntityState>>({});
  const [notifications, setNotifications] = useState<RoomNotification[]>([]);
  const [errorNotification, setErrorNotification] = useState<{ code: string; message: string } | null>(null);
  const [scorecard, setScorecard] = useState<MatchScorecard | null>(null);
  const [lastDelivery, setLastDelivery] = useState<DeliveryRecord | null>(null);
  const [currentSocketId, setCurrentSocketId] = useState<string>('');
  const [coinFlipping, setCoinFlipping] = useState<boolean>(false);
  const [coinFlipResult, setCoinFlipResult] = useState<{
    coinResult: CoinChoice;
    winnerTeamId: TeamId;
    winnerCaptainName: string;
  } | null>(null);
  const [umpirePrompt, setUmpirePrompt] = useState<{
    signalType: string;
    deadlineMs: number;
    timeoutSeconds: number;
  } | null>(null);
  const [lastUmpireSignal, setLastUmpireSignal] = useState<UmpireDecisionEvent | null>(null);
  const [overEnded, setOverEnded] = useState<{ overIndex: number; runs: number; wickets: number } | null>(null);
  const [inningsTransition, setInningsTransition] = useState<{ nextInnings: 2; target: number } | null>(null);
  const [inningsBreakData, setInningsBreakData] = useState<{
    inningsIndex: 1;
    target: number;
    requiredRunRate: number;
    commentary: string;
  } | null>(null);
  const [superOverData, setSuperOverData] = useState<{
    gameState: CricketGameState;
  } | null>(null);
  const [matchFinished, setMatchFinished] = useState<{
    winnerTeamId: TeamId | 'TIE';
    commentary: string;
    scorecard: MatchScorecard;
  } | null>(null);

  const addNotification = useCallback((notif: RoomNotification) => {
    setNotifications((prev) => [notif, ...prev.slice(0, 9)]);
  }, []);

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

    socket.on('room:notification', (notification: RoomNotification) => {
      addNotification(notification);
    });

    socket.on('error:notification', (err: { code: string; message: string }) => {
      setErrorNotification(err);
      setTimeout(() => setErrorNotification(null), 5000);
    });

    socket.on('player:sync', (entity: PlayerEntityState) => {
      setPlayerEntities((prev) => ({
        ...prev,
        [entity.playerId]: entity
      }));
    });

    socket.on('player:batch_sync', (batch) => {
      setPlayerEntities(batch.players);
    });

    socket.on('game:tick', (sync) => {
      if (sync.players) {
        setPlayerEntities(sync.players);
      }
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

    socket.on('game:over_ended', (payload) => {
      setOverEnded(payload);
      setTimeout(() => setOverEnded(null), 5000);
    });

    socket.on('game:innings_transition', (payload) => {
      setInningsTransition(payload);
      setTimeout(() => setInningsTransition(null), 8000);
    });

    socket.on('game:match_finished', (payload) => {
      setMatchFinished(payload);
    });

    socket.on('game:innings_break', (payload) => {
      setInningsBreakData(payload);
    });

    socket.on('game:super_over_started', (payload) => {
      setSuperOverData(payload);
      setInningsBreakData(null);
    });

    socket.on('game:rematch_started', () => {
      setMatchFinished(null);
      setInningsBreakData(null);
      setSuperOverData(null);
      setLastDelivery(null);
      setLastUmpireSignal(null);
    });

    socket.on('game:returned_to_lobby', () => {
      setMatchFinished(null);
      setInningsBreakData(null);
      setSuperOverData(null);
      setGameState(null);
    });

    socket.on('toss:started', () => {
      setCoinFlipping(false);
      setCoinFlipResult(null);
    });

    socket.on('toss:flipped', (payload) => {
      setCoinFlipping(true);
      setCoinFlipResult({
        coinResult: payload.coinResult,
        winnerTeamId: payload.winnerTeamId,
        winnerCaptainName: payload.winnerCaptainName
      });
      setTimeout(() => {
        setCoinFlipping(false);
      }, payload.flipDurationMs || 2500);
    });

    socket.on('toss:completed', () => {
      setCoinFlipping(false);
    });

    socket.on('umpire:prompt', (prompt) => {
      setUmpirePrompt(prompt);
    });

    socket.on('umpire:timeout', () => {
      setUmpirePrompt(null);
    });

    socket.on('umpire:signal_broadcast', (event) => {
      setLastUmpireSignal(event);
      setUmpirePrompt(null);
      setTimeout(() => setLastUmpireSignal(null), 4000);
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
      socket.off('room:notification');
      socket.off('error:notification');
      socket.off('player:sync');
      socket.off('player:batch_sync');
      socket.off('game:tick');
      socket.off('game:init_match');
      socket.off('game:scorecard_sync');
      socket.off('game:delivery_completed');
      socket.off('toss:started');
      socket.off('toss:flipped');
      socket.off('toss:completed');
      socket.off('umpire:prompt');
      socket.off('umpire:timeout');
      socket.off('umpire:signal_broadcast');
      socket.off('game:over_ended');
      socket.off('game:innings_transition');
      socket.off('game:match_finished');
      socket.off('game:innings_break');
      socket.off('game:super_over_started');
      socket.off('game:rematch_started');
      socket.off('game:returned_to_lobby');
    };
  }, [addNotification]);

  const createRoom = useCallback(async (hostName: string, settings?: Partial<RoomSettings>) => {
    return await socketService.createRoom(hostName, settings);
  }, []);

  const joinRoom = useCallback(async (roomCode: string, displayName: string, reconnectToken?: string) => {
    return await socketService.joinRoom(roomCode, displayName, reconnectToken);
  }, []);

  const leaveRoom = useCallback(() => {
    socketService.leaveRoom();
    setRoomState(null);
    setGameState(null);
    setPlayerEntities({});
  }, []);

  const claimSlot = useCallback((teamId: 'TEAM_A' | 'TEAM_B', playerId: string) => {
    socketService.claimSlot(teamId, playerId);
  }, []);

  const releaseSlot = useCallback(() => {
    socketService.releaseSlot();
  }, []);

  const updateSettings = useCallback((settings: Partial<RoomSettings>) => {
    socketService.updateSettings(settings);
  }, []);

  const setReady = useCallback((ready: boolean) => {
    socketService.setReady(ready);
  }, []);

  const startMatch = useCallback(() => {
    socketService.startMatch();
  }, []);

  const sendPlayerMovement = useCallback((input: PlayerMovementInput) => {
    socketService.sendMovementInput(input);
  }, []);

  const commitBowling = useCallback((intent: BowlingDeliveryIntent) => {
    socketService.commitBowlingDelivery(intent);
  }, []);

  const submitBatting = useCallback((intent: BattingShotIntent) => {
    socketService.submitBattingShot(intent);
  }, []);

  const updateLineup = useCallback(async (payload: {
    teamId: TeamId;
    captainId?: string;
    wicketKeeperId?: string;
    battingOrder?: string[];
    playerRoles?: Record<string, string>;
    name?: string;
    primaryColor?: string;
    secondaryColor?: string;
  }) => {
    return await socketService.updateLineup(payload);
  }, []);

  const assignUmpire = useCallback(async (umpireSocketId: string | null, mode?: 'AI_AUTOMATION' | 'MANUAL_HUMAN') => {
    return await socketService.assignUmpire(umpireSocketId, mode);
  }, []);

  const startToss = useCallback(() => {
    socketService.startToss();
  }, []);

  const callToss = useCallback((choice: CoinChoice) => {
    socketService.callToss(choice);
  }, []);

  const decideToss = useCallback((decision: TossDecision) => {
    socketService.decideToss(decision);
  }, []);

  const sendUmpireSignal = useCallback((signal: UmpireSignal, reason: string = 'Manual Umpire decision') => {
    socketService.sendUmpireSignal(signal, reason);
  }, []);

  const callRun = useCallback((runner: 'STRIKER' | 'NON_STRIKER' = 'STRIKER') => {
    socketService.callRun(runner);
  }, []);

  const sendFielderAction = useCallback((intent: FieldingIntent) => {
    socketService.sendFielderAction(intent);
  }, []);

  const adjustFieldPosition = useCallback((fielderId: string, position: Vector3D) => {
    socketService.adjustFieldPosition(fielderId, position);
  }, []);

  const applyFieldPreset = useCallback((preset: 'ATTACKING' | 'DEFENSIVE' | 'BALANCED') => {
    socketService.applyFieldPreset(preset);
  }, []);

  const appeal = useCallback((appealType: 'HOWZAT' | 'LBW' | 'CAUGHT' | 'RUN_OUT' = 'HOWZAT') => {
    socketService.appeal(appealType);
  }, []);

  const rematch = useCallback(() => {
    socketService.rematch();
  }, []);

  const returnToLobby = useCallback(() => {
    socketService.returnToLobby();
  }, []);

  const startSuperOver = useCallback(() => {
    socketService.startSuperOver();
  }, []);

  const clearInningsBreak = useCallback(() => {
    setInningsBreakData(null);
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
    playerEntities,
    notifications,
    errorNotification,
    scorecard,
    lastDelivery,
    myParticipant,
    coinFlipping,
    coinFlipResult,
    umpirePrompt,
    lastUmpireSignal,
    inningsBreakData,
    superOverData,
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
    startToss,
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
    clearInningsBreak,
    overEnded,
    inningsTransition,
    matchFinished
  };
}

