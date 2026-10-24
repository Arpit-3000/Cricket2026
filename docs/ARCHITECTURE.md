# Cricket 2026 - System Architecture

## 1. System Overview

Cricket 2026 is a production-grade, realistic 3D multiplayer cricket browser game built on a server-authoritative architecture. The game allows multiple human friends to play together across two opposing 11-player teams, with unoccupied positions smoothly operated by realistic AI player agents.

```
                          +------------------------------------------+
                          |              Browser Client              |
                          |  React 19 + Three.js + R3F + Tailwind v4 |
                          +--------------------+---------------------+
                                               |
                                     WebSocket / Socket.IO
                                  (Strict Typed Event Contracts)
                                               |
                          +--------------------v---------------------+
                          |           Node.js Game Server            |
                          |      Express + Socket.IO Authoritative   |
                          |                                          |
                          |  +----------------+  +----------------+  |
                          |  |  Room Manager  |  |  Match Session |  |
                          |  +----------------+  +----------------+  |
                          |  |  Cricket Rules |  |   AIService    |  |
                          |  +----------------+  +----------------+  |
                          |  |  Physics 30Hz  |  | DRS / Umpire   |  |
                          |  +----------------+  +----------------+  |
                          +--------------------+---------------------+
                                               ^
                                               |
                          +--------------------+---------------------+
                          |             Shared Package               |
                          |     Types, Constants, FSM, Validators    |
                          +------------------------------------------+
```

---

## 2. Monorepo Organization

The project is structured as an npm monorepo with three modular packages and documentation:

```
d:/Cricket2026/
├── packages/
│   ├── shared/                # Core TypeScript types, FSM, contracts, constants
│   │   ├── src/
│   │   │   ├── types/         # Player, team, room, cricket, physics, scorecard, umpire, events
│   │   │   ├── constants/     # Official ICC pitch/ground dimensions, over limits, presets
│   │   │   ├── state-machine/ # Match and delivery phase finite state machines
│   │   │   └── validators/    # Input verification (room code, delivery vectors, shot limits)
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── server/                # Authoritative game server
│   │   ├── src/
│   │   │   ├── config/        # Environment and default runtime parameters
│   │   │   ├── game/          # GameSession, CricketEngine, AIService
│   │   │   ├── services/      # RoomManager (slot claiming, host migration, reconnection)
│   │   │   ├── socket/        # Socket.IO connection handlers & validation
│   │   │   └── index.ts       # Express + HTTP + Socket.IO entry point
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── client/                # React 19 + R3F 3D frontend
│       ├── src/
│       │   ├── components/
│       │   │   ├── 3d/        # CricketStadiumScene, pitch, wickets, cricketers, floodlights
│       │   │   ├── ui/        # BroadcastScorecard, GameControlsHUD
│       │   │   └── lobby/     # RoomLobbyModal (11v11 role selection, room code copy)
│       │   ├── hooks/         # useCricketGame hook
│       │   ├── services/      # SocketService singleton
│       │   ├── App.tsx        # Main application layout
│       │   ├── main.tsx       # Mount point
│       │   └── index.css      # Tailwind v4 styling & typography
│       ├── public/            # Cricket assets and icons
│       ├── index.html
│       ├── vite.config.ts
│       ├── package.json
│       └── tsconfig.json
├── docs/                      # Engineering documentation
│   ├── ARCHITECTURE.md        # Architecture specification
│   ├── SPECIFICATIONS.md      # Cricket game rules, AI, physics, DRS specification
│   └── DEVELOPMENT_PLAN.md    # Milestones, dev commands, env vars, test plan
├── package.json               # Monorepo workspaces definition
└── tsconfig.base.json         # Base TypeScript compiler configuration
```

---

## 3. Server-Authoritative State Machine & Game Loop

### 3.1 Match Lifecycle FSM
The match lifecycle is enforced by the authoritative `MatchStateMachine`:
```
[WAITING_FOR_PLAYERS]
        │
        ▼ (All slots configured / Host initiates)
 [TOSS_IN_PROGRESS]
        │
        ▼ (Coin flipped, Bat/Bowl decided)
[INNINGS_1_IN_PROGRESS] (5 Overs / 10 Wickets)
        │
        ▼ (Overs completed or all out)
 [MID_INNINGS_BREAK] (Target calculated = Innings 1 + 1)
        │
        ▼ (Teams swap Batting & Bowling roles)
[INNINGS_2_IN_PROGRESS] (5 Overs / 10 Wickets / Target Chased)
        │
        ├─────────────────────────────┐
        ▼                             ▼
[MATCH_CONCLUDED]               [SUPER_OVER] (In event of a tie)
```

### 3.2 Individual Delivery FSM
Every ball delivery proceeds through a guarded sequence of sub-states:
```
[AWAITING_BOWLER_CONFIRM]
        │
        ▼ (Bowler commits speed, line, length, swing/spin)
   [BOWLER_RUNUP]
        │
        ▼
   [BALL_RELEASE]
        │
        ▼
[BALL_IN_FLIGHT_PRE_BOUNCE]
        │
        ▼ (Contact with pitch surface)
   [BALL_PITCHED]
        │
        ▼ (Batter shot window calculation)
  [BAT_INTERACTION]
   ├── [Clean Bowled / LBW] ───────────────► [UMPIRE_ADJUDICATION]
   ├── [Edge / Mis-hit / Safe Stroke] ────► [BALL_IN_FIELD]
   └── [Beaten / Keeper Takes] ────────────► [BALL_DEAD]
        │
        ▼
[RUNNING_BETWEEN_WICKETS]
        │
        ▼
   [BALL_DEAD] ──► (Scorecard updated, over/innings check, return to AWAITING)
```

### 3.3 Authoritative 30Hz Simulation Loop
- The server runs a 30Hz tick loop (`SERVER_CONFIG.TICK_RATE_HZ = 30`).
- Trajectory integration, collision detection (ball-pitch, ball-stumps, ball-bat), and fielder interception are verified on the server.
- Clients send player intents (`BowlingDeliveryIntent`, `BattingShotIntent`, `FieldingIntent`), not physical coordinates. The server validates these inputs against physical bounds and updates the master game state.

---

## 4. Network Protocols, Validation & Error Handling

### 4.1 Typed Socket.IO Contracts
- `ClientToServerEvents`: Defines room creation, room joining, position slot claims, ready flags, bowler delivery parameters, batter shot timing, and umpire actions.
- `ServerToClientEvents`: Broadcasts state snapshots (`room:state`, `game:init_match`), 30Hz physics ticks (`game:tick`), delivery completion outcomes (`game:delivery_completed`), and broadcast scorecard synchronization (`game:scorecard_sync`).

### 4.2 Room Isolation & Concurrency
- Each match is completely isolated by its 6-character room code.
- Socket broadcasts use `io.to(roomCode).emit(...)`, guaranteeing no cross-room leakage.
- Room code generation uses unambiguous characters (`ABCDEFGHJKLMNPQRSTUVWXYZ23456789`), eliminating ambiguous characters like `0`, `O`, `1`, `I`.

### 4.3 Reconnection & Host Migration
- **Reconnection Grace**: When a connected player drops connection, their slot is retained for 30 seconds (`SERVER_CONFIG.RECONNECTION_GRACE_MS`). If they reconnect using their private `reconnectToken`, their cricketer assignment is restored instantly.
- **Host Migration**: If the room host leaves or fails to reconnect within 30 seconds, host privileges automatically transfer to the next senior connected participant.
- **Garbage Collection**: Empty rooms without active players are destroyed automatically after the grace period, freeing server memory.

---

## 5. Camera & Spectator Synchronization

- Four distinct camera perspectives are supported:
  1. **STRIKER**: First-person/over-the-shoulder behind the batter facing the bowler.
  2. **BOWLER**: Placed at the top of the bowler's run-up overlooking the pitch.
  3. **BROADCAST**: Elevated sideline camera replicating TV cricket broadcast feeds.
  4. **SPECTATOR**: Full 360-degree free OrbitControls allowing spectators to view the action from anywhere in the stadium.
- Spectators receive the identical authoritative state and tick stream as active players, ensuring zero desync between players and viewers.
