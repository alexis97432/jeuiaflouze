/**
 * Royaume des nuées (Légendaire, V7) : on part d'une mer de nuages, on passe entre des îles
 * suspendues dont les cascades tombent dans le vide, on longe un pont arc-en-ciel, un navire du
 * ciel et une baleine céleste, jusqu'à la citadelle dorée, puis la nuit des constellations vivantes.
 * Plans en profondeur : îles lointaines (très lente parallaxe), îles proches, nuées du premier plan.
 * Découvertes : un dragon minuscule endormi sur un nuage, la baleine qui souffle un arc-en-ciel.
 */
import { CREAM, INK, css, hex, lighten, mix, type Rgb } from '../color';
import {
  altitude, byStage, cloud, drifters, egg, fade, hash, layerY, orb, reveal, starfield, sx, TAU,
  type Scene, type SceneEnv,
} from '../scene';
import type { Theme } from '../theme-types';
import { star, twinkle } from './kit';

const BLOCKS = ['#E8504A', '#14936D', '#5A5AE6', '#E2981A', '#C2479E', '#1E85C0'].map(hex);
const RAINBOW: readonly Rgb[] = [[255, 99, 99], [255, 170, 70], [255, 230, 90], [120, 220, 120], [90, 170, 255], [170, 120, 255]];

/** Île suspendue : dessus herbeux, roche en pointe, cascade animée, petit temple facultatif. */
function island(env: SceneEnv, x: number, y: number, s: number, seed: number, tone: Rgb, temple: boolean, alpha: number): void {
  const { ctx } = env;
  ctx.globalAlpha = alpha;
  const w = (36 + hash(seed, 1) * 24) * s;
  ctx.fillStyle = css(mix(tone, [90, 70, 80], 0.45));
  ctx.beginPath();
  ctx.moveTo(x - w, y);
  ctx.lineTo(x - w * 0.5, y + 16 * s);
  ctx.lineTo(x - w * 0.1, y + (34 + hash(seed, 2) * 14) * s);
  ctx.lineTo(x + w * 0.3, y + 18 * s);
  ctx.lineTo(x + w, y);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = css(tone);
  ctx.beginPath();
  ctx.ellipse(x, y, w, 6 * s, 0, 0, TAU);
  ctx.fill();
  // Cascade : des filets qui descendent et se dissolvent dans le vide.
  const fx = x + w * (0.35 - hash(seed, 3) * 0.2);
  const g = ctx.createLinearGradient(0, y, 0, y + 70 * s);
  g.addColorStop(0, 'rgba(220,245,255,0.9)');
  g.addColorStop(1, 'rgba(220,245,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(fx - 2.5 * s, y, 5 * s, 70 * s);
  if (env.motion && env.full) {
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    for (let k = 0; k < 4; k++) {
      const p = ((env.t * 0.9 + k * 0.25 + hash(seed, 4)) % 1);
      ctx.fillRect(fx - 1.5 * s, y + p * 64 * s, 1.2 * s, 5 * s);
    }
  }
  if (temple) {
    ctx.fillStyle = '#F5EEDC';
    for (let k = -2; k <= 2; k++) ctx.fillRect(x + k * 6 * s - 1.4 * s, y - 14 * s, 2.8 * s, 14 * s);
    ctx.beginPath();
    ctx.moveTo(x - 16 * s, y - 14 * s);
    ctx.lineTo(x, y - 24 * s);
    ctx.lineTo(x + 16 * s, y - 14 * s);
    ctx.closePath();
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function airship(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, t: number): void {
  ctx.fillStyle = '#F2E2C2';
  ctx.beginPath();
  ctx.ellipse(x, y - 16 * s, 22 * s, 8 * s, 0, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = 'rgba(90,60,40,0.7)';
  ctx.lineWidth = 0.8 * s;
  ctx.beginPath();
  ctx.moveTo(x - 12 * s, y - 10 * s);
  ctx.lineTo(x - 8 * s, y - 2 * s);
  ctx.moveTo(x + 12 * s, y - 10 * s);
  ctx.lineTo(x + 8 * s, y - 2 * s);
  ctx.stroke();
  ctx.fillStyle = '#8A5A34';
  ctx.beginPath();
  ctx.moveTo(x - 14 * s, y - 2 * s);
  ctx.lineTo(x + 14 * s, y - 2 * s);
  ctx.lineTo(x + 10 * s, y + 5 * s);
  ctx.lineTo(x - 10 * s, y + 5 * s);
  ctx.closePath();
  ctx.fill();
  // Voile latérale et hélice qui tourne.
  ctx.fillStyle = 'rgba(200,70,70,0.85)';
  ctx.beginPath();
  ctx.moveTo(x - 2 * s, y - 2 * s);
  ctx.lineTo(x - 2 * s, y - 9 * s);
  ctx.lineTo(x - 12 * s, y - 2 * s);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(90,60,40,0.8)';
  ctx.fillRect(x + 16 * s, y - 2 * s - Math.abs(Math.sin(t * 20)) * 5 * s, 1.6 * s, Math.abs(Math.sin(t * 20)) * 10 * s + 1);
}

function skyWhale(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, t: number, spout: boolean): void {
  ctx.fillStyle = 'rgba(70,100,170,0.9)';
  ctx.beginPath();
  ctx.ellipse(x, y, 46 * s, 16 * s, 0, 0, TAU);
  ctx.fill();
  const flick = Math.sin(t * 1.4) * 6 * s;
  ctx.beginPath();
  ctx.moveTo(x - 42 * s, y);
  ctx.lineTo(x - 64 * s, y - 12 * s + flick);
  ctx.lineTo(x - 60 * s, y + 10 * s + flick);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(200,220,255,0.8)';
  ctx.beginPath();
  ctx.ellipse(x + 6 * s, y + 6 * s, 30 * s, 6 * s, 0, 0, Math.PI);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  for (let k = 0; k < 5; k++) {
    ctx.beginPath();
    ctx.arc(x - 20 * s + k * 9 * s, y - 6 * s - (k % 2) * 3 * s, 1.6 * s, 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = '#16213E';
  ctx.beginPath();
  ctx.arc(x + 32 * s, y - 3 * s, 1.8 * s, 0, TAU);
  ctx.fill();
  if (spout) {
    // Souffle en arc-en-ciel : sept gouttes qui retombent.
    for (let k = 0; k < RAINBOW.length; k++) {
      const p = ((t * 0.6 + k * 0.08) % 1);
      ctx.fillStyle = css(RAINBOW[k]!, 0.8 * (1 - p));
      ctx.beginPath();
      ctx.arc(x + 20 * s + (k - 3) * 4 * s * p, y - 18 * s - 26 * s * Math.sin(p * Math.PI), 2 * s, 0, TAU);
      ctx.fill();
    }
  }
}

function tinyDragon(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, breath: number): void {
  ctx.fillStyle = '#5DBB63';
  ctx.beginPath();
  ctx.ellipse(x, y, 8 * s, 4 * s * (1 + breath * 0.08), 0, 0, TAU);
  ctx.arc(x + 8 * s, y - 2 * s, 3 * s, 0, TAU);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x - 7 * s, y);
  ctx.quadraticCurveTo(x - 14 * s, y + 4 * s, x - 12 * s, y - 3 * s);
  ctx.lineWidth = 1.6 * s;
  ctx.strokeStyle = '#5DBB63';
  ctx.stroke();
  ctx.fillStyle = '#3E8E45';
  ctx.beginPath();
  ctx.moveTo(x - 2 * s, y - 3 * s);
  ctx.lineTo(x + 2 * s, y - 9 * s);
  ctx.lineTo(x + 4 * s, y - 3 * s);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(40,60,90,0.6)';
  ctx.font = `${Math.round(6 * s)}px sans-serif`;
  ctx.fillText('z', x + 11 * s, y - 7 * s - breath * 3 * s);
}

/** Constellations : étoiles reliées qui forment une tour et une baleine, et scintillent. */
function constellations(env: SceneEnv, alpha: number): void {
  if (alpha <= 0.02) return;
  const { ctx, w, h } = env;
  const shapes: [number, number][][] = [
    [[0.12, 0.3], [0.14, 0.2], [0.16, 0.12], [0.18, 0.2], [0.2, 0.3]], // une tour
    [[0.58, 0.16], [0.66, 0.12], [0.76, 0.13], [0.84, 0.18], [0.76, 0.22], [0.66, 0.21], [0.58, 0.16], [0.52, 0.1]], // une baleine
  ];
  ctx.strokeStyle = css([210, 220, 255], 0.35 * alpha);
  ctx.lineWidth = 1;
  for (const shape of shapes) {
    ctx.beginPath();
    shape.forEach(([u, v], i) => (i === 0 ? ctx.moveTo(u * w, v * h) : ctx.lineTo(u * w, v * h)));
    ctx.stroke();
    shape.forEach(([u, v], i) => {
      const tw = env.motion ? 0.6 + 0.4 * Math.sin(env.t * 1.8 + i * 1.3) : 0.85;
      ctx.fillStyle = css([255, 250, 230], alpha * tw);
      ctx.beginPath();
      ctx.arc(u * w, v * h, 1.8, 0, TAU);
      ctx.fill();
    });
  }
}

const scene: Scene = {
  far(env: SceneEnv) {
    const { ctx, w, h } = env;
    const night = fade(env, 42, 52);
    const gold = fade(env, 28, 38) * (1 - night);
    orb(ctx, w * 0.76, h * (0.15 + gold * 0.2), 24 + gold * 16, mix([255, 252, 240], [255, 200, 110], gold), 1.3, 1 - night);
    if (night > 0) {
      starfield(env, 110, night, 59);
      constellations(env, night);
      orb(ctx, w * 0.3, h * 0.08, 14, [250, 246, 230], 0.9, night);
    }
    // Îles lointaines : très lente parallaxe (elles semblent immobiles au fond du ciel).
    const tone = byStage(env, [[150, 200, 140], [146, 196, 140], [140, 190, 150], [150, 180, 170], [210, 160, 120], [60, 70, 110]]);
    for (let k = 0; k < 3; k++) {
      const y = layerY(env, 230 + k * 95, 0.05);
      if (y < -80 || y > h + 40) continue;
      island(env, sx(env, -130 + k * 130), y, env.scale * 0.5, 300 + k, mix(tone, [200, 220, 255], 0.35), false, 0.75);
    }
  },
  back(env: SceneEnv) {
    const { ctx } = env;
    const tone = byStage(env, [[120, 200, 120], [116, 196, 120], [108, 186, 126], [120, 176, 150], [220, 170, 100], [50, 70, 110]]);
    // Îles suspendues proches, chacune révélée à son étage, avec cascades.
    for (const [floor, x, temple] of [[6, -110, false], [13, 120, true], [21, -60, false], [30, 140, false]] as const) {
      const y = layerY(env, altitude(env, floor, 0.32), 0.32);
      const seen = floor <= 6 ? 1 : reveal(env, floor);
      if (seen <= 0 || y < -120 || y > env.h + 120) continue;
      island(env, sx(env, x), y, env.scale * 0.9, floor, tone, temple, seen);
      if (floor === 13 && egg(env, 7, 0.35)) tinyDragon(ctx, sx(env, x - 30), y - 8 * env.scale, env.scale, env.motion ? Math.sin(env.t * 1.5) : 0);
    }
    // Pont arc-en-ciel (vers 20 étages).
    const ry = layerY(env, altitude(env, 20, 0.36), 0.36);
    const bridge = reveal(env, 20);
    if (bridge > 0 && ry > -100 && ry < env.h + 120) {
      ctx.lineWidth = 3.2 * env.scale;
      RAINBOW.forEach((c, k) => {
        ctx.strokeStyle = css(c, 0.55 * bridge);
        ctx.beginPath();
        ctx.ellipse(env.w / 2, ry + 40 * env.scale, (120 - k * 3.2) * env.scale, (70 - k * 3.2) * env.scale, 0, Math.PI, TAU);
        ctx.stroke();
      });
    }
    // Navire du ciel (vers 27 étages), qui dérive.
    const ay = layerY(env, altitude(env, 27, 0.42), 0.42);
    if (reveal(env, 27) > 0 && ay > -60 && ay < env.h + 60) {
      const p = env.motion ? (env.t % 30) / 30 : 0.35;
      ctx.globalAlpha = reveal(env, 27);
      airship(ctx, -50 + p * (env.w + 100), ay, env.scale * 0.95, env.motion ? env.t : 0);
      ctx.globalAlpha = 1;
    }
    // Baleine céleste (vers 36 étages) : elle nage lentement, parfois en soufflant un arc-en-ciel.
    const wy = layerY(env, altitude(env, 36, 0.48), 0.48);
    if (reveal(env, 36) > 0 && wy > -80 && wy < env.h + 80) {
      const p = env.motion ? (env.t % 40) / 40 : 0.5;
      ctx.globalAlpha = reveal(env, 36);
      skyWhale(ctx, env.w + 80 - p * (env.w + 160), wy, env.scale * 0.9, env.motion ? env.t : 0, egg(env, 8, 0.5));
      ctx.globalAlpha = 1;
    }
    // Citadelle dorée au sommet (vers 46 étages).
    const cy = layerY(env, altitude(env, 46, 0.4), 0.4);
    const citadel = reveal(env, 46);
    if (citadel > 0 && cy > -140 && cy < env.h + 60) {
      const s = env.scale;
      island(env, sx(env, 0), cy + 26 * s, s * 1.3, 99, tone, false, citadel);
      ctx.globalAlpha = citadel;
      const gold = mix([255, 214, 120], [255, 240, 200], fade(env, 44, 52));
      ctx.fillStyle = css(gold);
      for (const [dx, hh, ww] of [[-30, 34, 12], [-12, 50, 14], [8, 62, 16], [28, 40, 12]] as const) {
        ctx.fillRect(sx(env, dx) - (ww * s) / 2, cy + 22 * s - hh * s, ww * s, hh * s);
        ctx.beginPath();
        ctx.moveTo(sx(env, dx) - (ww * s) / 2 - 2 * s, cy + 22 * s - hh * s);
        ctx.lineTo(sx(env, dx), cy + 22 * s - hh * s - 12 * s);
        ctx.lineTo(sx(env, dx) + (ww * s) / 2 + 2 * s, cy + 22 * s - hh * s);
        ctx.closePath();
        ctx.fill();
      }
      ctx.fillStyle = css(lighten(gold, 0.5), 0.8);
      for (let k = 0; k < 6; k++) ctx.fillRect(sx(env, -28 + k * 11), cy + 4 * s, 2.4 * s, 3.6 * s);
      ctx.globalAlpha = 1;
    }
  },
  near(env: SceneEnv) {
    // Nuées du premier plan : voiles blancs qui passent devant le décor (pas devant la tour).
    const wisps = 1 - fade(env, 40, 50) * 0.6;
    drifters(env, 6, 113, (ctx, x, y, i) => {
      cloud(ctx, x, y, 0.7 + (i % 3) * 0.25, [255, 255, 255], 0.35 * wisps);
    }, { x: 8, y: 4 });
    const gold = fade(env, 28, 36) * (1 - fade(env, 46, 52));
    if (gold > 0.02) {
      drifters(env, 18, 131, (ctx, x, y, i) => {
        ctx.fillStyle = `rgba(255,220,140,${(gold * (env.motion ? 0.4 + 0.3 * Math.sin(env.t * 2 + i) : 0.5)).toFixed(3)})`;
        ctx.fillRect(x, y, 1.6, 1.6);
      }, { x: 4, y: -10 });
    }
  },
  ground(env: SceneEnv, top: number) {
    const { ctx, w, h } = env;
    if (top >= h) return;
    const night = fade(env, 44, 52);
    // Sol de nuages : bourrelets doux et ombre bleutée.
    ctx.fillStyle = css(mix([236, 244, 255], [90, 100, 150], night));
    ctx.fillRect(0, top + 8, w, h - top);
    for (let k = 0; k < 12; k++) {
      cloud(ctx, (k / 11) * w, top + 10 + hash(k, 61) * 6, 0.9 + hash(k, 62) * 0.5, mix([255, 255, 255], [120, 130, 180], night), 1, mix([200, 215, 240], [70, 80, 130], night));
    }
  },
};

export const nuees: Theme = {
  id: 'nuees',
  name: 'Royaume des nuées',
  rarity: 'legendaire',
  blocks: BLOCKS,
  sparks: ['#FFFFFF', '#FFD166', '#8EC5FF', '#C9A7FF'].map(hex),
  ground: { top: hex('#F2F7FF'), body: hex('#DDE8FA') },
  audio: { wave: 'sine', root: 622.25, scale: [0, 2, 4, 6, 7, 9, 11, 12, 14, 16, 18] },
  scene,
  tiers: [
    {
      name: 'Mer de nuages', skyTop: hex('#6FD0E8'), skyBottom: hex('#FFFFFF'), ink: INK,
      decor: (ctx, it, t, motion) => star(ctx, 2 + it.r2 * 2, [255, 255, 255], twinkle(it, t, motion, 0.5)),
    },
    {
      name: 'Îles suspendues', skyTop: hex('#B2D8FF'), skyBottom: hex('#F0F7FF'), ink: INK,
      decor: (ctx, it, t, motion) => {
        // Graine de pissenlit céleste qui flotte.
        ctx.rotate(motion ? Math.sin(t + it.r1 * 6) * 0.3 : 0);
        ctx.strokeStyle = 'rgba(255,255,255,0.85)';
        ctx.lineWidth = 0.8;
        for (let k = 0; k < 8; k++) {
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(Math.cos((k / 8) * TAU) * 6, Math.sin((k / 8) * TAU) * 6);
          ctx.stroke();
        }
      },
    },
    {
      name: 'Cascades célestes', skyTop: hex('#98C3FF'), skyBottom: hex('#E6EFFF'), ink: INK,
      decor: (ctx, it, t, motion) => star(ctx, 3 + it.r2 * 3, [220, 245, 255], twinkle(it, t, motion, 0.65)),
    },
    {
      name: 'Pont arc-en-ciel', skyTop: hex('#86ADFF'), skyBottom: hex('#FFE4F4'), ink: INK,
      decor: (ctx, it, t, motion) => star(ctx, 3 + it.r2 * 3, RAINBOW[Math.floor(it.r1 * RAINBOW.length)]!, twinkle(it, t, motion, 0.7)),
    },
    {
      name: 'Citadelle dorée', skyTop: hex('#F4A85C'), skyBottom: hex('#FFE7B4'), ink: INK,
      decor: (ctx, it, t, motion) => star(ctx, 3 + it.r2 * 4, [255, 236, 180], twinkle(it, t, motion, 0.75)),
    },
    {
      name: 'Constellations', skyTop: hex('#0B1030'), skyBottom: hex('#3B2C70'), ink: CREAM,
      decor: (ctx, it, t, motion) => star(ctx, 4 + it.r2 * 5, CREAM, twinkle(it, t, motion, 0.9)),
    },
  ],
};
