import { io, Socket } from 'socket.io-client';
import {
  ClientToServerEvents,
  ServerToClientEvents,
  RoomState,
  RoomSettings,
  BowlingDeliveryIntent,
  BattingShotIntent,
  PlayerMovementInput,
  TeamId,
  CoinChoice,
  TossDecision,
  UmpireSignal,
  FieldingIntent,
  Vector3D
} from '@cricket2026/shared';

const STORAGE_KEY_TOKEN = 'cricket2026_reconnect_token';
const STORAGE_KEY_ROOM = 'cricket2026_current_room';

const resolveServerUrl = (): string => {
  const envUrl = (import.meta as any).env?.VITE_SERVER_URL;
  if (envUrl && typeof envUrl === 'string' && envUrl.trim().length > 0) {
    return envUrl.trim();
  }
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    return 'http://localhost:4000';
  }
  return '/';
};

class SocketService {
  private socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;
  private serverUrl = resolveServerUrl();

  public connect(): Socket<ServerToClientEvents, ClientToServerEvents> {
    if (!this.socket) {
      this.socket = io(this.serverUrl, {
        transports: ['websocket', 'polling'],
        autoConnect: true,
        reconnectionAttempts: 8,
        reconnectionDelay: 1000
      });

      this.socket.on('connect', () => {
        console.log('[SocketService] Connected to game server:', this.socket?.id);
      });

      this.socket.on('disconnect', (reason) => {
        console.warn('[SocketService] Disconnected:', reason);
      });
    }
    return this.socket;
  }

  public getSocket(): Socket<ServerToClientEvents, ClientToServerEvents> | null {
    return this.socket;
  }

  public getSavedReconnectInfo(): { roomCode: string | null; reconnectToken: string | null } {
    return {
      roomCode: localStorage.getItem(STORAGE_KEY_ROOM),
      reconnectToken: localStorage.getItem(STORAGE_KEY_TOKEN)
    };
  }

  public saveReconnectInfo(roomCode: string, token: string): void {
    localStorage.setItem(STORAGE_KEY_ROOM, roomCode);
    localStorage.setItem(STORAGE_KEY_TOKEN, token);
  }

  public clearReconnectInfo(): void {
    localStorage.removeItem(STORAGE_KEY_ROOM);
    localStorage.removeItem(STORAGE_KEY_TOKEN);
  }

  public createRoom(
    hostName: string,
    settings?: Partial<RoomSettings>
  ): Promise<{ success: boolean; roomCode?: string; reconnectToken?: string; error?: string }> {
    return new Promise((resolve) => {
      if (!this.socket) return resolve({ success: false, error: 'Socket not connected' });
      this.socket.emit('room:create', { hostName, settings }, (res) => {
        if (res.success && res.roomCode && res.reconnectToken) {
          this.saveReconnectInfo(res.roomCode, res.reconnectToken);
        }
        resolve(res);
      });
    });
  }

  public joinRoom(
    roomCode: string,
    displayName: string,
    reconnectToken?: string
  ): Promise<{ success: boolean; roomState?: RoomState; reconnectToken?: string; error?: string }> {
    return new Promise((resolve) => {
      if (!this.socket) return resolve({ success: false, error: 'Socket not connected' });
      const token = reconnectToken || localStorage.getItem(STORAGE_KEY_TOKEN) || undefined;
      this.socket.emit('room:join', { roomCode, displayName, reconnectToken: token }, (res) => {
        if (res.success && res.roomState && res.reconnectToken) {
          this.saveReconnectInfo(res.roomState.roomCode, res.reconnectToken);
        }
        resolve(res);
      });
    });
  }

  public leaveRoom(): void {
    this.socket?.emit('room:leave');
    this.clearReconnectInfo();
  }

  public claimSlot(teamId: 'TEAM_A' | 'TEAM_B', playerId: string): void {
    this.socket?.emit('room:claim_slot', { teamId, playerId });
  }

  public releaseSlot(): void {
    this.socket?.emit('room:release_slot');
  }

  public updateSettings(settings: Partial<RoomSettings>): void {
    this.socket?.emit('room:update_settings', settings);
  }

  public setReady(ready: boolean): void {
    this.socket?.emit('room:set_ready', { ready });
  }

  public startMatch(): void {
    this.socket?.emit('room:start_match');
  }

  public sendMovementInput(input: PlayerMovementInput): void {
    this.socket?.emit('player:move_input', input);
  }

  public commitBowlingDelivery(intent: BowlingDeliveryIntent): void {
    this.socket?.emit('game:bowler_commit_delivery', intent);
  }

  public submitBattingShot(intent: BattingShotIntent): void {
    this.socket?.emit('game:batter_shot_input', intent);
  }

  public callRun(runner: 'STRIKER' | 'NON_STRIKER' = 'STRIKER'): void {
    this.socket?.emit('game:call_run', { runner });
  }

  public updateLineup(payload: {
    teamId: TeamId;
    captainId?: string;
    wicketKeeperId?: string;
    battingOrder?: string[];
    playerRoles?: Record<string, string>;
    name?: string;
    primaryColor?: string;
    secondaryColor?: string;
  }): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve) => {
      if (!this.socket) return resolve({ success: false, error: 'Not connected' });
      this.socket.emit('team:update_lineup', payload, (res) => {
        resolve(res || { success: true });
      });
    });
  }

  public assignUmpire(
    umpireSocketId: string | null,
    mode: 'AI_AUTOMATION' | 'MANUAL_HUMAN' = 'MANUAL_HUMAN'
  ): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve) => {
      if (!this.socket) return resolve({ success: false, error: 'Not connected' });
      this.socket.emit('room:assign_umpire', { umpireSocketId, mode }, (res) => {
        resolve(res || { success: true });
      });
    });
  }

  public startToss(): void {
    this.socket?.emit('toss:start');
  }

  public callToss(choice: CoinChoice): void {
    this.socket?.emit('toss:call', { choice });
  }

  public decideToss(decision: TossDecision): void {
    this.socket?.emit('toss:decision', { decision });
  }

  public sendUmpireSignal(signal: UmpireSignal, reason: string): void {
    this.socket?.emit('umpire:manual_signal', { signal, reason });
  }

  public sendFielderAction(intent: FieldingIntent): void {
    this.socket?.emit('game:fielder_action', intent);
  }

  public adjustFieldPosition(fielderId: string, position: Vector3D): void {
    this.socket?.emit('field:adjust_position', { fielderId, position });
  }

  public applyFieldPreset(preset: 'ATTACKING' | 'DEFENSIVE' | 'BALANCED'): void {
    this.socket?.emit('field:apply_preset', { preset });
  }

  public appeal(appealType: string = 'HOWZAT'): void {
    this.socket?.emit('umpire:appeal', { appealType });
  }

  public rematch(): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve) => {
      if (!this.socket) return resolve({ success: false, error: 'Not connected' });
      this.socket.emit('room:rematch', (res: { success: boolean; error?: string }) => {
        resolve(res || { success: true });
      });
    });
  }

  public returnToLobby(): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve) => {
      if (!this.socket) return resolve({ success: false, error: 'Not connected' });
      this.socket.emit('room:return_to_lobby', (res: { success: boolean; error?: string }) => {
        resolve(res || { success: true });
      });
    });
  }

  public startSuperOver(): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve) => {
      if (!this.socket) return resolve({ success: false, error: 'Not connected' });
      this.socket.emit('game:start_super_over', (res: { success: boolean; error?: string }) => {
        resolve(res || { success: true });
      });
    });
  }

  public ping(): Promise<number> {
    return new Promise((resolve) => {
      if (!this.socket) return resolve(0);
      const start = Date.now();
      this.socket.emit('ping:sync', { clientTimestamp: start }, (_serverTimestamp) => {
        const rtt = Date.now() - start;
        resolve(Math.round(rtt / 2));
      });
    });
  }
}

export const socketService = new SocketService();

