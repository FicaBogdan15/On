// Sound hooks. Placeholder effects are synthesized with WebAudio so no audio assets are required;
// swap `play()` recipes for real samples later without touching any call sites.

export type SfxName =
  | 'hover'
  | 'click'
  | 'diceRoll'
  | 'diceLand'
  | 'hop'
  | 'positive'
  | 'negative'
  | 'shield'
  | 'portal'
  | 'swap'
  | 'mystery'
  | 'miniGameStart'
  | 'countdown'
  | 'correct'
  | 'wrong'
  | 'winner'
  | 'type';

export interface VolumeSettings {
  master: number;
  music: number;
  sfx: number;
}

const SETTINGS_KEY = 'pixelpawns.audio';

class AudioManager {
  private ctx: AudioContext | null = null;
  private sfxGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private musicTimer: number | null = null;
  settings: VolumeSettings = { master: 0.7, music: 0.25, sfx: 0.8 };

  constructor() {
    try {
      const saved = localStorage.getItem(SETTINGS_KEY);
      if (saved) this.settings = { ...this.settings, ...JSON.parse(saved) };
    } catch {
      /* ignore */
    }
    // Browsers only allow audio after a user gesture.
    const unlock = () => {
      this.ensure();
      this.startMusic();
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
  }

  private ensure() {
    if (this.ctx) return this.ctx;
    try {
      this.ctx = new AudioContext();
      this.sfxGain = this.ctx.createGain();
      this.musicGain = this.ctx.createGain();
      this.sfxGain.connect(this.ctx.destination);
      this.musicGain.connect(this.ctx.destination);
      this.applyVolumes();
    } catch {
      this.ctx = null;
    }
    return this.ctx;
  }

  setVolumes(v: Partial<VolumeSettings>) {
    this.settings = { ...this.settings, ...v };
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings));
    } catch {
      /* ignore */
    }
    this.applyVolumes();
  }

  private applyVolumes() {
    if (!this.ctx) return;
    this.sfxGain!.gain.value = this.settings.master * this.settings.sfx * 0.5;
    this.musicGain!.gain.value = this.settings.master * this.settings.music * 0.18;
  }

  private tone(freq: number, duration: number, type: OscillatorType = 'square', delay = 0, slideTo?: number, volume = 1) {
    const ctx = this.ensure();
    if (!ctx || !this.sfxGain) return;
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + duration);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.4 * volume, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(gain).connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + duration + 0.02);
  }

  private noise(duration: number, delay = 0, volume = 0.3) {
    const ctx = this.ensure();
    if (!ctx || !this.sfxGain) return;
    const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * duration), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const src = ctx.createBufferSource();
    const gain = ctx.createGain();
    gain.gain.value = volume;
    src.buffer = buffer;
    src.connect(gain).connect(this.sfxGain);
    src.start(ctx.currentTime + delay);
  }

  play(name: SfxName | string) {
    if (this.settings.master <= 0 || this.settings.sfx <= 0) return;
    switch (name) {
      case 'hover': return this.tone(880, 0.04, 'square', 0, undefined, 0.25);
      case 'click': return this.tone(520, 0.06, 'square', 0, 780, 0.6);
      case 'type': return this.tone(1200, 0.025, 'square', 0, undefined, 0.2);
      case 'diceRoll': for (let i = 0; i < 6; i++) this.noise(0.04, i * 0.08, 0.25); return;
      case 'diceLand': this.noise(0.08, 0, 0.4); return this.tone(220, 0.12, 'triangle');
      case 'hop': return this.tone(330, 0.08, 'square', 0, 520, 0.5);
      case 'positive': [523, 659, 784].forEach((f, i) => this.tone(f, 0.12, 'square', i * 0.07, undefined, 0.6)); return;
      case 'negative': return this.tone(330, 0.3, 'sawtooth', 0, 150, 0.5);
      case 'shield': [988, 1319].forEach((f, i) => this.tone(f, 0.18, 'triangle', i * 0.08)); return;
      case 'portal': return this.tone(200, 0.6, 'sine', 0, 1400, 0.7);
      case 'swap': this.tone(400, 0.25, 'square', 0, 800, 0.5); return this.tone(800, 0.25, 'square', 0.25, 400, 0.5);
      case 'mystery': [392, 466, 523, 622].forEach((f, i) => this.tone(f, 0.1, 'triangle', i * 0.09)); return;
      case 'miniGameStart': [392, 523, 659, 784].forEach((f, i) => this.tone(f, 0.14, 'square', i * 0.09, undefined, 0.6)); return;
      case 'countdown': return this.tone(660, 0.12, 'square', 0, undefined, 0.5);
      case 'correct': [659, 988].forEach((f, i) => this.tone(f, 0.14, 'square', i * 0.08, undefined, 0.6)); return;
      case 'wrong': return this.tone(180, 0.25, 'square', 0, 120, 0.5);
      case 'winner': [523, 659, 784, 1047, 784, 1047].forEach((f, i) => this.tone(f, 0.18, 'square', i * 0.12, undefined, 0.6)); return;
    }
  }

  /** Very small looping chiptune placeholder. Replace with a real track later. */
  private startMusic() {
    const ctx = this.ensure();
    if (!ctx || this.musicTimer !== null || !this.musicGain) return;
    const notes = [392, 440, 523, 587, 523, 440, 392, 330, 349, 392, 440, 392, 349, 330, 294, 330];
    let step = 0;
    this.musicTimer = window.setInterval(() => {
      if (!this.ctx || this.settings.music <= 0 || this.settings.master <= 0) return;
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = notes[step % notes.length] / (step % 8 < 4 ? 1 : 2);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.5, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.38);
      osc.connect(g).connect(this.musicGain!);
      osc.start(t);
      osc.stop(t + 0.4);
      step++;
    }, 420);
  }
}

export const audio = new AudioManager();
