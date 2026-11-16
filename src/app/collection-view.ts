/**
 * Écran Collection (coordination/V2.md § Collection) : univers, apparences et badges.
 * Chaque carte verrouillée dit exactement comment l'obtenir ; seules les cartes débloquées
 * se sélectionnent. Les aperçus sont dessinés en CSS côté shell (classe `swatch-<id>`) :
 * ils seront alignés sur le rendu FLK (F3/F4) au branchement A4.
 */
import { button, el } from './dom';
import {
  BADGE_IDS,
  earnedBadges,
  objectiveFor,
  rewardLabel,
  SKIN_IDS,
  THEME_IDS,
  unlockedSkins,
  unlockedThemes,
  type Appearance,
  type ProgressState,
  type Reward,
} from './progression';

export type CollectionCallbacks = {
  onSelect(next: Partial<Appearance>): void;
  onBack(): void;
};

const NAMES = (reward: Reward) => rewardLabel(reward).replace(/^(Apparence|Univers|Badge) /, '');

function card(
  doc: Document,
  reward: Reward,
  state: 'selected' | 'available' | 'locked' | 'earned',
  onChoose?: () => void,
): HTMLElement {
  const item = el(doc, 'li', {
    class: `card ${state}`,
    'data-testid': `card-${reward.kind}-${reward.id}`,
  });
  const swatch = el(doc, 'div', { class: `swatch swatch-${reward.id}`, 'aria-hidden': 'true' });
  for (let i = 0; i < 3; i++) swatch.append(el(doc, 'span', { class: 'swatch-block' }));
  const name = el(doc, 'p', { class: 'card-name' }, NAMES(reward));
  item.append(swatch, name);
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
    item.append(el(doc, 'p', { class: 'card-lock' }, goal ? `À débloquer : ${goal.label.toLowerCase()}` : 'Verrouillé'));
  }
  return item;
}

export function renderCollection(
  doc: Document,
  progress: ProgressState,
  callbacks: CollectionCallbacks,
): { nodes: HTMLElement[]; focus: HTMLElement } {
  const back = button(doc, '← Retour', callbacks.onBack, 'ghost', 'collection-back');
  const title = el(doc, 'h1', { tabindex: '-1', class: 'screen-title' }, 'Collection');
  const themes = unlockedThemes(progress);
  const skins = unlockedSkins(progress);
  const badges = earnedBadges(progress);
  const total = THEME_IDS.length + SKIN_IDS.length + BADGE_IDS.length;
  const owned = themes.length + skins.length + badges.length;
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
      () => callbacks.onSelect({ theme: id }),
    ),
  );
  const skinCards = SKIN_IDS.map((id) =>
    card(
      doc,
      { kind: 'skin', id },
      progress.selected.skin === id ? 'selected' : skins.includes(id) ? 'available' : 'locked',
      () => callbacks.onSelect({ skin: id }),
    ),
  );
  const badgeCards = BADGE_IDS.map((id) => card(doc, { kind: 'badge', id }, badges.includes(id) ? 'earned' : 'locked'));

  const note = el(
    doc,
    'p',
    { class: 'hint', 'data-testid': 'collection-note' },
    'Les univers et apparences choisis s’appliqueront au jeu avec la prochaine version du rendu.',
  );
  const header = el(doc, 'div', { class: 'screen-header' });
  header.append(back, title);
  return {
    nodes: [header, count, section('Univers', themeCards), section('Apparences', skinCards), section('Badges', badgeCards), note],
    focus: title,
  };
}
