/**
 * Lecteur de musique (V7) : enchaîne les sections déjà rendues, sans coupure, une seule piste à la fois.
 *
 * - Une seule piste audible : changer de piste (univers, musique équipée, écoute en boutique) fait
 *   un fondu croisé court, puis l'ancienne s'arrête et se débranche. Jamais deux pistes empilées.
 * - Les sections sont programmées à l'échantillon près, 3 s à l'avance, sur l'horloge audio : la
 *   musique ne dépend pas de la fluidité de l'affichage.
 * - Rendu à la demande, une section à la fois, jamais pendant une partie si une section est prête
 *   (pas d'à-coup en jeu). Mémoire bornée : les tampons d'une piste qu'on quitte sont libérés.
 * - Écoute (boutique) : remplace la musique pendant 20 s au plus, puis la musique habituelle revient.
 * - Contexte suspendu (arrière-plan) : l'horloge audio s'arrête, la programmation reprend au retour.
 */
import type { AudioHub } from '../../platform/audio-hub';
import { renderSection } from './synth';
import { getTrack, sectionSeconds, type TrackDef } from './tracks';

export const LOOKAHEAD_S = 3;
export const TICK_MS = 400;
export const PREVIEW_MS = 20_000;
/** Sections gardées en mémoire au plus (4 pour la piste en cours, 2 pour une écoute). */
export const MAX_CACHED_SECTIONS = 6;
const FADE_TAU = 0.35;

export type PlayerState = { current: string | null; previewing: string | null; loading: string | null };

export type MusicPlayerOptions = {
  hub: AudioHub;
  render?: (track: TrackDef, index: number) => Promise<AudioBuffer | null>;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (id: unknown) => void;
  random?: () => number;
};

export type MusicPlayer = {
  /** Piste souhaitée hors écoute (null : silence, aucun rendu). */
  want(trackId: string | null): void;
  /** Intensité de 0 (menus) à 1 (partie très haute) : choix des sections suivantes. */
  setIntensity(v: number): void;
  /** Partie en cours : aucun rendu lancé tant qu'une section de la piste est prête. */
  setGameActive(active: boolean): void;
  /** Écoute d'une piste (boutique, collection) : arrête l'écoute précédente. */
  preview(trackId: string): void;
  stopPreview(): void;
  readonly state: PlayerState;
  /** Abonnement aux changements (bouton « Écouter » / « Arrêter »). */
  subscribe(listener: (s: PlayerState) => void): () => void;
  /** Inspection (tests, diagnostic). */
  stats(): { sources: number; cached: number; voices: number; rendering: number };
  dispose(): void;
};

type Scheduled = { src: AudioBufferSourceNode; end: number };
type Voice = { id: string; track: TrackDef; gain: GainNode; next: number; history: number[]; sources: Scheduled[]; fading: boolean };

export function createMusicPlayer(options: MusicPlayerOptions): MusicPlayer {
  const { hub } = options;
  const render = options.render ?? ((t, i) => renderSection(t, i));
  const setTimer = options.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
  const clearTimer = options.clearTimer ?? ((id) => clearTimeout(id as ReturnType<typeof setTimeout>));
  const random = options.random ?? Math.random;

  let desired: string | null = null;
  let previewId: string | null = null;
  let previewUntil = 0;
  let intensity = 0.15;
  let inGame = false;
  let disposed = false;
  let timer: unknown = null;
  let voice: Voice | null = null;
  const fading: Voice[] = [];
  const cache = new Map<string, AudioBuffer>();
  const failed = new Set<string>();
  let renderingKey: string | null = null;
  const listeners = new Set<(s: PlayerState) => void>();
  let lastState = '';

  const effective = (): string | null => previewId ?? desired;
  const keyOf = (id: string, s: number) => `${id}:${s}`;
  const now = () => Date.now();

  const state = (): PlayerState => ({
    current: voice && !voice.fading ? voice.id : null,
    previewing: previewId,
    loading: effective() !== null && (!voice || voice.id !== effective()) ? effective() : null,
  });
  const emit = () => {
    const s = state();
    const sig = `${s.current}|${s.previewing}|${s.loading}`;
    if (sig === lastState) return;
    lastState = sig;
    for (const l of [...listeners]) {
      try {
        l(s);
      } catch {
        // Un abonné défaillant ne bloque pas la musique.
      }
    }
  };

  const ready = (id: string): number[] => [0, 1, 2, 3].filter((s) => cache.has(keyOf(id, s)));

  /** Libère les tampons des pistes qui ne sont ni souhaitées ni en écoute. */
  const prune = () => {
    const keep = new Set([desired, previewId, voice?.id].filter((x): x is string => x !== null));
    for (const k of [...cache.keys()]) if (!keep.has(k.split(':')[0]!)) cache.delete(k);
    while (cache.size > MAX_CACHED_SECTIONS) {
      const first = cache.keys().next().value;
      if (first === undefined) break;
      cache.delete(first);
    }
  };

  /** Prochaine section à rendre : la piste audible d'abord (A, C, B, D), puis la piste souhaitée. */
  const nextRender = (): { track: TrackDef; index: number } | null => {
    const order = [0, 2, 1, 3];
    for (const id of [effective(), desired]) {
      if (!id) continue;
      const track = getTrack(id);
      if (!track) continue;
      const have = ready(id).length;
      if (inGame && have > 0) continue; // pas de rendu en partie si la piste peut déjà jouer
      for (const s of order) {
        const k = keyOf(id, s);
        if (!cache.has(k) && !failed.has(k)) return { track, index: s };
      }
    }
    return null;
  };

  const pump = () => {
    if (disposed || renderingKey || !hub.context) return;
    const job = nextRender();
    if (!job) return;
    const k = keyOf(job.track.id, job.index);
    renderingKey = k;
    let p: Promise<AudioBuffer | null>;
    try {
      p = render(job.track, job.index);
    } catch {
      p = Promise.resolve(null);
    }
    p.then((buf) => {
      renderingKey = null;
      if (disposed) return;
      if (buf) cache.set(k, buf);
      else failed.add(k);
      prune();
      tick();
    }, () => {
      renderingKey = null;
      failed.add(k);
      tick();
    });
  };

  const stopVoice = (v: Voice, fade: boolean) => {
    const ctx = hub.context;
    v.fading = true;
    if (!ctx) return;
    const t = ctx.currentTime;
    try {
      v.gain.gain.cancelScheduledValues(t);
      v.gain.gain.setTargetAtTime(0, t, fade ? FADE_TAU : 0.02);
    } catch {
      // Gain déjà débranché.
    }
    const end = t + (fade ? FADE_TAU * 5 : 0.1);
    for (const s of v.sources) {
      try {
        s.src.stop(Math.max(t, end));
      } catch {
        // Source déjà arrêtée.
      }
    }
    if (!fading.includes(v)) fading.push(v);
  };

  const cleanFaded = () => {
    const ctx = hub.context;
    if (!ctx) return;
    for (let i = fading.length - 1; i >= 0; i--) {
      const v = fading[i]!;
      v.sources = v.sources.filter((s) => s.end > ctx.currentTime);
      if (v.sources.length === 0 || v.gain.gain.value < 0.001) {
        for (const s of v.sources) {
          try {
            s.src.stop();
          } catch {
            // Déjà arrêtée.
          }
        }
        try {
          v.gain.disconnect();
        } catch {
          // Déjà débranché.
        }
        fading.splice(i, 1);
      }
    }
  };

  const chooseSection = (v: Voice): number | null => {
    const available = ready(v.id);
    if (available.length === 0) return null;
    const last = v.history[v.history.length - 1];
    const first = v.history.length === 0;
    if (first) return available.includes(0) ? 0 : available[0]!;
    const target = 0.2 + 0.7 * intensity;
    const candidates = available.filter((s) => s !== last);
    const pool = candidates.length > 0 ? candidates : available;
    const weights = pool.map((s) => Math.max(0.05, 1.15 - Math.abs(v.track.sections[s]!.energy - target) * 1.6));
    let r = random() * weights.reduce((a, b) => a + b, 0);
    for (let i = 0; i < pool.length; i++) {
      r -= weights[i]!;
      if (r <= 0) return pool[i]!;
    }
    return pool[pool.length - 1]!;
  };

  const scheduleAhead = (v: Voice) => {
    const ctx = hub.context;
    const input = hub.musicInput();
    if (!ctx || !input) return;
    while (v.next < ctx.currentTime + LOOKAHEAD_S) {
      const s = chooseSection(v);
      if (s === null) return;
      const buffer = cache.get(keyOf(v.id, s));
      if (!buffer) return;
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.connect(v.gain);
      const start = Math.max(v.next, ctx.currentTime + 0.05);
      try {
        src.start(start);
      } catch {
        return;
      }
      const end = start + buffer.duration;
      const item = { src, end };
      v.sources.push(item);
      src.onended = () => {
        v.sources = v.sources.filter((x) => x !== item);
        try {
          src.disconnect();
        } catch {
          // Déjà débranchée.
        }
      };
      v.history.push(s);
      if (v.history.length > 8) v.history.shift();
      v.next = start + sectionSeconds(v.track);
    }
  };

  const ensureVoice = () => {
    const ctx = hub.context;
    const input = hub.musicInput();
    const id = effective();
    if (voice && voice.id !== id) {
      stopVoice(voice, true);
      voice = null;
    }
    if (!id || !ctx || !input || voice) return;
    const track = getTrack(id);
    if (!track || ready(id).length === 0) return;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    gain.connect(input);
    gain.gain.setTargetAtTime(1, ctx.currentTime + 0.05, FADE_TAU * 0.8);
    voice = { id, track, gain, next: ctx.currentTime + 0.08, history: [], sources: [], fading: false };
  };

  function tick(): void {
    if (disposed) return;
    if (previewId && now() >= previewUntil) {
      previewId = null;
    }
    ensureVoice();
    if (voice && hub.context && hub.running()) scheduleAhead(voice);
    cleanFaded();
    pump();
    emit();
    schedule();
  }

  function schedule(): void {
    if (disposed) return;
    if (timer !== null) clearTimer(timer);
    const busy = voice !== null || fading.length > 0 || renderingKey !== null || effective() !== null;
    timer = busy ? setTimer(() => {
      timer = null;
      tick();
    }, TICK_MS) : null;
  }

  const unsubscribeHub = hub.subscribe(() => tick());

  return {
    want(trackId) {
      const id = trackId && getTrack(trackId) ? trackId : null;
      if (id === desired) return;
      desired = id;
      prune();
      tick();
    },
    setIntensity(v) {
      intensity = Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0;
    },
    setGameActive(active) {
      inGame = active;
      if (!active) tick();
    },
    preview(trackId) {
      if (!getTrack(trackId)) return;
      previewId = trackId;
      previewUntil = now() + PREVIEW_MS;
      prune();
      tick();
    },
    stopPreview() {
      if (previewId === null) return;
      previewId = null;
      prune();
      tick();
    },
    get state() {
      return state();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    stats: () => ({
      sources: (voice?.sources.length ?? 0) + fading.reduce((n, v) => n + v.sources.length, 0),
      cached: cache.size,
      voices: (voice ? 1 : 0) + fading.length,
      rendering: renderingKey ? 1 : 0,
    }),
    dispose() {
      disposed = true;
      unsubscribeHub();
      if (timer !== null) clearTimer(timer);
      timer = null;
      for (const v of [voice, ...fading]) if (v) stopVoice(v, false);
      for (const v of [voice, ...fading]) {
        if (!v) continue;
        for (const s of v.sources) {
          try {
            s.src.stop();
            s.src.disconnect();
          } catch {
            // Déjà arrêtée.
          }
        }
        try {
          v.gain.disconnect();
        } catch {
          // Déjà débranché.
        }
      }
      voice = null;
      fading.length = 0;
      cache.clear();
      listeners.clear();
    },
  };
}
