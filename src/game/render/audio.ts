/**
 * Effets sonores synthétisés (aucun fichier audio à charger).
 *
 * L'AudioContext n'est créé que dans `unlock()`, appelé depuis un geste
 * utilisateur (pointerdown / keydown) : aucune lecture avant interaction.
 * `enabled = false` : jamais de contexte créé. `close()` libère le contexte.
 */
type AudioContextCtor = typeof AudioContext;

/** Gamme pentatonique (demi-tons) : la série de parfaits monte d'une note par pose. */
const PENTATONIC = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24, 26, 28, 31];

export class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private closed = false;

  constructor(private enabled: boolean) {}

  get context(): AudioContext | null { return this.ctx; }

  setEnabled(value: boolean): void {
    this.enabled = value;
    if (this.master) this.master.gain.value = value ? 0.22 : 0;
  }

  unlock(): void {
    if (!this.enabled || this.closed) return;
    if (!this.ctx) {
      const w = globalThis as unknown as { AudioContext?: AudioContextCtor; webkitAudioContext?: AudioContextCtor };
      const Ctor = w.AudioContext ?? w.webkitAudioContext;
      if (!Ctor) return;
      try {
        this.ctx = new Ctor();
      } catch {
        this.enabled = false;
        return;
      }
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.22;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume().catch(() => {});
  }

  place(widthRatio: number): void {
    // Plus la base est étroite, plus le son est aigu : la tension monte.
    this.tone(180 + 160 * (1 - widthRatio), 0.09, 'triangle', 0.9, 0.7);
  }

  perfect(streak: number): void {
    const step = PENTATONIC[Math.min(streak - 1, PENTATONIC.length - 1)] ?? 0;
    const f = 523.25 * 2 ** (step / 12);
    this.tone(f, 0.16, 'sine', 0.8, 1);
    this.tone(f * 2, 0.1, 'sine', 0.25, 1, 0.015);
  }

  miss(): void {
    this.tone(140, 0.42, 'sawtooth', 0.5, 0.35);
  }

  close(): void {
    this.closed = true;
    const ctx = this.ctx;
    this.ctx = null;
    this.master = null;
    if (ctx && ctx.state !== 'closed') void ctx.close().catch(() => {});
  }

  private tone(freq: number, duration: number, type: OscillatorType, gain: number, endRatio: number, delay = 0): void {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master || !this.enabled || ctx.state !== 'running') return;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq * endRatio), t0 + duration);
    env.gain.setValueAtTime(0.0001, t0);
    env.gain.exponentialRampToValueAtTime(gain, t0 + 0.008);
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(env).connect(master);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
    osc.onended = () => { osc.disconnect(); env.disconnect(); };
  }
}
