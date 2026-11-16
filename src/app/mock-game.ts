/**
 * MOCK EXPLICITE de mountGame — PAS LE VRAI JEU.
 * Permet de développer le shell sans attendre le moteur de FLK (F0/F1).
 * Doit disparaître du parcours réel en A1 (voir src/app/game-loader.ts).
 *
 * Comportement : chaque appui (pointeur ou Espace) compte comme un « placement » ;
 * la partie se termine au placement n° 1 + (seed % 5), le dernier étant un raté.
 * Score = placements réussis. Aucune géométrie, aucun parfait.
 */
import type { GameHandle, MountGame, RunResult } from './game-contract';

const TICKS_PER_SECOND = 120;

export const mockMountGame: MountGame = ({ canvas, config, onEnd }) => {
  const placementsBeforeMiss = config.seed % 5;
  const inputTicks: number[] = [];
  let ticks = 0;
  let lastFrame: number | null = null;
  let paused = false;
  let ended = false;
  let destroyed = false;
  let raf = 0;

  const ctx = canvas.getContext('2d');

  const draw = () => {
    if (!ctx) return;
    const { width, height } = canvas;
    ctx.fillStyle = '#20202a';
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = '#f5c542';
    ctx.font = `${Math.round(width / 14)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('MOCK — moteur non intégré', width / 2, height / 2 - 20);
    ctx.fillText(`placements : ${inputTicks.length}`, width / 2, height / 2 + 30);
  };

  const frame = (time: number) => {
    if (destroyed) return;
    if (!paused && !ended && lastFrame !== null) {
      ticks += Math.floor(((time - lastFrame) * TICKS_PER_SECOND) / 1000);
    }
    lastFrame = time;
    draw();
    raf = requestAnimationFrame(frame);
  };

  const place = () => {
    if (paused || ended || destroyed) return;
    if (inputTicks.at(-1) === ticks) return; // un seul placement par tick
    inputTicks.push(ticks);
    if (inputTicks.length > placementsBeforeMiss) {
      ended = true;
      const result: RunResult = {
        seed: config.seed,
        rulesVersion: config.rulesVersion,
        score: placementsBeforeMiss,
        perfectCount: 0,
        durationTicks: ticks,
        inputTicks: [...inputTicks],
      };
      onEnd(result);
    }
  };

  const onPointerDown = (event: PointerEvent) => {
    event.preventDefault();
    place();
  };
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.code !== 'Space') return;
    event.preventDefault(); // n'active pas le bouton DOM focalisé
    if (!event.repeat) place();
  };

  canvas.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('keydown', onKeyDown);
  raf = requestAnimationFrame(frame);

  const handle: GameHandle = {
    pause() {
      paused = true;
    },
    resume() {
      paused = false;
      lastFrame = null; // pas de rattrapage du temps caché
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      cancelAnimationFrame(raf);
      canvas.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    },
  };
  return handle;
};
