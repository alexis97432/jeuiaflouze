/**
 * Centrale audio de l'application (V7) : un seul AudioContext pour la musique, les effets du jeu et
 * les sons d'interface.
 *
 * Avant la V7, chaque partie créait puis fermait son propre contexte, et les sons d'interface en
 * avaient un autre. Sur téléphone, créer un contexte coûte du temps et certains navigateurs en
 * limitent le nombre. Désormais :
 * - le contexte est créé au premier geste du joueur (exigence des navigateurs mobiles), puis repris
 *   à chaque geste tant qu'il n'est pas actif (iOS le met en pause après un appel ou une alarme) ;
 * - il est suspendu quand la page passe en arrière-plan et repris au retour ;
 * - il n'est jamais recréé par partie ; `close()` ne sert qu'à la fin de vie de l'application.
 *
 * Bus : maître ← musique (volume) ← atténuation (ducking) ← sources de musique ;
 *       maître ← effets (volume) ← sons du jeu ; maître ← interface (volume des effets).
 * Les curseurs (0 à 1) sont mis au carré : la variation entendue est répartie sur toute la course.
 * Aucun appel ne lève d'exception : un audio bloqué ou absent laisse simplement le jeu muet.
 */

export type HubState = 'none' | 'suspended' | 'running' | 'interrupted' | 'closed' | 'unavailable';

/** Sortie audio prêtée au moteur du jeu : il y branche ses effets, sans jamais fermer le contexte. */
export type AudioOutput = { readonly context: AudioContext; readonly destination: AudioNode };

export type AudioHub = {
  readonly state: HubState;
  readonly context: AudioContext | null;
  /** À appeler dans un geste du joueur : crée ou reprend le contexte. Sans effet si impossible. */
  unlock(): void;
  /** Contexte actif (le son peut sortir maintenant). */
  running(): boolean;
  /** Entrée des sources de musique (après atténuation et volume), ou null sans contexte. */
  musicInput(): AudioNode | null;
  /** Sortie prêtée au jeu pour ses effets sonores, ou null sans contexte. */
  sfxOutput(): AudioOutput | null;
  /** Entrée des sons d'interface, ou null sans contexte. */
  uiInput(): AudioNode | null;
  /** Musique : activée et volume (0 à 1), appliqués aussitôt (fondu de 80 ms, sans clic). */
  setMusic(on: boolean, volume: number): void;
  /** Effets sonores et interface : activés et volume (0 à 1). */
  setSfx(on: boolean, volume: number): void;
  /**
   * Atténue brièvement la musique sous un effet important (parfait, bonus, chute) : `depth` est le
   * gain gardé (0,6 = environ −4,4 dB), tenu `hold` secondes puis relâché en 0,4 s environ.
   */
  duck(depth?: number, hold?: number): void;
  /** Page cachée : le contexte est suspendu (aucun son en arrière-plan). */
  background(hidden: boolean): void;
  /** Écoute les changements d'état (contexte créé, repris, interrompu). Renvoie le désabonnement. */
  subscribe(listener: (state: HubState) => void): () => void;
  /** Fin de vie (tests, rechargement) : ferme le contexte. */
  close(): void;
};

type AudioCtor = typeof AudioContext;
type AudioWindow = { AudioContext?: AudioCtor; webkitAudioContext?: AudioCtor };

/** Gain maximal de la musique (curseur à 1) : laisse de la marge aux effets, plus forts. */
export const MUSIC_BASE_GAIN = 0.55;
/** Gain maximal des effets du jeu et de l'interface (curseur à 1) ; les sons gardent leurs niveaux. */
export const SFX_BASE_GAIN = 1;

const clamp01 = (v: number) => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0);
/** Curseur → gain : au carré (répartition perceptive), 0 = silence. */
export const sliderGain = (v: number) => clamp01(v) ** 2;

export function createAudioHub(win: (Window & AudioWindow) | null | undefined = globalThis.window as never): AudioHub {
  let ctx: AudioContext | null = null;
  let state: HubState = 'none';
  let master: GainNode | null = null;
  let musicVol: GainNode | null = null;
  let duckGain: GainNode | null = null;
  let sfxVol: GainNode | null = null;
  let uiVol: GainNode | null = null;
  let music = { on: true, volume: 0.6 };
  let sfx = { on: true, volume: 0.8 };
  let hidden = false;
  const listeners = new Set<(s: HubState) => void>();

  const emit = () => {
    for (const l of [...listeners]) {
      try {
        l(state);
      } catch {
        // Un abonné défaillant ne bloque pas les autres.
      }
    }
  };
  const setState = (next: HubState) => {
    if (next === state) return;
    state = next;
    emit();
  };
  const readState = () => {
    if (!ctx) return;
    const s = ctx.state as string;
    setState(s === 'running' ? 'running' : s === 'closed' ? 'closed' : s === 'interrupted' ? 'interrupted' : 'suspended');
  };

  const target = (param: AudioParam, value: number, time = 0.03) => {
    if (!ctx) return;
    try {
      param.cancelScheduledValues(ctx.currentTime);
      param.setTargetAtTime(value, ctx.currentTime, time);
    } catch {
      param.value = value;
    }
  };
  const applyLevels = () => {
    if (musicVol) target(musicVol.gain, music.on ? MUSIC_BASE_GAIN * sliderGain(music.volume) : 0);
    const s = sfx.on ? SFX_BASE_GAIN * sliderGain(sfx.volume) : 0;
    if (sfxVol) target(sfxVol.gain, s);
    if (uiVol) target(uiVol.gain, s);
  };

  const create = (): boolean => {
    if (ctx || state === 'unavailable' || state === 'closed') return ctx !== null;
    const Ctor = win?.AudioContext ?? win?.webkitAudioContext;
    if (!Ctor) {
      setState('unavailable');
      return false;
    }
    try {
      ctx = new Ctor({ latencyHint: 'interactive' });
    } catch {
      try {
        ctx = new Ctor();
      } catch {
        ctx = null;
        setState('unavailable');
        return false;
      }
    }
    try {
      master = ctx.createGain();
      master.gain.value = 1;
      master.connect(ctx.destination);
      musicVol = ctx.createGain();
      musicVol.gain.value = 0;
      duckGain = ctx.createGain();
      duckGain.gain.value = 1;
      duckGain.connect(musicVol).connect(master);
      sfxVol = ctx.createGain();
      sfxVol.gain.value = 0;
      sfxVol.connect(master);
      uiVol = ctx.createGain();
      uiVol.gain.value = 0;
      uiVol.connect(master);
    } catch {
      setState('unavailable');
      ctx = null;
      return false;
    }
    ctx.onstatechange = () => readState();
    applyLevels();
    readState();
    return true;
  };

  const resume = () => {
    if (!ctx || hidden) return;
    const s = ctx.state as string;
    if (s === 'running' || s === 'closed') return;
    try {
      const p = ctx.resume();
      if (p && typeof p.then === 'function') p.then(readState, () => readState());
    } catch {
      // Navigateur sans resume() : le contexte reste dans son état.
    }
  };

  return {
    get state() {
      return state;
    },
    get context() {
      return ctx;
    },
    unlock() {
      if (!create()) return;
      resume();
    },
    running: () => ctx !== null && (ctx.state as string) === 'running',
    musicInput: () => duckGain,
    sfxOutput: () => (ctx && sfxVol ? { context: ctx, destination: sfxVol } : null),
    uiInput: () => uiVol,
    setMusic(on, volume) {
      music = { on, volume: clamp01(volume) };
      applyLevels();
    },
    setSfx(on, volume) {
      sfx = { on, volume: clamp01(volume) };
      applyLevels();
    },
    duck(depth = 0.6, hold = 0.18) {
      if (!ctx || !duckGain) return;
      const g = duckGain.gain;
      const t = ctx.currentTime;
      try {
        g.cancelScheduledValues(t);
        g.setTargetAtTime(Math.min(1, Math.max(0.2, depth)), t, 0.015);
        g.setTargetAtTime(1, t + hold, 0.14);
      } catch {
        // Atténuation facultative.
      }
    },
    background(isHidden) {
      hidden = isHidden;
      if (!ctx) return;
      if (isHidden) {
        if ((ctx.state as string) === 'running') {
          try {
            void ctx.suspend().then(readState, () => readState());
          } catch {
            // Sans suspend : le son est déjà coupé par le navigateur en arrière-plan.
          }
        }
      } else {
        resume();
      }
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    close() {
      const c = ctx;
      ctx = null;
      master = musicVol = duckGain = sfxVol = uiVol = null;
      setState('closed');
      if (c && (c.state as string) !== 'closed') {
        try {
          void c.close().catch(() => {});
        } catch {
          // Déjà fermé.
        }
      }
    },
  };
}

/**
 * Reprise de l'audio au geste : premier toucher, clic ou touche n'importe où dans la page (iOS
 * exige un geste pour démarrer le son). Renvoie la fonction qui retire les écouteurs.
 */
export function unlockOnGesture(win: Window, hub: AudioHub): () => void {
  const events = ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown'] as const;
  const onGesture = () => hub.unlock();
  for (const type of events) win.addEventListener(type, onGesture, { capture: true, passive: true });
  return () => {
    for (const type of events) win.removeEventListener(type, onGesture, { capture: true });
  };
}
