/**
 * Bande-son originale de Stack or Crash (V7) : compositions procédurales écrites pour le jeu.
 *
 * Aucun fichier audio externe : chaque piste est une partition décrite ici (tempo, tonalité,
 * accords, instruments, motifs), composée par `compose.ts` et jouée par le synthétiseur de
 * `synth.ts`. Droits : créations originales du projet, sous la licence du dépôt, sans attribution
 * tierce (voir docs/MUSIQUE.md).
 *
 * Quatre sections de 8 mesures (16 pour la valse) par piste : A (thème), B (contraste),
 * C (élan, le plus énergique) et D (respiration). Le lecteur les enchaîne sans coupure selon
 * l'intensité de la partie, en évitant de répéter immédiatement la même.
 */
import type { Rarity } from '../../game';
import type { ChordSymbol, ScaleName } from './theory';

export type Instrument =
  | 'piano'
  | 'pad' | 'warmPad' | 'strings' | 'ep' | 'pluck' | 'marimba' | 'kalimba' | 'bell' | 'glass'
  | 'chip' | 'chipLead' | 'sawLead' | 'flute' | 'organ' | 'brass' | 'harp' | 'guitar' | 'clav'
  | 'bass' | 'subBass' | 'synthBass' | 'chipBass' | 'tuba';
export type DrumKit = 'none' | 'soft' | 'pop' | 'lofi' | 'four' | 'march' | 'chip' | 'halftime' | 'waltz' | 'hand';
export type BassStyle = 'whole' | 'root5' | 'pulse8' | 'walk' | 'funk' | 'oompah' | 'drone';
export type ArpStyle = 'none' | 'up8' | 'updown16' | 'broken8' | 'pulse16' | 'sparkle' | 'harp';
export type CompStyle = 'none' | 'block' | 'offbeat' | 'lofi' | 'stab' | 'waltz';
export type Part = 'pad' | 'comp' | 'bass' | 'arp' | 'melody' | 'counter' | 'drums';

export type SectionDef = {
  /** 4 ou 8 accords répartis également sur la section. */
  chords: readonly ChordSymbol[];
  /** Parties jouées dans cette section. */
  parts: readonly Part[];
  /** Énergie de 0 à 1 : nuances, densité, choix de la section par le lecteur. */
  energy: number;
};

export type TrackDef = {
  id: string;
  name: string;
  rarity: Rarity;
  /** Ambiance en quelques mots (boutique, crédits). */
  mood: string;
  bpm: number;
  meter: 3 | 4;
  /** Mesures par section (8, ou 16 pour une valse rapide). */
  bars: 8 | 16;
  /** Retard des croches paires, 0 (droit) à 0,5 (ternaire marqué). */
  swing: number;
  /** Tonique (MIDI, entre 48 et 59). */
  key: number;
  scale: ScaleName;
  voices: Partial<Record<Exclude<Part, 'drums'>, Instrument>>;
  drums: DrumKit;
  bass: BassStyle;
  arp: ArpStyle;
  comp: CompStyle;
  melody: { density: number; low: number; high: number };
  /** Part de réverbération et d'écho (0 à 1). */
  reverb: number;
  echo: number;
  sections: readonly [SectionDef, SectionDef, SectionDef, SectionDef];
  /**
   * V8 : mélodie écrite (phrases composées à la main), une par section, à la place de la mélodie
   * générée. Jetons `degré:durée` séparés par des espaces (barres `|` ignorées) : degré 1 à 7 de la
   * gamme, `'` = octave au-dessus, `,` = octave au-dessous, `#`/`b` = altération, `r` = silence ;
   * durée en temps. Exemple : `5:1.5 6:0.5 5:1 3:1 | 2:1 3:0.5 2:0.5 1:2`.
   */
  written?: readonly [string, string, string, string];
};

const ALL: readonly Part[] = ['pad', 'comp', 'bass', 'arp', 'melody', 'counter', 'drums'];

export const TRACKS: readonly TrackDef[] = [
  // — Musiques des univers (possédées avec l'univers) —
  {
    id: 'sucre-glace', name: 'Sucre glace', rarity: 'commun', mood: 'pop sucrée et sautillante',
    bpm: 112, meter: 4, bars: 8, swing: 0, key: 48, scale: 'major',
    voices: { pad: 'warmPad', bass: 'bass', arp: 'marimba', melody: 'pluck' },
    drums: 'pop', bass: 'root5', arp: 'broken8', comp: 'none',
    melody: { density: 0.5, low: 67, high: 81 }, reverb: 0.22, echo: 0,
    sections: [
      { chords: ['1', '5', '6', '4'], parts: ['pad', 'bass', 'arp', 'drums'], energy: 0.4 },
      { chords: ['4', '1', '2:7', '5'], parts: ['pad', 'bass', 'arp', 'melody', 'drums'], energy: 0.6 },
      { chords: ['6', '4', '1', '5'], parts: ['pad', 'bass', 'arp', 'melody', 'drums'], energy: 0.85 },
      { chords: ['4', '5', '3', '6'], parts: ['pad', 'arp', 'melody'], energy: 0.25 },
    ],
  },
  {
    id: 'rosee', name: 'Rosée du matin', rarity: 'rare', mood: 'pastorale, flûte et harpe',
    bpm: 96, meter: 4, bars: 8, swing: 0, key: 55, scale: 'major',
    voices: { pad: 'strings', bass: 'bass', arp: 'harp', melody: 'flute', counter: 'kalimba' },
    drums: 'soft', bass: 'root5', arp: 'harp', comp: 'none',
    melody: { density: 0.45, low: 69, high: 86 }, reverb: 0.32, echo: 0.1,
    sections: [
      { chords: ['1', '3', '4', '1'], parts: ['pad', 'bass', 'arp', 'counter', 'drums'], energy: 0.35 },
      { chords: ['6', '4', '1', '5'], parts: ['pad', 'bass', 'arp', 'melody', 'drums'], energy: 0.6 },
      { chords: ['4', '5', '3', '6'], parts: ALL, energy: 0.8 },
      { chords: ['2:7', '5:sus4', '1:add9', '1'], parts: ['pad', 'arp', 'counter'], energy: 0.2 },
    ],
  },
  {
    id: 'apesanteur', name: 'Apesanteur', rarity: 'epique', mood: 'nappes spatiales et cloches lointaines',
    bpm: 84, meter: 4, bars: 8, swing: 0, key: 50, scale: 'dorian',
    voices: { pad: 'pad', bass: 'subBass', arp: 'bell', melody: 'glass', counter: 'glass' },
    drums: 'halftime', bass: 'drone', arp: 'sparkle', comp: 'none',
    melody: { density: 0.35, low: 69, high: 84 }, reverb: 0.48, echo: 0.28,
    sections: [
      { chords: ['1:9', '4', '7', '1'], parts: ['pad', 'bass', 'arp'], energy: 0.3 },
      { chords: ['3', '7', '4', '1:9'], parts: ['pad', 'bass', 'arp', 'melody', 'drums'], energy: 0.6 },
      { chords: ['3', '7', '1:9', '5'], parts: ALL, energy: 0.85 },
      { chords: ['1:sus2', '4:sus2', '1:sus2', '7'], parts: ['pad', 'counter', 'arp'], energy: 0.15 },
    ],
  },
  {
    id: 'lagon', name: 'Lagon', rarity: 'epique', mood: 'piano électrique et bulles, tempo nonchalant',
    bpm: 88, meter: 4, bars: 8, swing: 0.15, key: 57, scale: 'minor',
    voices: { pad: 'warmPad', comp: 'ep', bass: 'bass', arp: 'pluck', melody: 'kalimba', counter: 'glass' },
    drums: 'lofi', bass: 'root5', arp: 'up8', comp: 'lofi',
    melody: { density: 0.4, low: 64, high: 79 }, reverb: 0.3, echo: 0.22,
    sections: [
      { chords: ['1:9', '4:9', '6:7', '5:7'], parts: ['pad', 'comp', 'bass', 'drums'], energy: 0.4 },
      { chords: ['1:9', '4:9', '6:7', '5:7'], parts: ['comp', 'bass', 'arp', 'melody', 'drums'], energy: 0.6 },
      { chords: ['6:7', '7', '3:7', '1:9'], parts: ALL, energy: 0.8 },
      { chords: ['4:9', '5:7', '1:9', '1:9'], parts: ['pad', 'comp', 'counter'], energy: 0.25 },
    ],
  },
  {
    id: 'nocturne-neon', name: 'Nocturne néon', rarity: 'legendaire', mood: 'synthwave pulsée sous la pluie',
    bpm: 108, meter: 4, bars: 8, swing: 0, key: 52, scale: 'minor',
    voices: { pad: 'pad', bass: 'synthBass', arp: 'pluck', melody: 'sawLead', counter: 'bell' },
    drums: 'four', bass: 'pulse8', arp: 'pulse16', comp: 'none',
    melody: { density: 0.45, low: 64, high: 83 }, reverb: 0.3, echo: 0.3,
    sections: [
      { chords: ['1', '6', '3', '7'], parts: ['pad', 'bass', 'arp', 'drums'], energy: 0.6 },
      { chords: ['6', '7', '1', '1'], parts: ['pad', 'bass', 'arp', 'melody', 'drums'], energy: 0.75 },
      { chords: ['4', '5', '6', '7'], parts: ALL, energy: 0.95 },
      { chords: ['1:9', '6:7', '4:9', '5:sus4'], parts: ['pad', 'arp', 'counter'], energy: 0.3 },
    ],
  },
  {
    id: 'mirage', name: 'Mirage', rarity: 'commun', mood: 'luth et percussions sous le soleil',
    bpm: 100, meter: 4, bars: 8, swing: 0, key: 50, scale: 'phrygianDominant',
    voices: { pad: 'warmPad', bass: 'bass', arp: 'guitar', melody: 'flute' },
    drums: 'hand', bass: 'drone', arp: 'broken8', comp: 'none',
    melody: { density: 0.5, low: 62, high: 79 }, reverb: 0.26, echo: 0.15,
    sections: [
      { chords: ['1', '2', '1', '7'], parts: ['pad', 'bass', 'arp', 'drums'], energy: 0.45 },
      { chords: ['4', '2', '1', '1'], parts: ['bass', 'arp', 'melody', 'drums'], energy: 0.65 },
      { chords: ['1', '7', '2', '1'], parts: ['pad', 'bass', 'arp', 'melody', 'drums'], energy: 0.85 },
      { chords: ['4', '1', '2', '1'], parts: ['pad', 'melody'], energy: 0.2 },
    ],
  },
  {
    id: 'cimes', name: 'Cimes', rarity: 'rare', mood: 'accordéon, guitare et air des sommets',
    bpm: 92, meter: 4, bars: 8, swing: 0.08, key: 53, scale: 'major',
    voices: { pad: 'organ', bass: 'bass', arp: 'guitar', melody: 'flute', counter: 'bell' },
    drums: 'soft', bass: 'root5', arp: 'broken8', comp: 'none',
    melody: { density: 0.55, low: 65, high: 81 }, reverb: 0.3, echo: 0.05,
    sections: [
      { chords: ['1', '4', '1', '5'], parts: ['pad', 'bass', 'arp', 'drums'], energy: 0.4 },
      { chords: ['6', '4', '1', '5'], parts: ['pad', 'bass', 'arp', 'melody', 'drums'], energy: 0.6 },
      { chords: ['4', '5', '3', '6'], parts: ALL, energy: 0.8 },
      { chords: ['2:7', '5', '1', '1'], parts: ['pad', 'arp', 'counter'], energy: 0.2 },
    ],
  },
  {
    id: 'manege', name: 'Manège', rarity: 'epique', mood: 'valse de fête foraine, orgue et glockenspiel',
    bpm: 152, meter: 3, bars: 16, swing: 0, key: 58, scale: 'major',
    voices: { pad: 'organ', comp: 'organ', bass: 'tuba', melody: 'organ', counter: 'bell' },
    drums: 'waltz', bass: 'oompah', arp: 'none', comp: 'waltz',
    melody: { density: 0.6, low: 70, high: 87 }, reverb: 0.2, echo: 0,
    sections: [
      { chords: ['1', '1', '5:7', '5:7', '5:7', '5:7', '1', '1'], parts: ['comp', 'bass', 'melody', 'drums'], energy: 0.6 },
      { chords: ['4', '4', '1', '1', '2:7', '2:7', '5:7', '5:7'], parts: ['comp', 'bass', 'melody', 'counter', 'drums'], energy: 0.7 },
      { chords: ['1', '6', '2', '5:7', '1', '6', '5:7', '1'], parts: ['comp', 'bass', 'melody', 'counter', 'drums'], energy: 0.9 },
      { chords: ['4', '4', '1', '1', '5:7', '5:7', '1', '1'], parts: ['pad', 'counter', 'bass'], energy: 0.3 },
    ],
  },
  {
    id: 'nuees', name: 'Hymne des nuées', rarity: 'legendaire', mood: 'cordes, harpe et cor au-dessus des nuages',
    bpm: 76, meter: 4, bars: 8, swing: 0, key: 51, scale: 'major',
    voices: { pad: 'strings', bass: 'bass', arp: 'harp', melody: 'brass', counter: 'glass' },
    drums: 'soft', bass: 'whole', arp: 'harp', comp: 'none',
    melody: { density: 0.4, low: 63, high: 79 }, reverb: 0.5, echo: 0.15,
    sections: [
      { chords: ['1', '6', '4', '5'], parts: ['pad', 'bass', 'arp', 'counter'], energy: 0.3 },
      { chords: ['6', '3', '4', '1'], parts: ['pad', 'bass', 'arp', 'melody'], energy: 0.55 },
      { chords: ['4', '5', '3', '6'], parts: ALL, energy: 0.85 },
      { chords: ['b7', '4', '1', '1'], parts: ['pad', 'counter', 'melody'], energy: 0.2 },
    ],
  },
  // — V8 : collection sombre et Noël, au piano (mélodies écrites, voir `written`) —
  {
    id: 'sous-bois', name: 'Sous-bois', rarity: 'rare', mood: 'piano mystérieux, brume et feux follets',
    bpm: 66, meter: 4, bars: 8, swing: 0, key: 50, scale: 'dorian',
    voices: { pad: 'warmPad', bass: 'piano', arp: 'piano', melody: 'piano', counter: 'glass' },
    drums: 'none', bass: 'whole', arp: 'broken8', comp: 'none',
    melody: { density: 0.4, low: 60, high: 79 }, reverb: 0.55, echo: 0.12,
    sections: [
      { chords: ['1', '1', '7', '1', '4', '4', '5', '1'], parts: ['bass', 'arp', 'melody'], energy: 0.45 },
      { chords: ['3', '3', '7', '7', '4', '4', '5', '5'], parts: ['pad', 'bass', 'arp', 'melody'], energy: 0.55 },
      { chords: ['1', '1', '7', '1', '4', '4', '5', '1'], parts: ['pad', 'bass', 'arp', 'melody', 'counter'], energy: 0.75 },
      { chords: ['1', '1', '7', '7', '4', '4', '5', '1'], parts: ['pad', 'bass', 'melody'], energy: 0.25 },
    ],
    written: [
      "5:1.5 6:0.5 5:1 3:1 | 2:1 3:0.5 2:0.5 1:2 | 7,:1 1:1 2:1 3:1 | 2:3 r:1 | 6:1.5 5:0.5 4:1 3:1 | 4:1 6:1 1':2 | 7:1 6:0.5 5:0.5 4:1 3:1 | 2:1 1:3",
      "3:2 5:1 3:1 | 2:1 1:1 2:2 | 3:2 7,:1 1:1 | 7,:4 | 4:1.5 3:0.5 4:1 6:1 | 5:3 r:1 | 5:1 6:1 7:1 1':1 | 2':4",
      "5:1.5 6:0.5 5:1 3:1 | 2:1 3:0.5 2:0.5 1:2 | 7,:1 1:1 2:1 3:1 | 2:2 5:1 6:1 | 6:1.5 5:0.5 4:1 3:1 | 4:1 6:1 1':2 | 7:1 6:0.5 5:0.5 4:1 3:1 | 2:1 1:3",
      "1':4 | 7:2 5:2 | 3:4 | 2:4 | 4:2 6:2 | 5:4 | 3:2 2:2 | 1:4",
    ],
  },
  {
    id: 'vitraux', name: 'Vitraux brisés', rarity: 'epique', mood: 'piano mélancolique et orgue lointain',
    bpm: 58, meter: 4, bars: 8, swing: 0, key: 57, scale: 'harmonicMinor',
    voices: { pad: 'organ', bass: 'piano', arp: 'piano', melody: 'piano', counter: 'strings' },
    drums: 'none', bass: 'whole', arp: 'harp', comp: 'none',
    melody: { density: 0.4, low: 64, high: 86 }, reverb: 0.65, echo: 0.1,
    sections: [
      { chords: ['1', '6', '4', '5', '1', '4', '5', '1'], parts: ['bass', 'arp', 'melody'], energy: 0.4 },
      { chords: ['3', '3', 'b7', 'b7', '6', '6', '5', '5'], parts: ['pad', 'bass', 'arp', 'melody'], energy: 0.55 },
      { chords: ['1', '6', '4', '5', '1', '4', '5', '1'], parts: ['pad', 'bass', 'arp', 'melody', 'counter'], energy: 0.8 },
      { chords: ['1', '1', '4', '4', '1', '1', '5', '5'], parts: ['pad', 'bass', 'melody'], energy: 0.2 },
    ],
    written: [
      "5:1.5 4:0.5 3:1 2:1 | 1:1 3:1 6:2 | 4:1.5 3:0.5 2:1 1:1 | 7,:3 r:1 | 3:1.5 4:0.5 5:1 1':1 | 6:2 4:1 2:1 | 7,:1 2:1 4:1 3:0.5 2:0.5 | 1:4",
      "3:1 5:1 3':2 | 2':1 1':1 b7:2 | b7:1.5 6:0.5 5:2 | 2:4 | 1':1.5 b7:0.5 6:1 1':1 | 3':2 1':2 | 7:1 1':1 2':1 7:1 | 5:4",
      "5:1.5 4:0.5 3:1 2:1 | 1:1 3:1 6:2 | 4:1.5 3:0.5 2:1 1:1 | 7,:2 2:1 4:1 | 3:1.5 4:0.5 5:1 1':1 | 6:2 4:1 2:1 | 7,:1 2:1 4:1 3:0.5 2:0.5 | 1:4",
      "5:4 | 3:4 | 4:4 | 6,:4 | 1:4 | 3:4 | 7,:4 | 2:4",
    ],
  },
  {
    id: 'cendres', name: 'Cendres', rarity: 'legendaire', mood: 'piano dramatique, basses en octaves et cordes',
    bpm: 72, meter: 4, bars: 8, swing: 0, key: 48, scale: 'harmonicMinor',
    voices: { pad: 'strings', bass: 'piano', arp: 'piano', melody: 'piano', counter: 'strings' },
    drums: 'none', bass: 'pulse8', arp: 'broken8', comp: 'none',
    melody: { density: 0.4, low: 55, high: 84 }, reverb: 0.5, echo: 0.08,
    sections: [
      { chords: ['1', '1', '6', '6', '4', '4', '5', '5'], parts: ['bass', 'melody'], energy: 0.55 },
      { chords: ['6', '3', '4', '1', '6', '3', '5', '5'], parts: ['pad', 'bass', 'arp', 'melody'], energy: 0.5 },
      { chords: ['1', '1', '6', '6', '4', '4', '5', '5'], parts: ['pad', 'bass', 'arp', 'melody', 'counter'], energy: 0.9 },
      { chords: ['1', '6', '4', '5'], parts: ['pad', 'arp', 'melody'], energy: 0.25 },
    ],
    written: [
      "1:0.5 5:0.5 1':2 7:1 | 6:1 5:1 3:2 | 1':1 6:1 3':2 | 3':1 1':1 6:2 | 4:1.5 6:0.5 1':1 4':1 | 3':2 2':1 1':1 | 7:1 2':1 5':1 4':0.5 3':0.5 | 2':4",
      "3:2 1:2 | 2:1 3:1 5:2 | 6:2 4:2 | 5:3 r:1 | 1':2 6:1 3:1 | 5:2 2:2 | 7,:1 2:1 4:1 7,:1 | 5,:4",
      "1:0.5 5:0.5 1':2 7:1 | 6:1 5:1 3:2 | 1':1 6:1 3':2 | 3':1 1':1 6:2 | 4:1.5 6:0.5 1':1 4':1 | 3':2 2':1 1':1 | 7:1 2':1 5':1 4':0.5 3':0.5 | 1':4",
      "5:4 | 3:4 | 1':4 | 6:4 | 4:4 | 6:4 | 7:4 | 2':4",
    ],
  },
  {
    id: 'veillee', name: 'Veillée', rarity: 'epique', mood: 'valse au piano, clochettes et cordes douces',
    bpm: 88, meter: 3, bars: 8, swing: 0, key: 53, scale: 'major',
    voices: { pad: 'strings', comp: 'piano', bass: 'piano', melody: 'piano', counter: 'bell' },
    drums: 'none', bass: 'whole', arp: 'none', comp: 'waltz',
    melody: { density: 0.45, low: 62, high: 84 }, reverb: 0.45, echo: 0.12,
    sections: [
      { chords: ['1', '6', '2', '5', '1', '4', '5', '1'], parts: ['comp', 'bass', 'melody'], energy: 0.45 },
      { chords: ['6', '6', '3', '3', '4', '4', '5', '5'], parts: ['pad', 'comp', 'bass', 'melody'], energy: 0.55 },
      { chords: ['1', '6', '2', '5', '1', '4', '5', '1'], parts: ['pad', 'comp', 'bass', 'melody', 'counter'], energy: 0.75 },
      { chords: ['1', '1', '4', '4', '1', '1', '5', '5'], parts: ['pad', 'bass', 'melody', 'counter'], energy: 0.25 },
    ],
    written: [
      "5:1.5 6:0.5 5:1 | 3:2 1:1 | 2:1 4:1 6:1 | 5:3 | 5:1.5 6:0.5 1':1 | 6:1 4:1 6:1 | 5:1 2:1 3:1 | 1:3",
      "6:1 1':1 3':1 | 2':2 1':1 | 7:1 1':1 3':1 | 7:3 | 6:1 1':1 4':1 | 3':2 2':1 | 1':1 7:1 6:1 | 5:3",
      "5:1.5 6:0.5 5:1 | 3:2 1:1 | 2:1 4:1 6:1 | 5:2 r:1 | 5:1.5 6:0.5 1':1 | 3':1 2':1 1':1 | 7:1 2':1 7:1 | 1':3",
      "3:3 | 2:1.5 1:1.5 | 4:3 | 6:3 | 5:3 | 3:3 | 2:3 | 7,:3",
    ],
  },
  // — Musiques à collectionner (boutique, et une gratuite) —
  {
    id: 'premier-etage', name: 'Premier étage', rarity: 'commun', mood: 'pop douce et bienveillante',
    bpm: 100, meter: 4, bars: 8, swing: 0, key: 53, scale: 'major',
    voices: { pad: 'warmPad', comp: 'ep', bass: 'bass', melody: 'marimba' },
    drums: 'pop', bass: 'root5', arp: 'none', comp: 'offbeat',
    melody: { density: 0.45, low: 65, high: 79 }, reverb: 0.2, echo: 0,
    sections: [
      { chords: ['1', '6', '4', '5'], parts: ['pad', 'comp', 'bass', 'drums'], energy: 0.4 },
      { chords: ['4', '5', '3', '6'], parts: ['pad', 'comp', 'bass', 'melody', 'drums'], energy: 0.6 },
      { chords: ['1', '6', '4', '5'], parts: ['pad', 'comp', 'bass', 'melody', 'drums'], energy: 0.8 },
      { chords: ['2:7', '5:sus4', '1', '1'], parts: ['pad', 'melody'], energy: 0.2 },
    ],
  },
  {
    id: 'gouter-lofi', name: 'Goûter lo-fi', rarity: 'commun', mood: 'hip-hop feutré, accords jazz',
    bpm: 80, meter: 4, bars: 8, swing: 0.33, key: 58, scale: 'major',
    voices: { comp: 'ep', bass: 'bass', melody: 'kalimba', counter: 'glass' },
    drums: 'lofi', bass: 'root5', arp: 'none', comp: 'lofi',
    melody: { density: 0.35, low: 62, high: 77 }, reverb: 0.25, echo: 0.12,
    sections: [
      { chords: ['2:9', '5:9', '1:7', '6:7'], parts: ['comp', 'bass', 'drums'], energy: 0.4 },
      { chords: ['4:7', '3:7', '2:9', '5:9'], parts: ['comp', 'bass', 'counter', 'drums'], energy: 0.5 },
      { chords: ['2:9', '5:9', '1:7', '6:7'], parts: ['comp', 'bass', 'melody', 'drums'], energy: 0.7 },
      { chords: ['4:7', '5:sus4', '1:7', '1:7'], parts: ['comp', 'counter'], energy: 0.2 },
    ],
  },
  {
    id: 'pixel-parade', name: 'Pixel parade', rarity: 'rare', mood: 'chiptune rapide et joyeuse',
    bpm: 132, meter: 4, bars: 8, swing: 0, key: 48, scale: 'major',
    voices: { comp: 'chip', bass: 'chipBass', arp: 'chip', melody: 'chipLead' },
    drums: 'chip', bass: 'pulse8', arp: 'updown16', comp: 'none',
    melody: { density: 0.6, low: 67, high: 86 }, reverb: 0.08, echo: 0.12,
    sections: [
      { chords: ['1', '5', '6', '4'], parts: ['bass', 'arp', 'drums'], energy: 0.5 },
      { chords: ['4', '5', '1', '6'], parts: ['bass', 'arp', 'melody', 'drums'], energy: 0.7 },
      { chords: ['6', '4', '1', '5'], parts: ['bass', 'arp', 'melody', 'drums'], energy: 0.95 },
      { chords: ['4', '1', '5', '1'], parts: ['arp', 'melody'], energy: 0.3 },
    ],
  },
  {
    id: 'fanfare-de-poche', name: 'Fanfare de poche', rarity: 'rare', mood: 'cuivres et caisse claire de défilé',
    bpm: 116, meter: 4, bars: 8, swing: 0, key: 58, scale: 'major',
    voices: { comp: 'brass', bass: 'tuba', melody: 'brass', counter: 'bell' },
    drums: 'march', bass: 'oompah', arp: 'none', comp: 'offbeat',
    melody: { density: 0.6, low: 65, high: 82 }, reverb: 0.2, echo: 0,
    sections: [
      { chords: ['1', '4', '5', '1'], parts: ['comp', 'bass', 'drums'], energy: 0.5 },
      { chords: ['6', '2:7', '5', '1'], parts: ['comp', 'bass', 'melody', 'drums'], energy: 0.7 },
      { chords: ['4', '1', '5', '6'], parts: ['comp', 'bass', 'melody', 'counter', 'drums'], energy: 0.9 },
      { chords: ['1', '5', '4', '1'], parts: ['bass', 'counter', 'melody'], energy: 0.3 },
    ],
  },
  {
    id: 'funk-des-briques', name: 'Funk des briques', rarity: 'epique', mood: 'basse funk, clavinet et cuivres',
    bpm: 104, meter: 4, bars: 8, swing: 0.1, key: 52, scale: 'dorian',
    voices: { comp: 'clav', bass: 'synthBass', melody: 'organ', counter: 'brass' },
    drums: 'pop', bass: 'funk', arp: 'none', comp: 'stab',
    melody: { density: 0.5, low: 64, high: 81 }, reverb: 0.15, echo: 0.1,
    sections: [
      { chords: ['1:7', '4:9', '1:7', '4:9'], parts: ['comp', 'bass', 'drums'], energy: 0.6 },
      { chords: ['3', '4', '1:7', '1:7'], parts: ['comp', 'bass', 'melody', 'drums'], energy: 0.75 },
      { chords: ['7', '4', '1:7', '5'], parts: ['comp', 'bass', 'melody', 'counter', 'drums'], energy: 0.95 },
      { chords: ['4:9', '4:9', '1:7', '1:7'], parts: ['comp', 'bass'], energy: 0.35 },
    ],
  },
  {
    id: 'aurore-polaire', name: 'Aurore polaire', rarity: 'legendaire', mood: 'ambiance lumineuse, verre et cloches',
    bpm: 70, meter: 4, bars: 8, swing: 0, key: 53, scale: 'lydian',
    voices: { pad: 'strings', bass: 'subBass', arp: 'glass', melody: 'bell', counter: 'harp' },
    drums: 'soft', bass: 'drone', arp: 'sparkle', comp: 'none',
    melody: { density: 0.3, low: 69, high: 86 }, reverb: 0.55, echo: 0.3,
    sections: [
      { chords: ['1:add9', '2', '1:add9', '2'], parts: ['pad', 'bass', 'arp'], energy: 0.25 },
      { chords: ['6:7', '2', '5', '1:add9'], parts: ['pad', 'bass', 'arp', 'melody'], energy: 0.5 },
      { chords: ['3', '2', '5', '1:add9'], parts: ['pad', 'bass', 'arp', 'melody', 'counter', 'drums'], energy: 0.75 },
      { chords: ['1:sus2', '2:sus2', '1:sus2', '1'], parts: ['pad', 'counter'], energy: 0.15 },
    ],
  },
];

export type TrackId = (typeof TRACKS)[number]['id'];

const BY_ID = new Map(TRACKS.map((t) => [t.id, t]));

export const getTrack = (id: string): TrackDef | undefined => BY_ID.get(id);
export const isTrackId = (id: unknown): id is string => typeof id === 'string' && BY_ID.has(id);

/** Durée d'une section (s). */
export const sectionSeconds = (t: TrackDef): number => (t.bars * t.meter * 60) / t.bpm;
