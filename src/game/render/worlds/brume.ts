/**
 * Forêt de brume (Rare, V8, collection sombre) : on part de la lisière au crépuscule, on traverse
 * un sous-bois où la brume dort entre les troncs, une clairière de menhirs couverts de mousse dont
 * les runes s'allument, des ruines englouties par les racines, puis on passe au-dessus de la canopée
 * sous une lune voilée, jusqu'à la nuit des feux follets.
 *
 * Lisibilité : le ciel reste un gris-vert sourd, jamais noir ; chaque plan de forêt est plus clair
 * que le précédent dans la brume (perspective aérienne), donc les ombres gardent leurs détails.
 * Découvertes : un cerf sur la crête, un hibou qui cligne, la lanterne d'un ermite, des champignons
 * qui luisent.
 */
import { CREAM, css, hex, mix, type Rgb } from '../color';
import {
  altitude, byStage, drifters, egg, fade, hash, layerY, orb, reveal, ridge, silhouette, sx, TAU,
  type Scene, type SceneEnv,
} from '../scene';
import type { Theme } from '../theme-types';
import { glow, ledge, star, twinkle } from './kit';

const BLOCKS = ['#8FA88A', '#C9B27A', '#7F9C9A', '#B7876A', '#9AA36B', '#C8C2A8'].map(hex);

/** Sapin sombre : triangle étagé (rapide, net à toutes les tailles). */
function fir(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, h: number, color: string): void {
  ctx.fillStyle = color;
  ctx.fillRect(x - 0.9 * s, y - h * 0.25 * s, 1.8 * s, h * 0.25 * s);
  ctx.beginPath();
  for (let k = 0; k < 4; k++) {
    const top = y - h * s * (0.3 + k * 0.2) - h * s * 0.22;
    const half = (h * 0.28 - k * h * 0.05) * s;
    ctx.moveTo(x - half, y - h * s * (0.22 + k * 0.2));
    ctx.lineTo(x, top);
    ctx.lineTo(x + half, y - h * s * (0.22 + k * 0.2));
  }
  ctx.fill();
}

/** Grand tronc moussu (premier plan du sous-bois). */
function trunk(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, h: number, bark: Rgb, moss: Rgb): void {
  ctx.fillStyle = css(bark);
  ctx.beginPath();
  ctx.moveTo(x - 6 * s, y);
  ctx.quadraticCurveTo(x - 4 * s, y - h * 0.5 * s, x - 3 * s, y - h * s);
  ctx.lineTo(x + 3 * s, y - h * s);
  ctx.quadraticCurveTo(x + 4 * s, y - h * 0.5 * s, x + 6 * s, y);
  ctx.closePath();
  ctx.fill();
  // Racines et mousse côté lumière (gauche).
  ctx.fillStyle = css(moss, 0.7);
  ctx.fillRect(x - 4.5 * s, y - h * 0.6 * s, 1.6 * s, h * 0.5 * s);
  ctx.fillStyle = css(bark);
  ctx.beginPath();
  ctx.ellipse(x - 8 * s, y - 1 * s, 5 * s, 1.6 * s, 0.3, 0, TAU);
  ctx.ellipse(x + 8 * s, y - 1 * s, 5 * s, 1.6 * s, -0.3, 0, TAU);
  ctx.fill();
}

/** Menhir couvert de mousse ; ses runes s'allument (0 → 1). */
function menhir(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, h: number, stone: Rgb, rune: number, t: number): void {
  ctx.fillStyle = css(stone);
  ctx.beginPath();
  ctx.moveTo(x - 5 * s, y);
  ctx.lineTo(x - 4 * s, y - h * 0.8 * s);
  ctx.quadraticCurveTo(x, y - h * 1.05 * s, x + 4.5 * s, y - h * 0.75 * s);
  ctx.lineTo(x + 5.5 * s, y);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = css(mix(stone, [255, 255, 255], 0.12));
  ctx.fillRect(x - 4 * s, y - h * 0.75 * s, 1.4 * s, h * 0.7 * s);
  ctx.fillStyle = 'rgba(70,110,60,0.55)';
  ctx.fillRect(x - 5 * s, y - h * 0.3 * s, 10 * s, h * 0.3 * s);
  if (rune > 0.02) {
    const a = rune * (0.65 + 0.35 * Math.sin(t * 1.7 + x));
    ctx.strokeStyle = `rgba(150,255,220,${a.toFixed(3)})`;
    ctx.lineWidth = 0.9 * s;
    ctx.beginPath();
    ctx.moveTo(x - 1 * s, y - h * 0.65 * s);
    ctx.lineTo(x + 1 * s, y - h * 0.5 * s);
    ctx.lineTo(x - 1 * s, y - h * 0.4 * s);
    ctx.moveTo(x + 1.5 * s, y - h * 0.62 * s);
    ctx.lineTo(x + 1.5 * s, y - h * 0.45 * s);
    ctx.stroke();
    glow(ctx, x, y - h * 0.52 * s, 8 * s, [120, 255, 210], a * 0.5);
  }
}

/** Arche de pierre en ruine, envahie de racines. */
function ruinArch(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, stone: Rgb): void {
  ctx.fillStyle = css(stone);
  ctx.fillRect(x - 30 * s, y - 34 * s, 9 * s, 34 * s);
  ctx.fillRect(x + 21 * s, y - 24 * s, 9 * s, 24 * s);
  ctx.beginPath();
  ctx.arc(x, y - 34 * s, 30 * s, Math.PI, Math.PI * 1.62);
  ctx.arc(x, y - 34 * s, 21 * s, Math.PI * 1.62, Math.PI, true);
  ctx.closePath();
  ctx.fill();
  // Racines qui pendent.
  ctx.strokeStyle = css(mix(stone, [40, 60, 40], 0.6));
  ctx.lineWidth = 1.2 * s;
  for (let k = 0; k < 5; k++) {
    ctx.beginPath();
    ctx.moveTo(x - 24 * s + k * 5 * s, y - 50 * s + k * 2 * s);
    ctx.quadraticCurveTo(x - 22 * s + k * 5 * s, y - 38 * s, x - 25 * s + k * 6 * s, y - (28 - k * 3) * s);
    ctx.stroke();
  }
}

function deer(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, color: Rgb, head: number): void {
  ctx.fillStyle = css(color);
  ctx.beginPath();
  ctx.ellipse(x, y - 9 * s, 8 * s, 4 * s, 0, 0, TAU);
  ctx.fill();
  ctx.fillRect(x - 6 * s, y - 7 * s, 1.3 * s, 7 * s);
  ctx.fillRect(x - 3 * s, y - 7 * s, 1.3 * s, 7 * s);
  ctx.fillRect(x + 3 * s, y - 7 * s, 1.3 * s, 7 * s);
  ctx.fillRect(x + 6 * s, y - 7 * s, 1.3 * s, 7 * s);
  ctx.fillRect(x + 6 * s, y - 16 * s + head * s, 2 * s, 8 * s);
  ctx.beginPath();
  ctx.ellipse(x + 8.5 * s, y - 16 * s + head * s, 3 * s, 1.8 * s, 0.2, 0, TAU);
  ctx.fill();
  // Bois du cerf.
  ctx.strokeStyle = css(color);
  ctx.lineWidth = 0.9 * s;
  ctx.beginPath();
  ctx.moveTo(x + 7 * s, y - 17 * s + head * s);
  ctx.lineTo(x + 5 * s, y - 24 * s + head * s);
  ctx.lineTo(x + 3 * s, y - 26 * s + head * s);
  ctx.moveTo(x + 5.6 * s, y - 21 * s + head * s);
  ctx.lineTo(x + 8 * s, y - 24 * s + head * s);
  ctx.moveTo(x + 8 * s, y - 17 * s + head * s);
  ctx.lineTo(x + 11 * s, y - 23 * s + head * s);
  ctx.stroke();
}

function owl(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, blink: boolean): void {
  ctx.fillStyle = '#3A3428';
  ctx.beginPath();
  ctx.ellipse(x, y, 4 * s, 5.5 * s, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = blink ? '#3A3428' : '#F2C14E';
  ctx.beginPath();
  ctx.arc(x - 1.6 * s, y - 2 * s, 1.2 * s, 0, TAU);
  ctx.arc(x + 1.6 * s, y - 2 * s, 1.2 * s, 0, TAU);
  ctx.fill();
}

/** Brume en bandes horizontales douces (plan `p`, à `y` unités). */
function mistBand(env: SceneEnv, y: number, p: number, color: Rgb, alpha: number, drift: number): void {
  const Y = layerY(env, y, p);
  if (Y < -80 || Y > env.h + 80 || alpha <= 0.01) return;
  const { ctx, w } = env;
  const g = ctx.createLinearGradient(0, Y - 26, 0, Y + 26);
  g.addColorStop(0, css(color, 0));
  g.addColorStop(0.5, css(color, alpha));
  g.addColorStop(1, css(color, 0));
  ctx.fillStyle = g;
  const off = env.motion ? (env.t * drift) % 120 : 0;
  ctx.beginPath();
  for (let x = -120; x <= w + 120; x += 30) {
    const yy = Y - 26 + Math.sin((x + off) * 0.03) * 5;
    if (x === -120) ctx.moveTo(x + off, yy);
    else ctx.lineTo(x + off, yy);
  }
  ctx.lineTo(w + 120, Y + 26);
  ctx.lineTo(-120, Y + 26);
  ctx.closePath();
  ctx.fill();
}

const scene: Scene = {
  far(env: SceneEnv) {
    const { ctx, w, h } = env;
    // Lune voilée : pâle derrière la brume, plus nette au-dessus de la canopée.
    const clear = fade(env, 30, 42);
    orb(ctx, w * 0.7, h * (0.2 - clear * 0.06), 15 + clear * 5, [236, 240, 222], 0.9 + clear * 0.6, 0.35 + clear * 0.5);
    if (clear > 0.05) {
      for (let k = 0; k < 40; k++) {
        const a = clear * 0.6 * (env.motion ? 0.6 + 0.4 * Math.sin(env.t * 1.3 + k) : 0.8);
        ctx.fillStyle = `rgba(236,240,222,${a.toFixed(3)})`;
        ctx.fillRect(hash(k, 701) * w, hash(k, 702) * h * 0.5, 1, 1);
      }
    }
  },
  back(env: SceneEnv) {
    const { ctx } = env;
    const s = env.scale;
    const fog = byStage(env, [[120, 140, 130], [104, 124, 116], [92, 112, 108], [82, 102, 100], [70, 88, 90], [52, 70, 74]]);
    // Trois rangées de forêt : la plus lointaine se fond dans la brume.
    const rows: [number, number, number, number][] = [[0.1, 40, 0.75, 11], [0.2, 26, 0.5, 23], [0.32, 14, 0.25, 37]];
    rows.forEach(([p, base, haze, seed], r) => {
      const tone = mix(byStage(env, [[34, 48, 40], [30, 44, 38], [28, 40, 36], [26, 36, 34], [22, 32, 32], [16, 24, 26]]), fog, haze);
      silhouette(env, p, 0, (x) => base * 0.5 + 6 * ridge(x, seed, 0.02), css(tone));
      const color = css(tone);
      for (let k = 0; k < 16; k++) {
        const x = -200 + k * 26 + hash(k, seed) * 18;
        const X = sx(env, x);
        const Y = layerY(env, base * 0.5 + 6 * ridge(x, seed, 0.02) - 2, p);
        if (Y > env.h + 60 || Y < -120) continue;
        fir(ctx, X, Y, s * (0.8 + r * 0.25), 34 + hash(k, seed + 1) * 26 + r * 8, color);
      }
      if (r < 2) mistBand(env, base * 0.5 + 10, p, fog, 0.55 - r * 0.12, 4 + r * 3);
    });
    // Clairière aux menhirs (vers 10 étages) : les runes s'allument en montant.
    const my = layerY(env, altitude(env, 10, 0.36), 0.36);
    const stones = reveal(env, 10);
    if (stones > 0 && my > -80 && my < env.h + 80) {
      const rockTop: [number, number, number] = [92, 118, 76];
      const rockBody = mix(byStage(env, [[40, 50, 44], [36, 46, 42], [34, 42, 40], [30, 38, 38], [26, 34, 34], [20, 28, 30]]), fog, 0.25);
      ledge(ctx, env.w, env.h, -1, my, sx(env, -100), rockTop, rockBody, stones);
      ledge(ctx, env.w, env.h, 1, my, env.w - sx(env, 100), rockTop, rockBody, stones);
      ctx.globalAlpha = stones;
      const stone = byStage(env, [[96, 104, 96], [90, 98, 92], [84, 92, 88], [76, 84, 82], [66, 74, 74], [56, 62, 64]]);
      const rune = fade(env, 9, 14);
      for (const [x, h] of [[-150, 30], [-118, 22], [120, 26], [150, 34]] as const) menhir(ctx, sx(env, x), my, s, h, stone, rune, env.t);
      ctx.globalAlpha = 1;
    }
    // Ruines englouties par les racines (vers 22 étages).
    const ry = layerY(env, altitude(env, 22, 0.38), 0.38);
    const ruins = reveal(env, 22);
    if (ruins > 0 && ry > -100 && ry < env.h + 100) {
      ledge(ctx, env.w, env.h, -1, ry, sx(env, -88), [92, 118, 76], mix([30, 38, 36], fog, 0.25), ruins);
      ctx.globalAlpha = ruins;
      ruinArch(ctx, sx(env, -128), ry, s, byStage(env, [[100, 104, 92], [96, 100, 90], [90, 94, 86], [80, 86, 80], [70, 76, 72], [58, 64, 62]]));
      if (egg(env, 3, 0.5)) {
        // La lanterne d'un ermite, posée au pied de l'arche.
        const lx = sx(env, -122);
        ctx.fillStyle = '#2A241C';
        ctx.fillRect(lx - 2 * s, ry - 6 * s, 4 * s, 6 * s);
        glow(ctx, lx, ry - 3 * s, 14 * s, [255, 190, 90], 0.75 + (env.motion ? 0.15 * Math.sin(env.t * 5) : 0));
      }
      ctx.globalAlpha = 1;
    }
    // Cerf sur la crête (souvent), qui relève la tête.
    const dy = layerY(env, 14 + 6 * ridge(60, 23, 0.02), 0.2);
    if (egg(env, 1, 0.6) && dy < env.h + 30 && fade(env, 2, 6) > 0) {
      const head = env.motion ? Math.max(0, Math.sin(env.t * 0.4)) * 4 : 0;
      ctx.globalAlpha = fade(env, 2, 6);
      deer(ctx, sx(env, 60), dy, s * 0.8, mix([26, 36, 32], fog, 0.35), head);
      ctx.globalAlpha = 1;
    }
    // Canopée vue de dessus (35 étages et plus) : cimes noyées dans la mer de brume.
    const canopy = fade(env, 30, 40);
    if (canopy > 0.02) {
      const top = altitude(env, 40, 0.5);
      silhouette(env, 0.5, top - 30, (x) => 10 + 8 * ridge(x, 51, 0.03), css(mix([20, 32, 30], fog, 0.3), canopy));
      mistBand(env, top - 14, 0.5, mix(fog, [220, 228, 214], 0.3), 0.6 * canopy, 6);
    }
  },
  near(env: SceneEnv) {
    const { ctx } = env;
    // Brume basse qui traverse l'écran.
    const low = 1 - fade(env, 34, 44);
    if (low > 0.02) {
      drifters(env, 6, 81, (c, x, y, k) => {
        const g = c.createRadialGradient(x, y, 0, x, y, 60);
        g.addColorStop(0, `rgba(210,222,206,${(0.12 * low).toFixed(3)})`);
        g.addColorStop(1, 'rgba(210,222,206,0)');
        c.fillStyle = g;
        c.fillRect(x - 60, y - 60, 120, 120);
        void k;
      }, { x: 10, y: 0 });
    }
    // Lucioles (sous-bois) puis feux follets bleu-vert (au sommet).
    const flies = fade(env, 4, 8);
    if (flies > 0.02) {
      drifters(env, 14, 83, (c, x, y, k) => {
        const a = flies * (env.motion ? 0.4 + 0.6 * Math.max(0, Math.sin(env.t * 2.2 + k * 1.7)) : 0.7);
        glow(c, x, y, 6, [214, 255, 140], a * 0.55);
        c.fillStyle = `rgba(240,255,190,${a.toFixed(3)})`;
        c.fillRect(x - 0.8, y - 0.8, 1.6, 1.6);
      }, { x: 5, y: -7 });
    }
    const wisps = fade(env, 46, 52);
    if (wisps > 0.02) {
      drifters(env, 6, 89, (c, x, y, k) => {
        const a = wisps * (env.motion ? 0.6 + 0.4 * Math.sin(env.t * 1.5 + k) : 0.8);
        glow(c, x, y, 16, [130, 255, 220], a * 0.6);
        glow(c, x, y, 5, [230, 255, 250], a);
      }, { x: 8, y: -4 });
    }
    // Hibou sur une branche haute, qui cligne parfois.
    if (egg(env, 2, 0.5) && env.full) {
      const oy = layerY(env, altitude(env, 30, 0.6), 0.6);
      if (oy > -20 && oy < env.h + 20 && reveal(env, 30) > 0.3) {
        ctx.fillStyle = '#1C2620';
        ctx.fillRect(env.w - 70, oy + 5 * env.scale, 70, 2.5 * env.scale);
        owl(ctx, env.w - 34, oy, env.scale, env.motion && Math.sin(env.t * 0.9) > 0.97);
      }
    }
    // Grands troncs du premier plan (bords de l'écran), plus sombres mais détaillés.
    if (env.full && fade(env, 0, 1) >= 0 && env.height < 34) {
      const fy = layerY(env, 0, 1);
      if (fy > 0) {
        const bark = byStage(env, [[44, 40, 34], [40, 36, 30], [36, 34, 30], [34, 32, 30], [30, 30, 30], [26, 26, 28]]);
        trunk(ctx, 10, fy + 6, env.scale * 1.4, 180, bark, [70, 96, 58]);
        trunk(ctx, env.w - 6, fy + 6, env.scale * 1.2, 200, bark, [70, 96, 58]);
      }
    }
  },
  ground(env: SceneEnv, top: number) {
    const { ctx, w, h } = env;
    if (top >= h) return;
    ctx.fillStyle = css(byStage(env, [[44, 56, 40], [40, 52, 38], [36, 48, 36], [34, 44, 36], [30, 40, 34], [24, 32, 30]]));
    ctx.fillRect(0, top, w, h - top);
    // Mousse claire, fougères et champignons qui luisent.
    for (let k = 0; k < 22; k++) {
      const x = hash(k, 91) * w;
      const y = top + 3 + hash(k, 92) * Math.max(0, h - top - 6);
      ctx.fillStyle = `rgba(110,140,80,${(0.35 + hash(k, 93) * 0.3).toFixed(3)})`;
      ctx.beginPath();
      ctx.ellipse(x, y, 6 + hash(k, 94) * 8, 1.6, 0, 0, TAU);
      ctx.fill();
    }
    ctx.strokeStyle = 'rgba(90,120,70,0.8)';
    ctx.lineWidth = 1;
    for (let k = 0; k < 10; k++) {
      const x = hash(k, 95) * w;
      ctx.beginPath();
      for (let j = -3; j <= 3; j++) {
        ctx.moveTo(x, top + 2);
        ctx.lineTo(x + j * 3, top - 6 + Math.abs(j) * 1.5);
      }
      ctx.stroke();
    }
    if (egg(env, 4, 0.7)) {
      for (let k = 0; k < 5; k++) {
        const x = hash(k, 97) * w;
        const pulse = env.motion ? 0.6 + 0.4 * Math.sin(env.t * 1.2 + k) : 0.8;
        ctx.fillStyle = '#D8E8C8';
        ctx.fillRect(x - 0.6, top - 3, 1.2, 3);
        ctx.fillStyle = '#9FE8C8';
        ctx.beginPath();
        ctx.ellipse(x, top - 3.5, 2.6, 1.4, 0, Math.PI, 0);
        ctx.fill();
        glow(ctx, x, top - 3, 7, [140, 255, 210], 0.35 * pulse);
      }
    }
  },
};

export const brume: Theme = {
  id: 'brume',
  name: 'Forêt de brume',
  rarity: 'rare',
  blocks: BLOCKS,
  sparks: ['#D6FF8C', '#9FE8C8', '#F2E6B8', '#FFFFFF'].map(hex),
  ground: { top: hex('#3A4A34'), body: hex('#2C3A2A') },
  audio: { wave: 'triangle', root: 293.66, scale: [0, 2, 3, 5, 7, 8, 10, 12, 14, 15, 17] },
  scene,
  tiers: [
    { name: 'Lisière', skyTop: hex('#33433D'), skyBottom: hex('#7A9286'), ink: CREAM, decor: (ctx, it, t, motion) => star(ctx, 1.5 + it.r2, [230, 236, 220], twinkle(it, t, motion, 0.25)) },
    {
      name: 'Sous-bois', skyTop: hex('#2B3A35'), skyBottom: hex('#64807A'), ink: CREAM,
      decor: (ctx, it, t, motion) => {
        // Feuille qui tombe en tournoyant.
        ctx.rotate((motion ? t * 1.2 : 0) + it.r1 * 6);
        ctx.fillStyle = 'rgba(176,140,70,0.75)';
        ctx.beginPath();
        ctx.ellipse(0, 0, 4, 1.8, 0, 0, TAU);
        ctx.fill();
      },
    },
    { name: 'Clairière aux menhirs', skyTop: hex('#25332F'), skyBottom: hex('#566F6A'), ink: CREAM, decor: (ctx, it, t, motion) => glow(ctx, 0, 0, 5, [200, 255, 150], twinkle(it, t, motion, 0.5)) },
    {
      name: 'Ruines englouties', skyTop: hex('#202D2C'), skyBottom: hex('#4B6262'), ink: CREAM,
      decor: (ctx, it, t, motion) => {
        // Chauve-souris lointaine.
        const flap = motion ? Math.sin(t * 9 + it.r1 * 7) : 0;
        ctx.fillStyle = 'rgba(20,24,24,0.8)';
        ctx.beginPath();
        ctx.moveTo(-7, flap * 2);
        ctx.quadraticCurveTo(-3, -3, 0, 0);
        ctx.quadraticCurveTo(3, -3, 7, flap * 2);
        ctx.quadraticCurveTo(0, 2, -7, flap * 2);
        ctx.fill();
      },
    },
    { name: 'Au-dessus de la canopée', skyTop: hex('#1A2529'), skyBottom: hex('#3E5459'), ink: CREAM, decor: (ctx, it, t, motion) => star(ctx, 2 + it.r2 * 2, [236, 240, 222], twinkle(it, t, motion, 0.6)) },
    { name: 'Nuit des feux follets', skyTop: hex('#121B1F'), skyBottom: hex('#30474D'), ink: CREAM, decor: (ctx, it, t, motion) => glow(ctx, 0, 0, 9, [130, 255, 220], twinkle(it, t, motion, 0.7)) },
  ],
};
