/**
 * Écran Collection (coordination/V2.md § Collection) : univers, apparences et badges.
 * Chaque carte verrouillée dit exactement comment l'obtenir ; seules les cartes débloquées
 * se sélectionnent. Les aperçus d'univers et d'apparence sont dessinés par le moteur
 * (`renderAppearancePreview`, F4) avec le même dessin que le jeu ; repli CSS (`swatch-<id>`)
 * si Canvas 2D est indisponible. Les badges gardent leur pictogramme CSS. Anciennement :
 * ils seront alignés sur le rendu FLK (F3/F4) au branchement A4.
 */
import { renderAppearancePreview } from '../game';
import { button, el } from './dom';
import {
  BADGE_IDS,
  earnedBadges,
  objectiveFor,
  rewardLabel,
  SKIN_IDS,
  OBTAINABLE_V3_SKINS,
  V3_SKIN_SOURCE,
  THEME_IDS,
  unlockedSkins,
  unlockedThemes,
  type Appearance,
  type ProgressState,
  type Reward,
} from './progression';

/** Dessine un aperçu ; false si Canvas indisponible (contrat C6). Injectable pour les tests. */
export type PreviewFn = (
  canvas: HTMLCanvasElement,
  appearance: Appearance,
  options: { width: number; height: number },
) => boolean;

const PREVIEW_SIZE = { width: 160, height: 72 } as const;

export type CollectionCallbacks = {
  onSelect(next: Partial<Appearance>): void;
  onBack(): void;
};

const NAMES = (reward: Reward) => rewardLabel(reward).replace(/^(Apparence|Univers|Badge) /, '');

function cssSwatch(doc: Document, id: string): HTMLElement {
  const swatch = el(doc, 'div', { class: `swatch swatch-${id}`, 'aria-hidden': 'true' });
  for (let i = 0; i < 3; i++) swatch.append(el(doc, 'span', { class: 'swatch-block' }));
  return swatch;
}

export function previewOrSwatch(doc: Document, id: string, appearance: Appearance | null, preview: PreviewFn): HTMLElement {
  if (!appearance) return cssSwatch(doc, id);
  const canvas = el(doc, 'canvas', { class: 'swatch preview', 'aria-hidden': 'true', 'data-preview': id });
  let drawn = false;
  try {
    drawn = preview(canvas, appearance, PREVIEW_SIZE);
  } catch {
    drawn = false; // un aperçu en échec ne doit jamais casser la collection
  }
  return drawn ? canvas : cssSwatch(doc, id);
}

function card(
  doc: Document,
  reward: Reward,
  state: 'selected' | 'available' | 'locked' | 'earned',
  visual: HTMLElement,
  onChoose?: () => void,
): HTMLElement {
  const item = el(doc, 'li', {
    class: `card ${state}`,
    'data-testid': `card-${reward.kind}-${reward.id}`,
    tabindex: '-1', // cible du focus après un choix (revue A3b FLK, m2)
  });
  const name = el(doc, 'p', { class: 'card-name' }, NAMES(reward));
  item.append(visual, name);
  if (state === 'selected') {
    item.append(el(doc, 'p', { class: 'card-state' }, 'Sélectionné'));
  } else if (state === 'available' && onChoose) {
    const choose = button(doc, 'Choisir', onChoose, 'ghost');
    choose.setAttribute('aria-label', `Choisir ${rewardLabel(reward)}`);
    item.append(choose);
  } else if (state === 'earned') {
    item.append(el(doc, 'p', { class: 'card-state' }, 'Obtenu'));
  } else {
    const goal = objectiveFor(reward);
    const source = reward.kind === 'skin' ? V3_SKIN_SOURCE[reward.id] : undefined;
    item.append(el(doc, 'p', { class: 'card-lock' }, goal ? `À débloquer : ${goal.label.toLowerCase()}` : source ?? 'Verrouillé'));
  }
  return item;
}

export function renderCollection(
  doc: Document,
  progress: ProgressState,
  callbacks: CollectionCallbacks,
  focusCard?: string,
  preview: PreviewFn = renderAppearancePreview,
): { nodes: HTMLElement[]; focus: HTMLElement } {
  const back = button(doc, '← Retour', callbacks.onBack, 'ghost', 'collection-back');
  const title = el(doc, 'h1', { tabindex: '-1', class: 'screen-title' }, 'Collection');
  const themes = unlockedThemes(progress);
  const skins = unlockedSkins(progress);
  const badges = earnedBadges(progress);
  // Total limité aux objets obtenables dans cette version (revue FLK A2 m1) : V2, boutique et
  // piste gratuite du passe ; le premium indisponible n'est pas compté.
  const total = THEME_IDS.length + SKIN_IDS.length + OBTAINABLE_V3_SKINS.length + BADGE_IDS.length;
  const owned = themes.length + skins.filter((id) => (SKIN_IDS as readonly string[]).includes(id) || (OBTAINABLE_V3_SKINS as readonly string[]).includes(id)).length + badges.length;
  const count = el(doc, 'p', { class: 'hint', 'data-testid': 'collection-count' }, `${owned} / ${total} obtenus`);

  const section = (label: string, cards: HTMLElement[]) => {
    const s = el(doc, 'section', { class: 'collection-section', 'aria-label': label });
    const list = el(doc, 'ul', { class: 'cards' });
    list.append(...cards);
    s.append(el(doc, 'h2', {}, label), list);
    return s;
  };

  const themeCards = THEME_IDS.map((id) =>
    card(
      doc,
      { kind: 'theme', id },
      progress.selected.theme === id ? 'selected' : themes.includes(id) ? 'available' : 'locked',
      previewOrSwatch(doc, id, { theme: id, skin: progress.selected.skin }, preview),
      () => callbacks.onSelect({ theme: id }),
    ),
  );
  const skinCards = [...SKIN_IDS, ...OBTAINABLE_V3_SKINS].map((id) =>
    card(
      doc,
      { kind: 'skin', id },
      progress.selected.skin === id ? 'selected' : skins.includes(id) ? 'available' : 'locked',
      previewOrSwatch(doc, id, { theme: progress.selected.theme, skin: id }, preview),
      () => callbacks.onSelect({ skin: id }),
    ),
  );
  const badgeCards = BADGE_IDS.map((id) =>
    card(doc, { kind: 'badge', id }, badges.includes(id) ? 'earned' : 'locked', previewOrSwatch(doc, id, null, preview)),
  );

  const note = el(
    doc,
    'p',
    { class: 'hint', 'data-testid': 'collection-note' },
    'L’univers et l’apparence choisis s’appliquent à la prochaine partie. Purement visuels : les règles ne changent pas.',
  );
  const header = el(doc, 'div', { class: 'screen-header' });
  header.append(back, title);
  const chosen = focusCard ? [...themeCards, ...skinCards].find((c) => c.dataset.testid === focusCard) : undefined;
  return {
    nodes: [header, count, section('Univers', themeCards), section('Apparences', skinCards), section('Badges', badgeCards), note],
    focus: chosen ?? title,
  };
}
