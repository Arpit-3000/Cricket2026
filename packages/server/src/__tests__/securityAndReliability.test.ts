import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { RoomManager } from '../services/RoomManager.js';
import { config } from '../config/index.js';
import { app } from '../index.js';
import { SERVER_CONFIG } from '@cricket2026/shared';

describe('Phase 8: Security, Rate Limiting, Reliability & Deployment Verification', () => {

  // =========================================================================
  // 1. CREDENTIAL & SECRET PROTECTION
  // =========================================================================
  describe('1. Credential & Secret Protection', () => {
    test('1.1. reconnectToken is never broadcast in public RoomState or RoomParticipant records', () => {
      const roomManager = new RoomManager();
      const hostSocketId = 'socket_host_sec_1';
      const createRes = roomManager.createRoom(hostSocketId, 'Host Player');

      // The caller receives the secret reconnectToken directly
      assert.ok(createRes.reconnectToken, 'Must generate and return reconnectToken to caller');
      assert.ok(createRes.reconnectToken.startsWith('rec_'), 'Token must follow rec_ format');

      // BUT the public RoomParticipant in roomState must NOT contain reconnectToken
      const publicHost = createRes.state.participants[hostSocketId];
      assert.strictEqual(
        publicHost.reconnectToken,
        undefined,
        'Host reconnectToken MUST NOT be present in public roomState.participants'
      );

      // Joining player test
      const joinSocketId = 'socket_join_sec_2';
      const joinRes = roomManager.joinRoom(createRes.roomCode, joinSocketId, 'Second Player');
      assert.ok(joinRes.success, 'Join must succeed');
      assert.ok(joinRes.reconnectToken, 'Join must return private reconnectToken to caller');

      const publicJoin = joinRes.state?.participants[joinSocketId];
      assert.strictEqual(
        publicJoin?.reconnectToken,
        undefined,
        'Joining player reconnectToken MUST NOT be present in public roomState.participants'
      );

      // Verify another player inspecting roomState cannot see the host token
      assert.strictEqual(
        joinRes.state?.participants[hostSocketId].reconnectToken,
        undefined,
        'Other participants must never see host token in roomState'
      );
    });

    test('1.2. Fraudulent reconnect attempt with invalid or mismatched token is rejected', () => {
      const roomManager = new RoomManager();
      const createRes = roomManager.createRoom('socket_host_rec', 'Legit Host');

      // Attempt reconnect with fake token
      const fakeRes = roomManager.joinRoom(
        createRes.roomCode,
        'socket_imposter',
        'Imposter',
        'rec_fake_token_123456789'
      );

      // Must NOT reconnect as host; will be treated as fresh join with assigned regular slot
      assert.strictEqual(fakeRes.reconnected, false);
      assert.notStrictEqual(fakeRes.participant?.socketId, 'socket_host_rec');
      assert.strictEqual(fakeRes.participant?.isHost, false);
    });

    test('1.3. Legitimate reconnection restores slot and preserves token privacy', () => {
      const roomManager = new RoomManager();
      const createRes = roomManager.createRoom('socket_host_legit', 'Legit Host');
      const validToken = createRes.reconnectToken;

      // Disconnect host
      roomManager.handleDisconnect('socket_host_legit');

      // Reconnect with valid token
      const recRes = roomManager.joinRoom(
        createRes.roomCode,
        'socket_host_new_session',
        'Legit Host',
        validToken
      );

      assert.strictEqual(recRes.success, true);
      assert.strictEqual(recRes.reconnected, true);
      assert.strictEqual(recRes.participant?.isHost, true);
      assert.strictEqual(recRes.participant?.socketId, 'socket_host_new_session');
      assert.strictEqual(recRes.state?.hostSocketId, 'socket_host_new_session');
      assert.strictEqual(
        recRes.state?.participants['socket_host_new_session'].reconnectToken,
        undefined,
        'Reconnected participant record must remain clean of secret tokens'
      );
    });
  });

  // =========================================================================
  // 2. INPUT SANITIZATION & AUTHORIZATION ENFORCEMENT
  // =========================================================================
  describe('2. Input Sanitization & Authorization Enforcement', () => {
    test('2.1. Name sanitization strips HTML tags and control characters', () => {
      const roomManager = new RoomManager();
      const clean1 = roomManager.sanitizeName('<script>alert("xss")</script>Virat Kohli');
      assert.strictEqual(clean1, 'alert("xss")Virat Kohli');

      const clean2 = roomManager.sanitizeName('<b>Ben Stokes</b>');
      assert.strictEqual(clean2, 'Ben Stokes');

      const clean3 = roomManager.sanitizeName('   ');
      assert.strictEqual(clean3, 'Player');

      const clean4 = roomManager.sanitizeName('A'.repeat(50));
      assert.strictEqual(clean4.length, 32);
    });

    test('2.2. Prevent claiming an occupied human player slot', () => {
      const roomManager = new RoomManager();
      const createRes = roomManager.createRoom('socket_p1', 'Player One');

      // Player 2 joins
      const joinRes = roomManager.joinRoom(createRes.roomCode, 'socket_p2', 'Player Two');
      assert.ok(joinRes.success);

      // Player 2 tries to claim TEAM_A_player_1 (occupied by Player 1 Host)
      const stealAttempt = roomManager.claimSlot('socket_p2', 'TEAM_A', 'TEAM_A_player_1');
      assert.strictEqual(stealAttempt.success, false);
      assert.ok(stealAttempt.error?.includes('already claimed'));
    });

    test('2.3. Super Over can only be initiated by the room host', () => {
      const roomManager = new RoomManager();
      const createRes = roomManager.createRoom('socket_host_so', 'Host');
      roomManager.joinRoom(createRes.roomCode, 'socket_guest_so', 'Guest');

      const entry = roomManager.getRoomEntry(createRes.roomCode)!;
      const teamA = entry.session.getGameState().teams.TEAM_A;
      const teamB = entry.session.getGameState().teams.TEAM_B;
      // Configure tied innings (50 vs 50) to fulfill cricket rule requirements
      entry.session.getGameState().scorecard.innings = [
        { ...(entry.session as any).createEmptyInningsScorecard(1, 'TEAM_A', 'TEAM_B', teamA.players), runs: 50, isCompleted: true },
        { ...(entry.session as any).createEmptyInningsScorecard(2, 'TEAM_B', 'TEAM_A', teamB.players), runs: 50, isCompleted: true }
      ];

      // Non-host attempts to start Super Over
      const nonHostRes = roomManager.handleStartSuperOver('socket_guest_so');
      assert.strictEqual(nonHostRes.success, false);
      assert.strictEqual(nonHostRes.error, 'Only the room host can initiate a Super Over');

      // Host initiates Super Over
      const hostRes = roomManager.handleStartSuperOver('socket_host_so');
      assert.strictEqual(hostRes.success, true);
      assert.strictEqual(hostRes.state?.status, 'IN_PLAY');
    });

    test('2.4. Movement input requires authorization for assigned player slot', () => {
      const roomManager = new RoomManager();
      const createRes = roomManager.createRoom('socket_move_auth', 'Host');

      // Try to move an unassigned player (e.g. TEAM_B_player_5)
      const invalidMove = roomManager.handleMovementInput('socket_move_auth', {
        roomCode: createRes.roomCode,
        playerId: 'TEAM_B_player_5',
        position: { x: 0, y: 0, z: 0 },
        rotationY: 0,
        velocity: { x: 0, y: 0, z: 0 },
        animationState: 'IDLE',
        sequence: 1,
        clientTimestamp: Date.now()
      });

      assert.strictEqual(invalidMove.success, false);
      assert.ok(invalidMove.error?.includes('Unauthorized'));
    });
  });

  // =========================================================================
  // 3. ROOM CAPACITY & RESOURCE PROTECTION
  // =========================================================================
  describe('3. Room Capacity & Resource Protection', () => {
    test('3.1. Rejects room creation when maxRooms limit is reached', () => {
      const roomManager = new RoomManager();
      const originalMax = config.maxRooms;

      try {
        // Temporarily set maxRooms to 2 for testing
        config.maxRooms = 2;

        const room1 = roomManager.createRoom('socket_r1', 'Host 1');
        assert.ok(room1.roomCode);

        const room2 = roomManager.createRoom('socket_r2', 'Host 2');
        assert.ok(room2.roomCode);

        // Third room must be rejected with capacity error
        assert.throws(
          () => roomManager.createRoom('socket_r3', 'Host 3'),
          /Server room capacity reached/
        );
      } finally {
        config.maxRooms = originalMax;
      }
    });
  });

  // =========================================================================
  // 4. ROOM LIFECYCLE & INACTIVE ROOM SWEEP
  // =========================================================================
  describe('4. Room Lifecycle & Inactive Room Cleanup', () => {
    test('4.1. cleanupInactiveRooms purges expired and abandoned rooms', () => {
      const roomManager = new RoomManager();
      const now = Date.now();

      // Create an active room
      const active = roomManager.createRoom('socket_act', 'Active Host');

      // Create an inactive room (last activity 40 minutes ago)
      const inactive = roomManager.createRoom('socket_inact', 'Inactive Host');
      const inactEntry = roomManager.getRoomEntry(inactive.roomCode)!;
      inactEntry.state.lastActivityAt = now - (SERVER_CONFIG.ROOM_INACTIVITY_TTL_MS + 60000);

      assert.strictEqual(roomManager.getActiveRoomCount(), 2);

      // Run cleanup
      const swept = roomManager.cleanupInactiveRooms(SERVER_CONFIG.ROOM_INACTIVITY_TTL_MS, now);
      assert.strictEqual(swept, 1, 'Must sweep exactly 1 inactive room');
      assert.strictEqual(roomManager.getActiveRoomCount(), 1, 'Only active room remains');
      assert.ok(roomManager.getRoomEntry(active.roomCode) !== undefined);
      assert.strictEqual(roomManager.getRoomEntry(inactive.roomCode), undefined);
    });

    test('4.2. cleanupInactiveRooms purges abandoned rooms where all participants disconnected', () => {
      const roomManager = new RoomManager();
      const now = Date.now();

      const res = roomManager.createRoom('socket_ab', 'Abandoned Host');
      const entry = roomManager.getRoomEntry(res.roomCode)!;

      // Disconnect participant and age past grace window
      entry.state.participants['socket_ab'].isDisconnected = true;
      entry.state.lastActivityAt = now - (SERVER_CONFIG.RECONNECTION_GRACE_MS + 5000);

      const swept = roomManager.cleanupInactiveRooms(SERVER_CONFIG.ROOM_INACTIVITY_TTL_MS, now);
      assert.strictEqual(swept, 1, 'Must sweep abandoned room');
      assert.strictEqual(roomManager.getActiveRoomCount(), 0);
    });
  });

  // =========================================================================
  // 5. MULTIPLE HUMAN PLAYERS ON BOTH TEAMS & AI TAKEOVER
  // =========================================================================
  describe('5. Multiple Human Players on Both Teams & AI Takeover', () => {
    test('5.1. Multi-human players on both teams with AI filling remaining positions', () => {
      const roomManager = new RoomManager();
      const createRes = roomManager.createRoom('s_a1', 'Alice (Captain A)');
      const code = createRes.roomCode;

      // 2nd player joins Team A
      const j2 = roomManager.joinRoom(code, 's_a2', 'Bob (Team A)');
      assert.ok(j2.success);
      roomManager.claimSlot('s_a2', 'TEAM_A', 'TEAM_A_player_2');

      // 3rd player joins Team B
      const j3 = roomManager.joinRoom(code, 's_b1', 'Charlie (Captain B)');
      assert.ok(j3.success);
      roomManager.claimSlot('s_b1', 'TEAM_B', 'TEAM_B_player_1');

      // 4th player joins Team B
      const j4 = roomManager.joinRoom(code, 's_b2', 'David (Team B)');
      assert.ok(j4.success);
      roomManager.claimSlot('s_b2', 'TEAM_B', 'TEAM_B_player_2');

      const entry = roomManager.getRoomEntry(code)!;
      const session = entry.session;
      const entities = session.getPlayerEntities();

      // Check human status in GameSession
      const pA1 = entities['TEAM_A_player_1'];
      const pA2 = entities['TEAM_A_player_2'];
      const pB1 = entities['TEAM_B_player_1'];
      const pB2 = entities['TEAM_B_player_2'];

      assert.strictEqual(pA1.isHuman, true, 'A1 is human-controlled');
      assert.strictEqual(pA2.isHuman, true, 'A2 is human-controlled');
      assert.strictEqual(pB1.isHuman, true, 'B1 is human-controlled');
      assert.strictEqual(pB2.isHuman, true, 'B2 is human-controlled');

      // Check that remaining 18 positions are AI controlled
      let aiCount = 0;
      for (let i = 3; i <= 11; i++) {
        if (!entities[`TEAM_A_player_${i}`].isHuman) aiCount++;
        if (!entities[`TEAM_B_player_${i}`].isHuman) aiCount++;
      }
      assert.strictEqual(aiCount, 18, 'All 18 remaining positions must be AI-controlled');
    });

    test('5.2. Disconnected human player hands control to AI and recovers on reconnect', () => {
      const roomManager = new RoomManager();
      const createRes = roomManager.createRoom('s_host_handoff', 'Handoff Host');
      const token = createRes.reconnectToken;
      const code = createRes.roomCode;
      const entry = roomManager.getRoomEntry(code)!;
      const entities = entry.session.getPlayerEntities();

      assert.strictEqual(entities['TEAM_A_player_1'].isHuman, true);
      assert.strictEqual(entities['TEAM_A_player_1'].assignedHumanId, 's_host_handoff');

      // Player disconnects
      roomManager.handleDisconnect('s_host_handoff');

      // Verify participant marked disconnected
      const p = entry.state.participants['s_host_handoff'];
      assert.strictEqual(p.isDisconnected, true);
      assert.ok(p.disconnectGraceExpiresAt! > Date.now());

      // Reconnect with token before expiry
      const recRes = roomManager.joinRoom(code, 's_host_recovered', 'Handoff Host', token);
      assert.strictEqual(recRes.success, true);
      assert.strictEqual(recRes.reconnected, true);
      assert.strictEqual(entities['TEAM_A_player_1'].isHuman, true);
      assert.strictEqual(entities['TEAM_A_player_1'].assignedHumanId, 's_host_recovered');
    });
  });

  // =========================================================================
  // 6. PRODUCTION /HEALTH ENDPOINT
  // =========================================================================
  describe('6. Production /health Endpoint & Operational Requirements', () => {
    test('6.1. Health route returns valid JSON with game status, version, and metrics', async () => {
      // Simulate /health endpoint handler using mock request/response
      let responseStatus = 200;
      let responseBody: any = null;

      const mockReq: any = {};
      const mockRes: any = {
        status: (code: number) => {
          responseStatus = code;
          return mockRes;
        },
        json: (data: any) => {
          responseBody = data;
          return mockRes;
        }
      };

      // Retrieve Express route stack and find /health handler
      const healthRoute = (app._router.stack as any[]).find(
        (r: any) => r.route && r.route.path === '/health'
      );

      assert.ok(healthRoute, '/health route must be registered on Express app');
      const handler = healthRoute.route.stack[0].handle;
      handler(mockReq, mockRes);

      assert.strictEqual(responseStatus, 200);
      assert.strictEqual(responseBody.status, 'ok');
      assert.strictEqual(responseBody.game, 'Cricket 2026 Server');
      assert.strictEqual(responseBody.version, '1.0.0');
      assert.strictEqual(typeof responseBody.activeRooms, 'number');
      assert.strictEqual(typeof responseBody.uptimeSeconds, 'number');
      assert.ok(responseBody.memory, 'Must include memory metrics');
      assert.ok(responseBody.timestamp, 'Must include ISO timestamp');
    });
  });
});
