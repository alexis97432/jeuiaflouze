/**
 * Écran Collection (coordination/V2.md § Collection) : univers, apparences et badges.
 * Chaque carte verrouillée dit exactement comment l'obtenir ; seules les cartes débloquées
 * se sélectionnent. Les aperçus d'univers et d'apparence sont dessinés par le moteur
 * (`renderAppearancePreview`, F4) avec le même dessin que le jeu ; repli CSS (`swatch-<id>`)
 * si Canvas 2D est indisponible. Les badges gardent leur pictogramme CSS. Anciennement :
 * ils seront alignés sur le rendu FLK (F3/F4) au branchement A4.
 */
import { renderAppearancePreview } from '../game';
import { el } from './dom';
import { iconOnlyButton, progressBar, uiButton } from './ui/components';
import { icon, type IconName } from './ui/icons';
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
  visual: HTMLElement | SVGElement,
  onChoose?: () => void,
): HTMLElement {
  const item = el(doc, 'li', {
    'data-testid': `card-${reward.kind}-${reward.id}`,
    tabindex: '-1', // cible du focus après un choix (revue A3b FLK, m2)
  });
  const box = el(doc, 'div', { class: `item ${state}` });
  const visualBox = el(doc, 'div', { class: 'item-visual' });
  visualBox.append(visual);
  box.append(visualBox, el(doc, 'p', { class: 'item-name' }, NAMES(reward)));
  if (state === 'selected') {
    const badge = el(doc, 'span', { class: 'badge', 'aria-hidden': 'true' });
    badge.append(icon(doc, 'check'));
    box.append(badge, el(doc, 'p', { class: 'item-meta' }, 'Sélectionné'));
  } else if (state === 'available' && onChoose) {
    box.append(uiButton(doc, { label: 'Choisir', variant: 'secondary', size: 'sm', block: true, ariaLabel: `Choisir ${rewardLabel(reward)}`, onClick: onChoose }));
  } else if (state === 'earned') {
    box.append(el(doc, 'p', { class: 'item-meta' }, 'Obtenu'));
  } else {
    const goal = objectiveFor(reward);
    const source = reward.kind === 'skin' ? V3_SKIN_SOURCE[reward.id] : undefined;
    const lock = el(doc, 'p', { class: 'item-meta lock' });
    lock.append(icon(doc, 'lock'), el(doc, 'span', {}, goal ? `À débloquer : ${goal.label.toLowerCase()}` : source ?? 'Verrouillé'));
    box.append(lock);
  }
  item.append(box);
  return item;
}

/** Pictogramme d'un badge (pas d'aperçu de jeu pour un badge). */
function badgeArt(doc: Document, id: string): HTMLElement {
  const art = el(doc, 'div', { class: `swatch badge-art swatch-${id}`, 'aria-hidden': 'true' });
  art.append(icon(doc, id === 'precision' ? 'target' : 'award'));
  return art;
}

export function renderCollection(
  doc: Document,
  progress: ProgressState,
  callbacks: CollectionCallbacks,
  focusCard?: string,
  preview: PreviewFn = renderAppearancePreview,
): { nodes: HTMLElement[]; focus: HTMLElement } {
  const back = iconOnlyButton(doc, { icon: 'back', label: 'Retour', onClick: callbacks.onBack, testId: 'collection-back' });
  const title = el(doc, 'h1', { tabindex: '-1', class: 'screen-title' }, 'Collection');
  const themes = unlockedThemes(progress);
  const skins = unlockedSkins(progress);
  const badges = earnedBadges(progress);
  // Total limité aux objets obtenables dans cette version (revue FLK A2 m1) : V2, boutique et
  // piste gratuite du passe ; le premium indisponible n'est pas compté.
  const total = THEME_IDS.length + SKIN_IDS.length + OBTAINABLE_V3_SKINS.length + BADGE_IDS.length;
  const owned = themes.length + skins.filter((id) => (SKIN_IDS as readonly string[]).includes(id) || (OBTAINABLE_V3_SKINS as readonly string[]).includes(id)).length + badges.length;
  const count = el(doc, 'section', { class: 'card' });
  count.append(
    el(doc, 'p', { class: 'card-title', 'data-testid': 'collection-count' }, `${owned} / ${total} obtenus`),
    progressBar(doc, owned / total, 'Collection complétée'),
  );

  const section = (iconName: IconName, label: string, cards: HTMLElement[]) => {
    const s = el(doc, 'section', { class: 'collection-section', 'aria-label': label });
    const list = el(doc, 'ul', { class: 'items' });
    list.append(...cards);
    const h = el(doc, 'h2', {});
    h.append(icon(doc, iconName), el(doc, 'span', {}, label));
    s.append(h, list);
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
    card(doc, { kind: 'badge', id }, badges.includes(id) ? 'earned' : 'locked', badgeArt(doc, id)),
  );

  const note = el(
    doc,
    'p',
    { class: 'hint small center', 'data-testid': 'collection-note' },
    'L’univers et l’apparence choisis s’appliquent à ta prochaine partie. Ils changent le look, pas les règles.',
  );
  const header = el(doc, 'div', { class: 'screen-header' });
  header.append(back, title);
  const chosen = focusCard ? [...themeCards, ...skinCards].find((c) => c.dataset.testid === focusCard) : undefined;
  return {
    nodes: [header, count, section('orbit', 'Univers', themeCards), section('palette', 'Apparences', skinCards), section('award', 'Badges', badgeCards), note],
    focus: chosen ?? title,
  };
}
