/**
 * Jardin (Rare) : un potager clôturé, des haies fleuries, la cime des grands arbres, des
 * cerfs-volants, un soleil couchant puis la nuit des lucioles. Découvertes : un escargot avec
 * son petit drapeau sur la clôture, une chouette qui cligne de l'œil.
 */
import { CREAM, INK, css, darken, hex, mix, type Rgb } from '../color';
import {
  altitude, byStage, cloud, drifters, egg, fade, hash, layerY, orb, reveal, ridge, silhouette, starfield, sx, TAU,
  type Scene, type SceneEnv,
} from '../scene';
import type { Theme } from '../theme-types';
import { bird, glow, puff, star, twinkle } from './kit';

const LEAF = hex('#4CAF7A');
const BLOCKS = ['#4CAF7A', '#FFB840', '#FF8F6B', '#5FB7EE', '#B48BE0', '#E5537A'].map(hex);

function tree(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, leaf: Rgb, trunk: Rgb): void {
  ctx.fillStyle = css(trunk);
  ctx.fillRect(x - 3 * s, y - 26 * s, 6 * s, 26 * s);
  ctx.fillStyle = css(leaf);
  ctx.beginPath();
  ctx.arc(x, y - 34 * s, 16 * s, 0, TAU);
  ctx.arc(x - 12 * s, y - 26 * s, 11 * s, 0, TAU);
  ctx.arc(x + 12 * s, y - 27 * s, 12 * s, 0, TAU);
  ctx.fill();
  ctx.fillStyle = css(mix(leaf, [255, 255, 220], 0.25), 0.6);
  ctx.beginPath();
  ctx.arc(x - 5 * s, y - 40 * s, 6 * s, 0, TAU);
  ctx.fill();
}

function flower(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, c: Rgb, sway: number): void {
  ctx.strokeStyle = css(darken(LEAF, 0.15));
  ctx.lineWidth = 1.4 * s;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.quadraticCurveTo(x + sway, y - 7 * s, x + sway, y - 13 * s);
  ctx.stroke();
  ctx.fillStyle = css(c);
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * TAU;
    ctx.beginPath();
    ctx.arc(x + sway + Math.cos(a) * 3 * s, y - 13 * s + Math.sin(a) * 3 * s, 2.4 * s, 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = '#FFE27A';
  ctx.beginPath();
  ctx.arc(x + sway, y - 13 * s, 1.8 * s, 0, TAU);
  ctx.fill();
}

const scene: Scene = {
  far(env: SceneEnv) {
    const { ctx, w, h } = env;
    const night = fade(env, 42, 52);
    const dusk = fade(env, 26, 38) * (1 - night);
    orb(ctx, w * 0.2, h * (0.16 + dusk * 0.32), 22 + dusk * 22, mix([255, 246, 200], [255, 140, 70], dusk), 1.2, 1 - night);
    if (night > 0) {
      starfield(env, 60, night, 31);
      orb(ctx, w * 0.78, h * 0.16, 18, [240, 240, 220], 0.8, night);
      ctx.fillStyle = css([30, 42, 90], night);
      ctx.beginPath();
      ctx.arc(w * 0.78 + 7, h * 0.16 - 4, 16, 0, TAU);
      ctx.fill();
    }
  },
  back(env: SceneEnv) {
    const { ctx } = env;
    // Collines bleutées au loin.
    const far = byStage(env, [[176, 214, 196], [168, 210, 200], [160, 204, 214], [150, 196, 224], [214, 150, 130], [40, 52, 96]]);
    silhouette(env, 0.1, 0, (x) => 60 + 40 * ridge(x, 41, 0.01), css(far));
    // Lisière de bosquets.
    const grove = byStage(env, [[110, 180, 130], [100, 172, 122], [90, 160, 120], [84, 150, 120], [150, 110, 80], [26, 40, 60]]);
    silhouette(env, 0.22, 0, (x) => 34 + 14 * Math.abs(Math.sin(x * 0.045)) + 8 * ridge(x, 7, 0.03), css(grove));
    // Clôture, potager et fleurs, au premier plan du sol.
    const fenceY = layerY(env, 8, 0.6);
    if (fenceY < env.h + 30) {
      const s = env.scale;
      ctx.fillStyle = css(byStage(env, [[255, 248, 236], [255, 248, 236], [250, 244, 236], [240, 236, 236], [255, 214, 190], [80, 80, 110]]));
      for (let x = -200; x <= 200; x += 22) ctx.fillRect(sx(env, x) - 2 * s, fenceY - 20 * s, 4 * s, 20 * s);
      ctx.fillRect(0, fenceY - 15 * s, env.w, 2.5 * s);
      ctx.fillRect(0, fenceY - 7 * s, env.w, 2.5 * s);
      for (let k = 0; k < 14; k++) {
        const x = -190 + k * 29;
        flower(ctx, sx(env, x), fenceY + 2 * s, s, BLOCKS[1 + (k % 5)]!, env.motion ? Math.sin(env.t * 1.3 + k) * 2 * s : 0);
      }
      if (egg(env, 11, 0.6)) {
        // Escargot et son drapeau, sur la clôture.
        const ex = sx(env, -60 + (env.motion ? (env.t * 0.8) % 60 : 0));
        const ey = fenceY - 16 * s;
        ctx.fillStyle = '#C98A55';
        ctx.beginPath();
        ctx.arc(ex, ey - 4 * s, 4 * s, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = '#8A5A33';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(ex, ey - 4 * s, 2 * s, 0, TAU);
        ctx.stroke();
        ctx.fillStyle = '#B9D98A';
        ctx.fillRect(ex - 5 * s, ey - 1.5 * s, 11 * s, 2 * s);
        ctx.fillRect(ex + 5 * s, ey - 9 * s, 0.8 * s, 8 * s);
        ctx.fillStyle = '#E5537A';
        ctx.fillRect(ex + 5.8 * s, ey - 9 * s, 5 * s, 3 * s);
      }
    }
    // Grands arbres : on traverse leurs cimes vers 10 étages.
    const ty = layerY(env, altitude(env, 10, 0.4), 0.4);
    const treesSeen = reveal(env, 10);
    if (ty > -120 && ty < env.h + 160 && treesSeen > 0) {
      ctx.globalAlpha = treesSeen;
      const leaf = byStage(env, [[76, 175, 122], [70, 168, 116], [64, 160, 110], [70, 150, 110], [170, 120, 70], [30, 50, 50]]);
      for (const x of [-175, 170]) {
        const X = sx(env, x);
        ctx.fillStyle = css(darken(leaf, 0.35));
        ctx.fillRect(X - 7 * env.scale, ty, 14 * env.scale, env.h);
        tree(ctx, X, ty + 40 * env.scale, env.scale * 2.2, leaf, darken(leaf, 0.35));
      }
      ctx.globalAlpha = 1;
    }
    // Nuages et cerf-volant, vers 20 étages.
    const cy = layerY(env, altitude(env, 20, 0.5), 0.5);
    const kiteSeen = reveal(env, 20);
    if (cy > -100 && cy < env.h + 100 && kiteSeen > 0) {
      ctx.globalAlpha = kiteSeen;
      for (let k = 0; k < 4; k++) cloud(ctx, sx(env, -160 + k * 105), cy + hash(k, 3) * 50 - 25, env.scale * 1.1, [255, 255, 255], 0.85, [190, 220, 235]);
      const kx = sx(env, 120) + (env.motion ? Math.sin(env.t * 0.9) * 8 : 0);
      const ky = cy - 60 * env.scale + (env.motion ? Math.sin(env.t * 1.3) * 6 : 0);
      const s = env.scale;
      ctx.fillStyle = '#E5537A';
      ctx.beginPath();
      ctx.moveTo(kx, ky - 14 * s);
      ctx.lineTo(kx + 10 * s, ky);
      ctx.lineTo(kx, ky + 18 * s);
      ctx.lineTo(kx - 10 * s, ky);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(32,33,61,0.5)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(kx, ky + 18 * s);
      for (let k = 1; k <= 6; k++) ctx.lineTo(kx + Math.sin(k + (env.motion ? env.t * 3 : 0)) * 4 * s, ky + 18 * s + k * 7 * s);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    // Vol d'oiseaux en V au soleil couchant.
    const vy = layerY(env, altitude(env, 33, 0.4), 0.4);
    if (vy > -60 && vy < env.h + 60 && reveal(env, 33) > 0.5) {
      const base = env.motion ? (env.t * 14) % (env.w + 200) - 100 : env.w * 0.4;
      for (let k = 0; k < 7; k++) {
        ctx.save();
        ctx.translate(base - Math.abs(k - 3) * 14, vy + (k - 3) * 9);
        bird(ctx, 0.9, env.motion ? Math.sin(env.t * 6 + k) * 3 : 1, [60, 40, 50], 0.6);
        ctx.restore();
      }
    }
    // Découverte nocturne : la chouette sur sa branche.
    if (egg(env, 12, 0.55)) {
      const oy = layerY(env, altitude(env, 50, 0.35), 0.35);
      if (oy > -60 && oy < env.h + 60) {
        const ox = sx(env, -150);
        const s = env.scale;
        ctx.fillStyle = '#2B2238';
        ctx.fillRect(ox - 40 * s, oy + 10 * s, 80 * s, 3 * s);
        ctx.beginPath();
        ctx.ellipse(ox, oy, 9 * s, 12 * s, 0, 0, TAU);
        ctx.fill();
        const blink = env.motion && env.t % 5 < 0.15;
        ctx.fillStyle = '#FFE27A';
        for (const dx of [-3.5, 3.5]) {
          ctx.beginPath();
          ctx.ellipse(ox + dx * s, oy - 4 * s, 2.6 * s, blink ? 0.4 * s : 2.6 * s, 0, 0, TAU);
          ctx.fill();
        }
      }
    }
  },
  near(env: SceneEnv) {
    const seeds = fade(env, 4, 8) * (1 - fade(env, 40, 46));
    if (seeds > 0.02) {
      drifters(env, 16, 51, (ctx, x, y, i) => {
        ctx.strokeStyle = `rgba(255,255,255,${(0.7 * seeds).toFixed(3)})`;
        ctx.lineWidth = 0.7;
        ctx.beginPath();
        for (let k = 0; k < 6; k++) {
          const a = (k / 6) * TAU + i;
          ctx.moveTo(x, y);
          ctx.lineTo(x + Math.cos(a) * 3.5, y + Math.sin(a) * 3.5);
        }
        ctx.stroke();
      }, { x: 14, y: -10 });
    }
    const flies = fade(env, 44, 52);
    if (flies > 0.02) {
      drifters(env, 18, 61, (ctx, x, y, i) => {
        const a = flies * (env.motion ? 0.4 + 0.6 * Math.max(0, Math.sin(env.t * 2.4 + i * 1.7)) : 0.7);
        glow(ctx, x, y, 7, [220, 255, 120], a);
      }, { x: 6, y: -4 });
    }
  },
  ground(env: SceneEnv, top: number) {
    const { ctx, w, h } = env;
    if (top >= h) return;
    const night = fade(env, 44, 52);
    ctx.fillStyle = css(mix([140, 96, 70], [60, 44, 50], night));
    ctx.fillRect(0, top, w, h - top);
    ctx.fillStyle = css(mix([120, 196, 120], [40, 70, 70], night));
    ctx.fillRect(0, top, w, Math.min(10, h - top));
    ctx.strokeStyle = css(mix([90, 170, 100], [30, 60, 60], night));
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    for (let x = 4; x < w; x += 7) {
      const hgt = 4 + hash(Math.floor(x), 2) * 6;
      ctx.moveTo(x, top + 2);
      ctx.lineTo(x + (env.motion ? Math.sin(env.t * 2 + x) * 1.2 : 0), top - hgt);
    }
    ctx.stroke();
  },
};

export const jardin: Theme = {
  id: 'jardin',
  name: 'Jardin',
  rarity: 'rare',
  blocks: BLOCKS,
  sparks: ['#FFB840', '#4CAF7A', '#FF8F6B'].map(hex),
  ground: { top: hex('#8CD08F'), body: hex('#5FAE6E') },
  audio: { wave: 'sine', root: 392, scale: [0, 2, 4, 6, 7, 9, 11, 12, 14, 16, 18] },
  scene,
  tiers: [
    {
      name: 'Potager', skyTop: hex('#C8ECD3'), skyBottom: CREAM, ink: INK,
      decor: (ctx, it, t, motion) => {
        // Papillon.
        const flap = motion ? Math.abs(Math.sin(t * 7 + it.r1 * 10)) : 0.7;
        const c = BLOCKS[1 + Math.floor(it.r1 * 5)]!;
        ctx.fillStyle = css(c, 0.75);
        for (const d of [-1, 1]) {
          ctx.beginPath();
          ctx.ellipse(d * 4 * flap, -2, 4.5 * flap + 0.5, 5, d * 0.4, 0, TAU);
          ctx.ellipse(d * 3 * flap, 4, 3 * flap + 0.4, 3.4, -d * 0.3, 0, TAU);
          ctx.fill();
        }
        ctx.fillStyle = 'rgba(40,30,40,0.7)';
        ctx.fillRect(-0.6, -5, 1.2, 10);
      },
    },
    {
      name: 'Haies fleuries', skyTop: hex('#BFE8D0'), skyBottom: hex('#FFF0CC'), ink: INK,
      decor: (ctx, it) => {
        const c = BLOCKS[1 + Math.floor(it.r1 * 5)]!;
        const s = 0.8 + it.r2 * 0.6;
        ctx.fillStyle = css(c, 0.55);
        for (let k = 0; k < 5; k++) {
          const a = (k / 5) * TAU + it.r3;
          ctx.beginPath();
          ctx.arc(Math.cos(a) * 6 * s, Math.sin(a) * 6 * s, 4.5 * s, 0, TAU);
          ctx.fill();
        }
        ctx.fillStyle = css(hex('#FFE27A'), 0.8);
        ctx.beginPath();
        ctx.arc(0, 0, 3.2 * s, 0, TAU);
        ctx.fill();
      },
    },
    {
      name: 'Cime des arbres', skyTop: hex('#B6E2F0'), skyBottom: hex('#EAF7D8'), ink: INK,
      decor: (ctx, it, t, motion) => {
        ctx.rotate(it.r1 * TAU + (motion ? Math.sin(t * 0.7 + it.r2 * 6) * 0.25 : 0));
        ctx.fillStyle = css(LEAF, 0.5);
        ctx.beginPath();
        ctx.ellipse(0, 0, 11 + it.r2 * 6, 5, 0, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = css(darken(LEAF, 0.3), 0.35);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(-10, 0);
        ctx.lineTo(10, 0);
        ctx.stroke();
      },
    },
    {
      name: 'Cerfs-volants', skyTop: hex('#A8D8F0'), skyBottom: hex('#E4F5D8'), ink: INK,
      decor: (ctx, it, t, motion) => {
        if (it.r3 < 0.55) {
          puff(ctx, 0.6 + it.r2 * 0.5, [255, 255, 255], 0.7);
          return;
        }
        bird(ctx, 1, motion ? Math.sin(t * 6 + it.r1 * 10) * 3 : 1, INK, 0.4);
      },
    },
    {
      name: 'Soleil couchant', skyTop: hex('#FFAD86'), skyBottom: hex('#FFE2B0'), ink: INK,
      decor: (ctx, it, t, motion) => {
        const r = 4 + it.r2 * 4;
        ctx.fillStyle = css(hex('#FFF4DB'), twinkle(it, t, motion, 0.6));
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, TAU);
        ctx.fill();
        ctx.fillStyle = css(hex('#FFF4DB'), 0.16);
        ctx.beginPath();
        ctx.arc(0, 0, r * 2.4, 0, TAU);
        ctx.fill();
      },
    },
    {
      name: 'Nuit des lucioles', skyTop: hex('#1E2A5A'), skyBottom: hex('#4A5A8C'), ink: CREAM,
      decor: (ctx, it, t, motion) => star(ctx, 3 + it.r2 * 4, CREAM, twinkle(it, t, motion, 0.75)),
    },
  ],
};
