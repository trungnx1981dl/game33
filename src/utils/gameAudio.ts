// Web Audio API Procedural Sound Synthesizer for Science Adventure Game
class SoundEffectsManager {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;

  constructor() {
    // Lazy initialized on first user interaction
  }

  private getContext(): AudioContext | null {
    if (this.isMuted) return null;
    try {
      if (!this.ctx) {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContextClass) {
          this.ctx = new AudioContextClass();
        }
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      return this.ctx;
    } catch {
      return null;
    }
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    return this.isMuted;
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
  }

  // 1. Electronic Click (Bấm nút)
  public playClick() {
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1200, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.05);

      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.05);
    } catch {}
  }

  // 2. Pop Selection (Chọn đáp án)
  public playPop() {
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(450, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(900, ctx.currentTime + 0.08);

      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.08);
    } catch {}
  }

  // 3. Bright Chime (Đúng)
  public playCorrect() {
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6 (Bright Arpeggio)
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const startTime = ctx.currentTime + idx * 0.08;

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, startTime);

        gain.gain.setValueAtTime(0.18, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.35);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(startTime);
        osc.stop(startTime + 0.35);
      });
    } catch {}
  }

  // 4. Soft Low Buzz (Sai - nhẹ nhàng, không gây ức chế)
  public playIncorrect() {
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(180, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(140, ctx.currentTime + 0.2);

      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.2);
    } catch {}
  }

  // 5. EXP Whoosh (Tăng EXP)
  public playExpWhoosh() {
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(300, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1500, ctx.currentTime + 0.25);

      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.18, ctx.currentTime + 0.15);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.28);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.28);
    } catch {}
  }

  // 6. Level Up Fanfare (Thăng cấp)
  public playLevelUp() {
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const notes = [440, 554.37, 659.25, 880, 1108.73]; // A major fanfare
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const startTime = ctx.currentTime + idx * 0.09;

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, startTime);

        gain.gain.setValueAtTime(0.2, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.45);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(startTime);
        osc.stop(startTime + 0.45);
      });
    } catch {}
  }

  // 7. Power-up Unlock (Mở quyền năng)
  public playPowerUp() {
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(350, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1800, ctx.currentTime + 0.35);

      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.4);
    } catch {}
  }

  // 8. Victory / Mission Complete
  public playVictory() {
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5]; // C major triumph
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const startTime = ctx.currentTime + idx * 0.12;

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, startTime);

        gain.gain.setValueAtTime(0.22, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.6);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(startTime);
        osc.stop(startTime + 0.6);
      });
    } catch {}
  }

  // 9. Countdown Tick
  public playTick(isUrgent = false) {
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = isUrgent ? 'sawtooth' : 'triangle';
      osc.frequency.setValueAtTime(isUrgent ? 1100 : 800, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.05);

      gain.gain.setValueAtTime(isUrgent ? 0.12 : 0.06, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.05);
    } catch {}
  }

  // 10. Powerful Pulsing Heartbeat / Sub-bass Drum Beat (Đếm ngược nổi bật)
  public playDrumBeat(intensity = 1.0) {
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      // Sub-bass sine drop
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(150 * intensity, now);
      osc.frequency.exponentialRampToValueAtTime(35, now + 0.35);

      const targetVol = Math.min(0.45, 0.28 * intensity);
      gain.gain.setValueAtTime(targetVol, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.4);

      // Add metallic punch snap
      const snap = ctx.createOscillator();
      const snapGain = ctx.createGain();
      snap.type = 'triangle';
      snap.frequency.setValueAtTime(480, now);
      snap.frequency.exponentialRampToValueAtTime(90, now + 0.06);

      snapGain.gain.setValueAtTime(0.18 * intensity, now);
      snapGain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);

      snap.connect(snapGain);
      snapGain.connect(ctx.destination);
      snap.start(now);
      snap.stop(now + 0.07);
    } catch {}
  }

  // 11. Sci-Fi Transformation Warp & Quantum Shuffling Sweep
  public playSciFiWarp() {
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';

      // Sweep from 200Hz to 1600Hz and back down with flutter
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.exponentialRampToValueAtTime(1400, now + 0.25);
      osc.frequency.exponentialRampToValueAtTime(320, now + 0.55);

      gain.gain.setValueAtTime(0.01, now);
      gain.gain.linearRampToValueAtTime(0.16, now + 0.15);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.55);
    } catch {}
  }

  // 12. Atomic Planetary Timer Pulse & Orbital Hum
  public playAtomicPulse() {
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.exponentialRampToValueAtTime(1760, now + 0.12);

      gain.gain.setValueAtTime(0.14, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.25);
    } catch {}
  }

  // 13. Triumphant Fanfare with Shimmer
  public playFanfareFinish() {
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const chords = [523.25, 659.25, 783.99, 1046.50, 1318.51, 1567.98]; // C - E - G - C - E - G
      chords.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const startTime = ctx.currentTime + idx * 0.08;

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, startTime);

        gain.gain.setValueAtTime(0.2, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.7);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(startTime);
        osc.stop(startTime + 0.7);
      });
    } catch {}
  }
  // 14. Electronic "Ting" Bell (Âm thanh ting điện tử ngắn khi electron khóa quỹ đạo)
  public playElectronicTing(pitchFactor = 1.0) {
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1760 * pitchFactor, now); // High crystal A6
      osc.frequency.exponentialRampToValueAtTime(3520 * pitchFactor, now + 0.04);
      osc.frequency.exponentialRampToValueAtTime(1760 * pitchFactor, now + 0.28);

      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.3);

      // Shimmer harmonic overtone
      const overtone = ctx.createOscillator();
      const otGain = ctx.createGain();
      overtone.type = 'triangle';
      overtone.frequency.setValueAtTime(2637 * pitchFactor, now); // E7
      otGain.gain.setValueAtTime(0.12, now);
      otGain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      overtone.connect(otGain);
      otGain.connect(ctx.destination);
      overtone.start(now);
      overtone.stop(now + 0.22);
    } catch {}
  }

  // 15. Plasma Curve Swoosh
  public playPlasmaSwoosh() {
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(400, now);
      osc.frequency.exponentialRampToValueAtTime(1200, now + 0.15);
      osc.frequency.exponentialRampToValueAtTime(600, now + 0.3);

      gain.gain.setValueAtTime(0.01, now);
      gain.gain.linearRampToValueAtTime(0.15, now + 0.1);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.3);
    } catch {}
  }

  // 16. Procedural Grand Opening Fanfare (100% Offline Web Audio API Synthesizer - Zero External Audio Requests)
  private openingFanfareOscs: { osc: OscillatorNode; gain: GainNode }[] = [];
  private openingFanfareTimeout: any = null;

  public stopOpeningFanfare() {
    if (this.openingFanfareTimeout) {
      clearTimeout(this.openingFanfareTimeout);
      this.openingFanfareTimeout = null;
    }
    this.openingFanfareOscs.forEach(({ osc, gain }) => {
      try {
        if (this.ctx) {
          gain.gain.setValueAtTime(0, this.ctx.currentTime);
        }
        osc.stop();
        osc.disconnect();
      } catch {}
    });
    this.openingFanfareOscs = [];
  }

  public playOpeningFanfare(onEnd?: () => void): boolean {
    const ctx = this.getContext();
    if (!ctx) return false;
    this.stopOpeningFanfare();

    try {
      const now = ctx.currentTime;
      // Grand Heroic Science Competition Fanfare (in key of C / G Major with brass overtone harmonics)
      // Motif: C4 -> G4 -> C5 -> E5 -> G5 -> C6 with rich brass swells and celestial sparkles
      const chords = [
        // Intro trumpet call (0.0s - 1.2s)
        { t: 0.0, dur: 0.28, freqs: [261.63, 523.25], type: 'sawtooth', vol: 0.18 }, // C4, C5
        { t: 0.32, dur: 0.28, freqs: [392.00, 783.99], type: 'sawtooth', vol: 0.20 }, // G4, G5
        { t: 0.65, dur: 0.55, freqs: [523.25, 659.25, 1046.50], type: 'sawtooth', vol: 0.22 }, // C5, E5, C6
        
        // Rhythmic drive (1.3s - 2.8s)
        { t: 1.3, dur: 0.22, freqs: [392.00, 493.88], type: 'triangle', vol: 0.16 }, // G4, B4
        { t: 1.55, dur: 0.22, freqs: [440.00, 523.25], type: 'triangle', vol: 0.17 }, // A4, C5
        { t: 1.8, dur: 0.22, freqs: [493.88, 587.33], type: 'triangle', vol: 0.18 }, // B4, D5
        { t: 2.1, dur: 0.75, freqs: [523.25, 659.25, 783.99, 1046.50], type: 'sawtooth', vol: 0.24 }, // C Major Full

        // Sub-bass timpani strikes
        { t: 0.0, dur: 0.45, freqs: [130.81, 65.41], type: 'sine', vol: 0.25 }, // C3, C2
        { t: 0.65, dur: 0.6, freqs: [130.81, 65.41], type: 'sine', vol: 0.28 },
        { t: 2.1, dur: 1.2, freqs: [130.81, 65.41], type: 'sine', vol: 0.35 },

        // Sparkling celestial arpeggios (2.9s - 4.5s)
        { t: 2.9, dur: 0.2, freqs: [1046.50, 1318.51], type: 'sine', vol: 0.12 },
        { t: 3.1, dur: 0.2, freqs: [1174.66, 1567.98], type: 'sine', vol: 0.12 },
        { t: 3.3, dur: 0.2, freqs: [1318.51, 1760.00], type: 'sine', vol: 0.13 },
        { t: 3.5, dur: 0.2, freqs: [1567.98, 2093.00], type: 'sine', vol: 0.14 },

        // Grand Climax Cadence (3.8s - 6.0s)
        { t: 3.8, dur: 2.2, freqs: [261.63, 329.63, 392.00, 523.25, 659.25, 1046.50, 2093.00], type: 'sawtooth', vol: 0.25 }
      ];

      chords.forEach(c => {
        c.freqs.forEach(f => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = c.type as OscillatorType;
          osc.frequency.setValueAtTime(f, now + c.t);

          gain.gain.setValueAtTime(0.001, now + c.t);
          gain.gain.linearRampToValueAtTime(c.vol / c.freqs.length, now + c.t + 0.04);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + c.t + c.dur);

          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + c.t);
          osc.stop(now + c.t + c.dur);

          this.openingFanfareOscs.push({ osc, gain });
        });
      });

      this.openingFanfareTimeout = setTimeout(() => {
        this.stopOpeningFanfare();
        if (onEnd) onEnd();
      }, 6200);

      return true;
    } catch {
      return false;
    }
  }
}

export const gameAudio = new SoundEffectsManager();
