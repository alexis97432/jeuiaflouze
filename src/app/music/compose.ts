/**
 * Compositeur (V7) : transforme une partition (`TrackDef`) en notes datées, section par section.
 *
 * Déterministe : même piste, même section → mêmes notes. Les sections A et C partagent le même
 * motif mélodique (le thème reconnaissable de la piste), B et D en ont un autre. Les règles sont
 * simples et musicales : conduite des voix pour les accords, notes de l'accord sur les temps forts,
 * mouvement conjoint entre eux, cadence sur la tonique en fin de phrase.
 */
import { chordOf, hashString, rng, SCALES, snapToChord, snapToScale, voiceChord, type Chord } from './theory';
import type { DrumKit, Instrument, Part, TrackDef } from './tracks';

export type DrumHit = 'kick' | 'snare' | 'hat' | 'ohat' | 'clap' | 'shaker' | 'rim' | 'tom' | 'tamb' | 'chipKick' | 'chipSnare' | 'chipHat';

export type NoteEvent = { t: number; d: number; m: number; v: number; inst: Instrument; part: Exclude<Part, 'drums'> };
export type DrumEvent = { t: number; v: number; hit: DrumHit };
export type SectionScore = { duration: number; notes: NoteEvent[]; drums: DrumEvent[] };

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Partition d'une section (0 = A, 1 = B, 2 = C, 3 = D). */
export function composeSection(track: TrackDef, index: number): SectionScore {
  const section = track.sections[clamp(Math.floor(index), 0, 3)]!;
  const beat = 60 / track.bpm;
  const bar = beat * track.meter;
  const duration = bar * track.bars;
  const scale = SCALES[track.scale];
  const key = track.key;
  const random = rng(hashString(`${track.id}:${index}`));
  const chords = section.chords.map((c) => chordOf(scale, c));
  const barsPer = track.bars / chords.length;
  const chordAt = (t: number): Chord => chords[clamp(Math.floor(t / (bar * barsPer)), 0, chords.length - 1)]!;
  const energy = section.energy;
  const vel = (base: number) => clamp(base * (0.72 + 0.4 * energy) * (0.92 + random() * 0.16), 0.05, 1);
  const notes: NoteEvent[] = [];
  const drums: DrumEvent[] = [];
  const plays = (p: Part) => section.parts.includes(p) && (p === 'drums' ? track.drums !== 'none' : track.voices[p as Exclude<Part, 'drums'>] !== undefined);
  /** Croche paire retardée (swing). `pos` en temps. */
  const swingAt = (pos: number) => {
    const eighth = Math.round(pos * 2) / 2;
    const isOff = Math.abs(pos - eighth) < 1e-6 && Math.round(pos * 2) % 2 === 1;
    return isOff ? pos + track.swing * (1 / 3) : pos;
  };
  const at = (barIndex: number, pos: number) => barIndex * bar + swingAt(pos) * beat;
  const add = (part: Exclude<Part, 'drums'>, t: number, d: number, m: number, v: number) => {
    const inst = track.voices[part];
    if (!inst || t >= duration) return;
    // Registre borné : au-dessus du do 7 (96), on redescend d'une octave (pas de sons perçants,
    // pas de repliement à 22 kHz).
    let note = m;
    while (note > 96) note -= 12;
    notes.push({ t, d: Math.max(0.03, Math.min(d, duration + 2 - t)), m: note, v, inst, part });
  };

  // — Nappe : accords tenus, conduite des voix —
  if (plays('pad')) {
    let prev: number[] | null = null;
    chords.forEach((c, i) => {
      const voicing = voiceChord(c, key, key + 14, prev, 4);
      prev = voicing;
      const t = i * barsPer * bar;
      for (const m of voicing) add('pad', t, barsPer * bar + 0.12, m, vel(0.55));
    });
  }

  // — Accompagnement rythmique —
  if (plays('comp') && track.comp !== 'none') {
    let prev: number[] | null = null;
    for (let b = 0; b < track.bars; b++) {
      const c = chordAt(b * bar + 0.001);
      const voicing = voiceChord(c, key, key + 12, prev, 4);
      prev = voicing;
      const hits: [number, number, number][] = // [temps, durée en temps, nuance]
        track.comp === 'block' ? [[0, 1, 0.7], [2, 1, 0.55]]
          : track.comp === 'offbeat' ? [[0.5, 0.35, 0.55], [1.5, 0.35, 0.5], [2.5, 0.35, 0.55], [3.5, 0.35, 0.5]]
            : track.comp === 'lofi' ? [[0, 1.4, 0.65], [1.5, 1, 0.5], ...(random() < 0.4 ? [[3.5, 0.4, 0.35] as [number, number, number]] : [])]
              : track.comp === 'stab' ? [[0, 0.22, 0.75], [0.75, 0.2, 0.5], [1.5, 0.22, 0.6], [2.5, 0.2, 0.55], [3, 0.22, 0.7], [3.75, 0.2, 0.45]]
                : [[1, 0.55, 0.55], [2, 0.55, 0.5]]; // valse : temps 2 et 3
      for (const [pos, len, v] of hits) {
        if (pos >= track.meter) continue;
        for (const m of voicing) add('comp', at(b, pos), len * beat, m, vel(v));
      }
    }
  }

  // — Basse —
  if (plays('bass')) {
    const low = key - 12;
    const rootOf = (c: Chord) => {
      let m = low + c.root;
      if (m >= key) m -= 12;
      return m;
    };
    /** Quinte au-dessus de la fondamentale (les accords utilisés n'ont pas de quinte diminuée). */
    const fifthOf = (c: Chord) => rootOf(c) + 7;
    for (let b = 0; b < track.bars; b++) {
      const c = chordAt(b * bar + 0.001);
      const r = rootOf(c);
      const chordStart = Math.floor(b / barsPer) * barsPer === b;
      switch (track.bass) {
        case 'whole':
          if (chordStart) add('bass', b * bar, barsPer * bar, r, vel(0.8));
          break;
        case 'drone':
          if (chordStart) {
            add('bass', b * bar, barsPer * bar + 0.1, r, vel(0.75));
            if (barsPer >= 2 && energy > 0.5) add('bass', (b + 1) * bar, bar * 0.9, r + 12, vel(0.35));
          }
          break;
        case 'root5':
          add('bass', at(b, 0), beat * 1.5, r, vel(0.85));
          if (track.meter === 4) add('bass', at(b, 2), beat * (energy > 0.6 ? 0.9 : 1.6), fifthOf(c), vel(0.7));
          if (energy > 0.7 && track.meter === 4) add('bass', at(b, 3.5), beat * 0.45, r + 12, vel(0.5));
          break;
        case 'pulse8':
          for (let k = 0; k < track.meter * 2; k++) {
            const oct = k === track.meter * 2 - 1 && random() < 0.5 ? 12 : 0;
            add('bass', at(b, k / 2), beat * 0.42, r + oct, vel(k % 2 === 0 ? 0.85 : 0.6));
          }
          break;
        case 'walk': {
          const next = rootOf(chordAt((b + 1) * bar + 0.001));
          const third = r + ((c.tones[1]! - c.tones[0]! + 12) % 12);
          const line = [r, third, fifthOf(c), next + (next > r ? -1 : 1)];
          line.slice(0, track.meter).forEach((m, k) => add('bass', at(b, k), beat * 0.9, m, vel(k === 0 ? 0.85 : 0.65)));
          break;
        }
        case 'funk': {
          const pattern: [number, number, number][] = [[0, 0, 0.9], [0.75, 12, 0.55], [1.5, 0, 0.7], [2, 7, 0.75], [2.75, 0, 0.5], [3.25, 12, 0.6], [3.5, 10, 0.6]];
          for (const [pos, off, v] of pattern) add('bass', at(b, pos), beat * 0.22, r + off, vel(v));
          break;
        }
        case 'oompah':
          if (track.meter === 3) add('bass', at(b, 0), beat * 0.8, b % 2 === 0 ? r : fifthOf(c) - 12, vel(0.85));
          else {
            add('bass', at(b, 0), beat * 0.6, r, vel(0.85));
            add('bass', at(b, 2), beat * 0.6, fifthOf(c) - 12, vel(0.75));
          }
          break;
      }
    }
  }

  // — Arpèges —
  if (plays('arp') && track.arp !== 'none') {
    for (let b = 0; b < track.bars; b++) {
      const c = chordAt(b * bar + 0.001);
      const base = voiceChord(c, key, key + 24, null, 3);
      const tones = [...base, ...base.map((m) => m + 12)];
      const steps = track.arp === 'updown16' || track.arp === 'pulse16' ? track.meter * 4 : track.meter * 2;
      const stepLen = track.meter / steps;
      for (let k = 0; k < steps; k++) {
        let m: number | null;
        let len = stepLen * 0.9;
        let v = 0.55;
        switch (track.arp) {
          case 'up8': m = tones[k % tones.length]!; break;
          case 'updown16': {
            const cycle = [...tones, ...tones.slice(1, -1).reverse()];
            m = cycle[k % cycle.length]!;
            break;
          }
          case 'broken8': m = tones[[0, 2, 1, 2, 0, 3, 1, 2][k % 8]!]!; break;
          case 'pulse16': m = tones[[0, 0, 3, 0, 1, 0, 3, 2][k % 8]!]!; len = stepLen * 0.6; v = k % 4 === 0 ? 0.6 : 0.42; break;
          case 'sparkle':
            m = random() < 0.42 + energy * 0.25 ? tones[Math.floor(random() * tones.length)]! : null;
            len = stepLen * 3;
            v = 0.4;
            break;
          case 'harp':
            m = k < steps / 2 || energy > 0.6 ? tones[k % tones.length]! : null;
            len = stepLen * 4;
            v = 0.5;
            break;
          default: m = null;
        }
        if (m !== null) add('arp', at(b, k * stepLen), len * beat, m, vel(v));
      }
    }
  }

  // — Contre-chant : notes longues et aiguës aux changements d'accord —
  if (plays('counter')) {
    chords.forEach((c, i) => {
      const t = i * barsPer * bar;
      const pick = c.tones[random() < 0.5 ? 1 : 2] ?? c.tones[0]!;
      const m = key + 24 + (((pick % 12) + 12) % 12);
      add('counter', t + beat * 0.02, barsPer * bar * 0.8, m, vel(0.42));
      if (barsPer >= 2 && random() < 0.5) add('counter', t + bar * (barsPer / 2) + beat, bar * 0.9, m + (random() < 0.5 ? 2 : -1), vel(0.32));
    });
  }

  // — V8 : mélodie écrite (phrases composées), si la piste en a une —
  if (plays('melody') && track.written) {
    const tokens = parseWritten(track.written[clamp(Math.floor(index), 0, 3)]!);
    let pos = 0;
    // Nuances de phrase : on monte vers le milieu de chaque groupe de 4 mesures, on se pose à la fin.
    const phrase = 4 * track.meter;
    for (const tok of tokens) {
      if (tok.degree !== null && pos < track.bars * track.meter) {
        const deg = tok.degree - 1;
        const semis = scale[deg % 7]! + 12 * tok.octave + tok.accidental;
        const m = key + 12 + semis;
        const inPhrase = (pos % phrase) / phrase;
        const shape = 0.82 + 0.22 * Math.sin(Math.PI * inPhrase);
        const t = Math.floor(pos / track.meter) * bar + (pos % track.meter) * beat;
        add('melody', t, tok.dur * beat * 0.96, m, vel(0.7 * shape));
      }
      pos += tok.dur;
    }
  }

  // — Mélodie : motif de 2 mesures, varié, cadence sur la tonique —
  if (plays('melody') && !track.written) {
    const themeSeed = hashString(`${track.id}:${index === 0 || index === 2 ? 'theme' : `motif${index}`}`);
    const { low, high, density } = track.melody;
    const stepsPerBar = track.meter * 2;
    const motif = (seed: number): { pos: number; len: number }[] => {
      const r = rng(seed);
      const onsets: number[] = [];
      for (let s = 0; s < stepsPerBar * 2; s++) {
        const strong = s % 2 === 0;
        const p = s === 0 ? 1 : strong ? density + 0.25 : density * 0.6;
        if (r() < p) onsets.push(s);
      }
      return onsets.map((s, i) => ({ pos: s / 2, len: Math.min(((onsets[i + 1] ?? stepsPerBar * 2) - s) / 2, 2) }));
    };
    const rhythms = [motif(themeSeed), motif(themeSeed + 1)];
    const r = rng(themeSeed ^ 0x9e37);
    let pitch = clamp(snapToChord(Math.round((low + high) / 2), key, chordAt(0.001)), low, high);
    const segments = track.bars / 2;
    for (let seg = 0; seg < segments; seg++) {
      // Phrase : A A' B A'' (puis recommence pour les sections de 16 mesures).
      const role = seg % 4;
      const rhythm = rhythms[role === 2 ? 1 : 0]!;
      const last = seg === segments - 1;
      if (role === 0) pitch = clamp(snapToChord(Math.round((low + high) / 2) + (seg === 0 ? 0 : 2), key, chordAt(seg * 2 * bar + 0.001)), low, high);
      rhythm.forEach((n, i) => {
        const t = seg * 2 * bar + swingAt(n.pos) * beat;
        if (t >= duration) return;
        const c = chordAt(t + 0.001);
        const strong = Math.abs(n.pos - Math.round(n.pos)) < 1e-6 && Math.round(n.pos) % 2 === 0;
        const roll = r();
        let next = pitch + (roll < 0.35 ? 1 : roll < 0.7 ? -1 : roll < 0.82 ? 2 : roll < 0.9 ? -2 : roll < 0.95 ? 4 : 0);
        if (next > high) next = pitch - 2;
        if (next < low) next = pitch + 2;
        next = strong ? snapToChord(next, key, c) : snapToScale(next, key, scale);
        if (last && i === rhythm.length - 1) {
          // Cadence : dernière note sur la tonique (ou la tierce), tenue.
          next = snapToChord(next, key, chordOf(scale, '1'));
          add('melody', t, Math.max(n.len, 1.5) * beat, clamp(next, low, high), vel(0.7));
          return;
        }
        pitch = clamp(next, low, high);
        add('melody', t, n.len * beat * 0.92, pitch, vel(strong ? 0.72 : 0.6));
      });
    }
  }

  // — Batterie —
  if (plays('drums')) drumPattern(track.drums, track, section.energy, bar, beat, duration, random, swingAt, drums);

  notes.sort((a, b) => a.t - b.t);
  drums.sort((a, b) => a.t - b.t);
  return { duration, notes, drums };
}

/** V8 : lit une mélodie écrite (voir `TrackDef.written`). Jetons invalides ignorés. */
export function parseWritten(text: string): { degree: number | null; octave: number; accidental: number; dur: number }[] {
  const out: { degree: number | null; octave: number; accidental: number; dur: number }[] = [];
  for (const raw of text.split(/\s+/)) {
    if (raw === '' || raw === '|') continue;
    const m = /^(r|([#b]?)([1-7])('*|,*)):(\d+(?:\.\d+)?)$/.exec(raw);
    if (!m) continue;
    const dur = Number(m[5]);
    if (!(dur > 0)) continue;
    if (m[1] === 'r') {
      out.push({ degree: null, octave: 0, accidental: 0, dur });
      continue;
    }
    const marks = m[4] ?? '';
    const octave = marks.startsWith("'") ? marks.length : -marks.length;
    out.push({ degree: Number(m[3]), octave, accidental: m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0, dur });
  }
  return out;
}

function drumPattern(
  kit: DrumKit, track: TrackDef, energy: number, bar: number, beat: number, duration: number,
  random: () => number, swingAt: (pos: number) => number, out: DrumEvent[],
): void {
  const steps = track.meter * 4;
  const hit = (b: number, step: number, h: DrumHit, v: number) => {
    const t = b * bar + swingAt(step / 4) * beat;
    if (t < duration) out.push({ t, v: clamp(v * (0.75 + 0.35 * energy) * (0.9 + random() * 0.2), 0.05, 1), hit: h });
  };
  for (let b = 0; b < track.bars; b++) {
    const fill = b === track.bars - 1 && energy >= 0.5;
    for (let s = 0; s < steps; s++) {
      const eighth = s % 2 === 0;
      const q = s % 4 === 0;
      switch (kit) {
        case 'soft':
          if (s === 0 || (s === 8 && energy > 0.5)) hit(b, s, 'kick', 0.7);
          if (s === 4 || s === 12) hit(b, s, 'rim', 0.45);
          if (eighth) hit(b, s, 'shaker', q ? 0.35 : 0.22);
          break;
        case 'pop':
          if (s === 0 || s === 8 || (s === 10 && energy > 0.6)) hit(b, s, 'kick', 0.85);
          if (s === 4 || s === 12) hit(b, s, 'snare', 0.7);
          if (eighth || energy > 0.85) hit(b, s, 'hat', q ? 0.42 : eighth ? 0.3 : 0.18);
          break;
        case 'lofi':
          if (s === 0 || s === 7 || s === 10) hit(b, s, 'kick', s === 0 ? 0.85 : 0.6);
          if (s === 4 || s === 12) hit(b, s, 'snare', 0.55);
          if (eighth) hit(b, s, 'hat', q ? 0.32 : 0.2 + random() * 0.1);
          if (s === 15 && random() < 0.3) hit(b, s, 'rim', 0.25);
          break;
        case 'four':
          if (q) hit(b, s, 'kick', 0.9);
          if (s === 4 || s === 12) hit(b, s, 'clap', 0.6);
          if (s % 4 === 2) hit(b, s, 'ohat', 0.32);
          if (energy > 0.7 && s % 2 === 1) hit(b, s, 'hat', 0.16);
          break;
        case 'march':
          if (s === 0 || s === 8) hit(b, s, 'kick', 0.8);
          if (s === 4 || s === 12) hit(b, s, 'snare', 0.75);
          if (energy > 0.6 && (s === 14 || s === 15)) hit(b, s, 'snare', 0.4);
          if (energy > 0.75 && s % 2 === 1 && s !== 15) hit(b, s, 'snare', 0.16);
          break;
        case 'chip':
          if (s === 0 || s === 8) hit(b, s, 'chipKick', 0.8);
          if (s === 4 || s === 12) hit(b, s, 'chipSnare', 0.6);
          if (eighth || energy > 0.8) hit(b, s, 'chipHat', eighth ? 0.3 : 0.18);
          break;
        case 'halftime':
          if (s === 0 || (s === 10 && energy > 0.6)) hit(b, s, 'kick', 0.8);
          if (s === 8) hit(b, s, 'snare', 0.6);
          if (eighth) hit(b, s, 'hat', q ? 0.26 : 0.16);
          break;
        case 'waltz':
          if (s === 0) hit(b, s, 'kick', 0.75);
          if (s === 4 || s === 8) hit(b, s, energy > 0.6 ? 'tamb' : 'hat', 0.35);
          break;
        case 'hand':
          if (s === 0 || s === 7) hit(b, s, 'tom', s === 0 ? 0.75 : 0.5);
          if (s === 3 || s === 4 || s === 10 || s === 12) hit(b, s, 'rim', s === 4 || s === 12 ? 0.5 : 0.32);
          if (s === 8) hit(b, s, 'tamb', 0.4);
          if (eighth) hit(b, s, 'shaker', 0.18);
          break;
        default:
          break;
      }
      // Petit roulement en fin de section (temps énergiques).
      if (fill && s >= steps - 4 && kit !== 'waltz' && kit !== 'none' && kit !== 'soft') {
        hit(b, s, kit === 'chip' ? 'chipSnare' : kit === 'hand' ? 'tom' : 'snare', 0.3 + (s - (steps - 4)) * 0.1);
      }
    }
  }
}
