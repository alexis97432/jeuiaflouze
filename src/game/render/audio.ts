/**
 * Effets sonores synthétisés (aucun fichier audio à charger).
 *
 * L'AudioContext n'est créé que dans `unlock()`, appelé depuis un geste
 * utilisateur (pointerdown / keydown) : aucune lecture avant interaction.
 * `enabled = false` : jamais de contexte créé. `close()` libère le contexte.
 */
import type { ThemeAudio } from './themes';

type AudioContextCtor = typeof AudioContext;
/** Boosts v2 (Ralenti, ×2) et v3 (Ralenti, Aimant, Bouclier). */
export type BoostSound = 'ralenti' | 'double' | 'aimant' | 'bouclier';
/** Absurdités décoratives de la V5. */
export type GagSound = 'duck' | 'ufo' | 'pigeon';

/** Son par défaut (pentatonique majeure, triangle) si aucun univers n'est fourni. */
const DEFAULT_AUDIO: ThemeAudio = { wave: 'triangle', root: 523.25, scale: [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24] };

export class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private closed = false;
  /** Variation cosmétique (±3 %) pour que les sons répétés ne lassent pas ; jamais le PRNG du jeu. */
  private detune = (): number => 1 + (Math.random() - 0.5) * 0.06;

  /** Gain maximal (volume 1). Le volume du joueur (0 à 1) le module. */
  static readonly BASE_GAIN = 0.22;

  constructor(private enabled: boolean, private audio: ThemeAudio = DEFAULT_AUDIO, private volume = 1) {
    this.volume = Sfx.clampVolume(volume);
  }

  private static clampVolume(v: number): number {
    return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 1;
  }

  private gainValue(): number {
    return this.enabled ? Sfx.BASE_GAIN * this.volume : 0;
  }

  /** Volume du joueur (V4), appliqué tout de suite si le son est déjà démarré. */
  setVolume(value: number): void {
    this.volume = Sfx.clampVolume(value);
    if (this.master) this.master.gain.value = this.gainValue();
  }

  get currentVolume(): number { return this.volume; }

  /** Timbre et gamme de l'univers (V2) : la série de parfaits joue la gamme de l'univers. */
  setAudio(audio: ThemeAudio): void {
    this.audio = audio;
  }

  get context(): AudioContext | null { return this.ctx; }

  setEnabled(value: boolean): void {
    this.enabled = value;
    if (this.master) this.master.gain.value = this.gainValue();
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
      this.master.gain.value = this.gainValue();
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

  /** Chute : grondement bref et « crash » de bruit filtré (V5). */
  miss(): void {
    this.tone(140, 0.42, 'sawtooth', 0.45, 0.35);
    this.noise(0.38, 0.5, 'lowpass', 900, 0);
  }

  /**
   * Boost déclenché. Chaque boost a sa signature, reconnaissable sans regarder :
   * Ralenti = glissando descendant ; ×2 = notes montantes ; Aimant = « zing » métallique ;
   * Bouclier = accord qui scintille.
   */
  bonusStart(bonus: BoostSound): void {
    const { root, wave } = this.audio;
    if (bonus === 'ralenti') {
      this.tone(root * 2, 0.55, 'sine', 0.7, 0.45);
      this.tone(root * 3, 0.4, 'sine', 0.25, 0.45, 0.05);
    } else if (bonus === 'double') {
      this.tone(root * 2, 0.12, wave, 0.7, 1);
      this.tone(root * 3, 0.18, wave, 0.7, 1, 0.1);
      this.tone(root * 4, 0.22, 'sine', 0.35, 1, 0.2);
    } else if (bonus === 'aimant') {
      this.tone(root * 3, 0.32, 'square', 0.18, 1.5);
      this.tone(root * 3.02, 0.32, 'square', 0.14, 1.48, 0.01);
      this.noise(0.12, 0.25, 'highpass', 4000, 0);
    } else {
      [1, 1.25, 1.5, 2].forEach((m, i) => this.tone(root * 2 * m, 0.5, 'sine', 0.22, 1.02, i * 0.05));
    }
  }

  /** Aimant : le bloc se colle (« clac ! » métallique). */
  snap(): void {
    const f = 1900 * this.detune();
    this.tone(f, 0.05, 'square', 0.22, 0.6);
    this.tone(f * 0.5, 0.09, 'triangle', 0.35, 0.8, 0.012);
    this.noise(0.05, 0.3, 'highpass', 3000, 0);
  }

  /** Bouclier : rebond (« boing ») et bris de bulle. */
  shieldSave(): void {
    const ctx = this.ctx;
    if (!this.ready() || !ctx) return;
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(180, t0);
    osc.frequency.exponentialRampToValueAtTime(520, t0 + 0.12);
    osc.frequency.exponentialRampToValueAtTime(240, t0 + 0.38);
    env.gain.setValueAtTime(0.0001, t0);
    env.gain.exponentialRampToValueAtTime(0.7, t0 + 0.01);
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.42);
    osc.connect(env).connect(this.master!);
    osc.start(t0);
    osc.stop(t0 + 0.45);
    osc.onended = () => { osc.disconnect(); env.disconnect(); };
    this.noise(0.22, 0.35, 'highpass', 5000, 0.04);
  }

  /** Fin du rattrapage : l'étage repart (petit bip montant). */
  rearm(): void {
    this.tone(this.audio.root * 1.5, 0.12, 'triangle', 0.4, 1.5);
  }

  /** Fièvre : arpège qui monte vite, souffle. */
  feverStart(): void {
    const { scale, root, wave } = this.audio;
    [0, 2, 4, 6, 8].forEach((k, i) => {
      const step = scale[Math.min(k, scale.length - 1)] ?? 0;
      this.tone(root * 2 ** (step / 12) * 2, 0.14, wave, 0.45, 1, i * 0.055);
    });
    this.noise(0.4, 0.2, 'bandpass', 1500, 0.05);
  }

  /** Fin de Fièvre : « pschhh » qui retombe. */
  feverEnd(): void {
    this.noise(0.5, 0.28, 'highpass', 2500, 0);
    this.tone(this.audio.root * 1.5, 0.35, 'sine', 0.25, 0.5);
  }

  /** Absurdités : coin-coin, vibrato d'ovni, battements d'ailes. Rares et discrets. */
  gag(kind: GagSound): void {
    if (kind === 'duck') {
      this.tone(620 * this.detune(), 0.11, 'square', 0.12, 1.3);
      this.tone(560 * this.detune(), 0.13, 'square', 0.12, 1.25, 0.16);
    } else if (kind === 'ufo') {
      for (let i = 0; i < 4; i++) this.tone(700 + (i % 2) * 180, 0.12, 'sine', 0.12, 1.1, i * 0.1);
    } else {
      for (let i = 0; i < 3; i++) this.noise(0.05, 0.12, 'bandpass', 2200, i * 0.07);
    }
  }

  /** Arrière-plan : le contexte audio est suspendu, puis repris au retour. */
  suspend(): void {
    if (this.ctx && this.ctx.state === 'running') void this.ctx.suspend().catch(() => {});
  }

  resume(): void {
    if (this.ctx && this.ctx.state === 'suspended' && this.enabled) void this.ctx.resume().catch(() => {});
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
    this.noiseBuffer = null;
    if (ctx && ctx.state !== 'closed') void ctx.close().catch(() => {});
  }

  private ready(): boolean {
    return this.ctx !== null && this.master !== null && this.enabled && this.ctx.state === 'running';
  }

  /** Bruit blanc filtré (impacts, souffles) ; un seul tampon d'une seconde, réutilisé. */
  private noise(duration: number, gain: number, type: BiquadFilterType, freq: number, delay: number): void {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master || !this.ready()) return;
    if (!this.noiseBuffer) {
      const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      this.noiseBuffer = buffer;
    }
    const t0 = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = freq;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t0);
    env.gain.exponentialRampToValueAtTime(gain, t0 + 0.006);
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    src.connect(filter).connect(env).connect(master);
    src.start(t0, Math.random() * 0.5, duration + 0.02);
    src.onended = () => { src.disconnect(); filter.disconnect(); env.disconnect(); };
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
