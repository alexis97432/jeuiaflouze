// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { renderCollection, type PreviewFn } from '../../src/app/collection-view';
import { INITIAL_PROGRESS, applyRun } from '../../src/app/progression';

const callbacks = { onSelect: vi.fn(), onBack: vi.fn() };
const progress = { ...applyRun(INITIAL_PROGRESS, ['floors-5'], { runId: 'r', mode: 'free', score: 5, perfectCount: 0, longestStreak: 0 }).state, selected: { theme: 'confiserie', skin: 'marbre' } } as const;

function mount(preview: PreviewFn) {
  document.body.innerHTML = '';
  const { nodes } = renderCollection(document, progress, callbacks, undefined, preview);
  document.body.append(...nodes);
  return document.body;
}

describe('collection : aperçus du moteur (F4)', () => {
  it("dessine chaque univers avec l'apparence choisie, et chaque apparence dans l'univers choisi", () => {
    const preview = vi.fn<PreviewFn>(() => true);
    const body = mount(preview);
    const calls = preview.mock.calls.map(([, appearance]) => `${appearance.theme}/${appearance.skin}`);
    expect(calls).toEqual([
      'confiserie/marbre', 'orbital/marbre', 'jardin/marbre',
      'confiserie/gomme', 'confiserie/marbre', 'confiserie/bonbon', 'confiserie/verre', 'confiserie/strie', 'confiserie/ceramique',
    ]);
    expect(preview.mock.calls[0]![2]).toEqual({ width: 160, height: 72 });
    expect(body.querySelectorAll('canvas.swatch.preview')).toHaveLength(9);
    // Les badges gardent leur pictogramme CSS.
    expect(body.querySelector('[data-testid="card-badge-precision"] .swatch-precision')).not.toBeNull();
    // Verrou toujours explicite sur une carte dessinée par le moteur.
    expect(body.querySelector('[data-testid="card-theme-orbital"]')?.textContent).toContain('À débloquer');
  });

  it('repli CSS si Canvas est indisponible (false) ou si le dessin lève une erreur', () => {
    const body = mount(() => false);
    expect(body.querySelectorAll('canvas.swatch.preview')).toHaveLength(0);
    expect(body.querySelector('[data-testid="card-skin-verre"] .swatch-verre')).not.toBeNull();
    const body2 = mount(() => {
      throw new Error('contexte perdu');
    });
    expect(body2.querySelector('[data-testid="card-theme-jardin"] .swatch-jardin')).not.toBeNull();
  });
});
