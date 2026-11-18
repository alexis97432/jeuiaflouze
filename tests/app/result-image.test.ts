// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { CARD_SCALE, createResultImage } from '../../src/app/result-image';

const result = { seed: 7, rulesVersion: 2 as const, score: 12, height: 9, perfectCount: 1, bestPerfectStreak: 1, bonusCount: 1, continues: 1 as const, durationTicks: 900, inputTicks: [1, 2], continueTicks: [1] };

function docWithBlob(blob: Blob | null | 'throw') {
  const doc = document.implementation.createHTMLDocument('t');
  const create = doc.createElement.bind(doc);
  vi.spyOn(doc, 'createElement').mockImplementation(((tag: string) => {
    const e = create(tag);
    if (tag === 'canvas') {
      (e as HTMLCanvasElement).toBlob = (cb: BlobCallback) => {
        if (blob === 'throw') throw new Error('tainted');
        cb(blob);
      };
    }
    return e;
  }) as typeof doc.createElement);
  return doc;
}

describe('image de résultat (carte F9 → PNG)', () => {
  it('carte dessinée : PNG nommé, mode, jour et apparence transmis, échelle bornée', async () => {
    const render = vi.fn(() => true);
    const file = await createResultImage(render, docWithBlob(new Blob(['png'], { type: 'image/png' })))(result, 'daily', '2026-12-01', { theme: 'confiserie', skin: 'gomme' });
    expect(file).toBeInstanceOf(File);
    expect(file).toMatchObject({ name: 'stack-or-crash.png', type: 'image/png' });
    expect(render).toHaveBeenCalledWith(expect.anything(), { result, mode: 'daily', day: '2026-12-01', appearance: { theme: 'confiserie', skin: 'gomme' } }, { scale: CARD_SCALE });
  });

  it.each([
    ['carte refusée (rejeu invalide)', () => false, new Blob(['x'])],
    ['rendu qui lève', () => { throw new Error('ctx'); }, new Blob(['x'])],
    ['encodage impossible', () => true, null],
    ['encodage qui lève', () => true, 'throw' as const],
    ['image vide', () => true, new Blob([])],
  ])('%s : null (le shell partage le lien seul)', async (_n, render, blob) => {
    expect(await createResultImage(render as () => boolean, docWithBlob(blob))(result, 'free', null)).toBeNull();
  });
});

describe('carte réelle F9 + F8b : l’apparence V3 choisie arrive sur l’image (revue FLK A6b R1)', () => {
  /** Document dont les canvas enregistrent les commandes de dessin et les « encodent » en Blob. */
  function recordingDoc() {
    const doc = document.implementation.createHTMLDocument('t');
    const create = doc.createElement.bind(doc);
    vi.spyOn(doc, 'createElement').mockImplementation(((tag: string) => {
      const e = create(tag);
      if (tag === 'canvas') {
        const log: string[] = [];
        const ctx = new Proxy({}, {
          get: (_t, p) => (...args: unknown[]) => {
            log.push(`${String(p)}(${args.map(String).join(',')})`);
            if (p === 'createLinearGradient' || p === 'createRadialGradient') return { addColorStop: (o: number, c: string) => log.push(`stop ${o} ${c}`) };
            if (p === 'measureText') return { width: 10 };
            return undefined;
          },
          set: (_t, p, v) => { log.push(`${String(p)}=${String(v)}`); return true; },
        });
        const canvas = e as HTMLCanvasElement;
        canvas.getContext = (() => ctx) as unknown as typeof canvas.getContext;
        canvas.toBlob = (cb: BlobCallback) => cb(new Blob([log.join('\n')], { type: 'image/png' }));
      }
      return e;
    }) as typeof doc.createElement);
    return doc;
  }

  it('Graphite et Lave donnent une image différente de Gomme pour la même partie', async () => {
    const golden = (await import('../game/golden-v2.json')).default as { vectors: Parameters<ReturnType<typeof createResultImage>>[0][] };
    const { renderResultCard } = await import('../../src/game');
    const image = createResultImage(renderResultCard, recordingDoc());
    const run = golden.vectors[0]!;
    const text = async (skin: string) => (await image(run, 'free', null, { theme: 'confiserie', skin: skin as never }))!.text();
    const gomme = await text('gomme');
    expect(gomme.length).toBeGreaterThan(100);
    expect(await text('graphite')).not.toBe(gomme);
    expect(await text('lave')).not.toBe(gomme);
  });
});
