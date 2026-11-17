/**
 * Carte de résultat (V3, F9) : image fixe à partager, dessinée avec le même code que le jeu.
 *
 * Tout est dérivé du **rejeu** de la partie (`replayRun`), jamais des compteurs déclarés :
 * une carte ne peut pas afficher un score que les règles ne donnent pas. Fonction pure de
 * dessin : aucun RAF, écouteur, stockage, réseau, son, nom, URL ni identifiant.
 * Le shell (Alexis) convertit en fichier, partage, télécharge et écrit le texte.
 */
import { GAME_FONT } from './renderer';
import {
  MILLI,
  replayRun,
  Simulation,
  SimulationV2,
  type AnyRunResult,
  type Block,
} from '../core';
import { BLOCK_HEIGHT, drawBlock, isDrawSkinId, type DrawSkinId } from './blocks';
import { resolveAnyAppearance, type AnyAppearance } from './mount';
import { bestInk, css, getTheme, haloFor, mix, skyAt, type Rgb } from './themes';

/** Case du motif : pose normale ou parfaite, couverte ou non par un bonus (v2). */
export type PatternCell = 'placed' | 'perfect' | 'bonus-placed' | 'bonus-perfect';

export type RunSummary = {
  rulesVersion: 1 | 2;
  /** Étages posés. */
  height: number;
  /** Points (v2) ; null en v1, où le score est la hauteur. */
  points: number | null;
  perfectCount: number;
  bestPerfectStreak: number;
  bonusCount: number;
  continued: boolean;
  /** Derniers placements, dans l'ordre (au plus MAX_PATTERN) ; `patternTotal` = nombre total. */
  pattern: PatternCell[];
  patternTotal: number;
  /** Derniers étages de la pile (base de départ comprise si elle tient), au plus MAX_TOWER. */
  tower: Block[];
  /** Indice d'étage du premier bloc de `tower` (0 = bloc de départ). */
  towerFrom: number;
};

/** Bornes de mémoire et de dessin, quelle que soit la longueur de la partie. */
/** 3 lignes de 25 cases ; 16 étages restent larges et lisibles sur la carte. */
export const MAX_PATTERN = 75;
export const MAX_TOWER = 16;

const pushBounded = <T>(list: T[], item: T, max: number) => {
  list.push(item);
  if (list.length > max) list.shift();
};

/**
 * Résumé exact d'une partie, recalculé par le rejeu. `null` si le résultat n'est pas une
 * partie valide (rejeu refusé) ou si ses compteurs déclarés ne correspondent pas au rejeu.
 */
export function summarizeRun(result: unknown): RunSummary | null {
  if (typeof result !== 'object' || result === null) return null;
  const r = result as Record<string, unknown>;
  const input = r.rulesVersion === 2
    ? { seed: r.seed, rulesVersion: 2, inputTicks: r.inputTicks, continueTicks: r.continueTicks ?? [] }
    : { seed: r.seed, rulesVersion: r.rulesVersion, inputTicks: r.inputTicks };
  const outcome = replayRun(input);
  if (!outcome.ok) return null;
  const replayed: AnyRunResult = outcome.result;
  // Les compteurs déclarés doivent être ceux du rejeu (pas de carte trompeuse).
  if (r.score !== replayed.score || r.perfectCount !== replayed.perfectCount || r.durationTicks !== replayed.durationTicks) return null;

  const pattern: PatternCell[] = [];
  let patternTotal = 0;
  const presses = new Set(replayed.inputTicks);
  if (replayed.rulesVersion === 2) {
    const sim = new SimulationV2({ seed: replayed.seed, rulesVersion: 2 });
    const continues = new Set(replayed.continueTicks);
    while (sim.status !== 'ended') {
      if (sim.status === 'fallen') {
        if (continues.has(sim.tick)) sim.continueRun(); else sim.finish();
        continue;
      }
      const e = sim.step(presses.has(sim.tick + 1));
      if (e?.kind === 'placed') {
        patternTotal++;
        const cell: PatternCell = e.bonus ? (e.perfect ? 'bonus-perfect' : 'bonus-placed') : e.perfect ? 'perfect' : 'placed';
        pushBounded(pattern, cell, MAX_PATTERN);
      }
    }
    const towerFrom = Math.max(0, sim.stack.length - MAX_TOWER);
    return {
      rulesVersion: 2, height: replayed.height, points: replayed.score, perfectCount: replayed.perfectCount,
      bestPerfectStreak: replayed.bestPerfectStreak, bonusCount: replayed.bonusCount, continued: replayed.continues > 0,
      pattern, patternTotal, tower: sim.stack.slice(towerFrom), towerFrom,
    };
  }
  const sim = new Simulation({ seed: replayed.seed, rulesVersion: 1 });
  while (sim.status !== 'ended') {
    const e = sim.step(presses.has(sim.tick + 1));
    if (e?.kind === 'placed') {
      patternTotal++;
      pushBounded(pattern, e.perfect ? 'perfect' : 'placed', MAX_PATTERN);
    }
  }
  const towerFrom = Math.max(0, sim.stack.length - MAX_TOWER);
  return {
    rulesVersion: 1, height: replayed.score, points: null, perfectCount: replayed.perfectCount,
    bestPerfectStreak: sim.bestPerfectStreak, bonusCount: 0, continued: false,
    pattern, patternTotal, tower: sim.stack.slice(towerFrom), towerFrom,
  };
}

export type CardMode = 'free' | 'challenge' | 'daily';

export type ResultCard = {
  result: AnyRunResult;
  /** Univers et matière, V2 ou V3 (F8b) ; valeur inconnue → Confiserie / Gomme. */
  appearance?: Partial<AnyAppearance>;
  mode: CardMode;
  /** Défi du jour : date UTC `AAAA-MM-JJ`, affichée en mots (« 17 novembre »), sans heure locale. */
  day?: string;
};

export type CardOptions = {
  /** Facteur de taille : 1 = 1080 × 1350 px (format portrait des réseaux). Borné à [0,1 ; 2]. */
  scale?: number;
  /** Interne (démo) : prime sur `appearance.skin`. Le chemin public est `appearance` (F8b). */
  drawSkin?: DrawSkinId;
};

export const CARD_WIDTH = 1080;
export const CARD_HEIGHT = 1350;

const MODE_LABEL: Record<CardMode, string> = { free: 'Partie libre', challenge: 'Défi entre amis', daily: 'Défi du jour' };
const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
/** « 2026-11-17 » → « 17 novembre » (« 1er » le premier du mois), indépendant de la langue de l'appareil. */
export function dayInWords(day: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!m) return null;
  const month = MONTHS[Number(m[2]) - 1];
  const date = Number(m[3]);
  if (!month || date < 1 || date > 31) return null;
  return `${date === 1 ? '1er' : date} ${month}`;
}
const FONT = (w: number, size: number) => `${w} ${size}px ${GAME_FONT}`;
const GOLD: Rgb = [255, 196, 46];

/**
 * Dessine la carte dans `canvas` (taille fixée ici). Renvoie false, sans lever, si Canvas 2D
 * est indisponible ou si le résultat ne se rejoue pas (aucune carte inventée).
 */
export function renderResultCard(canvas: HTMLCanvasElement, card: ResultCard, options: CardOptions = {}): boolean {
  const summary = summarizeRun(card.result);
  if (!summary) return false;
  const ctx = canvas.getContext('2d');
  if (!ctx) return false;
  const k = Math.min(2, Math.max(0.1, options.scale ?? 1));
  canvas.width = Math.round(CARD_WIDTH * k);
  canvas.height = Math.round(CARD_HEIGHT * k);
  const W = CARD_WIDTH;
  const H = CARD_HEIGHT;
  const appearance = resolveAnyAppearance(card.appearance);
  const skin: DrawSkinId = isDrawSkinId(options.drawSkin) ? options.drawSkin : appearance.skin;
  const theme = getTheme(appearance.theme);
  const sky = skyAt(theme, summary.height);
  const ink = sky.ink;
  const halo = css(haloFor(ink), 0.75);
  ctx.setTransform(k, 0, 0, k, 0, 0);

  // Fond : ciel de l'univers à la hauteur atteinte, sol en bas.
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, css(sky.top));
  g.addColorStop(1, css(sky.bottom));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  const groundY = H - 250;
  ctx.fillStyle = css(theme.ground.body);
  ctx.fillRect(0, groundY, W, H - groundY);
  ctx.fillStyle = css(theme.ground.top);
  ctx.fillRect(0, groundY, W, 12);

  const text = (s: string, x: number, y: number, size: number, color: string, weight = 800, align: CanvasTextAlign = 'center') => {
    ctx.font = FONT(weight, size);
    ctx.textAlign = align;
    ctx.textBaseline = 'alphabetic';
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(3, size * 0.1);
    ctx.strokeStyle = halo;
    ctx.strokeText(s, x, y);
    ctx.fillStyle = color;
    ctx.fillText(s, x, y);
  };

  // En-tête : nom du jeu, mode, univers.
  text('Pile ou Crash', W / 2, 92, 64, css(ink), 900);
  const words = card.mode === 'daily' && card.day ? dayInWords(card.day) : null;
  const day = words ? ` · ${words}` : '';
  text(`${MODE_LABEL[card.mode]}${day} · ${theme.name}`, W / 2, 148, 34, css(ink), 700);

  // Résultat : points et hauteur distincts (v2) ; hauteur seule (v1).
  if (summary.points !== null) {
    text(`${summary.points}`, W / 2, 300, 150, css(ink), 900);
    text(`point${summary.points > 1 ? 's' : ''}`, W / 2, 352, 44, css(ink), 800);
    text(`${summary.height} étage${summary.height > 1 ? 's' : ''}`, W / 2, 420, 52, css(ink), 800);
  } else {
    text(`${summary.height}`, W / 2, 300, 150, css(ink), 900);
    text(`étage${summary.height > 1 ? 's' : ''}`, W / 2, 360, 52, css(ink), 800);
  }
  const details = [`${summary.perfectCount} parfait${summary.perfectCount > 1 ? 's' : ''}`];
  if (summary.bestPerfectStreak >= 2) details.push(`série de ${summary.bestPerfectStreak}`);
  if (summary.bonusCount > 0) details.push(`${summary.bonusCount} bonus`);
  text(details.join(' · '), W / 2, 478, 34, css(ink), 700);

  // Mention « avec reprise » : bandeau visible, jamais confondu avec une partie classée.
  if (summary.continued) {
    ctx.fillStyle = 'rgba(32,33,61,0.88)';
    const bw = 360;
    roundRect(ctx, (W - bw) / 2, 500, bw, 56, 28);
    ctx.fill();
    ctx.font = FONT(800, 32);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#FFF4DB';
    ctx.fillText('avec reprise', W / 2, 539);
  }

  // Tour : les derniers étages réels, posés sur le sol, mis à l'échelle de la zone.
  const tower = summary.tower;
  const areaTop = 590;
  const areaH = groundY - areaTop;
  const s = Math.min(2.4, (W - 120) / 360, areaH / (tower.length * BLOCK_HEIGHT));
  ctx.setTransform(k * s, 0, 0, k * s, k * (W - 360 * s) / 2, k * groundY);
  tower.forEach((b, i) => {
    const floor = summary.towerFrom + i;
    const y = -(i + 1) * BLOCK_HEIGHT;
    const behind = mix(sky.top, sky.bottom, Math.min(1, Math.max(0, (groundY + y * s) / H)));
    const color = theme.blocks[floor % theme.blocks.length]!;
    drawBlock(ctx, b.left / MILLI, y, b.width / MILLI, color, { skin, sky: behind, alpha: 1, variant: floor });
  });
  ctx.setTransform(k, 0, 0, k, 0, 0);
  if (summary.towerFrom > 0) text(`… et ${summary.towerFrom} étages dessous`, W / 2, groundY + 52, 28, css(bestInk(theme.ground.body, theme.ground.body)), 700);

  // Frise du motif : une case par pose (dernières MAX_PATTERN), parfaits dorés, bonus cerclés.
  const cells = summary.pattern;
  const perRow = 25;
  const size = 30;
  const gap = 8;
  const rows = Math.ceil(cells.length / perRow);
  const fx = (W - (perRow * size + (perRow - 1) * gap)) / 2;
  const fy = groundY + 80 + (3 - Math.max(1, rows)) * (size + gap) / 2;
  const groundInk = bestInk(theme.ground.body, theme.ground.body);
  cells.forEach((c, i) => {
    const x = fx + (i % perRow) * (size + gap);
    const y = fy + Math.floor(i / perRow) * (size + gap);
    roundRect(ctx, x, y, size, size, 8);
    ctx.fillStyle = c.endsWith('perfect') ? css(GOLD) : css(groundInk, 0.35);
    ctx.fill();
    if (c.startsWith('bonus')) {
      ctx.lineWidth = 4;
      ctx.strokeStyle = css(groundInk);
      ctx.stroke();
    }
  });
  if (summary.patternTotal > cells.length) {
    text(`(${summary.patternTotal - cells.length} poses plus tôt)`, W / 2, H - 22, 22, css(groundInk), 600);
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  return true;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

