// All sound is generated with the Web Audio API: no files, no network, no dependencies.
// The context is created on the first user gesture, and the music is a small scheduled pulse.

const NOTE = (midi) => 440 * 2 ** ((midi - 69) / 12);
const BASS = [33, 29, 36, 31, 33, 29, 40, 43];

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.sfxGain = null;
    this.musicGain = null;
    this.muted = false;
    this.music = null;
    this.noise = null;

    const unlock = () => {
      this.ensure();
      if (this.ctx?.state === 'suspended') this.ctx.resume().catch(() => {});
    };
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
  }

  ensure() {
    if (this.ctx) return this.ctx;
    const AudioContext = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AudioContext) return null;
    try {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.8;
      this.master.connect(this.ctx.destination);
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = 0.72;
      this.sfxGain.connect(this.master);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.25;
      this.musicGain.connect(this.master);
      return this.ctx;
    } catch {
      this.ctx = null;
      return null;
    }
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master) {
      const now = this.ctx.currentTime;
      this.master.gain.cancelScheduledValues(now);
      this.master.gain.setTargetAtTime(muted ? 0 : 0.8, now, 0.04);
    }
  }

  tone({
    freq = 440,
    endFreq = null,
    type = 'sine',
    duration = 0.12,
    volume = 0.12,
    delay = 0,
    attack = 0.005,
    pan = 0,
    destination = 'sfx',
  }) {
    const ctx = this.ensure();
    if (!ctx) return;
    const start = ctx.currentTime + delay;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(Math.max(1, freq), start);
    if (endFreq !== null) {
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, endFreq), start + duration);
    }
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), start + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    const output = destination === 'music' ? this.musicGain : this.sfxGain;
    if (pan !== 0 && ctx.createStereoPanner) {
      const panner = ctx.createStereoPanner();
      panner.pan.value = pan;
      oscillator.connect(gain).connect(panner).connect(output);
    } else {
      oscillator.connect(gain).connect(output);
    }
    oscillator.start(start);
    oscillator.stop(start + duration + 0.04);
  }

  noiseBurst({ duration = 0.18, volume = 0.14, cutoff = 1800, delay = 0 }) {
    const ctx = this.ensure();
    if (!ctx) return;
    if (!this.noise) {
      const samples = Math.floor(ctx.sampleRate * 0.6);
      this.noise = ctx.createBuffer(1, samples, ctx.sampleRate);
      const channel = this.noise.getChannelData(0);
      for (let i = 0; i < samples; i += 1) channel[i] = Math.random() * 2 - 1;
    }
    const start = ctx.currentTime + delay;
    const source = ctx.createBufferSource();
    source.buffer = this.noise;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(cutoff, start);
    filter.frequency.exponentialRampToValueAtTime(180, start + duration);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    source.connect(filter).connect(gain).connect(this.sfxGain);
    source.start(start);
    source.stop(start + duration + 0.02);
  }

  sfx(name, data = {}) {
    if (!this.ctx) this.ensure();
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    switch (name) {
      case 'start':
        this.tone({ freq: 110, endFreq: 520, type: 'sawtooth', duration: 0.42, volume: 0.08 });
        this.tone({ freq: 880, endFreq: 1320, type: 'triangle', duration: 0.2, volume: 0.1, delay: 0.18 });
        this.startMusic();
        break;
      case 'wave':
        this.tone({ freq: 330, type: 'triangle', duration: 0.12, volume: 0.08 });
        this.tone({ freq: 495, type: 'triangle', duration: 0.16, volume: 0.08, delay: 0.09 });
        break;
      case 'launch':
        this.tone({ freq: 240, endFreq: 840, type: 'triangle', duration: 0.18, volume: 0.11 });
        break;
      case 'paddle': {
        const pan = Number.isFinite(data.rel) ? data.rel * 0.35 : 0;
        this.tone({ freq: 240, endFreq: 165, type: 'sine', duration: 0.1, volume: 0.16, pan });
        this.tone({ freq: 480, endFreq: 360, type: 'triangle', duration: 0.07, volume: 0.06, pan });
        break;
      }
      case 'wall':
        this.tone({ freq: 760, endFreq: 500, type: 'sine', duration: 0.045, volume: 0.035 });
        break;
      case 'brick': {
        const combo = Math.min(16, data.combo ?? 0);
        this.tone({
          freq: 430 + combo * 22,
          endFreq: 520 + combo * 24,
          type: 'square',
          duration: 0.065,
          volume: 0.055,
        });
        this.tone({ freq: 860 + combo * 32, type: 'triangle', duration: 0.04, volume: 0.035 });
        break;
      }
      case 'break': {
        const combo = Math.min(24, data.combo ?? 0);
        this.tone({ freq: 560 + combo * 18, endFreq: 260, type: 'sawtooth', duration: 0.12, volume: 0.07 });
        this.noiseBurst({ duration: 0.1, volume: 0.055, cutoff: 2600 });
        break;
      }
      case 'coreHit':
        this.tone({ freq: 118, endFreq: 70, type: 'square', duration: 0.16, volume: 0.11 });
        this.noiseBurst({ duration: 0.12, volume: 0.08, cutoff: 900 });
        break;
      case 'coreBreak':
        this.tone({ freq: 150, endFreq: 38, type: 'sawtooth', duration: 0.9, volume: 0.16 });
        this.noiseBurst({ duration: 0.7, volume: 0.2, cutoff: 3200 });
        break;
      case 'powerup':
        [440, 660, 880].forEach((freq, index) => {
          this.tone({ freq, type: 'triangle', duration: 0.12, volume: 0.065, delay: index * 0.055 });
        });
        break;
      case 'shield':
        this.tone({ freq: 180, endFreq: 520, type: 'square', duration: 0.26, volume: 0.12 });
        this.noiseBurst({ duration: 0.22, volume: 0.09, cutoff: 4200 });
        break;
      case 'lose':
        this.tone({ freq: 320, endFreq: 64, type: 'sawtooth', duration: 0.5, volume: 0.14 });
        this.noiseBurst({ duration: 0.3, volume: 0.1, cutoff: 900 });
        break;
      case 'clear':
        [523, 659, 784, 1046].forEach((freq, index) => {
          this.tone({ freq, type: 'triangle', duration: 0.2, volume: 0.075, delay: index * 0.075 });
        });
        break;
      case 'gameover':
        this.stopMusic();
        [392, 311, 261, 196].forEach((freq, index) => {
          this.tone({ freq, type: 'sawtooth', duration: 0.34, volume: 0.075, delay: index * 0.16 });
        });
        break;
      case 'victory':
        this.stopMusic();
        [261, 329, 392, 523, 659].forEach((freq, index) => {
          this.tone({ freq, type: 'triangle', duration: 0.45, volume: 0.075, delay: index * 0.11 });
        });
        break;
      case 'ui':
        this.tone({ freq: 620, endFreq: 760, type: 'sine', duration: 0.055, volume: 0.05 });
        break;
      default:
        break;
    }
  }

  startMusic() {
    const ctx = this.ensure();
    if (!ctx || this.music) return;
    this.music = { step: 0, timer: null, nextTime: ctx.currentTime + 0.1 };
    const schedule = () => {
      if (!this.music) return;
      const now = ctx.currentTime;
      while (this.music.nextTime < now + 0.18) {
        this.scheduleMusicStep(this.music.step, this.music.nextTime);
        this.music.step += 1;
        this.music.nextTime += 0.235;
      }
    };
    this.music.timer = setInterval(schedule, 70);
    schedule();
  }

  scheduleMusicStep(step, at) {
    const ctx = this.ctx;
    if (!ctx) return;
    const bassMidi = BASS[Math.floor(step / 8) % BASS.length];
    const gate = step % 8;
    const delay = Math.max(0, at - ctx.currentTime);
    if (gate === 0 || gate === 3 || gate === 6) {
      this.tone({
        freq: NOTE(bassMidi),
        endFreq: NOTE(bassMidi) * 0.985,
        type: 'triangle',
        duration: 0.2,
        volume: 0.08,
        delay,
        destination: 'music',
      });
    }
    if (step % 2 === 0) {
      const arp = [0, 7, 12, 15, 12, 7];
      const midi = bassMidi + 24 + arp[(step / 2) % arp.length];
      this.tone({
        freq: NOTE(midi),
        type: 'sine',
        duration: 0.11,
        volume: 0.025,
        delay,
        destination: 'music',
        pan: ((step % 4) - 1.5) * 0.25,
      });
    }
    if (step % 8 === 0) {
      const kick = ctx.createOscillator();
      const gain = ctx.createGain();
      kick.type = 'sine';
      kick.frequency.setValueAtTime(120, at);
      kick.frequency.exponentialRampToValueAtTime(38, at + 0.14);
      gain.gain.setValueAtTime(0.12, at);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.18);
      kick.connect(gain).connect(this.musicGain);
      kick.start(at);
      kick.stop(at + 0.2);
    }
  }

  stopMusic() {
    if (this.music?.timer) clearInterval(this.music.timer);
    this.music = null;
  }
}
