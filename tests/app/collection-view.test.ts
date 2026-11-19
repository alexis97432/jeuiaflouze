// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { renderCollection, type CollectionFilter, type PreviewFn } from '../../src/app/collection-view';
import { INITIAL_PROGRESS, applyRun } from '../../src/app/progression';

const callbacks = { onSelect: vi.fn(), onFilter: vi.fn(), onRarityHelp: vi.fn() };
const progress = { ...applyRun(INITIAL_PROGRESS, ['floors-5'], { runId: 'r', mode: 'free', score: 5, perfectCount: 0, longestStreak: 0 }).state, selected: { theme: 'confiserie', skin: 'marbre' } } as const;

function mount(preview: PreviewFn, filter: CollectionFilter = 'all') {
  document.body.innerHTML = '';
  const { nodes } = renderCollection(document, progress, callbacks, { preview, filter });
  document.body.append(...nodes);
  return document.body;
}

describe('collection V6 : aperçus du moteur, raretés, états', () => {
  it('chaque matière (cadrage matière) et chaque univers (scène qui monte), triés par rareté', () => {
    const preview = vi.fn<PreviewFn>(() => true);
    const body = mount(preview);
    const calls = preview.mock.calls.map(([, appearance, options]) => `${appearance.theme}/${appearance.skin}${options.focus === 'material' ? ':m' : ''}`);
    // V8 : 30 matières (rareté croissante) puis 13 univers.
    expect(calls.slice(0, 30)).toEqual([
      'confiserie/gomme:m', 'confiserie/strie:m', 'confiserie/bonbon:m', 'confiserie/graphite:m', 'confiserie/bois:m', 'confiserie/papier:m', 'confiserie/ardoise:m',
      'confiserie/marbre:m', 'confiserie/ceramique:m', 'confiserie/verre:m', 'confiserie/nacre:m', 'confiserie/pixel:m', 'confiserie/mosaique:m', 'confiserie/fer:m', 'confiserie/givre:m',
      'confiserie/circuit:m', 'confiserie/holographique:m', 'confiserie/lave:m', 'confiserie/or:m', 'confiserie/neon:m', 'confiserie/vitrail:m', 'confiserie/ebene:m', 'confiserie/velours:m',
      'confiserie/galaxie:m', 'confiserie/cristal:m', 'confiserie/aurore:m', 'confiserie/abysse:m', 'confiserie/phenix:m', 'confiserie/obsidienne:m', 'confiserie/sapin:m',
    ]);
    expect(calls.slice(30)).toEqual([
      'confiserie/marbre', 'desert/marbre', 'jardin/marbre', 'montagne/marbre', 'brume/marbre', 'orbital/marbre', 'recif/marbre', 'foire/marbre', 'cathedrale/marbre', 'noel/marbre', 'cite/marbre', 'nuees/marbre', 'volcan/marbre',
    ]);
    expect(body.querySelectorAll('canvas.swatch.preview')).toHaveLength(43);
    // Rareté écrite en toutes lettres sur chaque carte.
    expect(body.querySelector('[data-testid="card-skin-galaxie"] .rarity')?.textContent).toBe('Légendaire');
    expect(body.querySelector('[data-testid="card-skin-gomme"] .rarity')?.textContent).toBe('Commun');
    // États compréhensibles sans la couleur : Équipé (coche + mot), Équiper (bouton), provenance (cadenas + mot).
    expect(body.querySelector('[data-testid="card-skin-marbre"]')?.textContent).toContain('Équipé');
    expect([...body.querySelectorAll('[data-testid="card-skin-gomme"] button')].map((b) => b.textContent)).toEqual(['Équiper']);
    expect(body.querySelector('[data-testid="card-skin-graphite"]')?.textContent).toContain('Boutique · 200 pièces');
    expect(body.querySelector('[data-testid="card-skin-pixel"]')?.textContent).toContain('Passe gratuit · niveau 3');
    expect(body.querySelector('[data-testid="card-skin-or"]')?.textContent).toContain('Passe premium · niveau 9');
    expect(body.querySelector('[data-testid="card-theme-orbital"]')?.textContent).toContain('À obtenir');
    expect(body.querySelector('[data-testid="card-theme-orbital"]')?.textContent).toContain('Pose 12 étages en une partie');
    // Total : objets obtenables ici (premium à part).
    expect(body.querySelector('[data-testid="collection-count"]')?.textContent).toBe('3 / 40 obtenus');
    // Badges : pictogramme CSS.
    expect(body.querySelector('[data-testid="card-badge-precision"] .swatch-precision')).not.toBeNull();
  });

  it('filtres Obtenus et À obtenir', () => {
    const preview = vi.fn<PreviewFn>(() => true);
    const owned = mount(preview, 'owned');
    expect([...owned.querySelectorAll('[data-testid^="card-"]')].map((c) => c.getAttribute('data-testid'))).toEqual(['card-skin-gomme', 'card-skin-marbre', 'card-theme-confiserie']);
    const missing = mount(preview, 'missing');
    expect(missing.querySelector('[data-testid="card-skin-gomme"]')).toBeNull();
    expect(missing.querySelector('[data-testid="card-skin-abysse"]')).not.toBeNull();
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
