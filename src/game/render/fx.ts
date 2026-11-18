/**
 * Effets « Pop Choc » (V5) : onomatopées de BD, particules en réserve bornée, rayons de Fièvre,
 * bulle du Bouclier, champ de l'Aimant, absurdités (canard, ovni, pigeon) et pictogrammes.
 *
 * Tout est décoratif : rien ici ne lit ni n'écrit la simulation. La variété vient d'un tirage
 * cosmétique séparé (`CosmeticRng`), jamais du PRNG de la partie.
 */
import { css, roundedRect, type Rgb } from './themes';

const TAU = Math.PI * 2;

/** Tirage cosmétique (xorshift32), graine indépendante de la partie. */
export class CosmeticRng {
  private s: number;
  constructor(seed: number = (Math.random() * 0xffffffff) >>> 0) {
    this.s = seed >>> 0 || 0x2545f491;
  }
  next(): number {
    let x = this.s;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.s = x >>> 0;
    return this.s / 4294967296;
  }
  pick<T>(list: readonly T[]): T {
    return list[Math.floor(this.next() * list.length)]!;
  }
  range(min: number, max: number): number {
    return min + (max - min) * this.next();
  }
}

// ——— Onomatopées ———

export interface Word {
  text: string;
  color: Rgb;
  /** Position écran (px CSS). */
  x: number;
  y: number;
  rot: number;
  size: number;
  age: number;
  life: number;
  /** Ordre d'importance : un mot plus fort remplace les plus faibles. */
  weight: number;
}
export const MAX_WORDS = 3;

export const WORDS = {
  perfect: ['PILE !', 'PAF !', 'NET !'],
  streak2: ['ENCORE !', 'BIS !', 'TOP !'],
  streak3: ['SUPER !', 'GÉNIAL !', 'WOUAH !', 'ÉNORME !'],
  snap: ['CLAC !', 'CLIC !', 'ZIP !'],
  crash: ['CRASH !', 'BADABOUM !', 'PATATRAS !'],
  saved: ['BOING !'],
  fever: ['FIÈVRE !'],
} as const;

/** Échelle « pop » : jaillit (×1,3), revient à 1, puis s'efface sur le dernier tiers. */
export function wordScale(age: number, motion: boolean): number {
  if (!motion) return 1;
  if (age < 0.09) return 0.4 + (age / 0.09) * 0.9;
  if (age < 0.2) return 1.3 - ((age - 0.09) / 0.11) * 0.3;
  return 1;
}

export function wordAlpha(w: Word): number {
  const fadeFrom = w.life * 0.68;
  return w.age < fadeFrom ? 1 : Math.max(0, 1 - (w.age - fadeFrom) / (w.life - fadeFrom));
}

/** Lettrage BD : ombre portée franche, contour d'encre épais, remplissage vif. */
export function drawWord(ctx: CanvasRenderingContext2D, w: Word, font: string, motion: boolean): void {
  const a = wordAlpha(w);
  if (a <= 0) return;
  const s = wordScale(w.age, motion);
  const rise = motion ? Math.min(w.age, 0.6) * 18 : 0;
  ctx.save();
  ctx.globalAlpha = a;
  ctx.translate(w.x, w.y - rise);
  ctx.rotate(motion ? w.rot : 0);
  ctx.scale(s, s);
  ctx.font = `900 ${w.size}px ${font}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.fillStyle = 'rgba(20,18,46,0.55)';
  ctx.fillText(w.text, w.size * 0.07, w.size * 0.09);
  ctx.lineWidth = Math.max(4, w.size * 0.2);
  ctx.strokeStyle = '#1b1a3a';
  ctx.strokeText(w.text, 0, 0);
  ctx.fillStyle = css(w.color);
  ctx.fillText(w.text, 0, 0);
  // Reflet du haut des lettres : plastique brillant.
  ctx.globalAlpha = a * 0.35;
  ctx.fillStyle = '#ffffff';
  ctx.save();
  ctx.beginPath();
  ctx.rect(-w.size * 6, -w.size, w.size * 12, w.size * 0.42);
  ctx.clip();
  ctx.fillText(w.text, 0, 0);
  ctx.restore();
  ctx.restore();
}

// ——— Particules ———

export type ParticleKind = 'star' | 'dust' | 'ember' | 'shard' | 'feather' | 'spark';
export interface Particle {
  alive: boolean;
  kind: ParticleKind;
  /** Monde : x en unités, y en unités depuis le sol. */
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  size: number;
  age: number;
  life: number;
  color: Rgb;
  /** Gravité relative (1 = normale, négative = monte). */
  gravity: number;
}

/** Réserve préallouée : aucune allocation pendant la partie. */
export class ParticlePool {
  readonly items: Particle[];
  private cursor = 0;
  alive = 0;
  constructor(readonly capacity: number) {
    this.items = Array.from({ length: capacity }, () => ({
      alive: false, kind: 'spark' as ParticleKind, x: 0, y: 0, vx: 0, vy: 0, rot: 0, vr: 0, size: 1, age: 0, life: 1,
      color: [255, 255, 255] as Rgb, gravity: 1,
    }));
  }
  /** Prend une particule libre (ou recycle la plus ancienne) ; `limit` borne le total vivant. */
  spawn(limit: number): Particle | null {
    if (limit <= 0) return null;
    if (this.alive >= Math.min(limit, this.capacity)) {
      // Plein : on recycle la plus vieille plutôt que d'en ajouter.
      let oldest: Particle | null = null;
      for (const p of this.items) if (p.alive && (!oldest || p.age / p.life > oldest.age / oldest.life)) oldest = p;
      return oldest;
    }
    for (let i = 0; i < this.capacity; i++) {
      const p = this.items[(this.cursor + i) % this.capacity]!;
      if (!p.alive) {
        this.cursor = (this.cursor + i + 1) % this.capacity;
        p.alive = true;
        this.alive++;
        return p;
      }
    }
    return null;
  }
  update(dt: number, gravity: number): void {
    let alive = 0;
    for (const p of this.items) {
      if (!p.alive) continue;
      p.age += dt;
      if (p.age >= p.life) {
        p.alive = false;
        continue;
      }
      p.vy -= gravity * p.gravity * dt;
      if (p.kind === 'feather' || p.kind === 'dust') {
        p.vx *= 1 - Math.min(1, dt * 2.2);
        p.vy *= 1 - Math.min(1, dt * 1.6);
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
      alive++;
    }
    this.alive = alive;
  }
  clear(): void {
    for (const p of this.items) p.alive = false;
    this.alive = 0;
  }
}

/** Étoile à 5 branches (centrée sur l'origine). */
export function starPath(ctx: CanvasRenderingContext2D, r: number): void {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const rr = i % 2 === 0 ? r : r * 0.45;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  ctx.closePath();
}

export function drawParticle(ctx: CanvasRenderingContext2D, p: Particle): void {
  const k = 1 - p.age / p.life;
  ctx.globalAlpha = Math.max(0, Math.min(1, k * 1.4));
  ctx.rotate(p.rot);
  switch (p.kind) {
    case 'star':
      starPath(ctx, p.size * (0.6 + 0.4 * k));
      ctx.fillStyle = css(p.color);
      ctx.fill();
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = '#1b1a3a';
      ctx.stroke();
      break;
    case 'dust':
      ctx.beginPath();
      ctx.arc(0, 0, p.size * (1.4 - 0.6 * k), 0, TAU);
      ctx.fillStyle = css(p.color, 0.75);
      ctx.fill();
      break;
    case 'ember':
      ctx.fillStyle = css(p.color);
      ctx.fillRect(-p.size / 2, -p.size, p.size, p.size * 2);
      break;
    case 'shard':
      ctx.beginPath();
      ctx.moveTo(0, -p.size);
      ctx.lineTo(p.size * 0.7, p.size * 0.6);
      ctx.lineTo(-p.size * 0.6, p.size * 0.4);
      ctx.closePath();
      ctx.fillStyle = css(p.color, 0.8);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = 1;
      ctx.stroke();
      break;
    case 'feather':
      ctx.beginPath();
      ctx.ellipse(0, 0, p.size, p.size * 0.38, 0, 0, TAU);
      ctx.fillStyle = css(p.color);
      ctx.fill();
      break;
    default:
      roundedRect(ctx, -p.size / 2, -p.size / 2, p.size, p.size, p.size * 0.3);
      ctx.fillStyle = css(p.color);
      ctx.fill();
  }
}

// ——— Fièvre ———

/** Rayons de BD qui tournent derrière la tour (fond), en alternance clair et transparent. */
export function drawSunburst(ctx: CanvasRenderingContext2D, cx: number, cy: number, radius: number, angle: number, color: Rgb, alpha: number): void {
  if (alpha <= 0) return;
  const rays = 14;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = css(color);
  ctx.translate(cx, cy);
  ctx.rotate(angle);
  for (let i = 0; i < rays; i++) {
    const a0 = (i / rays) * TAU;
    const a1 = a0 + (TAU / rays) * 0.5;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(a0) * radius, Math.sin(a0) * radius);
    ctx.lineTo(Math.cos(a1) * radius, Math.sin(a1) * radius);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

// ——— Bouclier ———

/**
 * Bulle du Bouclier au-dessus de la base (repère monde) : arc translucide qui couvre la zone de
 * jeu, motif d'alvéoles discret. `charge` (0-1) = étages restants / durée.
 */
export function drawShieldDome(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, alpha: number, t: number, charge: number, motion: boolean): void {
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  const cx = x + w / 2;
  const pulse = motion ? 1 + Math.sin(t * 4) * 0.015 : 1;
  ctx.beginPath();
  ctx.ellipse(cx, y, (w / 2) * pulse, h * pulse, 0, Math.PI, TAU);
  const g = ctx.createLinearGradient(0, y - h, 0, y);
  g.addColorStop(0, 'rgba(120,255,214,0.10)');
  g.addColorStop(1, 'rgba(72,220,170,0.28)');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = `rgba(72,220,170,${0.55 + 0.35 * charge})`;
  ctx.stroke();
  // Alvéoles : quelques arcs intérieurs (lus comme une matière, pas comme du bruit).
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  for (let i = 1; i <= 3; i++) {
    ctx.beginPath();
    ctx.ellipse(cx, y, (w / 2) * (1 - i * 0.18), h * (1 - i * 0.18), 0, Math.PI, TAU);
    ctx.stroke();
  }
  // Reflet.
  ctx.beginPath();
  ctx.ellipse(cx - w * 0.22, y - h * 0.72, w * 0.08, h * 0.08, -0.5, 0, TAU);
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.fill();
  ctx.restore();
}

// ——— Aimant ———

/**
 * Champ de l'Aimant entre le bloc mobile et la base (repère monde). Lignes d'arc qui ondulent ;
 * plus le bloc est proche de la zone de collage, plus elles sont vives.
 */
export function drawMagnetField(ctx: CanvasRenderingContext2D, ax: number, ay: number, bx: number, by: number, strength: number, t: number, motion: boolean): void {
  if (strength <= 0) return;
  ctx.save();
  ctx.lineWidth = 2;
  ctx.setLineDash([5, 5]);
  ctx.lineDashOffset = motion ? -t * 40 : 0;
  ctx.strokeStyle = `rgba(255,72,120,${0.25 + 0.6 * strength})`;
  for (const bend of [-10, 0, 10]) {
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.quadraticCurveTo((ax + bx) / 2 + bend, (ay + by) / 2, bx, by);
    ctx.stroke();
  }
  ctx.restore();
}

// ——— Absurdités ———

/** Canard en plastique géant (fond du ciel). Taille de référence : 1 = ~60 px. */
export function drawDuck(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, t: number, motion: boolean): void {
  ctx.save();
  ctx.translate(x, y + (motion ? Math.sin(t * 3) * 4 : 0));
  ctx.scale(s, s);
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#1b1a3a';
  // Corps.
  ctx.beginPath();
  ctx.ellipse(0, 0, 34, 20, 0, 0, TAU);
  ctx.fillStyle = '#ffd23f';
  ctx.fill();
  ctx.stroke();
  // Queue.
  ctx.beginPath();
  ctx.moveTo(-30, -6);
  ctx.lineTo(-44, -18);
  ctx.lineTo(-30, 4);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Tête.
  ctx.beginPath();
  ctx.arc(22, -22, 15, 0, TAU);
  ctx.fill();
  ctx.stroke();
  // Bec.
  ctx.beginPath();
  ctx.ellipse(38, -19, 9, 5, 0.1, 0, TAU);
  ctx.fillStyle = '#ff8a3d';
  ctx.fill();
  ctx.stroke();
  // Œil.
  ctx.beginPath();
  ctx.arc(26, -26, 3, 0, TAU);
  ctx.fillStyle = '#1b1a3a';
  ctx.fill();
  ctx.restore();
}

/** Petit ovni (soucoupe, dôme, faisceau optionnel vers le bas sur `beam` unités). */
export function drawUfo(ctx: CanvasRenderingContext2D, x: number, y: number, beam: number, t: number): void {
  ctx.save();
  ctx.translate(x, y);
  if (beam > 0) {
    const g = ctx.createLinearGradient(0, 0, 0, beam);
    g.addColorStop(0, 'rgba(160,255,120,0.55)');
    g.addColorStop(1, 'rgba(160,255,120,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-8, 4);
    ctx.lineTo(8, 4);
    ctx.lineTo(22, beam);
    ctx.lineTo(-22, beam);
    ctx.closePath();
    ctx.fill();
  }
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#1b1a3a';
  ctx.beginPath();
  ctx.ellipse(0, -6, 9, 8, 0, Math.PI, TAU);
  ctx.fillStyle = 'rgba(180,230,255,0.9)';
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(0, 0, 22, 7, 0, 0, TAU);
  ctx.fillStyle = '#9aa3c7';
  ctx.fill();
  ctx.stroke();
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath();
    ctx.arc(i * 11, 1, 2.2, 0, TAU);
    ctx.fillStyle = Math.floor(t * 6 + i) % 2 === 0 ? '#ffe066' : '#ff5e6c';
    ctx.fill();
  }
  ctx.restore();
}

/** Pigeon perché (ou en vol si `flap` > 0), orienté vers `dir` (1 droite, -1 gauche). */
export function drawPigeon(ctx: CanvasRenderingContext2D, x: number, y: number, dir: 1 | -1, flap: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(dir, 1);
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = '#1b1a3a';
  ctx.beginPath();
  ctx.ellipse(0, -6, 8, 5.5, -0.2, 0, TAU);
  ctx.fillStyle = '#a9b0c8';
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(7, -11, 3.6, 0, TAU);
  ctx.fillStyle = '#7d86a6';
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(10, -11);
  ctx.lineTo(13.5, -10);
  ctx.lineTo(10, -9);
  ctx.fillStyle = '#ff9f43';
  ctx.fill();
  // Aile : repliée, ou battante en vol.
  ctx.beginPath();
  if (flap > 0) {
    const a = Math.sin(flap * 30) * 0.9;
    ctx.ellipse(-1, -9, 9, 3, -0.6 - a, 0, TAU);
  } else {
    ctx.ellipse(-2, -6, 6, 3, -0.15, 0, TAU);
  }
  ctx.fillStyle = '#8c94b3';
  ctx.fill();
  ctx.stroke();
  if (flap <= 0) {
    ctx.beginPath();
    ctx.moveTo(-1, -1);
    ctx.lineTo(-1, 2);
    ctx.moveTo(2, -1);
    ctx.lineTo(2, 2);
    ctx.strokeStyle = '#ff9f43';
    ctx.stroke();
  }
  ctx.restore();
}

// ——— Pictogrammes des boosts (HUD du canvas) ———

export type HudIcon = 'ralenti' | 'double' | 'aimant' | 'bouclier' | 'fievre';

/** Pictogramme simple et lisible, centré, taille `s` px. */
export function drawHudIcon(ctx: CanvasRenderingContext2D, icon: HudIcon, x: number, y: number, s: number, color: Rgb): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.lineWidth = Math.max(1.5, s * 0.13);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#1b1a3a';
  ctx.fillStyle = css(color);
  const h = s / 2;
  ctx.beginPath();
  if (icon === 'ralenti') {
    // Sablier.
    ctx.moveTo(-h * 0.7, -h);
    ctx.lineTo(h * 0.7, -h);
    ctx.lineTo(-h * 0.7, h);
    ctx.lineTo(h * 0.7, h);
    ctx.closePath();
  } else if (icon === 'aimant') {
    // Aimant en U.
    ctx.moveTo(-h * 0.75, -h);
    ctx.lineTo(-h * 0.75, h * 0.1);
    ctx.arc(0, h * 0.1, h * 0.75, Math.PI, 0, true);
    ctx.lineTo(h * 0.75, -h);
    ctx.lineTo(h * 0.3, -h);
    ctx.lineTo(h * 0.3, h * 0.1);
    ctx.arc(0, h * 0.1, h * 0.3, 0, Math.PI, false);
    ctx.lineTo(-h * 0.3, -h);
    ctx.closePath();
  } else if (icon === 'bouclier') {
    ctx.moveTo(0, -h);
    ctx.lineTo(h * 0.85, -h * 0.6);
    ctx.quadraticCurveTo(h * 0.8, h * 0.5, 0, h);
    ctx.quadraticCurveTo(-h * 0.8, h * 0.5, -h * 0.85, -h * 0.6);
    ctx.closePath();
  } else if (icon === 'fievre') {
    // Flamme.
    ctx.moveTo(0, -h);
    ctx.quadraticCurveTo(h * 0.9, -h * 0.1, h * 0.55, h * 0.55);
    ctx.quadraticCurveTo(0, h * 1.05, -h * 0.55, h * 0.55);
    ctx.quadraticCurveTo(-h * 0.8, -h * 0.05, 0, -h);
    ctx.closePath();
  } else {
    // ×2 : pastille.
    ctx.arc(0, 0, h * 0.9, 0, TAU);
  }
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}
