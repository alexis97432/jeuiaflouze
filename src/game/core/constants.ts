/**
 * Constantes de règles, rulesVersion 1.
 *
 * Toute la géométrie est exprimée en millièmes d'unité logique (« milli ») et
 * stockée en entiers : 360 unités = 360000 milli. Aucune arithmétique flottante
 * n'intervient dans le déplacement ni dans la découpe ; seul le calcul de la
 * vitesse d'un étage passe par un flottant IEEE-754, puis est arrondi une fois.
 * Modifier une de ces valeurs change le résultat des rejeux : augmenter
 * RULES_VERSION.
 */
export const RULES_VERSION = 1 as const;

/** Ticks logiques par seconde. */
export const TICK_RATE = 120;

/** Facteur unités logiques → milli. */
export const MILLI = 1000;

/** Largeur du terrain en milli (360 unités). */
export const FIELD_WIDTH = 360 * MILLI;

/** Largeur du bloc de départ en milli (240 unités). */
export const START_WIDTH = 240 * MILLI;

/** Bord gauche du bloc de départ, centré. */
export const START_LEFT = (FIELD_WIDTH - START_WIDTH) / 2;

/** Tolérance « parfait » entre bords gauches, incluse (4 unités). */
export const PERFECT_TOLERANCE = 4 * MILLI;

/** Vitesse de base du premier étage mobile, unités/s. */
export const BASE_SPEED = 90;

/** Gain de vitesse de base par étage, unités/s. */
export const SPEED_STEP = 3;

/** Plafond de la vitesse de base (avant modulation aléatoire), unités/s. */
export const SPEED_CAP = 210;

/** Modulation aléatoire : multiplicateur dans [0.9, 1.1[. */
export const SPEED_JITTER_MIN = 0.9;
export const SPEED_JITTER_SPAN = 0.2;

/** 2^32, dénominateur du tirage uniforme. */
export const UINT32_RANGE = 4294967296;

/** Bornes par défaut de la validation de rejeu (surchargées par le serveur). */
export const DEFAULT_REPLAY_LIMITS = {
  /** Une heure de jeu. */
  maxTicks: TICK_RATE * 60 * 60,
  /** Nombre maximal de placements acceptés dans un rejeu. */
  maxInputs: 20000,
} as const;
