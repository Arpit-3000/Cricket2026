import test from 'node:test';
import assert from 'node:assert';
import { RoomManager } from '../services/RoomManager.js';
import {
  canTransitionMatchPhase,
  CRICKET_RULES,
  validateLineupUpdate,
  validateUmpireSignal,
  PERMITTED_UMPIRE_SIGNALS,
  TeamId
} from '@cricket2026/shared';

test('Phase 3: Pre-Match Experience, Toss, Umpire & State Machine Suite', async (t) => {
  await t.test('1. Default Match Configuration (5 overs, 11 positions per team, AI fill)', () => {
    const rm = new RoomManager();
    const { roomCode, state } = rm.createRoom('host_socket_1', 'Rohit');

    assert.strictEqual(state.settings.maxOversPerInnings, 5, 'Default overs per innings must be exactly 5');
    assert.strictEqual(CRICKET_RULES.DEFAULT_OVERS_PER_INNINGS, 5, 'Shared constant default must be 5 overs');

    const entry = rm.getRoomEntry(roomCode)!;
    const gameState = entry.session.getGameState();

    assert.strictEqual(gameState.teams.TEAM_A.players.length, 11, 'Team A must have exactly 11 players');
    assert.strictEqual(gameState.teams.TEAM_B.players.length, 11, 'Team B must have exactly 11 players');

    // Host occupies slot 0 on Team A
    assert.strictEqual(gameState.teams.TEAM_A.players[0].isAi, false, 'Host player is human');
    assert.strictEqual(gameState.teams.TEAM_A.players[0].assignedHumanId, 'host_socket_1');

    // Remaining slots on Team A must be AI
    for (let i = 1; i < 11; i++) {
      assert.strictEqual(gameState.teams.TEAM_A.players[i].isAi, true, `Team A slot ${i} must be AI`);
    }

    // All slots on Team B must be AI initially
    for (let i = 0; i < 11; i++) {
      assert.strictEqual(gameState.teams.TEAM_B.players[i].isAi, true, `Team B slot ${i} must be AI`);
    }
  });

  await t.test('2. Lineup Customization (Captain, Wicketkeeper, Batting Order, Roles & Jersey)', () => {
    const rm = new RoomManager();
    const { roomCode } = rm.createRoom('host_socket', 'Captain Player');

    const entry = rm.getRoomEntry(roomCode)!;
    const initialPlayers = entry.session.getGameState().teams.TEAM_A.players;

    // Batting order reversed
    const customBattingOrder = [...initialPlayers.map(p => p.id)].reverse();
    const captainId = customBattingOrder[0];
    const wicketkeeperId = customBattingOrder[1];

    const lineupPayload = {
      teamId: 'TEAM_A' as TeamId,
      name: 'Mumbai Strikers',
      primaryColor: '#004BA0',
      secondaryColor: '#FFD700',
      captainId: captainId,
      wicketKeeperId: wicketkeeperId,
      battingOrder: customBattingOrder,
      playerRoles: {
        [captainId]: 'BATSMAN',
        [wicketkeeperId]: 'WICKET_KEEPER'
      }
    };

    // Client/Server validator test
    const validationRes = validateLineupUpdate(lineupPayload, initialPlayers.map(p => p.id));
    assert.strictEqual(validationRes.valid, true, 'Custom lineup should pass validation');

    // Apply lineup update via RoomManager
    const updateRes = rm.updateTeamLineup('host_socket', lineupPayload);
    assert.strictEqual(updateRes.success, true, 'Update lineup should succeed for room participant');

    const updatedGameState = entry.session.getGameState();
    assert.strictEqual(updatedGameState.teams.TEAM_A.name, 'Mumbai Strikers');
    assert.strictEqual(updatedGameState.teams.TEAM_A.captainId, captainId);
    assert.strictEqual(updatedGameState.teams.TEAM_A.wicketKeeperId, wicketkeeperId);
    assert.deepStrictEqual(updatedGameState.teams.TEAM_A.battingOrder, customBattingOrder);

    // Verify captain and keeper assigned on team and roles updated
    assert.strictEqual(updatedGameState.teams.TEAM_A.captainId, captainId);
    assert.strictEqual(updatedGameState.teams.TEAM_A.wicketKeeperId, wicketkeeperId);

    const capPlayer = updatedGameState.teams.TEAM_A.players.find(p => p.id === captainId)!;
    const wkPlayer = updatedGameState.teams.TEAM_A.players.find(p => p.id === wicketkeeperId)!;
    assert.strictEqual(capPlayer.role, 'BATSMAN');
    assert.strictEqual(wkPlayer.role, 'WICKET_KEEPER');
  });

  await t.test('3. Lineup Validation Rejects Malformed Payloads', () => {
    const validIds = ['p1', 'p2', 'p3'];

    // Duplicate batting order IDs
    const duplicateOrder = validateLineupUpdate({
      teamId: 'TEAM_A',
      captainId: 'p1',
      wicketKeeperId: 'p2',
      battingOrder: ['p1', 'p1', 'p2']
    }, validIds);
    assert.strictEqual(duplicateOrder.valid, false);
    assert.match(duplicateOrder.error!, /duplicate/i);

    // Unknown captain ID
    const unknownCap = validateLineupUpdate({
      teamId: 'TEAM_A',
      captainId: 'ghost_player',
      wicketKeeperId: 'p2',
      battingOrder: ['p1', 'p2', 'p3']
    }, validIds);
    assert.strictEqual(unknownCap.valid, false);
    assert.match(unknownCap.error!, /roster/i);

    // Invalid player role
    const invalidRole = validateLineupUpdate({
      teamId: 'TEAM_A',
      captainId: 'p1',
      wicketKeeperId: 'p2',
      battingOrder: ['p1', 'p2', 'p3'],
      playerRoles: { p1: 'SUPER_STRIKER' as any }
    }, validIds);
    assert.strictEqual(invalidRole.valid, false);
    assert.match(invalidRole.error!, /Invalid role/i);
  });

  await t.test('4. Server-Authoritative Toss Lifecycle (Start, Coin Toss, Choice & Innings Synchronization)', () => {
    const rm = new RoomManager();
    const { roomCode } = rm.createRoom('socket_host_a', 'Cap A');
    rm.joinRoom(roomCode, 'socket_player_b', 'Cap B');

    // Place player B in Team B
    rm.claimSlot('socket_player_b', 'TEAM_B', 'TEAM_B_player_1');

    // Both players indicate ready
    rm.setReady('socket_host_a', true);
    rm.setReady('socket_player_b', true);

    const entry = rm.getRoomEntry(roomCode)!;

    // Start Toss phase
    const startTossRes = rm.startToss('socket_host_a');
    assert.strictEqual(startTossRes.success, true);
    assert.strictEqual(entry.session.getGameState().phase, 'TOSS');

    const tossState = entry.session.getGameState().toss;
    assert.ok(tossState, 'TossState must be initialized');
    assert.strictEqual(tossState.callerTeamId, 'TEAM_B', 'Away team calls the toss');
    assert.strictEqual(tossState.isCompleted, false);

    // Unauthorized client tries to call toss (Team A player should not be caller)
    const unauthorizedCall = rm.callToss('socket_host_a', 'HEADS');
    assert.strictEqual(unauthorizedCall.success, false, 'Non-caller cannot call the toss');

    // Authorized Team B captain calls HEADS
    const validCall = rm.callToss('socket_player_b', 'HEADS');
    assert.strictEqual(validCall.success, true);

    const resolvedToss = entry.session.getGameState().toss;
    assert.ok(resolvedToss.coinResult === 'HEADS' || resolvedToss.coinResult === 'TAILS');
    assert.ok(resolvedToss.winnerTeamId === 'TEAM_A' || resolvedToss.winnerTeamId === 'TEAM_B');

    const winnerTeam = resolvedToss.winnerTeamId!;
    const winnerSocket = winnerTeam === 'TEAM_A' ? 'socket_host_a' : 'socket_player_b';
    const loserSocket = winnerTeam === 'TEAM_A' ? 'socket_player_b' : 'socket_host_a';

    // Loser tries to make bat/bowl decision
    const loserDecide = rm.decideToss(loserSocket, 'BAT');
    assert.strictEqual(loserDecide.success, false, 'Toss loser cannot choose innings');

    // Winner chooses BAT
    const winnerDecide = rm.decideToss(winnerSocket, 'BAT');
    assert.strictEqual(winnerDecide.success, true);

    const finalGameState = entry.session.getGameState();
    assert.strictEqual(finalGameState.toss.decision, 'BAT');
    assert.strictEqual(finalGameState.battingTeamId, winnerTeam);
    assert.strictEqual(finalGameState.bowlingTeamId, winnerTeam === 'TEAM_A' ? 'TEAM_B' : 'TEAM_A');
    assert.strictEqual(finalGameState.phase, 'INNINGS_SETUP');

    // Verify on-field active players initialized
    assert.ok(finalGameState.currentStrikerId, 'Striker should be set from batting lineup');
    assert.ok(finalGameState.currentNonStrikerId, 'Non-striker should be set from batting lineup');
    assert.ok(finalGameState.currentBowlerId, 'Opening bowler should be set from bowling team');
  });

  await t.test('5. Umpire Modes: AI vs Manual Assignment & Permissions', () => {
    const rm = new RoomManager();
    const { roomCode } = rm.createRoom('socket_host', 'Host Player');
    rm.joinRoom(roomCode, 'socket_friend', 'Friend Umpire');

    const entry = rm.getRoomEntry(roomCode)!;

    // Default umpire mode is AI
    assert.strictEqual(entry.session.getGameState().umpireMode, 'AI_AUTOMATION');

    // Assign friend as manual umpire
    const assignRes = rm.assignUmpire('socket_host', 'socket_friend', 'MANUAL_HUMAN');
    assert.strictEqual(assignRes.success, true);
    assert.strictEqual(entry.session.getGameState().umpireMode, 'MANUAL_HUMAN');
    assert.strictEqual(entry.session.getGameState().manualUmpireSocketId, 'socket_friend');

    // Check participant role updated
    const updatedState = rm.getRoomState(roomCode)!;
    assert.strictEqual(updatedState.participants['socket_friend'].assignedRole, 'MANUAL_UMPIRE');

    // Switch back to AI umpire
    const switchAiRes = rm.assignUmpire('socket_host', null, 'AI_AUTOMATION');
    assert.strictEqual(switchAiRes.success, true);
    assert.strictEqual(entry.session.getGameState().umpireMode, 'AI_AUTOMATION');
    assert.strictEqual(entry.session.getGameState().manualUmpireSocketId, null);
  });

  await t.test('6. Umpire Signal Validation & Arbitrary Score Injection Protection', () => {
    // Permitted signals must pass
    for (const signal of PERMITTED_UMPIRE_SIGNALS) {
      const res = validateUmpireSignal({ signal, reason: 'Fair play' });
      assert.strictEqual(res.valid, true, `Signal ${signal} should be permitted`);
    }

    // Invalid / fictitious signals must fail
    const invalidSignalRes = validateUmpireSignal({ signal: 'SUPER_SIX_BONUS' as any });
    assert.strictEqual(invalidSignalRes.valid, false);

    // CRITICAL REQUIREMENT: Umpire cannot freely modify arbitrary scores
    const exploitPayload1 = {
      signal: 'FOUR' as const,
      runs: 100 // malicious score injection
    };
    const exploitRes1 = validateUmpireSignal(exploitPayload1);
    assert.strictEqual(exploitRes1.valid, false, 'Must reject payloads with arbitrary score/runs injection');
    assert.match(exploitRes1.error!, /arbitrary score/i);

    const exploitPayload2 = {
      signal: 'OUT' as const,
      wickets: 10 // malicious wicket injection
    };
    const exploitRes2 = validateUmpireSignal(exploitPayload2);
    assert.strictEqual(exploitRes2.valid, false, 'Must reject payloads with arbitrary score/wickets injection');

    const exploitPayload3 = {
      signal: 'WIDE' as const,
      score: { totalRuns: 999 } // arbitrary score object
    };
    const exploitRes3 = validateUmpireSignal(exploitPayload3);
    assert.strictEqual(exploitRes3.valid, false, 'Must reject payloads with score object');
  });

  await t.test('7. Umpire 10-Second Response Timeout & Safe AI Fallback', async () => {
    const rm = new RoomManager();
    const { roomCode } = rm.createRoom('socket_host', 'Host Player');
    rm.joinRoom(roomCode, 'socket_umpire', 'Manual Umpire');

    rm.assignUmpire('socket_host', 'socket_umpire', 'MANUAL_HUMAN');

    const entry = rm.getRoomEntry(roomCode)!;
    const session = entry.session;

    let timeoutFired = false;
    let fallbackDecision: any = null;

    session.onUmpireTimeout(() => {
      timeoutFired = true;
    });

    session.onUmpireBroadcast((event) => {
      fallbackDecision = event;
    });

    // Request umpire decision with short timeout for testing (200ms)
    session.requestUmpireDecision('APPEAL_LBW', 'Bowler appealed for LBW', 200);

    const promptState = session.getGameState().umpirePendingDecision;
    assert.ok(promptState, 'Umpire prompt should be active');
    assert.strictEqual(promptState.signalType, 'APPEAL_LBW');

    // Wait for timeout to elapse
    await new Promise((resolve) => setTimeout(resolve, 300));

    assert.strictEqual(timeoutFired, true, 'Umpire timeout callback must have fired');
    assert.ok(fallbackDecision, 'Fallback decision must be broadcasted by AI fallback');
    assert.strictEqual(fallbackDecision.isAiDecision, true);
    assert.strictEqual(session.getGameState().umpirePendingDecision, null, 'Pending prompt cleared after fallback');
  });

  await t.test('8. Safe Fallback on Manual Umpire Disconnect & State Preservation', () => {
    const rm = new RoomManager();
    const { roomCode } = rm.createRoom('socket_host', 'Host');
    const friendJoin = rm.joinRoom(roomCode, 'socket_umpire', 'Umpire User');
    const umpireToken = friendJoin.reconnectToken!;

    rm.assignUmpire('socket_host', 'socket_umpire', 'MANUAL_HUMAN');
    const entry = rm.getRoomEntry(roomCode)!;

    assert.strictEqual(entry.session.getGameState().umpireMode, 'MANUAL_HUMAN');

    // Umpire disconnects
    rm.handleDisconnect('socket_umpire');

    // System falls back to AI umpire safely without crashing
    assert.strictEqual(entry.session.getGameState().umpireMode, 'AI_AUTOMATION', 'Must fallback to AI on umpire disconnect');

    // Umpire reconnects with token
    const reconnectRes = rm.joinRoom(roomCode, 'socket_umpire_new', 'Umpire User', umpireToken);
    assert.strictEqual(reconnectRes.success, true);
    assert.strictEqual(entry.session.getGameState().umpireMode, 'MANUAL_HUMAN', 'Must restore manual umpire mode on reconnect');
    assert.strictEqual(entry.session.getGameState().manualUmpireSocketId, 'socket_umpire_new');
  });

  await t.test('9. Full State Machine Lifecycle & Phase Transition Protection', () => {
    // 9.1 Verify Valid State Transitions in Matrix
    assert.strictEqual(canTransitionMatchPhase('LOBBY', 'TEAM_SELECTION'), true);
    assert.strictEqual(canTransitionMatchPhase('LOBBY', 'TOSS'), true);
    assert.strictEqual(canTransitionMatchPhase('TEAM_SELECTION', 'TOSS'), true);
    assert.strictEqual(canTransitionMatchPhase('TOSS', 'INNINGS_SETUP'), true);
    assert.strictEqual(canTransitionMatchPhase('INNINGS_SETUP', 'ACTIVE_MATCH'), true);
    assert.strictEqual(canTransitionMatchPhase('ACTIVE_MATCH', 'INNINGS_BREAK'), true);
    assert.strictEqual(canTransitionMatchPhase('INNINGS_BREAK', 'SECOND_INNINGS'), true);
    assert.strictEqual(canTransitionMatchPhase('SECOND_INNINGS', 'COMPLETED_MATCH'), true);

    // 9.2 Verify Invalid/Illegal Phase Jumps are Blocked
    assert.strictEqual(canTransitionMatchPhase('LOBBY', 'COMPLETED_MATCH'), false);
    assert.strictEqual(canTransitionMatchPhase('TOSS', 'SECOND_INNINGS'), false);
    assert.strictEqual(canTransitionMatchPhase('COMPLETED_MATCH', 'ACTIVE_MATCH'), false);

    // 9.3 Verify unauthorized modifications are blocked after match starts
    const rm = new RoomManager();
    const { roomCode } = rm.createRoom('host_s1', 'Player 1');
    rm.joinRoom(roomCode, 'client_s2', 'Player 2');
    rm.claimSlot('client_s2', 'TEAM_B', 'TEAM_B_player_1');
    rm.setReady('host_s1', true);
    rm.setReady('client_s2', true);

    const entry = rm.getRoomEntry(roomCode)!;

    // Progress through Toss to ACTIVE_MATCH
    rm.startToss('host_s1');
    rm.callToss('client_s2', 'HEADS');
    const winnerId = entry.session.getGameState().toss.winnerTeamId === 'TEAM_A' ? 'host_s1' : 'client_s2';
    rm.decideToss(winnerId, 'BAT');

    // Force transition to ACTIVE_MATCH
    entry.session.transitionPhase('ACTIVE_MATCH');
    entry.state.status = 'IN_PLAY';

    // Roster slot claiming must now be REJECTED
    const lateClaim = rm.claimSlot('client_s2', 'TEAM_A', 'TEAM_A_player_3');
    assert.strictEqual(lateClaim.success, false, 'Claiming slot must be rejected after match starts');
    assert.match(lateClaim.error!, /match setup has started/i);

    // Settings update must now be REJECTED
    const lateSettings = rm.updateSettings('host_s1', { maxOversPerInnings: 20 });
    assert.strictEqual(lateSettings.success, false, 'Settings cannot be altered during match');

    // Lineup update must now be REJECTED
    const lateLineup = rm.updateTeamLineup('host_s1', {
      teamId: 'TEAM_A',
      captainId: 'p1',
      wicketKeeperId: 'p2',
      battingOrder: ['p1', 'p2']
    });
    assert.strictEqual(lateLineup.success, false, 'Lineup cannot be changed during match');
  });

  await t.test('10. End-to-End Acceptance: Two Independent Clients Pre-Match Experience', () => {
    const rm = new RoomManager();

    // Client A creates room
    const hostJoin = rm.createRoom('client_A_socket', 'Rohit (Host)');
    const roomCode = hostJoin.roomCode;

    // Client B joins room
    const guestJoin = rm.joinRoom(roomCode, 'client_B_socket', 'Cummins (Guest)');
    assert.strictEqual(guestJoin.success, true);

    // Client B takes slot in Team B
    rm.claimSlot('client_B_socket', 'TEAM_B', 'TEAM_B_player_1');

    // Host configures Team A lineup
    const entry = rm.getRoomEntry(roomCode)!;
    const teamAPlayers = entry.session.getGameState().teams.TEAM_A.players;
    rm.updateTeamLineup('client_A_socket', {
      teamId: 'TEAM_A',
      name: 'India XI',
      captainId: teamAPlayers[0].id,
      wicketKeeperId: teamAPlayers[1].id,
      battingOrder: teamAPlayers.map(p => p.id)
    });

    // Select Manual Umpire or AI Umpire
    rm.assignUmpire('client_A_socket', null, 'AI_AUTOMATION');

    // Ready up both players
    rm.setReady('client_A_socket', true);
    rm.setReady('client_B_socket', true);

    // Start Toss
    const tossStarted = rm.startToss('client_A_socket');
    assert.strictEqual(tossStarted.success, true);

    // Client B (Team B captain) calls TAILS
    const coinFlip = rm.callToss('client_B_socket', 'TAILS');
    assert.strictEqual(coinFlip.success, true);

    // Authoritative winner decides
    const tossState = entry.session.getGameState().toss;
    const winningSocket = tossState.winnerTeamId === 'TEAM_A' ? 'client_A_socket' : 'client_B_socket';
    const decisionRes = rm.decideToss(winningSocket, 'BOWL');
    assert.strictEqual(decisionRes.success, true);

    // Check synchronized authoritative state
    const authoritativeState = entry.session.getGameState();
    assert.strictEqual(authoritativeState.phase, 'INNINGS_SETUP');
    assert.strictEqual(authoritativeState.toss.decision, 'BOWL');

    if (tossState.winnerTeamId === 'TEAM_A') {
      assert.strictEqual(authoritativeState.bowlingTeamId, 'TEAM_A');
      assert.strictEqual(authoritativeState.battingTeamId, 'TEAM_B');
    } else {
      assert.strictEqual(authoritativeState.bowlingTeamId, 'TEAM_B');
      assert.strictEqual(authoritativeState.battingTeamId, 'TEAM_A');
    }

    assert.ok(authoritativeState.currentStrikerId);
    assert.ok(authoritativeState.currentNonStrikerId);
    assert.ok(authoritativeState.currentBowlerId);
  });
});
