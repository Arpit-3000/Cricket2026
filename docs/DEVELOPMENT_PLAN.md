# Cricket 2026 - Development Plan & Test Strategy

## 1. Development Commands

The repository uses npm workspaces to coordinate the monorepo packages (`shared`, `server`, and `client`):

| Command | Purpose |
|---|---|
| `npm run build` | Compiles all packages across the workspace (`shared`, `server`, and `client`). |
| `npm run typecheck` | Executes TypeScript typechecks (`tsc --noEmit`) across all workspace packages. |
| `npm run dev:server` | Starts the authoritative Node.js game server in watch mode (`tsx watch src/index.ts`). |
| `npm run dev:client` | Launches the Vite React client development server on `http://localhost:5173`. |
| `npm run dev` | Runs both client and server development processes concurrently across the workspace. |
| `npm test` | Runs the test suite across packages. |

---

## 2. Environment Variables

All configuration is externalized with sensible defaults:

| Variable | Package | Default Value | Description |
|---|---|---|---|
| `PORT` | server | `4000` | HTTP and Socket.IO server listening port. |
| `CORS_ORIGIN` | server | `*` | Allowed CORS origins for WebSocket connections. |
| `TICK_RATE_HZ` | server | `30` | Authoritative physics simulation and network sync rate (Hz). |
| `DEFAULT_OVERS` | server | `5` | Default number of overs per innings. |
| `RECONNECT_GRACE_MS` | server | `30000` | Grace window (ms) for disconnected human players to reclaim slot. |
| `MAX_ROOMS` | server | `100` | Upper bound for active concurrent match rooms on a server node. |
| `VITE_SERVER_URL` | client | `http://localhost:4000` | WebSocket server target URL for the browser client. |

---

## 3. Comprehensive Testing Strategy

### 3.1 Unit Testing (Pure Logic & Rules)
- **Cricket Engine Rules**:
  - Verify 5-over innings termination (30 legal balls).
  - Verify wide and no-ball extras calculation (does not increment ball count; adds 1 run penalty).
  - Verify strike rotation on odd runs (1, 3) vs preserved strike on even runs (0, 2, 4, 6).
  - Verify strike rotation at end of over (ball 6).
  - Verify bowler restriction enforcement (maximum 2 overs per bowler, no consecutive overs).
- **Finite State Machine Guards**:
  - Test valid transitions: `WAITING_FOR_PLAYERS` -> `TOSS_IN_PROGRESS` -> `INNINGS_1_IN_PROGRESS` -> `MID_INNINGS_BREAK` -> `INNINGS_2_IN_PROGRESS` -> `MATCH_CONCLUDED`.
  - Verify rejection of invalid transitions (e.g. attempting to jump from `LOBBY` directly to `INNINGS_2`).
- **Input Validators**:
  - Test room code format (must be 6 alphanumeric uppercase characters).
  - Test bowling parameters boundary check (speed between 60-165 km/h, pitch coordinate within pitch limits).
  - Test batting parameters boundary check (shot power 0-100, angle 0-360).

### 3.2 Integration Testing (Services & Network Contracts)
- **RoomManager Lifecycle**:
  - Create room -> verify unique 6-character code -> verify host assignment.
  - Join room -> verify participant registration and slot allocation.
  - Test human slot claiming (e.g. claim `TEAM_A_player_1` as striker).
  - Test disconnection grace period: player disconnects -> 30-second timer active -> reconnect with token -> verify slot preserved.
  - Test host migration: host drops out -> senior participant elevated to host.
  - Test room garbage collection: all participants leave -> room destroyed cleanly.
- **Authoritative Game Loop**:
  - Run `GameSession` through 30Hz tick sequence and verify tick synchronization payloads.
  - Verify delivery completion records are correctly written to the match scorecard.

### 3.3 End-to-End & Visual Testing
- **3D Stadium Rendering**:
  - Verify Canvas mounts without WebGL context loss.
  - Verify pitch, wickets, floodlights, and all 11 fielder avatars render at correct 3D coordinates.
  - Verify camera mode switching (Striker, Bowler, Broadcast, Orbit).
- **Multi-Client Synchronization**:
  - Two browser tabs join the same room code.
  - Tab A claims Striker; Tab B claims Bowler.
  - Tab B delivers ball -> Tab A executes shot -> both tabs verify synchronized scorecard updates.

---

## 4. Phase-by-Phase Roadmap & Acceptance Criteria

```
┌────────────────────────────────────────────────────────────────────────┐
│ Phase 0 (Completed): Scaffold, Shared Contracts & Minimal Architecture  │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ Phase 1: Realistic 3D Ball Physics, Trajectories & Bat-Ball Contact    │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ Phase 2: Authoritative Multiplayer Networking & State Synchronization   │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ Phase 3: 11v11 Dynamic Fielding System & AI Behavior Trees             │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ Phase 4: Umpire System, Line Decisions & DRS Review Pipeline           │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ Phase 5: High-Fidelity Models, Motion Animations & Soundscapes         │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ Phase 6: Spectator Director Mode, Broadcast Replays & Production Polish │
└────────────────────────────────────────────────────────────────────────┘
```

### Phase 0: Scaffold & Architecture (CURRENT DELIVERABLE)
- [x] Monorepo workspace established (`shared`, `server`, `client`).
- [x] Comprehensive TypeScript interfaces for players, teams, rooms, deliveries, scorecards, and umpire events.
- [x] Server-authoritative Finite State Machine for matches and deliveries.
- [x] Input validators and official ICC ground dimensions.
- [x] Working 3D stadium scene with 22-yard pitch, wickets, floodlights, and fielder models.
- [x] Broadcast scorecard overlay and interactive controls HUD.
- [x] Room lobby with 11v11 slot selection and AI placeholding.
- [x] Clean TypeScript build and typecheck with zero errors.

### Phase 1: Realistic Ball Physics & Bat-Ball Contact Engine
- [ ] 3D continuous collision detection (CCD) for ball-bat, ball-pitch, ball-stumps.
- [ ] Atmospheric drag and Magnus effect simulation for inswing, outswing, and spin variations off pitch.
- [ ] Dynamic pitch surface reaction (Hard turf carry vs Dusty spinner grip vs Green seamer seam movement).
- [ ] Bat collision sweet spot geometry with exit velocity and launch angle determination.
- **Acceptance Criteria**: Trajectory simulation runs deterministically on server at 30Hz; ball bounces realistically on pitch surface; sweet-spot contact produces realistic lofted and grounded exit velocities.

### Phase 2: Authoritative Multiplayer Networking & Interpolation
- [ ] Client-side prediction and server reconciliation for smooth ball flight.
- [ ] Entity interpolation for outfield fielders and running batsmen.
- [ ] Shot-clock delivery timer (20s) with auto-bowl on timeout.
- [ ] Production reconnection flow with JWT/token verification.
- **Acceptance Criteria**: Two independent clients can connect, bowl, and bat with sub-100ms perceived latency and zero desynchronization of match scores.

### Phase 3: 11v11 Fielding System & AI Behavior Trees
- [ ] Outfield pathfinding and ball interception physics for all 9 outfield fielders.
- [ ] Clean pickup, slide stop, and diving catch mechanics.
- [ ] Throw physics with targeting calculations for striker's end and bowler's end stumps.
- [ ] Dynamic fielding presets: Defensive (boundary riders), Aggressive (slips, gully), Powerplay ring.
- **Acceptance Criteria**: Unoccupied fielder positions react organically to ball direction; AI fielders chase, gather, and throw accurately to the active end.

### Phase 4: Umpire System & DRS (Hawk-Eye / UltraEdge)
- [ ] Automated line calls for Wide (outside leg/off markers) and No-Ball (front-foot crease overstep).
- [ ] Manual human umpire signalling interface for custom room matches.
- [ ] DRS Review sequence:
  - 15-second countdown timer after appeal.
  - Animated UltraEdge / Snicko spike graph displaying bat vs pad sound waves.
  - 3D Hawk-Eye ball projection showing pitch point, impact line, and stump contact ("Hitting", "Missing", "Umpire's Call").
- **Acceptance Criteria**: DRS correctly overturns or upholds lbw and caught decisions; review count is decremented appropriately.

### Phase 5: High-Fidelity 3D Assets, Character Animations & Soundscapes
- [ ] Realistic low-poly textured cricketer character models with customizable jerseys and skin tones.
- [ ] Skeletal animation blending: Bowling run-up and release, batting backlift, forward defensive, cover drive, pull shot, fielder dive.
- [ ] Dynamic 3D spatial audio: Willow bat-on-ball crack, ball striking leather pads, wooden bails rattling, crowd applause, and umpire calls.
- **Acceptance Criteria**: 60 FPS performance maintained on standard modern browser hardware; animation transitions are smooth with no T-pose glitches.

### Phase 6: Spectator Director Mode, Broadcast Replays & Production Hardening
- [ ] Automated TV broadcast camera director switching angles dynamically based on ball trajectory.
- [ ] Slow-motion replay buffer for boundaries, wickets, and DRS reviews.
- [ ] Wagon wheel and pitch map visualizers on the broadcast scorecard.
- [ ] Room link sharing via direct URL query parameter (`?room=CRK9A2`).
- [ ] Security hardening, rate limiting, and memory leak verification.
- **Acceptance Criteria**: Spectators can join seamlessly via room link; automated director mode provides broadcast-quality viewing without human intervention.
