/**
 * Composants d'interface V4 (sans innerHTML). Conventions :
 * - le texte visible d'un bouton est exactement son libellé (les pictogrammes sont des SVG
 *   décoratifs), ce qui garde le nom accessible simple et stable ;
 * - les fenêtres (feuilles) piègent le focus, se ferment par Échap, ✕ ou le fond quand c'est
 *   permis, et rendent le focus à l'élément d'origine.
 */
import { el } from '../dom';
import { icon, type IconName } from './icons';

type Variant = 'primary' | 'secondary' | 'accent' | 'ghost';

export type ButtonSpec = {
  label: string;
  onClick: () => void;
  variant?: Variant;
  size?: 'xl' | 'sm';
  icon?: IconName | undefined;
  testId?: string | undefined;
  ariaLabel?: string | undefined;
  block?: boolean;
};

export function uiButton(doc: Document, spec: ButtonSpec): HTMLButtonElement {
  const classes = ['btn', spec.variant ?? 'ghost', spec.size ?? '', spec.block ? 'block' : ''].filter(Boolean).join(' ');
  const b = el(doc, 'button', { type: 'button', class: classes, 'data-testid': spec.testId, 'aria-label': spec.ariaLabel });
  if (spec.icon) b.append(icon(doc, spec.icon));
  b.append(el(doc, 'span', { class: 'label' }, spec.label));
  b.addEventListener('click', spec.onClick);
  return b;
}

/** Bouton rond à pictogramme ; le libellé est présent (lecteurs d'écran, tests) mais masqué. */
export function iconOnlyButton(
  doc: Document,
  spec: { icon: IconName; label: string; onClick: () => void; testId?: string; dot?: boolean },
): HTMLButtonElement {
  const b = el(doc, 'button', { type: 'button', class: 'icon-btn', 'data-testid': spec.testId, title: spec.label });
  b.append(icon(doc, spec.icon), el(doc, 'span', { class: 'label' }, spec.label));
  if (spec.dot) b.append(el(doc, 'span', { class: 'dot', 'aria-hidden': 'true' }));
  b.addEventListener('click', spec.onClick);
  return b;
}

export function dockButton(
  doc: Document,
  spec: { icon: IconName; label: string; onClick: () => void; testId: string; dot?: boolean; ariaLabel?: string },
): HTMLButtonElement {
  const b = el(doc, 'button', { type: 'button', class: 'dock-btn', 'data-testid': spec.testId, 'aria-label': spec.ariaLabel });
  b.append(icon(doc, spec.icon, spec.testId.replace('nav-', '').replace('leaderboard', 'board')));
  b.append(el(doc, 'span', { class: 'label' }, spec.label));
  if (spec.dot) {
    b.classList.add('has-dot');
    b.append(el(doc, 'span', { class: 'dot', 'aria-hidden': 'true' }));
  }
  b.addEventListener('click', spec.onClick);
  return b;
}

export function pill(doc: Document, iconName: IconName, text: string, kind: string, testId: string, ariaLabel?: string): HTMLElement {
  const p = el(doc, 'p', { class: `pill ${kind}`, 'data-testid': testId, 'aria-label': ariaLabel });
  p.append(icon(doc, iconName), el(doc, 'span', {}, text));
  return p;
}

export function cardTitle(doc: Document, iconName: IconName, text: string, id?: string): HTMLElement {
  const h = el(doc, 'h2', { class: 'card-title', id });
  h.append(icon(doc, iconName), el(doc, 'span', {}, text));
  return h;
}

/** Barre de progression accessible (valeur de 0 à 1). */
export function progressBar(doc: Document, ratio: number, label: string, kind = ''): HTMLElement {
  const r = Math.max(0, Math.min(1, Number.isFinite(ratio) ? ratio : 0));
  const bar = el(doc, 'div', {
    class: `bar ${kind}`.trim(),
    role: 'progressbar',
    'aria-label': label,
    'aria-valuemin': '0',
    'aria-valuemax': '100',
    'aria-valuenow': String(Math.round(r * 100)),
  });
  bar.style.setProperty('--p', String(r));
  bar.append(el(doc, 'span', {}));
  return bar;
}

export type SegOption<T extends string> = { value: T; label: string };

export function segmented<T extends string>(
  doc: Document,
  spec: { label: string; options: readonly SegOption<T>[]; value: T; onChange: (v: T) => void; testId: string },
): HTMLElement {
  const group = el(doc, 'div', { class: 'seg', role: 'group', 'aria-label': spec.label, 'data-testid': spec.testId });
  const buttons: HTMLButtonElement[] = [];
  for (const opt of spec.options) {
    const b = el(doc, 'button', {
      type: 'button',
      'aria-pressed': String(opt.value === spec.value),
      'data-value': opt.value,
      'data-testid': `${spec.testId}-${opt.value}`,
    }, opt.label);
    b.addEventListener('click', () => {
      for (const other of buttons) other.setAttribute('aria-pressed', String(other === b));
      spec.onChange(opt.value);
    });
    buttons.push(b);
    group.append(b);
  }
  return group;
}

export function switchButton(
  doc: Document,
  spec: { label: string; checked: boolean; onChange: (v: boolean) => void; testId: string },
): HTMLButtonElement {
  const b = el(doc, 'button', {
    type: 'button',
    role: 'switch',
    class: 'switch',
    'aria-checked': String(spec.checked),
    'data-testid': spec.testId,
  });
  b.append(el(doc, 'span', { class: 'label' }, spec.label), el(doc, 'span', { class: 'track', 'aria-hidden': 'true' }));
  b.addEventListener('click', () => {
    const next = b.getAttribute('aria-checked') !== 'true';
    b.setAttribute('aria-checked', String(next));
    spec.onChange(next);
  });
  return b;
}

/** Curseur 0 à 100. `onInput` pendant le glissement, `onCommit` au relâchement. */
export function rangeInput(
  doc: Document,
  spec: { label: string; value: number; onInput?: (v: number) => void; onCommit: (v: number) => void; testId: string; disabled?: boolean },
): HTMLInputElement {
  const input = el(doc, 'input', {
    type: 'range',
    class: 'range',
    min: '0',
    max: '100',
    step: '5',
    'aria-label': spec.label,
    'data-testid': spec.testId,
  });
  input.value = String(Math.round(spec.value));
  if (spec.disabled) input.disabled = true;
  input.addEventListener('input', () => spec.onInput?.(Number(input.value)));
  input.addEventListener('change', () => spec.onCommit(Number(input.value)));
  return input;
}

// ---- Fenêtres (feuilles modales) ----

export type SheetHandle = { readonly element: HTMLElement; close(): void };

export type SheetSpec = {
  title: string;
  body: (HTMLElement | SVGElement)[];
  actions?: HTMLElement[];
  /** Fermeture par Échap, ✕ et fond (défaut true). L'offre de reprise, elle, impose un choix. */
  dismissible?: boolean;
  onClose?: () => void;
  testId?: string;
  /** Élément qui reçoit le focus à l'ouverture (défaut : la première action). */
  initialFocus?: HTMLElement;
};

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

export function openSheet(doc: Document, host: HTMLElement, spec: SheetSpec): SheetHandle {
  const dismissible = spec.dismissible ?? true;
  const previous = doc.activeElement instanceof HTMLElement ? doc.activeElement : null;
  const titleId = `sheet-title-${Math.random().toString(36).slice(2, 8)}`;
  const backdrop = el(doc, 'div', { class: 'sheet-backdrop', 'data-testid': spec.testId ? `${spec.testId}-backdrop` : undefined });
  const panel = el(doc, 'div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': titleId, 'data-testid': spec.testId });
  const head = el(doc, 'div', { class: 'sheet-head' });
  head.append(el(doc, 'h2', { id: titleId }, spec.title));
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    doc.removeEventListener('keydown', onKey, true);
    backdrop.remove();
    if (previous?.isConnected) previous.focus();
    spec.onClose?.();
  };
  if (dismissible) {
    head.append(iconOnlyButton(doc, { icon: 'close', label: 'Fermer', onClick: close, testId: 'sheet-close' }));
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) close();
    });
  }
  panel.append(head, ...spec.body);
  if (spec.actions?.length) {
    const actions = el(doc, 'div', { class: 'sheet-actions' });
    actions.append(...spec.actions);
    panel.append(actions);
  }
  backdrop.append(panel);
  const onKey = (e: KeyboardEvent) => {
    if (closed) return;
    if (e.key === 'Escape' && dismissible) {
      e.preventDefault();
      e.stopPropagation();
      close();
      return;
    }
    if (e.key !== 'Tab') return;
    const items = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((x) => !x.hasAttribute('hidden'));
    if (items.length === 0) return;
    const first = items[0]!;
    const last = items[items.length - 1]!;
    if (e.shiftKey && doc.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && doc.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };
  doc.addEventListener('keydown', onKey, true);
  host.append(backdrop);
  const target = spec.initialFocus ?? panel.querySelector<HTMLElement>('.sheet-actions button') ?? panel.querySelector<HTMLElement>(FOCUSABLE);
  target?.focus();
  return { element: panel, close };
}

/** Message bref, lu aussi par la zone d'annonce du shell. */
export function showToast(doc: Document, host: HTMLElement, text: string, ms = 2200): void {
  for (const old of host.querySelectorAll('.toast')) old.remove();
  const t = el(doc, 'p', { class: 'toast', 'data-testid': 'toast', 'aria-hidden': 'true' }, text);
  host.append(t);
  setTimeout(() => t.remove(), ms);
}

const CONFETTI_COLORS = ['#ff5e6c', '#3fd6b3', '#ffc83d', '#7c5cff', '#ff8ac2', '#5ab8ff'];

/** Confettis légers (28 morceaux, 1,6 s). Masqués en CSS en mouvement réduit ou mode Fluide. */
export function confetti(doc: Document, host: HTMLElement): void {
  const box = el(doc, 'div', { class: 'confetti', 'aria-hidden': 'true' });
  for (let i = 0; i < 28; i++) {
    const piece = el(doc, 'i', {});
    piece.style.left = `${(i * 37) % 100}%`;
    piece.style.background = CONFETTI_COLORS[i % CONFETTI_COLORS.length]!;
    piece.style.animationDelay = `${(i % 7) * 60}ms`;
    piece.style.setProperty('--dx', `${((i * 53) % 120) - 60}px`);
    piece.style.setProperty('--rot', `${360 + ((i * 97) % 360)}deg`);
    box.append(piece);
  }
  host.append(box);
  setTimeout(() => box.remove(), 2000);
}
