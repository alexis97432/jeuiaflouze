/**
 * Cœur d'obsidienne (Légendaire, V8, collection sombre) : une plaine de basalte noir veinée de
 * coulées incandescentes ; la forge abandonnée des anciens et ses statues de géants ; un escalier
 * de titans gardé par une tête colossale brisée ; la caldeira qui crache des braises sous les
 * éclairs ; un ciel de cendre traversé d'une lune rouge ; enfin l'éclipse et sa couronne de feu.
 *
 * Lisibilité : le noir n'est jamais plat. La roche est éclairée par en dessous (rouge-orangé) et
 * découpée sur un ciel brun-rouge plus clair ; les coulées donnent des repères lumineux.
 * Découvertes : un golem de lave endormi qui ouvre un œil, une salamandre de feu sur une coulée,
 * un éclair qui frappe la caldeira.
 */
import { CREAM, css, hex, mix, type Rgb } from '../color';
import {
  altitude, byStage, drifters, egg, fade, hash, layerY, orb, reveal, ridge, silhouette, sx, TAU,
  type Scene, type SceneEnv,
} from '../scene';
import type { Theme } from '../theme-types';
import { glow, ledge, star, twinkle } from './kit';

const BLOCKS = ['#C9663A', '#8A8076', '#E0A24A', '#6E5E58', '#B84A32', '#A89C90'].map(hex);
const LAVA: Rgb = [255, 120, 40];

/** Coulée de lave sinueuse sur un plan, qui respire lentement. */
function lavaRiver(env: SceneEnv, y: number, p: number, seed: number, width: number): void {
  const { ctx, w } = env;
  const Y = layerY(env, y, p);
  if (Y < -40 || Y > env.h + 40) return;
  const pulse = env.motion ? 0.75 + 0.25 * Math.sin(env.t * 0.9 + seed) : 0.85;
  ctx.lineCap = 'round';
  for (const [lw, c, a] of [[width * 3, [255, 80, 20] as Rgb, 0.18], [width, LAVA, 0.85], [width * 0.35, [255, 220, 140] as Rgb, 0.9]] as const) {
    ctx.strokeStyle = css(c, a * pulse);
    ctx.lineWidth = lw * env.scale;
    ctx.beginPath();
    for (let x = -10; x <= w + 10; x += 12) {
      const X = (x - w / 2) / env.scale;
      const yy = Y + ridge(X, seed, 0.025) * 10 * env.scale;
      if (x === -10) ctx.moveTo(x, yy);
      else ctx.lineTo(x, yy);
    }
    ctx.stroke();
  }
}

/** Statue de géant taillée dans l'obsidienne, éclairée par en dessous. */
function giant(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, rock: Rgb, under: number): void {
  ctx.fillStyle = css(rock);
  ctx.beginPath();
  ctx.moveTo(x - 16 * s, y);
  ctx.lineTo(x - 14 * s, y - 50 * s);
  ctx.lineTo(x - 20 * s, y - 58 * s);
  ctx.lineTo(x - 8 * s, y - 64 * s);
  ctx.lineTo(x - 6 * s, y - 74 * s);
  ctx.lineTo(x + 6 * s, y - 74 * s);
  ctx.lineTo(x + 8 * s, y - 64 * s);
  ctx.lineTo(x + 20 * s, y - 58 * s);
  ctx.lineTo(x + 14 * s, y - 50 * s);
  ctx.lineTo(x + 16 * s, y);
  ctx.closePath();
  ctx.fill();
  // Marteau posé.
  ctx.fillRect(x + 18 * s, y - 40 * s, 3 * s, 40 * s);
  ctx.fillRect(x + 12 * s, y - 46 * s, 15 * s, 8 * s);
  // Reflets de braise sur les arêtes (lumière d'en bas).
  const g = ctx.createLinearGradient(0, y, 0, y - 74 * s);
  g.addColorStop(0, `rgba(255,110,40,${(0.55 * under).toFixed(3)})`);
  g.addColorStop(0.6, 'rgba(255,110,40,0)');
  ctx.fillStyle = g;
  ctx.fillRect(x - 16 * s, y - 74 * s, 4 * s, 74 * s);
  // Yeux éteints, braise au fond.
  ctx.fillStyle = `rgba(255,140,60,${(0.6 * under).toFixed(3)})`;
  ctx.fillRect(x - 3.5 * s, y - 69 * s, 2 * s, 1.2 * s);
  ctx.fillRect(x + 1.5 * s, y - 69 * s, 2 * s, 1.2 * s);
}

/** Tête colossale brisée, posée de biais. */
function colossalHead(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, rock: Rgb): void {
  ctx.fillStyle = css(rock);
  ctx.beginPath();
  ctx.moveTo(x - 40 * s, y);
  ctx.lineTo(x - 44 * s, y - 40 * s);
  ctx.lineTo(x - 30 * s, y - 70 * s);
  ctx.lineTo(x + 10 * s, y - 78 * s);
  ctx.lineTo(x + 34 * s, y - 60 * s);
  ctx.lineTo(x + 26 * s, y - 34 * s); // cassure
  ctx.lineTo(x + 38 * s, y - 20 * s);
  ctx.lineTo(x + 30 * s, y);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = css(mix(rock, [0, 0, 0], 0.45));
  ctx.fillRect(x - 24 * s, y - 52 * s, 12 * s, 4 * s);
  ctx.fillRect(x + 2 * s, y - 54 * s, 12 * s, 4 * s);
  ctx.fillRect(x - 10 * s, y - 30 * s, 20 * s, 3 * s);
  ctx.fillStyle = css(mix(rock, [255, 140, 70], 0.2));
  ctx.fillRect(x - 44 * s, y - 40 * s, 3 * s, 40 * s);
}

/** Marches monumentales qui montent en diagonale. */
function titanStairs(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, rock: Rgb): void {
  for (let k = 0; k < 8; k++) {
    ctx.fillStyle = css(mix(rock, [255, 120, 60], k % 2 ? 0.06 : 0.12));
    ctx.fillRect(x + k * 14 * s, y - k * 10 * s, 60 * s, 10 * s);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(x + k * 14 * s, y - k * 10 * s + 8 * s, 60 * s, 2 * s);
  }
}

function golem(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, eye: number): void {
  ctx.fillStyle = '#2A2220';
  ctx.beginPath();
  ctx.ellipse(x, y - 9 * s, 22 * s, 10 * s, 0, Math.PI, 0);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,120,40,0.7)';
  ctx.lineWidth = 1 * s;
  ctx.beginPath();
  ctx.moveTo(x - 14 * s, y - 6 * s);
  ctx.lineTo(x - 6 * s, y - 14 * s);
  ctx.lineTo(x + 4 * s, y - 9 * s);
  ctx.lineTo(x + 12 * s, y - 15 * s);
  ctx.stroke();
  if (eye > 0.05) {
    ctx.fillStyle = `rgba(255,200,80,${eye.toFixed(3)})`;
    ctx.beginPath();
    ctx.ellipse(x + 8 * s, y - 12 * s, 2.4 * s, 1.1 * s * eye, 0, 0, TAU);
    ctx.fill();
    glow(ctx, x + 8 * s, y - 12 * s, 10 * s, [255, 160, 60], eye * 0.6);
  }
}

const scene: Scene = {
  far(env: SceneEnv) {
    const { ctx, w, h } = env;
    // Lune rouge dans la cendre, puis l'éclipse au sommet.
    const ash = fade(env, 30, 40);
    const eclipse = fade(env, 46, 52);
    if (ash > 0.02 && eclipse < 0.98) orb(ctx, w * 0.68, h * 0.2, 18, [210, 70, 40], 1.2, ash * (1 - eclipse));
    if (eclipse > 0.02) {
      const X = w * 0.5;
      const Y = h * 0.2;
      glow(ctx, X, Y, 90, [255, 120, 40], 0.55 * eclipse);
      glow(ctx, X, Y, 46, [255, 220, 150], 0.7 * eclipse);
      const flick = env.motion ? 1 + 0.04 * Math.sin(env.t * 3) : 1;
      ctx.fillStyle = `rgba(255,190,100,${(0.9 * eclipse).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(X, Y, 24 * flick, 0, TAU);
      ctx.fill();
      ctx.fillStyle = `rgba(8,4,4,${eclipse.toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(X, Y, 22, 0, TAU);
      ctx.fill();
    }
    // Lueur rouge au ras de l'horizon : le volcan éclaire le ciel par en dessous.
    const g = ctx.createLinearGradient(0, h * 0.55, 0, h);
    g.addColorStop(0, 'rgba(255,90,30,0)');
    g.addColorStop(1, `rgba(255,90,30,${(0.22 * (1 - eclipse * 0.5)).toFixed(3)})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, h * 0.55, w, h * 0.45);
  },
  back(env: SceneEnv) {
    const { ctx } = env;
    const s = env.scale;
    const rock = byStage(env, [[44, 34, 32], [40, 32, 30], [38, 30, 30], [34, 28, 28], [30, 26, 28], [24, 20, 22]]);
    const far = mix(rock, [120, 60, 40], 0.35);
    // Volcan lointain et sa caldeira (le sommet rougeoie).
    silhouette(env, 0.08, 0, (x) => Math.max(10, 90 - Math.abs(x) * 0.55) + 6 * ridge(x, 3, 0.03), css(far));
    const cy = layerY(env, 90, 0.08);
    if (cy > -60 && cy < env.h + 60) glow(ctx, env.w / 2, cy, 50 * s, [255, 100, 30], 0.45 + (env.motion ? 0.1 * Math.sin(env.t * 1.3) : 0));
    // Plaine de basalte, coulées.
    silhouette(env, 0.2, 0, (x) => 20 + 10 * ridge(x, 7, 0.018), css(mix(rock, [90, 50, 40], 0.2)));
    lavaRiver(env, 18, 0.2, 2, 2.2);
    silhouette(env, 0.32, 0, (x) => 10 + 6 * ridge(x, 13, 0.024), css(rock));
    lavaRiver(env, 8, 0.32, 5, 3);
    // Salamandre de feu sur la coulée (souvent).
    if (egg(env, 1, 0.6) && fade(env, 0, 2) >= 0) {
      const p = env.motion ? (env.t % 14) / 14 : 0.3;
      const X = p * env.w;
      const Y = layerY(env, 8, 0.32) + ridge((X - env.w / 2) / s, 5, 0.025) * 10 * s - 2 * s;
      if (Y < env.h + 20) {
        ctx.fillStyle = '#FFB040';
        ctx.beginPath();
        ctx.ellipse(X, Y, 5 * s, 1.6 * s, 0, 0, TAU);
        ctx.fill();
        ctx.fillRect(X + 4 * s, Y - 1 * s, 3 * s, 1.4 * s);
        glow(ctx, X, Y, 9 * s, [255, 140, 40], 0.5);
      }
    }
    // Forge des anciens (vers 8 étages) : deux géants de part et d'autre, enclume, brasiers.
    const fy = layerY(env, altitude(env, 8, 0.34), 0.34);
    const forge = reveal(env, 8);
    if (forge > 0.02 && fy > -120 && fy < env.h + 120) {
      const lit: [number, number, number] = [150, 70, 40];
      const body = mix(rock, [70, 40, 34], 0.3);
      ledge(ctx, env.w, env.h, -1, fy, sx(env, -95), lit, body, forge);
      ledge(ctx, env.w, env.h, 1, fy, env.w - sx(env, 95), lit, body, forge);
      ctx.globalAlpha = forge;
      const under = env.motion ? 0.75 + 0.25 * Math.sin(env.t * 2.3) : 0.85;
      giant(ctx, sx(env, -150), fy, s, mix(rock, [70, 56, 52], 0.4), under);
      giant(ctx, sx(env, 150), fy, s, mix(rock, [70, 56, 52], 0.4), under);
      for (const x of [-110, 110]) {
        ctx.fillStyle = '#1E1816';
        ctx.fillRect(sx(env, x) - 5 * s, fy - 12 * s, 10 * s, 12 * s);
        glow(ctx, sx(env, x), fy - 16 * s, 16 * s, [255, 150, 50], 0.7 * under);
      }
      ctx.globalAlpha = 1;
    }
    // Escalier des titans et tête colossale (vers 20 étages).
    const ty = layerY(env, altitude(env, 20, 0.4), 0.4);
    const stairs = reveal(env, 20);
    if (stairs > 0.02 && ty > -160 && ty < env.h + 160) {
      ledge(ctx, env.w, env.h, 1, ty + 40 * s, env.w - sx(env, 70), [150, 70, 40], mix(rock, [70, 40, 34], 0.3), stairs);
      ledge(ctx, env.w, env.h, -1, ty + 30 * s, sx(env, -110), [150, 70, 40], mix(rock, [70, 40, 34], 0.3), stairs);
      ctx.globalAlpha = stairs;
      titanStairs(ctx, sx(env, -180), ty + 30 * s, s, mix(rock, [80, 64, 58], 0.35));
      colossalHead(ctx, sx(env, 120), ty + 40 * s, s, mix(rock, [76, 60, 56], 0.4));
      if (egg(env, 2, 0.5)) {
        const eye = env.motion ? Math.max(0, Math.sin(env.t * 0.35)) : 0.6;
        golem(ctx, sx(env, -60), ty + 34 * s, s, eye);
      }
      ctx.globalAlpha = 1;
    }
    // Caldeira (vers 35) : parois proches, éclair parfois.
    const cal = fade(env, 30, 38) * (1 - fade(env, 46, 52));
    if (cal > 0.02) {
      silhouette(env, 0.5, altitude(env, 38, 0.5) - 60, (x) => 30 + Math.abs(x) * 0.3 + 10 * ridge(x, 29, 0.03), css(mix(rock, [60, 30, 26], 0.2), cal));
      if (egg(env, 3, 0.6) && env.motion && Math.sin(env.t * 0.7) > 0.985) {
        ctx.strokeStyle = `rgba(255,236,200,${(0.9 * cal).toFixed(3)})`;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        let x = env.w * 0.4;
        let y = 0;
        ctx.moveTo(x, y);
        for (let k = 0; k < 6; k++) {
          x += (hash(k, Math.floor(env.t)) - 0.5) * 40;
          y += env.h * 0.06;
          ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    }
  },
  near(env: SceneEnv) {
    // Braises qui montent, de plus en plus nombreuses ; cendre qui tombe en haut.
    const embers = 0.5 + 0.5 * fade(env, 25, 40);
    drifters(env, 24, 41, (c, x, y, k) => {
      const a = embers * (env.motion ? 0.5 + 0.5 * Math.sin(env.t * 3 + k * 1.3) : 0.7);
      c.fillStyle = `rgba(255,${150 + (k % 3) * 30},60,${a.toFixed(3)})`;
      c.fillRect(x, y, 1.6, 1.6);
    }, { x: 6, y: -26 });
    const ash = fade(env, 32, 42);
    if (ash > 0.02) {
      drifters(env, 26, 43, (c, x, y) => {
        c.fillStyle = `rgba(150,140,136,${(0.45 * ash).toFixed(3)})`;
        c.fillRect(x, y, 1.6, 1.2);
      }, { x: -4, y: 14 });
    }
  },
  ground(env: SceneEnv, top: number) {
    const { ctx, w, h } = env;
    if (top >= h) return;
    // Obsidienne fendue : dalles noires polies, fissures incandescentes qui respirent.
    ctx.fillStyle = css([26, 20, 20]);
    ctx.fillRect(0, top, w, h - top);
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    for (let k = 0; k < 8; k++) ctx.fillRect(hash(k, 51) * w, top + 2 + hash(k, 52) * 20, 18 + hash(k, 53) * 30, 1);
    const pulse = env.motion ? 0.7 + 0.3 * Math.sin(env.t * 1.1) : 0.85;
    ctx.strokeStyle = `rgba(255,110,40,${(0.85 * pulse).toFixed(3)})`;
    ctx.lineWidth = 1.2;
    for (let k = 0; k < 7; k++) {
      let x = hash(k, 55) * w;
      let y = top + 2;
      ctx.beginPath();
      ctx.moveTo(x, y);
      for (let j = 0; j < 4; j++) {
        x += (hash(k * 7 + j, 56) - 0.5) * 30;
        y += 6 + hash(k * 7 + j, 57) * 8;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  },
};

export const volcan: Theme = {
  id: 'volcan',
  name: 'Cœur d’obsidienne',
  rarity: 'legendaire',
  blocks: BLOCKS,
  sparks: ['#FFB040', '#FF6A2A', '#FFE2A8', '#FFFFFF'].map(hex),
  ground: { top: hex('#2A2020'), body: hex('#1A1414') },
  audio: { wave: 'sawtooth', root: 146.83, scale: [0, 1, 3, 5, 7, 8, 10, 12, 13, 15, 17] },
  scene,
  tiers: [
    { name: 'Coulée noire', skyTop: hex('#2A1814'), skyBottom: hex('#7A3820'), ink: CREAM, decor: (ctx, it, t, motion) => glow(ctx, 0, 0, 4, [255, 150, 60], twinkle(it, t, motion, 0.5)) },
    { name: 'Forge des anciens', skyTop: hex('#26150F'), skyBottom: hex('#6A2E1A'), ink: CREAM, decor: (ctx, it, t, motion) => glow(ctx, 0, 0, 5, [255, 170, 70], twinkle(it, t, motion, 0.5)) },
    { name: 'Escalier des titans', skyTop: hex('#22140F'), skyBottom: hex('#5C2A1A'), ink: CREAM, decor: (ctx, it, t, motion) => glow(ctx, 0, 0, 4, [255, 190, 90], twinkle(it, t, motion, 0.45)) },
    {
      name: 'Caldeira', skyTop: hex('#1E1210'), skyBottom: hex('#52261A'), ink: CREAM,
      decor: (ctx, it, t, motion) => {
        // Bombe volcanique qui retombe, traînée de braise.
        const fall = motion ? ((t * 0.4 + it.r1) % 1) * 18 : 6;
        ctx.strokeStyle = 'rgba(255,140,50,0.5)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-6, -10 + fall);
        ctx.lineTo(0, fall);
        ctx.stroke();
        ctx.fillStyle = '#2A1A16';
        ctx.beginPath();
        ctx.arc(0, fall, 2.5, 0, TAU);
        ctx.fill();
      },
    },
    { name: 'Ciel de cendre', skyTop: hex('#1A1414'), skyBottom: hex('#4A2C26'), ink: CREAM, decor: (ctx, it, t, motion) => star(ctx, 1.5 + it.r2, [255, 200, 170], twinkle(it, t, motion, 0.3)) },
    { name: 'Éclipse', skyTop: hex('#120C0C'), skyBottom: hex('#3E201A'), ink: CREAM, decor: (ctx, it, t, motion) => star(ctx, 2 + it.r2 * 3, [255, 220, 190], twinkle(it, t, motion, 0.7)) },
  ],
};
