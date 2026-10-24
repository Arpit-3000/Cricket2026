import test from 'node:test';
import assert from 'node:assert';
import { RoomManager } from '../services/RoomManager.js';
import {
  isValidRoomCode,
  validatePlayerMovement,
  GROUND_DIMENSIONS,
  PlayerMovementInput
} from '@cricket2026/shared';

test('Multiplayer Room Management & Sync Test Suite', async (t) => {
  await t.test('1. Room Creation with Unique 6-Character Code', () => {
    const rm = new RoomManager();
    const res = rm.createRoom('socket_host_1', 'Captain Virat');

    assert.strictEqual(res.roomCode.length, 6, 'Room code must be exactly 6 characters');
    assert.match(res.roomCode, /^[A-Z0-9]{6}$/, 'Room code must be alphanumeric uppercase');
    assert.strictEqual(res.state.hostSocketId, 'socket_host_1', 'Host socket ID must be recorded');
    assert.strictEqual(res.state.status, 'LOBBY', 'Room must start in LOBBY state');
    assert.strictEqual(res.state.participants['socket_host_1'].isHost, true, 'Host participant must have isHost=true');
    assert.ok(res.reconnectToken.startsWith('rec_'), 'Must return reconnect token');

    // Verify session initialized host in Team A player 1
    const session = rm.getRoomEntry(res.roomCode)!.session;
    const teamA0 = session.getGameState().teams.TEAM_A.players[0];
    assert.strictEqual(teamA0.isAi, false, 'Host slot must be human-controlled');
    assert.strictEqual(teamA0.assignedHumanId, 'socket_host_1');
  });

  await t.test('2. Room Code Validation & Invalid Codes Rejection', () => {
    assert.strictEqual(isValidRoomCode('CRK9A2'), true);
    assert.strictEqual(isValidRoomCode('ABC123'), true);
    assert.strictEqual(isValidRoomCode('short'), false);
    assert.strictEqual(isValidRoomCode('toolongcode'), false);
    assert.strictEqual(isValidRoomCode(''), false);
    assert.strictEqual(isValidRoomCode('!@#$%^'), false);

    const rm = new RoomManager();
    const joinNonExistent = rm.joinRoom('UNKNOWN', 'socket_client_1', 'Player Two');
    assert.strictEqual(joinNonExistent.success, false, 'Joining non-existent room must fail');
    assert.match(joinNonExistent.error!, /does not exist/);
  });

  await t.test('3. Multi-Player Joining, Friend List & Team Balancing', () => {
    const rm = new RoomManager();
    const { roomCode } = rm.createRoom('socket_host', 'Host Player');

    // Second player joins -> balanced to Team B
    const res2 = rm.joinRoom(roomCode, 'socket_player_2', 'Friend Steve');
    assert.strictEqual(res2.success, true);
    assert.strictEqual(res2.state?.participants['socket_player_2'].displayName, 'Friend Steve');
    assert.strictEqual(res2.state?.participants['socket_player_2'].assignedTeamId, 'TEAM_B');
    assert.strictEqual(res2.state?.participants['socket_player_2'].isHost, false);

    // Third player joins -> balanced to Team A
    const res3 = rm.joinRoom(roomCode, 'socket_player_3', 'Friend Rohit');
    assert.strictEqual(res3.success, true);
    assert.strictEqual(res3.state?.participants['socket_player_3'].assignedTeamId, 'TEAM_A');

    // Total connected participants is 3
    const entry = rm.getRoomEntry(roomCode)!;
    assert.strictEqual(Object.keys(entry.state.participants).length, 3);
  });

  await t.test('4. 11v11 Playing XI Positions & Slot Claiming & Duplicate Prevention', () => {
    const rm = new RoomManager();
    const { roomCode } = rm.createRoom('socket_host', 'Host Player');
    rm.joinRoom(roomCode, 'socket_player_2', 'Player Two');

    // Player 2 claims TEAM_B_player_5
    const claimRes = rm.claimSlot('socket_player_2', 'TEAM_B', 'TEAM_B_player_5');
    assert.strictEqual(claimRes.success, true);

    const entry = rm.getRoomEntry(roomCode)!;
    assert.strictEqual(entry.state.participants['socket_player_2'].assignedPlayerId, 'TEAM_B_player_5');

    // Verify session entity marks human control
    const entity = entry.session.getPlayerEntity('TEAM_B_player_5');
    assert.strictEqual(entity?.isHuman, true);
    assert.strictEqual(entity?.assignedHumanId, 'socket_player_2');

    // Vacant positions remain AI-controlled
    const aiEntity = entry.session.getPlayerEntity('TEAM_B_player_6');
    assert.strictEqual(aiEntity?.isHuman, false);

    // Duplicate Claim Prevention: Host attempts to claim TEAM_B_player_5 occupied by Player Two
    const stealAttempt = rm.claimSlot('socket_host', 'TEAM_B', 'TEAM_B_player_5');
    assert.strictEqual(stealAttempt.success, false, 'Stealing occupied slot must be rejected');
    assert.match(stealAttempt.error!, /already claimed/);
  });

  await t.test('5. Documented Minimum Player Requirement Validation', () => {
    const rm = new RoomManager();
    // Default minPlayersPerTeam is 1
    const { roomCode } = rm.createRoom('socket_host', 'Host Player');

    // Case A: Only Host in Room (Team A has 1, Team B has 0)
    const check1 = rm.canStartMatch(roomCode);
    assert.strictEqual(check1.canStart, false, 'Cannot start with 0 human players on Team B');
    assert.match(check1.reason!, /Team B requires at least 1 human player/);

    // Case B: Player joins Team B but is not ready
    rm.joinRoom(roomCode, 'socket_player_b', 'Titan Player');
    const entry = rm.getRoomEntry(roomCode)!;
    entry.state.participants['socket_player_b'].isReady = false;

    const check2 = rm.canStartMatch(roomCode);
    assert.strictEqual(check2.canStart, false, 'Cannot start while human players are not ready');
    assert.match(check2.reason!, /Waiting for/);

    // Case C: Both players ready -> Match can start!
    entry.state.participants['socket_player_b'].isReady = true;
    entry.state.participants['socket_host'].isReady = true;

    const check3 = rm.canStartMatch(roomCode);
    assert.strictEqual(check3.canStart, true, 'Match must start when minimum requirement satisfied');
  });

  await t.test('6. Authorization & Duplicate Control Prevention', () => {
    const rm = new RoomManager();
    const { roomCode } = rm.createRoom('socket_host', 'Host Player');
    rm.joinRoom(roomCode, 'socket_friend', 'Friend Player');

    // Host is assigned TEAM_A_player_1
    // Friend is assigned TEAM_B_player_1 (or another)
    const entry = rm.getRoomEntry(roomCode)!;
    const friendSlot = entry.state.participants['socket_friend'].assignedPlayerId!;

    // Friend attempts to control Host's player (TEAM_A_player_1)
    const spoofMovement: PlayerMovementInput = {
      roomCode,
      playerId: 'TEAM_A_player_1', // belongs to host!
      position: { x: 5, y: 0, z: 10 },
      rotationY: 0,
      velocity: { x: 0, y: 0, z: 0 },
      animationState: 'RUN',
      sequence: 1,
      clientTimestamp: Date.now()
    };

    const hackedResult = rm.handleMovementInput('socket_friend', spoofMovement);
    assert.strictEqual(hackedResult.success, false, 'Client cannot control another player');
    assert.match(hackedResult.error!, /Unauthorized/);

    // Friend attempts to control an unassigned AI player (TEAM_A_player_5)
    spoofMovement.playerId = 'TEAM_A_player_5';
    const aiControlResult = rm.handleMovementInput('socket_friend', spoofMovement);
    assert.strictEqual(aiControlResult.success, false, 'Client cannot control AI players');
    assert.match(aiControlResult.error!, /Unauthorized/);

    // Friend moves their OWN player -> Allowed!
    const legitMovement: PlayerMovementInput = {
      roomCode,
      playerId: friendSlot,
      position: { x: 2, y: 0, z: 5 },
      rotationY: 0.5,
      velocity: { x: 1, y: 0, z: 1 },
      animationState: 'SPRINT',
      sequence: 1,
      clientTimestamp: Date.now()
    };
    const legitResult = rm.handleMovementInput('socket_friend', legitMovement);
    assert.strictEqual(legitResult.success, true, 'Controlling own assigned slot must succeed');
    assert.strictEqual(legitResult.authoritativeState?.playerId, friendSlot);
    assert.strictEqual(legitResult.authoritativeState?.animationState, 'SPRINT');
  });

  await t.test('7. Stale Input & Sequence Tracking', async () => {
    const rm = new RoomManager();
    const { roomCode } = rm.createRoom('socket_host', 'Host Player');

    const moveSeq5: PlayerMovementInput = {
      roomCode,
      playerId: 'TEAM_A_player_1',
      position: { x: 1, y: 0, z: 1 },
      rotationY: 0,
      velocity: { x: 0, y: 0, z: 0 },
      animationState: 'RUN',
      sequence: 5,
      clientTimestamp: Date.now()
    };

    const res1 = rm.handleMovementInput('socket_host', moveSeq5);
    assert.strictEqual(res1.success, true);

    // Wait 25ms to exceed the 20ms minimum rate-limit interval
    await new Promise(resolve => setTimeout(resolve, 25));

    // Submitting older sequence 4 (stale input)
    const moveSeq4: PlayerMovementInput = {
      ...moveSeq5,
      sequence: 4
    };
    const res2 = rm.handleMovementInput('socket_host', moveSeq4);
    assert.strictEqual(res2.success, false, 'Stale sequence must be discarded');
    assert.strictEqual(res2.stale, true);

    // Wait 25ms again
    await new Promise(resolve => setTimeout(resolve, 25));

    // Submitting duplicate sequence 5
    const res3 = rm.handleMovementInput('socket_host', moveSeq5);
    assert.strictEqual(res3.success, false, 'Duplicate sequence must be discarded');
    assert.strictEqual(res3.stale, true);
  });

  await t.test('8. Rate Limiting Protection', () => {
    const rm = new RoomManager();
    const { roomCode } = rm.createRoom('socket_host', 'Host Player');

    // First legitimate packet
    const baseMove: PlayerMovementInput = {
      roomCode,
      playerId: 'TEAM_A_player_1',
      position: { x: 0, y: 0, z: 0 },
      rotationY: 0,
      velocity: { x: 0, y: 0, z: 0 },
      animationState: 'RUN',
      sequence: 10,
      clientTimestamp: Date.now()
    };
    const res1 = rm.handleMovementInput('socket_host', baseMove);
    assert.strictEqual(res1.success, true);

    // Immediate second packet without waiting 20ms
    const rapidMove: PlayerMovementInput = {
      ...baseMove,
      sequence: 11
    };
    const res2 = rm.handleMovementInput('socket_host', rapidMove);
    assert.strictEqual(res2.success, false, 'Spammed input below min interval must be rate-limited');
    assert.strictEqual(res2.rateLimited, true);
  });

  await t.test('9. Movement Boundary & Speed Clamp Validation', () => {
    // 1. Position outside boundary circle (e.g. 100m away, boundary is 65m)
    const outsideMove: PlayerMovementInput = {
      roomCode: 'CRK9A2',
      playerId: 'player_1',
      position: { x: 100, y: 0, z: 0 },
      rotationY: 0,
      velocity: { x: 0, y: 0, z: 0 },
      animationState: 'RUN',
      sequence: 1,
      clientTimestamp: Date.now()
    };

    const res = validatePlayerMovement(outsideMove);
    assert.strictEqual(res.valid, true);
    assert.ok(res.correctedPosition, 'Must provide clamped position');
    assert.ok(res.correctedPosition!.x <= GROUND_DIMENSIONS.BOUNDARY_RADIUS_METERS + 3.0);
  });

  await t.test('10. Leave Room, Host Migration & Empty Room Cleanup', () => {
    const rm = new RoomManager();
    const { roomCode } = rm.createRoom('socket_host', 'Host Player');
    rm.joinRoom(roomCode, 'socket_guest', 'Guest Player');

    // Host leaves room -> Host migrates to Guest Player
    const leaveHost = rm.leaveRoom('socket_host');
    assert.strictEqual(leaveHost.success, true);
    assert.strictEqual(leaveHost.hostMigrated, true);
    assert.strictEqual(leaveHost.newHostSocketId, 'socket_guest');
    assert.strictEqual(leaveHost.roomDestroyed, false);

    const entry = rm.getRoomEntry(roomCode)!;
    assert.strictEqual(entry.state.hostSocketId, 'socket_guest');
    assert.strictEqual(entry.state.participants['socket_guest'].isHost, true);

    // Guest leaves -> Room is empty and destroyed cleanly
    const leaveGuest = rm.leaveRoom('socket_guest');
    assert.strictEqual(leaveGuest.success, true);
    assert.strictEqual(leaveGuest.roomDestroyed, true);
    assert.strictEqual(rm.getRoomEntry(roomCode), undefined, 'Empty room must be cleaned up');
  });

  await t.test('11. Disconnect Grace Period & Reconnection with Token', () => {
    const rm = new RoomManager();
    const { roomCode, reconnectToken } = rm.createRoom('socket_original', 'Virat');

    // Participant disconnects -> sets isDisconnected = true
    const dc = rm.handleDisconnect('socket_original');
    assert.strictEqual(dc.left, true);
    assert.strictEqual(dc.roomCode, roomCode);

    const entry = rm.getRoomEntry(roomCode)!;
    assert.strictEqual(entry.state.participants['socket_original'].isDisconnected, true);
    assert.ok(entry.state.participants['socket_original'].disconnectGraceExpiresAt! > Date.now());

    // Reconnecting with new socket and token
    const rec = rm.joinRoom(roomCode, 'socket_reconnected', 'Virat', reconnectToken);
    assert.strictEqual(rec.success, true);
    assert.strictEqual(rec.reconnected, true);
    assert.strictEqual(rec.participant?.socketId, 'socket_reconnected');
    assert.strictEqual(rec.participant?.isDisconnected, false);
    assert.strictEqual(rec.participant?.assignedPlayerId, 'TEAM_A_player_1', 'Slot preserved across reconnect');

    // Disconnect timer cleared
    assert.strictEqual(entry.disconnectTimers.has('socket_original'), false);
  });

  await t.test('12. Room Isolation', () => {
    const rm = new RoomManager();
    const room1 = rm.createRoom('socket_h1', 'Host 1');
    const room2 = rm.createRoom('socket_h2', 'Host 2');

    assert.notStrictEqual(room1.roomCode, room2.roomCode, 'Room codes must be distinct');

    // Movement in Room 1 does not affect Room 2
    const moveR1: PlayerMovementInput = {
      roomCode: room1.roomCode,
      playerId: 'TEAM_A_player_1',
      position: { x: 12, y: 0, z: 8 },
      rotationY: 1.2,
      velocity: { x: 0, y: 0, z: 0 },
      animationState: 'RUN',
      sequence: 1,
      clientTimestamp: Date.now()
    };
    rm.handleMovementInput('socket_h1', moveR1);

    const r1Entity = rm.getRoomEntry(room1.roomCode)!.session.getPlayerEntity('TEAM_A_player_1')!;
    const r2Entity = rm.getRoomEntry(room2.roomCode)!.session.getPlayerEntity('TEAM_A_player_1')!;

    assert.strictEqual(r1Entity.position.x, 12);
    assert.notStrictEqual(r2Entity.position.x, 12, 'Room 2 entity must remain isolated and unaffected');
  });
});
