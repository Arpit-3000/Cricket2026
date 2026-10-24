import { io, Socket } from 'socket.io-client';
import {
  ClientToServerEvents,
  ServerToClientEvents,
  RoomState,
  RoomSettings,
  BowlingDeliveryIntent,
  BattingShotIntent
} from '@cricket2026/shared';

class SocketService {
  private socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;
  private serverUrl = window.location.hostname === 'localhost' ? 'http://localhost:4000' : '/';

  public connect(): Socket<ServerToClientEvents, ClientToServerEvents> {
    if (!this.socket) {
      this.socket = io(this.serverUrl, {
        transports: ['websocket', 'polling'],
        autoConnect: true,
        reconnectionAttempts: 5,
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

  public createRoom(
    hostName: string,
    settings?: Partial<RoomSettings>
  ): Promise<{ success: boolean; roomCode?: string; error?: string }> {
    return new Promise((resolve) => {
      if (!this.socket) return resolve({ success: false, error: 'Socket not connected' });
      this.socket.emit('room:create', { hostName, settings }, resolve);
    });
  }

  public joinRoom(
    roomCode: string,
    displayName: string,
    reconnectToken?: string
  ): Promise<{ success: boolean; roomState?: RoomState; error?: string }> {
    return new Promise((resolve) => {
      if (!this.socket) return resolve({ success: false, error: 'Socket not connected' });
      this.socket.emit('room:join', { roomCode, displayName, reconnectToken }, resolve);
    });
  }

  public claimSlot(teamId: 'TEAM_A' | 'TEAM_B', playerId: string): void {
    this.socket?.emit('room:claim_slot', { teamId, playerId });
  }

  public setReady(ready: boolean): void {
    this.socket?.emit('room:set_ready', { ready });
  }

  public startMatch(): void {
    this.socket?.emit('room:start_match');
  }

  public commitBowlingDelivery(intent: BowlingDeliveryIntent): void {
    this.socket?.emit('game:bowler_commit_delivery', intent);
  }

  public submitBattingShot(intent: BattingShotIntent): void {
    this.socket?.emit('game:batter_shot_input', intent);
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
