/**
 * Désert (Commun, V7) : un campement au pied des dunes, une oasis, le grand erg, un vent de sable,
 * un soleil couchant énorme, puis la nuit du désert et sa Voie lactée. Découvertes : un chameau à
 * lunettes de soleil dans la caravane, un tapis volant qui passe avec un chat endormi dessus.
 */
import { CREAM, INK, css, hex, mix, type Rgb } from '../color';
import {
  altitude, byStage, drifters, egg, fade, hash, layerY, orb, reveal, ridge, silhouette, starfield, sx, TAU,
  type Scene, type SceneEnv,
} from '../scene';
import type { Theme } from '../theme-types';
import { star, twinkle } from './kit';

const BLOCKS = ['#D9492E', '#1F9E8F', '#7E57C2', '#E09A1A', '#C2185B', '#2F6FB5'].map(hex);

function cactus(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, color: Rgb): void {
  ctx.fillStyle = css(color);
  const arm = (dx: number, h: number, up: number) => {
    ctx.fillRect(x + dx * s, y - h * s, 4 * s, 3.5 * s);
    ctx.fillRect(x + (dx + (dx < 0 ? 0 : 1)) * s, y - (h + up) * s, 3.5 * s, up * s);
  };
  ctx.beginPath();
  ctx.ellipse(x + 2 * s, y - 15 * s, 2.6 * s, 15 * s, 0, 0, TAU);
  ctx.fill();
  arm(-5, 12, 7);
  arm(4, 16, 6);
}

function palm(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, sway: number): void {
  ctx.strokeStyle = '#8A5A2B';
  ctx.lineWidth = 2.4 * s;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.quadraticCurveTo(x + 4 * s, y - 14 * s, x + 2 * s + sway, y - 28 * s);
  ctx.stroke();
  ctx.fillStyle = '#2F8A4A';
  for (let k = 0; k < 5; k++) {
    const a = -Math.PI / 2 + (k - 2) * 0.6 + sway * 0.05;
    ctx.save();
    ctx.translate(x + 2 * s + sway, y - 28 * s);
    ctx.rotate(a);
    ctx.beginPath();
    ctx.ellipse(8 * s, 0, 9 * s, 2.4 * s, 0.25, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
}

function tent(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, lit: number): void {
  ctx.fillStyle = '#E8D2A8';
  ctx.beginPath();
  ctx.moveTo(x - 16 * s, y);
  ctx.lineTo(x, y - 18 * s);
  ctx.lineTo(x + 16 * s, y);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#B5482F';
  ctx.fillRect(x - 16 * s, y - 3 * s, 32 * s, 2 * s);
  ctx.fillStyle = lit > 0 ? `rgba(255,190,90,${(0.4 + lit * 0.6).toFixed(3)})` : '#6E4A2A';
  ctx.beginPath();
  ctx.moveTo(x - 4 * s, y);
  ctx.lineTo(x, y - 9 * s);
  ctx.lineTo(x + 4 * s, y);
  ctx.closePath();
  ctx.fill();
}

function camel(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, step: number, color: Rgb, shades: boolean): void {
  ctx.fillStyle = css(color);
  ctx.beginPath();
  ctx.ellipse(x, y - 10 * s, 9 * s, 5 * s, 0, 0, TAU);
  ctx.ellipse(x - 2 * s, y - 14 * s, 4 * s, 4 * s, 0, 0, TAU);
  ctx.ellipse(x + 3 * s, y - 13 * s, 3.5 * s, 3.5 * s, 0, 0, TAU);
  ctx.fill();
  ctx.fillRect(x + 7 * s, y - 16 * s, 2 * s, 8 * s);
  ctx.beginPath();
  ctx.ellipse(x + 10 * s, y - 16 * s, 3 * s, 1.8 * s, 0, 0, TAU);
  ctx.fill();
  for (const [dx, ph] of [[-6, 0], [-3, 1.6], [3, 3.1], [6, 4.7]] as const) {
    const lift = Math.max(0, Math.sin(step + ph)) * 2 * s;
    ctx.fillRect(x + dx * s, y - 7 * s, 1.4 * s, 7 * s - lift);
  }
  if (shades) {
    ctx.fillStyle = '#111';
    ctx.fillRect(x + 9 * s, y - 17.5 * s, 3.2 * s, 1.4 * s);
  }
}

function flyingCarpet(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, t: number): void {
  ctx.save();
  ctx.translate(x, y);
  const wave = (k: number) => Math.sin(t * 4 + k) * 2 * s;
  ctx.fillStyle = '#A3243A';
  ctx.beginPath();
  ctx.moveTo(-18 * s, wave(0));
  for (let k = -18; k <= 18; k += 6) ctx.lineTo(k * s, wave(k * 0.2));
  ctx.lineTo(18 * s, 5 * s + wave(4));
  for (let k = 18; k >= -18; k -= 6) ctx.lineTo(k * s, 5 * s + wave(k * 0.2 + 1));
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#F2C14E';
  ctx.lineWidth = 1 * s;
  ctx.stroke();
  // Le chat endormi (une boule orange et sa queue).
  ctx.fillStyle = '#F2994A';
  ctx.beginPath();
  ctx.ellipse(2 * s, -3 * s + wave(1), 5 * s, 3.4 * s, 0, 0, TAU);
  ctx.arc(-3 * s, -4 * s + wave(1), 2.6 * s, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#F2994A';
  ctx.fillRect(-5 * s, -7.5 * s + wave(1), 1.2 * s, 2 * s);
  ctx.fillRect(-2 * s, -7.5 * s + wave(1), 1.2 * s, 2 * s);
  ctx.restore();
}

const scene: Scene = {
  far(env: SceneEnv) {
    const { ctx, w, h } = env;
    const night = fade(env, 42, 52);
    const dusk = fade(env, 26, 38) * (1 - night);
    // Soleil blanc du matin, énorme et orangé au couchant.
    orb(ctx, w * 0.72, h * (0.16 + dusk * 0.32), 22 + dusk * 30, mix([255, 252, 236], [255, 140, 70], dusk), 1.2, 1 - night);
    if (night > 0) {
      // Voie lactée : une bande de poussière d'étoiles en diagonale.
      const g = ctx.createLinearGradient(0, h * 0.05, w, h * 0.45);
      g.addColorStop(0, 'rgba(200,190,255,0)');
      g.addColorStop(0.5, `rgba(220,210,255,${(0.16 * night).toFixed(3)})`);
      g.addColorStop(1, 'rgba(200,190,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(0, h * 0.18);
      ctx.lineTo(w, h * 0.02);
      ctx.lineTo(w, h * 0.16);
      ctx.lineTo(0, h * 0.34);
      ctx.closePath();
      ctx.fill();
      starfield(env, 90, night, 41);
      orb(ctx, w * 0.24, h * 0.14, 16, [245, 240, 225], 0.8, night);
    }
  },
  back(env: SceneEnv) {
    const { ctx } = env;
    // Dunes lointaines, puis dunes proches avec le campement, les cactus et l'oasis.
    const far = byStage(env, [[240, 200, 150], [236, 196, 146], [232, 186, 132], [226, 170, 120], [200, 110, 90], [70, 50, 90]]);
    silhouette(env, 0.12, 0, (x) => 52 + 30 * ridge(x, 5, 0.01) + 10 * Math.sin(x * 0.03), css(far, 0.95));
    const near = byStage(env, [[246, 210, 158], [244, 204, 150], [240, 196, 140], [234, 182, 128], [214, 128, 96], [86, 62, 104]]);
    const duneH = (x: number) => 22 + 14 * ridge(x, 9, 0.016);
    silhouette(env, 0.3, 0, duneH, css(near));
    const s = env.scale * 0.9;
    const lit = fade(env, 38, 48);
    const shade = byStage(env, [[60, 140, 70], [56, 132, 66], [52, 120, 62], [60, 110, 60], [80, 70, 60], [30, 30, 50]]);
    for (const [x, kind] of [[-160, 'cactus'], [-120, 'tent'], [-82, 'palm'], [-60, 'palm'], [95, 'cactus'], [140, 'tent'], [178, 'cactus']] as const) {
      const X = sx(env, x);
      const Y = layerY(env, duneH(x) - 2, 0.3);
      if (Y > env.h + 40) continue;
      if (kind === 'cactus') cactus(ctx, X, Y, s, shade);
      else if (kind === 'palm') palm(ctx, X, Y, s, env.motion ? Math.sin(env.t * 0.8 + x) * 1.5 : 0);
      else tent(ctx, X, Y, s, lit);
    }
    // L'oasis : un petit lac qui reflète le ciel.
    const oy = layerY(env, duneH(-70) - 3, 0.3);
    if (oy < env.h + 20) {
      ctx.fillStyle = css(mix([90, 190, 210], [40, 50, 110], fade(env, 40, 50)), 0.9);
      ctx.beginPath();
      ctx.ellipse(sx(env, -70), oy + 1, 24 * s, 3.5 * s, 0, 0, TAU);
      ctx.fill();
    }
    // Caravane sur la crête des dunes lointaines (vers 8 étages), avec parfois un chameau à lunettes.
    const cy = layerY(env, 52 + 30 * ridge(0, 5, 0.01), 0.12);
    const caravan = reveal(env, 6);
    if (cy < env.h + 20 && caravan > 0) {
      const base = env.motion ? ((env.t * 6) % (env.w + 200)) - 100 : env.w * 0.35;
      const tone = byStage(env, [[150, 100, 60], [150, 100, 60], [140, 92, 56], [130, 84, 50], [110, 60, 50], [40, 30, 60]]);
      ctx.globalAlpha = caravan;
      for (let k = 0; k < 4; k++) {
        camel(ctx, base - k * 26 * s, cy + 2, s * 0.8, env.motion ? env.t * 3 + k : k, tone, k === 2 && egg(env, 1, 0.4));
      }
      ctx.globalAlpha = 1;
    }
    // Mirage : un lac qui tremble dans l'air chaud du grand erg (vers 12 étages).
    const my = layerY(env, altitude(env, 12, 0.4), 0.4);
    const mirage = reveal(env, 12) * (1 - fade(env, 22, 28));
    if (mirage > 0 && my > -40 && my < env.h + 40) {
      for (let k = 0; k < 4; k++) {
        const wob = env.motion ? Math.sin(env.t * 2 + k) * 6 : 0;
        ctx.fillStyle = `rgba(150,215,240,${(0.22 * mirage).toFixed(3)})`;
        ctx.fillRect(sx(env, -120) + wob, my + k * 3, 240 * env.scale, 1.5);
      }
    }
    // Tapis volant avec son chat endormi (vers 22 étages).
    const ty = layerY(env, altitude(env, 22, 0.42), 0.42);
    if (egg(env, 2, 0.55) && reveal(env, 22) > 0.4 && ty > -60 && ty < env.h + 60) {
      const p = env.motion ? (env.t % 16) / 16 : 0.4;
      flyingCarpet(ctx, -40 + p * (env.w + 80), ty, env.scale, env.motion ? env.t : 0);
    }
  },
  near(env: SceneEnv) {
    // Vent de sable : grains qui filent à l'horizontale entre 18 et 32 étages.
    const wind = fade(env, 15, 20) * (1 - fade(env, 30, 36));
    if (wind > 0.02) {
      drifters(env, 34, 61, (ctx, x, y) => {
        ctx.fillStyle = `rgba(214,170,110,${(0.55 * wind).toFixed(3)})`;
        ctx.fillRect(x, y, 6, 1.2);
      }, { x: 160, y: 6 });
    }
    const night = fade(env, 44, 52);
    if (night > 0.02) {
      drifters(env, 10, 67, (ctx, x, y, i) => {
        ctx.fillStyle = `rgba(255,236,190,${(night * (env.motion ? 0.35 + 0.35 * Math.sin(env.t * 3 + i) : 0.5)).toFixed(3)})`;
        ctx.fillRect(x, y, 1.4, 1.4);
      }, { x: 2, y: -4 });
    }
  },
  ground(env: SceneEnv, top: number) {
    const { ctx, w, h } = env;
    if (top >= h) return;
    const night = fade(env, 44, 52);
    ctx.fillStyle = css(mix([238, 196, 140], [90, 70, 110], night));
    ctx.fillRect(0, top, w, h - top);
    // Rides du sable.
    ctx.strokeStyle = css(mix([214, 166, 110], [70, 54, 90], night), 0.8);
    ctx.lineWidth = 1.2;
    for (let row = 0; row < 6; row++) {
      const y0 = top + 8 + row * 9;
      if (y0 > h) break;
      ctx.beginPath();
      for (let x = 0; x <= w; x += 8) {
        const y = y0 + Math.sin(x * 0.06 + row * 1.3) * 2;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    for (let k = 0; k < 14; k++) {
      ctx.fillStyle = css(mix([170, 120, 80], [60, 50, 80], night), 0.85);
      ctx.beginPath();
      ctx.ellipse(hash(k, 31) * w, top + 6 + hash(k, 32) * Math.max(0, h - top - 8), 2 + hash(k, 33) * 2.5, 1.4, 0, 0, TAU);
      ctx.fill();
    }
  },
};

export const desert: Theme = {
  id: 'desert',
  name: 'Désert',
  rarity: 'commun',
  blocks: BLOCKS,
  sparks: ['#FFC34D', '#FF7A45', '#2EC4B6', '#FFF1C1'].map(hex),
  ground: { top: hex('#F3D2A0'), body: hex('#EEC48C') },
  audio: { wave: 'triangle', root: 440, scale: [0, 1, 4, 5, 7, 8, 10, 12, 13, 16, 17] },
  scene,
  tiers: [
    {
      name: 'Dunes au matin', skyTop: hex('#F4A25A'), skyBottom: hex('#FFF4DF'), ink: INK,
      decor: (ctx, it, t, motion) => star(ctx, 2 + it.r2 * 2, [255, 255, 255], twinkle(it, t, motion, 0.3)),
    },
    {
      name: 'Oasis', skyTop: hex('#FFD49A'), skyBottom: hex('#FFF0D0'), ink: INK,
      decor: (ctx, it, t, motion) => {
        // Libellule de l'oasis.
        const flap = motion ? Math.sin(t * 30 + it.r1 * 9) * 0.5 : 0;
        ctx.fillStyle = 'rgba(40,150,160,0.75)';
        ctx.fillRect(-6, -0.8, 12, 1.6);
        ctx.fillStyle = 'rgba(200,240,255,0.55)';
        ctx.beginPath();
        ctx.ellipse(-1, -3 - flap, 5, 1.6, -0.3, 0, TAU);
        ctx.ellipse(-1, 3 + flap, 5, 1.6, 0.3, 0, TAU);
        ctx.fill();
      },
    },
    {
      name: 'Grand erg', skyTop: hex('#FFC584'), skyBottom: hex('#FFE6C0'), ink: INK,
      decor: (ctx, it, t, motion) => {
        // Faucon qui plane.
        const flap = motion ? Math.sin(t * 2 + it.r1 * 6) * 0.3 : 0;
        ctx.strokeStyle = 'rgba(110,70,40,0.75)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-10, -2 + flap * 6);
        ctx.quadraticCurveTo(-4, -6, 0, 0);
        ctx.quadraticCurveTo(4, -6, 10, -2 + flap * 6);
        ctx.stroke();
      },
    },
    {
      name: 'Vent de sable', skyTop: hex('#EEA870'), skyBottom: hex('#FFD7A4'), ink: INK,
      decor: (ctx, it, t, motion) => {
        // Boule d'herbes sèches qui roule.
        ctx.rotate((motion ? t * 3 : 0) + it.r1 * 6);
        ctx.strokeStyle = 'rgba(140,100,60,0.7)';
        ctx.lineWidth = 1;
        for (let k = 0; k < 4; k++) {
          ctx.beginPath();
          ctx.arc(0, 0, 6 + k * 0.8, k, k + 4.2);
          ctx.stroke();
        }
      },
    },
    {
      name: 'Couchant sur l’erg', skyTop: hex('#E06F58'), skyBottom: hex('#FFB574'), ink: INK,
      decor: (ctx, it, t, motion) => star(ctx, 3 + it.r2 * 3, [255, 236, 200], twinkle(it, t, motion, 0.6)),
    },
    {
      name: 'Nuit du désert', skyTop: hex('#1B1F4A'), skyBottom: hex('#5A3F7A'), ink: CREAM,
      decor: (ctx, it, t, motion) => star(ctx, 4 + it.r2 * 5, CREAM, twinkle(it, t, motion, 0.85)),
    },
  ],
};
