/**
 * Synthétiseur hors ligne (V7) : rend une section composée en un tampon audio mono.
 *
 * Le rendu passe par un OfflineAudioContext (calcul hors du fil d'affichage pour l'essentiel),
 * une fois par section : pendant la partie, le lecteur ne fait que programmer des tampons déjà
 * prêts, sans aucune synthèse en temps réel. Mono à 22 050 Hz : environ 1,9 Mo par section de
 * 20 s. Instruments simples (oscillateurs, enveloppes, filtres, modulation de fréquence), une
 * réverbération à réponse impulsionnelle calculée, un écho filtré et un compresseur doux.
 */
import { composeSection, type DrumEvent, type DrumHit, type NoteEvent } from './compose';
import { midiToHz } from './theory';
import type { Instrument, Part, TrackDef } from './tracks';

export const MUSIC_SAMPLE_RATE = 22050;
/** Traîne après la dernière mesure (réverbération, extinctions), superposée à la section suivante. */
export const TAIL_SECONDS = 3;
/** Niveaux visés après rendu : efficace −20 dBFS (modulé par l'énergie), crête −3 dBFS. */
export const TARGET_RMS = 0.1;
export const TARGET_PEAK = 0.7;

type OfflineCtor = new (channels: number, length: number, sampleRate: number) => OfflineAudioContext;
type MusicWindow = { OfflineAudioContext?: OfflineCtor; webkitOfflineAudioContext?: OfflineCtor };

export function offlineContextCtor(win: unknown = globalThis): OfflineCtor | null {
  const w = win as MusicWindow | null | undefined;
  return w?.OfflineAudioContext ?? w?.webkitOfflineAudioContext ?? null;
}

type Bus = { input: GainNode };

/** Niveau de base de chaque instrument (avant nuance). */
const LEVEL: Record<Instrument, number> = {
  piano: 0.1,
  pad: 0.085, warmPad: 0.13, strings: 0.06, organ: 0.11, flute: 0.22, brass: 0.11, ep: 0.24, clav: 0.11,
  pluck: 0.17, guitar: 0.17, marimba: 0.28, kalimba: 0.24, harp: 0.22, bell: 0.14, glass: 0.14,
  chip: 0.055, chipLead: 0.07, sawLead: 0.075, bass: 0.34, subBass: 0.44, synthBass: 0.2, chipBass: 0.3, tuba: 0.27,
};
/** Filtre du bus par instrument (coupe-haut, Hz). */
const BUS_LOWPASS: Partial<Record<Instrument, number>> = {
  pad: 1500, warmPad: 1900, strings: 2700, organ: 4200, bass: 850, tuba: 750, subBass: 400, chipBass: 3000,
};
const REVERB_SEND: Record<Part, number> = { pad: 0.6, comp: 0.35, bass: 0.05, arp: 0.5, melody: 0.42, counter: 0.75, drums: 0.15 };
const ECHO_SEND: Partial<Record<Part, number>> = { melody: 0.5, arp: 0.35, counter: 0.4 };

function pulseWave(ctx: BaseAudioContext, duty: number): PeriodicWave {
  const n = 32;
  const real = new Float32Array(n);
  const imag = new Float32Array(n);
  for (let k = 1; k < n; k++) real[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * duty);
  return ctx.createPeriodicWave(real, imag);
}

function organWave(ctx: BaseAudioContext): PeriodicWave {
  const real = new Float32Array([0, 0, 0, 0, 0, 0, 0, 0]);
  const imag = new Float32Array([0, 1, 0.55, 0.3, 0.12, 0.08, 0, 0.05]);
  return ctx.createPeriodicWave(real, imag);
}

function impulse(ctx: BaseAudioContext, seconds: number, decay: number): AudioBuffer {
  const sr = ctx.sampleRate;
  const len = Math.max(1, Math.floor(seconds * sr));
  const buf = ctx.createBuffer(1, len, sr);
  const data = buf.getChannelData(0);
  const pre = Math.floor(0.012 * sr);
  let seed = 0x2545f491;
  let lp = 0;
  for (let i = pre; i < len; i++) {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    const white = ((seed >>> 0) / 4294967296) * 2 - 1;
    const t = (i - pre) / sr;
    // Queue de plus en plus sombre : lissage croissant avec le temps.
    const k = Math.min(0.85, 0.25 + t * 0.5);
    lp = lp * k + white * (1 - k);
    data[i] = lp * Math.exp(-t / decay);
  }
  return buf;
}

function noiseBuffer(ctx: BaseAudioContext): AudioBuffer {
  const len = ctx.sampleRate;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  let seed = 0x1234567;
  for (let i = 0; i < len; i++) {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    data[i] = ((seed >>> 0) / 4294967296) * 2 - 1;
  }
  return buf;
}

type Kit = {
  ctx: OfflineAudioContext;
  noise: AudioBuffer;
  pulse25: PeriodicWave;
  pulse50: PeriodicWave;
  pulse30: PeriodicWave;
  organ: PeriodicWave;
};

function osc(k: Kit, wave: OscillatorType | PeriodicWave, freq: number, t0: number, t1: number, out: AudioNode, detune = 0): OscillatorNode {
  const o = k.ctx.createOscillator();
  if (typeof wave === 'string') o.type = wave as OscillatorType;
  else o.setPeriodicWave(wave);
  o.frequency.value = freq;
  if (detune) o.detune.value = detune;
  o.connect(out);
  o.start(t0);
  o.stop(t1);
  return o;
}

function gainNode(k: Kit, out: AudioNode, value = 0): GainNode {
  const g = k.ctx.createGain();
  g.gain.value = value;
  g.connect(out);
  return g;
}

/** Enveloppe tenue : attaque linéaire, maintien, extinction exponentielle après la fin. */
function sustained(g: AudioParam, t: number, end: number, peak: number, attack: number, release: number): number {
  g.setValueAtTime(0, t);
  g.linearRampToValueAtTime(peak, t + attack);
  g.setValueAtTime(peak, Math.max(t + attack, end));
  g.setTargetAtTime(0, Math.max(t + attack, end), release / 3);
  return Math.max(t + attack, end) + release * 2;
}

/** Enveloppe percussive : attaque brève puis décroissance exponentielle (constante `tau`). */
function struck(g: AudioParam, t: number, peak: number, attack: number, tau: number): number {
  g.setValueAtTime(0, t);
  g.linearRampToValueAtTime(peak, t + attack);
  g.setTargetAtTime(0, t + attack, tau);
  return t + attack + tau * 6;
}

function vibrato(k: Kit, target: OscillatorNode, t: number, end: number, freq: number, depth: number): void {
  const lfo = k.ctx.createOscillator();
  lfo.frequency.value = 5.2;
  const amount = k.ctx.createGain();
  amount.gain.setValueAtTime(0, t);
  amount.gain.linearRampToValueAtTime(freq * depth, t + 0.25);
  lfo.connect(amount).connect(target.frequency);
  lfo.start(t);
  lfo.stop(end);
}

function filterEnvelope(k: Kit, out: AudioNode, t: number, from: number, to: number, tau: number, q = 0.7): BiquadFilterNode {
  const f = k.ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.Q.value = q;
  f.frequency.setValueAtTime(from, t);
  f.frequency.setTargetAtTime(to, t, tau);
  f.connect(out);
  return f;
}

function playNote(k: Kit, n: NoteEvent, out: AudioNode): void {
  const f = midiToHz(n.m);
  const t = n.t;
  const end = n.t + n.d;
  const peak = LEVEL[n.inst] * n.v;
  const g = gainNode(k, out);
  switch (n.inst) {
    case 'piano': {
      // V8 : piano synthétisé. Partiels légèrement inharmoniques (corde raide), chaque partiel
      // s'éteint plus vite que le précédent, les aigus plus vite que les graves ; deux cordes très
      // légèrement désaccordées sur la fondamentale (battement) ; frappe du marteau (bruit filtré,
      // très court) ; étouffoir à la fin de la note.
      const B = 0.00035;
      const tau = Math.min(2.6, Math.max(0.35, 1.5 * Math.pow(261.6 / f, 0.45)));
      const damp = Math.max(end, t + 0.12);
      const stop = damp + 0.6;
      const partials: readonly [number, number][] = [[1, 1], [2, 0.42], [3, 0.2], [4, 0.1], [5, 0.05]];
      for (const [p, amp] of partials) {
        const fp = f * p * Math.sqrt(1 + B * p * p);
        if (fp > 9000) break;
        const pg = gainNode(k, out);
        pg.gain.setValueAtTime(0, t);
        pg.gain.linearRampToValueAtTime(peak * amp, t + 0.004);
        pg.gain.setTargetAtTime(peak * amp * 0.35, t + 0.004, tau / p);
        pg.gain.setTargetAtTime(0, damp, 0.09);
        osc(k, 'sine', fp, t, stop, pg, p === 1 ? -1.5 : 0);
        if (p === 1) osc(k, 'sine', fp, t, stop, pg, 1.5);
      }
      const hammer = k.ctx.createBufferSource();
      hammer.buffer = k.noise;
      const bp = k.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = Math.min(5000, f * 4);
      bp.Q.value = 0.8;
      const hg = gainNode(k, out);
      struck(hg.gain, t, peak * 0.18, 0.001, 0.012);
      hammer.connect(bp).connect(hg);
      hammer.start(t, (n.m * 0.017) % 0.8);
      hammer.stop(t + 0.08);
      g.disconnect();
      break;
    }
    case 'pad': {
      const stop = sustained(g.gain, t, end, peak, 0.35, 0.8);
      osc(k, 'sawtooth', f, t, stop, g, -7);
      osc(k, 'sawtooth', f, t, stop, g, 7);
      osc(k, 'triangle', f / 2, t, stop, g);
      break;
    }
    case 'warmPad': {
      const stop = sustained(g.gain, t, end, peak, 0.25, 0.6);
      osc(k, 'triangle', f, t, stop, g, -5);
      osc(k, 'triangle', f, t, stop, g, 5);
      break;
    }
    case 'strings': {
      const stop = sustained(g.gain, t, end, peak, 0.3, 0.5);
      for (const d of [-9, 0, 9]) osc(k, 'sawtooth', f, t, stop, g, d);
      break;
    }
    case 'organ': {
      const stop = sustained(g.gain, t, end, peak, 0.015, 0.09);
      osc(k, k.organ, f, t, stop, g);
      break;
    }
    case 'flute': {
      const stop = sustained(g.gain, t, end, peak, 0.06, 0.14);
      const o = osc(k, 'sine', f, t, stop, g);
      const body = gainNode(k, g, 0.25);
      osc(k, 'triangle', f, t, stop, body);
      vibrato(k, o, t + 0.12, stop, f, 0.004);
      // Souffle à l'attaque.
      const breath = k.ctx.createBufferSource();
      breath.buffer = k.noise;
      const bp = k.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = Math.min(4000, f * 3);
      bp.Q.value = 1.2;
      const bg = gainNode(k, out);
      struck(bg.gain, t, peak * 0.35, 0.01, 0.05);
      breath.connect(bp).connect(bg);
      breath.start(t, (n.m * 0.013) % 0.8);
      breath.stop(t + 0.3);
      break;
    }
    case 'brass': {
      const fl = filterEnvelope(k, g, t, 300, 1700, 0.05, 1.1);
      const stop = sustained(g.gain, t, end, peak, 0.05, 0.12);
      osc(k, 'sawtooth', f, t, stop, fl, -6);
      osc(k, 'sawtooth', f, t, stop, fl, 6);
      break;
    }
    case 'ep': {
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(peak, t + 0.004);
      g.gain.setTargetAtTime(peak * 0.45, t + 0.004, 0.25);
      g.gain.setTargetAtTime(0, end, 0.08);
      const stop = end + 0.5;
      const carrier = osc(k, 'sine', f, t, stop, g);
      const mod = k.ctx.createOscillator();
      mod.frequency.value = f;
      const index = k.ctx.createGain();
      index.gain.setValueAtTime(f * 1.6, t);
      index.gain.setTargetAtTime(f * 0.18, t, 0.2);
      mod.connect(index).connect(carrier.frequency);
      mod.start(t);
      mod.stop(stop);
      break;
    }
    case 'clav': {
      const fl = filterEnvelope(k, g, t, 3200, 900, 0.07, 2);
      const stop = struck(g.gain, t, peak, 0.002, 0.11);
      osc(k, k.pulse30, f, t, Math.min(stop, end + 0.2), fl);
      break;
    }
    case 'pluck': {
      const fl = filterEnvelope(k, g, t, 2600, 380, 0.11, 1.4);
      const stop = struck(g.gain, t, peak, 0.003, 0.22);
      osc(k, 'sawtooth', f, t, stop, fl);
      break;
    }
    case 'guitar': {
      const fl = filterEnvelope(k, g, t, 2200, 520, 0.18, 1);
      const stop = struck(g.gain, t, peak, 0.003, 0.34);
      osc(k, 'triangle', f, t, stop, fl);
      const bite = gainNode(k, fl, 0.3);
      osc(k, 'sawtooth', f, t, stop, bite);
      break;
    }
    case 'marimba': {
      const stop = struck(g.gain, t, peak, 0.003, 0.3);
      osc(k, 'sine', f, t, stop, g);
      const hi = gainNode(k, out);
      osc(k, 'sine', f * 4, t, struck(hi.gain, t, peak * 0.22, 0.002, 0.05), hi);
      break;
    }
    case 'kalimba': {
      const stop = struck(g.gain, t, peak, 0.003, 0.55);
      osc(k, 'sine', f, t, stop, g);
      const hi = gainNode(k, out);
      osc(k, 'sine', f * 5.4, t, struck(hi.gain, t, peak * 0.14, 0.002, 0.04), hi);
      const mid = gainNode(k, out);
      osc(k, 'triangle', f * 2, t, struck(mid.gain, t, peak * 0.1, 0.003, 0.18), mid);
      break;
    }
    case 'harp': {
      const stop = struck(g.gain, t, peak, 0.003, 0.85);
      osc(k, 'triangle', f, t, stop, g);
      const hi = gainNode(k, out);
      osc(k, 'sine', f * 2, t, struck(hi.gain, t, peak * 0.3, 0.003, 0.35), hi);
      break;
    }
    case 'bell': {
      const stop = struck(g.gain, t, peak, 0.002, 0.95);
      const carrier = osc(k, 'sine', f, t, stop, g);
      const mod = k.ctx.createOscillator();
      mod.frequency.value = f * 3.5;
      const index = k.ctx.createGain();
      index.gain.setValueAtTime(f * 1.8, t);
      index.gain.setTargetAtTime(0, t, 0.45);
      mod.connect(index).connect(carrier.frequency);
      mod.start(t);
      mod.stop(stop);
      break;
    }
    case 'glass': {
      const stop = struck(g.gain, t, peak, 0.04, 1.1);
      osc(k, 'sine', f, t, stop, g);
      const hi = gainNode(k, out);
      osc(k, 'sine', f * 2.01, t, struck(hi.gain, t, peak * 0.2, 0.02, 0.45), hi);
      break;
    }
    case 'chip': {
      const stop = sustained(g.gain, t, end, peak, 0.002, 0.03);
      osc(k, k.pulse50, f, t, stop, g);
      break;
    }
    case 'chipLead': {
      const stop = sustained(g.gain, t, end, peak, 0.002, 0.04);
      const o = osc(k, k.pulse25, f, t, stop, g);
      if (n.d > 0.25) vibrato(k, o, t + 0.12, stop, f, 0.006);
      break;
    }
    case 'sawLead': {
      const fl = filterEnvelope(k, g, t, 3200, 2200, 0.2, 0.9);
      const stop = sustained(g.gain, t, end, peak, 0.012, 0.12);
      const o = osc(k, 'sawtooth', f, t, stop, fl, -5);
      osc(k, 'sawtooth', f, t, stop, fl, 5);
      if (n.d > 0.3) vibrato(k, o, t + 0.15, stop, f, 0.005);
      break;
    }
    case 'bass': {
      const stop = sustained(g.gain, t, end, peak, 0.008, 0.08);
      osc(k, 'triangle', f, t, stop, g);
      osc(k, 'sine', f, t, stop, g);
      break;
    }
    case 'subBass': {
      const stop = sustained(g.gain, t, end, peak, 0.03, 0.18);
      osc(k, 'sine', f, t, stop, g);
      break;
    }
    case 'synthBass': {
      const fl = filterEnvelope(k, g, t, 1700, 300, 0.08, 2.5);
      const stop = sustained(g.gain, t, end, peak, 0.004, 0.06);
      osc(k, 'sawtooth', f, t, stop, fl);
      break;
    }
    case 'chipBass': {
      const stop = sustained(g.gain, t, end, peak, 0.002, 0.03);
      osc(k, 'triangle', f, t, stop, g);
      break;
    }
    case 'tuba': {
      const stop = sustained(g.gain, t, end, peak, 0.03, 0.08);
      osc(k, 'sawtooth', f, t, stop, g);
      osc(k, 'sine', f, t, stop, g);
      break;
    }
  }
}

const DRUM_LEVEL: Record<DrumHit, number> = {
  kick: 0.9, snare: 0.42, hat: 0.2, ohat: 0.16, clap: 0.42, shaker: 0.2, rim: 0.24, tom: 0.5, tamb: 0.2,
  chipKick: 0.32, chipSnare: 0.22, chipHat: 0.11,
};

function noiseHit(k: Kit, t: number, out: AudioNode, type: BiquadFilterType, freq: number, q: number, peak: number, attack: number, tau: number): void {
  const src = k.ctx.createBufferSource();
  src.buffer = k.noise;
  const f = k.ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  const g = gainNode(k, out);
  const stop = struck(g.gain, t, peak, attack, tau);
  src.connect(f).connect(g);
  src.start(t, (t * 7.31) % 0.7);
  src.stop(stop);
}

function playDrum(k: Kit, d: DrumEvent, out: AudioNode): void {
  const t = d.t;
  const peak = DRUM_LEVEL[d.hit] * d.v;
  switch (d.hit) {
    case 'kick': {
      const g = gainNode(k, out);
      const o = k.ctx.createOscillator();
      o.frequency.setValueAtTime(150, t);
      o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
      o.connect(g);
      o.start(t);
      o.stop(struck(g.gain, t, peak, 0.002, 0.12));
      noiseHit(k, t, out, 'bandpass', 3000, 0.8, peak * 0.12, 0.001, 0.004);
      break;
    }
    case 'snare': {
      noiseHit(k, t, out, 'bandpass', 1900, 0.7, peak, 0.001, 0.06);
      const g = gainNode(k, out);
      osc(k, 'triangle', 185, t, struck(g.gain, t, peak * 0.5, 0.001, 0.05), g);
      break;
    }
    case 'hat': noiseHit(k, t, out, 'highpass', 7000, 0.7, peak, 0.001, 0.015); break;
    case 'ohat': noiseHit(k, t, out, 'highpass', 6500, 0.7, peak, 0.002, 0.09); break;
    case 'clap':
      for (const dt of [0, 0.011, 0.022]) noiseHit(k, t + dt, out, 'bandpass', 1500, 1, peak * (dt === 0.022 ? 1 : 0.6), 0.001, dt === 0.022 ? 0.05 : 0.006);
      break;
    case 'shaker': noiseHit(k, t, out, 'bandpass', 5500, 1, peak, 0.012, 0.03); break;
    case 'tamb':
      noiseHit(k, t, out, 'highpass', 5000, 0.7, peak, 0.002, 0.05);
      noiseHit(k, t, out, 'bandpass', 8000, 4, peak * 0.5, 0.002, 0.08);
      break;
    case 'rim': {
      const g = gainNode(k, out);
      const stop = struck(g.gain, t, peak, 0.001, 0.012);
      osc(k, k.pulse50, 1700, t, stop, g);
      const g2 = gainNode(k, out);
      osc(k, 'triangle', 820, t, struck(g2.gain, t, peak * 0.6, 0.001, 0.02), g2);
      break;
    }
    case 'tom': {
      const g = gainNode(k, out);
      const o = k.ctx.createOscillator();
      o.frequency.setValueAtTime(170, t);
      o.frequency.exponentialRampToValueAtTime(110, t + 0.2);
      o.connect(g);
      o.start(t);
      o.stop(struck(g.gain, t, peak, 0.002, 0.15));
      break;
    }
    case 'chipKick': {
      const g = gainNode(k, out);
      const o = k.ctx.createOscillator();
      o.setPeriodicWave(k.pulse50);
      o.frequency.setValueAtTime(120, t);
      o.frequency.exponentialRampToValueAtTime(40, t + 0.08);
      o.connect(g);
      o.start(t);
      o.stop(struck(g.gain, t, peak, 0.001, 0.06));
      break;
    }
    case 'chipSnare': noiseHit(k, t, out, 'lowpass', 6000, 0.5, peak, 0.001, 0.06); break;
    case 'chipHat': noiseHit(k, t, out, 'highpass', 8000, 0.5, peak, 0.001, 0.01); break;
  }
}

async function startRendering(ctx: OfflineAudioContext): Promise<AudioBuffer> {
  return new Promise<AudioBuffer>((resolve, reject) => {
    let done = false;
    ctx.oncomplete = (e: OfflineAudioCompletionEvent) => {
      if (!done) {
        done = true;
        resolve(e.renderedBuffer);
      }
    };
    try {
      const p = ctx.startRendering() as Promise<AudioBuffer> | undefined;
      if (p && typeof p.then === 'function') {
        p.then((b) => {
          if (!done) {
            done = true;
            resolve(b);
          }
        }, reject);
      }
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Niveaux d'un tampon rendu : crête et efficace sur la durée utile (sans la traîne).
 * Exportée pour les tests et les mesures.
 */
export function levels(data: Float32Array, upTo = data.length): { peak: number; rms: number } {
  let peak = 0;
  let sum = 0;
  const n = Math.max(1, Math.min(upTo, data.length));
  for (let i = 0; i < n; i++) {
    const v = data[i]!;
    const a = Math.abs(v);
    if (a > peak) peak = a;
    sum += v * v;
  }
  return { peak, rms: Math.sqrt(sum / n) };
}

/**
 * Rend la section `index` de `track`. Renvoie null sans OfflineAudioContext (tests, très vieux
 * navigateurs) ou en cas d'échec du rendu : le jeu reste alors simplement sans musique.
 */
export async function renderSection(track: TrackDef, index: number, Offline: OfflineCtor | null = offlineContextCtor(), sampleRate = MUSIC_SAMPLE_RATE): Promise<AudioBuffer | null> {
  if (!Offline) return null;
  const score = composeSection(track, index);
  const length = Math.ceil((score.duration + TAIL_SECONDS) * sampleRate);
  let ctx: OfflineAudioContext;
  try {
    ctx = new Offline(1, length, sampleRate);
  } catch {
    return null;
  }
  const k: Kit = {
    ctx, noise: noiseBuffer(ctx), pulse25: pulseWave(ctx, 0.25), pulse50: pulseWave(ctx, 0.5), pulse30: pulseWave(ctx, 0.3), organ: organWave(ctx),
  };
  const master = ctx.createGain();
  master.gain.value = 1;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14;
  comp.knee.value = 8;
  comp.ratio.value = 3;
  comp.attack.value = 0.006;
  comp.release.value = 0.2;
  master.connect(comp).connect(ctx.destination);

  const reverb = ctx.createConvolver();
  reverb.buffer = impulse(ctx, 2.2, 0.55);
  const reverbReturn = gainNode(k, master, 0.9);
  reverb.connect(reverbReturn);
  const beat = 60 / track.bpm;
  const delay = ctx.createDelay(2);
  delay.delayTime.value = Math.min(1.9, beat * 0.75);
  const feedback = ctx.createGain();
  feedback.gain.value = 0.32;
  const echoTone = ctx.createBiquadFilter();
  echoTone.type = 'lowpass';
  echoTone.frequency.value = 2400;
  delay.connect(echoTone).connect(feedback).connect(delay);
  const echoReturn = gainNode(k, master, track.echo * 0.8);
  echoTone.connect(echoReturn);

  const buses = new Map<string, Bus>();
  const bus = (part: Part, inst: Instrument | 'drums'): Bus => {
    const key = `${part}:${inst}`;
    const found = buses.get(key);
    if (found) return found;
    const input = ctx.createGain();
    let tail: AudioNode = input;
    const lp = inst === 'drums' ? undefined : BUS_LOWPASS[inst];
    if (lp) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = lp;
      f.Q.value = 0.3;
      tail.connect(f);
      tail = f;
    }
    tail.connect(master);
    const send = gainNode(k, reverb, track.reverb * REVERB_SEND[part]);
    tail.connect(send);
    const echo = ECHO_SEND[part];
    if (echo && track.echo > 0) tail.connect(gainNode(k, delay, echo));
    const b = { input };
    buses.set(key, b);
    return b;
  };

  for (const n of score.notes) playNote(k, n, bus(n.part, n.inst).input);
  const drumBus = score.drums.length > 0 ? bus('drums', 'drums') : null;
  if (drumBus) for (const d of score.drums) playDrum(k, d, drumBus.input);

  let buffer: AudioBuffer;
  try {
    buffer = await startRendering(ctx);
  } catch {
    return null;
  }
  const data = buffer.getChannelData(0);
  const useful = Math.min(data.length, Math.floor(score.duration * sampleRate));
  const { peak, rms } = levels(data, useful);
  if (!(peak > 0) || !Number.isFinite(peak)) return buffer;
  // Sections calmes un peu plus douces que les sections d'élan (relief de l'arrangement).
  const energy = track.sections[Math.min(3, Math.max(0, index))]!.energy;
  const targetRms = TARGET_RMS * (0.7 + 0.4 * energy);
  const gain = Math.min(targetRms / Math.max(rms, 1e-6), TARGET_PEAK / peak);
  const fade = Math.floor(0.05 * sampleRate);
  for (let i = 0; i < data.length; i++) {
    let v = data[i]! * gain;
    if (!Number.isFinite(v)) v = 0;
    const left = data.length - i;
    if (left < fade) v *= left / fade;
    data[i] = v;
  }
  return buffer;
}
