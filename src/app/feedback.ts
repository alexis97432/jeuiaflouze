/**
 * Retours sensoriels de l'interface (V4) : vibrations et petits sons, tous deux optionnels.
 *
 * - Vibrations : seulement si l'appareil fournit `navigator.vibrate` (Android en général ; pas
 *   iOS Safari). Sinon `available` vaut false et le réglage n'est pas proposé comme un bouton.
 * - Sons d'interface : synthétisés (aucun fichier), contexte audio créé au premier son, donc
 *   toujours dans un geste du joueur. Coupés si le son est coupé ou le volume à zéro.
 */

export type Haptics = { readonly available: boolean; vibrate(pattern: number | readonly number[]): void };

export function browserHaptics(nav: Navigator | undefined = globalThis.navigator): Haptics {
  const available = typeof nav?.vibrate === 'function';
  return {
    available,
    vibrate(pattern) {
      if (!available) return;
      try {
        nav!.vibrate(pattern as number | number[]);
      } catch {
        // Refus du navigateur (pas encore de geste, politique) : sans conséquence.
      }
    },
  };
}

/** Motifs courts : jamais plus d'environ 0,15 s, pour ne pas gêner le rythme. */
export const HAPTIC_PATTERNS = {
  tap: 6,
  place: 8,
  perfect: [10, 30, 14],
  miss: [35, 30, 50],
  reward: [12, 40, 20],
} as const;
export type HapticKind = keyof typeof HAPTIC_PATTERNS;

export type UiSoundKind = 'tap' | 'coin' | 'reward' | 'levelup' | 'error';
export type UiSound = { play(kind: UiSoundKind, volume: number): void; close(): void };

type AudioCtor = typeof AudioContext;

/** Notes (Hz) et durées (s) de chaque son : courts et doux. */
const MELODIES: Record<UiSoundKind, { notes: number[]; step: number; length: number; wave: OscillatorType }> = {
  tap: { notes: [660], step: 0, length: 0.05, wave: 'sine' },
  coin: { notes: [988, 1319], step: 0.07, length: 0.12, wave: 'triangle' },
  reward: { notes: [523, 659, 784], step: 0.08, length: 0.16, wave: 'triangle' },
  levelup: { notes: [523, 659, 784, 1047, 1319], step: 0.08, length: 0.2, wave: 'triangle' },
  error: { notes: [247, 196], step: 0.09, length: 0.12, wave: 'sine' },
};

type AudioWindow = { AudioContext?: AudioCtor; webkitAudioContext?: AudioCtor };

export function createUiSound(win: AudioWindow | null | undefined = globalThis.window as unknown as AudioWindow): UiSound {
  let ctx: AudioContext | null = null;
  let broken = false;
  const context = (): AudioContext | null => {
    if (ctx || broken) return ctx;
    const Ctor = win?.AudioContext ?? win?.webkitAudioContext;
    if (!Ctor) {
      broken = true;
      return null;
    }
    try {
      ctx = new Ctor();
    } catch {
      broken = true;
    }
    return ctx;
  };
  return {
    play(kind, volume) {
      if (volume <= 0) return;
      const c = context();
      if (!c) return;
      if (c.state === 'suspended') void c.resume().catch(() => {});
      const m = MELODIES[kind];
      const start = c.currentTime + 0.01;
      m.notes.forEach((freq, i) => {
        const t = start + i * m.step;
        const osc = c.createOscillator();
        const gain = c.createGain();
        osc.type = m.wave;
        osc.frequency.value = freq;
        const peak = 0.16 * Math.min(1, volume);
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.exponentialRampToValueAtTime(peak, t + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + m.length);
        osc.connect(gain).connect(c.destination);
        osc.start(t);
        osc.stop(t + m.length + 0.02);
      });
    },
    close() {
      void ctx?.close().catch(() => {});
      ctx = null;
    },
  };
}
