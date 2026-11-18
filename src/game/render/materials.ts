/**
 * Matières V6 (« matières vivantes ») : ce qui se dessine **dans** une brique, sous sa face
 * supérieure. Purement décoratif : rien ici ne lit ni n'écrit la simulation.
 *
 * Deux familles de calques :
 * - **vectoriels** (dégradés, formes) : toujours dessinés, partout (y compris les tests) ;
 * - **textures procédurales** générées une fois en mémoire (canvas hors écran) puis répétées en
 *   motif. Elles ne servent que sur un vrai contexte Canvas 2D de navigateur.
 *
 * Mappage : `object` = la texture suit la pièce (bois, marbre…), `world` = la texture est collée
 * à l'espace de la tour, donc **continue d'une brique à l'autre** (Galaxie, Aurore, Abysse).
 * Les légendaires ajoutent une profondeur : leurs plans lointains défilent moins vite que la tour.
 *
 * Animations réduites : chaque matière a une version fixe soignée (temps figé). Qualité basse :
 * les calques secondaires (paillettes, second plan, reflets mobiles) sont retirés.
 */
import { BLOCK_HEIGHT, RADIUS } from './dims';
import { css, darken, lighten, mix, roundedRect, type Rgb } from './color';

const H = BLOCK_HEIGHT;
const TAU = Math.PI * 2;
/** Pixels de texture par unité logique. */
const TEX_SCALE = 2;

/** Ce que la matière sait de la brique et du moment (jamais de la règle du jeu). */
export interface MaterialEnv {
  /** Secondes (ignoré si `motion` est faux : temps figé). */
  readonly t: number;
  readonly motion: boolean;
  /** Qualité complète : calques secondaires permis. */
  readonly full: boolean;
  /** Bord gauche de la brique, unités du monde. */
  readonly wx: number;
  /** Haut de la brique, unités du monde (y vers le bas ; 0 = sol). */
  readonly wy: number;
  /** Origine horizontale de la matière de la pièce (bord gauche du bloc mobile au moment de la pose). */
  readonly ox: number;
  /** Hauteur de caméra (unités), pour la profondeur interne des légendaires. */
  readonly cam: number;
  /** Numéro d'étage (variations stables d'un étage à l'autre). */
  readonly floor: number;
  /**
   * Calques à dessiner : tout (défaut), la base fixe (mise en cache par le renderer) ou seulement
   * la partie vivante (reflet qui glisse, éclat) des matières communes et rares.
   */
  readonly layer?: 'all' | 'base' | 'live';
}

export const STATIC_ENV: MaterialEnv = { t: 0, motion: false, full: true, wx: 0, wy: -H, ox: 0, cam: 0, floor: 0 };

// ——— Hasard stable (visuel seulement) ———

function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Tirage stable par (n, k) dans [0, 1[ (veines, bulles…), indépendant du PRNG de partie. */
export function vary(n: number, k: number): number {
  let x = (Math.imul(n + 1, 0x9e3779b1) ^ Math.imul(k + 7, 0x85ebca6b)) >>> 0;
  x ^= x >>> 15;
  x = Math.imul(x, 0x2c1b3c6d) >>> 0;
  x ^= x >>> 12;
  return (x >>> 0) / 4294967296;
}

/** Bruit de valeur périodique (pavage sans couture). */
class PeriodicNoise {
  private readonly grid: Float32Array;
  constructor(private readonly px: number, private readonly py: number, seed: number) {
    const r = prng(seed);
    this.grid = new Float32Array(px * py);
    for (let i = 0; i < this.grid.length; i++) this.grid[i] = r();
  }
  /** u, v dans [0, 1[ (périodiques). */
  at(u: number, v: number): number {
    const x = u * this.px;
    const y = v * this.py;
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const fx = x - x0;
    const fy = y - y0;
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);
    const ix0 = ((x0 % this.px) + this.px) % this.px;
    const iy0 = ((y0 % this.py) + this.py) % this.py;
    const ix1 = (ix0 + 1) % this.px;
    const iy1 = (iy0 + 1) % this.py;
    const g = this.grid;
    const a = g[iy0 * this.px + ix0]!;
    const b = g[iy0 * this.px + ix1]!;
    const c = g[iy1 * this.px + ix0]!;
    const d = g[iy1 * this.px + ix1]!;
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
  }
}

function fbm(octaves: PeriodicNoise[], u: number, v: number): number {
  let sum = 0;
  let amp = 0.5;
  let norm = 0;
  for (const n of octaves) {
    sum += n.at(u, v) * amp;
    norm += amp;
    amp *= 0.5;
  }
  return sum / norm;
}

const octavesOf = (bx: number, by: number, count: number, seed: number) =>
  Array.from({ length: count }, (_, i) => new PeriodicNoise(bx << i, by << i, seed + i * 101));

/** Cellules de Worley périodiques : distances au premier et au second point (en pixels). */
function worley(w: number, h: number, cells: number, seed: number): (x: number, y: number) => [number, number] {
  const r = prng(seed);
  const cw = w / cells;
  const rows = Math.max(1, Math.round(h / cw));
  const ch = h / rows;
  const pts = new Float32Array(cells * rows * 2);
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cells; i++) {
      pts[(j * cells + i) * 2] = (i + 0.15 + r() * 0.7) * cw;
      pts[(j * cells + i) * 2 + 1] = (j + 0.15 + r() * 0.7) * ch;
    }
  }
  return (x, y) => {
    const ci = Math.floor(x / cw);
    const cj = Math.floor(y / ch);
    let f1 = Infinity;
    let f2 = Infinity;
    for (let dj = -1; dj <= 1; dj++) {
      for (let di = -1; di <= 1; di++) {
        let i = ci + di;
        let j = cj + dj;
        let ox = 0;
        let oy = 0;
        if (i < 0) { i += cells; ox = -w; } else if (i >= cells) { i -= cells; ox = w; }
        if (j < 0) { j += rows; oy = -h; } else if (j >= rows) { j -= rows; oy = h; }
        const k = (j * cells + i) * 2;
        const dx = pts[k]! + ox - x;
        const dy = pts[k + 1]! + oy - y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) f2 = d;
      }
    }
    return [f1, f2];
  };
}

// ——— Textures (canvas hors écran) ———

type TexCanvas = HTMLCanvasElement | OffscreenCanvas;
type Ctx2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

const MAX_TEXTURES = 32;
const textures = new Map<string, TexCanvas | null>();
const patternCache = new WeakMap<object, Map<string, { tex: TexCanvas; p: CanvasPattern | null }>>();
const matrix: DOMMatrix | null = typeof DOMMatrix === 'undefined' ? null : new DOMMatrix();

/** Vrai contexte Canvas 2D de navigateur (les contextes factices des tests n'en sont pas). */
export function isRealContext(ctx: unknown): boolean {
  return (typeof CanvasRenderingContext2D !== 'undefined' && ctx instanceof CanvasRenderingContext2D)
    || (typeof OffscreenCanvasRenderingContext2D !== 'undefined' && ctx instanceof OffscreenCanvasRenderingContext2D);
}

function makeCanvas(w: number, h: number): TexCanvas | null {
  try {
    if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
    if (typeof document !== 'undefined') {
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      return c;
    }
  } catch {
    // Pas de canvas hors écran : les calques de texture sont simplement omis.
  }
  return null;
}

function texture(key: string, w: number, h: number, paint: (x: Ctx2D, w: number, h: number) => void): TexCanvas | null {
  const cached = textures.get(key);
  if (cached !== undefined) return cached;
  const c = makeCanvas(w, h);
  const x = (c?.getContext('2d') ?? null) as Ctx2D | null;
  let out: TexCanvas | null = null;
  if (c && x) {
    try {
      paint(x, w, h);
      out = c;
    } catch {
      out = null;
    }
  }
  if (textures.size >= MAX_TEXTURES) {
    const first = textures.keys().next().value;
    if (first !== undefined) textures.delete(first);
  }
  textures.set(key, out);
  return out;
}

/** Nombre de textures en mémoire (tests de bornes). */
export function textureCount(): number {
  let n = 0;
  for (const t of textures.values()) if (t) n++;
  return n;
}

/** Libère les textures (changement d'apparence, fin de vie du jeu). Les motifs suivent (WeakMap). */
export function releaseTextures(): void {
  textures.clear();
}

function pattern(ctx: CanvasRenderingContext2D, key: string, tex: TexCanvas): CanvasPattern | null {
  let map = patternCache.get(ctx);
  if (!map) {
    map = new Map();
    patternCache.set(ctx, map);
  }
  const entry = map.get(key);
  if (entry && entry.tex === tex) return entry.p;
  let p: CanvasPattern | null = null;
  try {
    p = ctx.createPattern(tex as CanvasImageSource, 'repeat');
  } catch {
    p = null;
  }
  map.set(key, { tex, p });
  return p;
}

type TexSpec = { key: string; w: number; h: number; paint: (x: Ctx2D, w: number, h: number) => void };

/**
 * Remplit la brique (0..w × 0..H, déjà découpée) avec une texture répétée. `tx`, `ty` = point de la
 * texture (en unités) qui tombe sur le coin haut-gauche local. Renvoie false si indisponible.
 */
function fillTex(
  ctx: CanvasRenderingContext2D, w: number, spec: TexSpec, tx: number, ty: number, alpha: number,
  comp: GlobalCompositeOperation = 'source-over', smooth = true,
): boolean {
  if (!matrix || alpha <= 0) return false;
  const tex = texture(spec.key, spec.w, spec.h, spec.paint);
  if (!tex) return false;
  const p = pattern(ctx, spec.key, tex);
  if (!p) return false;
  const tw = spec.w / TEX_SCALE;
  const th = spec.h / TEX_SCALE;
  matrix.a = 1 / TEX_SCALE;
  matrix.b = 0;
  matrix.c = 0;
  matrix.d = 1 / TEX_SCALE;
  matrix.e = -(((tx % tw) + tw) % tw);
  matrix.f = -(((ty % th) + th) % th);
  p.setTransform(matrix);
  const a0 = ctx.globalAlpha;
  const s0 = ctx.imageSmoothingEnabled;
  ctx.globalAlpha = a0 * alpha;
  ctx.globalCompositeOperation = comp;
  if (!smooth) ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = p;
  ctx.fillRect(0, 0, w, H);
  ctx.globalAlpha = a0;
  ctx.globalCompositeOperation = 'source-over';
  ctx.imageSmoothingEnabled = s0;
  return true;
}

/** Dessine un élément aux positions pavées (copie décalée près des bords) : textures sans couture. */
function wrapped(w: number, h: number, x: number, y: number, r: number, draw: (x: number, y: number) => void): void {
  for (const ox of [-w, 0, w]) {
    for (const oy of [-h, 0, h]) {
      if (x + ox + r < 0 || x + ox - r > w || y + oy + r < 0 || y + oy - r > h) continue;
      draw(x + ox, y + oy);
    }
  }
}

function imageFrom(x: Ctx2D, w: number, h: number, pixel: (px: number, py: number, out: Uint8ClampedArray, i: number) => void): void {
  const img = x.createImageData(w, h);
  const d = img.data;
  for (let py = 0; py < h; py++) for (let px = 0; px < w; px++) pixel(px, py, d, (py * w + px) * 4);
  x.putImageData(img, 0, 0);
}

const smoothstep = (a: number, b: number, v: number) => {
  const k = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return k * k * (3 - 2 * k);
};

// Grain fin : points clairs et sombres (gomme, graphite, verre, céramique).
const GRAIN: TexSpec = {
  key: 'grain', w: 128, h: 128,
  paint: (x, w, h) => {
    const r = prng(11);
    imageFrom(x, w, h, (_px, _py, d, i) => {
      const v = r();
      const light = v > 0.5;
      d[i] = d[i + 1] = d[i + 2] = light ? 255 : 0;
      d[i + 3] = Math.round((light ? v - 0.5 : 0.5 - v) * 2 * (light ? 34 : 48));
    });
  },
};

// Veines de marbre (turbulence), sombres et claires.
const MARBLE: TexSpec = {
  key: 'marble', w: 512, h: 256,
  paint: (x, w, h) => {
    const oct = octavesOf(4, 2, 5, 21);
    const fine = octavesOf(8, 4, 3, 77);
    imageFrom(x, w, h, (px, py, d, i) => {
      const u = px / w;
      const v = py / h;
      const turb = fbm(oct, u, v);
      const main = Math.abs(Math.sin((u * 3 + v * 2 + turb * 2.6) * Math.PI));
      const thin = Math.abs(Math.sin((u * 7 - v * 3 + fbm(fine, u, v) * 3.2) * Math.PI));
      const core = 1 - smoothstep(0, 0.05, main);
      const halo = (1 - smoothstep(0.05, 0.3, main)) * 0.38;
      const hair = (1 - smoothstep(0, 0.04, thin)) * 0.5;
      const cloud = smoothstep(0.5, 0.85, turb);
      const dark = Math.max(core * 0.9 + halo, hair);
      if (dark > cloud * 0.5) {
        d[i] = 46; d[i + 1] = 48; d[i + 2] = 70;
        d[i + 3] = Math.round(Math.min(1, dark) * 175);
      } else {
        d[i] = d[i + 1] = d[i + 2] = 255;
        d[i + 3] = Math.round(cloud * 110);
      }
    });
  },
};

// Bois : fil horizontal ondulé, pores et nœuds.
const WOOD: TexSpec = {
  key: 'wood', w: 512, h: 256,
  paint: (x, w, h) => {
    const oct = octavesOf(3, 2, 4, 5);
    const knots = [[0.18, 0.3, 26], [0.62, 0.72, 34], [0.86, 0.22, 18]] as const;
    imageFrom(x, w, h, (px, py, d, i) => {
      const u = px / w;
      const v = py / h;
      let warp = fbm(oct, u, v) * 0.9 + Math.sin(u * TAU * 2) * 0.05;
      for (const [kx, ky, kr] of knots) {
        const dx = (px - kx * w) / 2.6;
        const dy = py - ky * h;
        const dist = Math.sqrt(dx * dx + dy * dy);
        warp += Math.max(0, 1 - dist / (kr * 2.2)) * (dy >= 0 ? 0.35 : -0.35);
      }
      const ring = (v * 14 + warp * 3) % 1;
      const line = smoothstep(0.82, 0.97, ring) * (1 - smoothstep(0.97, 1, ring));
      const late = smoothstep(0.3, 0.75, ring) * 0.35;
      d[i] = 70; d[i + 1] = 38; d[i + 2] = 18;
      d[i + 3] = Math.round(Math.min(1, line * 0.85 + late) * 150);
    });
    // Pores : tirets fins le long du fil.
    const r = prng(9);
    x.fillStyle = 'rgba(60,30,12,0.35)';
    for (let k = 0; k < 220; k++) x.fillRect(r() * w, r() * h, 3 + r() * 9, 1);
    // Nœuds : anneaux sombres.
    for (const [kx, ky, kr] of knots) {
      for (let ring = 1; ring <= 4; ring++) {
        x.strokeStyle = `rgba(60,28,10,${0.5 - ring * 0.08})`;
        x.lineWidth = 1.6;
        x.beginPath();
        x.ellipse(kx * w, ky * h, (kr * ring) / 2.4, (kr * ring) / 5, 0, 0, TAU);
        x.stroke();
      }
      x.fillStyle = 'rgba(50,22,8,0.55)';
      x.beginPath();
      x.ellipse(kx * w, ky * h, kr / 3, kr / 7, 0, 0, TAU);
      x.fill();
    }
  },
};

// Craquelure de glaçure (cellules de Worley).
const CRACKLE: TexSpec = {
  key: 'crackle', w: 256, h: 256,
  paint: (x, w, h) => {
    const cells = worley(w, h, 9, 31);
    imageFrom(x, w, h, (px, py, d, i) => {
      const [f1, f2] = cells(px + 0.5, py + 0.5);
      const edge = f2 - f1;
      const crack = 1 - smoothstep(0.4, 2.2, edge);
      const shine = (1 - smoothstep(2.2, 4, edge)) * 0.25;
      if (crack > 0.05) {
        d[i] = 30; d[i + 1] = 28; d[i + 2] = 40; d[i + 3] = Math.round(crack * 120);
      } else {
        d[i] = d[i + 1] = d[i + 2] = 255; d[i + 3] = Math.round(shine * 120);
      }
    });
  },
};

// Lave : croûte opaque fendue (fentes transparentes) et magma lumineux.
const LAVA_CRUST: TexSpec = {
  key: 'lava-crust', w: 512, h: 256,
  paint: (x, w, h) => {
    const cells = worley(w, h, 7, 47);
    const oct = octavesOf(8, 4, 3, 3);
    imageFrom(x, w, h, (px, py, d, i) => {
      const [f1, f2] = cells(px + 0.5, py + 0.5);
      const edge = f2 - f1;
      const open = 1 - smoothstep(1.2, 6, edge);
      const rock = 0.65 + fbm(oct, px / w, py / h) * 0.6 - Math.min(1, f1 / 60) * 0.25;
      d[i] = Math.round(42 * rock);
      d[i + 1] = Math.round(24 * rock);
      d[i + 2] = Math.round(20 * rock);
      d[i + 3] = Math.round((1 - open) * 255);
    });
  },
};
const MAGMA: TexSpec = {
  key: 'magma', w: 256, h: 128,
  paint: (x, w, h) => {
    const oct = octavesOf(4, 2, 4, 61);
    imageFrom(x, w, h, (px, py, d, i) => {
      const n = fbm(oct, px / w, py / h);
      const k = smoothstep(0.25, 0.85, n);
      d[i] = 255;
      d[i + 1] = Math.round(70 + k * 170);
      d[i + 2] = Math.round(20 + k * 90);
      d[i + 3] = 255;
    });
  },
};

// Nébuleuse (plan profond de la Galaxie) : nuages colorés, bandes de poussière, poussière d'étoiles.
const NEBULA: TexSpec = {
  key: 'nebula', w: 512, h: 512,
  paint: (x, w, h) => {
    x.fillStyle = 'rgb(9,7,26)';
    x.fillRect(0, 0, w, h);
    const r = prng(1234);
    const palette: Rgb[] = [[110, 50, 200], [40, 90, 220], [210, 60, 170], [40, 170, 190], [255, 120, 90], [150, 90, 255]];
    x.globalCompositeOperation = 'lighter';
    for (let k = 0; k < 34; k++) {
      const cx = r() * w;
      const cy = r() * h;
      const rad = 50 + r() * 150;
      const c = palette[Math.floor(r() * palette.length)]!;
      const a = 0.1 + r() * 0.22;
      wrapped(w, h, cx, cy, rad, (px, py) => {
        const g = x.createRadialGradient(px, py, 0, px, py, rad);
        g.addColorStop(0, `rgba(${c[0]},${c[1]},${c[2]},${a})`);
        g.addColorStop(0.55, `rgba(${c[0]},${c[1]},${c[2]},${a * 0.35})`);
        g.addColorStop(1, `rgba(${c[0]},${c[1]},${c[2]},0)`);
        x.fillStyle = g;
        x.fillRect(px - rad, py - rad, rad * 2, rad * 2);
      });
    }
    x.globalCompositeOperation = 'source-over';
    for (let k = 0; k < 14; k++) {
      const cx = r() * w;
      const cy = r() * h;
      const rad = 30 + r() * 80;
      const angle = r() * Math.PI;
      wrapped(w, h, cx, cy, rad * 2.5, (px, py) => {
        x.save();
        x.translate(px, py);
        x.rotate(angle);
        x.scale(2.4, 0.55);
        const g = x.createRadialGradient(0, 0, 0, 0, 0, rad);
        g.addColorStop(0, 'rgba(4,2,12,0.55)');
        g.addColorStop(1, 'rgba(4,2,12,0)');
        x.fillStyle = g;
        x.fillRect(-rad, -rad, rad * 2, rad * 2);
        x.restore();
      });
    }
    for (let k = 0; k < 420; k++) {
      x.fillStyle = `rgba(255,255,255,${0.12 + r() * 0.35})`;
      x.fillRect(r() * w, r() * h, 1, 1);
    }
  },
};

function starsSpec(key: string, seed: number, count: number, minR: number, maxR: number, glints: number): TexSpec {
  return {
    key, w: 256, h: 256,
    paint: (x, w, h) => {
      const r = prng(seed);
      for (let k = 0; k < count; k++) {
        const cx = r() * w;
        const cy = r() * h;
        const rad = minR + r() ** 2 * (maxR - minR);
        const tint = r();
        const col = tint < 0.15 ? '255,214,170' : tint < 0.3 ? '180,210,255' : '255,255,255';
        const a = 0.55 + r() * 0.45;
        wrapped(w, h, cx, cy, rad * 6, (px, py) => {
          const g = x.createRadialGradient(px, py, 0, px, py, rad * 2.2);
          g.addColorStop(0, `rgba(${col},${a})`);
          g.addColorStop(0.35, `rgba(${col},${a * 0.6})`);
          g.addColorStop(1, `rgba(${col},0)`);
          x.fillStyle = g;
          x.fillRect(px - rad * 2.2, py - rad * 2.2, rad * 4.4, rad * 4.4);
          if (k < glints) {
            x.strokeStyle = `rgba(${col},${a * 0.6})`;
            x.lineWidth = 0.7;
            x.beginPath();
            x.moveTo(px - rad * 5, py);
            x.lineTo(px + rad * 5, py);
            x.moveTo(px, py - rad * 5);
            x.lineTo(px, py + rad * 5);
            x.stroke();
          }
        });
      }
    },
  };
}
const STARS_FAR = starsSpec('stars-far', 77, 150, 0.45, 1.1, 0);
const STARS_NEAR = starsSpec('stars-near', 501, 26, 1, 2.2, 7);

// Aurore : rideaux verts et violets qui ondulent (pavage horizontal).
const AURORA: TexSpec = {
  key: 'aurora', w: 512, h: 256,
  paint: (x, w, h) => {
    const oct = octavesOf(6, 1, 3, 808);
    for (let px = 0; px < w; px += 2) {
      const u = px / w;
      const fold = fbm(oct, u, 0.5);
      const top = h * (0.16 + 0.12 * Math.sin(u * TAU * 2 + 1.3) + 0.08 * Math.sin(u * TAU * 5));
      const len = h * (0.42 + fold * 0.38);
      const bright = 0.35 + 0.65 * smoothstep(0.3, 0.75, fold);
      const g = x.createLinearGradient(0, top, 0, top + len);
      g.addColorStop(0, `rgba(190,110,255,${0.0})`);
      g.addColorStop(0.08, `rgba(190,110,255,${0.55 * bright})`);
      g.addColorStop(0.3, `rgba(80,255,170,${0.9 * bright})`);
      g.addColorStop(0.75, `rgba(40,220,190,${0.35 * bright})`);
      g.addColorStop(1, 'rgba(40,220,190,0)');
      x.fillStyle = g;
      x.fillRect(px, top, 2, len);
    }
  },
};

// Caustiques (reflets de lumière sous l'eau) : filaments lumineux courbes (bruit à crêtes).
const CAUSTICS: TexSpec = {
  key: 'caustics', w: 256, h: 256,
  paint: (x, w, h) => {
    const a = octavesOf(3, 3, 3, 909);
    const b = octavesOf(5, 5, 2, 313);
    imageFrom(x, w, h, (px, py, d, i) => {
      const u = px / w;
      const v = py / h;
      const r1 = 1 - Math.abs(2 * fbm(a, u, v) - 1);
      const r2 = 1 - Math.abs(2 * fbm(b, u, v) - 1);
      const bright = Math.max(r1 ** 9, r2 ** 11 * 0.85);
      d[i] = 150; d[i + 1] = 235; d[i + 2] = 255;
      d[i + 3] = Math.round(Math.min(1, bright * 1.4) * 240);
    });
  },
};

// Facettes du cristal : triangles clairs et arêtes.
const FACETS: TexSpec = {
  key: 'facets', w: 256, h: 128,
  paint: (x, w, h) => {
    const cols = 8;
    const rows = 4;
    const cw = w / cols;
    const ch = h / rows;
    const r = prng(4242);
    const jit: [number, number][] = [];
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) jit.push([(r() - 0.5) * cw * 0.6, (r() - 0.5) * ch * 0.6]);
    const pt = (i: number, j: number): [number, number] => {
      const ii = ((i % cols) + cols) % cols;
      const jj = ((j % rows) + rows) % rows;
      const [dx, dy] = jit[jj * cols + ii]!;
      return [i * cw + dx, j * ch + dy];
    };
    for (let j = -1; j <= rows; j++) {
      for (let i = -1; i <= cols; i++) {
        const a = pt(i, j);
        const b = pt(i + 1, j);
        const c = pt(i, j + 1);
        const d = pt(i + 1, j + 1);
        for (const tri of [[a, b, d], [a, d, c]] as const) {
          x.fillStyle = `rgba(255,255,255,${(0.04 + r() * 0.3).toFixed(3)})`;
          x.beginPath();
          x.moveTo(tri[0][0], tri[0][1]);
          x.lineTo(tri[1][0], tri[1][1]);
          x.lineTo(tri[2][0], tri[2][1]);
          x.closePath();
          x.fill();
          x.strokeStyle = 'rgba(255,255,255,0.22)';
          x.lineWidth = 0.8;
          x.stroke();
        }
      }
    }
  },
};

// Circuit imprimé : pistes à angles droits, pastilles, puces.
const CIRCUIT: TexSpec = {
  key: 'circuit', w: 256, h: 128,
  paint: (x, w, h) => {
    const r = prng(2718);
    const step = 8;
    x.lineCap = 'round';
    x.lineJoin = 'round';
    for (let k = 0; k < 22; k++) {
      let px = Math.round((r() * w) / step) * step;
      let py = Math.round((r() * h) / step) * step;
      const pts: [number, number][] = [[px, py]];
      let dir = r() < 0.5 ? 0 : 1;
      for (let s = 0; s < 4; s++) {
        const len = (2 + Math.floor(r() * 5)) * step;
        if (dir === 0) px += r() < 0.5 ? -len : len;
        else py += r() < 0.5 ? -len : len;
        pts.push([px, py]);
        dir = 1 - dir;
      }
      for (const ox of [-w, 0, w]) {
        for (const oy of [-h, 0, h]) {
          x.strokeStyle = 'rgba(232,190,96,0.85)';
          x.lineWidth = 1.6;
          x.beginPath();
          pts.forEach(([a, b], i) => (i === 0 ? x.moveTo(a + ox, b + oy) : x.lineTo(a + ox, b + oy)));
          x.stroke();
          for (const [a, b] of [pts[0]!, pts[pts.length - 1]!]) {
            x.fillStyle = 'rgba(245,210,120,0.95)';
            x.beginPath();
            x.arc(a + ox, b + oy, 2.6, 0, TAU);
            x.fill();
            x.fillStyle = 'rgba(30,50,40,0.9)';
            x.beginPath();
            x.arc(a + ox, b + oy, 1, 0, TAU);
            x.fill();
          }
        }
      }
    }
    for (let k = 0; k < 4; k++) {
      const cx = r() * (w - 40) + 4;
      const cy = r() * (h - 26) + 4;
      x.fillStyle = 'rgba(14,18,22,0.92)';
      x.fillRect(cx, cy, 30, 18);
      x.fillStyle = 'rgba(200,200,210,0.85)';
      for (let p = 0; p < 6; p++) {
        x.fillRect(cx + 2 + p * 5, cy - 3, 2, 3);
        x.fillRect(cx + 2 + p * 5, cy + 18, 2, 3);
      }
      x.fillStyle = 'rgba(255,255,255,0.12)';
      x.fillRect(cx + 2, cy + 2, 26, 3);
    }
  },
};

// Métal brossé (Or) : stries horizontales fines.
const BRUSHED: TexSpec = {
  key: 'brushed', w: 256, h: 64,
  paint: (x, w, h) => {
    const rows = octavesOf(2, 32, 3, 99);
    const r = prng(5);
    imageFrom(x, w, h, (px, py, d, i) => {
      const n = fbm(rows, px / w, py / h);
      const v = (n - 0.5) * 2 + (r() - 0.5) * 0.25;
      const light = v > 0;
      d[i] = d[i + 1] = d[i + 2] = light ? 255 : 40;
      d[i + 3] = Math.round(Math.min(1, Math.abs(v)) * (light ? 70 : 60));
    });
  },
};

// Nacre : voiles pastel tourbillonnants.
const NACRE: TexSpec = {
  key: 'nacre', w: 256, h: 256,
  paint: (x, w, h) => {
    const oct = octavesOf(3, 3, 4, 314);
    const tints: Rgb[] = [[255, 150, 205], [140, 210, 255], [170, 255, 210], [215, 165, 255], [255, 222, 150]];
    imageFrom(x, w, h, (px, py, d, i) => {
      const n = fbm(oct, px / w, py / h);
      const f = (n * 3.2) % 1;
      const k = Math.floor((n * 3.2) % tints.length);
      const a = tints[k]!;
      const b = tints[(k + 1) % tints.length]!;
      d[i] = Math.round(a[0] + (b[0] - a[0]) * f);
      d[i + 1] = Math.round(a[1] + (b[1] - a[1]) * f);
      d[i + 2] = Math.round(a[2] + (b[2] - a[2]) * f);
      d[i + 3] = Math.round(130 + 100 * Math.abs(Math.sin(n * 9)));
    });
  },
};

// Pixel : carreaux 8-bit biseautés (clair en haut à gauche, sombre en bas à droite).
const PIXELS: TexSpec = {
  key: 'pixels', w: 40, h: 40,
  paint: (x) => {
    const r = prng(808);
    for (let j = 0; j < 4; j++) {
      for (let i = 0; i < 4; i++) {
        const px = i * 10;
        const py = j * 10;
        const v = r();
        x.fillStyle = v < 0.25 ? 'rgba(255,255,255,0.16)' : v < 0.5 ? 'rgba(0,0,0,0.12)' : 'rgba(0,0,0,0)';
        x.fillRect(px, py, 10, 10);
        x.fillStyle = 'rgba(255,255,255,0.32)';
        x.fillRect(px, py, 10, 2);
        x.fillRect(px, py, 2, 10);
        x.fillStyle = 'rgba(0,0,0,0.28)';
        x.fillRect(px, py + 8, 10, 2);
        x.fillRect(px + 8, py, 2, 10);
      }
    }
  },
};

// ——— Couleurs de base des matières ———

const GRAPHITE: Rgb = [58, 60, 70];
const GALAXY: Rgb = [22, 18, 58];
const ROCK: Rgb = [52, 30, 24];
const GOLD: Rgb = [226, 178, 64];
const WOOD_TONE: Rgb = [186, 128, 78];
// ——— V7 : papier, mosaïque, vitrail, phénix ———

// Papier : fibres claires et sombres, marbrure douce du papier fait main.
const PAPER: TexSpec = {
  key: 'paper', w: 256, h: 128,
  paint: (x, w, h) => {
    const oct = octavesOf(8, 4, 3, 131);
    imageFrom(x, w, h, (px, py, d, i) => {
      const v = (fbm(oct, px / w, py / h) - 0.5) * 2;
      if (v > 0) {
        d[i] = d[i + 1] = d[i + 2] = 255;
        d[i + 3] = Math.round(v * 110);
      } else {
        d[i] = 96; d[i + 1] = 84; d[i + 2] = 72;
        d[i + 3] = Math.round(-v * 70);
      }
    });
    const r = prng(137);
    x.lineCap = 'round';
    for (let k = 0; k < 240; k++) {
      const fx = r() * w;
      const fy = r() * h;
      const len = 3 + r() * 9;
      const a = r() * Math.PI;
      const bend = (r() - 0.5) * 2;
      const light = r() < 0.6;
      const width = 0.5 + r() * 0.6;
      x.strokeStyle = light ? 'rgba(255,255,255,0.85)' : 'rgba(110,90,70,0.42)';
      x.lineWidth = width;
      wrapped(w, h, fx, fy, len, (cx, cy) => {
        x.beginPath();
        x.moveTo(cx, cy);
        x.quadraticCurveTo(cx + Math.cos(a) * len * 0.5 + bend, cy + Math.sin(a) * len * 0.5, cx + Math.cos(a) * len, cy + Math.sin(a) * len);
        x.stroke();
      });
    }
  },
};

// Mosaïque : tesselles posées à la main (légers décalages), joints sombres, glaçure.
const TILES: TexSpec = {
  key: 'tiles', w: 256, h: 128,
  paint: (x, w, h) => {
    const r = prng(211);
    const cols = 22;
    const rows = 11;
    const cw = w / cols;
    const ch = h / rows;
    x.fillStyle = 'rgba(40,36,48,0.6)';
    x.fillRect(0, 0, w, h);
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const jx = (r() - 0.5) * 1.2;
        const jy = (r() - 0.5) * 1.2;
        const v = r();
        const tx = i * cw + 1.1 + jx;
        const ty = j * ch + 1.1 + jy;
        const tw = cw - 2.2;
        const th = ch - 2.2;
        x.clearRect(tx, ty, tw, th);
        x.fillStyle = v < 0.55 ? `rgba(255,255,255,${(0.06 + v * 0.42).toFixed(3)})` : `rgba(0,0,0,${((v - 0.55) * 0.42).toFixed(3)})`;
        x.fillRect(tx, ty, tw, th);
        x.fillStyle = 'rgba(255,255,255,0.4)';
        x.fillRect(tx + 1, ty + 1, tw * 0.45, 1.1);
      }
    }
  },
};

// Vitrail : panneaux de verre de couleur (cellules de Voronoï) sertis de plomb.
const JEWELS: readonly Rgb[] = [[205, 34, 64], [44, 86, 206], [24, 150, 92], [240, 170, 34], [150, 62, 196], [40, 172, 204], [236, 230, 196]];
const LEADED: TexSpec = {
  key: 'leaded', w: 256, h: 128,
  paint: (x, w, h) => {
    const r = prng(307);
    const pts: { x: number; y: number; c: Rgb }[] = [];
    for (let k = 0; k < 34; k++) pts.push({ x: r() * w, y: r() * h, c: JEWELS[Math.floor(r() * JEWELS.length)]! });
    imageFrom(x, w, h, (px, py, d, i) => {
      let f1 = Infinity;
      let f2 = Infinity;
      let best = pts[0]!;
      for (const p of pts) {
        // Distance périodique (texture sans couture).
        let dx = Math.abs(px - p.x);
        let dy = Math.abs(py - p.y);
        if (dx > w / 2) dx = w - dx;
        if (dy > h / 2) dy = h - dy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < f1) {
          f2 = f1;
          f1 = dist;
          best = p;
        } else if (dist < f2) f2 = dist;
      }
      if (f2 - f1 < 2.4) {
        d[i] = 30; d[i + 1] = 26; d[i + 2] = 40; d[i + 3] = 240;
      } else {
        // Verre un peu plus clair au centre du panneau (lumière qui le traverse).
        const k = Math.min(1, f1 / 18);
        d[i] = Math.round(best.c[0] + (255 - best.c[0]) * (1 - k) * 0.3);
        d[i + 1] = Math.round(best.c[1] + (255 - best.c[1]) * (1 - k) * 0.3);
        d[i + 2] = Math.round(best.c[2] + (255 - best.c[2]) * (1 - k) * 0.3);
        d[i + 3] = 215;
      }
    });
  },
};

// Phénix : plumes de feu en écailles (or, orange, cramoisi), braises, langues de flamme.
const FEATHERS: TexSpec = {
  key: 'feathers', w: 256, h: 256,
  paint: (x, w, h) => {
    // Plumes effilées qui se chevauchent, pointe dorée vers le haut, base cramoisie, barbes fines.
    const tones: readonly Rgb[] = [[255, 214, 96], [255, 160, 52], [240, 92, 40], [196, 40, 54]];
    const rows = 12;
    const cols = 9;
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const fx = (i + (j % 2) * 0.5) * (w / cols);
        const fy = j * (h / rows);
        const c = tones[(j * 3 + i) % tones.length]!;
        const tilt = ((i * 7 + j * 3) % 5 - 2) * 0.06;
        wrapped(w, h, fx, fy, 26, (cx, cy) => {
          x.save();
          x.translate(cx, cy);
          x.rotate(tilt);
          const g = x.createLinearGradient(0, -22, 0, 16);
          g.addColorStop(0, css(lighten(c, 0.45), 0.95));
          g.addColorStop(0.55, css(c, 0.85));
          g.addColorStop(1, css(darken(c, 0.45), 0.2));
          x.fillStyle = g;
          x.beginPath();
          x.moveTo(0, -22);
          x.bezierCurveTo(8, -12, 8, 8, 0, 16);
          x.bezierCurveTo(-8, 8, -8, -12, 0, -22);
          x.fill();
          x.strokeStyle = css(lighten(c, 0.6), 0.75);
          x.lineWidth = 1;
          x.beginPath();
          x.moveTo(0, -20);
          x.lineTo(0, 14);
          for (let k = -16; k < 12; k += 4) {
            x.moveTo(0, k);
            x.lineTo(5, k - 4);
            x.moveTo(0, k);
            x.lineTo(-5, k - 4);
          }
          x.stroke();
          x.restore();
        });
      }
    }
  },
};

const EMBERS: TexSpec = {
  key: 'embers', w: 256, h: 256,
  paint: (x, w, h) => {
    const r = prng(401);
    for (let k = 0; k < 80; k++) {
      const ex = r() * w;
      const ey = r() * h;
      const rad = 0.8 + r() * 2.2;
      const hot = r() < 0.4;
      wrapped(w, h, ex, ey, rad * 3, (cx, cy) => {
        x.fillStyle = hot ? 'rgba(255,230,150,0.9)' : 'rgba(255,140,50,0.75)';
        x.beginPath();
        x.arc(cx, cy, rad, 0, TAU);
        x.fill();
        x.fillStyle = 'rgba(255,120,40,0.18)';
        x.beginPath();
        x.arc(cx, cy, rad * 3, 0, TAU);
        x.fill();
      });
    }
  },
};

const FLAMES: TexSpec = {
  key: 'flames', w: 256, h: 128,
  paint: (x, w, h) => {
    const oct = octavesOf(6, 2, 4, 503);
    imageFrom(x, w, h, (px, py, d, i) => {
      const u = px / w;
      const v = py / h;
      const n = fbm(oct, u, v);
      // Langues verticales : bandes ondulées, plus vives vers le bas de la texture.
      const band = Math.abs(Math.sin((u * 6 + n * 1.6) * Math.PI));
      const k = (1 - smoothstep(0.0, 0.35, band)) * (0.35 + 0.65 * v);
      d[i] = 255;
      d[i + 1] = Math.round(120 + 110 * k);
      d[i + 2] = Math.round(40 + 60 * k * k);
      d[i + 3] = Math.round(Math.min(1, k) * 170);
    });
  },
};

const PCB: Rgb = [22, 70, 58];
const SMOKE: Rgb = [24, 20, 40];
const NIGHT: Rgb = [14, 22, 52];
const EMBER_DARK: Rgb = [74, 18, 26];
const DEEP: Rgb = [6, 44, 78];
const HOLO: readonly Rgb[] = [[255, 128, 206], [255, 214, 120], [130, 240, 170], [120, 196, 255], [196, 140, 255]];
const NEON_TUBES: readonly Rgb[] = [[60, 240, 255], [255, 70, 200], [180, 255, 80], [255, 190, 60]];

export type MaterialSkin =
  | 'gomme' | 'marbre' | 'bonbon' | 'verre' | 'strie' | 'ceramique'
  | 'graphite' | 'nacre' | 'holographique' | 'pixel' | 'galaxie' | 'lave' | 'or' | 'cristal'
  | 'bois' | 'circuit' | 'neon' | 'aurore' | 'abysse'
  | 'papier' | 'mosaique' | 'vitrail' | 'phenix';

/** Teinte moyenne de la face (contour, lisibilité). */
export function faceTone(color: Rgb, skin: MaterialSkin, sky: Rgb): Rgb {
  switch (skin) {
    case 'marbre': return lighten(color, 0.5);
    case 'ceramique': return darken(color, 0.15);
    // « Verre » est dessiné à 72 % d'opacité : le ciel transparaît dans la face.
    case 'verre': return mix(color, sky, 0.28);
    case 'graphite': return mix(color, GRAPHITE, 0.78);
    case 'nacre': return lighten(color, 0.55);
    case 'holographique': return lighten(color, 0.3);
    case 'galaxie': return mix(color, GALAXY, 0.72);
    case 'lave': return mix(color, ROCK, 0.7);
    case 'or': return mix(color, GOLD, 0.9);
    case 'cristal': return lighten(color, 0.32);
    case 'bois': return mix(color, WOOD_TONE, 0.75);
    case 'circuit': return mix(color, PCB, 0.75);
    case 'neon': return mix(color, SMOKE, 0.85);
    case 'aurore': return mix(color, NIGHT, 0.85);
    case 'abysse': return mix(color, DEEP, 0.92);
    case 'papier': return mix(lighten(color, 0.3), [250, 244, 230], 0.25);
    case 'mosaique': return color;
    case 'vitrail': return mix(color, [120, 90, 140], 0.35);
    case 'phenix': return mix(color, EMBER_DARK, 0.86);
    default: return color;
  }
}

/** Dégradé vertical de la face, en coordonnées locales 0..H. */
export function faceGradient(ctx: CanvasRenderingContext2D, color: Rgb, skin: MaterialSkin): CanvasGradient {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  const stops = (...s: [number, Rgb][]) => { for (const [k, c] of s) g.addColorStop(k, css(c)); };
  switch (skin) {
    case 'ceramique': stops([0, lighten(color, 0.05)], [1, darken(color, 0.32)]); break;
    case 'marbre': stops([0, lighten(color, 0.66)], [1, lighten(color, 0.4)]); break;
    case 'graphite': { const c = mix(color, GRAPHITE, 0.78); stops([0, lighten(c, 0.16)], [0.5, c], [1, darken(c, 0.25)]); break; }
    case 'nacre': { const c = lighten(color, 0.55); stops([0, mix(c, [255, 222, 238], 0.45)], [0.5, mix(c, [222, 236, 255], 0.45)], [1, mix(c, [236, 255, 240], 0.35)]); break; }
    case 'holographique': { const c = lighten(color, 0.3); HOLO.forEach((h, i) => g.addColorStop(i / (HOLO.length - 1), css(mix(c, h, 0.55)))); break; }
    case 'galaxie': { const c = mix(color, GALAXY, 0.8); stops([0, lighten(c, 0.1)], [1, darken(c, 0.35)]); break; }
    case 'lave': { const c = mix(color, ROCK, 0.7); stops([0, lighten(c, 0.08)], [1, darken(c, 0.25)]); break; }
    case 'or': { const c = mix(color, GOLD, 0.9); stops([0, lighten(c, 0.55)], [0.3, mix(c, [255, 200, 70], 0.3)], [0.5, lighten(c, 0.35)], [0.62, darken(c, 0.12)], [1, darken(c, 0.48)]); break; }
    case 'cristal': { const c = lighten(color, 0.32); stops([0, lighten(c, 0.25)], [0.5, c], [1, darken(c, 0.12)]); break; }
    case 'bois': { const c = mix(color, WOOD_TONE, 0.75); stops([0, lighten(c, 0.12)], [0.5, c], [1, darken(c, 0.22)]); break; }
    case 'circuit': { const c = mix(color, PCB, 0.75); stops([0, lighten(c, 0.1)], [1, darken(c, 0.3)]); break; }
    case 'neon': { const c = mix(color, SMOKE, 0.85); stops([0, lighten(c, 0.08)], [1, darken(c, 0.3)]); break; }
    case 'aurore': { const c = mix(color, NIGHT, 0.86); stops([0, darken(c, 0.25)], [1, lighten(c, 0.06)]); break; }
    case 'abysse': { const c = mix(color, DEEP, 0.92); stops([0, mix(c, [40, 150, 200], 0.55)], [0.5, c], [1, darken(c, 0.55)]); break; }
    case 'papier': { const c = mix(lighten(color, 0.3), [250, 244, 230], 0.25); stops([0, lighten(c, 0.2)], [0.6, c], [1, darken(c, 0.1)]); break; }
    case 'vitrail': { const c = mix(color, [120, 90, 140], 0.35); stops([0, lighten(c, 0.2)], [1, darken(c, 0.25)]); break; }
    case 'phenix': { const c = mix(color, EMBER_DARK, 0.86); stops([0, mix(c, [255, 140, 60], 0.25)], [0.55, c], [1, darken(c, 0.45)]); break; }
    default: stops([0, lighten(color, 0.14)], [0.55, color], [1, darken(color, 0.16)]);
  }
  return g;
}

// ——— Calques communs ———

/**
 * Volume : lumière à gauche, ombre à droite (dans la brique). Deux bandes fines seulement : même
 * rendu qu'un dégradé sur toute la largeur, pour une fraction des pixels à remplir.
 */
function sideShade(ctx: CanvasRenderingContext2D, w: number, strength: number): void {
  if (w < 6) return;
  const band = Math.min(14, w * 0.2);
  const l = ctx.createLinearGradient(0, 0, band, 0);
  l.addColorStop(0, `rgba(255,255,255,${(0.16 * strength).toFixed(3)})`);
  l.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = l;
  ctx.fillRect(0, 0, band, H);
  const r = ctx.createLinearGradient(w - band, 0, w, 0);
  r.addColorStop(0, 'rgba(0,0,0,0)');
  r.addColorStop(1, `rgba(0,0,0,${(0.2 * strength).toFixed(3)})`);
  ctx.fillStyle = r;
  ctx.fillRect(w - band, 0, band, H);
}

/**
 * Reflet qui glisse (Rare et plus) : une bande de lumière diagonale qui traverse la tour en
 * vague (chaque étage un peu en retard sur celui du dessous). Fixe en animations réduites.
 */
function sheen(ctx: CanvasRenderingContext2D, w: number, env: MaterialEnv, alpha: number, tint: Rgb = [255, 255, 255], width = 16): void {
  const speed = 70;
  const span = 520;
  const pos = env.motion ? (((env.t * speed - env.floor * 13) % span) + span) % span - 80 : 150 + vary(env.floor, 3) * 40;
  const lx = pos - env.wx;
  if (lx < -width * 2 || lx > w + width * 2) return;
  const g = ctx.createLinearGradient(lx - width, 0, lx + width, 0);
  g.addColorStop(0, `rgba(${tint[0]},${tint[1]},${tint[2]},0)`);
  g.addColorStop(0.5, `rgba(${tint[0]},${tint[1]},${tint[2]},${alpha})`);
  g.addColorStop(1, `rgba(${tint[0]},${tint[1]},${tint[2]},0)`);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(lx - width + 9, 0);
  ctx.lineTo(lx + width + 9, 0);
  ctx.lineTo(lx + width - 9, H);
  ctx.lineTo(lx - width - 9, H);
  ctx.closePath();
  ctx.fill();
}

/** Vignette intérieure : les bords s'assombrissent, comme une vitrine profonde (légendaires). */
function innerDepth(ctx: CanvasRenderingContext2D, w: number, strength: number): void {
  const top = ctx.createLinearGradient(0, 0, 0, H * 0.25);
  top.addColorStop(0, `rgba(0,0,0,${(0.35 * strength).toFixed(3)})`);
  top.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = top;
  ctx.fillRect(0, 0, w, H * 0.25);
  const bottom = ctx.createLinearGradient(0, H * 0.75, 0, H);
  bottom.addColorStop(0, 'rgba(0,0,0,0)');
  bottom.addColorStop(1, `rgba(0,0,0,${(0.45 * strength).toFixed(3)})`);
  ctx.fillStyle = bottom;
  ctx.fillRect(0, H * 0.75, w, H * 0.25);
  sideShade(ctx, w, strength * 1.4);
}

/** Petite étoile à quatre branches (paillettes). */
function glint(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, alpha: number, color: Rgb = [255, 255, 255]): void {
  if (alpha <= 0.01) return;
  ctx.fillStyle = css(color, alpha);
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.quadraticCurveTo(x, y, x, y + r);
  ctx.quadraticCurveTo(x, y, x - r, y);
  ctx.quadraticCurveTo(x, y, x, y - r);
  ctx.fill();
}

const objX = (env: MaterialEnv, n: number) => env.wx - env.ox + vary(n, 91) * 400;
const objY = (n: number) => vary(n, 92) * 200;

// ——— Matières ———

type Painter = (ctx: CanvasRenderingContext2D, w: number, color: Rgb, env: MaterialEnv, real: boolean) => void;

const PAINTERS: Record<MaterialSkin, Painter> = {
  gomme: (ctx, w, color, env, real) => {
    // Caoutchouc doux : grain fin, cœur légèrement lumineux (diffusion), arêtes adoucies.
    if (real) fillTex(ctx, w, GRAIN, objX(env, env.floor), objY(env.floor), 0.9);
    // Cœur légèrement plus clair (diffusion du caoutchouc) : une bande douce au milieu.
    ctx.fillStyle = css(lighten(color, 0.25), 0.16);
    ctx.fillRect(w * 0.18, H * 0.45, w * 0.64, H * 0.3);
    sideShade(ctx, w, 1);
  },
  strie: (ctx, w, color) => {
    // Plastique côtelé : sillons sombres soulignés d'une arête claire (relief).
    for (let sy = 9; sy < H - 4; sy += 4) {
      ctx.fillStyle = css(darken(color, 0.35), 0.75);
      ctx.fillRect(0, sy, w, 1.6);
      ctx.fillStyle = css(lighten(color, 0.45), 0.55);
      ctx.fillRect(0, sy + 1.6, w, 0.8);
    }
    sideShade(ctx, w, 1.1);
  },
  bonbon: (ctx, w, _color, env) => {
    // Sucre d'orge : rayures diagonales vernies et cristaux de sucre.
    const step = 14;
    const offset = vary(env.floor, 1) * step;
    for (let sx = -H + offset; sx < w + H; sx += step) {
      const g = ctx.createLinearGradient(sx, 0, sx + 8, 0);
      g.addColorStop(0, 'rgba(255,255,255,0.25)');
      g.addColorStop(0.5, 'rgba(255,255,255,0.62)');
      g.addColorStop(1, 'rgba(255,255,255,0.3)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(sx, H);
      ctx.lineTo(sx + 6, H);
      ctx.lineTo(sx + 6 + H, 0);
      ctx.lineTo(sx + H, 0);
      ctx.closePath();
      ctx.fill();
    }
    for (let k = 0; k < Math.min(18, Math.floor(w / 9)); k++) {
      ctx.fillStyle = `rgba(255,255,255,${0.35 + vary(env.floor, 40 + k) * 0.5})`;
      ctx.fillRect(vary(env.floor, 60 + k) * w, 8 + vary(env.floor, 80 + k) * (H - 12), 1.1, 1.1);
    }
    sideShade(ctx, w, 0.9);
  },
  graphite: (ctx, w, color, env, real) => {
    // Graphite : grain de mine, hachures fines, liseré métallique.
    if (real) fillTex(ctx, w, GRAIN, objX(env, env.floor), objY(env.floor), 1, 'source-over');
    ctx.strokeStyle = 'rgba(220,226,240,0.09)';
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    const off = vary(env.floor, 5) * 6;
    for (let sx = -H + off; sx < w + H; sx += 3.2) {
      ctx.moveTo(sx, H);
      ctx.lineTo(sx + H * 0.6, 0);
    }
    ctx.stroke();
    ctx.fillStyle = css([210, 214, 226], 0.5);
    ctx.fillRect(0, 9, w, 1.1);
    sideShade(ctx, w, 1.2);
    void color;
  },
  bois: (ctx, w, color, env, real) => {
    // Bois verni : fil, pores et nœuds ; la pièce garde son veinage en tombant.
    if (!real) {
      ctx.strokeStyle = css(darken(mix(color, WOOD_TONE, 0.75), 0.35), 0.55);
      ctx.lineWidth = 0.9;
      for (let k = 0; k < 5; k++) {
        const y0 = 9 + k * 4 + vary(env.floor, k) * 2;
        ctx.beginPath();
        ctx.moveTo(0, y0);
        ctx.bezierCurveTo(w * 0.3, y0 - 2, w * 0.6, y0 + 2, w, y0);
        ctx.stroke();
      }
    } else {
      fillTex(ctx, w, WOOD, objX(env, env.floor), objY(env.floor) + 40, 1);
    }
    // Vernis : reflet doux sur le haut.
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, 'rgba(255,240,210,0.18)');
    g.addColorStop(0.45, 'rgba(255,240,210,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, H);
    sideShade(ctx, w, 1.1);
  },
  marbre: (ctx, w, color, env, real) => {
    // Marbre poli : veines continues dans la pièce, voile laiteux, reflet qui glisse.
    if (!real || !fillTex(ctx, w, MARBLE, objX(env, env.floor), objY(env.floor), 0.95)) {
      ctx.strokeStyle = css(darken(color, 0.12), 0.75);
      ctx.lineCap = 'round';
      const veins = 2 + Math.floor(vary(env.floor, 2) * 2);
      for (let k = 0; k < veins; k++) {
        const x0 = vary(env.floor, 10 + k) * w;
        const dx = (vary(env.floor, 20 + k) - 0.5) * 60;
        ctx.lineWidth = 0.8 + vary(env.floor, 30 + k) * 1.4;
        ctx.beginPath();
        ctx.moveTo(x0, -2);
        ctx.bezierCurveTo(x0 + dx, H * 0.35, x0 - dx * 0.6, H * 0.7, x0 + dx * 0.4, H + 2);
        ctx.stroke();
      }
    } else {
      // Teinte de l'étage glissée dans les veines claires.
      ctx.fillStyle = css(color, 0.12);
      ctx.fillRect(0, 0, w, H);
    }
    sideShade(ctx, w, 0.8);
  },
  ceramique: (ctx, w, color, env, real) => {
    // Céramique émaillée : craquelure, émail plus épais en bas, grand reflet.
    if (real) fillTex(ctx, w, CRACKLE, objX(env, env.floor), objY(env.floor), 0.8);
    else {
      for (let k = 0; k < Math.min(40, Math.floor(w / 6)); k++) {
        const light = k % 3 === 0;
        ctx.fillStyle = light ? css([255, 255, 255], 0.35) : css(darken(color, 0.45), 0.35);
        ctx.beginPath();
        ctx.arc(vary(env.floor, 100 + k) * w, 8 + vary(env.floor, 200 + k) * (H - 12), 0.6 + vary(env.floor, 300 + k) * 0.8, 0, TAU);
        ctx.fill();
      }
    }
    const pool = ctx.createLinearGradient(0, H * 0.55, 0, H);
    pool.addColorStop(0, css(darken(color, 0.2), 0));
    pool.addColorStop(1, css(darken(color, 0.35), 0.55));
    ctx.fillStyle = pool;
    ctx.fillRect(0, 0, w, H);
    sideShade(ctx, w, 1);
  },
  verre: (ctx, w, color, env, real) => {
    // Verre dépoli : givre, bulles prises dans la masse, arêtes qui réfractent la lumière.
    if (real) fillTex(ctx, w, GRAIN, objX(env, env.floor), objY(env.floor), 1.6, 'source-over');
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    const sx = w * (0.15 + vary(env.floor, 3) * 0.2);
    ctx.beginPath();
    ctx.moveTo(sx, 0);
    ctx.lineTo(sx + 14, 0);
    ctx.lineTo(sx + 2, H);
    ctx.lineTo(sx - 12, H);
    ctx.closePath();
    ctx.fill();
    for (let k = 0; k < Math.min(7, Math.floor(w / 22)); k++) {
      const bx = vary(env.floor, 400 + k) * w;
      const by = 9 + vary(env.floor, 410 + k) * (H - 15);
      const br = 0.8 + vary(env.floor, 420 + k) * 1.8;
      ctx.strokeStyle = 'rgba(255,255,255,0.55)';
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      ctx.arc(bx, by, br, 0, TAU);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.fillRect(bx - br * 0.45, by - br * 0.45, 0.7, 0.7);
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 2;
    roundedRect(ctx, 3, 3, Math.max(0, w - 6), H - 6, RADIUS - 3);
    ctx.stroke();
    void color;
  },
  nacre: (ctx, w, color, env, real) => {
    // Nacre : voiles irisés qui changent doucement avec le temps et la hauteur.
    // Irisation fixée par la position (la base se met en cache) ; le reflet qui glisse est vivant.
    const drift = 0;
    if (!real || !fillTex(ctx, w, NACRE, env.wx * 0.6 + drift, -env.wy * 0.3 + drift * 0.5, 0.62)) {
      const tints: Rgb[] = [[255, 190, 222], [180, 212, 255]];
      tints.forEach((t, k) => {
        ctx.fillStyle = css(t, 0.35);
        ctx.beginPath();
        const y0 = 12 + k * 7 + vary(env.floor, 40 + k) * 3;
        ctx.moveTo(0, y0);
        for (let x = 0; x <= w + 12; x += 12) ctx.quadraticCurveTo(x + 6, y0 - 4, x + 12, y0);
        ctx.lineTo(w + 12, y0 + 4);
        ctx.lineTo(0, y0 + 4);
        ctx.closePath();
        ctx.fill();
      });
    } else if (env.full) {
      fillTex(ctx, w, NACRE, -env.wx * 0.4 - drift, env.wy * 0.2, 0.35, 'overlay');
      ctx.fillStyle = css(color, 0.12);
      ctx.fillRect(0, 0, w, H);
    }
    sideShade(ctx, w, 0.7);
  },
  pixel: (ctx, w, color, env, real) => {
    // 8-bit : carreaux biseautés nets, et un éclat de pixels qui défile (rare).
    if (!real || !fillTex(ctx, w, PIXELS, env.wx - env.ox, 0, 1, 'source-over', false)) {
      const size = 5;
      for (let sy = 0, row = 0; sy < H; sy += size, row++) {
        for (let sx = 0, col = 0; sx < w; sx += size, col++) {
          if ((row + col) % 2 === 0) continue;
          ctx.fillStyle = (row + col + env.floor) % 4 === 1 ? css(lighten(color, 0.3), 0.55) : css(darken(color, 0.22), 0.45);
          ctx.fillRect(sx, sy, size, size);
        }
      }
    }
  },
  circuit: (ctx, w, color, env, real) => {
    // Circuit : pistes dorées, puces, et impulsions lumineuses qui courent sur deux bus.
    if (real) fillTex(ctx, w, CIRCUIT, objX(env, env.floor), objY(env.floor), 0.95);
    else {
      ctx.strokeStyle = 'rgba(232,190,96,0.8)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(0, 14);
      ctx.lineTo(w, 14);
      ctx.moveTo(0, 21);
      ctx.lineTo(w, 21);
      ctx.stroke();
    }
    const tube = mix(color, [120, 255, 230], 0.6);
    for (let lane = 0; lane < 2; lane++) {
      const y = 13 + lane * 8;
      ctx.fillStyle = css(tube, 0.18);
      ctx.fillRect(0, y - 0.6, w, 1.2);
      const speed = lane === 0 ? 55 : -38;
      const count = Math.max(1, Math.round(w / 90));
      for (let k = 0; k < count; k++) {
        const base = vary(env.floor, 600 + lane * 10 + k) * w;
        const px = env.motion ? ((((base + env.t * speed) % w) + w) % w) : base;
        const g = ctx.createRadialGradient(px, y, 0, px, y, 7);
        g.addColorStop(0, css(lighten(tube, 0.6), 0.95));
        g.addColorStop(0.4, css(tube, 0.5));
        g.addColorStop(1, css(tube, 0));
        ctx.fillStyle = g;
        ctx.fillRect(px - 7, y - 7, 14, 14);
      }
    }
    sideShade(ctx, w, 1.1);
  },
  holographique: (ctx, w, color, env) => {
    // Hologramme : bandes de diffraction qui glissent avec le temps et la hauteur, paillettes.
    const step = 10;
    const phase = (env.motion ? env.t * 22 : 0) + env.wy * 0.6 - env.wx;
    const offset = ((phase % (step * HOLO.length)) + step * HOLO.length) % (step * HOLO.length);
    let k = Math.floor(vary(env.floor, 5) * HOLO.length);
    for (let sx = -H - step * HOLO.length + offset; sx < w + H; sx += step, k++) {
      ctx.fillStyle = css(HOLO[k % HOLO.length]!, 0.42);
      ctx.beginPath();
      ctx.moveTo(sx, H);
      ctx.lineTo(sx + step, H);
      ctx.lineTo(sx + step + H * 0.7, 0);
      ctx.lineTo(sx + H * 0.7, 0);
      ctx.closePath();
      ctx.fill();
    }
    if (env.full) {
      for (let s = 0; s < Math.min(6, Math.floor(w / 24)); s++) {
        const px = vary(env.floor, 700 + s) * w;
        const py = 8 + vary(env.floor, 710 + s) * (H - 12);
        const tw = env.motion ? 0.5 + 0.5 * Math.sin(env.t * (2 + vary(env.floor, 720 + s) * 3) + s * 2) : 0.6;
        glint(ctx, px, py, 2.6, tw * 0.9);
      }
      sheen(ctx, w, env, 0.5, [255, 255, 255], 14);
    }
    sideShade(ctx, w, 0.8);
    void color;
  },
  lave: (ctx, w, color, env, real) => {
    // Lave : magma qui coule sous une croûte fendue ; la lueur respire.
    const flow = env.motion ? env.t * 9 : 0;
    const pulse = env.motion ? 0.82 + 0.18 * Math.sin(env.t * 2.2 + env.floor * 0.7) : 0.92;
    if (real && fillTex(ctx, w, MAGMA, env.wx * 0.8 + flow, -env.wy * 0.5 + flow * 0.4, pulse, 'source-over')) {
      fillTex(ctx, w, LAVA_CRUST, objX(env, env.floor), objY(env.floor), 1);
    } else {
      ctx.strokeStyle = css([255, 150, 50], 0.9 * pulse);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      const cracks = 2 + Math.floor(w / 70);
      for (let k = 0; k < cracks; k++) {
        let x = vary(env.floor, 800 + k) * w;
        let y = 6;
        ctx.lineWidth = 1 + vary(env.floor, 850 + k) * 1.2;
        ctx.beginPath();
        ctx.moveTo(x, y);
        for (let seg = 0; seg < 4; seg++) {
          x += (vary(env.floor, 900 + k * 10 + seg) - 0.5) * 18;
          y += (H - 6) / 4;
          ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    }
    // Chaleur qui monte du bas de la brique.
    const g = ctx.createLinearGradient(0, H, 0, H * 0.4);
    g.addColorStop(0, `rgba(255,110,30,${0.32 * pulse})`);
    g.addColorStop(1, 'rgba(255,110,30,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, H);
    sideShade(ctx, w, 1);
    void color;
  },
  or: (ctx, w, color, env, real) => {
    // Or : métal brossé, gravure intérieure, deux reflets qui glissent et des éclats.
    if (real) fillTex(ctx, w, BRUSHED, objX(env, env.floor), objY(env.floor), 1);
    else {
      ctx.fillStyle = css([255, 248, 214], 0.28);
      for (let sy = 10; sy < H - 4; sy += 2.5) ctx.fillRect(0, sy, w, 0.6);
    }
    ctx.strokeStyle = 'rgba(110,70,10,0.45)';
    ctx.lineWidth = 0.8;
    roundedRect(ctx, 4.5, 9.5, Math.max(0, w - 9), H - 15, 3);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,240,190,0.45)';
    roundedRect(ctx, 5.3, 10.3, Math.max(0, w - 10.6), H - 16.6, 3);
    ctx.stroke();
    sideShade(ctx, w, 1.1);
    sheen(ctx, w, env, 0.95, [255, 252, 230], 22);
    if (env.full) {
      sheen(ctx, w, { ...env, t: env.t * 0.7 + 3.1, floor: env.floor + 7 }, 0.6, [255, 255, 255], 8);
      const tw = env.motion ? Math.max(0, Math.sin(env.t * 1.7 + env.floor * 1.3)) : 0.7;
      glint(ctx, vary(env.floor, 33) * (w - 10) + 5, 9 + vary(env.floor, 34) * 12, 3.4, tw * 0.95);
    }
    void color;
  },
  neon: (ctx, w, color, env) => {
    // Néon : verre fumé, tube lumineux intérieur qui bourdonne, reflet du tube sur le verre.
    const tube = NEON_TUBES[env.floor % NEON_TUBES.length]!;
    const hum = env.motion ? 0.88 + 0.12 * Math.sin(env.t * 9 + env.floor) * Math.sin(env.t * 3.3) : 1;
    const inset = 6;
    if (w > inset * 2 + 4) {
      for (const [lw, a] of [[7, 0.12], [4, 0.25], [2.2, 0.6]] as const) {
        ctx.strokeStyle = css(tube, a * hum);
        ctx.lineWidth = lw;
        roundedRect(ctx, inset, inset + 3, w - inset * 2, H - inset * 2 - 3, 6);
        ctx.stroke();
      }
      ctx.strokeStyle = css(lighten(tube, 0.75), 0.95 * hum);
      ctx.lineWidth = 1;
      roundedRect(ctx, inset, inset + 3, w - inset * 2, H - inset * 2 - 3, 6);
      ctx.stroke();
      const g = ctx.createLinearGradient(0, inset + 3, 0, H - inset);
      g.addColorStop(0, css(tube, 0.16 * hum));
      g.addColorStop(1, css(tube, 0.04));
      ctx.fillStyle = g;
      ctx.fillRect(inset, inset + 3, w - inset * 2, H - inset * 2 - 3);
    }
    if (env.full) sheen(ctx, w, env, 0.18, [255, 255, 255], 10);
    sideShade(ctx, w, 1.2);
    void color;
  },
  galaxie: (ctx, w, color, env, real) => {
    // Galaxie : un même cosmos traverse toute la tour. Nébuleuse lointaine (lente), étoiles
    // (moyennes), étoiles proches qui scintillent : trois profondeurs, plus une dérive propre.
    const drift = env.motion ? env.t * 3 : 0;
    if (real && fillTex(ctx, w, NEBULA, env.wx * 0.85 + drift, env.wy + env.cam * 0.55 + drift * 0.3, 1)) {
      if (env.full) fillTex(ctx, w, STARS_FAR, env.wx + drift * 1.6, env.wy + env.cam * 0.3, 1, 'lighter');
      const twinkle = env.motion ? 0.75 + 0.25 * Math.sin(env.t * 2.4 + env.floor) : 0.95;
      fillTex(ctx, w, STARS_NEAR, env.wx, env.wy, twinkle, 'lighter');
      // La couleur de l'étage est déjà dans la face (dégradé) : le rythme des étages reste lisible.
    } else {
      for (let k = 0; k < Math.min(36, Math.floor(w / 5)); k++) {
        const big = vary(env.floor, 500 + k) > 0.85;
        ctx.fillStyle = k % 5 === 0 ? css(lighten(color, 0.5), 0.9) : css([255, 255, 255], big ? 0.95 : 0.7);
        ctx.beginPath();
        ctx.arc(vary(env.floor, 600 + k) * w, 7 + vary(env.floor, 700 + k) * (H - 10), big ? 1.3 : 0.6, 0, TAU);
        ctx.fill();
      }
    }
    innerDepth(ctx, w, 0.9);
  },
  cristal: (ctx, w, color, env, real) => {
    // Cristal : facettes, caustique de lumière qui traverse la masse, arêtes prismatiques.
    if (!real || !fillTex(ctx, w, FACETS, objX(env, env.floor), objY(env.floor), 0.85)) {
      const step = 18;
      const offset = vary(env.floor, 6) * step;
      for (let sx = -step + offset, k = 0; sx < w + step; sx += step, k++) {
        ctx.fillStyle = css([255, 255, 255], k % 2 === 0 ? 0.32 : 0.14);
        ctx.beginPath();
        ctx.moveTo(sx, H);
        ctx.lineTo(sx + step / 2, 6);
        ctx.lineTo(sx + step, H);
        ctx.closePath();
        ctx.fill();
      }
    }
    if (real && env.full) {
      const drift = env.motion ? env.t * 14 : 0;
      fillTex(ctx, w, CAUSTICS, env.wx * 0.5 + drift, env.wy * 0.5 + env.cam * 0.3, 0.35, 'lighter');
    }
    // Arêtes prismatiques (dispersion) en haut et en bas.
    const prism = ctx.createLinearGradient(0, 0, w, 0);
    HOLO.forEach((h, i) => prism.addColorStop(i / (HOLO.length - 1), css(h, 0.55)));
    ctx.fillStyle = prism;
    ctx.fillRect(0, H - 6, w, 1.2);
    ctx.fillRect(0, 8.5, w, 0.9);
    sheen(ctx, w, env, 0.7, [255, 255, 255], 12);
    if (env.full) {
      for (let s = 0; s < Math.min(4, Math.floor(w / 30)); s++) {
        const tw = env.motion ? Math.max(0, Math.sin(env.t * (1.4 + s * 0.4) + env.floor * 2 + s)) : 0.6;
        glint(ctx, vary(env.floor, 900 + s) * w, 9 + vary(env.floor, 910 + s) * (H - 13), 3, tw);
      }
    }
    sideShade(ctx, w, 0.7);
    void color;
  },
  aurore: (ctx, w, _color, env, real) => {
    // Aurore : nuit étoilée continue sur toute la tour, rideaux verts et violets qui ondulent.
    const drift = env.motion ? env.t : 0;
    if (real && fillTex(ctx, w, STARS_FAR, env.wx, env.wy + env.cam * 0.4, 1, 'lighter')) {
      fillTex(ctx, w, AURORA, env.wx * 0.9 + drift * 9, env.wy * 0.5 + env.cam * 0.35 + Math.sin(drift * 0.6) * 6, 0.95, 'lighter');
      if (env.full) fillTex(ctx, w, AURORA, -env.wx * 0.7 + drift * 15 + 130, env.wy * 0.45 + env.cam * 0.2 + 40, 0.5, 'lighter');
    } else {
      const g = ctx.createLinearGradient(0, 4, 0, H);
      g.addColorStop(0, 'rgba(190,110,255,0.35)');
      g.addColorStop(0.45, 'rgba(80,255,170,0.55)');
      g.addColorStop(1, 'rgba(40,220,190,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(0, 6);
      for (let x = 0; x <= w; x += 10) ctx.lineTo(x, 6 + Math.sin((env.wx + x) * 0.05) * 3);
      ctx.lineTo(w, H);
      ctx.lineTo(0, H);
      ctx.closePath();
      ctx.fill();
    }
    innerDepth(ctx, w, 0.75);
    if (env.full) sheen(ctx, w, env, 0.14, [210, 255, 235], 22);
  },
  abysse: (ctx, w, _color, env, real) => {
    // Abysse : lumière filtrée par la surface (caustiques), plancton lumineux, et un petit
    // poisson qui traverse la tour d'une brique à l'autre.
    const drift = env.motion ? env.t : 0;
    if (real && fillTex(ctx, w, CAUSTICS, env.wx + drift * 11, env.wy + env.cam * 0.35 + drift * 4, 0.55, 'lighter')) {
      if (env.full) fillTex(ctx, w, CAUSTICS, env.wx * 0.8 - drift * 8 + 70, env.wy * 0.9 + env.cam * 0.25 - drift * 3, 0.32, 'lighter');
    } else {
      ctx.strokeStyle = 'rgba(190,245,255,0.3)';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      for (let x = 0; x < w; x += 9) ctx.ellipse(x + 4, 12 + (x % 3), 5, 2, 0, 0, TAU);
      ctx.stroke();
    }
    // Rayons de lumière obliques venus de la surface (continus d'une brique à l'autre).
    for (let k = 0; k < 3; k++) {
      const rx = ((k * 137 + (env.motion ? Math.sin(drift * 0.3 + k) * 18 : 0)) % 380) - env.wx + env.wy * 0.35;
      if (rx < -40 || rx > w + 40) continue;
      const g = ctx.createLinearGradient(rx - 10, 0, rx + 10, 0);
      g.addColorStop(0, 'rgba(140,230,255,0)');
      g.addColorStop(0.5, 'rgba(140,230,255,0.16)');
      g.addColorStop(1, 'rgba(140,230,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(rx - 6, 0);
      ctx.lineTo(rx + 8, 0);
      ctx.lineTo(rx - 2 - H * 0.35, H);
      ctx.lineTo(rx - 16 - H * 0.35, H);
      ctx.closePath();
      ctx.fill();
    }
    if (env.full) {
      for (let k = 0; k < Math.min(8, Math.floor(w / 18)); k++) {
        const px = vary(env.floor, 300 + k) * w + (env.motion ? Math.sin(drift * 0.8 + k) * 3 : 0);
        const py = 8 + ((vary(env.floor, 310 + k) * (H - 10) - (env.motion ? drift * (2 + k % 3) : 0)) % (H - 10) + (H - 10)) % (H - 10);
        const a = env.motion ? 0.45 + 0.4 * Math.sin(drift * 2 + k * 1.7) : 0.6;
        ctx.fillStyle = css([120, 255, 230], a);
        ctx.beginPath();
        ctx.arc(px, py, 0.9, 0, TAU);
        ctx.fill();
      }
      // Poisson : position dans le monde, il nage à travers plusieurs briques.
      const lap = 9;
      const p = env.motion ? (env.t % lap) / lap : 0.4;
      const fx = -40 + p * 440;
      const fy = -H * 2.5 - Math.sin(p * TAU) * 20;
      const lx = fx - env.wx;
      const ly = fy - env.wy;
      if (lx > -12 && lx < w + 12 && ly > -6 && ly < H + 6) {
        ctx.fillStyle = 'rgba(160,250,240,0.75)';
        ctx.beginPath();
        ctx.ellipse(lx, ly, 5, 2.2, 0, 0, TAU);
        ctx.moveTo(lx - 4, ly);
        ctx.lineTo(lx - 8, ly - 2.4);
        ctx.lineTo(lx - 8, ly + 2.4);
        ctx.closePath();
        ctx.fill();
      }
    }
    innerDepth(ctx, w, 0.8);
  },
  papier: (ctx, w, color, env, real) => {
    // Papier fait main : fibres, pli en diagonale (une face un peu plus sombre), bord déchiré.
    if (real) fillTex(ctx, w, PAPER, objX(env, env.floor), objY(env.floor), 1);
    const fx = w * (0.25 + vary(env.floor, 11) * 0.5);
    ctx.fillStyle = css(darken(mix(lighten(color, 0.3), [250, 244, 230], 0.25), 0.16), 0.45);
    ctx.beginPath();
    ctx.moveTo(fx - 6, 0);
    ctx.lineTo(w, 0);
    ctx.lineTo(w, H);
    ctx.lineTo(fx + 6, H);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(fx - 6, 0);
    ctx.lineTo(fx + 6, H);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.beginPath();
    ctx.moveTo(0, 6);
    for (let x = 0; x <= w; x += 4) ctx.lineTo(x, 8 + vary(env.floor * 31 + Math.floor(x / 4), 5) * 2.4);
    ctx.lineTo(w, 6);
    ctx.closePath();
    ctx.fill();
    sideShade(ctx, w, 0.7);
  },
  mosaique: (ctx, w, color, env, real) => {
    // Mosaïque : tesselles et joints, émail plus profond en bas ; le reflet glisse (calque vivant).
    if (real) fillTex(ctx, w, TILES, objX(env, env.floor), objY(env.floor), 1);
    else {
      ctx.strokeStyle = css(darken(color, 0.5), 0.6);
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      for (let x = 6; x < w; x += 6) {
        ctx.moveTo(x, 6);
        ctx.lineTo(x, H);
      }
      for (let y = 12; y < H; y += 6) {
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
      }
      ctx.stroke();
    }
    const pool = ctx.createLinearGradient(0, H * 0.5, 0, H);
    pool.addColorStop(0, css(darken(color, 0.2), 0));
    pool.addColorStop(1, css(darken(color, 0.35), 0.4));
    ctx.fillStyle = pool;
    ctx.fillRect(0, 0, w, H);
    sideShade(ctx, w, 0.9);
  },
  vitrail: (ctx, w, color, env, real) => {
    // Vitrail : verres de couleur sertis de plomb ; la lumière du jour les traverse et glisse.
    if (!real || !fillTex(ctx, w, LEADED, objX(env, env.floor), objY(env.floor), 0.92)) {
      const panes = Math.max(1, Math.round(w / 18));
      for (let k = 0; k < panes; k++) {
        ctx.fillStyle = css(JEWELS[(k + env.floor) % JEWELS.length]!, 0.75);
        ctx.fillRect((k * w) / panes + 1, 7, w / panes - 2, H - 9);
      }
    }
    const span = 520;
    const pos = env.motion ? ((((env.t * 45 + env.wy * 0.6) % span) + span) % span) - 80 : 150;
    const lx = pos - env.wx;
    if (lx > -70 && lx < w + 70) {
      const g = ctx.createLinearGradient(lx - 46, 0, lx + 46, 0);
      g.addColorStop(0, 'rgba(255,240,200,0)');
      g.addColorStop(0.5, `rgba(255,240,200,${env.full ? 0.5 : 0.35})`);
      g.addColorStop(1, 'rgba(255,240,200,0)');
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, H);
      ctx.globalCompositeOperation = 'source-over';
    }
    if (env.full) {
      // Deux panneaux qui s'illuminent doucement tour à tour (jamais de clignotement).
      for (let k = 0; k < Math.min(2, Math.floor(w / 40)); k++) {
        const glow = env.motion ? 0.5 + 0.5 * Math.sin(env.t * 0.9 + env.floor * 1.7 + k * 2.4) : 0.5;
        glint(ctx, vary(env.floor, 700 + k) * w, 10 + vary(env.floor, 710 + k) * (H - 14), 4, glow * 0.8, [255, 245, 220]);
      }
    }
    ctx.fillStyle = 'rgba(30,26,40,0.85)';
    ctx.fillRect(0, 7.2, w, 1.6);
    ctx.fillRect(0, H - 4, w, 1.6);
    sideShade(ctx, w, 0.6);
    void color;
  },
  phenix: (ctx, w, _color, env, real) => {
    // Phénix : un même plumage de feu traverse toute la tour, en profondeur. Les braises au fond
    // montent lentement, les plumes ondulent plus vite, les flammes du premier plan encore plus.
    const drift = env.motion ? env.t : 0;
    if (real && fillTex(ctx, w, EMBERS, env.wx * 0.6, env.wy * 0.6 + env.cam * 0.45 + drift * 14, 0.85, 'lighter')) {
      fillTex(ctx, w, FEATHERS, env.wx * 0.85 + Math.sin(drift * 0.5) * 6, env.wy * 0.8 + env.cam * 0.3 + drift * 10, 0.8, 'source-over');
      if (env.full) fillTex(ctx, w, FLAMES, env.wx + Math.sin(drift * 0.8) * 4, env.wy + env.cam * 0.15 + drift * 26, 0.55, 'lighter');
    } else {
      const g = ctx.createLinearGradient(0, H, 0, 4);
      g.addColorStop(0, 'rgba(255,170,60,0.6)');
      g.addColorStop(1, 'rgba(255,90,40,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, H);
    }
    innerDepth(ctx, w, 0.7);
    if (env.full) sheen(ctx, w, env, 0.18, [255, 220, 150], 20);
  },
};

/**
 * Partie vivante des matières rares : le reflet qui glisse (ou l'éclat de pixels). Séparée de la
 * base pour que le renderer mette la base en cache et ne redessine que ce calque léger.
 */
const LIVE: Partial<Record<MaterialSkin, (ctx: CanvasRenderingContext2D, w: number, env: MaterialEnv) => void>> = {
  marbre: (ctx, w, env) => sheen(ctx, w, env, 0.45),
  ceramique: (ctx, w, env) => sheen(ctx, w, env, 0.5),
  verre: (ctx, w, env) => sheen(ctx, w, env, 0.55, [235, 250, 255]),
  nacre: (ctx, w, env) => sheen(ctx, w, env, 0.6, [255, 245, 255], 20),
  mosaique: (ctx, w, env) => sheen(ctx, w, env, 0.5, [255, 250, 235], 14),
  pixel: (ctx, w, env) => {
    const span = 460;
    const pos = env.motion ? (((env.t * 60 - env.floor * 10) % span) + span) % span - 50 : 120;
    const lx = Math.round((pos - env.wx) / 5) * 5;
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    for (let k = 0; k < 6; k++) {
      const x = lx + k * 5 - Math.floor(k / 2) * 10;
      const y = H - 5 - k * 5;
      if (x < 0 || x > w - 5 || y < 0) continue;
      ctx.fillRect(x, y, 5, 5);
    }
  },
};

/** Matières dont la base ne dépend ni du temps ni de la caméra : le renderer peut la mettre en cache. */
export const CACHEABLE = new Set<MaterialSkin>(['gomme', 'strie', 'bonbon', 'graphite', 'bois', 'papier', 'marbre', 'ceramique', 'verre', 'nacre', 'pixel', 'mosaique']);

/** Motif propre à la matière, dessiné dans la brique déjà découpée (sous la face supérieure). */
export function paintMaterial(ctx: CanvasRenderingContext2D, w: number, color: Rgb, skin: MaterialSkin, env: MaterialEnv): void {
  const layer = env.layer ?? 'all';
  if (layer !== 'live') PAINTERS[skin](ctx, w, color, env, isRealContext(ctx));
  if (layer !== 'base' && env.full) LIVE[skin]?.(ctx, w, env);
}

/** Calque vivant seul (au-dessus d'une base en cache) ; false si la matière n'en a pas. */
export function hasLiveLayer(skin: MaterialSkin): boolean {
  return LIVE[skin] !== undefined;
}

/** Effets signés par les matières épiques et légendaires (pose, parfait, aura du bloc mobile). */
export interface SkinFx {
  readonly place?: { readonly kind: 'ember' | 'spark' | 'star' | 'glint' | 'bubble'; readonly colors: readonly Rgb[]; readonly count: number; readonly speed: number };
  readonly perfect?: { readonly kind: 'ember' | 'spark' | 'star' | 'glint' | 'bubble'; readonly colors: readonly Rgb[]; readonly count: number; readonly ring: Rgb };
  readonly aura?: Rgb;
}

export const SKIN_FX: Partial<Record<MaterialSkin, SkinFx>> = {
  circuit: { place: { kind: 'spark', colors: [[120, 255, 230], [255, 220, 120]], count: 6, speed: 150 } },
  holographique: { place: { kind: 'glint', colors: [...HOLO], count: 6, speed: 110 } },
  lave: { place: { kind: 'ember', colors: [[255, 150, 50], [255, 90, 30]], count: 7, speed: 120 } },
  or: { place: { kind: 'glint', colors: [[255, 230, 140], [255, 250, 220]], count: 5, speed: 90 } },
  neon: { place: { kind: 'spark', colors: [...NEON_TUBES], count: 7, speed: 160 } },
  vitrail: { place: { kind: 'glint', colors: [...JEWELS.slice(0, 6)], count: 7, speed: 110 } },
  phenix: {
    place: { kind: 'ember', colors: [[255, 200, 90], [255, 120, 40]], count: 9, speed: 150 },
    perfect: { kind: 'spark', colors: [[255, 220, 120], [255, 150, 60], [255, 255, 255]], count: 12, ring: [255, 190, 90] },
    aura: [255, 140, 60],
  },
  galaxie: {
    place: { kind: 'star', colors: [[200, 180, 255], [140, 200, 255], [255, 255, 255]], count: 8, speed: 120 },
    perfect: { kind: 'star', colors: [[220, 160, 255], [120, 220, 255], [255, 200, 240]], count: 12, ring: [190, 150, 255] },
    aura: [150, 110, 255],
  },
  cristal: {
    place: { kind: 'glint', colors: [[255, 255, 255], [200, 240, 255]], count: 7, speed: 120 },
    perfect: { kind: 'glint', colors: [...HOLO], count: 12, ring: [210, 245, 255] },
    aura: [200, 240, 255],
  },
  aurore: {
    place: { kind: 'star', colors: [[120, 255, 190], [200, 140, 255]], count: 8, speed: 100 },
    perfect: { kind: 'spark', colors: [[120, 255, 190], [200, 140, 255], [255, 255, 255]], count: 12, ring: [120, 255, 200] },
    aura: [110, 255, 200],
  },
  abysse: {
    place: { kind: 'bubble', colors: [[180, 240, 255], [120, 255, 230]], count: 8, speed: 70 },
    perfect: { kind: 'bubble', colors: [[180, 240, 255], [120, 255, 230]], count: 12, ring: [120, 230, 255] },
    aura: [90, 220, 255],
  },
};
