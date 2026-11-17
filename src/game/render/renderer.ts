import { FIELD_WIDTH, MILLI, START_WIDTH, type Block, type StepEvent } from '../core';
import {
  BLOCK_HEIGHT,
  createFaceGradient,
  DEFAULT_SKIN,
  drawBlock,
  RADIUS,
  type DrawSkinId,
} from './blocks';
import {
  css,
  getTheme,
  haloFor,
  mix,
  roundedRect,
  skyAt,
  tierIndex,
  TIER_FLOORS,
  type DecorItem,
  type Rgb,
  type Theme,
} from './themes';

export { BLOCK_HEIGHT, reliefParts, SKIN_IDS, type ReliefParts, type SkinId } from './blocks';
/** Bornes des effets : jamais plus d'objets que ça, quelle que soit la série. */
export const MAX_DEBRIS = 16;
export const MAX_SPARKS = 48;
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
}

interface Debris { x: number; y: number; w: number; vx: number; vy: number; rot: number; vr: number; age: number; color: Rgb; floor: number }
interface Spark { x: number; y: number; vx: number; vy: number; age: number; life: number; color: Rgb; rot: number }

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
  private landing = 0;
  private landingFloor = -1;
  private lastNow: number | null = null;
  private readonly debris: Debris[] = [];
  private readonly sparks: Spark[] = [];
  private readonly gradients = new Map<string, CanvasGradient>();
  /** Ciel de l'image courante (haut, bas) et échelle, pour choisir le contour selon le fond réel. */
  private skyTop: Rgb = [255, 255, 255];
  private skyBottom: Rgb = [255, 255, 255];
  private frameScale = 1;
  /** Palier mémorisé par élément de décor (borné aux éléments proches de l'écran). */
  private readonly decorTiers = new Map<number, { tier: number; born: number }>();
  private decorDrawn = 0;
  private seed = 0x9e3779b9;

  private skin: DrawSkinId;

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
  }

  get skinId(): DrawSkinId { return this.skin; }

  get debrisCount(): number { return this.debris.length; }
  get sparkCount(): number { return this.sparks.length; }
  /** Éléments de décor dessinés à la dernière image (borné par MAX_DECOR). */
  get decorCount(): number { return this.decorDrawn; }
  get gradientCacheSize(): number { return this.gradients.size; }
  get decorMemorySize(): number { return this.decorTiers.size; }
  get themeName(): string { return this.theme.name; }
  get backingSize(): { width: number; height: number; dpr: number } {
    return { width: this.canvas.width, height: this.canvas.height, dpr: this.dpr };
  }

  setTheme(theme: Theme): void {
    this.theme = theme;
    this.gradients.clear();
  }

  setSkin(skin: DrawSkinId): void {
    this.skin = skin;
    this.gradients.clear();
  }

  /** Ajuste la résolution interne à la taille CSS × devicePixelRatio. Renvoie true si changé. */
  resize(cssWidth: number, cssHeight: number, devicePixelRatio: number): boolean {
    const dpr = Math.min(Math.max(devicePixelRatio || 1, 1), 3);
    const w = Math.max(1, Math.round(cssWidth * dpr));
    const h = Math.max(1, Math.round(cssHeight * dpr));
    this.cssW = Math.max(1, cssWidth);
    this.cssH = Math.max(1, cssHeight);
    this.dpr = dpr;
    if (this.canvas.width === w && this.canvas.height === h) return false;
    this.canvas.width = w;
    this.canvas.height = h;
    return true;
  }

  /** Événement de simulation → effets visuels bornés. Renvoie le nom du palier atteint, s'il y en a un. */
  onEvent(event: StepEvent): string | null {
    if (event.kind === 'missed') {
      this.addDebris(event.moving, event.floor, 0);
      if (!this.reducedMotion) this.trauma = Math.min(1, this.trauma + 0.65);
      return null;
    }
    this.landing = 1;
    this.landingFloor = event.floor;
    if (event.cut) this.addDebris(event.cut, event.floor, event.placed.left > event.cut.left ? -1 : 1);
    if (event.perfect) {
      this.flash = 1;
      this.ripple = this.reducedMotion ? 0 : 1;
      this.flashFloor = event.floor;
      this.streakValue = event.perfectStreak;
      this.streakLabel = event.perfectStreak >= 2 ? 1 : 0;
      if (!this.reducedMotion) this.addSparks(event.placed, event.floor, 8 + Math.min(event.perfectStreak * 2, 16));
    }
    const tier = (TIER_FLOORS as readonly number[]).indexOf(event.floor);
    if (tier > 0) {
      this.milestoneName = this.theme.tiers[tier as 1 | 2 | 3].name;
      this.milestone = 1;
      return this.milestoneName;
    }
    return null;
  }

  draw(view: ViewState, now: number): void {
    const dt = this.lastNow === null ? 0 : Math.min((now - this.lastNow) / 1000, 0.1);
    this.lastNow = now;
    const t = now / 1000;
    const motion = !this.reducedMotion;
    const { ctx, dpr, theme } = this;
    const scale = this.scale();
    const viewH = this.cssH / scale;
    const offsetX = (this.cssW - FIELD_U * scale) / 2;
    const groundY = this.cssH * GROUND_FRAC;
    this.update(dt, view, scale, groundY);

    let shakeX = 0;
    let shakeY = 0;
    if (this.trauma > 0 && motion) {
      const s = this.trauma * this.trauma * 10;
      shakeX = s * Math.sin(now * 0.047);
      shakeY = s * Math.sin(now * 0.061);
    }

    // 1. Ciel : interpolé en continu selon la hauteur atteinte.
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const sky = skyAt(theme, this.height);
    this.skyTop = sky.top;
    this.skyBottom = sky.bottom;
    this.frameScale = scale;
    const g = ctx.createLinearGradient(0, 0, 0, this.cssH);
    g.addColorStop(0, css(sky.top));
    g.addColorStop(1, css(sky.bottom));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.cssW, this.cssH);

    // 2. Décor en parallaxe : le style de chaque élément dépend de la hauteur où il apparaît.
    this.drawDecor(scale, groundY, t, motion, tierIndex(Math.max(0, view.stack.length - 1)));

    // 3. Sol thématique sous l'étage 0 (repère écran : le décor a changé la transformation).
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const groundTop = groundY + this.camera * scale + shakeY;
    if (groundTop < this.cssH) {
      ctx.fillStyle = css(theme.ground.body);
      ctx.fillRect(0, groundTop, this.cssW, this.cssH - groundTop);
      ctx.fillStyle = css(theme.ground.top);
      ctx.fillRect(0, groundTop, this.cssW, Math.min(8, this.cssH - groundTop));
    }

    // 4. Monde : x en unités, y vers le haut depuis le sol.
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * (offsetX + shakeX), 0);
    const yScreen = (y: number) => (groundY - (y - this.camera) * scale + shakeY) / scale;
    const bottomY = this.camera - (this.cssH - groundY) / scale;
    const firstVisible = Math.max(0, Math.floor(bottomY / BLOCK_HEIGHT) - 1);
    const lastVisible = Math.min(view.stack.length, Math.ceil((bottomY + viewH) / BLOCK_HEIGHT) + 1);

    for (let i = firstVisible; i < lastVisible; i++) {
      const b = view.stack[i]!;
      const top = yScreen((i + 1) * BLOCK_HEIGHT);
      let lift = 0;
      if (i === this.landingFloor && this.landing > 0 && motion) lift = this.landing * this.landing * 5;
      this.block(b.left / MILLI, top - lift, b.width / MILLI, this.colorFor(i), 1, i);
      // Ombre de contact du bloc du dessus, limitée à l'intersection (jamais plus large).
      const above = i + 1 < view.stack.length ? view.stack[i + 1]! : view.moving;
      if (above) this.contactShadow(b, above, top);
    }

    // Parfait : la face s'illumine (dans le bloc) ; l'onde extérieure s'efface en 0,45 s.
    if (this.flash > 0 && this.flashFloor < view.stack.length) {
      const b = view.stack[this.flashFloor]!;
      const x = b.left / MILLI;
      const w = b.width / MILLI;
      const y = yScreen((this.flashFloor + 1) * BLOCK_HEIGHT);
      ctx.fillStyle = css([255, 255, 255], this.flash * 0.55);
      roundedRect(ctx, x, y, w, BLOCK_HEIGHT, RADIUS);
      ctx.fill();
      if (this.ripple > 0) {
        const grow = (1 - this.ripple) * 16;
        // Onde blanche et épaisse : lue comme un éclat, pas comme un cadre de sélection.
        ctx.strokeStyle = css([255, 255, 255], this.ripple * 0.85);
        ctx.lineWidth = 3 * this.ripple + 1;
        roundedRect(ctx, x - grow, y - grow, w + grow * 2, BLOCK_HEIGHT + grow * 2, RADIUS + grow);
        ctx.stroke();
      }
    }

    if (view.moving) {
      const top = yScreen((view.stack.length + 1) * BLOCK_HEIGHT);
      this.block(view.moving.left / MILLI, top, view.moving.width / MILLI, this.colorFor(view.stack.length), 1, view.stack.length);
    }

    for (const d of this.debris) {
      const alpha = this.reducedMotion ? Math.max(0, 1 - d.age / 0.45) : Math.max(0, 1 - d.age / 1.6);
      ctx.save();
      ctx.translate(d.x + d.w / 2, yScreen(d.y) + BLOCK_HEIGHT / 2);
      ctx.rotate(d.rot);
      this.block(-d.w / 2, -BLOCK_HEIGHT / 2, d.w, d.color, alpha, d.floor);
      ctx.restore();
    }

    for (const s of this.sparks) {
      ctx.save();
      ctx.translate(s.x, yScreen(s.y));
      ctx.rotate(s.rot);
      ctx.fillStyle = css(s.color, Math.max(0, 1 - s.age / s.life));
      roundedRect(ctx, -2.5, -2.5, 5, 5, 1.5);
      ctx.fill();
      ctx.restore();
    }

    this.drawHud(view, sky.ink);
  }

  /** true si un effet est encore en cours (le rendu peut alors s'arrêter). */
  get animating(): boolean {
    return this.debris.length > 0 || this.sparks.length > 0 || this.flash > 0 || this.trauma > 0 ||
      this.streakLabel > 0 || this.landing > 0 || this.milestone > 0 || this.ripple > 0 ||
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
    this.cameraTarget = Math.max(0, (len + 1) * BLOCK_HEIGHT - (groundY - ACTIVE_FRAC * this.cssH) / scale);
    const heightTarget = len - 1;
    if (this.reducedMotion) {
      this.camera = this.cameraTarget;
      this.height = heightTarget;
    } else {
      this.camera += (this.cameraTarget - this.camera) * (1 - Math.exp(-dt * 7));
      this.height += (heightTarget - this.height) * (1 - Math.exp(-dt * 2.5));
    }
    this.trauma = Math.max(0, this.trauma - dt * 1.6);
    this.flash = Math.max(0, this.flash - dt * 3.5);
    this.ripple = Math.max(0, this.ripple - dt / 0.45);
    this.landing = Math.max(0, this.landing - dt * 10);
    this.streakLabel = Math.max(0, this.streakLabel - dt * 0.8);
    this.milestone = Math.max(0, this.milestone - dt / 2.4);

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
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const s = this.sparks[i]!;
      s.age += dt;
      s.vy -= GRAVITY * 0.5 * dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.rot += dt * 6;
      if (s.age >= s.life) this.sparks.splice(i, 1);
    }
  }

  /**
   * Décor en parallaxe. Chaque élément garde le palier qu'il avait en entrant à l'écran ;
   * au franchissement d'un palier, ceux qui sont au-dessus du bloc actif prennent le nouveau
   * style (fondu de 0,4 s, ou bascule nette en reduced-motion). Pas de retour en arrière.
   */
  private drawDecor(scale: number, groundY: number, t: number, motion: boolean, currentTier: number): void {
    const { ctx, dpr, theme } = this;
    const camP = this.camera * PARALLAX;
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
    for (let k = first; k <= last && drawn < MAX_DECOR; k++) {
      for (let j = 0; j < 2 && drawn < MAX_DECOR; j++) {
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
        const painter = theme.tiers[rec.tier as 0 | 1 | 2 | 3].decor;
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
    const big = Math.round(Math.min(72, this.cssW * 0.17));
    const font = (weight: number, size: number) => `${weight} ${size}px ui-rounded, "SF Pro Rounded", "Nunito", system-ui, sans-serif`;
    // Liseré de la couleur opposée : le texte reste lisible même quand le ciel passe par des
    // tons moyens pendant une transition de palier.
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
    text(String(view.score), top, big, css(ink));
    let line = top + big * 1.08;
    if (this.milestone > 0) {
      text(`Palier : ${this.milestoneName}`, line, Math.round(big * 0.3), css(ink), Math.min(1, this.milestone * 2.5));
      line += big * 0.42;
    }
    if (this.streakLabel > 0) {
      text(`PARFAIT ×${this.streakValue}`, line, Math.round(big * 0.32), css(ink), Math.min(1, this.streakLabel * 1.5));
    }
    if (view.pause !== 'none') {
      ctx.fillStyle = 'rgba(20,20,40,0.6)';
      ctx.fillRect(0, 0, this.cssW, this.cssH);
      ctx.textBaseline = 'middle';
      ctx.font = font(700, Math.round(big * 0.38));
      ctx.fillStyle = '#FFF4DB';
      ctx.fillText(view.pause === 'hidden' ? 'Touchez pour reprendre' : 'Pause', this.cssW / 2, this.cssH / 2);
    }
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

  /** Bloc en relief avec l'apparence courante, strictement contenu dans [x, x + w]. */
  private block(x: number, y: number, w: number, color: Rgb, alpha: number, variant: number): void {
    const frac = Math.min(1, Math.max(0, (y + BLOCK_HEIGHT / 2) * this.frameScale / this.cssH));
    drawBlock(this.ctx, x, y, w, color, {
      skin: this.skin,
      sky: mix(this.skyTop, this.skyBottom, frac),
      alpha,
      gradient: this.faceGradient(color),
      variant,
    });
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

  private addDebris(b: Block, floor: number, side: -1 | 0 | 1): void {
    if (this.debris.length >= MAX_DEBRIS) this.debris.shift();
    const w = b.width / MILLI;
    const push = side === 0 ? 0 : side * (40 + 60 * (w / (START_WIDTH / MILLI)));
    this.debris.push({
      x: b.left / MILLI, y: (floor + 1) * BLOCK_HEIGHT, w, vx: push, vy: 60,
      rot: 0, vr: side === 0 ? 0.6 : side * 2.2, age: 0, color: this.colorFor(floor), floor,
    });
  }

  private addSparks(b: Block, floor: number, count: number): void {
    const y = (floor + 1) * BLOCK_HEIGHT;
    const colors = this.theme.sparks;
    for (let i = 0; i < count; i++) {
      if (this.sparks.length >= MAX_SPARKS) this.sparks.shift();
      const r1 = this.rand();
      const r2 = this.rand();
      const left = r1 < 0.5;
      this.sparks.push({
        x: left ? b.left / MILLI : (b.left + b.width) / MILLI,
        y: y - BLOCK_HEIGHT * r2,
        vx: (left ? -1 : 1) * (60 + 160 * this.rand()),
        vy: 80 + 220 * this.rand(),
        age: 0,
        life: 0.4 + 0.3 * r2,
        color: colors[i % colors.length]!,
        rot: r1 * 6,
      });
    }
  }

  /** Aléa purement visuel, séparé de la simulation. */
  private rand(): number {
    let x = this.seed;
    x ^= x << 13; x >>>= 0;
    x ^= x >>> 17;
    x ^= x << 5; x >>>= 0;
    this.seed = x;
    return x / 4294967296;
  }
}
