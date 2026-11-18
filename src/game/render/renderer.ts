import { FIELD_WIDTH, MILLI, START_WIDTH, type BonusId, type BoostId, type Block, type StepEvent, type StepEventV2, type StepEventV3 } from '../core';
import {
  BLOCK_HEIGHT,
  createFaceGradient,
  DEFAULT_SKIN,
  drawBlock,
  edgeColors,
  RADIUS,
  SKIN_RARITY,
  type DrawSkinId,
} from './blocks';
import { CACHEABLE, hasLiveLayer, isRealContext, paintMaterial, releaseTextures, SKIN_FX, type MaterialEnv, type MaterialSkin } from './materials';

/** Briques en cache au plus (images à la résolution de l'écran) : mémoire bornée. */
export const MAX_BLOCK_CACHE = 40;
/**
 * V7 : budget mémoire du cache de briques (pixels, environ 8 Mo). À ×3, une brique large pèse
 * près de 80 000 pixels : 40 briques gardaient jusqu'à 12 Mo, renouvelés à chaque étage.
 */
export const BLOCK_PIXEL_BUDGET = 2_000_000;
type BlockCanvas = HTMLCanvasElement | OffscreenCanvas;
import {
  CosmeticRng,
  drawDuck,
  drawHudIcon,
  drawMagnetField,
  drawParticle,
  drawPigeon,
  drawShieldDome,
  drawSunburst,
  drawUfo,
  drawWord,
  MAX_WORDS,
  ParticlePool,
  WORDS,
  type HudIcon,
  type ParticleKind,
  type Word,
} from './fx';
import {
  css,
  getTheme,
  haloFor,
  mix,
  roundedRect,
  skyAt,
  stageAt,
  tierIndex,
  TIER_FLOORS,
  type DecorItem,
  type Rgb,
  type Theme,
  type TierIndex,
} from './themes';
import { releaseSprites, type SceneEnv } from './scene';

export { BLOCK_HEIGHT, reliefParts, SKIN_IDS, type ReliefParts, type SkinId } from './blocks';
/** Bornes des effets : jamais plus d'objets que ça, quelle que soit la série. */
/** Police du canvas, alignée sur l'interface V4 (Fredoka embarquée, sinon police arrondie du système). */
export const GAME_FONT = '"Fredoka Variable", "Fredoka", ui-rounded, "SF Pro Rounded", "Nunito", system-ui, sans-serif';
export const MAX_DEBRIS = 16;
/** V5 : réserve unique de particules (étoiles, poussière, braises, éclats, plumes). */
export const MAX_PARTICLES = 64;
/** Compatibilité des tests V2 : les « étincelles » sont désormais les particules de la réserve. */
export const MAX_SPARKS = MAX_PARTICLES;
export const MAX_RINGS = 4;
/** Ligne des onomatopées (fraction de la hauteur) : entre le HUD et le bloc mobile, jamais dessus. */
const WORD_LINE = 0.285;
const WAVE_DEPTH = 10;
const WAVE_TIME = 0.22;
const RIM_DEPTH = 6;
const RING_TIME = 0.5;
const TRAIL_MAX = 5;
const DUCK_TIME = 4.2;
/** Recul de caméra de fin de partie (s). */
const REVEAL_TIME = 0.8;
const FEVER_TOP: Rgb = [255, 64, 104];
const FEVER_BOTTOM: Rgb = [255, 176, 64];
const easeInOut = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
type GagKind = 'duck' | 'ufo' | 'pigeon';
/** Au plus ce nombre d'éléments de décor dessinés par image. */
export const MAX_DECOR = 28;

const FIELD_U = FIELD_WIDTH / MILLI;
/** Hauteur logique minimale visible : garde des blocs lisibles sur écran large. */
const MIN_VIEW_HEIGHT = 640;
/** Position du sol (fraction de la hauteur depuis le haut) au départ. */
const GROUND_FRAC = 0.86;
/** Le bloc actif est maintenu vers cette fraction de la hauteur depuis le haut. */
const ACTIVE_FRAC = 0.36;
/** Le décor défile plus lentement que la tour (profondeur). */
export const PARALLAX = 0.55;
/** Espacement vertical (unités parallaxe) entre deux tranches de décor. */
const DECOR_SLOT = 58;
const GRAVITY = 1400; // u/s²

export interface ViewState {
  readonly stack: readonly Block[];
  /** Bloc mobile déjà interpolé (milli), ou null après la fin. */
  readonly moving: Block | null;
  readonly score: number;
  readonly perfectStreak: number;
  readonly pause: 'none' | 'shell' | 'hidden';
  /** Partie finie (raté définitif) : déclenche le recul de caméra qui montre la tour. */
  readonly ended?: boolean;
  /** Règles v2 (V3, F7) : HUD des points, de la hauteur, de la jauge et de la reprise. */
  readonly v2?: HudV2;
}

/** État affiché par le HUD v2. Lu dans la simulation : aucune règle n'est recalculée ici. */
export interface HudV2 {
  /** Étages posés (le score affiché en grand est en points). */
  readonly height: number;
  readonly gauge: number;
  readonly gaugeMax: number;
  readonly next: BonusId | BoostId;
  readonly bonus: BonusId | BoostId | null;
  readonly bonusLeft: number;
  readonly bonusFloors: number;
  /** Chiffre du compte à rebours (3, 2, 1) ; 0 hors compte à rebours. */
  readonly countdown: number;
  /** Attente d'une décision de reprise (l'offre est un écran DOM du shell). */
  readonly fallen: boolean;
  /** V5 : règles v3 (boosts Ralenti, Aimant, Bouclier et Fièvre). */
  readonly rules?: 3;
  readonly fever?: boolean;
  readonly streak?: number;
  /** Tolérance du parfait en milli (élargie sous l'Aimant) : la zone d'aimantation dessinée est la vraie. */
  readonly tolerance?: number;
  /** Rattrapage du Bouclier en cours : fraction restante (1 → 0), 0 sinon. */
  readonly recovering?: number;
}

/** Libellés et couleurs des bonus : un mot court et une teinte, lisibles sans explication. */
export const BONUS_STYLE: Record<BonusId | BoostId, { label: string; banner: string; color: Rgb }> = {
  ralenti: { label: 'Ralenti', banner: 'RALENTI !', color: [86, 170, 255] },
  double: { label: '×2', banner: '×2 POINTS !', color: [255, 190, 40] },
  aimant: { label: 'Aimant', banner: 'AIMANT !', color: [255, 72, 120] },
  bouclier: { label: 'Bouclier', banner: 'BOUCLIER !', color: [72, 220, 170] },
};

/** Texte flottant « +N » au-dessus d'un étage posé. */
interface Float { text: string; floor: number; x: number; age: number; color: Rgb }
export const MAX_FLOATS = 6;

interface Debris { x: number; y: number; w: number; vx: number; vy: number; rot: number; vr: number; age: number; color: Rgb; floor: number; ox: number }
interface Ring { x: number; y: number; w: number; age: number; color: Rgb }

/** Hachage entier stable pour le décor (indépendant du PRNG de la partie). */
function hash(n: number): number {
  let x = (n ^ 0x9e3779b9) >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b) >>> 0;
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35) >>> 0;
  return (x ^ (x >>> 16)) >>> 0;
}
const unit = (n: number) => hash(n) / 4294967296;

/**
 * Rendu Canvas 2D. Ne lit que des états de la simulation ou ses événements :
 * aucun effet visuel ne modifie les règles.
 */
/** Ovni de la V5 : arrive, aspire le morceau coupé, repart. */
type UfoGag = { t: number; x: number; y: number; w: number; color: Rgb; floor: number; dir: -1 | 1 };

export class Renderer {
  private readonly ctx: CanvasRenderingContext2D;
  private theme: Theme;
  private cssW = 1;
  private cssH = 1;
  private dpr = 1;
  private camera = 0;
  private cameraTarget = 0;
  /** Hauteur affichée (étages, lissée) qui pilote le ciel. */
  private height = 0;
  private trauma = 0;
  private flash = 0;
  private flashFloor = 0;
  private ripple = 0;
  private streakLabel = 0;
  private streakValue = 0;
  private milestone = 0;
  private milestoneName = '';
  /** Annonce d'un bonus (1 → 0) et son nom ; fin de bonus ; « C'est parti ! » après reprise. */
  private bonusBanner = 0;
  private bonusEndFlash = 0;
  private goBanner = 0;
  private readonly floats: Float[] = [];
  private landing = 0;
  private lastNow: number | null = null;
  private readonly debris: Debris[] = [];
  /** V5 « Pop Choc » : particules, onomatopées, ondes, vague de compression, ambiances, absurdités. */
  private readonly particles = new ParticlePool(MAX_PARTICLES);
  private readonly words: Word[] = [];
  private readonly rings: Ring[] = [];
  private readonly cos = new CosmeticRng();
  /** V6 : graine cosmétique des découvertes de la scène (jamais le PRNG de la partie). */
  private readonly sceneSeed = Math.floor(this.cos.next() * 1_000_000_000);
  private wave: { t: number; top: number; amp: number; chain: boolean } | null = null;
  private readonly waveOffsets = new Float64Array(WAVE_DEPTH + 1);
  private feverMix = 0;
  private feverTarget = 0;
  private feverBeat = 0;
  private boostMix = 0;
  private boostTarget = 0;
  private boostShown: BonusId | BoostId | null = null;
  private shieldBreak = 0;
  private scoreBump = 0;
  private lastScore = 0;
  private emberClock = 0;
  private readonly trail = new Float64Array(TRAIL_MAX);
  private trailHead = 0;
  private trailLen = 0;
  private trailClock = 0;
  private reveal = 0;
  private revealTarget = false;
  /** Caméra effectivement dessinée (recul de fin de partie compris). */
  private viewCamera = 0;
  /** Bas du HUD (px) à la dernière image : les onomatopées s'écrivent dessous. */
  private hudBottom = 0;
  private wordSide: -1 | 1 = 1;
  private duck: { t: number; dir: 1 | -1; y: number } | null = null;
  private ufo: UfoGag | null = null;
  private pigeon: { floor: number; side: -1 | 1; flying: number; x: number; y: number } | null = null;
  /** Son des absurdités (branché par le montage sur Sfx.gag). */
  public onGag: ((kind: GagKind) => void) | null = null;
  private readonly gradients = new Map<string, CanvasGradient>();
  /** Ciel de l'image courante (haut, bas) et échelle, pour choisir le contour selon le fond réel. */
  private skyTop: Rgb = [255, 255, 255];
  private skyBottom: Rgb = [255, 255, 255];
  private frameScale = 1;
  /** Palier mémorisé par élément de décor (borné aux éléments proches de l'écran). */
  private readonly decorTiers = new Map<number, { tier: number; born: number }>();
  private decorDrawn = 0;

  private skin: DrawSkinId;
  /** V6 : origine de la matière de chaque pièce posée (bord gauche du bloc mobile à la pose). */
  private readonly origins = new Map<number, number>();
  /** V6 : briques communes et rares déjà dessinées (une seule copie d'image par brique et par image). */
  private readonly blockCache = new Map<string, BlockCanvas>();
  private blockPixels = 0;
  /** Canvas de briques réellement créés depuis le début (tests : le recyclage limite ce nombre). */
  private blockCanvasCreated = 0;
  private readonly canCacheBlocks: boolean;
  /** V6 : instant, mouvement et qualité de l'image en cours (matières vivantes). */
  private frameT = 0;
  private frameMotion = true;
  private frameFull = true;
  /** V6 : qualité adaptative. Cadence trop basse soutenue → calques coûteux retirés (visuel seulement). */
  private slowTime = 0;
  private sampledTime = 0;
  public autoLight = false;
  /** Appelé quand la qualité adaptative se déclenche (le montage recalcule alors la résolution). */
  public onAutoLight: (() => void) | null = null;
  /** V7 : couches décoratives coupées après une erreur, pour le reste de la partie. */
  private readonly faulted = new Set<string>();
  /** V7 : rapport d'une couche en défaut (branché par le montage sur le journal de diagnostic). */
  public onFault: ((layer: string, error: unknown) => void) | null = null;
  /**
   * V7 : mode secours, activé par le montage si le dessin principal a échoué : ciel, tour en
   * aplats, bloc mobile et HUD seulement. La partie continue, ses règles ne changent pas.
   */
  public safeMode = false;
  /** V7 : une image s'est interrompue ou une couche a échoué : contexte à remettre à plat. */
  private unbalanced = false;
  private drawing = false;
  /**
   * V4 : `light` (mode Fluide) = résolution interne plafonnée à 1,5, étincelles divisées par
   * trois, débris et décor réduits. Purement visuel.
   */
  public quality: 'full' | 'light' = 'full';

  constructor(
    private readonly canvas: HTMLCanvasElement,
    public reducedMotion: boolean,
    theme: Theme = getTheme(undefined),
    skin: DrawSkinId = DEFAULT_SKIN,
  ) {
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Canvas 2D indisponible');
    this.ctx = ctx;
    this.theme = theme;
    this.skin = skin;
    this.canCacheBlocks = isRealContext(ctx) && (typeof OffscreenCanvas !== 'undefined' || typeof document !== 'undefined');
  }

  private clearBlockCache(): void {
    this.blockCache.clear();
    this.blockPixels = 0;
  }

  /** Canvas de briques créés depuis le début de la partie (tests de recyclage). */
  get blockCanvasCount(): number {
    return this.blockCanvasCreated;
  }

  /** Pixels gardés par le cache de briques (tests de bornes). */
  get blockCachePixels(): number {
    return this.blockPixels;
  }

  /** Briques en cache (tests de bornes). */
  get blockCacheSize(): number {
    return this.blockCache.size;
  }

  get skinId(): DrawSkinId { return this.skin; }

  get debrisCount(): number { return this.debris.length; }
  get sparkCount(): number { return this.particles.alive; }
  /** Inspection (tests) : effets V5 vivants. */
  get fxState(): {
    words: string[]; rings: number; particles: number; fever: number; boost: number; duck: boolean; ufo: boolean;
    pigeon: boolean; reveal: number; boxes: { x: number; y: number; size: number }[]; hudBottom: number;
    activeTop: number; fieldLeft: number; fieldRight: number;
  } {
    return {
      words: this.words.map((w) => w.text), rings: this.rings.length, particles: this.particles.alive,
      fever: this.feverMix, boost: this.boostMix, duck: this.duck !== null, ufo: this.ufo !== null,
      pigeon: this.pigeon !== null, reveal: this.reveal,
      boxes: this.words.map((w) => ({ x: w.x, y: w.y, size: w.size })),
      hudBottom: this.hudBottom, activeTop: this.cssH * ACTIVE_FRAC, fieldLeft: (this.cssW - FIELD_U * this.scale()) / 2,
      fieldRight: (this.cssW + FIELD_U * this.scale()) / 2,
    };
  }
  /** Éléments de décor dessinés à la dernière image (borné par MAX_DECOR). */
  get decorCount(): number { return this.decorDrawn; }
  get gradientCacheSize(): number { return this.gradients.size; }
  get decorMemorySize(): number { return this.decorTiers.size; }
  get themeName(): string { return this.theme.name; }
  get backingSize(): { width: number; height: number; dpr: number } {
    return { width: this.canvas.width, height: this.canvas.height, dpr: this.dpr };
  }

  /** Reprise acceptée : effets de la chute effacés, jauge et bonus repartent de zéro. */
  onContinue(): void {
    this.trauma = 0;
    this.bonusBanner = 0;
    this.bonusEndFlash = 0;
    this.floats.length = 0;
    this.words.length = 0;
    this.rings.length = 0;
    this.particles.clear();
    this.wave = null;
    this.reveal = 0;
  }

  get floatCount(): number { return this.floats.length; }

  setTheme(theme: Theme): void {
    this.theme = theme;
    this.gradients.clear();
    this.clearBlockCache();
  }

  setSkin(skin: DrawSkinId): void {
    this.skin = skin;
    this.gradients.clear();
    this.clearBlockCache();
    releaseTextures();
  }

  /** Fin de vie (destroy) : caches graphiques libérés. */
  dispose(): void {
    this.gradients.clear();
    this.clearBlockCache();
    this.origins.clear();
    this.particles.clear();
    releaseTextures();
    releaseSprites();
  }

  /** Qualité effective : réglage du joueur, puis qualité adaptative. */
  get effectiveFull(): boolean {
    return this.quality === 'full' && !this.autoLight;
  }

  /** Ajuste la résolution interne à la taille CSS × devicePixelRatio. Renvoie true si changé. */
  resize(cssWidth: number, cssHeight: number, devicePixelRatio: number): boolean {
    const dpr = Math.min(Math.max(devicePixelRatio || 1, 1), this.quality === 'light' || this.autoLight ? 1.5 : 3);
    const w = Math.max(1, Math.round(cssWidth * dpr));
    const h = Math.max(1, Math.round(cssHeight * dpr));
    this.cssW = Math.max(1, cssWidth);
    this.cssH = Math.max(1, cssHeight);
    this.dpr = dpr;
    if (this.canvas.width === w && this.canvas.height === h) return false;
    this.clearBlockCache();
    this.canvas.width = w;
    this.canvas.height = h;
    return true;
  }

  /** Événement de simulation → effets visuels bornés. Renvoie le nom du palier atteint, s'il y en a un. */
  onEvent(event: StepEvent | StepEventV2 | StepEventV3): string | null {
    const motion = !this.reducedMotion;
    if (event.kind === 'resumed') {
      if (!('cause' in event) || event.cause === 'continue') this.goBanner = 1;
      else this.addWord('PRÊT ?', [255, 255, 255], 30, 0.7, 1);
      return null;
    }
    if (event.kind === 'saved') {
      // Bouclier : le bloc rebondit sur la bulle qui éclate ; la tour ne bouge pas.
      const w = event.moving.width / MILLI;
      this.debris.push({
        x: event.moving.left / MILLI, y: (event.floor + 1) * BLOCK_HEIGHT, w, vx: (event.moving.left > FIELD_WIDTH / 2 ? 1 : -1) * 90,
        vy: 380, rot: 0, vr: 3, age: 0, color: this.colorFor(event.floor), floor: event.floor, ox: event.moving.left / MILLI,
      });
      if (this.debris.length > MAX_DEBRIS) this.debris.shift();
      this.shieldBreak = 1;
      this.addWord(this.cos.pick(WORDS.saved), [72, 220, 170], 46, 1.1, 3);
      this.burst('shard', event.moving.left / MILLI + w / 2, (event.floor + 1.5) * BLOCK_HEIGHT, 14, [150, 255, 220], 260);
      if (motion) this.trauma = Math.min(0.45, this.trauma + 0.35);
      this.pigeonScare();
      return null;
    }
    if (event.kind === 'missed') {
      this.addDebris(event.moving, event.floor, 0);
      this.addWord(this.cos.pick(WORDS.crash), [255, 110, 70], 50, 1.3, 3);
      this.burst('dust', event.moving.left / MILLI + event.moving.width / MILLI / 2, (event.floor + 0.5) * BLOCK_HEIGHT, 10, [200, 196, 210], 120);
      if (motion) this.trauma = Math.min(0.6, this.trauma + 0.5);
      this.pigeonScare();
      return null;
    }
    // Pose réussie : le bloc s'écrase un instant (vague limitée au bloc posé, ou en chaîne si parfait).
    const v3 = 'boost' in event ? event : null;
    // La pièce garde la matière qu'elle avait en mouvement (origine = bord gauche du bloc mobile).
    this.origins.set(event.floor, Math.min(event.placed.left, event.cut ? event.cut.left : event.placed.left) / MILLI);
    if (this.origins.size > 96) for (const f of this.origins.keys()) if (f < event.floor - 60) this.origins.delete(f);
    this.skinPlacementFx(event.placed, event.floor, event.perfect);
    const placedV2 = !v3 && 'points' in event ? (event as Extract<StepEventV2, { kind: 'placed' }>) : null;
    const streak = event.perfectStreak;
    const amp = event.perfect ? Math.min(0.26, 0.12 + 0.03 * streak) : 0.09;
    this.wave = { t: 0, top: event.floor, amp, chain: event.perfect };
    if (event.cut) {
      const side = event.placed.left > event.cut.left ? -1 : 1;
      if (v3?.fever && !this.ufo && motion && this.quality === 'full' && this.cos.next() < 0.35) {
        // Absurdité : pendant la Fièvre, un ovni vient parfois chiper le morceau coupé.
        this.ufo = { t: 0, x: (event.cut.left + event.cut.width / 2) / MILLI, y: (event.floor + 1) * BLOCK_HEIGHT, w: event.cut.width / MILLI, color: this.colorFor(event.floor), floor: event.floor, dir: side };
        this.gag('ufo');
      } else {
        this.addDebris(event.cut, event.floor, side, Math.min(event.placed.left, event.cut.left) / MILLI);
      }
      const cx = side < 0 ? event.placed.left / MILLI : (event.placed.left + event.placed.width) / MILLI;
      this.burst('dust', cx, (event.floor + 1) * BLOCK_HEIGHT, 3, [235, 230, 240], 60);
    }
    if (event.perfect) {
      this.flash = 1;
      this.flashFloor = event.floor;
      this.ripple = motion ? 1 : 0;
      this.streakValue = streak;
      this.streakLabel = streak >= 2 ? 1 : 0;
      const cx = (event.placed.left + event.placed.width / 2) / MILLI;
      const y = (event.floor + 1) * BLOCK_HEIGHT;
      this.rings.push({ x: cx, y, w: event.placed.width / MILLI, age: 0, color: v3?.snapped ? [255, 72, 120] : v3?.fever ? [255, 170, 60] : [255, 255, 255] });
      if (this.rings.length > MAX_RINGS) this.rings.shift();
      this.addSparks(event.placed, event.floor, 6 + Math.min(streak * 2, 12));
      if (v3?.snapped) this.addWord(this.cos.pick(WORDS.snap), [255, 72, 120], 36, 0.8, 1);
      else if (!(v3?.feverStarted)) {
        const list = streak >= 3 ? WORDS.streak3 : streak === 2 ? WORDS.streak2 : WORDS.perfect;
        this.addWord(this.cos.pick(list), streak >= 3 ? [255, 214, 64] : [255, 255, 255], 30 + Math.min(streak, 5) * 3, 0.8, 1);
      }
      this.pigeonScare();
    } else if (!this.pigeon && motion && this.quality === 'full' && event.floor >= 8 && this.cos.next() < 0.12) {
      // Absurdité : un pigeon se pose sur le flanc d'un étage plus bas, jusqu'au prochain parfait.
      const floor = Math.max(1, event.floor - 3 - Math.floor(this.cos.next() * 3));
      this.pigeon = { floor, side: this.cos.next() < 0.5 ? -1 : 1, flying: 0, x: 0, y: 0 };
    }
    if (v3 || placedV2) {
      const points = (v3 ?? placedV2)!.points;
      if (this.floats.length >= MAX_FLOATS) this.floats.shift();
      this.floats.push({
        text: `+${points}`,
        floor: event.floor,
        x: (event.placed.left + event.placed.width / 2) / MILLI,
        age: 0,
        color: v3?.fever ? [255, 170, 60] : placedV2?.bonus === 'double' ? BONUS_STYLE.double.color : [255, 255, 255],
      });
      const started = v3 ? v3.boostStarted : placedV2!.bonusStarted;
      if (started) {
        this.bonusBanner = 1;
        const st = BONUS_STYLE[started];
        this.addWord(st.banner, st.color, 44, 1.5, 4);
        this.burst('star', (event.placed.left + event.placed.width / 2) / MILLI, (event.floor + 1) * BLOCK_HEIGHT, 10, st.color, 240);
      }
      if (v3 ? v3.boostEnded : placedV2!.bonusEnded) this.bonusEndFlash = 1;
      if (v3?.feverStarted) {
        this.addWord(WORDS.fever[0], [255, 140, 40], 52, 1.6, 5);
        this.feverBeat = 1;
        this.burst('ember', (event.placed.left + event.placed.width / 2) / MILLI, (event.floor + 1) * BLOCK_HEIGHT, 16, [255, 170, 60], 300);
      } else if (v3?.fever) {
        this.feverBeat = 1;
      }
      if (v3?.feverEnded) this.burst('dust', (event.placed.left + event.placed.width / 2) / MILLI, (event.floor + 1) * BLOCK_HEIGHT, 8, [230, 230, 240], 80);
    }
    const tier = (TIER_FLOORS as readonly number[]).indexOf(event.floor);
    if (tier > 0) {
      this.milestoneName = this.theme.tiers[tier as TierIndex].name;
      this.milestone = 1;
      if (!this.duck && motion && this.cos.next() < 0.45) {
        // Absurdité : un canard géant traverse le ciel pour fêter le nouveau monde.
        this.duck = { t: 0, dir: this.cos.next() < 0.5 ? 1 : -1, y: 0.46 + this.cos.next() * 0.12 };
        this.gag('duck');
      }
      return this.milestoneName;
    }
    return null;
  }

  /** Onomatopée : un mot plus fort remplace le plus faible quand la place manque (au plus 3). */
  private addWord(text: string, color: Rgb, size: number, life: number, weight: number): void {
    if (this.words.length >= MAX_WORDS) {
      let weakest = 0;
      for (let i = 1; i < this.words.length; i++) if (this.words[i]!.weight <= this.words[weakest]!.weight) weakest = i;
      if (this.words[weakest]!.weight > weight) return;
      this.words.splice(weakest, 1);
    }
    // Un seul mot lisible à la fois : les précédents s'effacent tout de suite, en remontant à peine.
    for (const w of this.words) {
      w.age = Math.max(w.age, w.life * 0.68);
      w.y -= Math.min(12, size * 0.3);
    }
    const { x, y, s, side } = this.wordSpot(size);
    // Plus de place sous le HUD (petit écran) : pas de mot ; le HUD porte déjà l'information.
    if (!side && (this.cssH * ACTIVE_FRAC - BLOCK_HEIGHT * this.scale() * 0.5 - this.hudBottom) / 1.45 < 12) return;
    this.words.push({
      text, color, size: s, life: this.reducedMotion ? Math.min(life, 0.9) : life, weight, age: 0,
      x, y, rot: this.cos.range(-0.09, 0.09), side,
    });
  }

  /** À chaque image : les mots restent entre le HUD (qui peut grandir) et la zone de pose. */
  private keepWordsClear(): void {
    const limit = this.cssH * ACTIVE_FRAC - BLOCK_HEIGHT * this.frameScale * 0.5;
    // Place entre le HUD et la zone de pose : le mot rétrécit pour tenir, ou s'efface s'il n'y en a
    // plus assez (petit écran, bandeau de palier affiché) — jamais sur le HUD ni sur la pose.
    const fit = (limit - this.hudBottom) / 1.45;
    for (let i = this.words.length - 1; i >= 0; i--) {
      const w = this.words[i]!;
      if (w.side) continue;
      if (fit < 12) {
        this.words.splice(i, 1);
        continue;
      }
      if (w.size > fit) w.size = fit;
      w.y = Math.max(this.hudBottom + w.size * 0.7, Math.min(limit - w.size * 0.75, w.y));
    }
  }

  /**
   * Où écrire une onomatopée sans jamais couvrir la zone de pose : en portrait, entre le HUD et
   * le bloc mobile ; en paysage (peu de hauteur), à côté de la tour, du côté opposé au précédent.
   */
  private wordSpot(size: number): { x: number; y: number; s: number; side: boolean } {
    const fieldW = FIELD_U * this.scale();
    const side = (this.cssW - fieldW) / 2;
    if (side > 150) {
      this.wordSide = -this.wordSide as -1 | 1;
      const s = Math.min(size, side * 0.17, this.cssH * 0.1);
      return { x: this.cssW / 2 + this.wordSide * (fieldW / 2 + side / 2), y: this.cssH * 0.45, s, side: true };
    }
    // Marge d'un demi-bloc : la caméra rattrape le nouvel étage juste après une pose.
    const active = this.cssH * ACTIVE_FRAC - BLOCK_HEIGHT * this.scale() * 0.5;
    const s = Math.min(size, this.cssW * 0.13, Math.max(18, (active - this.hudBottom) * 0.42));
    const top = this.hudBottom + s * 0.7;
    const bottom = active - s * 0.75;
    const y = Math.max(top, Math.min(bottom, this.cssH * WORD_LINE));
    return { x: this.cssW / 2 + (this.reducedMotion ? 0 : this.cos.range(-0.08, 0.08) * this.cssW), y, s, side: false };
  }

  /** Gerbe de particules (bornée par la réserve, réduite en mode Fluide, nulle en mouvement réduit). */
  private burst(kind: ParticleKind, x: number, y: number, count: number, color: Rgb, speed: number, palette?: readonly Rgb[]): void {
    if (this.reducedMotion) return;
    const n = this.quality === 'light' ? Math.ceil(count / 2) : count;
    const limit = this.quality === 'light' ? MAX_PARTICLES / 2 : MAX_PARTICLES;
    for (let i = 0; i < n; i++) {
      const p = this.particles.spawn(limit);
      if (!p) return;
      const a = kind === 'ember' ? Math.PI / 2 + this.cos.range(-0.8, 0.8) : this.cos.range(0, Math.PI * 2);
      const v = speed * this.cos.range(0.35, 1);
      p.kind = kind;
      p.x = x + this.cos.range(-6, 6);
      p.y = y + this.cos.range(-4, 4);
      p.vx = Math.cos(a) * v;
      p.vy = Math.abs(Math.sin(a)) * v * (kind === 'dust' ? 0.5 : 1);
      p.rot = this.cos.range(0, 6);
      p.vr = this.cos.range(-6, 6);
      p.size = kind === 'star' ? this.cos.range(4, 7) : kind === 'dust' ? this.cos.range(3, 6) : kind === 'shard' ? this.cos.range(4, 8)
        : kind === 'glint' ? this.cos.range(4, 7) : kind === 'bubble' ? this.cos.range(3, 6) : this.cos.range(2, 4);
      p.age = 0;
      p.life = kind === 'dust' ? this.cos.range(0.4, 0.7) : kind === 'ember' || kind === 'bubble' ? this.cos.range(0.8, 1.4) : this.cos.range(0.45, 0.8);
      p.color = kind === 'ember' && !palette ? (this.cos.next() < 0.5 ? [255, 120, 40] : [255, 210, 80]) : palette ? palette[i % palette.length]! : color;
      p.gravity = kind === 'ember' || kind === 'bubble' ? -0.25 : kind === 'dust' ? 0.15 : kind === 'feather' ? 0.1 : kind === 'glint' ? 0.2 : 1;
    }
  }

  /** Le pigeon s'envole (plumes) au prochain parfait, à une chute ou à un rattrapage. */
  private pigeonScare(): void {
    const p = this.pigeon;
    if (!p || p.flying > 0) return;
    p.flying = 0.0001;
    this.burst('feather', p.x, p.y, 4, [200, 205, 220], 90);
    this.gag('pigeon');
  }

  private gag(kind: GagKind): void {
    try {
      this.onGag?.(kind);
    } catch {
      // Un son d'absurdité ne doit jamais casser le rendu.
    }
  }

  draw(view: ViewState, now: number): void {
    // Image précédente interrompue par une exception, ou couche en défaut : contexte remis à plat.
    if (this.drawing || this.unbalanced) this.unwindContext();
    this.drawing = true;
    this.drawFrame(view, now);
    this.drawing = false;
  }

  private drawFrame(view: ViewState, now: number): void {
    const dt = this.lastNow === null ? 0 : Math.min((now - this.lastNow) / 1000, 0.1);
    this.lastNow = now;
    const t = now / 1000;
    const motion = !this.reducedMotion;
    // Qualité adaptative : sur une fenêtre de 2 s, si plus de 60 % du temps passe dans des images
    // lentes (> 34 ms, moins de 30 images/s), les calques coûteux sont retirés pour la suite.
    if (dt > 0 && dt < 0.25 && !this.autoLight) {
      this.sampledTime += dt;
      if (dt > 0.034) this.slowTime += dt;
      if (this.sampledTime >= 2) {
        if (this.slowTime > this.sampledTime * 0.6) {
          this.autoLight = true;
          this.onAutoLight?.();
        }
        this.sampledTime = 0;
        this.slowTime = 0;
      }
    }
    const full = this.effectiveFull;
    this.frameT = t;
    this.frameMotion = motion;
    this.frameFull = full;
    const { ctx, dpr, theme } = this;
    const hud = view.v2;
    const len = view.stack.length;
    // Fin de partie : recul de caméra qui montre toute la tour (supprimé en mouvement réduit).
    this.revealTarget = view.ended === true && motion;
    const baseScale = this.scale();
    const groundY = this.cssH * GROUND_FRAC;
    const towerTop = (len + 1) * BLOCK_HEIGHT;
    this.update(dt, view, baseScale, groundY);
    const r = easeInOut(this.reveal);
    const fitZoom = Math.min(1, Math.max(0.3, (groundY - this.cssH * 0.3) / (towerTop * baseScale)));
    const scale = baseScale * (1 + (fitZoom - 1) * r);
    const camEnd = Math.max(0, towerTop - (groundY - this.cssH * 0.3) / scale);
    this.viewCamera = this.camera + (camEnd - this.camera) * r;
    const viewH = this.cssH / scale;
    const offsetX = (this.cssW - FIELD_U * scale) / 2;

    let shakeX = 0;
    let shakeY = 0;
    if (this.trauma > 0 && motion) {
      const s = this.trauma * this.trauma * 9;
      shakeX = s * Math.sin(now * 0.047);
      shakeY = s * Math.sin(now * 0.061);
    }

    // 1. Ciel : selon la hauteur, réchauffé par la Fièvre, refroidi par le Ralenti.
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const sky = skyAt(theme, this.height);
    let skyTop = sky.top;
    let skyBottom = sky.bottom;
    if (this.feverMix > 0) {
      skyTop = mix(skyTop, FEVER_TOP, this.feverMix * 0.85);
      skyBottom = mix(skyBottom, FEVER_BOTTOM, this.feverMix * 0.85);
    }
    if (this.boostMix > 0 && this.boostShown === 'ralenti') {
      skyTop = mix(skyTop, [150, 185, 255], this.boostMix * 0.3);
      skyBottom = mix(skyBottom, [205, 225, 255], this.boostMix * 0.3);
    }
    this.skyTop = skyTop;
    this.skyBottom = skyBottom;
    this.frameScale = scale;
    const g = ctx.createLinearGradient(0, 0, 0, this.cssH);
    g.addColorStop(0, css(skyTop));
    g.addColorStop(1, css(skyBottom));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.cssW, this.cssH);
    const scene = this.sceneEnv(scale, groundY, t, motion, full);
    this.guard('scene-ciel', () => theme.scene.far(scene));

    // 2. Fièvre : rayons de BD derrière la tour (fixes et discrets si le mouvement est réduit).
    if (this.feverMix > 0.02 && full) {
      const alpha = (motion ? 0.16 : 0.08) * this.feverMix * (1 + 0.35 * this.feverBeat);
      this.guard('fievre', () => drawSunburst(ctx, this.cssW / 2, this.cssH * 0.42, Math.max(this.cssW, this.cssH) * 1.2, motion ? t * 0.22 : 0, [255, 255, 240], alpha));
    }

    // 3. Décor en parallaxe (atténué pendant la Fièvre), puis absurdité du ciel (canard).
    ctx.save();
    if (this.feverMix > 0) ctx.globalAlpha = 1 - this.feverMix * 0.6;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.guard('scene-fond', () => theme.scene.back(scene));
    this.guard('decor', () => this.drawDecor(scale, groundY, t, motion, tierIndex(Math.max(0, len - 1))));
    ctx.restore();
    const duck = this.duck;
    if (duck) {
      this.guard('absurdites', () => {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        const p = duck.t / DUCK_TIME;
        const span = this.cssW + 200;
        const x = duck.dir > 0 ? -100 + p * span : this.cssW + 100 - p * span;
        if (duck.dir < 0) {
          ctx.translate(x, 0);
          ctx.scale(-1, 1);
          ctx.translate(-x, 0);
        }
        drawDuck(ctx, x, this.cssH * duck.y, Math.min(1.1, this.cssW / 380), t, motion);
      });
    }

    // 4. Sol thématique sous l'étage 0, puis premier plan léger (derrière la tour).
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const groundTop = groundY + this.viewCamera * scale + shakeY;
    if (groundTop < this.cssH) {
      ctx.fillStyle = css(theme.ground.body);
      ctx.fillRect(0, groundTop, this.cssW, this.cssH - groundTop);
      this.guard('scene-sol', () => theme.scene.ground(scene, groundTop));
    }
    if (full) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.guard('scene-premier-plan', () => theme.scene.near(scene));
    }

    // 5. Monde : x en unités, y vers le haut depuis le sol.
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * (offsetX + shakeX), 0);
    const yScreen = (y: number) => (groundY - (y - this.viewCamera) * scale + shakeY) / scale;
    const bottomY = this.viewCamera - (this.cssH - groundY) / scale;
    const firstVisible = Math.max(0, Math.floor(bottomY / BLOCK_HEIGHT) - 1);
    const lastVisible = Math.min(len, Math.ceil((bottomY + viewH) / BLOCK_HEIGHT) + 1);

    // Vague de compression : le bloc posé s'écrase ; sur un parfait, la vague descend la tour.
    const waveFrom = Math.max(0, len - WAVE_DEPTH);
    let acc = 0;
    for (let i = waveFrom; i < len; i++) {
      this.waveOffsets[i - waveFrom] = acc;
      acc += BLOCK_HEIGHT * this.compressionAt(i);
    }
    const rim = hud?.fever ? 0.9 : Math.min(0.6, Math.max(0, (view.perfectStreak - 2) * 0.2));
    const rimColor: Rgb = hud?.fever ? [255, 170, 60] : [255, 255, 255];
    for (let i = firstVisible; i < lastVisible; i++) {
      const b = view.stack[i]!;
      const inWave = i >= waveFrom;
      const off = inWave ? this.waveOffsets[i - waveFrom]! : 0;
      const c = inWave ? this.compressionAt(i) : 0;
      const top = yScreen(i * BLOCK_HEIGHT - off + BLOCK_HEIGHT * (1 - c));
      const x = b.left / MILLI;
      const w = b.width / MILLI;
      if (c > 0.002) {
        ctx.save();
        ctx.translate(0, top);
        ctx.scale(1, 1 - c);
        this.block(x, 0, w, this.colorFor(i), 1, i);
        ctx.restore();
      } else {
        this.block(x, top, w, this.colorFor(i), 1, i);
      }
      // Liseré lumineux des étages du haut pendant une série ; en Fièvre, ils chauffent (teinte).
      if (rim > 0 && i >= len - RIM_DEPTH) {
        const k = 1 - (len - 1 - i) / RIM_DEPTH;
        if (this.feverMix > 0) {
          ctx.fillStyle = css([255, 120, 40], 0.22 * this.feverMix * k * (1 + 0.5 * this.feverBeat));
          roundedRect(ctx, x, top, w, BLOCK_HEIGHT * (1 - c), RADIUS);
          ctx.fill();
        }
        ctx.strokeStyle = css(rimColor, rim * k);
        ctx.lineWidth = hud?.fever ? 3 : 2;
        roundedRect(ctx, x + 1, top + 1, w - 2, BLOCK_HEIGHT * (1 - c) - 2, RADIUS);
        ctx.stroke();
      }
      const above = i + 1 < len ? view.stack[i + 1]! : view.moving;
      if (above) this.contactShadow(b, above, top);
    }
    const baseTopY = len > 0 ? yScreen(len * BLOCK_HEIGHT - (len - 1 >= waveFrom ? this.waveOffsets[len - 1 - waveFrom]! + BLOCK_HEIGHT * this.compressionAt(len - 1) : 0)) : 0;

    // Parfait : la face s'illumine brièvement (dans le bloc).
    if (this.flash > 0 && this.flashFloor < len && this.flashFloor >= firstVisible) {
      const b = view.stack[this.flashFloor]!;
      ctx.fillStyle = css([255, 255, 255], this.flash * 0.45);
      roundedRect(ctx, b.left / MILLI, yScreen((this.flashFloor + 1) * BLOCK_HEIGHT), b.width / MILLI, BLOCK_HEIGHT, RADIUS);
      ctx.fill();
    }

    // Pigeon perché sur le flanc d'un étage inférieur (jamais sur la base ni le bloc mobile).
    const pigeon = this.pigeon;
    if (pigeon && pigeon.floor < len - 1) {
      this.guard('absurdites', () => {
        const pb = view.stack[pigeon.floor]!;
        const px = pigeon.side < 0 ? pb.left / MILLI + 9 : (pb.left + pb.width) / MILLI - 9;
        const py = (pigeon.floor + 1) * BLOCK_HEIGHT;
        const fly = pigeon.flying;
        pigeon.x = px + pigeon.side * fly * 140;
        pigeon.y = py + fly * 170;
        drawPigeon(ctx, pigeon.x, yScreen(pigeon.y), pigeon.side, fly);
      });
    }

    // Boosts : zone d'aimantation réelle, bulle du Bouclier, sillage du Ralenti.
    const rowTop = yScreen((len + 1) * BLOCK_HEIGHT);
    this.guard('boosts', () => this.drawBoosts(view, len, rowTop, baseTopY, t, motion, full));

    if (view.moving) {
      // Rattrapage du Bouclier : le bloc clignote doucement avant de repartir.
      const blink = hud?.recovering && hud.recovering > 0 ? (motion ? 0.5 + 0.5 * Math.abs(Math.sin(t * 14)) : 0.6) : 1;
      const ml = view.moving.left / MILLI;
      const mw = view.moving.width / MILLI;
      // Aura des légendaires : halo doux derrière le bloc mobile (jamais au-delà de la ligne du bloc).
      const aura = SKIN_FX[this.skin as MaterialSkin]?.aura;
      if (aura && this.frameFull && SKIN_RARITY[this.skin] === 'legendaire') {
        this.guard('aura', () => {
          const pulse = motion ? 0.75 + 0.25 * Math.sin(t * 3) : 0.85;
          const g = ctx.createLinearGradient(0, rowTop - 10, 0, rowTop + BLOCK_HEIGHT + 10);
          g.addColorStop(0, css(aura, 0));
          g.addColorStop(0.5, css(aura, 0.28 * pulse));
          g.addColorStop(1, css(aura, 0));
          ctx.fillStyle = g;
          roundedRect(ctx, ml - 8, rowTop - 10, mw + 16, BLOCK_HEIGHT + 20, 14);
          ctx.fill();
        });
      }
      this.block(ml, rowTop, mw, this.colorFor(len), blink, len, { wx: ml, ox: ml });
    }

    if (this.debris.length > 0) {
      this.guard('debris', () => {
        for (const d of this.debris) {
          const alpha = this.reducedMotion ? Math.max(0, 1 - d.age / 0.45) : Math.max(0, 1 - d.age / 1.6);
          ctx.save();
          ctx.translate(d.x + d.w / 2, yScreen(d.y) + BLOCK_HEIGHT / 2);
          ctx.rotate(d.rot);
          // Sans cache : la position change à chaque image (avant la V7, chaque image d'une chute
          // créait une nouvelle brique en cache, environ 250 canvas pour une partie de 40 étages).
          this.block(-d.w / 2, -BLOCK_HEIGHT / 2, d.w, d.color, alpha, d.floor, { wx: d.x, ox: d.ox }, false);
          ctx.restore();
        }
      });
    }

    // Ovni : arrive, aspire le morceau coupé, repart.
    const ufo = this.ufo;
    if (ufo) this.guard('absurdites', () => this.drawUfoGag(ufo, t, yScreen));

    if (this.particles.alive > 0) {
      this.guard('particules', () => {
        for (const p of this.particles.items) {
          if (!p.alive) continue;
          ctx.save();
          ctx.translate(p.x, yScreen(p.y));
          drawParticle(ctx, p);
          ctx.restore();
        }
      });
    }

    // Ondes de choc des parfaits : ellipse qui s'élargit autour du bloc posé. Une onde à départ
    // différé (célébration des légendaires, âge négatif) n'est pas encore dessinée : avant la V7,
    // son rayon devenait négatif sur un bloc étroit et `ellipse` levait une exception qui arrêtait
    // la boucle de jeu (partie figée).
    if (this.rings.length > 0) {
      this.guard('ondes', () => {
        for (const ring of this.rings) {
          if (ring.age < 0) continue;
          const p = Math.min(1, ring.age / RING_TIME);
          ctx.strokeStyle = css(ring.color, (1 - p) * 0.9);
          ctx.lineWidth = 5 * (1 - p) + 1;
          ctx.beginPath();
          ctx.ellipse(ring.x, yScreen(ring.y - BLOCK_HEIGHT / 2), Math.max(0, ring.w / 2 + p * 70), Math.max(0, BLOCK_HEIGHT * 0.6 + p * 22), 0, 0, Math.PI * 2);
          ctx.stroke();
        }
      });
    }

    // Points « +N » : montent et s'effacent (fixes en mouvement réduit).
    if (this.floats.length > 0) {
      this.guard('points', () => {
        for (const f of this.floats) {
          const rise = motion ? f.age * 40 : 0;
          ctx.globalAlpha = Math.max(0, 1 - f.age / 0.9);
          ctx.font = `900 20px ${GAME_FONT}`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          ctx.lineWidth = 5;
          ctx.lineJoin = 'round';
          ctx.strokeStyle = '#1b1a3a';
          const y = yScreen((f.floor + 1) * BLOCK_HEIGHT) - 6 - rise;
          ctx.strokeText(f.text, f.x, y);
          ctx.fillStyle = css(f.color);
          ctx.fillText(f.text, f.x, y);
          ctx.globalAlpha = 1;
        }
      });
    }

    // 6. Écran : bord coloré du boost actif et de la Fièvre (statique en mouvement réduit).
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const boostShown = this.boostShown;
    if (this.boostMix > 0.01 && boostShown) this.guard('bords', () => this.vignette(BONUS_STYLE[boostShown].color, 0.32 * this.boostMix));
    if (this.feverMix > 0.01) this.guard('bords', () => this.vignette([255, 120, 40], 0.3 * this.feverMix * (1 + 0.4 * this.feverBeat)));

    // 7. HUD, puis onomatopées placées sous le HUD de cette image (jamais dessus ni sur la pose).
    this.drawHud(view, sky.ink);
    if (this.words.length > 0) {
      this.guard('mots', () => {
        this.keepWordsClear();
        for (const w of this.words) drawWord(ctx, w, GAME_FONT, motion);
      });
    }
  }

  /** Boosts : zone d'aimantation réelle, bulle du Bouclier, sillage du Ralenti. */
  private drawBoosts(view: ViewState, len: number, rowTop: number, baseTopY: number, t: number, motion: boolean, full: boolean): void {
    const { ctx } = this;
    const hud = view.v2;
    if (hud?.bonus === 'aimant' && view.moving && len > 0) {
      const base = view.stack[len - 1]!;
      const tol = (hud.tolerance ?? 0) / MILLI;
      const bl = base.left / MILLI;
      const br = (base.left + base.width) / MILLI;
      const a = this.boostMix;
      ctx.fillStyle = `rgba(255,72,120,${0.2 * a})`;
      ctx.fillRect(bl - tol, rowTop, tol * 2, BLOCK_HEIGHT);
      ctx.fillRect(br - tol, rowTop, tol * 2, BLOCK_HEIGHT);
      ctx.save();
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = `rgba(255,72,120,${0.75 * a})`;
      ctx.lineWidth = 1.5;
      roundedRect(ctx, bl, rowTop, br - bl, BLOCK_HEIGHT, RADIUS);
      ctx.stroke();
      ctx.restore();
      const ml = view.moving.left / MILLI;
      const strength = a * Math.max(0, 1 - Math.abs(ml - bl) / Math.max(1, tol * 4));
      const mw = view.moving.width / MILLI;
      drawMagnetField(ctx, ml, rowTop + BLOCK_HEIGHT, bl, baseTopY, strength, t, motion);
      drawMagnetField(ctx, ml + mw, rowTop + BLOCK_HEIGHT, br, baseTopY, strength, t, motion);
    }
    if ((hud?.bonus === 'bouclier' || this.shieldBreak > 0) && len > 0) {
      const charge = hud?.bonus === 'bouclier' ? hud.bonusLeft / Math.max(1, hud.bonusFloors) : 0;
      const alpha = hud?.bonus === 'bouclier' ? this.boostMix * 0.9 : this.shieldBreak * 0.6;
      drawShieldDome(ctx, -10, baseTopY, FIELD_U + 20, BLOCK_HEIGHT * 2.6 * (1 + (1 - Math.min(1, alpha)) * 0.1), alpha, t, charge, motion);
    }
    if (hud?.bonus === 'ralenti' && view.moving && motion) {
      const n = Math.min(this.trailLen, full ? TRAIL_MAX : 2);
      for (let k = 0; k < n; k++) {
        const left = this.trail[(this.trailHead - 1 - k + TRAIL_MAX) % TRAIL_MAX]!;
        this.block(left / MILLI, rowTop, view.moving.width / MILLI, this.colorFor(len), 0.28 * (1 - k / n) * this.boostMix, len, { wx: left / MILLI, ox: left / MILLI });
      }
    }
  }

  /** Ovni : arrive, aspire le morceau coupé (réduit dans le faisceau), repart. */
  private drawUfoGag(u: UfoGag, t: number, yScreen: (y: number) => number): void {
    const { ctx } = this;
    const p = u.t;
    const hoverY = u.y + BLOCK_HEIGHT * 4;
    const ux = p < 0.25 ? u.x - u.dir * (1 - p / 0.25) * 220 : p < 0.85 ? u.x : u.x + u.dir * ((p - 0.85) / 0.65) * 260;
    const uy = p < 0.85 ? hoverY : hoverY + ((p - 0.85) / 0.65) * 120;
    if (p >= 0.25 && p < 0.85) {
      const lift = (p - 0.25) / 0.6;
      const py = u.y + lift * (hoverY - u.y);
      ctx.save();
      ctx.translate(u.x, yScreen(py));
      ctx.scale(1 - lift * 0.7, 1 - lift * 0.7);
      // Morceau aspiré : dessiné sans cache (son échelle change à chaque image).
      this.block(-u.w / 2, -BLOCK_HEIGHT / 2, u.w, u.color, 1, u.floor, { wx: u.x - u.w / 2, ox: u.x - u.w / 2 }, false);
      ctx.restore();
    }
    drawUfo(ctx, ux, yScreen(uy), p >= 0.25 && p < 0.85 ? (hoverY - u.y) * 1 : 0, t);
  }

  /** Bord coloré (dégradé radial) : lu comme un état, sans rien cacher au centre. */
  private vignette(color: Rgb, alpha: number): void {
    const { ctx } = this;
    const cx = this.cssW / 2;
    const cy = this.cssH / 2;
    const g = ctx.createRadialGradient(cx, cy, Math.min(cx, cy) * 0.75, cx, cy, Math.hypot(cx, cy));
    g.addColorStop(0, css(color, 0));
    g.addColorStop(1, css(color, Math.min(0.5, alpha)));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.cssW, this.cssH);
  }

  /** Compression (0-1) du bloc `i` dans la vague en cours ; nulle en mouvement réduit. */
  private compressionAt(i: number): number {
    const w = this.wave;
    if (!w || this.reducedMotion) return 0;
    const depth = w.top - i;
    if (depth < 0 || (!w.chain && depth > 0)) return 0;
    const x = w.t - depth * 0.045;
    if (x <= 0 || x >= WAVE_TIME) return 0;
    return w.amp * 0.8 ** depth * Math.sin((Math.PI * x) / WAVE_TIME);
  }

  /** true si un effet est encore en cours (le rendu peut alors s'arrêter). */
  get animating(): boolean {
    return this.debris.length > 0 || this.particles.alive > 0 || this.flash > 0 || this.trauma > 0 ||
      this.streakLabel > 0 || this.landing > 0 || this.milestone > 0 || this.ripple > 0 ||
      this.floats.length > 0 || this.bonusBanner > 0 || this.bonusEndFlash > 0 || this.goBanner > 0 ||
      this.words.length > 0 || this.rings.length > 0 || this.wave !== null || this.duck !== null ||
      this.ufo !== null || (this.pigeon !== null && this.pigeon.flying > 0) || this.shieldBreak > 0 ||
      this.scoreBump > 0 || this.feverBeat > 0 || (this.revealTarget && this.reveal < 1) ||
      Math.abs(this.feverMix - this.feverTarget) > 0.01 || Math.abs(this.boostMix - this.boostTarget) > 0.01 ||
      Math.abs(this.camera - this.cameraTarget) > 0.05;
  }

  private scale(): number {
    return Math.min(this.cssW / FIELD_U, this.cssH / MIN_VIEW_HEIGHT);
  }

  private colorFor(floor: number): Rgb {
    return this.theme.blocks[floor % this.theme.blocks.length]!;
  }

  private update(dt: number, view: ViewState, scale: number, groundY: number): void {
    const len = view.stack.length;
    const hud = view.v2;
    const motion = !this.reducedMotion;
    this.cameraTarget = Math.max(0, (len + 1) * BLOCK_HEIGHT - (groundY - ACTIVE_FRAC * this.cssH) / scale);
    const heightTarget = len - 1;
    if (this.reducedMotion) {
      this.camera = this.cameraTarget;
      this.height = heightTarget;
    } else {
      this.camera += (this.cameraTarget - this.camera) * (1 - Math.exp(-dt * 7));
      this.height += (heightTarget - this.height) * (1 - Math.exp(-dt * 2.5));
    }
    const approach = (cur: number, target: number, rate: number) => (motion ? cur + (target - cur) * (1 - Math.exp(-dt * rate)) : target);
    this.feverTarget = hud?.fever ? 1 : 0;
    this.boostTarget = hud?.bonus ? 1 : 0;
    this.feverMix = approach(this.feverMix, this.feverTarget, 3);
    this.boostMix = approach(this.boostMix, this.boostTarget, 4);
    if (hud?.bonus) this.boostShown = hud.bonus;
    else if (this.boostMix < 0.01) this.boostShown = null;
    this.reveal = this.revealTarget ? Math.min(1, this.reveal + dt / REVEAL_TIME) : 0;
    this.feverBeat = Math.max(0, this.feverBeat - dt * 3);
    this.shieldBreak = Math.max(0, this.shieldBreak - dt * 2.2);
    this.scoreBump = Math.max(0, this.scoreBump - dt * 4);
    if (view.score > this.lastScore) this.scoreBump = 1;
    this.lastScore = view.score;
    if (this.wave) {
      this.wave.t += dt;
      if (this.wave.t > 1) this.wave = null;
    }
    this.trauma = Math.max(0, this.trauma - dt * 1.8);
    this.flash = Math.max(0, this.flash - dt * 3.5);
    this.ripple = Math.max(0, this.ripple - dt / 0.45);
    this.landing = Math.max(0, this.landing - dt * 10);
    this.streakLabel = Math.max(0, this.streakLabel - dt * 0.8);
    this.milestone = Math.max(0, this.milestone - dt / 2.4);
    this.bonusBanner = Math.max(0, this.bonusBanner - dt / 1.8);
    this.bonusEndFlash = Math.max(0, this.bonusEndFlash - dt / 0.8);
    this.goBanner = Math.max(0, this.goBanner - dt / 0.9);
    for (let i = this.floats.length - 1; i >= 0; i--) {
      const f = this.floats[i]!;
      f.age += dt;
      if (f.age > 0.9) this.floats.splice(i, 1);
    }
    for (let i = this.words.length - 1; i >= 0; i--) {
      const w = this.words[i]!;
      w.age += dt;
      if (w.age > w.life) this.words.splice(i, 1);
    }
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const ring = this.rings[i]!;
      ring.age += dt;
      if (ring.age > RING_TIME) this.rings.splice(i, 1);
    }
    this.particles.update(dt, GRAVITY);
    // Braises de la Fièvre : montent du haut de la tour, en petit nombre.
    if (this.feverMix > 0.5 && motion && this.quality === 'full' && len > 0) {
      this.emberClock += dt;
      while (this.emberClock > 0.09) {
        this.emberClock -= 0.09;
        this.burst('ember', this.cos.range(10, FIELD_U - 10), (len - this.cos.range(0, 5)) * BLOCK_HEIGHT, 1, [255, 170, 60], 60);
      }
    }
    // Sillage du Ralenti : quelques positions passées du bloc mobile (jamais à venir).
    if (hud?.bonus === 'ralenti' && view.moving && motion) {
      this.trailClock += dt;
      if (this.trailClock > 0.05) {
        this.trailClock = 0;
        this.trail[this.trailHead] = view.moving.left;
        this.trailHead = (this.trailHead + 1) % TRAIL_MAX;
        this.trailLen = Math.min(TRAIL_MAX, this.trailLen + 1);
      }
    } else {
      this.trailLen = 0;
    }
    if (this.duck) {
      this.duck.t += dt;
      if (this.duck.t > DUCK_TIME) this.duck = null;
    }
    if (this.ufo) {
      this.ufo.t += dt;
      if (this.ufo.t > 1.5) this.ufo = null;
    }
    if (this.pigeon) {
      if (this.pigeon.flying > 0) this.pigeon.flying += dt;
      if (this.pigeon.flying > 1.4 || this.pigeon.floor < len - 16) this.pigeon = null;
    }
    for (let i = this.debris.length - 1; i >= 0; i--) {
      const d = this.debris[i]!;
      d.age += dt;
      if (!this.reducedMotion) {
        d.vy -= GRAVITY * dt;
        d.x += d.vx * dt;
        d.y += d.vy * dt;
        d.rot += d.vr * dt;
      }
      if (d.age > (this.reducedMotion ? 0.45 : 1.6)) this.debris.splice(i, 1);
    }
  }

  /** Contexte de la scène d'univers pour l'image en cours (V6). */
  private sceneEnv(scale: number, groundY: number, t: number, motion: boolean, full: boolean): SceneEnv {
    return {
      ctx: this.ctx, w: this.cssW, h: this.cssH, groundY, cam: this.viewCamera, scale,
      height: this.height, stage: stageAt(this.height), t, motion, full, seed: this.sceneSeed, activeFrac: ACTIVE_FRAC,
    };
  }

  /**
   * V7 : couche décorative protégée. Une erreur n'est jamais avalée en silence : elle est
   * signalée une fois (`onFault`, journal de diagnostic, console) et la couche fautive est coupée
   * pour le reste de la partie. La tour, le bloc mobile et le HUD continuent d'être dessinés.
   */
  private guard(layer: string, paint: () => void): void {
    if (this.safeMode || this.faulted.has(layer)) return;
    const { ctx } = this;
    ctx.save();
    try {
      paint();
    } catch (error) {
      this.fault(layer, error);
    }
    ctx.restore();
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  /** Couche coupée et signalée une seule fois ; la pile d'états du contexte sera remise à plat. */
  private fault(layer: string, error: unknown): void {
    if (this.faulted.has(layer)) return;
    this.faulted.add(layer);
    this.unbalanced = true;
    try {
      this.onFault?.(layer, error);
    } catch {
      // Le rapport lui-même ne doit pas casser l'image ; l'erreur d'origine a déjà été transmise.
    }
  }

  /** Couches coupées depuis le début de la partie (inspection, diagnostic). */
  get faults(): readonly string[] {
    return [...this.faulted];
  }

  /**
   * Remet le contexte dans un état connu après une image interrompue (exception au milieu de
   * `save`/`restore`) : sans cela, une découpe ou une transparence restées actives fausseraient
   * toutes les images suivantes. `restore` sur une pile vide ne fait rien.
   */
  private unwindContext(): void {
    const { ctx } = this;
    for (let i = 0; i < 32; i++) ctx.restore();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.setLineDash?.([]);
    this.unbalanced = false;
  }

  /**
   * Images en cache (briques, dégradés, textures) jetées : après une perte du contexte graphique
   * (leur contenu peut être vide) ou pour libérer de la mémoire. Elles se reconstruisent à la demande.
   */
  purgeCaches(): void {
    this.gradients.clear();
    this.clearBlockCache();
    releaseTextures();
    releaseSprites();
  }

  /**
   * Décor en parallaxe. Chaque élément garde le palier qu'il avait en entrant à l'écran ;
   * au franchissement d'un palier, ceux qui sont au-dessus du bloc actif prennent le nouveau
   * style (fondu de 0,4 s, ou bascule nette en reduced-motion). Pas de retour en arrière.
   */
  private drawDecor(scale: number, groundY: number, t: number, motion: boolean, currentTier: number): void {
    const { ctx, dpr, theme } = this;
    const camP = this.viewCamera * PARALLAX;
    const low = camP - (this.cssH - groundY) / scale - DECOR_SLOT;
    const high = camP + groundY / scale + DECOR_SLOT;
    const first = Math.max(2, Math.floor(low / DECOR_SLOT));
    const last = Math.ceil(high / DECOR_SLOT);
    const spanX = this.cssW / scale; // tout l'écran, pas seulement le terrain
    // Étage auquel un élément entre par le haut de l'écran : il prend le style de ce palier.
    // Ainsi le nouveau décor arrive avec le palier, et l'ancien défile vers le bas.
    const lead = (groundY - ACTIVE_FRAC * this.cssH) / scale;
    const entryFloor = (py: number) => Math.max(0, ((py - groundY / scale) / PARALLAX + lead) / BLOCK_HEIGHT - 2);
    // Zone du score : pas de décor derrière le texte (lisibilité).
    const hudBottom = this.cssH * 0.27;
    const hudLeft = this.cssW * 0.2;
    const hudRight = this.cssW * 0.8;
    const activeLine = this.cssH * ACTIVE_FRAC + 20;
    let drawn = 0;
    const maxDecor = this.quality === 'light' ? Math.round(MAX_DECOR / 3) : MAX_DECOR;
    for (let k = first; k <= last && drawn < maxDecor; k++) {
      for (let j = 0; j < 2 && drawn < maxDecor; j++) {
        const id = k * 2 + j;
        const item: DecorItem = { x: unit(id * 4 + 1), r1: unit(id * 4 + 2), r2: unit(id * 4 + 3), r3: unit(id * 4 + 4) };
        const py = k * DECOR_SLOT + item.r1 * DECOR_SLOT * 0.8;
        const sx = (this.cssW - spanX * scale) / 2 + (j === 0 ? item.x * 0.5 : 0.5 + item.x * 0.5) * spanX * scale;
        const sy = groundY - (py - camP) * scale;
        if (sy < -60 || sy > this.cssH + 60) continue;
        if (sy < hudBottom && sx > hudLeft && sx < hudRight) continue;
        const above = sy < activeLine;
        let rec = this.decorTiers.get(id);
        if (!rec) {
          rec = { tier: above ? currentTier : Math.min(currentTier, tierIndex(entryFloor(py))), born: -Infinity };
          this.decorTiers.set(id, rec);
        } else if (above && rec.tier < currentTier) {
          rec.tier = currentTier;
          rec.born = t;
        }
        const painter = theme.tiers[rec.tier as TierIndex].decor;
        ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * sx, dpr * sy);
        ctx.save();
        ctx.globalAlpha = motion ? Math.min(1, Math.max(0, (t - rec.born) / 0.4)) : 1;
        painter(ctx, item, t, motion);
        ctx.restore();
        drawn++;
      }
    }
    this.decorDrawn = drawn;
    // Oublie les éléments sortis de l'écran (mémoire bornée).
    for (const id of this.decorTiers.keys()) {
      if (id < first * 2 - 8 || id > last * 2 + 8) this.decorTiers.delete(id);
    }
  }

  private drawHud(view: ViewState, ink: Rgb): void {
    const { ctx, dpr } = this;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const big = Math.round(Math.min(72, this.cssW * 0.17, this.cssH * 0.11));
    const font = (weight: number, size: number) => `${weight} ${size}px ${GAME_FONT}`;
    // Liseré de la couleur opposée : le texte reste lisible quand le ciel passe par des tons moyens.
    const halo = css(haloFor(ink), 0.7);
    const text = (s: string, y: number, size: number, color: string, alpha = 1) => {
      ctx.globalAlpha = alpha;
      ctx.font = font(800, size);
      ctx.lineJoin = 'round';
      ctx.lineWidth = Math.max(2, size * 0.09);
      ctx.strokeStyle = halo;
      ctx.strokeText(s, this.cssW / 2, y);
      ctx.fillStyle = color;
      ctx.fillText(s, this.cssW / 2, y);
      ctx.globalAlpha = 1;
    };
    const top = this.cssH * 0.055;
    // Score : il rebondit quand il augmente (fixe si le mouvement est réduit).
    const bump = this.reducedMotion ? 0 : this.scoreBump;
    ctx.save();
    if (bump > 0) {
      const k = 1 + 0.16 * bump;
      ctx.translate(this.cssW / 2, top + big / 2);
      ctx.scale(k, k);
      ctx.translate(-this.cssW / 2, -(top + big / 2));
    }
    text(String(view.score), top, big, css(ink));
    ctx.restore();
    let line = top + big * 1.08;
    const v2 = view.v2;
    if (v2) {
      // En v2/v3 le grand nombre est en points : la hauteur est rappelée, en plus petit.
      const small = Math.round(big * 0.28);
      text(`${v2.height} étage${v2.height > 1 ? 's' : ''}`, line - big * 0.06, small, css(ink), 0.9);
      line += small * 1.35;
      line = this.drawGauge(v2, line, big, ink, halo, font);
      if (v2.fever) line = this.drawFeverBadge(line, big, font);
    }
    if (this.milestone > 0) {
      text(`Palier : ${this.milestoneName}`, line, Math.round(big * 0.3), css(ink), Math.min(1, this.milestone * 2.5));
      line += big * 0.42;
    }
    if (this.streakLabel > 0 && !v2?.fever) {
      text(`SÉRIE ×${this.streakValue}`, line, Math.round(big * 0.3), css(ink), Math.min(1, this.streakLabel * 1.5));
      line += big * 0.36;
    }
    this.hudBottom = line + big * 0.1;
    if (v2?.fallen && view.pause === 'none') {
      // Attente de la décision : la scène est figée sous un voile, l'offre est un écran DOM.
      ctx.fillStyle = 'rgba(20,20,40,0.45)';
      ctx.fillRect(0, 0, this.cssW, this.cssH);
    }
    if (v2 && v2.countdown > 0 && view.pause === 'none') {
      ctx.fillStyle = 'rgba(20,20,40,0.35)';
      ctx.fillRect(0, 0, this.cssW, this.cssH);
      ctx.textBaseline = 'middle';
      const size = Math.round(Math.min(160, this.cssW * 0.4));
      ctx.font = font(900, size);
      ctx.lineWidth = Math.max(4, size * 0.08);
      ctx.strokeStyle = '#20213D';
      ctx.strokeText(String(v2.countdown), this.cssW / 2, this.cssH / 2);
      ctx.fillStyle = '#FFF4DB';
      ctx.fillText(String(v2.countdown), this.cssW / 2, this.cssH / 2);
      ctx.font = font(800, Math.round(size * 0.18));
      ctx.lineWidth = 4;
      const hint = 'Prépare-toi…';
      ctx.strokeText(hint, this.cssW / 2, this.cssH / 2 + size * 0.62);
      ctx.fillText(hint, this.cssW / 2, this.cssH / 2 + size * 0.62);
    }
    if (view.pause !== 'none') {
      ctx.fillStyle = 'rgba(20,20,40,0.6)';
      ctx.fillRect(0, 0, this.cssW, this.cssH);
      ctx.textBaseline = 'middle';
      ctx.font = font(700, Math.round(big * 0.38));
      ctx.fillStyle = '#FFF4DB';
      ctx.fillText(view.pause === 'hidden' ? 'Touche pour reprendre' : 'Pause', this.cssW / 2, this.cssH / 2);
    }
  }

  /** Pastille « FIÈVRE ×2 » sous la jauge (flamme qui vacille, fixe si le mouvement est réduit). */
  private drawFeverBadge(line: number, big: number, font: (w: number, s: number) => string): number {
    const { ctx } = this;
    const size = Math.round(big * 0.28);
    const label = 'FIÈVRE ×2';
    ctx.font = font(900, size);
    const tw = ctx.measureText(label).width;
    const h = size + 10;
    const w = tw + size * 1.6 + 18;
    const x = (this.cssW - w) / 2;
    const flicker = this.reducedMotion ? 0 : Math.sin((this.lastNow ?? 0) / 70) * 0.06;
    const g = ctx.createLinearGradient(0, line, 0, line + h);
    g.addColorStop(0, '#ffd166');
    g.addColorStop(1, '#ff7a3d');
    ctx.fillStyle = g;
    roundedRect(ctx, x, line, w, h, h / 2);
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#1b1a3a';
    ctx.stroke();
    drawHudIcon(ctx, 'fievre', x + 9 + size * 0.5, line + h / 2, size * (1 + flicker), [255, 72, 40]);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#1b1a3a';
    ctx.fillText(label, x + 14 + size, line + h / 2 + 1);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    return line + h + big * 0.12;
  }

  /**
   * Jauge « Super » sous le score : 10 cases qui se remplissent, avec le nom du prochain bonus.
   * Pendant un bonus : 5 cases aux couleurs du bonus, qui se vident à chaque pose.
   * Renvoie la ligne suivante libre.
   */
  private drawGauge(v2: HudV2, line: number, big: number, ink: Rgb, halo: string, font: (w: number, s: number) => string): number {
    const { ctx } = this;
    const active = v2.bonus;
    const style = BONUS_STYLE[active ?? v2.next];
    const cells = active ? v2.bonusFloors : v2.gaugeMax;
    const filled = active ? v2.bonusLeft : Math.min(v2.gauge, v2.gaugeMax);
    const label = style.label;
    const labelSize = Math.round(big * 0.26);
    ctx.font = font(800, labelSize);
    const iconSize = Math.round(labelSize * 1.05);
    const labelW = ctx.measureText(label).width + 14 + iconSize;
    const barW = Math.min(200, this.cssW * 0.5);
    const barH = Math.max(12, Math.round(big * 0.2));
    const total = barW + labelW;
    const x0 = (this.cssW - total) / 2;
    const gap = 3;
    const cellW = (barW - gap * (cells - 1)) / cells;
    // Fond de la jauge : contour lisible sur tout ciel (encre du thème + halo).
    ctx.fillStyle = halo;
    roundedRect(ctx, x0 - 3, line - 3, barW + 6, barH + 6, (barH + 6) / 2);
    ctx.fill();
    for (let i = 0; i < cells; i++) {
      const x = x0 + i * (cellW + gap);
      roundedRect(ctx, x, line, cellW, barH, Math.min(4, barH / 2));
      if (i < filled) {
        ctx.fillStyle = css(style.color);
        ctx.fill();
      } else {
        ctx.fillStyle = css(ink, 0.18);
        ctx.fill();
      }
      ctx.strokeStyle = css(ink, 0.55);
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    // Nom du bonus à venir (ou en cours), à droite de la barre.
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = Math.max(2, labelSize * 0.12);
    ctx.strokeStyle = halo;
    const ly = line + barH / 2;
    drawHudIcon(ctx, (active ?? v2.next) as HudIcon, x0 + barW + 8 + iconSize / 2, ly, iconSize, style.color);
    const lx = x0 + barW + 12 + iconSize;
    ctx.lineWidth = Math.max(2, labelSize * 0.12);
    ctx.strokeStyle = halo;
    ctx.strokeText(label, lx, ly);
    ctx.fillStyle = active ? css(style.color) : css(ink);
    ctx.fillText(label, lx, ly);
    if (this.bonusEndFlash > 0) {
      ctx.globalAlpha = this.bonusEndFlash;
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      roundedRect(ctx, x0 - 3, line - 3, barW + 6, barH + 6, (barH + 6) / 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    return line + barH + big * 0.2;
  }

  /** Dégradé de face mis en cache par (couleur, apparence) ; borné à 64 entrées. */
  private faceGradient(color: Rgb): CanvasGradient {
    const key = `${this.skin}:${color.join(',')}`;
    let g = this.gradients.get(key);
    if (!g) {
      g = createFaceGradient(this.ctx, color, this.skin);
      if (this.gradients.size >= 64) this.gradients.clear();
      this.gradients.set(key, g);
    }
    return g;
  }

  /**
   * Bloc en relief avec l'apparence courante, strictement contenu dans [x, x + w].
   * `place` : position dans le monde (wx) et origine de la matière (ox) quand le repère local
   * n'est pas celui de la tour (débris qui tournent, bloc mobile).
   */
  private block(x: number, y: number, w: number, color: Rgb, alpha: number, variant: number, place?: { wx: number; ox: number }, cache = true): void {
    if (this.safeMode || this.faulted.has('matiere')) {
      this.flatBlock(x, y, w, color, alpha);
      return;
    }
    const { ctx } = this;
    ctx.save();
    try {
      this.materialBlock(x, y, w, color, alpha, variant, place, cache);
    } catch (error) {
      // Matière en défaut : signalée, puis blocs en aplats pour le reste de la partie.
      this.fault('matiere', error);
      ctx.restore();
      this.unbalanced = true;
      this.flatBlock(x, y, w, color, alpha);
      return;
    }
    ctx.restore();
  }

  /** Bloc de secours : aplat arrondi et contour, sans texture (mode secours, matière en défaut). */
  private flatBlock(x: number, y: number, w: number, color: Rgb, alpha: number): void {
    if (!(w > 0)) return;
    const { ctx } = this;
    ctx.save();
    ctx.globalAlpha *= Math.max(0, Math.min(1, alpha));
    ctx.fillStyle = css(color);
    roundedRect(ctx, x, y, w, BLOCK_HEIGHT, RADIUS);
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = css(mix(color, [20, 20, 40], 0.55));
    ctx.stroke();
    ctx.restore();
  }

  private materialBlock(x: number, y: number, w: number, color: Rgb, alpha: number, variant: number, place: { wx: number; ox: number } | undefined, cache: boolean): void {
    const frac = Math.min(1, Math.max(0, (y + BLOCK_HEIGHT / 2) * this.frameScale / this.cssH));
    const env: MaterialEnv = {
      t: this.frameT,
      motion: this.frameMotion,
      full: this.frameFull,
      wx: place?.wx ?? x,
      wy: -(variant + 1) * BLOCK_HEIGHT,
      ox: place?.ox ?? this.origins.get(variant) ?? x,
      cam: this.viewCamera,
      floor: variant,
    };
    const sky = mix(this.skyTop, this.skyBottom, frac);
    if (cache && this.cachedBlock(x, y, w, color, alpha, variant, env, sky)) return;
    drawBlock(this.ctx, x, y, w, color, {
      skin: this.skin,
      sky,
      alpha,
      gradient: this.faceGradient(color),
      variant,
      env,
    });
  }

  /**
   * Brique commune ou rare : base dessinée une fois dans une image en cache, puis copiée ; seul le
   * reflet qui glisse (rares) est redessiné. Faux si le cache ne s'applique pas (dessin direct).
   */
  private cachedBlock(x: number, y: number, w: number, color: Rgb, alpha: number, variant: number, env: MaterialEnv, sky: Rgb): boolean {
    const skin = this.skin as MaterialSkin;
    if (!this.canCacheBlocks || !CACHEABLE.has(skin) || this.reveal > 0 || w <= 0) return false;
    const { ctx } = this;
    const m = ctx.getTransform();
    const k = Math.hypot(m.a, m.b);
    if (!(k > 0) || k > 3.5) return false;
    const outline = edgeColors(color, this.skin, sky).outline;
    const key = `${skin}|${color.join(',')}|${Math.round(w * 4)}|${variant}|${Math.round((env.wx - env.ox) * 2)}|${outline.join(',')}|${k.toFixed(3)}`;
    let sprite = this.blockCache.get(key);
    if (!sprite) {
      const pw = Math.ceil(w * k);
      const ph = Math.ceil(BLOCK_HEIGHT * k);
      // Place libérée d'abord : la brique la plus ancienne est réutilisée (redimensionnée), sans
      // créer de nouveau canvas ; sa mémoire est rendue tout de suite, pas au ramasse-miettes.
      let reuse: BlockCanvas | null = null;
      while (this.blockCache.size > 0 && (this.blockCache.size >= MAX_BLOCK_CACHE || this.blockPixels + pw * ph > BLOCK_PIXEL_BUDGET)) {
        const first = this.blockCache.keys().next().value;
        if (first === undefined) break;
        const old = this.blockCache.get(first);
        this.blockCache.delete(first);
        if (old) {
          this.blockPixels -= old.width * old.height;
          reuse = old;
        }
      }
      let c: BlockCanvas | null = reuse;
      try {
        if (c) {
          c.width = pw;
          c.height = ph;
        } else {
          c = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(pw, ph) : Object.assign(document.createElement('canvas'), { width: pw, height: ph });
          this.blockCanvasCreated++;
        }
      } catch {
        c = null;
      }
      const x2 = (c?.getContext('2d') ?? null) as CanvasRenderingContext2D | null;
      if (!c || !x2) return false;
      x2.setTransform(pw / w, 0, 0, ph / BLOCK_HEIGHT, 0, 0);
      drawBlock(x2, 0, 0, w, color, { skin: this.skin, sky, alpha: 1, variant, env: { ...env, layer: 'base' } });
      this.blockCache.set(key, c);
      this.blockPixels += pw * ph;
      sprite = c;
    } else {
      // Récemment utilisée : en fin de liste (éviction de la plus ancienne).
      this.blockCache.delete(key);
      this.blockCache.set(key, sprite);
    }
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.drawImage(sprite as CanvasImageSource, x, y, w, BLOCK_HEIGHT);
    if (env.full && hasLiveLayer(skin)) {
      ctx.translate(x, y);
      roundedRect(ctx, 0, 0, w, BLOCK_HEIGHT, RADIUS);
      ctx.clip();
      paintMaterial(ctx, w, color, skin, { ...env, layer: 'live' });
    }
    ctx.restore();
    return true;
  }

  /** Pose signée des matières épiques et légendaires ; célébration du parfait (légendaires). */
  private skinPlacementFx(placed: Block, floor: number, perfect: boolean): void {
    const fx = SKIN_FX[this.skin as MaterialSkin];
    if (!fx) return;
    const y = (floor + 1) * BLOCK_HEIGHT;
    const left = placed.left / MILLI;
    const w = placed.width / MILLI;
    if (fx.place) {
      const pl = fx.place;
      const half = Math.ceil(pl.count / 2);
      this.burst(pl.kind, left + 4, y, half, pl.colors[0]!, pl.speed, pl.colors);
      this.burst(pl.kind, left + w - 4, y, pl.count - half, pl.colors[0]!, pl.speed, pl.colors);
    }
    if (perfect && fx.perfect && !this.reducedMotion) {
      const pf = fx.perfect;
      this.burst(pf.kind, left + w / 2, y, pf.count, pf.colors[0]!, 220, pf.colors);
      this.rings.push({ x: left + w / 2, y: y + 6, w: w * 1.15, age: -0.08, color: pf.ring });
      if (this.rings.length > MAX_RINGS) this.rings.shift();
    }
  }

  /** Ombre portée par `above` sur le haut de `below`, limitée à leur intersection. */
  private contactShadow(below: Block, above: Block, belowTop: number): void {
    const l = Math.max(below.left, above.left) / MILLI;
    const r = Math.min(below.left + below.width, above.left + above.width) / MILLI;
    if (r <= l) return;
    const { ctx } = this;
    ctx.save();
    roundedRect(ctx, below.left / MILLI, belowTop, below.width / MILLI, BLOCK_HEIGHT, RADIUS);
    ctx.clip();
    ctx.fillStyle = 'rgba(20,20,50,0.16)';
    ctx.fillRect(l, belowTop, r - l, 5);
    ctx.restore();
  }

  private addDebris(b: Block, floor: number, side: -1 | 0 | 1, ox = b.left / MILLI): void {
    if (this.debris.length >= (this.quality === 'light' ? 6 : MAX_DEBRIS)) this.debris.shift();
    const w = b.width / MILLI;
    const push = side === 0 ? 0 : side * (40 + 60 * (w / (START_WIDTH / MILLI)));
    this.debris.push({
      x: b.left / MILLI, y: (floor + 1) * BLOCK_HEIGHT, w, vx: push, vy: 60,
      rot: 0, vr: side === 0 ? 0.6 : side * 2.2, age: 0, color: this.colorFor(floor), floor, ox,
    });
  }

  /** Étoiles d'un parfait, aux deux bords du bloc posé (couleurs de l'univers). */
  private addSparks(b: Block, floor: number, count: number): void {
    const y = (floor + 1) * BLOCK_HEIGHT;
    const colors = this.theme.sparks;
    for (let i = 0; i < count; i++) {
      const left = i % 2 === 0;
      this.burst('star', left ? b.left / MILLI : (b.left + b.width) / MILLI, y - BLOCK_HEIGHT * this.cos.next(), 1, colors[i % colors.length]!, 260);
    }
  }
}
