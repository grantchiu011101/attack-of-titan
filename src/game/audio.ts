export class GameAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  volume = 0.7;
  muted = false;

  private ensure(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx;
  }

  setVolume(v: number): void {
    this.volume = v;
    if (this.master) this.master.gain.value = this.muted ? 0 : v;
  }

  private tone(freq: number, dur: number, type: OscillatorType, gain: number, freqEnd?: number): void {
    const ctx = this.ensure();
    if (!ctx || !this.master || this.muted) return;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    if (freqEnd) osc.frequency.exponentialRampToValueAtTime(freqEnd, ctx.currentTime + dur);
    g.gain.setValueAtTime(gain, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    osc.connect(g).connect(this.master);
    osc.start();
    osc.stop(ctx.currentTime + dur);
  }

  private noise(dur: number, gain: number, hp = 400): void {
    const ctx = this.ensure();
    if (!ctx || !this.master || this.muted) return;
    const buffer = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = hp;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    src.connect(filter).connect(g).connect(this.master);
    src.start();
  }

  hook(): void {
    this.tone(420, 0.08, 'square', 0.08, 180);
  }

  slash(): void {
    this.noise(0.12, 0.18, 1800);
    this.tone(880, 0.1, 'sawtooth', 0.05, 220);
  }

  kill(): void {
    this.tone(140, 0.35, 'sine', 0.2, 50);
    this.noise(0.25, 0.12, 200);
  }

  gas(): void {
    this.noise(0.08, 0.04, 900);
  }

  hurt(): void {
    this.tone(90, 0.25, 'sawtooth', 0.16, 40);
  }

  death(): void {
    this.tone(200, 0.8, 'triangle', 0.15, 40);
  }

  ui(): void {
    this.tone(520, 0.06, 'sine', 0.06);
  }
}

export const audio = new GameAudio();
