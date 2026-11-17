/** Petits constructeurs DOM sans innerHTML (aucune donnée n'est interprétée comme du HTML). */

export function el<K extends keyof HTMLElementTagNameMap>(
  doc: Document,
  tag: K,
  props: Partial<Record<string, string>> = {},
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = doc.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value !== undefined) node.setAttribute(key, value);
  }
  if (text !== undefined) node.textContent = text;
  return node;
}

export function button(
  doc: Document,
  label: string,
  onClick: () => void,
  variant: 'primary' | 'secondary' | 'ghost' = 'secondary',
  testId?: string,
): HTMLButtonElement {
  const b = el(doc, 'button', { type: 'button', class: `btn ${variant}`, 'data-testid': testId }, label);
  b.addEventListener('click', onClick);
  return b;
}

export const floors = (n: number) => `${n} étage${n > 1 ? 's' : ''}`;

/**
 * Bouton avec pictogramme. Le pictogramme est posé en CSS (`data-icon`, contenu alternatif vide) :
 * il n'entre ni dans le texte ni dans le nom accessible du bouton (« Jouer », pas « ▶ Jouer »).
 */
export function iconButton(
  doc: Document,
  icon: string,
  label: string,
  onClick: () => void,
  variant: 'primary' | 'secondary' | 'ghost' | 'tab' = 'secondary',
  testId?: string,
): HTMLButtonElement {
  const b = button(doc, label, onClick, variant === 'tab' ? 'ghost' : variant, testId);
  if (variant === 'tab') b.classList.add('tab');
  b.dataset.icon = icon;
  return b;
}
