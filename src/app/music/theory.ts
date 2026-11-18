/**
 * Théorie musicale minimale pour la bande-son procédurale (V7) : gammes, accords diatoniques,
 * conduite des voix, hasard déterministe. Aucune dépendance au navigateur : tout est testable.
 */

export type ScaleName =
  | 'major' | 'minor' | 'dorian' | 'mixolydian' | 'lydian' | 'phrygianDominant' | 'harmonicMinor';

export const SCALES: Record<ScaleName, readonly number[]> = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  phrygianDominant: [0, 1, 4, 5, 7, 8, 10],
  harmonicMinor: [0, 2, 3, 5, 7, 8, 11],
};

/** Fréquence (Hz) d'une note MIDI (69 = la 440). */
export const midiToHz = (m: number): number => 440 * 2 ** ((m - 69) / 12);

/** Hasard déterministe (mulberry32) : même piste, même section → mêmes notes, partout. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Empreinte stable d'une chaîne (FNV-1a), pour dériver les graines. */
export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Accord noté par son degré dans la gamme : `1` à `7`, avec une extension facultative après `:`
 * (`7`, `9`, `sus2`, `sus4`, `add9`, `6`) et une altération facultative devant (`b` : degré abaissé
 * d'un demi-ton, accord majeur emprunté, par exemple `b7` en majeur).
 */
export type ChordSymbol = string;

export type Chord = {
  /** Fondamentale, en demi-tons au-dessus de la tonique (0 à 11). */
  root: number;
  /** Notes de l'accord, en demi-tons au-dessus de la tonique (fondamentale comprise, croissantes). */
  tones: number[];
};

/** Notes d'un accord diatonique (tierces superposées dans la gamme), avec son extension. */
export function chordOf(scale: readonly number[], symbol: ChordSymbol): Chord {
  const [head, ext = ''] = symbol.split(':') as [string, string?];
  const flat = head.startsWith('b');
  const degree = Math.max(1, Math.min(7, Number.parseInt(flat ? head.slice(1) : head, 10) || 1)) - 1;
  const at = (k: number) => {
    const i = degree + k;
    return scale[i % scale.length]! + 12 * Math.floor(i / scale.length);
  };
  let tones: number[];
  if (flat) {
    // Accord majeur emprunté sur le degré abaissé (bVI, bVII, bIII…).
    const root = scale[degree]! - 1;
    tones = [root, root + 4, root + 7];
  } else {
    tones = [at(0), at(2), at(4)];
  }
  const root = tones[0]!;
  switch (ext) {
    case '7': tones.push(flat ? root + 10 : at(6)); break;
    case '9': tones.push(flat ? root + 10 : at(6), flat ? root + 14 : at(8)); break;
    case 'add9': tones.push(root + 14); break;
    case '6': tones.push(root + 9); break;
    case 'sus2': tones[1] = root + 2; break;
    case 'sus4': tones[1] = root + 5; break;
    default: break;
  }
  return { root: ((root % 12) + 12) % 12, tones: [...tones].sort((a, b) => a - b) };
}

/**
 * Voicing proche du précédent (conduite des voix) : chaque note de l'accord est placée dans
 * l'octave la plus proche du centre `center`, puis on choisit le renversement qui bouge le moins
 * par rapport à `previous`. Renvoie des notes MIDI absolues (tonique = `key`).
 */
export function voiceChord(chord: Chord, key: number, center: number, previous: readonly number[] | null, size = 4): number[] {
  const pcs = [...new Set(chord.tones.map((t) => ((t % 12) + 12) % 12))];
  const candidates: number[][] = [];
  // Renversements : on fait tourner les classes de hauteur, empilées vers le haut.
  for (let r = 0; r < pcs.length; r++) {
    const order = [...pcs.slice(r), ...pcs.slice(0, r)];
    const out: number[] = [];
    let last = -Infinity;
    for (let i = 0; i < Math.min(size, order.length + 1); i++) {
      const pc = order[i % order.length]!;
      let m = key + pc;
      while (m <= last) m += 12;
      out.push(m);
      last = m;
    }
    // Centrage autour de `center`.
    const mid = (out[0]! + out[out.length - 1]!) / 2;
    const shift = Math.round((center - mid) / 12) * 12;
    candidates.push(out.map((m) => m + shift));
  }
  if (!previous || previous.length === 0) {
    return candidates.reduce((best, c) => (Math.abs((c[0]! + c[c.length - 1]!) / 2 - center) < Math.abs((best[0]! + best[best.length - 1]!) / 2 - center) ? c : best));
  }
  const cost = (c: number[]) => c.reduce((sum, m, i) => sum + Math.abs(m - (previous[Math.min(i, previous.length - 1)] ?? m)), 0);
  return candidates.reduce((best, c) => (cost(c) < cost(best) ? c : best));
}

/** Note de la gamme la plus proche de `m` (MIDI), tonique `key`. */
export function snapToScale(m: number, key: number, scale: readonly number[]): number {
  let best = m;
  let dist = Infinity;
  for (let d = -6; d <= 6; d++) {
    const pc = (((m + d - key) % 12) + 12) % 12;
    if (scale.includes(pc) && Math.abs(d) < dist) {
      dist = Math.abs(d);
      best = m + d;
    }
  }
  return best;
}

/** Note de l'accord la plus proche de `m` (MIDI), tonique `key`. */
export function snapToChord(m: number, key: number, chord: Chord): number {
  let best = m;
  let dist = Infinity;
  for (let d = -7; d <= 7; d++) {
    const pc = (((m + d - key) % 12) + 12) % 12;
    if (chord.tones.some((t) => ((t % 12) + 12) % 12 === pc) && Math.abs(d) < dist) {
      dist = Math.abs(d);
      best = m + d;
    }
  }
  return best;
}
