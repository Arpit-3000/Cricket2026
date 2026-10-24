/**
 * Procedural Web Audio API Cricket Sound Engine
 * Zero external audio assets required - synthesizes authentic English willow cracks,
 * stump clatters, ball turf impacts, dynamic stadium crowd atmospheres, and player movements.
 */

export type BatHitType = 'SWEET_SPOT' | 'GOOD' | 'EDGED' | 'PAD';
export type CrowdReactionType = 'ROAR' | 'APPLAUSE' | 'GASP' | 'BOUNDARY_FOUR' | 'BOUNDARY_SIX' | 'WICKET';

class CricketAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private crowdGain: GainNode | null = null;
  private crowdAmbienceNode: AudioNode | null = null;
  private isAmbienceRunning = false;

  private masterVol = 0.8;
  private crowdVol = 0.7;
  private sfxVol = 0.85;

  private initContext() {
    if (this.ctx) return;
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.masterVol, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.setValueAtTime(this.sfxVol, this.ctx.currentTime);
      this.sfxGain.connect(this.masterGain);

      this.crowdGain = this.ctx.createGain();
      this.crowdGain.gain.setValueAtTime(this.crowdVol, this.ctx.currentTime);
      this.crowdGain.connect(this.masterGain);
    } catch {
      // AudioContext not available in headless or unsupported browser
    }
  }

  public updateVolumes(master: number, crowd: number, sfx: number) {
    this.masterVol = Math.max(0, Math.min(1, master / 100));
    this.crowdVol = Math.max(0, Math.min(1, crowd / 100));
    this.sfxVol = Math.max(0, Math.min(1, sfx / 100));

    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    if (this.masterGain) this.masterGain.gain.setTargetAtTime(this.masterVol, now, 0.05);
    if (this.crowdGain) this.crowdGain.gain.setTargetAtTime(this.crowdVol, now, 0.05);
    if (this.sfxGain) this.sfxGain.gain.setTargetAtTime(this.sfxVol, now, 0.05);
  }

  public resumeAudioContext() {
    this.initContext();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  /**
   * Synthesizes English willow bat impact on ball.
   * 'SWEET_SPOT': Sharp high-frequency transient crack with woody resonance.
   * 'GOOD': Solid woody thud.
   * 'EDGED': High-pitched crisp metallic snick.
   * 'PAD': Dull low-frequency foam cushion thud.
   */
  public playBatHit(type: BatHitType = 'GOOD') {
    this.resumeAudioContext();
    if (!this.ctx || !this.sfxGain) return;

    const now = this.ctx.currentTime;

    if (type === 'SWEET_SPOT') {
      // Primary willow crack impulse (noise burst)
      const bufferSize = this.ctx.sampleRate * 0.08;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * 0.012));
      }
      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;

      const bandpass = this.ctx.createBiquadFilter();
      bandpass.type = 'bandpass';
      bandpass.frequency.setValueAtTime(2600, now);
      bandpass.Q.setValueAtTime(3.5, now);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(1.0, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

      noise.connect(bandpass);
      bandpass.connect(gain);
      gain.connect(this.sfxGain);
      noise.start(now);

      // Resonant body tone of English willow blade
      const osc = this.ctx.createOscillator();
      const oscGain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(640, now);
      osc.frequency.exponentialRampToValueAtTime(320, now + 0.09);

      oscGain.gain.setValueAtTime(0.7, now);
      oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

      osc.connect(oscGain);
      oscGain.connect(this.sfxGain);
      osc.start(now);
      osc.stop(now + 0.1);
    } else if (type === 'EDGED') {
      // Crisp light snick
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(3200, now);
      osc.frequency.exponentialRampToValueAtTime(1400, now + 0.04);

      gain.gain.setValueAtTime(0.45, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);

      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(now);
      osc.stop(now + 0.05);
    } else if (type === 'PAD') {
      // Dull muffled foam/leather impact
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(160, now);
      osc.frequency.exponentialRampToValueAtTime(60, now + 0.12);

      gain.gain.setValueAtTime(0.8, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(now);
      osc.stop(now + 0.13);
    } else {
      // Standard bat contact
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(780, now);
      osc.frequency.exponentialRampToValueAtTime(280, now + 0.07);

      gain.gain.setValueAtTime(0.6, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);

      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(now);
      osc.stop(now + 0.08);
    }
  }

  /**
   * Synthesizes wooden stump clatter and flying bails.
   */
  public playStumpHit() {
    this.resumeAudioContext();
    if (!this.ctx || !this.sfxGain) return;

    const now = this.ctx.currentTime;

    // Fast multi-strike wooden clatter
    [0, 0.03, 0.07, 0.12].forEach((offset, idx) => {
      if (!this.ctx || !this.sfxGain) return;
      const t = now + offset;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(950 - idx * 120, t);
      osc.frequency.exponentialRampToValueAtTime(300, t + 0.08);

      gain.gain.setValueAtTime(0.8 - idx * 0.18, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);

      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(t);
      osc.stop(t + 0.09);
    });
  }

  /**
   * Synthesizes cricket ball bouncing on the pitch / turf.
   */
  public playBallBounce(paceRatio = 0.7) {
    this.resumeAudioContext();
    if (!this.ctx || !this.sfxGain) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(220 + paceRatio * 80, now);
    osc.frequency.exponentialRampToValueAtTime(70, now + 0.05);

    gain.gain.setValueAtTime(0.4 * paceRatio, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.055);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.06);
  }

  /**
   * Synthesizes player footsteps on turf.
   */
  public playFootstep() {
    this.resumeAudioContext();
    if (!this.ctx || !this.sfxGain) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(140 + Math.random() * 30, now);
    osc.frequency.exponentialRampToValueAtTime(50, now + 0.04);

    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.045);
  }

  /**
   * Synthesizes turf slide friction sound during dives.
   */
  public playTurfSlide() {
    this.resumeAudioContext();
    if (!this.ctx || !this.sfxGain) return;

    const now = this.ctx.currentTime;
    const bufferSize = this.ctx.sampleRate * 0.35;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * 0.15));
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1100, now);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);
    noise.start(now);
  }

  /**
   * Synthesizes umpire decision whistle / signal tone.
   */
  public playUmpireSignal() {
    this.resumeAudioContext();
    if (!this.ctx || !this.sfxGain) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.setValueAtTime(1174, now + 0.09);

    gain.gain.setValueAtTime(0.28, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.25);
  }

  /**
   * Synthesizes contextual crowd stadium reactions:
   * 'ROAR' / 'BOUNDARY_FOUR' / 'BOUNDARY_SIX': Dynamic swelling cheers.
   * 'WICKET': Huge cheer followed by applause.
   * 'GASP': Sudden collective breath drop.
   * 'APPLAUSE': Rhythmic clapping.
   */
  public playCrowdReaction(reaction: CrowdReactionType) {
    this.resumeAudioContext();
    if (!this.ctx || !this.crowdGain) return;

    const now = this.ctx.currentTime;

    if (reaction === 'ROAR' || reaction === 'BOUNDARY_FOUR' || reaction === 'BOUNDARY_SIX') {
      const duration = reaction === 'BOUNDARY_SIX' ? 3.2 : 2.2;
      const bufferSize = Math.floor(this.ctx.sampleRate * duration);
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;

      const bandpass = this.ctx.createBiquadFilter();
      bandpass.type = 'bandpass';
      bandpass.frequency.setValueAtTime(450, now);
      bandpass.frequency.linearRampToValueAtTime(750, now + 0.6);
      bandpass.frequency.exponentialRampToValueAtTime(320, now + duration);
      bandpass.Q.setValueAtTime(1.8, now);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.01, now);
      gain.gain.linearRampToValueAtTime(0.7, now + 0.4);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      noise.connect(bandpass);
      bandpass.connect(gain);
      gain.connect(this.crowdGain);
      noise.start(now);
    } else if (reaction === 'WICKET') {
      // Big sudden roar followed by ongoing applause
      const duration = 3.5;
      const bufferSize = Math.floor(this.ctx.sampleRate * duration);
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(600, now);
      filter.Q.setValueAtTime(1.5, now);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.85, now);
      gain.gain.exponentialRampToValueAtTime(0.18, now + 1.2);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.crowdGain);
      noise.start(now);
    } else if (reaction === 'GASP') {
      // Rapid collective intake of breath
      const duration = 0.9;
      const bufferSize = Math.floor(this.ctx.sampleRate * duration);
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.setValueAtTime(800, now);
      filter.frequency.linearRampToValueAtTime(1500, now + 0.4);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.01, now);
      gain.gain.linearRampToValueAtTime(0.45, now + 0.25);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.crowdGain);
      noise.start(now);
    }
  }

  /**
   * Continuous low-volume stadium murmur/ambience loop.
   */
  public startCrowdAmbience() {
    if (this.isAmbienceRunning) return;
    this.resumeAudioContext();
    if (!this.ctx || !this.crowdGain) return;

    try {
      // 5-second seamless looping pinkish noise for crowd murmur
      const sampleRate = this.ctx.sampleRate;
      const duration = 5.0;
      const bufferSize = Math.floor(sampleRate * duration);
      const buffer = this.ctx.createBuffer(1, bufferSize, sampleRate);
      const data = buffer.getChannelData(0);

      let b0 = 0, b1 = 0, b2 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        data[i] = (b0 + b1 + b2) * 0.12;
      }

      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;
      noise.loop = true;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(380, this.ctx.currentTime);
      filter.Q.setValueAtTime(0.8, this.ctx.currentTime);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.18, this.ctx.currentTime);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.crowdGain);
      noise.start(0);

      this.crowdAmbienceNode = noise;
      this.isAmbienceRunning = true;
    } catch {
      // Handle audio start errors safely
    }
  }

  public stopCrowdAmbience() {
    if (this.crowdAmbienceNode) {
      try {
        (this.crowdAmbienceNode as AudioBufferSourceNode).stop();
      } catch {}
      this.crowdAmbienceNode = null;
      this.isAmbienceRunning = false;
    }
  }
}

export const cricketAudio = new CricketAudioEngine();
