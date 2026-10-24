# Cricket 2026 - Official Game Specifications

## 1. Match Format & Cricket Rules

### 1.1 Match Duration & Overs
- **Format**: Five (5) overs per innings (total 10 overs per complete match).
- **Deliveries**: Six (6) legal deliveries per over.
- **Wides & No-Balls**: Do not count towards the 6-ball over count. They incur a 1-run penalty and require an extra legal ball to be bowled.
- **Innings Cap**: 10 wickets down (All Out) or completion of 5 overs, whichever occurs first.
- **Target Calculation**: In Innings 2, Target = (Innings 1 Total Runs) + 1. If Innings 2 reaches or exceeds the target, the batting team wins immediately.
- **Tie Resolution**: If scores are level after both innings, a 1-over Super Over is triggered.

### 1.2 Bowling Restrictions
- **Over Limit**: Maximum of 2 overs per bowler in a 5-over match (`CRICKET_RULES.MAX_OVERS_PER_BOWLER = 2`).
- **Consecutive Overs**: A bowler cannot bowl consecutive overs from either end. The fielding captain/bowling system must select a different bowler at the conclusion of each over.

### 1.3 Strike Rotation
- **Odd Runs**: 1, 3, or 5 runs switch the striker and non-striker positions.
- **End of Over**: At the end of each over (6 legal balls), the batsmen swap ends and the new bowler bowls to the newly positioned striker.

---

## 2. 11v11 Playing Roles & AI Backfill

### 2.1 The 11 On-Field Positions
Each team fields a complete playing XI:
1. **Wicket-Keeper**: Crouches behind the striker's stumps; takes catches, stumping, run-out throws.
2. **Bowler**: Delivers the ball from the non-striker's bowling crease.
3. **First Slip**: Close-catching cordon for outside edges.
4. **Second Slip / Gully**: Captures deflections between slips and point.
5. **Point**: Covers the off-side backward square cut region.
6. **Cover / Extra Cover**: Intercepts front-foot drives on the off side.
7. **Mid-Off**: Covers the straight drive to the bowler's off side.
8. **Mid-On**: Covers straight strokes on the on/leg side.
9. **Mid-Wicket**: Intercepts on-drives and flicks.
10. **Square Leg / Fine Leg**: Guards the leg side boundary and behind-square flicks.
11. **Boundary Outfielders**: Long-On, Long-Off, Deep Mid-Wicket, Deep Cover, Third Man.

### 2.2 Human Player Control & AI Allocation
- When human players join a room, they select any available cricketer position from the 11 roles on either Team A or Team B.
- Any position not claimed by a human player is automatically flagged `isAi: true` and controlled by the server's `AIService`.
- If a human player is the assigned bowler for that over, they manually aim, choose speed/variation, and deliver.
- If a human player is the striker, they control bat swing timing, angle, and shot loft.
- When the ball is in play, fielders nearest to the ball's trajectory can be steered by the assigned human player or intercepted by the AI.

---

## 3. Player Controls & Input Schemes

### 3.1 Bowling Mechanics
- **Pitch Target Marker**: 2D coordinate selector on the 22-yard pitch representing projected bounce location.
- **Speed Selector**: Slider or charge gauge ranging from 80 km/h (spin) to 155 km/h (fast).
- **Delivery Types**:
  - Pace: Seam upright, Inswinger, Outswinger, Reverse swing, Slower ball, Yorker, Bouncer.
  - Spin: Off-break, Leg-break, Googly, Top-spinner, Doosra, Arm ball.
- **Release Precision**: A timing meter around the crease line determines release accuracy; mistiming results in wider line or full toss/no-ball.

### 3.2 Batting Mechanics
- **Shot Timing Window**: Real-time reaction window calibrated to ball arrival speed:
  - `-15ms to +15ms`: Sweet spot (high exit velocity, crisp boundary potential).
  - `-45ms to +45ms`: Solid contact (1-2 runs, controlled placement).
  - `±45ms to ±80ms`: Mistimed contact (edges, pops, caught opportunities).
  - `> ±80ms`: Complete beat / bowled / play-and-miss.
- **Shot Direction**: 360-degree direction dial aiming towards field gaps.
- **Elevation**: Toggle between Grounded Stroke (safe placement) and Lofted Shot (aerial boundary or caught risk).
- **Running Between Wickets**: Striker or non-striker can initiate a run call (`game:call_run`); both batsmen sprint between creases until safely home or run out.

### 3.3 Fielding Mechanics
- **Fielder Movement**: Directional movement towards ball path.
- **Actions**: Sprint, Slide/Dive stop, Clean Pickup.
- **Throw Selection**: Quick throw to Striker's End (Wicket-Keeper) or Bowler's End.

---

## 4. Umpire Modes & Decision Review System (DRS)

### 4.1 Umpire Modes
- **AI Automated Mode**: Instant, fair, algorithmically verified line and dismissal calls.
- **Manual Human Mode**: An assigned human umpire participant signals Out, Not Out, Wide, No Ball, or Boundary using the manual signal console.

### 4.2 DRS (Decision Review System)
- Each team is allocated **1 review per 5-over innings**.
- **15-Second Review Window**: Upon an appeal or dismissal, the fielding captain or batsman has 15 seconds to trigger DRS (`drs:request_review`).
- **Review Pipeline**:
  1. **UltraEdge / Snicko**: Visual audio-wave spike graph checking bat-ball contact before pad collision.
  2. **Hawk-Eye Ball Tracking**: 3D reconstructed trajectory verifying:
     - Pitching alignment: In-line, Outside Off, or Outside Leg (pitching outside leg = Not Out).
     - Impact point: In-line or Outside Off with no shot offered.
     - Stumps projection: Hitting, Missing, or Clipping ("Umpire's Call").
  3. **Decision Confirmation**: Overturns or upholds on-field decision; successful reviews preserve the team's review count.

---

## 5. 3D Stadium, Physics & Asset Pipeline

### 5.1 Dimensional Standards
- Pitch: Length 20.12m (22 yards), Width 3.05m (10 ft).
- Stumps: Height 71.1cm (28 in), Width across stumps 22.86cm (9 in).
- Boundary: 65m radius from pitch center.
- Ball: Radius 3.6cm, mass 160g.

### 5.2 Physics Integration
- Authoritative trajectory calculation integrates:
  - Gravity: $g = 9.81 m/s^2$.
  - Aerodynamic Drag: $F_d = \frac{1}{2} C_d \rho A v^2$.
  - Magnus Effect (Swing / Spin deviation): $F_m = S (\omega \times v)$.
  - Pitch Restitution: Coefficient of restitution (COR) and friction tailored to pitch condition:
    - *Hard Turf*: Fast bounce ($e \approx 0.58$), true carry.
    - *Dusty Spinner*: Lower bounce ($e \approx 0.48$), high angular spin grip.
    - *Green Seamer*: Variable seam angle deflection ($±3^\circ$), lateral nip.

### 5.3 3D Assets & Visual Quality
- Full 3D circular stadium with tiered stands, advertising perimeters, and 4 high-powered floodlight towers with dynamic soft shadows.
- Distinct player jersey colors (Team A Royal Blue vs Team B Forest Green/Gold) with numbered jerseys and dynamic role tags.
- Multiple synchronized broadcast camera angles (Striker, Bowler, Broadcast TV, Spectator Orbit).
