/**
 * Écran Collection (V2 ; V6 : raretés, filtres, aperçus vivants). Matières, univers et badges.
 *
 * Chaque carte dit clairement son état sans dépendre de la couleur : « Équipé » (coche),
 * « Équiper » (bouton), ou comment l'obtenir (cadenas + provenance). La rareté est écrite en
 * toutes lettres. Les aperçus sont dessinés par le moteur avec le même code que le jeu ; repli
 * CSS (`swatch-<id>`) si Canvas 2D est indisponible.
 */
import { RARITY_INFO, renderAppearancePreview, type Rarity } from '../game';
import { byRarity, LOCAL_SKINS, LOCAL_THEMES, SKIN_CATALOG, sourceLabel, THEME_CATALOG, type CatalogItem } from './catalog';
import { el } from './dom';
import { progressBar, segmented, uiButton } from './ui/components';
import { icon, type IconName } from './ui/icons';
import {
  BADGE_IDS,
  earnedBadges,
  objectiveFor,
  rewardLabel,
  unlockedSkins,
  unlockedThemes,
  type Appearance,
  type ObjectiveId,
  type ProgressState,
  type Reward,
} from './progression';

/**
 * Condition de déblocage courte, au tutoiement, pour les cartes de la collection (V4) : tient sur
 * deux lignes dans une carte de 120 px. La liste complète des missions garde les phrases longues.
 */
export const SHORT_GOALS: Record<ObjectiveId, string> = {
  'floors-5': 'Pose 5 étages en une partie',
  'streak-2': 'Fais 2 parfaits d’affilée',
  'floors-12': 'Pose 12 étages en une partie',
  'perfects-5': 'Fais 5 parfaits en une partie',
  'floors-18': 'Pose 18 étages en une partie',
  'daily-8': 'Fais 8 étages au Défi du jour',
  'streak-4': 'Fais 4 parfaits d’affilée',
  'floors-25': 'Pose 25 étages en une partie',
  'perfects-10': 'Fais 10 parfaits en une partie',
};

/** Dessine un aperçu ; false si Canvas indisponible (contrat C6). Injectable pour les tests. */
export type PreviewFn = (
  canvas: HTMLCanvasElement,
  appearance: Appearance,
  options: { width: number; height: number; time?: number; climb?: boolean; focus?: 'scene' | 'material' },
) => boolean;

/** Inscrit un aperçu à l'animateur (boucle partagée) ; absent : image fixe. */
export type AnimateFn = (canvas: HTMLCanvasElement, draw: (time: number | undefined) => void) => void;

export const PREVIEW_SIZE = { width: 160, height: 72 } as const;

export type CollectionFilter = 'all' | 'owned' | 'missing';

export type CollectionCallbacks = {
  onSelect(next: Partial<Appearance>): void;
  onFilter(filter: CollectionFilter): void;
  onRarityHelp(): void;
};

function cssSwatch(doc: Document, id: string): HTMLElement {
  const swatch = el(doc, 'div', { class: `swatch swatch-${id}`, 'aria-hidden': 'true' });
  for (let i = 0; i < 3; i++) swatch.append(el(doc, 'span', { class: 'swatch-block' }));
  return swatch;
}

/**
 * Aperçu dessiné par le moteur (animé si `animate` est fourni et permis), ou pastille CSS si
 * Canvas 2D est indisponible. `climb` : l'aperçu d'univers monte à travers ses paliers.
 */
export function previewOrSwatch(
  doc: Document, id: string, appearance: Appearance | null, preview: PreviewFn,
  opts: { animate?: AnimateFn; climb?: boolean; material?: boolean; size?: { width: number; height: number } } = {},
): HTMLElement {
  if (!appearance) return cssSwatch(doc, id);
  const size = opts.size ?? PREVIEW_SIZE;
  const canvas = el(doc, 'canvas', { class: 'swatch preview', 'aria-hidden': 'true', 'data-preview': id });
  const base = { ...size, ...(opts.material ? { focus: 'material' as const } : {}) };
  let drawn = false;
  try {
    drawn = preview(canvas, appearance, base);
  } catch {
    drawn = false; // un aperçu en échec ne doit jamais casser l'écran
  }
  if (!drawn) return cssSwatch(doc, id);
  opts.animate?.(canvas, (time) => {
    preview(canvas, appearance, { ...base, ...(time === undefined ? {} : { time }), ...(opts.climb ? { climb: true } : {}) });
  });
  return canvas;
}

/** Pastille de rareté : nom écrit + pierre ; la couleur n'est jamais la seule information. */
export function rarityChip(doc: Document, rarity: Rarity): HTMLElement {
  const chip = el(doc, 'span', { class: 'rarity', 'data-rarity': rarity });
  chip.append(icon(doc, 'gem'), el(doc, 'span', {}, RARITY_INFO[rarity].name));
  return chip;
}

/** Carte d'objet cosmétique : aperçu, nom, rareté, puis l'état ou l'action. */
export function cosmeticCard(
  doc: Document,
  item: CatalogItem,
  visual: HTMLElement,
  state: 'equipped' | 'owned' | 'locked' | 'premium',
  tail: HTMLElement[],
  testId = `card-${item.kind}-${item.id}`,
): HTMLElement {
  const li = el(doc, 'li', { 'data-testid': testId, tabindex: '-1' });
  const box = el(doc, 'div', { class: `item cos ${state}`, 'data-rarity': item.rarity });
  const visualBox = el(doc, 'div', { class: 'item-visual' });
  visualBox.append(visual);
  if (state === 'equipped') {
    const badge = el(doc, 'span', { class: 'badge', 'aria-hidden': 'true' });
    badge.append(icon(doc, 'check'));
    visualBox.append(badge);
  }
  box.append(visualBox, el(doc, 'p', { class: 'item-name' }, item.name), rarityChip(doc, item.rarity), ...tail);
  li.append(box);
  return li;
}

/** Ligne d'état avec pictogramme (jamais la couleur seule). */
export function stateLine(doc: Document, iconName: IconName, text: string, kind: string, srPrefix?: string): HTMLElement {
  const p = el(doc, 'p', { class: `item-meta ${kind}` });
  p.append(icon(doc, iconName));
  if (srPrefix) p.append(el(doc, 'span', { class: 'sr-only' }, srPrefix));
  p.append(el(doc, 'span', {}, text));
  return p;
}

/** Comment obtenir un objet verrouillé, en une ligne courte. */
export function howToGet(item: CatalogItem): string {
  if (item.source.kind === 'mission') return SHORT_GOALS[item.source.objective];
  return sourceLabel(item.source);
}

/** Pictogramme d'un badge (pas d'aperçu de jeu pour un badge). */
function badgeArt(doc: Document, id: string): HTMLElement {
  const art = el(doc, 'div', { class: `swatch badge-art swatch-${id}`, 'aria-hidden': 'true' });
  art.append(icon(doc, id === 'precision' ? 'target' : 'award'));
  return art;
}

/** Nombre d'objets obtenus sur le total obtenable ici (premium à part). */
export function collectionCount(progress: ProgressState): { owned: number; total: number } {
  const skins = unlockedSkins(progress).filter((id) => (LOCAL_SKINS as readonly string[]).includes(id)).length;
  const themes = unlockedThemes(progress).filter((id) => (LOCAL_THEMES as readonly string[]).includes(id)).length;
  const badges = earnedBadges(progress).length;
  return { owned: skins + themes + badges, total: LOCAL_SKINS.length + LOCAL_THEMES.length + BADGE_IDS.length };
}

export function renderCollection(
  doc: Document,
  progress: ProgressState,
  callbacks: CollectionCallbacks,
  options: { filter?: CollectionFilter; focusCard?: string; preview?: PreviewFn; animate?: AnimateFn } = {},
): { nodes: HTMLElement[]; focus: HTMLElement } {
  const preview = options.preview ?? renderAppearancePreview;
  const filter = options.filter ?? 'all';
  const title = el(doc, 'h1', { tabindex: '-1', class: 'screen-title' }, 'Collection');
  const header = el(doc, 'div', { class: 'screen-header' });
  const help = uiButton(doc, { label: 'Raretés', icon: 'gem', variant: 'ghost', size: 'sm', testId: 'rarity-help', onClick: callbacks.onRarityHelp });
  header.append(el(doc, 'span', {}), title, help);

  const themes = unlockedThemes(progress);
  const skins = unlockedSkins(progress);
  const badges = earnedBadges(progress);
  const { owned, total } = collectionCount(progress);
  const count = el(doc, 'section', { class: 'card' });
  count.append(
    el(doc, 'p', { class: 'card-title', 'data-testid': 'collection-count' }, `${owned} / ${total} obtenus`),
    progressBar(doc, owned / total, 'Collection complétée'),
    segmented(doc, {
      label: 'Afficher',
      testId: 'collection-filter',
      value: filter,
      options: [
        { value: 'all', label: 'Tout' },
        { value: 'owned', label: 'Obtenus' },
        { value: 'missing', label: 'À obtenir' },
      ],
      onChange: (v) => callbacks.onFilter(v),
    }),
  );

  const keep = (isOwned: boolean) => filter === 'all' || (filter === 'owned' ? isOwned : !isOwned);
  const cardFor = (item: CatalogItem): HTMLElement | null => {
    const isOwned = item.kind === 'skin' ? (skins as readonly string[]).includes(item.id) : (themes as readonly string[]).includes(item.id);
    if (!keep(isOwned)) return null;
    const equipped = item.kind === 'skin' ? progress.selected.skin === item.id : progress.selected.theme === item.id;
    const premium = item.source.kind === 'pass' && item.source.track === 'premium';
    const appearance: Appearance = item.kind === 'skin'
      ? { theme: progress.selected.theme, skin: item.id as Appearance['skin'] }
      : { theme: item.id as Appearance['theme'], skin: progress.selected.skin };
    const visual = previewOrSwatch(doc, item.id, appearance, preview, { ...(options.animate ? { animate: options.animate } : {}), climb: item.kind === 'theme', material: item.kind === 'skin' });
    const label = `${item.kind === 'skin' ? 'Matière' : 'Univers'} ${item.name}`;
    if (equipped) return cosmeticCard(doc, item, visual, 'equipped', [stateLine(doc, 'check', 'Équipé', 'equipped')]);
    if (isOwned) {
      const choose = uiButton(doc, {
        label: 'Équiper', variant: 'secondary', size: 'sm', block: true, ariaLabel: `Équiper ${label}`,
        onClick: () => callbacks.onSelect(item.kind === 'skin' ? { skin: item.id as Appearance['skin'] } : { theme: item.id as Appearance['theme'] }),
      });
      return cosmeticCard(doc, item, visual, 'owned', [choose]);
    }
    return cosmeticCard(doc, item, visual, premium ? 'premium' : 'locked', [stateLine(doc, 'lock', howToGet(item), 'lock', 'À obtenir : ')]);
  };

  const section = (iconName: IconName, label: string, cards: (HTMLElement | null)[], testId: string) => {
    const list = cards.filter((c): c is HTMLElement => c !== null);
    const s = el(doc, 'section', { class: 'collection-section', 'aria-label': label, 'data-testid': testId });
    const h = el(doc, 'h2', {});
    h.append(icon(doc, iconName), el(doc, 'span', {}, label), el(doc, 'span', { class: 'count' }, `${list.length}`));
    const ul = el(doc, 'ul', { class: 'items' });
    ul.append(...list);
    if (list.length === 0) ul.append(el(doc, 'li', { class: 'empty hint' }, filter === 'owned' ? 'Rien ici pour l’instant.' : 'Tout est obtenu. Bravo !'));
    s.append(h, ul);
    return s;
  };

  const skinCards = byRarity(SKIN_CATALOG).map(cardFor);
  const themeCards = byRarity(THEME_CATALOG).map(cardFor);
  const badgeCards = BADGE_IDS.map((id) => {
    const reward: Reward = { kind: 'badge', id };
    const isOwned = badges.includes(id);
    if (!keep(isOwned)) return null;
    const li = el(doc, 'li', { 'data-testid': `card-badge-${id}`, tabindex: '-1' });
    const box = el(doc, 'div', { class: `item ${isOwned ? 'earned' : 'locked'}` });
    const visualBox = el(doc, 'div', { class: 'item-visual' });
    visualBox.append(badgeArt(doc, id));
    const goal = objectiveFor(reward);
    box.append(
      visualBox,
      el(doc, 'p', { class: 'item-name' }, rewardLabel(reward).replace(/^Badge /, '')),
      isOwned ? stateLine(doc, 'check', 'Obtenu', 'equipped') : stateLine(doc, 'lock', goal ? SHORT_GOALS[goal.id] : 'Verrouillé', 'lock', 'À obtenir : '),
    );
    li.append(box);
    return li;
  });

  const note = el(
    doc,
    'p',
    { class: 'hint small center', 'data-testid': 'collection-note' },
    'L’univers et la matière équipés s’appliquent à ta prochaine partie. Ils changent le look, jamais les règles ni le score.',
  );
  const nodes = [
    header,
    count,
    section('palette', 'Matières', skinCards, 'section-skins'),
    section('orbit', 'Univers', themeCards, 'section-themes'),
    section('award', 'Badges', badgeCards, 'section-badges'),
    note,
  ];
  const chosen = options.focusCard ? nodes.flatMap((n) => [...n.querySelectorAll<HTMLElement>(`[data-testid="${options.focusCard}"]`)])[0] : undefined;
  return { nodes, focus: chosen ?? title };
}
