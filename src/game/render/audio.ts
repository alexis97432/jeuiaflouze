/**
 * Effets sonores synthétisés (aucun fichier audio à charger).
 *
 * L'AudioContext n'est créé que dans `unlock()`, appelé depuis un geste
 * utilisateur (pointerdown / keydown) : aucune lecture avant interaction.
 * `enabled = false` : jamais de contexte créé. `close()` libère le contexte.
 */
import type { ThemeAudio } from './themes';

type AudioContextCtor = typeof AudioContext;

/** Son par défaut (pentatonique majeure, triangle) si aucun univers n'est fourni. */
const DEFAULT_AUDIO: ThemeAudio = { wave: 'triangle', root: 523.25, scale: [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24] };

export class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private closed = false;

  constructor(private enabled: boolean, private audio: ThemeAudio = DEFAULT_AUDIO) {}

  /** Timbre et gamme de l'univers (V2) : la série de parfaits joue la gamme de l'univers. */
  setAudio(audio: ThemeAudio): void {
    this.audio = audio;
  }

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
    const { scale, root, wave } = this.audio;
    const step = scale[Math.min(streak - 1, scale.length - 1)] ?? 0;
    const f = root * 2 ** (step / 12);
    this.tone(f, 0.16, wave, 0.8, 1);
    this.tone(f * 2, 0.1, 'sine', 0.25, 1, 0.015);
  }

  /** Palier atteint : arpège de trois notes de la gamme de l'univers. */
  milestone(): void {
    const { scale, root, wave } = this.audio;
    [0, 2, 4].forEach((k, i) => {
      const step = scale[Math.min(k, scale.length - 1)] ?? 0;
      this.tone(root * 2 ** (step / 12), 0.22, wave, 0.55, 1, i * 0.09);
    });
  }

  miss(): void {
    this.tone(140, 0.42, 'sawtooth', 0.5, 0.35);
  }

  /** Bonus déclenché (V3) : Ralenti = glissando descendant doux ; ×2 = deux notes montantes vives. */
  bonusStart(bonus: 'ralenti' | 'double'): void {
    const { root, wave } = this.audio;
    if (bonus === 'ralenti') {
      this.tone(root * 2, 0.45, 'sine', 0.7, 0.5);
      this.tone(root * 3, 0.3, 'sine', 0.25, 0.5, 0.05);
    } else {
      this.tone(root * 2, 0.12, wave, 0.7, 1);
      this.tone(root * 3, 0.18, wave, 0.7, 1, 0.1);
      this.tone(root * 4, 0.22, 'sine', 0.35, 1, 0.2);
    }
  }

  /** Fin de bonus : petite note descendante. */
  bonusEnd(): void {
    this.tone(this.audio.root * 1.5, 0.2, 'triangle', 0.4, 0.6);
  }

  /** Compte à rebours de reprise : 3, 2, 1 graves, puis « partez » aigu (n = 0). */
  countdown(n: number): void {
    const f = this.audio.root * (n === 0 ? 2 : 1);
    this.tone(f, n === 0 ? 0.25 : 0.12, 'triangle', 0.6, 1);
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
