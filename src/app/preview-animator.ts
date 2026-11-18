/**
 * Aperçus vivants de la boutique, de la collection et du passe (V6).
 *
 * Une seule boucle d'animation pour tous les aperçus, seulement pour ceux qui sont visibles,
 * à 30 images par seconde au plus. Arrêtée en arrière-plan, en animations réduites et en mode
 * Fluide (l'aperçu reste alors une belle image fixe). Les aperçus retirés de la page sont oubliés
 * à la première image : changer d'écran ne laisse rien tourner.
 */

export type PreviewDraw = (time: number | undefined) => void;

export type PreviewAnimator = {
  /** Dessine tout de suite (image fixe), puis anime si permis. */
  watch(canvas: HTMLCanvasElement, draw: PreviewDraw): void;
  /** Oublie tous les aperçus. */
  clear(): void;
  /** Oublie les aperçus retirés de la page (changement d'écran, fenêtre fermée). */
  prune(): void;
  /** Réévalue l'autorisation d'animer (réglages changés). */
  refresh(): void;
  destroy(): void;
  /** Inspection (tests) : aperçus suivis et boucle active. */
  readonly stats: { watched: number; running: boolean };
};

type Entry = { canvas: HTMLCanvasElement; draw: PreviewDraw; visible: boolean };

export function createPreviewAnimator(win: (Window & typeof globalThis) | null, allowed: () => boolean): PreviewAnimator {
  const entries = new Map<HTMLCanvasElement, Entry>();
  let raf: number | null = null;
  let last = 0;
  let destroyed = false;
  const doc = win?.document ?? null;
  const observer = win && 'IntersectionObserver' in win
    ? new win.IntersectionObserver((list) => {
      for (const e of list) {
        const entry = entries.get(e.target as HTMLCanvasElement);
        if (entry) entry.visible = e.isIntersecting;
      }
    })
    : null;

  const canRun = () => !destroyed && typeof win?.requestAnimationFrame === 'function' && allowed() && doc?.visibilityState !== 'hidden' && entries.size > 0;

  const frame = (now: number) => {
    raf = null;
    if (!canRun()) return;
    if (now - last >= 32) {
      last = now;
      const t = now / 1000;
      for (const entry of [...entries.values()]) {
        if (!entry.canvas.isConnected) {
          observer?.unobserve(entry.canvas);
          entries.delete(entry.canvas);
          continue;
        }
        if (!entry.visible) continue;
        try {
          entry.draw(t);
        } catch {
          // Un aperçu en échec reste sur sa dernière image.
        }
      }
    }
    schedule();
  };
  const schedule = () => {
    if (raf === null && canRun()) raf = win!.requestAnimationFrame(frame);
  };
  const stop = () => {
    if (raf !== null) win?.cancelAnimationFrame(raf);
    raf = null;
  };
  const onVisibility = () => {
    if (doc?.visibilityState === 'hidden') stop();
    else schedule();
  };
  doc?.addEventListener('visibilitychange', onVisibility);

  return {
    watch(canvas, draw) {
      if (destroyed) return;
      try {
        draw(undefined);
      } catch {
        return;
      }
      // Sans IntersectionObserver, on suppose l'aperçu visible.
      entries.set(canvas, { canvas, draw, visible: !observer });
      observer?.observe(canvas);
      schedule();
    },
    clear() {
      for (const e of entries.values()) observer?.unobserve(e.canvas);
      entries.clear();
      stop();
    },
    prune() {
      for (const e of [...entries.values()]) {
        if (e.canvas.isConnected) continue;
        observer?.unobserve(e.canvas);
        entries.delete(e.canvas);
      }
      if (entries.size === 0) stop();
    },
    refresh() {
      if (canRun()) schedule();
      else {
        stop();
        // Retour à l'image fixe soignée quand l'animation n'est plus permise.
        for (const e of entries.values()) {
          try {
            e.draw(undefined);
          } catch {
            // ignoré
          }
        }
      }
    },
    destroy() {
      destroyed = true;
      stop();
      observer?.disconnect();
      entries.clear();
      doc?.removeEventListener('visibilitychange', onVisibility);
    },
    get stats() {
      return { watched: entries.size, running: raf !== null };
    },
  };
}
