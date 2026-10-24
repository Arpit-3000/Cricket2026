# Cricket 2026 - 3D Presentation & Asset Licensing Documentation (Phase 6)

## 1. Overview of 3D Models & Visual Presentation
All 3D models, equipment, anatomical skeletal characters, uniforms, and audio synthesized in **Cricket 2026** are original, custom-crafted procedural assets developed specifically for this project using Three.js and the Web Audio API. No unauthorized third-party commercial assets or proprietary photogrammetry scans are used.

| Category | Component / Asset Description | Implementation & License |
| :--- | :--- | :--- |
| **Humanoid Cricketers** | Anatomically proportioned 1.82m humanoid cricketers with head, neck, deltoid shoulders, tapered athletic jersey torso, knees, calves, ankles, and spiked footwear. Distinct visual models for Batter, Bowler, Wicketkeeper, Fielder, and Umpire. | **Original Procedural Mesh**<br>License: MIT / CC0 Compatible |
| **Cricket Helmets** | Composite protective batting & wicketkeeping helmet with aerodynamic shell, ventilation channels, peak, and realistic metallic faceguard safety wire grille (brow bar, chin guard, vertical wire struts). | **Original Procedural Geometry**<br>License: MIT |
| **Cricket Caps & Sunhats** | Peaked team cap with curved visor and team crest for fielders/bowlers; classic wide-brim sunhat with dark ribbon band for match umpires. | **Original Procedural Geometry**<br>License: MIT |
| **Cricket Bats** | Handcrafted English Willow bat profiled to ICC specifications: curved face, thick power edges (~40mm), prominent rear spine swell (high sweet spot), duckbill toe, spiral chevron rubber cane handle grip, and branding decals. | **Original Procedural Geometry**<br>License: MIT |
| **Protective Pads** | Traditional multi-cane cane-bolster batting pads and wicketkeeper pads featuring molded top-hat knee-rolls with horizontal flutes, vertical cane bolster ribs, and calf/ankle fastening straps. | **Original Procedural Geometry**<br>License: MIT |
| **Cricket Gloves** | Batting gloves with segmented sausage-finger rolls, thumb shield, and wristband; large webbed wicketkeeping gloves with reinforced palm and thumb-index catching webbing. | **Original Procedural Geometry**<br>License: MIT |
| **Footwear** | Modern athletic cricket spikes with molded sole, rubber/metal studs, heel counter, white athletic socks, and contrast laces. | **Original Procedural Geometry**<br>License: MIT |
| **Wickets & Ball** | Three wooden stumps (Off, Middle, Leg) with zinc ground spikes, two dislodgeable bails, and a 4-piece red leather ball with raised white 6-row seam. | **Original Procedural Geometry**<br>License: MIT |
| **Stadium Architecture** | Tiered 3D grandstand bowl, club suite ribbon, cantilever roof canopy, 4 steel lattice floodlight masts, dual digital Jumbotrons with live scoreboards, and 360-degree digital LED ribbon boards. | **Original Procedural Geometry**<br>License: MIT |
| **Audio Synthesizer** | Procedural Web Audio API sound generator (`CricketAudioEngine`): English willow crack (sweet spot, standard, snick edge, pad thud), stump clatters, ball turf bounces, dynamic stadium crowd murmur, boundary roars, wicket cheers, footsteps, slides, and umpire whistles. Zero external MP3/WAV dependencies. | **Original Procedural Web Audio Engine**<br>License: MIT |

---

## 2. Animation Systems
Procedural skeletal inverse kinematics and limb orientation interpolate smoothly across all required states:
1. **Batting**:
   - `BATTING_STANCE`: Side-on stance, bent knees, tapping bat behind back foot.
   - `BACKSWING`: Bat raised high behind shoulder, elbows bent, weight loaded onto feet.
   - `SHOT_EXECUTION`: Dynamic downswing arc through ball plane with rotating torso.
   - `DEFENSIVE_BLOCK`: Front knee forward, bat and pad pressed tight under eyes with soft hands.
   - `FOLLOW_THROUGH`: Elegant high-elbow follow-through pointing bat skywards.
2. **Bowling**:
   - `BOWLER_RUNUP`: Rhythmic running gait with pumping arms, gathering momentum.
   - `DELIVERY_STRIDE`: Jump and gather, non-bowling arm raised pointing at target.
   - `RELEASE`: Front foot plant, full 360-degree high overarm vertical delivery at 12 o'clock.
   - `BOWLER_FOLLOW_THROUGH`: Natural cross-body follow-through stride off the pitch.
3. **Running, Ground Fielding & Catching**:
   - `RUN`: Dynamic cricket sprint holding bat in hand with pumping legs.
   - `SPRINT`: High-intensity sprint lean.
   - `DIVE`: Full horizontal ground slide/dive parallel to turf with arms outstretched.
   - `FIELDING_PICKUP`: Long-barrier knee down to scoop ball.
   - `CATCHING`: Cushioning ball with two cupped hands into chest.
   - `THROWING`: Overarm throw with body weight transfer.
4. **Umpire Signals**:
   - `OUT`: Dramatic raising of the right index finger above head.
   - `FOUR`: Sweeping arm back and forth across chest at waist level.
   - `SIX`: Both arms raised high above head with palms forward.
   - `WIDE`: Both arms extended horizontally wide at 90 degrees.
   - `NO_BALL`: One arm extended horizontally from shoulder.
5. **Celebrations**:
   - Leaping fist pump and arms aloft.

---

## 3. Graphics Settings & Performance Architecture
The visual engine scales seamlessly across hardware tiers:
- **LOW**: Shadows disabled, single directional light, crowd turned off, simplified materials (32-segment geometries), minimal draw calls.
- **MEDIUM**: 1024x1024 directional shadow maps, medium crowd density (3 tiers), standard shaders.
- **HIGH**: 2048x2048 directional shadow maps, 4 floodlight tower spotlights casting authentic multi-angle cross-shadows, full crowd (5 tiers), atmospheric ground fog.
- **ULTRA**: Maximum shadow map resolution, soft shadow filtering, 4 floodlights + directional fill, maximum crowd density.
